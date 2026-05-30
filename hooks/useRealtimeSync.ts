import { useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Task, Note, Project, Habit } from '../types';
import * as habitService from '../services/habitService';
import { sendBrowserNotification } from '../services/reminderService';
import { AppNotification } from './useDataManager';

interface RealtimeSyncProps {
  user: any;
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  setNotes: React.Dispatch<React.SetStateAction<Note[]>>;
  setHabits: React.Dispatch<React.SetStateAction<Habit[]>>;
  addNotification: (message: string, type?: 'success' | 'error') => void;
}

export const useRealtimeSync = ({
  user,
  setProjects,
  setTasks,
  setNotes,
  setHabits,
  addNotification
}: RealtimeSyncProps) => {
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    const currentUser = userRef.current;
    if (!currentUser) return;

    // Helper functions following atomic merge and upsert logic
    const handleInserts = <T extends { id: string }>(
      payload: any,
      setter: React.Dispatch<React.SetStateAction<T[]>>
    ) => {
      setter(prev => {
        if (prev.find(item => item.id === payload.new.id)) return prev;
        return [payload.new as T, ...prev];
      });
    };

    const handleUpdates = <T extends { id: string; updated_at?: string }>(
      payload: any,
      setter: React.Dispatch<React.SetStateAction<T[]>>
    ) => {
      setter(prev =>
        prev.map(item => {
          if (item.id === payload.new.id) {
            const localUpdate = item.updated_at ? new Date(item.updated_at).getTime() : 0;
            const remoteUpdate = payload.new.updated_at ? new Date(payload.new.updated_at).getTime() : 0;
            
            // Upsert / Merge Logic: prevent rewriting newer local optimistic edits
            if (localUpdate > remoteUpdate) {
              return { ...payload.new, ...item } as T; // keep newer local changes if any
            }
            return payload.new as T;
          }
          return item;
        })
      );
    };

    const handleDeletes = <T extends { id: string }>(
      payload: any,
      setter: React.Dispatch<React.SetStateAction<T[]>>
    ) => {
      setter(prev => prev.filter(item => item.id !== payload.old.id));
    };

    // SECURE REALTIME: Register user_id filters to enforce RLS and check constraints.
    const projectChanges = supabase.channel(`projects-changes-${currentUser.id}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'projects',
      filter: `user_id=eq.${currentUser.id}`
    }, (payload) => {
      if (payload.eventType === 'INSERT') handleInserts(payload, setProjects);
      else if (payload.eventType === 'UPDATE') handleUpdates(payload, setProjects);
      else if (payload.eventType === 'DELETE') handleDeletes(payload, setProjects);
    }).subscribe();

    const taskChanges = supabase.channel(`tasks-changes-${currentUser.id}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'tasks',
      filter: `user_id=eq.${currentUser.id}`
    }, (payload) => {
      if (payload.eventType === 'INSERT') handleInserts(payload, setTasks);
      else if (payload.eventType === 'UPDATE') handleUpdates(payload, setTasks);
      else if (payload.eventType === 'DELETE') handleDeletes(payload, setTasks);
    }).subscribe();

    const noteChanges = supabase.channel(`notes-changes-${currentUser.id}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'notes',
      filter: `user_id=eq.${currentUser.id}`
    }, (payload) => {
      if (payload.eventType === 'INSERT') handleInserts(payload, setNotes);
      else if (payload.eventType === 'UPDATE') handleUpdates(payload, setNotes);
      else if (payload.eventType === 'DELETE') handleDeletes(payload, setNotes);
    }).subscribe();

    const habitChanges = supabase.channel(`habits-changes-${currentUser.id}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'habits',
      filter: `user_id=eq.${currentUser.id}`
    }, async () => {
      // Habit aggregates complex calculations, so we refresh the habits cleanly from DB
      try {
        const habitsData = await habitService.getHabits();
        setHabits(habitsData);
      } catch (err) {
        console.error("Failed to query habits via realtime:", err);
      }
    }).subscribe();

    const habitCompletionChanges = supabase.channel(`habit-completions-${currentUser.id}`).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'habit_completions',
      filter: `user_id=eq.${currentUser.id}`
    }, async () => {
      try {
        const habitsData = await habitService.getHabits();
        setHabits(habitsData);
      } catch (err) {
        console.error("Failed to query habits completion via realtime:", err);
      }
    }).subscribe();

    // System reminders listener for Web Notifications API
    const reminderChanges = supabase.channel(`reminders-changes-${currentUser.id}`).on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'reminders',
      filter: `user_id=eq.${currentUser.id}`
    }, (payload) => {
      const newReminder = payload.new;
      if (newReminder) {
        addNotification(`یادآوری: ${newReminder.title} - ${newReminder.body}`, "success");
        sendBrowserNotification(newReminder.title, newReminder.body);
      }
    }).subscribe();

    return () => {
      supabase.removeChannel(projectChanges);
      supabase.removeChannel(taskChanges);
      supabase.removeChannel(noteChanges);
      supabase.removeChannel(habitChanges);
      supabase.removeChannel(habitCompletionChanges);
      supabase.removeChannel(reminderChanges);
    };
  }, [user, setProjects, setTasks, setNotes, setHabits, addNotification]);
};
