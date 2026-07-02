
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Page, Task, Note, Project, Habit, ActionResult } from './types';
import { useMediaQuery } from './hooks/useMediaQuery';
import BottomNav from './components/BottomNav';
import Dashboard from './features/dashboard/Dashboard';
import TasksView from './features/tasks/TasksView';
import NotesView from './features/notes/NotesView';


// Lazy loaded heavy views
const ChatView = lazy(() => import('./features/chat/ChatView'));
const ProjectsView = lazy(() => import('./features/projects/ProjectsView'));
const SubscriptionPage = lazy(() => import('./features/billing/pages/SubscriptionPage').then(module => ({ default: module.SubscriptionPage })));

const LoadingSpinner: React.FC = () => (
  <div className="flex items-center justify-center h-full min-h-[200px]" id="suspense-loader">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
  </div>
);

import { RenewReminderModal } from './features/billing/components/RenewReminderModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthComponent from './components/Auth';
import { DataProvider, useData } from './contexts/DataContext';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { supabase } from './services/supabaseClient';
import { useReminderScheduler } from './hooks/useReminderScheduler';
import { requestNotificationPermission, subscribeToPush, saveSubscription } from './services/reminderService';

// Import components
import Sidebar from './components/Sidebar';
import ProfileModal from './components/ProfileModal';
import TaskEditorModal from './features/tasks/components/TaskEditorModal';
import NoteEditorModal from './features/notes/components/NoteEditorModal';
import { HabitManagerModal } from './features/habits/components/HabitManagerModal';
import { PaywallModal } from './components/PaywallModal';
import { Onboarding } from './features/onboarding/Onboarding';
import { NetworkBanner } from './components/NetworkBanner';
import { ToastNotifications } from './components/ui/ToastNotifications';
import * as billingService from './services/billingService';
import { AnnouncementManager } from './features/announcements/AnnouncementManager';

const MainApp: React.FC = () => {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { user, signOut } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isZenActive, setIsZenActive] = useState(false);

  useEffect(() => {
    const handleOpenProfile = () => setIsProfileOpen(true);
    window.addEventListener('hexer:open-profile', handleOpenProfile);
    return () => window.removeEventListener('hexer:open-profile', handleOpenProfile);
  }, []);

  useEffect(() => {
    const handleZenMode = (e: Event) => {
      setIsZenActive((e as CustomEvent).detail);
    };
    window.addEventListener('hexer:zen-mode', handleZenMode);
    return () => window.removeEventListener('hexer:zen-mode', handleZenMode);
  }, []);

  useEffect(() => {
    const handleOpenTaskEditor = (e: Event) => {
      const task = (e as CustomEvent).detail;
      setEditingTask(task);
    };
    window.addEventListener('hexer:open-task-editor', handleOpenTaskEditor);
    return () => window.removeEventListener('hexer:open-task-editor', handleOpenTaskEditor);
  }, []);
  
  const {
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
    editingHabit,
    setEditingHabit,
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
    injectAIProposalResult,
    setEntityLinks
  } = useData();

  // Global Modals State
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editingProject, setEditingProject] = useState<Partial<Project> | null>(null);

  // Hook up Postgres real-time synchronization channels
  useRealtimeSync({
    user,
    setProjects,
    setTasks,
    setNotes,
    setHabits,
    setEntityLinks,
    addNotification
  });

  // Activate Foreground Tasks/Nudges scheduler
  useReminderScheduler();

  // Natural moment setup: Ask for notification permission and subscribe to Web Push (Layer B)
  useEffect(() => {
    if (!user) return;

    let timeoutId: number;

    const setupPushManager = async () => {
      try {
        const { pruneShown } = await import('./services/reminderService');
        // Clean cached notification IDs older than 48 hours is done in background
        pruneShown().catch(err => console.warn('[DB] Failed to prune shown alerts:', err));

        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!vapidKey) {
          console.warn('[Push] VITE_VAPID_PUBLIC_KEY is not defined. Bypassing background push setup.');
          return;
        }
        // به هیچ وجه در اینجا requestNotificationPermission یا subscribeToPush را صدا نزن.
        // این کار بعداً با کلیک صریح کاربر (در تسک H11) انجام خواهد شد.
      } catch (err) {
        console.warn('[Push] Setup degraded gracefully:', err);
      }
    };

    // Deliberate delay of 3 seconds after load to feel natural to the user
    timeoutId = window.setTimeout(setupPushManager, 3000);

    return () => clearTimeout(timeoutId);
  }, [user]);

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
  }, [user, addNotification, setSubscription]);

  // --- Handle Custom Navigation Event for Subscription ---
  useEffect(() => {
    const handleNav = () => {
      setCurrentPage(Page.Subscription);
    };
    window.addEventListener('navigate_to_subscription', handleNav);
    return () => window.removeEventListener('navigate_to_subscription', handleNav);
  }, [setCurrentPage]);

  // --- Helpers for opening modals from Chat ---
  const handleEditTask = (task: Task) => setEditingTask(task);
  const handleEditNote = (note: Note) => setEditingNote(note);
  const handleEditProject = (project: Project) => setEditingProject(project);

  const handleSaveModalTask = (taskToSave: Task | Partial<Task>) => {
    if ('id' in taskToSave && taskToSave.id) {
      return updateTask(taskToSave);
    } else {
      return addTask(taskToSave as any);
    }
  };

  const handleSaveModalNote = (noteToSave: Note | Partial<Note>) => {
    if ('id' in noteToSave && noteToSave.id) {
      return updateNote(noteToSave);
    } else {
      return addNote(noteToSave as any);
    }
  };

  const handleSaveModalHabit = (habitToSave: Habit | Partial<Habit>) => {
    if ('id' in habitToSave && habitToSave.id) {
      updateHabit(habitToSave);
    } else {
      addHabit(habitToSave as any);
    }
    setEditingHabit(null);
  };

  const renderContent = () => {
    if (loadingData) {
      return (
        <div className="flex items-center justify-center h-full" id="inner-loader">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
        </div>
      );
    }
    
    switch (currentPage) {
      case Page.Dashboard:
        return <Dashboard />;
      case Page.Tasks:
        return (
          <TasksView 
            tasks={tasks} projects={projects} notes={notes}
            addTask={addTask} updateTask={updateTask}
            toggleTaskCompletion={toggleTaskCompletion} deleteTask={deleteTask}
          />
        );
      case Page.Notes:
        return (
          <NotesView 
            notes={notes} projects={projects} tasks={tasks}
            addNote={addNote} updateNote={updateNote} deleteNote={deleteNote}
          />
        );
      case Page.Projects:
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <ProjectsView />
          </Suspense>
        );
      case Page.Subscription:
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <SubscriptionPage />
          </Suspense>
        );
      case Page.Chat:
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <ChatView 
              onEditTask={handleEditTask} 
              onEditNote={handleEditNote} 
              onEditProject={handleEditProject} 
            />
          </Suspense>
        );
      default:
        return <Dashboard />;
    }
  };

  if (isOnboarding && user) {
    return (
      <Onboarding 
        userId={user.id} 
        onComplete={() => {
          setIsOnboarding(false);
          supabase.from('profiles').select('*').maybeSingle().then(res => {
            if (res.data) setProfile(res.data);
          });
        }} 
      />
    );
  }

  return (
    <div className="relative flex h-[100dvh] text-main" id="main-app-container">
      {isDesktop ? (
        /* شِلِ گلسِ بانددارِ دسکتاپ (دقیقاً مثل پروتوتایپ) */
        <div className="hidden lg:flex fixed inset-0 z-10 items-center justify-center px-6 xl:px-10 overflow-hidden">
          <main className="glass-app w-full max-w-[1280px] h-[92vh] max-h-[860px] rounded-[32px] p-4 flex gap-4 overflow-hidden">
            <Sidebar currentPage={currentPage} setPage={setCurrentPage} onOpenProfile={() => setIsProfileOpen(true)} className="shrink-0" />
            <div className="flex-1 min-w-0 h-full overflow-y-auto soft-scroll pb-6" id="view-viewport">
              <NetworkBanner />
              {renderContent()}
            </div>
          </main>
        </div>
      ) : (
        /* لِی‌اوتِ موبایل (اسکرولیِ سیال) */
        <div className="flex-1 flex flex-col min-w-0 relative z-10">
          <NetworkBanner />
          <main className={`flex-1 overflow-y-auto overflow-x-hidden ${isZenActive ? '' : 'pb-bottom-nav'}`} id="view-viewport">
            {renderContent()}
          </main>
          {!isZenActive && <BottomNav currentPage={currentPage} setPage={setCurrentPage} />}
        </div>
      )}

      <ToastNotifications notifications={notifications} onRemove={removeNotification} />

      {/* Global Modals triggered from Chat, Sidebar & Lists */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        signOut={signOut}
        subscription={subscription}
        profile={profile}
        onTriggerUpgrade={onTriggerUpgrade}
      />
      {editingTask && (
        <TaskEditorModal 
          isOpen={!!editingTask} task={editingTask} 
          projects={projects} notes={notes} 
          onClose={() => setEditingTask(null)} onSave={handleSaveModalTask} onDelete={deleteTask} 
        />
      )}
      {editingNote && (
        <NoteEditorModal 
          isOpen={!!editingNote} note={editingNote} 
          projects={projects} tasks={tasks} allNotes={notes} 
          onClose={() => setEditingNote(null)} onSave={handleSaveModalNote} onDelete={deleteNote} 
        />
      )}
      {editingHabit && (
        <HabitManagerModal
          isOpen={!!editingHabit} habit={editingHabit}
          onClose={() => setEditingHabit(null)} onSave={handleSaveModalHabit} onDelete={deleteHabit}
        />
      )}

      {/* Billing Paywall Modal */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        currentPlanCode={subscription?.plan_code}
        message={paywallMessage}
      />

      {/* Renew Subscription Smart Reminder Alert */}
      <RenewReminderModal />

      {/* Announcements Temporary Modals System */}
      <AnnouncementManager />
    </div>
  );
};

const AppContent: React.FC = () => {
  const { session, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[100dvh]" id="main-loader">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return session ? (
    <DataProvider>
      <MainApp />
    </DataProvider>
  ) : (
    <AuthComponent />
  );
};

const App: React.FC = () => {
  return (
    <div className="min-h-screen text-main" style={{ fontFamily: "'Vazirmatn', sans-serif" }} id="app-root">
      <div className="bg-nature" />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </div>
  );
};

export default App;

