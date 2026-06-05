
import React, { useState, useEffect } from 'react';
import { Page, Task, Note, Project, Habit, ActionResult } from './types';
import BottomNav from './components/BottomNav';
import Dashboard from './features/dashboard/Dashboard';
import TasksView from './features/tasks/TasksView';
import NotesView from './features/notes/NotesView';
import ChatView from './features/chat/ChatView';
import ProjectsView from './features/projects/ProjectsView';
import { SubscriptionPage } from './features/billing/pages/SubscriptionPage';
import { RenewReminderModal } from './features/billing/components/RenewReminderModal';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthComponent from './components/Auth';
import { DataProvider, useData } from './contexts/DataContext';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import { supabase } from './services/supabaseClient';

// Import components
import TaskEditorModal from './features/tasks/components/TaskEditorModal';
import NoteEditorModal from './features/notes/components/NoteEditorModal';
import { HabitEditorModal } from './features/habits/components/HabitEditorModal';
import { PaywallModal } from './components/PaywallModal';
import { Onboarding } from './components/Onboarding';
import { NetworkBanner } from './components/NetworkBanner';
import { ToastNotifications } from './components/ui/ToastNotifications';
import * as billingService from './services/billingService';

const MainApp: React.FC = () => {
  const { user } = useAuth();
  
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
    addNotification
  });

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
      updateTask(taskToSave);
    } else {
      addTask(taskToSave as any);
    }
    setEditingTask(null);
  };

  const handleSaveModalNote = (noteToSave: Note | Partial<Note>) => {
    if ('id' in noteToSave && noteToSave.id) {
      updateNote(noteToSave);
    } else {
      addNote(noteToSave as any);
    }
    setEditingNote(null);
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
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-sky-500"></div>
        </div>
      );
    }
    
    switch (currentPage) {
      case Page.Dashboard:
        return (
          <Dashboard 
            tasks={tasks} notes={notes} projects={projects} habits={habits}
            toggleHabitCompletion={toggleHabitCompletion} toggleTaskCompletion={toggleTaskCompletion}
            selectedDate={selectedDate} setSelectedDate={setSelectedDate}
            addTask={addTask} addNote={addNote}
            editHabit={setEditingHabit}
            subscription={subscription}
            profile={profile}
            onTriggerUpgrade={() => {
              setPaywallMessage('جهت دسترسی نامحدود به دستیار هوشمند و قابلیت‌های مدیریت پروژه، طرح خود را ارتقا دهید.');
              setShowPaywall(true);
            }}
          />
        );
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
          <ProjectsView />
        );
      case Page.Subscription:
        return (
          <SubscriptionPage />
        );
      case Page.Chat:
        return (
          <ChatView 
            onEditTask={handleEditTask} 
            onEditNote={handleEditNote} 
            onEditProject={handleEditProject} 
          />
        );
      default:
        return (
          <Dashboard 
            tasks={tasks} notes={notes} projects={projects} habits={habits}
            toggleHabitCompletion={toggleHabitCompletion} toggleTaskCompletion={toggleTaskCompletion}
            selectedDate={selectedDate} setSelectedDate={setSelectedDate}
            addTask={addTask} addNote={addNote}
            editHabit={setEditingHabit}
            subscription={subscription}
            profile={profile}
            onTriggerUpgrade={() => {
              setPaywallMessage('جهت دسترسی نامحدود به دستیار هوشمند و قابلیت‌های مدیریت پروژه، طرح خود را ارتقا دهید.');
              setShowPaywall(true);
            }}
          />
        );
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
    <div className="relative flex flex-col h-[100dvh]" id="main-app-container">
      <NetworkBanner />
      <main className="flex-1 overflow-y-auto overflow-x-hidden pb-24" id="view-viewport">
        {renderContent()}
      </main>
      <ToastNotifications notifications={notifications} onRemove={removeNotification} />
      <BottomNav currentPage={currentPage} setPage={setCurrentPage} />
      
      {/* Global Modals triggered from Chat & Lists */}
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
        <HabitEditorModal
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
    </div>
  );
};

const AppContent: React.FC = () => {
  const { session, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[100dvh]" id="main-loader">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-sky-500"></div>
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
    <div className="bg-gray-950 min-h-screen text-white" style={{ fontFamily: "'Vazirmatn', sans-serif" }} id="app-root">
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </div>
  );
};

export default App;

