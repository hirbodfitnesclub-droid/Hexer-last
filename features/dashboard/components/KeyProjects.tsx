import React, { useMemo } from 'react';
import { useData } from '../../../contexts/DataContext';
import { Priority } from '../../../types';
import { WidgetContainer } from './WidgetContainer';

const getColorClass = (color: string) => {
  switch (color?.toLowerCase()) {
    case 'indigo': return 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]';
    case 'purple': return 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]';
    case 'pink': return 'bg-pink-500 shadow-[0_0_8px_rgba(244,114,182,0.5)]';
    case 'red': return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
    case 'yellow': return 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.5)]';
    case 'green': return 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]';
    case 'blue': return 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]';
    case 'sky': return 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]';
    default: return 'bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.5)]';
  }
};

export const KeyProjects: React.FC = () => {
  const { projects, tasks } = useData();

  const highPriorityProjects = useMemo(() => {
    return projects
      .filter(p => p.priority === Priority.High || p.priority === 'high')
      .map(p => {
        const projectTasks = tasks.filter(t => t.project_id === p.id);
        const completed = projectTasks.filter(t => t.status === 'done').length;
        const progress = projectTasks.length > 0 ? Math.round((completed / projectTasks.length) * 100) : 0;
        return { ...p, progress, remaining: projectTasks.length - completed };
      })
      .slice(0, 3);
  }, [projects, tasks]);
  
  if (highPriorityProjects.length === 0) return null;

  return (
    <WidgetContainer>
      <h2 className="text-lg font-bold text-white mb-4">پروژه‌های کلیدی</h2>
      <div className="space-y-4">
        {highPriorityProjects.map(p => (
          <div key={p.id} className="group">
            <div className="flex justify-between items-center mb-1.5">
              <span className="font-semibold text-sm text-gray-200 group-hover:text-white transition-colors">
                {p.title}
              </span>
              <span className="text-xs font-mono text-gray-400">{p.progress}%</span>
            </div>
            <div className="w-full bg-gray-700/50 rounded-full h-1.5 overflow-hidden">
              <div 
                className={`h-1.5 rounded-full transition-all duration-500 ${getColorClass(p.color)}`} 
                style={{ width: `${p.progress}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </WidgetContainer>
  );
};
