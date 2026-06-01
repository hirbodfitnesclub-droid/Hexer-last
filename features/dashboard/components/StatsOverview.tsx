import React, { useMemo } from 'react';
import { useData } from '../../../contexts/DataContext';
import { getTehranDateString, compareTehranDates, isSameTehranDay } from '../../../utils/dateUtils';
import { Priority } from '../../../types';
import { FlameIcon, BriefcaseIcon, CheckIcon, PlusIcon } from '../../../components/icons';
import { WidgetContainer } from './WidgetContainer';

export const StatsOverview: React.FC = () => {
  const { tasks, projects } = useData();

  const stats = useMemo(() => {
    const todayStr = getTehranDateString(new Date());

    const overdue = tasks.filter(t => 
      t.status !== 'done' && 
      t.due_date && 
      compareTehranDates(t.due_date, todayStr) < 0
    ).length;

    const highPriorityProjects = projects.filter(p => 
      p.priority === Priority.High || p.priority === 'high'
    ).length;

    const completedToday = tasks.filter(t => 
      t.status === 'done' && 
      t.due_date && 
      isSameTehranDay(t.due_date, new Date())
    ).length;

    const inbox = tasks.filter(t => 
      t.status !== 'done' && 
      !t.due_date
    ).length;

    return { overdue, highPriorityProjects, completedToday, inbox };
  }, [tasks, projects]);

  const StatCard: React.FC<{ icon: React.ReactNode; value: number; label: string; colorClass: string }> = ({ 
    icon, 
    value, 
    label, 
    colorClass 
  }) => (
    <div className="bg-gray-800/70 border border-white/5 p-4 rounded-xl flex items-center gap-4 transition-all duration-300 hover:border-white/10">
      <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg ${colorClass}`}>
        {icon}
      </div>
      <div>
        <span className="text-2xl font-bold text-white block leading-tight">{value}</span>
        <p className="text-xs text-gray-400 font-medium select-none">{label}</p>
      </div>
    </div>
  );

  return (
    <WidgetContainer>
      <h2 className="text-lg font-bold text-white mb-4">در یک نگاه</h2>
      <div className="grid grid-cols-2 gap-3">
        <StatCard 
          icon={<FlameIcon className="w-5 h-5"/>} 
          value={stats.overdue} 
          label="عقب افتاده" 
          colorClass="bg-red-500/20 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
        />
        <StatCard 
          icon={<BriefcaseIcon className="w-5 h-5"/>} 
          value={stats.highPriorityProjects} 
          label="پروژه مهم" 
          colorClass="bg-yellow-500/20 text-yellow-300 shadow-[0_0_12px_rgba(234,179,8,0.15)]"
        />
        <StatCard 
          icon={<CheckIcon className="w-5 h-5"/>} 
          value={stats.completedToday} 
          label="انجام شده امروز" 
          colorClass="bg-green-500/20 text-green-300 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
        />
        <StatCard 
          icon={<PlusIcon className="w-5 h-5"/>} 
          value={stats.inbox} 
          label="بدون تاریخ" 
          colorClass="bg-gray-500/20 text-gray-300 shadow-[0_0_12px_rgba(156,163,175,0.15)]"
        />
      </div>
    </WidgetContainer>
  );
};
