import React from 'react';
import { Project, Priority } from '../../../types';
import { PencilIcon, TrashIcon, ListChecksIcon } from '../../../components/icons';

export const colorClasses: { [key: string]: { bg: string; border: string; text: string; gradient: string; solidBg: string; } } = {
  sky:    { bg: 'bg-project-sky/10', border: 'border-[var(--project-color-sky)]', text: 'text-[var(--project-color-sky)]', gradient: 'from-project-sky/20', solidBg: 'bg-[var(--project-color-sky)]' },
  red:    { bg: 'bg-project-red/10', border: 'border-[var(--project-color-red)]', text: 'text-[var(--project-color-red)]', gradient: 'from-project-red/20', solidBg: 'bg-[var(--project-color-red)]' },
  green:  { bg: 'bg-project-green/10', border: 'border-[var(--project-color-green)]', text: 'text-[var(--project-color-green)]', gradient: 'from-project-green/20', solidBg: 'bg-[var(--project-color-green)]' },
  yellow: { bg: 'bg-project-yellow/10', border: 'border-[var(--project-color-yellow)]', text: 'text-[var(--project-color-yellow)]', gradient: 'from-project-yellow/20', solidBg: 'bg-[var(--project-color-yellow)]' },
  purple: { bg: 'bg-project-purple/10', border: 'border-[var(--project-color-purple)]', text: 'text-[var(--project-color-purple)]', gradient: 'from-project-purple/20', solidBg: 'bg-[var(--project-color-purple)]' },
  gray:   { bg: 'bg-project-gray/10', border: 'border-[var(--project-color-gray)]', text: 'text-[var(--project-color-gray)]', gradient: 'from-project-gray/20', solidBg: 'bg-[var(--project-color-gray)]' },
};

export const priorityClasses: { [key: string]: { text: string; label: string; bg: string; color: string; } } = {
  [Priority.High]: { text: 'text-[var(--semantic-error)]', label: 'زیاد', bg: 'bg-[var(--semantic-error-soft)]', color: 'red' },
  [Priority.Medium]: { text: 'text-[var(--color-primary-text)]', label: 'متوسط', bg: 'bg-primary/10', color: 'yellow' },
  [Priority.Low]: { text: 'text-[var(--text-muted)]', label: 'کم', bg: 'bg-[var(--bg-card)]', color: 'sky' },
};

interface ProjectCardProps {
  project: Project;
  stats: { progress: number; activeTasks: number; };
  onDelete: (id: string) => void;
  onEdit: (project: Project) => void;
  onView: (project: Project) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({ 
  project, 
  stats, 
  onDelete, 
  onEdit, 
  onView 
}) => {
  const colors = colorClasses[project.color] || colorClasses.gray;
  const priority = priorityClasses[project.priority] || priorityClasses[Priority.Medium];
  
  return (
    <div 
      onClick={() => onView(project)}
      className="bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:border-[var(--border-neon)] hover:shadow-xl hover:-translate-y-1 relative"
      dir="rtl"
    >
      <div className={`h-1.5 ${colors.solidBg}/80`}></div>
      <div className="p-4">
        <div className="flex justify-between items-start text-right">
          <div>
            <h3 className="font-bold text-base text-[var(--text-main)] font-sans">{project.title}</h3>
            <div className={`inline-flex items-center gap-2 mt-2 px-2.5 py-0.5 text-[10px] font-bold rounded-lg ${priority.bg} ${priority.text}`}>
              اولویت: {priority.label}
            </div>
          </div>
          
          {/* Action buttons (only displayed/accessible easily on touch too!) */}
          <div className="flex items-center gap-1 flex-shrink-0 -mr-2 -mt-2">
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(project); }} 
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--color-primary-text)] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors font-semibold"
              title="ویرایش پروژه"
            >
              <PencilIcon className="w-4 h-4"/>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(project.id); }} 
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--semantic-error)] hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors font-semibold"
              title="حذف پروژه"
            >
              <TrashIcon className="w-4 h-4"/>
            </button>
          </div>
        </div>
        
        <p className="text-xs text-[var(--text-muted)] mt-3 line-clamp-2 min-h-[36px] text-right font-medium leading-relaxed">
          {project.description || 'بدون توضیحات...'}
        </p>

        <div className="mt-4">
          <div className="flex justify-between items-center text-[10px] font-bold text-[var(--text-muted)] mb-1.5">
            <span>پیشرفت پروژه</span>
            <span className="font-semibold text-[var(--text-main)] font-mono">{stats.progress}%</span>
          </div>
          <div className="w-full bg-[var(--bg-card)] rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-1.5 rounded-full ${colors.solidBg} transition-all duration-500`} 
              style={{ width: `${stats.progress}%` }}
            ></div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-muted)] mt-3">
            <ListChecksIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <span>{stats.activeTasks > 0 ? `${stats.activeTasks} کار باقی مانده` : 'تمام کارها تکمیل شده است'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
