
import React, { useState, useEffect, useCallback } from 'react';
import { Page, Task, Note, ChatMessage, Habit, Project, ActionResult } from './types';
import BottomNav from './components/BottomNav';
import Dashboard from './components/Dashboard';
import TasksView from './components/TasksView';
import NotesView from './components/NotesView';
import ChatView from './components/ChatView';
import ProjectsView from './components/ProjectsView';
import { XIcon, CheckIcon } from './components/icons';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthComponent from './components/Auth';
import { supabase } from './services/supabaseClient';

// Import data services
import * as projectService from './services/projectService';
import * as taskService from './services/taskService';
import * as noteService from './services/noteService';
import * as habitService from './services/habitService';
import TaskEditorModal from './components/TaskEditorModal';
import NoteEditorModal from './components/NoteEditorModal';
import HabitEditorModal from './components/HabitEditorModal';

// Import custom billing, onboarding, notifications, and network components
import * as billingService from './services/billingService';
import { requestNotificationPermission, sendBrowserNotification } from './services/reminderService';
import { PaywallModal } from './components/PaywallModal';
import { Onboarding } from './components/Onboarding';
import { NetworkBanner } from './components/NetworkBanner';


interface AppNotification {
  id: number;
  message: string;
  type: 'success' | 'error';
  action?: {
    label: string;
    onClick: () => void;
  };
}

const ToastNotifications: React.FC<{
  notifications: AppNotification[];
  onRemove: (id: number) => void;
}> = ({ notifications, onRemove }) => {
  return (
    <div className="fixed bottom-24 right-4 z-[100] w-full max-w-sm space-y-3">
      {notifications.map(n => (
        <div
          key={n.id}
          className={`flex items-center justify-between gap-4 p-4 rounded-xl shadow-2xl shadow-black/50 animate-fade-in-up border ${
            n.type === 'success' ? 'bg-green-600/20 border-green-500/30 text-green-200' : 'bg-red-600/20 border-red-500/30 text-red-200'
          } backdrop-blur-xl`}
        >
          <CheckIcon className="w-6 h-6 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">{n.message}</p>
            {n.action && (
              <button onClick={n.action.onClick} className="mt-1 text-xs font-bold underline opacity-80 hover:opacity-100">
                {n.action.label}
              </button>
            )}
          </div>
          <button onClick={() => onRemove(n.id)} className="p-1 opacity-60 hover:opacity-100">
            <XIcon className="w-5 h-5" />
          </button>
        </div>
      ))}
    </div>
  );
};


const MainApp: React.FC = () => {
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

  // Global Modals State
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editingProject, setEditingProject] = useState<Partial<Project> | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | Partial<Habit> | null>(null);

  // Subscriptions, billing, and onboarding states
  const [profile, setProfile] = useState<any>(null);
  const [subscription, setSubscription] = useState<any>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallMessage, setPaywallMessage] = useState('');
  const [isOnboarding, setIsOnboarding] = useState(false);

  const { user } = useAuth();

  const addNotification = useCallback((message: string, type: 'success' | 'error' = 'success', action?: AppNotification['action']) => {
    const id = Date.now();
    setNotifications(prev => [...prev.filter(n => n.message !== message), { id, message, type, action }]);
    setTimeout(() => {
      removeNotification(id);
    }, 5000);
  }, []);

  const removeNotification = (id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };
  
  // --- Payment Redirect and Verification Handler ---
  useEffect(() => {
    if (!user) return;

    const queryParams = new URLSearchParams(window.location.search);
    const trackId = queryParams.get('trackId') || queryParams.get('track_id');

    if (trackId) {
      // Clear URL parameters immediately to prevent refetch loop
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);

      const verify = async () => {
        addNotification("در حال تایید پرداخت شما از درگاه زیبال...", "success");
        try {
          await billingService.verifyPayment(trackId);
          addNotification("پرداخت شما با موفقیت تأیید شد! اشتراک شما هم‌اکنون فعال گردید.", "success");
          
          // Refresh user subscription status
          const subData = await billingService.getSubscription();
          setSubscription(subData);
        } catch (err: any) {
          console.error("Payment verification failed:", err);
          addNotification(err.message || "خطا در تایید تراکنش بانکی. در صورت کسر وجه، مبلغ طی ۷۲ ساعت آینده مسترد خواهد شد.", "error");
        }
      };
      verify();
    }
  }, [user, addNotification]);

  // --- Data Fetching and Real-time Subscriptions ---
  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoadingData(true);
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
        
        // Request Web Notifications API permissions
        requestNotificationPermission();
      } catch (error) {
        console.error("Error fetching initial data:", error);
        addNotification("خطا در بارگذاری اطلاعات اولیه یا وضعیت اشتراک شما.", "error");
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();

    // --- Realtime Subscriptions ---
    const handleInserts = <T extends {id: string}>(payload: any, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
        setter(prev => {
            if (prev.find(item => item.id === payload.new.id)) return prev;
            return [payload.new as T, ...prev];
        });
    };
    const handleUpdates = <T extends {id: string}>(payload: any, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
        setter(prev => prev.map(item => item.id === payload.new.id ? payload.new as T : item));
    };
    const handleDeletes = <T extends {id: string}>(payload: any, setter: React.Dispatch<React.SetStateAction<T[]>>) => {
        setter(prev => prev.filter(item => item.id !== payload.old.id));
    };
    
    // SECURE REALTIME: Use UID filters to prevent cross-user data leakage and ensure RLS performance.
    const projectChanges = supabase.channel('projects-changes').on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'projects',
        filter: `user_id=eq.${user.id}`
    }, (payload) => {
        if (payload.eventType === 'INSERT') handleInserts(payload, setProjects);
        else if (payload.eventType === 'UPDATE') handleUpdates(payload, setProjects);
        else if (payload.eventType === 'DELETE') handleDeletes(payload, setProjects);
    }).subscribe();
        
    const taskChanges = supabase.channel('tasks-changes').on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tasks',
        filter: `user_id=eq.${user.id}`
    }, (payload) => {
        if (payload.eventType === 'INSERT') handleInserts(payload, setTasks);
        else if (payload.eventType === 'UPDATE') handleUpdates(payload, setTasks);
        else if (payload.eventType === 'DELETE') handleDeletes(payload, setTasks);
    }).subscribe();
        
    const noteChanges = supabase.channel('notes-changes').on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notes',
        filter: `user_id=eq.${user.id}`
    }, (payload) => {
        if (payload.eventType === 'INSERT') handleInserts(payload, setNotes);
        else if (payload.eventType === 'UPDATE') handleUpdates(payload, setNotes);
        else if (payload.eventType === 'DELETE') handleDeletes(payload, setNotes);
    }).subscribe();

    const habitChanges = supabase.channel('habits-changes').on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'habits',
        filter: `user_id=eq.${user.id}`
    }, async () => {
        const habitsData = await habitService.getHabits();
        setHabits(habitsData);
    }).subscribe();
        
    const habitCompletionChanges = supabase.channel('habit-completions-changes').on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'habit_completions',
        filter: `user_id=eq.${user.id}`
    }, async () => {
        const habitsData = await habitService.getHabits();
        setHabits(habitsData);
    }).subscribe();

    // System reminders listener for Web Notifications API
    const reminderChanges = supabase.channel('reminders-changes').on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'reminders',
        filter: `user_id=eq.${user.id}`
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

  }, [user, addNotification]);

  // --- CRUD Handlers ---

  // Projects
  const handleAddProject = async (project: Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      try {
          const newProject = await projectService.createProject(project);
          // Check for existing ID to avoid race condition with Realtime subscription
          setProjects(prev => {
              if (prev.some(p => p.id === newProject.id)) return prev;
              return [newProject, ...prev];
          });
          addNotification("پروژه با موفقیت ساخته شد.");
      } catch (error) { addNotification("خطا در ساخت پروژه.", "error"); }
  };
  const handleUpdateProject = async (project: Project) => {
      try {
          const updatedProject = await projectService.updateProject(project.id, project);
          setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
          addNotification("پروژه به‌روزرسانی شد.");
      } catch (error) { addNotification("خطا در به‌روزرسانی پروژه.", "error"); }
  };
  const handleDeleteProject = async (id: string) => {
      try {
          await projectService.deleteProject(id);
          setProjects(prev => prev.filter(p => p.id !== id));
          addNotification("پروژه حذف شد.");
      } catch (error) { addNotification("خطا در حذف پروژه.", "error"); }
  };

  // Tasks
  const handleAddTask = async (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'completed_at'>) => {
      try {
          const newTask = await taskService.createTask(task);
          // Safety check: Don't add if Realtime subscription already caught it
          setTasks(prev => {
              if (prev.some(t => t.id === newTask.id)) return prev;
              return [newTask, ...prev];
          });
          addNotification("کار با موفقیت اضافه شد.");
      } catch (error) { addNotification("خطا در افزودن کار.", "error"); }
  };
  const handleUpdateTask = async (task: Task | Partial<Task>) => {
      try {
          if (!task.id) throw new Error("Task ID is missing");
          const updatedTask = await taskService.updateTask(task.id, task);
          setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
          addNotification("کار به‌روزرسانی شد.");
      } catch (error) { addNotification("خطا در به‌روزرسانی کار.", "error"); }
  };
  const handleDeleteTask = async (id: string) => {
      try {
          await taskService.deleteTask(id);
          setTasks(prev => prev.filter(t => t.id !== id));
          addNotification("کار حذف شد.");
      } catch (error) { addNotification("خطا در حذف کار.", "error"); }
  };
  const handleToggleTask = async (id: string) => {
      const task = tasks.find(t => t.id === id);
      if (!task) return;
      try {
          const newStatus = task.status === 'done' ? 'todo' : 'done';
          const completed_at = newStatus === 'done' ? new Date().toISOString() : null;
          const updatedTask = await taskService.updateTask(id, { status: newStatus, completed_at });
          setTasks(prevTasks => prevTasks.map(t => t.id === id ? updatedTask : t));
      } catch (error) { 
          addNotification("خطا در تغییر وضعیت کار.", "error"); 
      }
  };
  
  // Notes
  const handleAddNote = async (note: Omit<Note, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      try {
          const newNote = await noteService.createNote(note);
          setNotes(prev => {
              if (prev.some(n => n.id === newNote.id)) return prev;
              return [newNote, ...prev];
          });
          addNotification("یادداشت با موفقیت اضافه شد.");
      } catch (error) { addNotification("خطا در افزودن یادداشت.", "error"); }
  };
  const handleUpdateNote = async (note: Note | Partial<Note>) => {
      try {
          if (!note.id) throw new Error("Note ID is missing");
          const updatedNote = await noteService.updateNote(note.id, note);
          setNotes(prev => prev.map(n => n.id === updatedNote.id ? updatedNote : n));
          addNotification("یادداشت به‌روزرسانی شد.");
      } catch (error) { addNotification("خطا در به‌روزرسانی یادداشت.", "error"); }
  };
  const handleDeleteNote = async (id: string) => {
      try {
          await noteService.deleteNote(id);
          setNotes(prev => prev.filter(n => n.id !== id));
          addNotification("یادداشت حذف شد.");
      } catch (error) { addNotification("خطا در حذف یادداشت.", "error"); }
  };

  // Habits
  const handleToggleHabit = async (habitId: string, date: string) => {
      const originalHabits = habits;

      // Optimistic UI update
      setHabits(prevHabits => prevHabits.map(h => {
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
          addNotification("خطا در ثبت وضعیت عادت.", "error");
          setHabits(originalHabits); // Rollback on error
      }
  };

  const handleAddHabit = async (habit: Omit<Habit, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'completedDates'>) => {
      try {
          const newHabit = await habitService.createHabit(habit);
          setHabits(prev => {
              if (prev.some(h => h.id === newHabit.id)) return prev;
              return [newHabit, ...prev];
          });
          addNotification("عادت با موفقیت ساخته شد.");
      } catch (error) { addNotification("خطا در ساخت عادت.", "error"); }
  };

  const handleUpdateHabit = async (habit: Habit | Partial<Habit>) => {
      try {
          if (!habit.id) throw new Error("Habit ID is missing");
          const updatedHabit = await habitService.updateHabit(habit.id, habit);
          // Preserve completion dates in state as API doesn't return them on update
          setHabits(prev => prev.map(h => h.id === updatedHabit.id ? { ...updatedHabit, completedDates: h.completedDates } : h));
          addNotification("عادت به‌روزرسانی شد.");
      } catch (error) { addNotification("خطا در به‌روزرسانی عادت.", "error"); }
  };

  const handleDeleteHabit = async (id: string) => {
      try {
          await habitService.deleteHabit(id);
          setHabits(prev => prev.filter(h => h.id !== id));
          addNotification("عادت حذف شد.");
      } catch (error) { addNotification("خطا در حذف عادت.", "error"); }
  };

  // --- Handlers for Chat to open modals ---
  const handleEditTask = (task: Task) => setEditingTask(task);
  const handleEditNote = (note: Note) => setEditingNote(note);
  const handleEditProject = (project: Project) => setEditingProject(project);

  // --- Injection Handler for AI Results (Optimistic UI) ---
  const handleInjectResult = (result: ActionResult) => {
      const { type, operation, data } = result;

      // Generic updater to reduce duplication
      const updateState = <T extends { id: string }>(setter: React.Dispatch<React.SetStateAction<T[]>>) => {
          setter(prev => {
              if (operation === 'create') {
                  // Prepend new item, remove if duplicate ID exists (race condition safety)
                  return [data, ...prev.filter(i => i.id !== data.id)];
              } else {
                  // Update existing item
                  return prev.map(i => i.id === data.id ? data : i);
              }
          });
      };

      if (type === 'task') updateState(setTasks);
      else if (type === 'note') updateState(setNotes);
      else if (type === 'project') updateState(setProjects);
      else if (type === 'habit') {
           // For habits, we need to ensure completedDates exists if creating
           const habitData = operation === 'create' ? { ...data, completedDates: [] } : data;
           setHabits(prev => {
               if (operation === 'create') return [habitData, ...prev.filter(h => h.id !== habitData.id)];
               return prev.map(h => h.id === habitData.id ? habitData : h);
           });
      }
  };

  const handleSaveModalTask = (task: Task | Partial<Task>) => {
      if ('id' in task && task.id) handleUpdateTask(task);
      else handleAddTask(task as any);
      setEditingTask(null);
  }
  const handleSaveModalNote = (note: Note | Partial<Note>) => {
      if ('id' in note && note.id) handleUpdateNote(note);
      else handleAddNote(note as any);
      setEditingNote(null);
  }
  const handleSaveModalHabit = (habit: Habit | Partial<Habit>) => {
      if ('id' in habit && habit.id) handleUpdateHabit(habit);
      else handleAddHabit(habit as any);
      setEditingHabit(null);
  }


  const renderContent = () => {
    if (loadingData) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-sky-500"></div>
            </div>
        );
    }
    
    switch (currentPage) {
      case Page.Dashboard:
        return <Dashboard 
            tasks={tasks} notes={notes} projects={projects} habits={habits}
            toggleHabitCompletion={handleToggleHabit} toggleTaskCompletion={handleToggleTask}
            selectedDate={selectedDate} setSelectedDate={setSelectedDate}
            addTask={handleAddTask} addNote={handleAddNote}
            editHabit={setEditingHabit}
            subscription={subscription}
            profile={profile}
            onTriggerUpgrade={() => {
              setPaywallMessage('جهت دسترسی نامحدود به دستیار هوشمند و قابلیت‌های مدیریت پروژه، طرح خود را ارتقا دهید.');
              setShowPaywall(true);
            }}
        />;
      case Page.Tasks:
        return <TasksView 
            tasks={tasks} projects={projects} notes={notes}
            addTask={handleAddTask} updateTask={handleUpdateTask}
            toggleTaskCompletion={handleToggleTask} deleteTask={handleDeleteTask}
        />;
      case Page.Notes:
        return <NotesView 
            notes={notes} projects={projects} tasks={tasks}
            addNote={handleAddNote} updateNote={handleUpdateNote} deleteNote={handleDeleteNote}
        />;
      case Page.Projects:
          return <ProjectsView
            projects={projects} tasks={tasks} notes={notes}
            addProject={handleAddProject} updateProject={handleUpdateProject} deleteProject={handleDeleteProject}
            updateTask={handleUpdateTask} deleteTask={handleDeleteTask}
            updateNote={handleUpdateNote} deleteNote={handleDeleteNote}
            editingProject={editingProject} setEditingProject={setEditingProject}
          />;
      case Page.Chat:
        return <ChatView 
            messages={chatMessages} setMessages={setChatMessages}
            tasks={tasks} notes={notes} projects={projects}
            onEditTask={handleEditTask} onEditNote={handleEditNote} onEditProject={handleEditProject}
            setPage={setCurrentPage}
            onInjectResult={handleInjectResult}
            onTriggerPaywall={(msg) => {
              setPaywallMessage(msg);
              setShowPaywall(true);
            }}
        />;
      default:
        return <Dashboard 
            tasks={tasks} notes={notes} projects={projects} habits={habits}
            toggleHabitCompletion={handleToggleHabit} toggleTaskCompletion={handleToggleTask}
            selectedDate={selectedDate} setSelectedDate={setSelectedDate}
            addTask={handleAddTask} addNote={handleAddNote}
            editHabit={setEditingHabit}
            subscription={subscription}
            profile={profile}
            onTriggerUpgrade={() => {
              setPaywallMessage('جهت دسترسی نامحدود به دستیار هوشمند و قابلیت‌های مدیریت پروژه، طرح خود را ارتقا دهید.');
              setShowPaywall(true);
            }}
        />;
    }
  };

  if (isOnboarding && user) {
    return (
      <Onboarding 
        userId={user.id} 
        onComplete={() => {
          setIsOnboarding(false);
          // Refetch profiles to update main state
          supabase.from('profiles').select('*').maybeSingle().then(res => {
            if (res.data) setProfile(res.data);
          });
        }} 
      />
    );
  }

  return (
       <div className="relative flex flex-col h-screen">
            <NetworkBanner />
            <main className="flex-1 overflow-y-auto pb-24">
                {renderContent()}
            </main>
            <ToastNotifications notifications={notifications} onRemove={removeNotification} />
            <BottomNav currentPage={currentPage} setPage={setCurrentPage} />
            
            {/* Global Modals triggered from Chat */}
            {editingTask && (
                <TaskEditorModal 
                    isOpen={!!editingTask} task={editingTask} 
                    projects={projects} notes={notes} 
                    onClose={() => setEditingTask(null)} onSave={handleSaveModalTask} onDelete={handleDeleteTask} 
                />
            )}
            {editingNote && (
                <NoteEditorModal 
                    isOpen={!!editingNote} note={editingNote} 
                    projects={projects} tasks={tasks} allNotes={notes} 
                    onClose={() => setEditingNote(null)} onSave={handleSaveModalNote} onDelete={handleDeleteNote} 
                />
            )}
            {editingHabit && (
                <HabitEditorModal
                    isOpen={!!editingHabit} habit={editingHabit}
                    onClose={() => setEditingHabit(null)} onSave={handleSaveModalHabit} onDelete={handleDeleteHabit}
                />
            )}

            {/* Billing Paywall Modal */}
            <PaywallModal
                isOpen={showPaywall}
                onClose={() => setShowPaywall(false)}
                currentPlanCode={subscription?.plan_code}
                message={paywallMessage}
            />
       </div>
  );
};


const AppContent: React.FC = () => {
  const { session, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-sky-500"></div>
      </div>
    );
  }

  return session ? <MainApp /> : <AuthComponent />;
};

const App: React.FC = () => {
  return (
    <div className="bg-gray-950 min-h-screen text-white" style={{ fontFamily: "'Vazirmatn', sans-serif" }}>
       <AuthProvider>
          <AppContent />
       </AuthProvider>
    </div>
  );
}

export default App;
