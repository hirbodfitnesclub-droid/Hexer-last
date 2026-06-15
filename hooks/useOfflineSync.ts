import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { listPending, remove, bumpRetry, moveToFailed, remapTempId } from '../services/offline/outbox';
import * as projectService from '../services/projectService';
import * as taskService from '../services/taskService';
import * as noteService from '../services/noteService';
import * as habitService from '../services/habitService';

export const useOfflineSync = (
  userId: string | undefined, 
  addNotification: (msg: string, type?: 'success' | 'error') => void, 
  loadInitial: () => void
) => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const syncInProgressRef = useRef(false);

  // Function to refresh pending count in outbox
  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await listPending();
      setPendingCount(pending.length);
    } catch (err) {
      console.warn('[Sync] Failed to fetch outbox length:', err);
    }
  }, []);

  // Update pending count periodically
  useEffect(() => {
    refreshPendingCount();
    const interval = setInterval(refreshPendingCount, 5000);
    return () => clearInterval(interval);
  }, [refreshPendingCount]);

  const flushOutbox = useCallback(async () => {
    if (!userId || syncInProgressRef.current) return;
    
    // Check network connectivity first
    if (!navigator.onLine) {
      return;
    }

    // Session Guard: Get session and refresh if needed
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      console.warn('[Sync] No active session found during offline sync flush, skipping.');
      return;
    }

    syncInProgressRef.current = true;
    setIsSyncing(true);

    try {
      let pendingList = await listPending();
      if (pendingList.length === 0) {
        setIsSyncing(false);
        syncInProgressRef.current = false;
        return;
      }

      console.log(`[Sync] Starting sync for ${pendingList.length} offline operations.`);
      
      for (const item of pendingList) {
        // Double check network while processing the queue
        if (!navigator.onLine) {
          console.warn('[Sync] Connection lost mid-sync. Pausing queue.');
          break;
        }

        let success = false;
        let finalErrorObj: any = null;

        try {
          if (item.entity === 'projects') {
            if (item.action === 'insert') {
              const res = await projectService.createProject(item.payload);
              await remapTempId(item.id, res.id);
            } else if (item.action === 'update') {
              await projectService.updateProject(item.id, item.payload);
            } else if (item.action === 'delete') {
              await projectService.deleteProject(item.id);
            }
          } else if (item.entity === 'tasks') {
            if (item.action === 'insert') {
              const res = await taskService.createTask(item.payload);
              await remapTempId(item.id, res.id);
            } else if (item.action === 'update') {
              await taskService.updateTask(item.id, item.payload);
            } else if (item.action === 'delete') {
              await taskService.deleteTask(item.id);
            }
          } else if (item.entity === 'notes') {
            if (item.action === 'insert') {
              const res = await noteService.createNote(item.payload);
              await remapTempId(item.id, res.id);
            } else if (item.action === 'update') {
              await noteService.updateNote(item.id, item.payload);
            } else if (item.action === 'delete') {
              await noteService.deleteNote(item.id);
            }
          } else if (item.entity === 'habits') {
            if (item.action === 'insert') {
              const res = await habitService.createHabit(item.payload);
              await remapTempId(item.id, res.id);
            } else if (item.action === 'update') {
              await habitService.updateHabit(item.id, item.payload);
            } else if (item.action === 'delete') {
              await habitService.deleteHabit(item.id);
            } else if (item.action === 'toggle') {
              await habitService.toggleHabitCompletion(item.payload.habitId, item.payload.date);
            }
          }

          success = true;
        } catch (err: any) {
          finalErrorObj = err;
        }

        if (success) {
          await remove(item.id);
        } else {
          const isErrRetryable = isRetryable(finalErrorObj);
          const errorMsg = finalErrorObj?.message || 'Unknown network/server error';
          
          if (isErrRetryable) {
            console.warn(`[Sync] Retryable error encountered for item ${item.id}. Keeping in queue:`, errorMsg);
            await bumpRetry(item.id);
            break;
          } else {
            console.error(`[Sync] Permanent failure for item ${item.id}. Moving to DLQ failed store:`, errorMsg);
            
            await moveToFailed(item.id, errorMsg);
            addNotification(`برخی تغییرات آفلاین شما به دلیل تعارض ثبت نشد: ${item.entity}`, 'error');

            if (item.action === 'insert') {
              const remaining = await listPending();
              for (const child of remaining) {
                let isDependent = false;
                if (child.id === item.id) {
                  isDependent = true;
                } else {
                  const strPayload = JSON.stringify(child.payload || {});
                  if (strPayload.includes(item.id)) {
                    isDependent = true;
                  }
                }

                if (isDependent) {
                  console.warn(`[Sync] Cascading discard of dependent item ${child.id} referencing failed parent ${item.id}`);
                  await moveToFailed(child.id, `Dropped because parent creation (${item.id}) failed permanently: ${errorMsg}`);
                }
              }
            }
          }
        }
      }

      await refreshPendingCount();
      loadInitial();
      
    } catch (globalErr) {
      console.error('[Sync] Global error during sync run:', globalErr);
    } finally {
      setIsSyncing(false);
      syncInProgressRef.current = false;
    }
  }, [userId, addNotification, loadInitial, refreshPendingCount]);

  // Synchronize on connection restoration automatically
  useEffect(() => {
    if (!userId) return;

    const handleOnline = () => {
      console.log('[Sync] Network connection is reinstated. Triggering synchronization...');
      flushOutbox();
    };

    window.addEventListener('online', handleOnline);
    
    if (navigator.onLine) {
      flushOutbox();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [userId, flushOutbox]);

  return { isSyncing, pendingCount, flushOutbox };
};

function isRetryable(error: any): boolean {
  if (!error) return false;
  
  if (navigator.onLine === false) return true;
  
  const msg = (error.message || '').toLowerCase();
  if (
    msg.includes('network') || 
    msg.includes('fetch') || 
    msg.includes('aborted') || 
    msg.includes('timeout') || 
    error instanceof TypeError
  ) {
    return true;
  }
  
  const status = error.status || error.statusCode || Number(error.code);
  if (!isNaN(status)) {
    if (status >= 500 || status === 401 || status === 403 || status === 408 || status === 429) {
      return true;
    }
  }
  
  return false;
}
