import React, { useMemo, useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { isSameTehranDay } from '../../utils/dateUtils';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { WeeklyReportModal } from './components/WeeklyReportModal';
import { OverdueTasksModal } from './components/OverdueTasksModal';

// Feature subcomponents
import { DashboardHeader } from './components/DashboardHeader';
import { WeekCalendar } from './components/WeekCalendar';
import { TodaysPlan } from './components/TodaysPlan';
import { StatsOverview } from './components/StatsOverview';
import { KeyProjects } from './components/KeyProjects';
import { ProductivityChart } from './components/ProductivityChart';
import { FocusTimer } from './components/FocusTimer';
import { AiComposerPanel } from './components/AiComposerPanel';

const Dashboard: React.FC = () => {
  const {
    tasks,
    selectedDate,
    setSelectedDate,
  } = useData();

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isOverdueOpen, setIsOverdueOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 1024px)');

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
    <div className="h-full pb-2">
      {isDesktop ? (
        <div className="flex gap-4 h-full" id="desktop-dashboard">
          {/* ستون ۲: مرکز فرمان (انعطاف‌پذیر، دارای اسکرول داخلی) */}
          <section className="flex-1 flex flex-col gap-4 min-w-0 h-full">
            <AiComposerPanel />
            <ProductivityChart />
            {/* TodaysPlan تنها کامپوننتی است که کشسان و دارای اسکرول داخلی است */}
            <div className="flex-1 min-h-0">
              <TodaysPlan onOpenOverdueModal={() => setIsOverdueOpen(true)} />
            </div>
          </section>
          {/* ستون ۳: بافتار داده (اسکرول داخلی کل ستون برای ایمنیِ زوم) */}
          <aside className="w-[320px] shrink-0 flex flex-col gap-4 h-full overflow-y-auto soft-scroll pb-2 pr-1">
            <StatsOverview 
              onOpenWeeklyReport={() => setIsReportOpen(true)} 
              onOpenOverdueModal={() => setIsOverdueOpen(true)} 
            />
            <WeekCalendar selectedDate={selectedDate} onDateChange={setSelectedDate} />
            <KeyProjects />
            <FocusTimer />
          </aside>
        </div>
      ) : (
        <div className="flex flex-col gap-6 px-5 pt-0 pb-bottom-nav" id="mobile-dashboard">
          <DashboardHeader 
            onOpenProfile={() => window.dispatchEvent(new CustomEvent('hexer:open-profile'))} 
            todayProgress={selectedDayProgressStats.progress}
            hasTasksToday={selectedDayProgressStats.hasTasks}
          />
          <WeekCalendar selectedDate={selectedDate} onDateChange={setSelectedDate} />
          <AiComposerPanel />
          <StatsOverview 
            onOpenWeeklyReport={() => setIsReportOpen(true)} 
            onOpenOverdueModal={() => setIsOverdueOpen(true)} 
          />
          <TodaysPlan onOpenOverdueModal={() => setIsOverdueOpen(true)} />
          <ProductivityChart />
          <KeyProjects />
          <FocusTimer />
        </div>
      )}

      <WeeklyReportModal 
        isOpen={isReportOpen} 
        onClose={() => setIsReportOpen(false)} 
      />

      <OverdueTasksModal 
        isOpen={isOverdueOpen} 
        onClose={() => setIsOverdueOpen(false)} 
      />
    </div>
  );
};

export default Dashboard;

