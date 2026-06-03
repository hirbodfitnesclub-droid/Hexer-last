import React from 'react';
import { Project, Priority } from '../../../types';
import { PencilIcon, TrashIcon, ListChecksIcon } from '../../../components/icons';

export const colorClasses: { [key: string]: { bg: string; border: string; text: string; gradient: string; solidBg: string; } } = {
  sky:    { bg: 'bg-sky-500/10',    border: 'border-sky-500/55',    text: 'text-sky-300',    gradient: 'from-sky-500/20',    solidBg: 'bg-sky-500' },
  red:    { bg: 'bg-red-500/10',    border: 'border-red-500/55',    text: 'text-red-300',    gradient: 'from-red-500/20',    solidBg: 'bg-red-500' },
  green:  { bg: 'bg-green-500/10',  border: 'border-green-500/55',  text: 'text-green-300',  gradient: 'from-green-500/20',  solidBg: 'bg-green-500' },
  yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/55', text: 'text-yellow-300', gradient: 'from-yellow-500/20', solidBg: 'bg-yellow-500' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/55', text: 'text-purple-300', gradient: 'from-purple-500/20', solidBg: 'bg-purple-500' },
  gray:   { bg: 'bg-zinc-500/10',   border: 'border-zinc-500/55',   text: 'text-zinc-300',   gradient: 'from-zinc-500/20',   solidBg: 'bg-zinc-500' },
};

export const priorityClasses: { [key: string]: { text: string; label: string; bg: string; color: string; } } = {
  [Priority.High]: { text: 'text-red-300', label: 'زیاد', bg: 'bg-red-500/10', color: 'red' },
  [Priority.Medium]: { text: 'text-yellow-300', label: 'متوسط', bg: 'bg-yellow-500/10', color: 'yellow' },
  [Priority.Low]: { text: 'text-sky-300', label: 'کم', bg: 'bg-sky-500/10', color: 'sky' },
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
      className="bg-zinc-900/60 rounded-2xl border border-white/5 overflow-hidden cursor-pointer transition-all duration-300 hover:border-zinc-800 hover:shadow-xl hover:shadow-black/40 hover:-translate-y-1 relative"
      dir="rtl"
    >
      <div className={`h-1.5 ${colors.solidBg}/80`}></div>
      <div className="p-4">
        <div className="flex justify-between items-start text-right">
          <div>
            <h3 className="font-bold text-base text-zinc-100 font-sans">{project.title}</h3>
            <div className={`inline-flex items-center gap-2 mt-2 px-2.5 py-0.5 text-[10px] font-bold rounded-lg ${priority.bg} ${priority.text}`}>
              اولویت: {priority.label}
            </div>
          </div>
          
          {/* Action buttons (only displayed/accessible easily on touch too!) */}
          <div className="flex items-center gap-1 flex-shrink-0 -mr-2 -mt-2">
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(project); }} 
              className="p-1.5 text-zinc-500 hover:text-sky-450 hover:bg-white/5 rounded-lg transition-colors font-semibold"
              title="ویرایش پروژه"
            >
              <PencilIcon className="w-4 h-4"/>
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(project.id); }} 
              className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors font-semibold"
              title="حذف پروژه"
            >
              <TrashIcon className="w-4 h-4"/>
            </button>
          </div>
        </div>
        
        <p className="text-xs text-zinc-400 mt-3 line-clamp-2 min-h-[36px] text-right font-medium leading-relaxed">
          {project.description || 'بدون توضیحات...'}
        </p>

        <div className="mt-4">
          <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500 mb-1.5">
            <span>پیشرفت پروژه</span>
            <span className="font-semibold text-zinc-300 font-mono">{stats.progress}%</span>
          </div>
          <div className="w-full bg-zinc-950/60 rounded-full h-1.5 overflow-hidden">
            <div 
              className={`h-1.5 rounded-full ${colors.solidBg} transition-all duration-500`} 
              style={{ width: `${stats.progress}%` }}
            ></div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 mt-3">
            <ListChecksIcon className="w-3.5 h-3.5 text-zinc-600" />
            <span>{stats.activeTasks > 0 ? `${stats.activeTasks} کار باقی مانده` : 'تمام کارها تکمیل شده است'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
