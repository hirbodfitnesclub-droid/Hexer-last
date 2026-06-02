import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../services/supabaseClient';
import { Page, Task, Note, ChatMessage, Habit, Project, ActionResult } from '../types';
import * as projectService from '../services/projectService';
import * as taskService from '../services/taskService';
import * as noteService from '../services/noteService';
import * as habitService from '../services/habitService';
import * as billingService from '../services/billingService';
import { requestNotificationPermission } from '../services/reminderService';

export interface AppNotification {
  id: number;
  message: string;
  type: 'success' | 'error';
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
    type: 'success' | 'error' = 'success',
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
    try {
      const [projectsData, tasksData, notesData, habitsData, profileResult, subData] = await Promise.all([
        projectService.getProjects(),
        taskService.getTasks(),
        noteService.getNotes(),
        habitService.getHabits(),
        supabase.from('profiles').select('*').maybeSingle(),
        billingService.getSubscription()
      ]);
      setProjects(projectsData);
      setTasks(tasksData);
      setNotes(notesData);
      setHabits(habitsData);
      setSubscription(subData);
      
      if (profileResult.data) {
        setProfile(profileResult.data);
        if (profileResult.data.onboarding_completed === false) {
          setIsOnboarding(true);
        }
      }
      
      // Get notification permissions
      requestNotificationPermission();
    } catch (error) {
      console.error("Error loading index data:", error);
      addNotification("خطا در بارگذاری اطلاعات اولیه یا وضعیت اشتراک شما.", "error");
    } finally {
      setLoadingData(false);
    }
  }, [userId, addNotification]);

  // Projects CRUD - Optimistic UI
  const addProject = useCallback(async (project: Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const originalProjects = [...projects];
    const tempId = 'temp-' + Date.now();
    const tempProj: Project = {
      ...project,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: user?.id || ''
    };

    setProjects(prev => [tempProj, ...prev]);

    try {
      const newProj = await projectService.createProject(project);
      setProjects(prev => prev.map(p => p.id === tempId ? newProj : p));
      addNotification("پروژه با موفقیت ساخته شد.");
    } catch (error) {
      setProjects(originalProjects);
      addNotification("خطا در ساخت پروژه.", "error");
    }
  }, [projects, user, addNotification]);

  const updateProject = useCallback(async (project: Project) => {
    const originalProjects = [...projects];
    setProjects(prev => prev.map(p => p.id === project.id ? project : p));

    try {
      const updatedProj = await projectService.updateProject(project.id, project);
      setProjects(prev => prev.map(p => p.id === project.id ? updatedProj : p));
      addNotification("پروژه به‌روزرسانی شد.");
    } catch (error) {
      setProjects(originalProjects);
      addNotification("خطا در به‌روزرسانی پروژه.", "error");
    }
  }, [projects, addNotification]);

  const deleteProject = useCallback(async (id: string) => {
    const originalProjects = [...projects];
    setProjects(prev => prev.filter(p => p.id !== id));

    try {
      await projectService.deleteProject(id);
      addNotification("پروژه حذف شد.");
    } catch (error) {
      setProjects(originalProjects);
      addNotification("خطا در حذف پروژه.", "error");
    }
  }, [projects, addNotification]);

  // Tasks CRUD - Optimistic UI & Atomic checks
  const addTask = useCallback(async (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'completed_at'>) => {
    const originalTasks = [...tasks];
    const tempId = 'temp-' + Date.now();
    const tempTask: Task = {
      ...task,
      id: tempId,
      status: 'todo',
      completed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: user?.id || ''
    };

    setTasks(prev => [tempTask, ...prev]);

    try {
      const newTask = await taskService.createTask(task);
      setTasks(prev => prev.map(t => t.id === tempId ? newTask : t));
      addNotification("کار با موفقیت اضافه شد.");
    } catch (error) {
      setTasks(originalTasks);
      addNotification("خطا در افزودن کار.", "error");
    }
  }, [tasks, user, addNotification]);

  const updateTask = useCallback(async (task: Task | Partial<Task>) => {
    if (!task.id) return;
    const originalTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...task } as Task : t));

    try {
      const updatedTask = await taskService.updateTask(task.id, task);
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
      addNotification("کار به‌روزرسانی شد.");
    } catch (error) {
      setTasks(originalTasks);
      addNotification("خطا در به‌روزرسانی کار.", "error");
    }
  }, [tasks, addNotification]);

  const deleteTask = useCallback(async (id: string) => {
    const originalTasks = [...tasks];
    setTasks(prev => prev.filter(t => t.id !== id));

    try {
      await taskService.deleteTask(id);
      addNotification("کار حذف شد.");
    } catch (error) {
      setTasks(originalTasks);
      addNotification("خطا در حذف کار.", "error");
    }
  }, [tasks, addNotification]);

  const toggleTaskCompletion = useCallback(async (id: string) => {
    const originalTasks = [...tasks];
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const newStatus = task.status === 'done' ? 'todo' : 'done';
    const completed_at = newStatus === 'done' ? new Date().toISOString() : null;

    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus, completed_at } : t));

    try {
      const updatedTask = await taskService.updateTask(id, { status: newStatus, completed_at });
      setTasks(prev => prev.map(t => t.id === id ? updatedTask : t));
    } catch (error) {
      setTasks(originalTasks);
      addNotification("خطا در تغییر وضعیت کار.", "error");
    }
  }, [tasks, addNotification]);

  // Notes CRUD - Optimistic UI
  const addNote = useCallback(async (note: Omit<Note, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const originalNotes = [...notes];
    const tempId = 'temp-' + Date.now();
    const tempNote: Note = {
      ...note,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: user?.id || ''
    };

    setNotes(prev => [tempNote, ...prev]);

    try {
      const newNote = await noteService.createNote(note);
      setNotes(prev => prev.map(n => n.id === tempId ? newNote : n));
      addNotification("یادداشت با موفقیت اضافه شد.");
    } catch (error) {
      setNotes(originalNotes);
      addNotification("خطا در افزودن یادداشت.", "error");
    }
  }, [notes, user, addNotification]);

  const updateNote = useCallback(async (note: Note | Partial<Note>) => {
    if (!note.id) return;
    const originalNotes = [...notes];
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, ...note } as Note : n));

    try {
      const updatedNote = await noteService.updateNote(note.id, note);
      setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
      addNotification("یادداشت به‌روزرسانی شد.");
    } catch (error) {
      setNotes(originalNotes);
      addNotification("خطا در به‌روزرسانی یادداشت.", "error");
    }
  }, [notes, addNotification]);

  const deleteNote = useCallback(async (id: string) => {
    const originalNotes = [...notes];
    setNotes(prev => prev.filter(n => n.id !== id));

    try {
      await noteService.deleteNote(id);
      addNotification("یادداشت حذف شد.");
    } catch (error) {
      setNotes(originalNotes);
      addNotification("خطا در حذف یادداشت.", "error");
    }
  }, [notes, addNotification]);

  // Habits CRUD - Optimistic UI
  const addHabit = useCallback(async (habit: Omit<Habit, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'completedDates'>) => {
    const originalHabits = [...habits];
    const tempId = 'temp-' + Date.now();
    const tempHabit: Habit = {
      ...habit,
      id: tempId,
      completedDates: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_id: user?.id || ''
    };

    setHabits(prev => [tempHabit, ...prev]);

    try {
      const newHabit = await habitService.createHabit(habit);
      setHabits(prev => prev.map(h => h.id === tempId ? newHabit : h));
      addNotification("عادت با موفقیت ساخته شد.");
    } catch (error) {
      setHabits(originalHabits);
      addNotification("خطا در ساخت عادت.", "error");
    }
  }, [habits, user, addNotification]);

  const updateHabit = useCallback(async (habit: Habit | Partial<Habit>) => {
    if (!habit.id) return;
    const originalHabits = [...habits];
    setHabits(prev => prev.map(h => h.id === habit.id ? { ...h, ...habit } as Habit : h));

    try {
      const updatedHabit = await habitService.updateHabit(habit.id, habit);
      setHabits(prev => prev.map(h => h.id === updatedHabit.id ? { ...updatedHabit, completedDates: h.completedDates } : h));
      addNotification("عادت به‌روزرسانی شد.");
    } catch (error) {
      setHabits(originalHabits);
      addNotification("خطا در به‌روزرسانی عادت.", "error");
    }
  }, [habits, addNotification]);

  const deleteHabit = useCallback(async (id: string) => {
    const originalHabits = [...habits];
    setHabits(prev => prev.filter(h => h.id !== id));

    try {
      await habitService.deleteHabit(id);
      addNotification("عادت حذف شد.");
    } catch (error) {
      setHabits(originalHabits);
      addNotification("خطا در حذف عادت.", "error");
    }
  }, [habits, addNotification]);

  const toggleHabitCompletion = useCallback(async (habitId: string, date: string) => {
    const originalHabits = [...habits];

    setHabits(prev => prev.map(h => {
      if (h.id === habitId) {
        const completed = h.completedDates.includes(date);
        const newCompletedDates = completed
          ? h.completedDates.filter(d => d !== date)
          : [...h.completedDates, date];
        return { ...h, completedDates: newCompletedDates };
      }
      return h;
    }));

    try {
      await habitService.toggleHabitCompletion(habitId, date);
    } catch (error) {
      setHabits(originalHabits);
      addNotification("خطا در ثبت وضعیت عادت.", "error");
    }
  }, [habits, addNotification]);

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
