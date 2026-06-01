import React, { useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { isSameTehranDay } from '../../utils/dateUtils';
import ProfileModal from '../../components/ProfileModal';

// Feature subcomponents
import { DashboardHeader } from './components/DashboardHeader';
import { WeekCalendar } from './components/WeekCalendar';
import { TodaysPlan } from './components/TodaysPlan';
import { TodaysNotes } from './components/TodaysNotes';
import { QuickCapture } from './components/QuickCapture';
import { StatsOverview } from './components/StatsOverview';
import { HabitTracker } from './components/HabitTracker';
import { KeyProjects } from './components/KeyProjects';

const Dashboard: React.FC = () => {
  const { user, signOut } = useAuth();
  const {
    tasks,
    selectedDate,
    setSelectedDate,
    subscription,
    profile,
    onTriggerUpgrade,
  } = useData();

  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Calculate selected day's progress for the Header Ring
  const selectedDayProgressStats = useMemo(() => {
    const dayTasks = tasks.filter(t => 
      t.due_date && isSameTehranDay(t.due_date, selectedDate)
    );
    const total = dayTasks.length;
    const completed = dayTasks.filter(t => t.status === 'done').length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { progress, hasTasks: total > 0 };
  }, [tasks, selectedDate]);

  return (
    <div className="pb-24">
      {/* Sticky Header with Smart Profile Ring (synced to selectedDate progress) */}
      <DashboardHeader 
        onOpenProfile={() => setIsProfileOpen(true)} 
        todayProgress={selectedDayProgressStats.progress}
        hasTasksToday={selectedDayProgressStats.hasTasks}
      />
      
      {/* Scrollable Content Container with Top Padding for Separation */}
      <div className="px-4 sm:px-6 max-w-7xl mx-auto space-y-6 pt-5">
        <WeekCalendar selectedDate={selectedDate} onDateChange={setSelectedDate} />
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Main Column (Right) */}
          <div className="lg:col-span-3 space-y-6">
            <TodaysPlan />
            <TodaysNotes />
            <QuickCapture />
          </div>

          {/* Side Column (Left) */}
          <div className="lg:col-span-2 space-y-6">
            <StatsOverview />
            <HabitTracker />
            <KeyProjects />
          </div>
        </div>
      </div>

      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        user={user} 
        signOut={signOut} 
        subscription={subscription}
        profile={profile}
        onTriggerUpgrade={onTriggerUpgrade}
      />
    </div>
  );
};

export default Dashboard;
