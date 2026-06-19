import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Page, Task, Note, ChatMessage, Habit, Project, ActionResult, EntityLink } from '../types';
import * as projectService from '../services/projectService';
import * as taskService from '../services/taskService';
import * as noteService from '../services/noteService';
import * as habitService from '../services/habitService';
import * as billingService from '../services/billingService';
import { loadSnapshot, saveSnapshot } from '../services/offline/snapshot';
import { enqueue } from '../services/offline/outbox';
import { useOfflineSync } from './useOfflineSync';
import { newId } from '../utils/uuid';

export interface AppNotification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
  action?: {
    label: string;
    onClick: () => void;
  };
}

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
      const isRetry = navigator.onLine === false || msg.includes('Failed to fetch') || error instanceof TypeError;
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
      const isRetry = navigator.onLine === false || msg.includes('Failed to fetch') || error instanceof TypeError;
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
    const originalProjects = [...projects];
    const nextProjects = projects.filter(p => p.id !== id);
    setProjects(nextProjects);
    await saveSnapshot(userId, 'projects', nextProjects);

    if (!navigator.onLine) {
      await enqueue({ id, entity: 'projects', action: 'delete', payload: null });
      addNotification("حذف پروژه به صورت آفلاین ثبت شد.", "info");
      return;
    }

    try {
      await projectService.deleteProject(id);
      addNotification("پروژه حذف شد.");
    } catch (error) {
      const msg = (error as any)?.message || '';
      const isRetry = navigator.onLine === false || msg.includes('Failed to fetch') || error instanceof TypeError;
      if (isRetry) {
        await enqueue({ id, entity: 'projects', action: 'delete', payload: null });
        addNotification("حذف پروژه به صورت آفلاین ثبت شد.", "info");
      } else {
        setProjects(originalProjects);
        await saveSnapshot(userId, 'projects', originalProjects);
        addNotification("خطا در حذف پروژه.", "error");
      }
    }
  }, [projects, userId, addNotification]);

  // Tasks CRUD - Optimistic UI & Atomic checks & Offline Queue support
  const addTask = useCallback(async (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'completed_at'>): Promise<Task> => {
    const originalTasks = [...tasks];
    const tempId = newId();
    const tempTask: Task = {
      ...task,
      id: tempId,
      status: 'todo',
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: user?.id || ''
    };

    const nextTasks = [tempTask, ...tasks];
    setTasks(nextTasks);
    await saveSnapshot(userId, 'tasks', nextTasks);

    if (!navigator.onLine) {
      await enqueue({ id: tempId, entity: 'tasks', action: 'insert', payload: task });
      addNotification("کار جدید به صورت آفلاین ذخیره شد.", "info");
      return tempTask;
    }

    try {
      const newTask = await taskService.createTask(task, tempId);
      setTasks(prev => prev.map(t => t.id === tempId ? newTask : t));
      const finalTasks = nextTasks.map(t => t.id === tempId ? newTask : t);
      await saveSnapshot(userId, 'tasks', finalTasks);
      addNotification("کار با موفقیت اضافه شد.");
      return newTask;
    } catch (error) {
      const msg = (error as any)?.message || '';
      const isRetry = navigator.onLine === false || msg.includes('Failed to fetch') || error instanceof TypeError;
      if (isRetry) {
        await enqueue({ id: tempId, entity: 'tasks', action: 'insert', payload: task });
        addNotification("کار جدید به صورت آفلاین ثبت شد.", "info");
        return tempTask;
      } else {
        setTasks(originalTasks);
        await saveSnapshot(userId, 'tasks', originalTasks);
        addNotification("خطا در افزودن کار.", "error");
        throw error;
      }
    }
  }, [tasks, user, userId, addNotification]);

  const updateTask = useCallback(async (task: Task | Partial<Task>) => {
    if (!task.id) return;
    const originalTasks = [...tasks];
    const nextTasks = tasks.map(t => t.id === task.id ? { ...t, ...task } as Task : t);
    setTasks(nextTasks);
    await saveSnapshot(userId, 'tasks', nextTasks);

    if (!navigator.onLine) {
      await enqueue({ id: task.id, entity: 'tasks', action: 'update', payload: task });
      addNotification("تغییرات کار به صورت آفلاین ثبت شد.", "info");
      return;
    }

    try {
      const updatedTask = await taskService.updateTask(task.id, task);
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      const finalTasks = nextTasks.map(t => t.id === updatedTask.id ? updatedTask : t);
      await saveSnapshot(userId, 'tasks', finalTasks);
      addNotification("کار به‌روزرسانی شد.");
    } catch (error) {
      const msg = (error as any)?.message || '';
      const isRetry = navigator.onLine === false || msg.includes('Failed to fetch') || error instanceof TypeError;
      if (isRetry) {
        await enqueue({ id: task.id, entity: 'tasks', action: 'update', payload: task });
        addNotification("تغییرات کار به صورت آفلاین ثبت شد.", "info");
      } else {
        setTasks(originalTasks);
        await saveSnapshot(userId, 'tasks', originalTasks);
        addNotification("خطا در به‌روزرسانی کار.", "error");
      }
    }
  }, [tasks, userId, addNotification]);

  const deleteTask = useCallback(async (id: string) => {
    const originalTasks = [...tasks];
    const nextTasks = tasks.filter(t => t.id !== id);
    setTasks(nextTasks);
    await saveSnapshot(userId, 'tasks', nextTasks);

    if (!navigator.onLine) {
      await enqueue({ id, entity: 'tasks', action: 'delete', payload: null });
      addNotification("حذف کار به صورت آفلاین ثبت شد.", "info");
      return;
    }

    try {
      await taskService.deleteTask(id);
      addNotification("کار حذف شد.");
    } catch (error) {
      const msg = (error as any)?.message || '';
      const isRetry = navigator.onLine === false || msg.includes('Failed to fetch') || error instanceof TypeError;
      if (isRetry) {
        await enqueue({ id, entity: 'tasks', action: 'delete', payload: null });
        addNotification("حذف کار به صورت آفلاین ثبت شد.", "info");
      } else {
        setTasks(originalTasks);
        await saveSnapshot(userId, 'tasks', originalTasks);
        addNotification("خطا در حذف کار.", "error");
      }
    }
  }, [tasks, userId, addNotification]);

  const toggleTaskCompletion = useCallback(async (id: string) => {
    const originalTasks = [...tasks];
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newStatus = task.status === 'done' ? 'todo' : 'done';
    const completed_at = newStatus === 'done' ? new Date().toISOString() : null;

    const nextTasks = tasks.map(t => t.id === id ? { ...t, status: newStatus, completed_at } : t);
    setTasks(nextTasks);
    await saveSnapshot(userId, 'tasks', nextTasks);

    const payload = { status: newStatus, completed_at };

    if (!navigator.onLine) {
      await enqueue({ id, entity: 'tasks', action: 'update', payload });
      return;
    }

    try {
      const updatedTask = await taskService.updateTask(id, payload);
      setTasks(prev => prev.map(t => t.id === id ? updatedTask : t));
      const finalTasks = nextTasks.map(t => t.id === id ? updatedTask : t);
      await saveSnapshot(userId, 'tasks', finalTasks);
    } catch (error) {
      const msg = (error as any)?.message || '';
      const isRetry = navigator.onLine === false || msg.includes('Failed to fetch') || error instanceof TypeError;
      if (isRetry) {
        await enqueue({ id, entity: 'tasks', action: 'update', payload });
      } else {
        setTasks(originalTasks);
        await saveSnapshot(userId, 'tasks', originalTasks);
        addNotification("خطا در تغییر وضعیت کار.", "error");
      }
    }
  }, [tasks, userId, addNotification]);

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
      const isRetry = navigator.onLine === false || msg.includes('Failed to fetch') || error instanceof TypeError;
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
      const isRetry = navigator.onLine === false || msg.includes('Failed to fetch') || error instanceof TypeError;
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
    const originalNotes = [...notes];
    const nextNotes = notes.filter(n => n.id !== id);
    setNotes(nextNotes);
    await saveSnapshot(userId, 'notes', nextNotes);

    if (!navigator.onLine) {
      await enqueue({ id, entity: 'notes', action: 'delete', payload: null });
      addNotification("حذف یادداشت به صورت آفلاین ثبت شد.", "info");
      return;
    }

    try {
      await noteService.deleteNote(id);
      addNotification("یادداشت حذف شد.");
    } catch (error) {
      const msg = (error as any)?.message || '';
      const isRetry = navigator.onLine === false || msg.includes('Failed to fetch') || error instanceof TypeError;
      if (isRetry) {
        await enqueue({ id, entity: 'notes', action: 'delete', payload: null });
        addNotification("حذف یادداشت به صورت آفلاین ثبت شد.", "info");
      } else {
        setNotes(originalNotes);
        await saveSnapshot(userId, 'notes', originalNotes);
        addNotification("خطا در حذف یادداشت.", "error");
      }
    }
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
      const isRetry = navigator.onLine === false || msg.includes('Failed to fetch') || error instanceof TypeError;
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
      const isRetry = navigator.onLine === false || msg.includes('Failed to fetch') || error instanceof TypeError;
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
    const originalHabits = [...habits];
    const nextHabits = habits.filter(h => h.id !== id);
    setHabits(nextHabits);
    await saveSnapshot(userId, 'habits', nextHabits);

    if (!navigator.onLine) {
      await enqueue({ id, entity: 'habits', action: 'delete', payload: null });
      addNotification("حذف عادت به صورت آفلاین ثبت شد.", "info");
      return;
    }

    try {
      await habitService.deleteHabit(id);
      addNotification("عادت حذف شد.");
    } catch (error) {
      const msg = (error as any)?.message || '';
      const isRetry = navigator.onLine === false || msg.includes('Failed to fetch') || error instanceof TypeError;
      if (isRetry) {
        await enqueue({ id, entity: 'habits', action: 'delete', payload: null });
        addNotification("حذف عادت به صورت آفلاین ثبت شد.", "info");
      } else {
        setHabits(originalHabits);
        await saveSnapshot(userId, 'habits', originalHabits);
        addNotification("خطا در حذف عادت.", "error");
      }
    }
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
      const isRetry = navigator.onLine === false || msg.includes('Failed to fetch') || error instanceof TypeError;
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

    const updateState = <T extends { id: string }>(
      setter: React.Dispatch<React.SetStateAction<T[]>>
    ) => {
      setter(prev => {
        if (operation === 'create') {
          return [data, ...prev.filter(i => i.id !== data.id)];
        } else {
          return prev.map(i => i.id === data.id ? data : i);
        }
      });
    };

    if (type === 'task') updateState(setTasks);
    else if (type === 'note') updateState(setNotes);
    else if (type === 'project') updateState(setProjects);
    else if (type === 'habit') {
      const habitData = operation === 'create' ? { ...data, completedDates: [] } : data;
      setHabits(prev => {
        if (operation === 'create') return [habitData, ...prev.filter(h => h.id !== habitData.id)];
        return prev.map(h => h.id === habitData.id ? habitData : h);
      });
    }
  }, []);

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
