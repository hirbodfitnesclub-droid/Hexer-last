import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Page, Task, Note, ChatMessage, Habit, Project, ActionResult, EntityLink, TaskRecurrence } from '../types';
import * as projectService from '../services/projectService';
import * as taskService from '../services/taskService';
import * as noteService from '../services/noteService';
import * as habitService from '../services/habitService';
import * as billingService from '../services/billingService';
import { loadSnapshot, saveSnapshot } from '../services/offline/snapshot';
import { enqueue } from '../services/offline/outbox';
import { completeRecurringTask, runRecurrenceScopeOperation, type RecurrenceScopeOperation } from '../services/recurrenceService';
import { useOfflineSync } from './useOfflineSync';
import { newId } from '../utils/uuid';
import { hasMeaningfulEdit } from '../utils/taskPatch';
import { formatPersianDate, isSameTehranDay } from '../utils/dateUtils';
import {
  buildNextRecurrence,
  canContinueRecurrence,
  computeNextDueDate,
  normalizeRecurrence,
  resetChecklistItems,
} from '../utils/recurrenceUtils';

export interface AppNotification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  action?: {
    label: string;
    onClick: () => void;
  };
}

const isBrowserOffline = (): boolean => !window.navigator.onLine;

export const useDataManager = (user: any) => {
  const userId = user?.id;
  const [currentPage, setCurrentPage] = useState<Page>(Page.Dashboard);
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { id: 'initial', sender: 'ai', text: 'سلام! خوش آمدید. چطور می‌توانم در مدیریت کارهایتان به شما کمک کنم؟' }
  ]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [entityLinks, setEntityLinks] = useState<EntityLink[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  /** Always-current lists for spawn/inject guards (avoids stale closure + double-spawn). */
  const tasksRef = useRef<Task[]>([]);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);
  const notesRef = useRef<Note[]>([]);
  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);
  const projectsRef = useRef<Project[]>([]);
  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);
  const habitsRef = useRef<Habit[]>([]);
  useEffect(() => {
    habitsRef.current = habits;
  }, [habits]);

  // Pagination states
  const [tasksLimit, setTasksLimit] = useState(50);
  const [notesLimit, setNotesLimit] = useState(50);

  // Subscription & profiles
  const [profile, setProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallMessage, setPaywallMessage] = useState('');
  const [isOnboarding, setIsOnboarding] = useState(false);

  // Global editing modal states
  const [editingHabit, setEditingHabit] = useState<Habit | Partial<Habit> | null>(null);

  const onTriggerUpgrade = useCallback(() => {
    setPaywallMessage('جهت دسترسی نامحدود به دستیار هوشمند و قابلیتهای مدیریت پروژه، طرح خود را ارتقا دهید.');
    setShowPaywall(true);
  }, []);

  // Notification management
  const addNotification = useCallback((
    message: string,
    type: 'success' | 'error' | 'info' = 'success',
    action?: AppNotification['action']
  ) => {
    const id = Date.now();
    setNotifications(prev => [
      ...prev.filter(n => n.message !== message),
      { id, message, type, action }
    ]);
    setTimeout(() => {
      removeNotification(id);
    }, 5000);
  }, []);

  const removeNotification = useCallback((id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Increase pagination limits
  const loadMoreTasks = useCallback(() => {
    setTasksLimit(prev => prev + 50);
  }, []);

  const loadMoreNotes = useCallback(() => {
    setNotesLimit(prev => prev + 50);
  }, []);

  // Tracker to detect existing data for silent background syncs
  const dataExistsRef = useRef(false);
  useEffect(() => {
    dataExistsRef.current = projects.length > 0 || tasks.length > 0;
  }, [projects.length, tasks.length]);

  // Initial Loader
  const loadInitial = useCallback(async () => {
    if (!userId) return;
    if (!dataExistsRef.current) {
      setLoadingData(true);
    }
    
    // 1. Hydrate from local snapshots immediately for rapid visual boot (SWR)
    try {
      const [
        cachedProjects,
        cachedTasks,
        cachedNotes,
        cachedHabits,
        cachedProfile,
        cachedSub,
        cachedLinks
      ] = await Promise.all([
        loadSnapshot(userId, 'projects'),
        loadSnapshot(userId, 'tasks'),
        loadSnapshot(userId, 'notes'),
        loadSnapshot(userId, 'habits'),
        loadSnapshot(userId, 'profile'),
        loadSnapshot(userId, 'subscription'),
        loadSnapshot(userId, 'entityLinks')
      ]);

      if (cachedProjects && cachedProjects.length > 0) setProjects(cachedProjects);
      if (cachedTasks && cachedTasks.length > 0) setTasks(cachedTasks);
      if (cachedNotes && cachedNotes.length > 0) setNotes(cachedNotes);
      if (cachedHabits && cachedHabits.length > 0) setHabits(cachedHabits);
      
      if (cachedProfile && cachedProfile.length > 0) {
        const prof = cachedProfile[0];
        setProfile(prof);
        if (prof.onboarding_completed === false) {
          setIsOnboarding(true);
        }
      }
      if (cachedSub && cachedSub.length > 0) {
        setSubscription(cachedSub[0]);
      }
      if (cachedLinks && cachedLinks.length > 0) setEntityLinks(cachedLinks);

      // Successfully hydrated local state. Turn off loader so user sees UI instantly
      if (cachedProjects?.length > 0 || cachedTasks?.length > 0 || cachedNotes?.length > 0) {
        setLoadingData(false);
      }
    } catch (e) {
      console.warn('[SWR] Local hydration failed, falling back to direct fetch:', e);
    }

    // 2. Background Revalidation (Network Fetch)
    try {
      // Fetch high priority critical paths first
      const profileResult = await supabase.from('profiles').select('*').maybeSingle();
      if (profileResult.data) {
        setProfile(profileResult.data);
        if (profileResult.data.onboarding_completed === false) {
          setIsOnboarding(true);
        }
        await saveSnapshot(userId, 'profile', [profileResult.data]);
      }

      const subData = await billingService.getSubscription();
      if (subData) {
        setSubscription(subData);
        await saveSnapshot(userId, 'subscription', [subData]);
      }

      // Fetch other data in background
      const [projectsData, tasksData, notesData, habitsData, linksResult] = await Promise.all([
        projectService.getProjects(),
        taskService.getTasks(tasksLimit),
        noteService.getNotes(notesLimit),
        habitService.getHabits(),
        supabase.from('task_note_links').select('*')
      ]);

      setProjects(projectsData);
      setTasks(tasksData);
      setNotes(notesData);
      setHabits(habitsData);
      setEntityLinks(linksResult.data || []);

      // Overwrite local snapshots with fresh server data
      await Promise.all([
        saveSnapshot(userId, 'projects', projectsData),
        saveSnapshot(userId, 'tasks', tasksData),
        saveSnapshot(userId, 'notes', notesData),
        saveSnapshot(userId, 'habits', habitsData),
        saveSnapshot(userId, 'entityLinks', linksResult.data || [])
      ]);

      dataExistsRef.current = true;
    } catch (error) {
      console.warn("[SWR Background Revalidation] Gracefully handled Network revalidation error:", error);
      // Only show error if we have no loaded data at all
      if (!dataExistsRef.current && projects.length === 0 && tasks.length === 0) {
        addNotification("مشکلی در همگام‌سازی با شبکه وجود دارد. کارهای شما کماکان آفلاین در دسترس هستند.", "info");
      }
    } finally {
      setLoadingData(false);
    }
  }, [userId, addNotification, tasksLimit, notesLimit]);

  // Projects CRUD - Optimistic UI & Offline Queue support
  const addProject = useCallback(async (project: Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const originalProjects = [...projects];
    const tempId = newId();
    const tempProj: Project = {
      ...project,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: user?.id || ''
    };

    const nextProjects = [tempProj, ...projects];
    setProjects(nextProjects);
    await saveSnapshot(userId, 'projects', nextProjects);

    if (!navigator.onLine) {
      await enqueue({ id: tempId, entity: 'projects', action: 'insert', payload: project });
      addNotification("پروژه به صورت آفلاین ذخیره شد.", "info");
      return;
    }

    try {
      const newProj = await projectService.createProject(project, tempId);
      setProjects(prev => prev.map(p => p.id === tempId ? newProj : p));
      const finalProjects = nextProjects.map(p => p.id === tempId ? newProj : p);
      await saveSnapshot(userId, 'projects', finalProjects);
      addNotification("پروژه با موفقیت ساخته شد.");
    } catch (error) {
      const msg = (error as any)?.message || '';
      const isRetry = isBrowserOffline() || msg.includes('Failed to fetch') || error instanceof TypeError;
      if (isRetry) {
        await enqueue({ id: tempId, entity: 'projects', action: 'insert', payload: project });
        addNotification("پروژه به صورت آفلاین ثبت شد.", "info");
      } else {
        setProjects(originalProjects);
        await saveSnapshot(userId, 'projects', originalProjects);
        addNotification("خطا در ساخت پروژه.", "error");
      }
    }
  }, [projects, user, userId, addNotification]);

  const updateProject = useCallback(async (project: Project) => {
    const originalProjects = [...projects];
    const nextProjects = projects.map(p => p.id === project.id ? project : p);
    setProjects(nextProjects);
    await saveSnapshot(userId, 'projects', nextProjects);

    if (!navigator.onLine) {
      await enqueue({ id: project.id, entity: 'projects', action: 'update', payload: project });
      addNotification("تغییرات پروژه به صورت آفلاین ثبت شد.", "info");
      return;
    }

    try {
      const updatedProj = await projectService.updateProject(project.id, project);
      setProjects(prev => prev.map(p => p.id === project.id ? updatedProj : p));
      const finalProjects = nextProjects.map(p => p.id === project.id ? updatedProj : p);
      await saveSnapshot(userId, 'projects', finalProjects);
      addNotification("پروژه به‌روزرسانی شد.");
    } catch (error) {
      const msg = (error as any)?.message || '';
      const isRetry = isBrowserOffline() || msg.includes('Failed to fetch') || error instanceof TypeError;
      if (isRetry) {
        await enqueue({ id: project.id, entity: 'projects', action: 'update', payload: project });
        addNotification("تغییرات پروژه به صورت آفلاین ثبت شد.", "info");
      } else {
        setProjects(originalProjects);
        await saveSnapshot(userId, 'projects', originalProjects);
        addNotification("خطا در به‌روزرسانی پروژه.", "error");
      }
    }
  }, [projects, userId, addNotification]);

  const deleteProject = useCallback(async (id: string) => {
    const projectToDelete = projects.find(p => p.id === id);
    if (!projectToDelete) return;

    const originalProjects = [...projects];
    const nextProjects = projects.filter(p => p.id !== id);
    setProjects(nextProjects);
    await saveSnapshot(userId, 'projects', nextProjects);

    const commitDelete = async () => {
      if (!navigator.onLine) {
        await enqueue({ id, entity: 'projects', action: 'delete', payload: null });
        return;
      }
      try {
        await projectService.deleteProject(id);
      } catch (error) {
        setProjects(originalProjects);
        await saveSnapshot(userId, 'projects', originalProjects);
        addNotification('خطا در حذف پروژه.', 'error');
      }
    };

    const timeoutId = setTimeout(commitDelete, 3000);

    addNotification(
      `پروژه «${projectToDelete.title.substring(0, 20)}» حذف شد.`,
      'info',
      {
        label: 'لغو',
        onClick: async () => {
          clearTimeout(timeoutId);
          setProjects(originalProjects);
          await saveSnapshot(userId, 'projects', originalProjects);
        }
      }
    );
  }, [projects, userId, addNotification]);

  // Tasks CRUD - Optimistic UI & Atomic checks & Offline Queue support
  type AddTaskOpts = { silent?: boolean };
  type UpdateTaskOpts = { skipSeriesFanOut?: boolean; silent?: boolean };

  const addTask = useCallback(async (
    task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'completed_at'>,
    opts?: AddTaskOpts
  ): Promise<Task> => {
    const originalTasks = [...tasks];
    const tempId = newId();
    const recurrence = normalizeRecurrence(task.recurrence);
    const seriesId = recurrence
      ? (task.recurrence_series_id || newId())
      : null;
    const payload = {
      ...task,
      recurrence,
      recurrence_series_id: seriesId,
    };
    const tempTask: Task = {
      ...payload,
      id: tempId,
      status: 'todo',
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: user?.id || '',
    };

    const nextTasks = [tempTask, ...tasks];
    setTasks(nextTasks);
    await saveSnapshot(userId, 'tasks', nextTasks);

    if (!navigator.onLine) {
      await enqueue({ id: tempId, entity: 'tasks', action: 'insert', payload });
      if (!opts?.silent) addNotification('کار جدید به صورت آفلاین ذخیره شد.', 'info');
      return tempTask;
    }

    try {
      const newTask = await taskService.createTask(payload, tempId);
      setTasks(prev => prev.map(t => (t.id === tempId ? newTask : t)));
      const finalTasks = nextTasks.map(t => (t.id === tempId ? newTask : t));
      await saveSnapshot(userId, 'tasks', finalTasks);
      if (!opts?.silent) addNotification('کار با موفقیت اضافه شد.');
      return newTask;
    } catch (error) {
      const msg = (error as any)?.message || '';
      const isRetry = isBrowserOffline() || msg.includes('Failed to fetch') || error instanceof TypeError;
      if (isRetry) {
        await enqueue({ id: tempId, entity: 'tasks', action: 'insert', payload });
        if (!opts?.silent) addNotification('کار جدید به صورت آفلاین ثبت شد.', 'info');
        return tempTask;
      } else {
        setTasks(originalTasks);
        await saveSnapshot(userId, 'tasks', originalTasks);
        addNotification('خطا در افزودن کار.', 'error');
        throw error;
      }
    }
  }, [tasks, user, userId, addNotification]);

  const addTaskRef = useRef(addTask);
  useEffect(() => {
    addTaskRef.current = addTask;
  }, [addTask]);

  const maybeSpawnNextRecurrence = useCallback(async (completedTask: Task): Promise<boolean> => {
    const r = normalizeRecurrence(completedTask.recurrence);
    if (!r) return false;
    const nextDue = computeNextDueDate(completedTask.due_date, r);
    if (!nextDue) return false;
    if (!canContinueRecurrence(r, nextDue)) return false;

    // B5: stable series id — never invent a fresh series per spawn without persisting
    let seriesId = completedTask.recurrence_series_id || null;
    if (!seriesId) {
      seriesId = newId();
      // best-effort stamp on the completed row so later completes share the series
      try {
        if (navigator.onLine) {
          await taskService.updateTask(completedTask.id, {
            recurrence_series_id: seriesId,
          } as any);
        } else {
          await enqueue({
            id: completedTask.id,
            entity: 'tasks',
            action: 'update',
            payload: { recurrence_series_id: seriesId },
          });
        }
        setTasks(prev =>
          prev.map(t =>
            t.id === completedTask.id ? { ...t, recurrence_series_id: seriesId } : t
          )
        );
      } catch {
        // still spawn with seriesId; worst case history link is weak
      }
    }

    const hasOpenSameDay = tasksRef.current.some(
      t =>
        t.id !== completedTask.id &&
        t.recurrence_series_id === seriesId &&
        t.status !== 'done' &&
        t.due_date &&
        isSameTehranDay(t.due_date, nextDue)
    );
    if (hasOpenSameDay) return false;

    const nextR = buildNextRecurrence(r);
    try {
      const newTask = await addTaskRef.current(
        {
          title: completedTask.title,
          description: completedTask.description ?? null,
          project_id: completedTask.project_id ?? null,
          priority: completedTask.priority,
          tags: completedTask.tags ?? [],
          due_date: nextDue,
          checklist: resetChecklistItems(completedTask.checklist),
          recurrence: nextR,
          recurrence_series_id: seriesId,
        },
        { silent: true }
      );
      addNotification(
        `نوبت بعدی ثبت شد · ${formatPersianDate(nextDue)}`,
        'info',
        {
          label: 'مشاهده',
          onClick: () => {
            window.dispatchEvent(
              new CustomEvent('hexer:open-task-editor', { detail: newTask })
            );
          },
        }
      );
      return true;
    } catch {
      // addTask already notified on hard failure
      return false;
    }
  }, [addNotification]);

  /**
   * Server-authoritative completion for recurring tasks. Marking done and creating
   * the next occurrence happen in one transaction there, so two devices cannot both
   * spawn. A recurring completion never falls back to browser spawning because that
   * could persist the completed row without its authoritative successor.
   */
  const completeRecurringViaServer = useCallback(async (
    task: Task
  ): Promise<'handled' | 'conflict' | 'blocked'> => {
    if (!navigator.onLine) return 'blocked';
    if (!normalizeRecurrence(task.recurrence)) return 'blocked';
    if (typeof task.version !== 'number') return 'blocked';

    const outcome = await completeRecurringTask({
      task,
      opId: newId(),
      requestId: newId(),
      idempotencyKey: `recurrence.complete:${task.id}:${task.version}`,
    });

    if (outcome.kind === 'handled') {
      setTasks(prev => {
        const merged = prev.map(t => (t.id === outcome.current.id ? { ...t, ...outcome.current } : t));
        if (outcome.next && !merged.some(t => t.id === outcome.next!.id)) merged.push(outcome.next);
        void saveSnapshot(userId, 'tasks', merged);
        return merged;
      });
      if (outcome.next?.due_date) {
        addNotification(`نوبت بعدی ثبت شد · ${formatPersianDate(outcome.next.due_date)}`, 'info', {
          label: 'مشاهده',
          onClick: () => {
            window.dispatchEvent(new CustomEvent('hexer:open-task-editor', { detail: outcome.next }));
          },
        });
      }
      return 'handled';
    }

    if (outcome.kind === 'conflict') {
      if (outcome.server) {
        setTasks(prev => prev.map(t => (t.id === outcome.server!.id ? { ...t, ...outcome.server } : t)));
      }
      addNotification('این کار روی دستگاه دیگری تغییر کرده بود؛ نسخهٔ تازه بارگذاری شد.', 'info');
      return 'conflict';
    }

    return 'blocked';
  }, [userId, addNotification]);

  const updateTask = useCallback(async (
    task: Task | Partial<Task>,
    opts?: UpdateTaskOpts
  ) => {
    if (!task.id) return;
    const originalTasks = [...tasks];
    const prevTask = tasks.find(t => t.id === task.id);

    // A plain "mark done" on a recurring task belongs to the server RPC, which owns
    // the completion and the next occurrence atomically. Anything that also edits
    // other fields keeps the legacy path so the edit is not silently dropped.
    const isPlainCompletion =
      !!prevTask &&
      prevTask.status !== 'done' &&
      task.status === 'done' &&
      !hasMeaningfulEdit(task);
    if (isPlainCompletion && prevTask && normalizeRecurrence(prevTask.recurrence)) {
      const serverOutcome = await completeRecurringViaServer(prevTask);
      if (serverOutcome === 'blocked') {
        addNotification('تکمیل کار تکرارشونده موقتاً در دسترس نیست؛ تغییری ذخیره نشد.', 'info');
      }
      return;
    }

    const hasRecurrenceKey = Object.prototype.hasOwnProperty.call(task, 'recurrence');
    let patch: Task | Partial<Task> = { ...task };

    if (hasRecurrenceKey) {
      const normalized =
        task.recurrence === null || task.recurrence === undefined
          ? null
          : normalizeRecurrence(task.recurrence);
      if (normalized === null) {
        patch = { ...patch, recurrence: null, recurrence_series_id: null };
      } else {
        const seriesId =
          task.recurrence_series_id ||
          prevTask?.recurrence_series_id ||
          newId();
        patch = {
          ...patch,
          recurrence: normalized,
          recurrence_series_id: seriesId,
        };
      }
    }

    // Series-from-now: fan-out recurrence to other open tasks in series
    let fanOutIds: string[] = [];
    if (
      hasRecurrenceKey &&
      !opts?.skipSeriesFanOut &&
      patch.recurrence_series_id
    ) {
      const seriesId = patch.recurrence_series_id as string;
      const recVal = (patch.recurrence ?? null) as TaskRecurrence | null;
      fanOutIds = tasks
        .filter(
          t =>
            t.id !== task.id &&
            t.recurrence_series_id === seriesId &&
            t.status !== 'done'
        )
        .map(t => t.id);

      const nextTasks = tasks.map(t => {
        if (t.id === task.id) return { ...t, ...patch } as Task;
        if (fanOutIds.includes(t.id)) {
          return {
            ...t,
            recurrence: recVal,
            recurrence_series_id: recVal ? seriesId : null,
          } as Task;
        }
        return t;
      });
      setTasks(nextTasks);
      await saveSnapshot(userId, 'tasks', nextTasks);
    } else {
      const nextTasks = tasks.map(t =>
        t.id === task.id ? ({ ...t, ...patch } as Task) : t
      );
      setTasks(nextTasks);
      await saveSnapshot(userId, 'tasks', nextTasks);
    }

    const persistOne = async (id: string, body: Partial<Task>) => {
      if (!navigator.onLine) {
        await enqueue({ id, entity: 'tasks', action: 'update', payload: body });
        return;
      }
      try {
        await taskService.updateTask(id, body);
      } catch (error) {
        const msg = (error as any)?.message || '';
        const isRetry =
          isBrowserOffline() ||
          msg.includes('Failed to fetch') ||
          error instanceof TypeError;
        if (isRetry) {
          await enqueue({ id, entity: 'tasks', action: 'update', payload: body });
        } else {
          throw error;
        }
      }
    };

    const becameDone =
      !!prevTask &&
      prevTask.status !== 'done' &&
      (patch.status === 'done' || (task as Task).status === 'done');

    try {
      if (!navigator.onLine) {
        await enqueue({ id: task.id, entity: 'tasks', action: 'update', payload: patch });
        for (const fid of fanOutIds) {
          await enqueue({
            id: fid,
            entity: 'tasks',
            action: 'update',
            payload: {
              recurrence: patch.recurrence ?? null,
              recurrence_series_id: patch.recurrence_series_id ?? null,
            },
          });
        }
        // B2: skip generic update toast when completing — spawn (or single done path) owns feedback
        if (!opts?.silent && !becameDone) {
          addNotification('تغییرات کار به صورت آفلاین ثبت شد.', 'info');
        }
      } else {
        const updatedTask = await taskService.updateTask(task.id, patch);
        setTasks(prev => prev.map(t => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t)));
        for (const fid of fanOutIds) {
          await persistOne(fid, {
            recurrence: (patch.recurrence ?? null) as any,
            recurrence_series_id: (patch.recurrence_series_id ?? null) as any,
          });
        }
        if (!opts?.silent && !becameDone) {
          addNotification('کار به‌روزرسانی شد.');
        }
      }

      // Recurring completion returns above and is handled by the server transaction.
      if (becameDone && prevTask && !normalizeRecurrence(prevTask.recurrence)) {
        const completed: Task = {
          ...prevTask,
          ...patch,
          status: 'done',
        } as Task;
        const spawned = await maybeSpawnNextRecurrence(completed);
        if (!opts?.silent && !spawned) {
          addNotification(
            navigator.onLine ? 'کار به‌روزرسانی شد.' : 'تغییرات کار به صورت آفلاین ثبت شد.',
            navigator.onLine ? 'success' : 'info'
          );
        }
      }
    } catch (error) {
      const msg = (error as any)?.message || '';
      const isRetry =
        isBrowserOffline() ||
        msg.includes('Failed to fetch') ||
        error instanceof TypeError;
      if (isRetry) {
        await enqueue({ id: task.id, entity: 'tasks', action: 'update', payload: patch });
        if (!opts?.silent) addNotification('تغییرات کار به صورت آفلاین ثبت شد.', 'info');
      } else {
        setTasks(originalTasks);
        await saveSnapshot(userId, 'tasks', originalTasks);
        addNotification('خطا در به‌روزرسانی کار.', 'error');
        throw error;
      }
    }
  }, [tasks, userId, addNotification, maybeSpawnNextRecurrence]);

  /**
   * Runs a recurrence scope operation on the server and merges the result. Returns
   * 'fallback' when the server declines, so callers keep their legacy behaviour while
   * `recurrence_rpc_v2` is still rolling out.
   */
  const runRecurrenceScope = useCallback(async (input: {
    task: Task;
    operation: RecurrenceScopeOperation;
    updates?: Record<string, unknown>;
    recurrence?: Record<string, unknown> | null;
    keepCurrent?: boolean;
  }): Promise<'handled' | 'conflict' | 'fallback'> => {
    if (!navigator.onLine) return 'fallback';
    if (typeof input.task.version !== 'number') return 'fallback';

    const outcome = await runRecurrenceScopeOperation({
      operation: input.operation,
      task: input.task,
      opId: newId(),
      requestId: newId(),
      idempotencyKey: `recurrence.${input.operation}:${input.task.id}:${input.task.version}`,
      updates: input.updates,
      recurrence: input.recurrence,
      keepCurrent: input.keepCurrent,
    });

    if (outcome.kind === 'handled') {
      const updated = outcome.result.task;
      if (updated) {
        setTasks(prev => {
          const merged = prev.map(t => (t.id === updated.id ? { ...t, ...updated } : t));
          void saveSnapshot(userId, 'tasks', merged);
          return merged;
        });
      } else if (input.operation === 'stop') {
        // Stop clears the rule across the series, so refresh from the server rather
        // than guessing which sibling rows changed.
        try {
          const fresh = await taskService.getTasks(tasksLimit);
          setTasks(fresh);
          await saveSnapshot(userId, 'tasks', fresh);
        } catch {
          /* the next revalidation will reconcile */
        }
      }
      return 'handled';
    }

    if (outcome.kind === 'conflict') {
      if (outcome.server) {
        setTasks(prev => prev.map(t => (t.id === outcome.server!.id ? { ...t, ...outcome.server } : t)));
      }
      addNotification('این کار روی دستگاه دیگری تغییر کرده بود؛ نسخهٔ تازه بارگذاری شد.', 'info');
      return 'conflict';
    }

    return 'fallback';
  }, [userId, tasksLimit, addNotification]);

  const skipRecurrenceOccurrence = useCallback(async (id: string) => {
    const task = tasksRef.current.find(t => t.id === id) || tasks.find(t => t.id === id);
    if (!task || task.status === 'done') return;
    const r = normalizeRecurrence(task.recurrence);
    if (!r) return;

    // Prefer the server RPC: it records a skip exception and advances the occurrence in
    // one transaction. Fall back to the client path whenever the server declines.
    const viaServer = await runRecurrenceScope({ task, operation: 'skip' });
    if (viaServer !== 'fallback') return;

    const nextDue = computeNextDueDate(task.due_date, r);
    // B6: explicit feedback when series cannot advance
    if (!nextDue || !canContinueRecurrence(r, nextDue)) {
      addNotification('نوبت بعدی در بازهٔ پایان این تکرار نیست.', 'info');
      return;
    }
    const nextR = buildNextRecurrence(r);
    await updateTask(
      { id, due_date: nextDue, recurrence: nextR },
      { skipSeriesFanOut: true }
    );
  }, [tasks, updateTask, addNotification, runRecurrenceScope]);

  const deleteTask = useCallback(async (id: string) => {
    const taskToDelete = tasks.find(t => t.id === id);
    if (!taskToDelete) return;

    const originalTasks = [...tasks];
    const nextTasks = tasks.filter(t => t.id !== id);
    setTasks(nextTasks);
    await saveSnapshot(userId, 'tasks', nextTasks);

    const commitDelete = async () => {
      if (!navigator.onLine) {
        await enqueue({ id, entity: 'tasks', action: 'delete', payload: null });
        return;
      }
      try {
        await taskService.deleteTask(id);
      } catch (error) {
        setTasks(originalTasks);
        await saveSnapshot(userId, 'tasks', originalTasks);
        addNotification('خطا در حذف کار.', 'error');
      }
    };

    const timeoutId = setTimeout(commitDelete, 3000);

    addNotification(
      `کار «${taskToDelete.title.substring(0, 20)}» حذف شد.`,
      'info',
      {
        label: 'لغو',
        onClick: async () => {
          clearTimeout(timeoutId);
          setTasks(originalTasks);
          await saveSnapshot(userId, 'tasks', originalTasks);
        }
      }
    );
  }, [tasks, userId, addNotification]);

  const toggleTaskCompletion = useCallback(async (id: string) => {
    const originalTasks = [...tasks];
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newStatus = task.status === 'done' ? 'todo' : 'done';
    const completed_at = newStatus === 'done' ? new Date().toISOString() : null;

    if (newStatus === 'done' && normalizeRecurrence(task.recurrence)) {
      const serverOutcome = await completeRecurringViaServer(task);
      if (serverOutcome === 'blocked') {
        addNotification('تکمیل کار تکرارشونده موقتاً در دسترس نیست؛ تغییری ذخیره نشد.', 'info');
      }
      return;
    }

    const nextTasks = tasks.map(t =>
      t.id === id ? { ...t, status: newStatus, completed_at } : t
    );
    setTasks(nextTasks);
    await saveSnapshot(userId, 'tasks', nextTasks);

    const payload = { status: newStatus, completed_at };

    if (!navigator.onLine) {
      await enqueue({ id, entity: 'tasks', action: 'update', payload });
      if (newStatus === 'done' && !normalizeRecurrence(task.recurrence)) {
        await maybeSpawnNextRecurrence({ ...task, status: 'done', completed_at });
      }
      return;
    }

    try {
      const updatedTask = await taskService.updateTask(id, payload);
      setTasks(prev => prev.map(t => (t.id === id ? updatedTask : t)));
      const finalTasks = nextTasks.map(t => (t.id === id ? updatedTask : t));
      await saveSnapshot(userId, 'tasks', finalTasks);
      if (newStatus === 'done' && !normalizeRecurrence(task.recurrence)) {
        await maybeSpawnNextRecurrence({ ...task, ...updatedTask, status: 'done' });
      }
    } catch (error) {
      const msg = (error as any)?.message || '';
      const isRetry =
        isBrowserOffline() ||
        msg.includes('Failed to fetch') ||
        error instanceof TypeError;
      if (isRetry) {
        await enqueue({ id, entity: 'tasks', action: 'update', payload });
        if (newStatus === 'done' && !normalizeRecurrence(task.recurrence)) {
          await maybeSpawnNextRecurrence({ ...task, status: 'done', completed_at });
        }
      } else {
        setTasks(originalTasks);
        await saveSnapshot(userId, 'tasks', originalTasks);
        addNotification('خطا در تغییر وضعیت کار.', 'error');
      }
    }
  }, [tasks, userId, addNotification, maybeSpawnNextRecurrence, completeRecurringViaServer]);

  // Notes CRUD - Optimistic UI & Offline Queue support
  const addNote = useCallback(async (note: Omit<Note, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Note> => {
    const originalNotes = [...notes];
    const tempId = newId();
    const tempNote: Note = {
      ...note,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: user?.id || ''
    };

    const nextNotes = [tempNote, ...notes];
    setNotes(nextNotes);
    await saveSnapshot(userId, 'notes', nextNotes);

    if (!navigator.onLine) {
      await enqueue({ id: tempId, entity: 'notes', action: 'insert', payload: note });
      addNotification("یادداشت به صورت آفلاین ذخیره شد.", "info");
      return tempNote;
    }

    try {
      const newNote = await noteService.createNote(note, tempId);
      setNotes(prev => prev.map(n => n.id === tempId ? newNote : n));
      const finalNotes = nextNotes.map(n => n.id === tempId ? newNote : n);
      await saveSnapshot(userId, 'notes', finalNotes);
      addNotification("یادداشت با موفقیت اضافه شد.");
      return newNote;
    } catch (error) {
      const msg = (error as any)?.message || '';
      const isRetry = isBrowserOffline() || msg.includes('Failed to fetch') || error instanceof TypeError;
      if (isRetry) {
        await enqueue({ id: tempId, entity: 'notes', action: 'insert', payload: note });
        addNotification("یادداشت به صورت آفلاین ذخیره شد.", "info");
        return tempNote;
      } else {
        setNotes(originalNotes);
        await saveSnapshot(userId, 'notes', originalNotes);
        addNotification("خطا در افزودن یادداشت.", "error");
        throw error;
      }
    }
  }, [notes, user, userId, addNotification]);

  const updateNote = useCallback(async (note: Note | Partial<Note>) => {
    if (!note.id) return;
    const originalNotes = [...notes];
    const nextNotes = notes.map(n => n.id === note.id ? { ...n, ...note } as Note : n);
    setNotes(nextNotes);
    await saveSnapshot(userId, 'notes', nextNotes);

    if (!navigator.onLine) {
      await enqueue({ id: note.id, entity: 'notes', action: 'update', payload: note });
      addNotification("تغییرات یادداشت به صورت آفلاین ذخیره شد.", "info");
      return;
    }

    try {
      const updatedNote = await noteService.updateNote(note.id, note);
      setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
      const finalNotes = nextNotes.map(n => n.id === updatedNote.id ? updatedNote : n);
      await saveSnapshot(userId, 'notes', finalNotes);
      addNotification("یادداشت به‌روزرسانی شد.");
    } catch (error) {
      const msg = (error as any)?.message || '';
      const isRetry = isBrowserOffline() || msg.includes('Failed to fetch') || error instanceof TypeError;
      if (isRetry) {
        await enqueue({ id: note.id, entity: 'notes', action: 'update', payload: note });
        addNotification("تغییرات یادداشت به صورت آفلاین ذخیره شد.", "info");
      } else {
        setNotes(originalNotes);
        await saveSnapshot(userId, 'notes', originalNotes);
        addNotification("خطا در به‌روزرسانی یادداشت.", "error");
      }
    }
  }, [notes, userId, addNotification]);

  const deleteNote = useCallback(async (id: string) => {
    const noteToDelete = notes.find(n => n.id === id);
    if (!noteToDelete) return;

    const originalNotes = [...notes];
    const nextNotes = notes.filter(n => n.id !== id);
    setNotes(nextNotes);
    await saveSnapshot(userId, 'notes', nextNotes);

    const commitDelete = async () => {
      if (!navigator.onLine) {
        await enqueue({ id, entity: 'notes', action: 'delete', payload: null });
        return;
      }
      try {
        await noteService.deleteNote(id);
      } catch (error) {
        setNotes(originalNotes);
        await saveSnapshot(userId, 'notes', originalNotes);
        addNotification('خطا در حذف یادداشت.', 'error');
      }
    };

    const timeoutId = setTimeout(commitDelete, 3000);

    addNotification(
      `یادداشت «${noteToDelete.title.substring(0, 20)}» حذف شد.`,
      'info',
      {
        label: 'لغو',
        onClick: async () => {
          clearTimeout(timeoutId);
          setNotes(originalNotes);
          await saveSnapshot(userId, 'notes', originalNotes);
        }
      }
    );
  }, [notes, userId, addNotification]);

  // Habits CRUD - Optimistic UI & Offline Queue support
  const addHabit = useCallback(async (habit: Omit<Habit, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'completedDates'>) => {
    const originalHabits = [...habits];
    const tempId = newId();
    const tempHabit: Habit = {
      ...habit,
      id: tempId,
      completedDates: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: user?.id || ''
    };

    const nextHabits = [tempHabit, ...habits];
    setHabits(nextHabits);
    await saveSnapshot(userId, 'habits', nextHabits);

    if (!navigator.onLine) {
      await enqueue({ id: tempId, entity: 'habits', action: 'insert', payload: habit });
      addNotification("عادت جدید به صورت آفلاین ذخیره شد.", "info");
      return;
    }

    try {
      const newHabit = await habitService.createHabit(habit, tempId);
      setHabits(prev => prev.map(h => h.id === tempId ? newHabit : h));
      const finalHabits = nextHabits.map(h => h.id === tempId ? newHabit : h);
      await saveSnapshot(userId, 'habits', finalHabits);
      addNotification("عادت با موفقیت ساخته شد.");
    } catch (error) {
      const msg = (error as any)?.message || '';
      const isRetry = isBrowserOffline() || msg.includes('Failed to fetch') || error instanceof TypeError;
      if (isRetry) {
        await enqueue({ id: tempId, entity: 'habits', action: 'insert', payload: habit });
        addNotification("عادت جدید به صورت آفلاین ذخیره شد.", "info");
      } else {
        setHabits(originalHabits);
        await saveSnapshot(userId, 'habits', originalHabits);
        addNotification("خطا در ساخت عادت.", "error");
      }
    }
  }, [habits, user, userId, addNotification]);

  const updateHabit = useCallback(async (habit: Habit | Partial<Habit>) => {
    if (!habit.id) return;
    const originalHabits = [...habits];
    const nextHabits = habits.map(h => h.id === habit.id ? { ...h, ...habit } as Habit : h);
    setHabits(nextHabits);
    await saveSnapshot(userId, 'habits', nextHabits);

    if (!navigator.onLine) {
      await enqueue({ id: habit.id, entity: 'habits', action: 'update', payload: habit });
      addNotification("تغییرات عادت به صورت آفلاین ذخیره شد.", "info");
      return;
    }

    try {
      const updatedHabit = await habitService.updateHabit(habit.id, habit);
      setHabits(prev => prev.map(h => h.id === updatedHabit.id ? { ...updatedHabit, completedDates: h.completedDates } : h));
      const finalHabits = nextHabits.map(h => h.id === updatedHabit.id ? { ...updatedHabit, completedDates: h.completedDates } : h);
      await saveSnapshot(userId, 'habits', finalHabits);
      addNotification("عادت به‌روزرسانی شد.");
    } catch (error) {
      const msg = (error as any)?.message || '';
      const isRetry = isBrowserOffline() || msg.includes('Failed to fetch') || error instanceof TypeError;
      if (isRetry) {
        await enqueue({ id: habit.id, entity: 'habits', action: 'update', payload: habit });
        addNotification("تغییرات عادت به صورت آفلاین ذخیره شد.", "info");
      } else {
        setHabits(originalHabits);
        await saveSnapshot(userId, 'habits', originalHabits);
        addNotification("خطا در به‌روزرسانی عادت.", "error");
      }
    }
  }, [habits, userId, addNotification]);

  const deleteHabit = useCallback(async (id: string) => {
    const habitToDelete = habits.find(h => h.id === id);
    if (!habitToDelete) return;

    const originalHabits = [...habits];
    const nextHabits = habits.filter(h => h.id !== id);
    setHabits(nextHabits);
    await saveSnapshot(userId, 'habits', nextHabits);

    const commitDelete = async () => {
      if (!navigator.onLine) {
        await enqueue({ id, entity: 'habits', action: 'delete', payload: null });
        return;
      }
      try {
        await habitService.deleteHabit(id);
      } catch (error) {
        setHabits(originalHabits);
        await saveSnapshot(userId, 'habits', originalHabits);
        addNotification('خطا در حذف عادت.', 'error');
      }
    };

    const timeoutId = setTimeout(commitDelete, 3000);

    addNotification(
      `عادت «${habitToDelete.name.substring(0, 20)}» حذف شد.`,
      'info',
      {
        label: 'لغو',
        onClick: async () => {
          clearTimeout(timeoutId);
          setHabits(originalHabits);
          await saveSnapshot(userId, 'habits', originalHabits);
        }
      }
    );
  }, [habits, userId, addNotification]);

  const toggleHabitCompletion = useCallback(async (habitId: string, date: string) => {
    const originalHabits = [...habits];

    const nextHabits = habits.map(h => {
      if (h.id === habitId) {
        const completed = h.completedDates.includes(date);
        const newCompletedDates = completed
          ? h.completedDates.filter(d => d !== date)
          : [...h.completedDates, date];
        return { ...h, completedDates: newCompletedDates };
      }
      return h;
    });
    setHabits(nextHabits);
    await saveSnapshot(userId, 'habits', nextHabits);

    const habit = habits.find(h => h.id === habitId);
    const alreadyCompleted = habit ? habit.completedDates.includes(date) : false;
    const desired = !alreadyCompleted;

    if (!navigator.onLine) {
      await enqueue({
        id: `set-${habitId}-${date}`,
        entity: 'habits',
        action: 'set_completion',
        payload: { habitId, date, completed: desired }
      });
      return;
    }

    try {
      await habitService.setHabitCompletion(habitId, date, desired);
    } catch (error) {
      const msg = (error as any)?.message || '';
      const isRetry = isBrowserOffline() || msg.includes('Failed to fetch') || error instanceof TypeError;
      if (isRetry) {
        await enqueue({
          id: `set-${habitId}-${date}`,
          entity: 'habits',
          action: 'set_completion',
          payload: { habitId, date, completed: desired }
        });
      } else {
        setHabits(originalHabits);
        await saveSnapshot(userId, 'habits', originalHabits);
        addNotification("خطا در ثبت وضعیت عادت.", "error");
      }
    }
  }, [habits, userId, addNotification]);

  // AI / Media Proposal injection handler
  const injectAIProposalResult = useCallback((result: ActionResult) => {
    const { type, operation, data } = result;

    // Computes the next list from the current one, persists it like every other CRUD
    // path so AI-created entities survive a refresh (QA ISSUE_04-B), and returns it.
    const applyUpdate = <T extends { id: string }>(
      current: T[],
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      store: 'tasks' | 'notes' | 'projects' | 'habits'
    ): T[] => {
      let next: T[];
      if (operation === 'undo' && result.undoKind === 'delete_created') {
        next = current.filter(i => i.id !== data.id);
      } else if (operation === 'create') {
        next = [data, ...current.filter(i => i.id !== data.id)];
      } else {
        // update/restore: replace if present; upsert if missing (stale/paginated cache)
        const idx = current.findIndex(i => i.id === data.id);
        if (idx === -1) {
          next = [data, ...current];
        } else {
          next = current.slice();
          next[idx] = data;
        }
      }
      void saveSnapshot(userId, store, next);
      setter(next);
      return next;
    };

    if (type === 'task') {
      if (result.compound?.kind === 'recurring_completion') {
        const removeIds = new Set(Array.isArray(result.compound.removeIds) ? result.compound.removeIds : []);
        const upsertList = Array.isArray(result.compound.upsert) ? result.compound.upsert : [];
        const replacements = new Map(upsertList.map(task => [task.id, task]));
        const next = tasksRef.current
          .filter(task => !removeIds.has(task.id))
          .map(task => replacements.get(task.id) ?? task);
        for (const task of replacements.values()) {
          if (!next.some(existing => existing.id === task.id)) next.push(task);
        }
        void saveSnapshot(userId, 'tasks', next);
        setTasks(next);
        return;
      }

      // B3: only spawn on real transition non-done → done (never re-inject of already-done)
      const prevTask = tasksRef.current.find(t => t.id === data?.id);
      const shouldSpawn =
        operation === 'update' &&
        data?.status === 'done' &&
        !!prevTask &&
        prevTask.status !== 'done';

      applyUpdate(tasksRef.current, setTasks, 'tasks');

      if (shouldSpawn) {
        void maybeSpawnNextRecurrence({
          ...prevTask!,
          ...data,
          status: 'done',
        } as Task);
      }
    } else if (type === 'note') applyUpdate(notesRef.current, setNotes, 'notes');
    else if (type === 'project') applyUpdate(projectsRef.current, setProjects, 'projects');
    else if (type === 'habit') {
      const habitData = operation === 'create' ? { ...data, completedDates: [] } : data;
      const current = habitsRef.current;
      let next: Habit[];
      if (operation === 'create') {
        next = [habitData, ...current.filter(h => h.id !== habitData.id)];
      } else {
        const idx = current.findIndex(h => h.id === habitData.id);
        next = idx === -1
          ? [habitData, ...current]
          : (() => { const copy = current.slice(); copy[idx] = habitData; return copy; })();
      }
      void saveSnapshot(userId, 'habits', next);
      setHabits(next);
    }
  }, [maybeSpawnNextRecurrence, userId]);

  const { isSyncing, pendingCount, flushOutbox } = useOfflineSync(userId, addNotification, loadInitial);

  return {
    currentPage,
    setCurrentPage,
    selectedDate,
    setSelectedDate,
    chatMessages,
    setChatMessages,
    notifications,
    addNotification,
    removeNotification,
    tasks,
    setTasks,
    notes,
    setNotes,
    projects,
    setProjects,
    habits,
    setHabits,
    entityLinks,
    setEntityLinks,
    loadingData,
    setLoadingData,
    tasksLimit,
    notesLimit,
    loadMoreTasks,
    loadMoreNotes,
    profile,
    setProfile,
    subscription,
    setSubscription,
    showPaywall,
    setShowPaywall,
    paywallMessage,
    setPaywallMessage,
    isOnboarding,
    setIsOnboarding,
    loadInitial,
    editingHabit,
    setEditingHabit,
    editHabit: setEditingHabit,
    onTriggerUpgrade,
    isSyncing,
    pendingCount,
    flushOutbox,
    // Operations
    addProject,
    updateProject,
    deleteProject,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskCompletion,
    skipRecurrenceOccurrence,
    runRecurrenceScope,
    addNote,
    updateNote,
    deleteNote,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleHabitCompletion,
    injectAIProposalResult
  };
};
