import React, { useMemo } from 'react';
import { useData } from '../../../contexts/DataContext';
import { Priority } from '../../../types';
import { FolderGit2Icon, ArrowLeftIcon } from '../../../components/icons';

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
      });
  }, [projects, tasks]);

  // If there are no high priority projects, show the empty state
  if (highPriorityProjects.length === 0) {
    return (
      <div className="tile-lime min-h-[200px] p-4 rounded-[var(--radius-lg)] flex flex-col justify-between shadow-sm" id="key-projects-panel-empty">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <FolderGit2Icon className="w-5 h-5 text-[var(--text-on-primary)]" />
            <h2 className="text-xs font-black text-[var(--text-on-primary)]">پروژه کلیدی</h2>
          </div>
          <span className="text-[10px] font-bold text-[var(--text-on-primary)] bg-black/10 px-2 py-0.5 rounded-full">غیرفعال</span>
        </div>
        <div className="my-auto text-center">
          <p className="text-xs font-medium text-[var(--text-on-primary)]">پروژه با اولویت بالا یافت نشد.</p>
        </div>
        <div className="flex justify-end">
          <ArrowLeftIcon className="w-4 h-4 text-[var(--text-on-primary)]" />
        </div>
      </div>
    );
  }

  const project = highPriorityProjects[0];

  return (
    <div className="tile-lime min-h-[200px] p-4 rounded-[var(--radius-lg)] flex flex-col justify-between shadow-sm" id="key-projects-panel">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <FolderGit2Icon className="w-5 h-5 text-[var(--text-on-primary)]" />
          <h2 className="text-xs font-black text-[var(--text-on-primary)]">پروژه کلیدی</h2>
        </div>
        <span className="text-[10px] font-bold text-[var(--text-on-primary)] bg-black/10 px-2 py-0.5 rounded-full">فعال</span>
      </div>
      
      <div className="my-2 text-right">
        <h3 className="font-semibold text-sm text-[var(--text-on-primary)] truncate max-w-[90%]">
          {project.title}
        </h3>
        <p className="text-[10px] text-[var(--text-on-primary)] opacity-80 mt-1">
          کارهای باقی‌مانده: {project.remaining}
        </p>
      </div>

      <div className="group mt-auto">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-[10px] font-bold text-[var(--text-on-primary)]">پیشرفت پروژه</span>
          <span className="text-xs font-mono font-bold text-[var(--text-on-primary)]">{project.progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-black/10 overflow-hidden">
          <div 
            className="h-full bg-[var(--text-on-primary)] rounded-full transition-all duration-500" 
            style={{ width: `${project.progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
};
