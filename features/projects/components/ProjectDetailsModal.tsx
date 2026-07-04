import React, { useState, useEffect } from 'react';
import { Project, Priority, Task, Note } from '../../../types';
import { 
  XIcon, BriefcaseIcon, LayoutGridIcon, 
  ListChecksIcon, NotebookIcon, ChevronDownIcon, PencilIcon 
} from '../../../components/icons';
import { colorClasses, priorityClasses } from './ProjectCard';

interface ProjectDetailsModalProps {
  project: Project;
  tasks: Task[];
  notes: Note[];
  isOpen: boolean;
  onClose: () => void;
  onEditTask: (task: Task) => void;
  onEditNote: (note: Note) => void;
}

export const ProjectDetailsModal: React.FC<ProjectDetailsModalProps> = ({ 
  project, 
  tasks, 
  notes, 
  isOpen, 
  onClose, 
  onEditTask, 
  onEditNote 
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'notes'>('overview');
  const [showCompleted, setShowCompleted] = useState(false);
  
  useEffect(() => {
    setActiveTab('overview');
    setShowCompleted(false);
  }, [project, isOpen]);

  if (!isOpen) return null;

  const projectTasks = tasks.filter(t => t.project_id === project.id);
  const projectNotes = notes.filter(n => n.project_id === project.id);
  const activeTasks = projectTasks.filter(t => t.status !== 'done');
  const completedTasks = projectTasks.filter(t => t.status === 'done');
  const progress = projectTasks.length > 0 ? Math.round((completedTasks.length / projectTasks.length) * 100) : 0;
  
  const colors = colorClasses[project.color] || colorClasses.gray;
  const priorityInfo = priorityClasses[project.priority] || priorityClasses[Priority.Medium];

  const TabButton: React.FC<{
    label: string; count: number; isActive: boolean; onClick: () => void; icon: React.ReactNode;
  }> = ({ label, count, isActive, onClick, icon }) => (
    <button 
      onClick={onClick} 
      className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold border-b-2 transition-all ${
        isActive 
          ? `${colors.text} border-current` 
          : 'text-[var(--text-muted)] border-transparent hover:text-[var(--text-main)]'
      }`}
    >
      {icon}
      <span>{label}</span>
      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${isActive ? `${colors.bg} ${colors.text}` : 'bg-[var(--bg-base)] text-[var(--text-muted)]'}`}>
        {count}
      </span>
    </button>
  );

  const ItemRow: React.FC<{ onClick: () => void; children: React.ReactNode; icon: React.ReactNode }> = ({ onClick, children, icon }) => (
    <button 
      onClick={onClick} 
      className="w-full group flex items-center gap-3 p-3 rounded-xl text-xs text-right text-[var(--text-main)] bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] hover:bg-[var(--nav-hover-bg)] hover:border-[var(--border-neon)] transition-colors"
    >
      {icon}
      <span className="flex-1 truncate font-medium">{children}</span>
      <PencilIcon className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--color-primary-text)] transition-colors" />
    </button>
  );

  return (
    <div 
      onClick={onClose} 
      className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md z-[70] flex justify-center items-end sm:items-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div 
        onClick={e => e.stopPropagation()} 
        className="bg-[var(--bg-card)] border-t sm:border border-[var(--border-subtle)] w-full max-w-2xl flex flex-col h-[100dvh] sm:h-[85vh] sm:rounded-2xl shadow-2xl overflow-hidden"
      >
        <header className={`relative p-5 pt-safe border-b border-[var(--border-subtle)] bg-gradient-to-br ${colors.gradient} to-transparent shrink-0 text-right`} dir="rtl">
          <div className="flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl ${colors.solidBg} flex items-center justify-center shrink-0`}>
              <BriefcaseIcon className="w-6 h-6 text-white/95" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-[var(--text-main)] font-sans">{project.title}</h2>
              <div className={`inline-flex mt-1.5 px-2 py-0.5 text-[9px] font-bold rounded-md ${priorityInfo.bg} ${priorityInfo.text}`}>
                اولویت: {priorityInfo.label}
              </div>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="absolute top-4 left-4 p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10 rounded-xl transition-colors shrink-0"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </header>

        <nav className="shrink-0 border-b border-[var(--border-subtle)] px-2 sm:px-4 bg-transparent" dir="rtl">
          <div className="flex items-center">
            <TabButton label="نمای کلی" count={0} icon={<LayoutGridIcon className="w-4 h-4"/>} isActive={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
            <TabButton label="کارها" count={projectTasks.length} icon={<ListChecksIcon className="w-4 h-4"/>} isActive={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />
            <TabButton label="یادداشت‌ها" count={projectNotes.length} icon={<NotebookIcon className="w-4 h-4"/>} isActive={activeTab === 'notes'} onClick={() => setActiveTab('notes')} />
          </div>
        </nav>
        
        <div className="flex-1 overflow-y-auto min-h-0 p-5 sm:p-6 bg-transparent" dir="rtl">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="p-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl">
                <div className="flex justify-between items-center text-[10px] font-bold text-[var(--text-muted)] mb-2">
                  <span>پیشرفت پروژه</span>
                  <span className="font-semibold text-[var(--text-main)]">{progress}%</span>
                </div>
                <div className="w-full bg-[var(--bg-base)] rounded-full h-2 overflow-hidden">
                  <div 
                    className={`${colors.solidBg} h-full rounded-full transition-all duration-500`} 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-[var(--border-subtle)]">
                  <div className="text-center">
                    <p className="text-xl font-black text-[var(--text-main)] font-mono">{activeTasks.length}</p>
                    <p className="text-[10px] text-[var(--text-muted)] font-bold mt-0.5">کار فعال</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-black text-[var(--text-main)] font-mono">{completedTasks.length}</p>
                    <p className="text-[10px] text-[var(--text-muted)] font-bold mt-0.5">انجام شده</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-black text-[var(--text-main)] font-mono">{projectNotes.length}</p>
                    <p className="text-[10px] text-[var(--text-muted)] font-bold mt-0.5">یادداشت</p>
                  </div>
                </div>
              </div>
              
              {project.description && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-[var(--text-muted)]">توضیحات</h3>
                  <p className="text-xs text-[var(--text-main)] bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 rounded-xl leading-relaxed whitespace-pre-wrap text-right font-medium">
                    {project.description}
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-[var(--text-muted)] mb-2">کارهای فعال ({activeTasks.length})</h3>
              {activeTasks.length > 0 ? (
                <div className="space-y-2.5">
                  {activeTasks.map(t => {
                    const prioColor = priorityClasses[t.priority]?.color || 'sky';
                    const prioSolid = colorClasses[prioColor]?.solidBg || colors.solidBg;
                    return (
                      <ItemRow 
                        key={t.id} 
                        onClick={() => { onClose(); onEditTask(t); }} 
                        icon={<div className={`w-2 h-2 rounded-full shrink-0 ${prioSolid}`}></div>}
                      >
                        {t.title}
                      </ItemRow>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[var(--text-muted)] text-xs text-center py-6 font-bold">هیچ کار فعالی برای این پروژه وجود ندارد.</p>
              )}
             
              {completedTasks.length > 0 && (
                <div className="pt-2">
                  <button 
                    onClick={() => setShowCompleted(!showCompleted)} 
                    className="w-full flex justify-between items-center px-1 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors font-bold"
                  >
                    <span>انجام‌شده ({completedTasks.length})</span>
                    <ChevronDownIcon className={`w-4 h-4 transition-transform duration-350 ${!showCompleted ? '' : 'rotate-180'}`} />
                  </button>
                  {showCompleted && (
                    <div className="pt-2.5 space-y-2.5">
                      {completedTasks.map(t => (
                        <ItemRow 
                          key={t.id} 
                          onClick={() => { onClose(); onEditTask(t); }} 
                          icon={<ListChecksIcon className="w-4 h-4 text-success shrink-0" />}
                        >
                          {t.title}
                        </ItemRow>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-[var(--text-muted)] mb-2">یادداشت‌های مرتبط ({projectNotes.length})</h3>
              {projectNotes.length > 0 ? (
                <div className="space-y-2.5">
                  {projectNotes.map(n => (
                    <ItemRow 
                      key={n.id} 
                      onClick={() => { onClose(); onEditNote(n); }} 
                      icon={<NotebookIcon className="w-4 h-4 text-[var(--text-muted)] shrink-0" />}
                    >
                      {n.title || 'یادداشت بدون عنوان'}
                    </ItemRow>
                  ))}
                </div>
              ) : (
                <p className="text-[var(--text-muted)] text-xs text-center py-6 font-bold">هیچ یادداشتی برای این پروژه ثبت نشده است.</p>
              )}
            </div>
          )}

          <div className="safe-spacer-bottom" />
        </div>
      </div>
    </div>
  );
};
export default ProjectDetailsModal;
