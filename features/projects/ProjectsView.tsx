import React, { useState } from 'react';
import { useData } from '../../contexts/DataContext';
import { Project, Priority, Task, Note } from '../../types';
import { 
  PlusIcon, BriefcaseIcon, PencilIcon, XIcon, 
  ListChecksIcon, NotebookIcon, ChevronDownIcon, CheckIcon 
} from '../../components/icons';
import { ProjectCard, colorClasses, priorityClasses } from './components/ProjectCard';
import { ProjectDetailsModal } from './components/ProjectDetailsModal';
import { calculateProjectStats } from './utils/projectStats';
import { TaskEditorModal } from '../tasks/components/TaskEditorModal';
import { NoteEditorModal } from '../notes/components/NoteEditorModal';

export const ProjectsView: React.FC = () => {
  const { 
    projects, 
    tasks, 
    notes, 
    addProject, 
    updateProject, 
    deleteProject, 
    updateTask, 
    deleteTask, 
    updateNote, 
    deleteNote 
  } = useData();

  const [viewingProject, setViewingProject] = useState<Project | null>(null);
  const [editingProject, setEditingProject] = useState<Partial<Project> | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  
  const isAdding = editingProject ? !('id' in editingProject) : false;

  const openAddModal = () => {
    setEditingProject({ title: '', color: 'sky', description: '', priority: Priority.Medium });
  };

  const handleSaveProject = () => {
    if (!editingProject || !editingProject.title?.trim()) return;
    
    if (isAdding) { 
      addProject(editingProject as Omit<Project, 'id' | 'created_at' | 'updated_at' | 'user_id'>); 
    } else { 
      updateProject(editingProject as Project); 
    }
    setEditingProject(null);
  };

  const handleUpdateTask = (task: Task | Partial<Task>) => { 
    return updateTask(task); 
  };
  
  const handleSaveNote = (note: Note | Partial<Note>) => {
    if ('id' in note) {
      return updateNote(note as Note);
    }
  };

  return (
    <div className="min-h-full text-[var(--text-main)] relative flex flex-col h-full" dir="rtl">
      {/* Header Section */}
      <header className="sticky top-0 pt-safe z-30 px-6 py-8 lg:py-4 lg:px-8 lg:pt-0 bg-[var(--bg-app-glass)] lg:bg-transparent backdrop-blur-xl lg:backdrop-blur-none border-b border-[var(--border-subtle)] lg:border-b-0 shrink-0">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-right">
            <h1 className="text-3xl font-black tracking-tight text-[var(--text-main)]">
              پروژه‌ها
            </h1>
            <p className="text-[var(--text-muted)] text-xs mt-1 font-bold font-sans">ایجاد تعادل و مدیریت اهداف بزرگ زندگی</p>
          </div>
          
          <button 
            onClick={openAddModal} 
            className="flex items-center gap-2 px-6 py-2.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] rounded-xl text-[var(--text-on-primary)] font-bold text-xs transition-all shadow-[0_0_15px_rgb(var(--color-primary-rgb)/0.3)] w-fit shrink-0 self-start md:self-auto"
          >
            <PlusIcon className="w-5 h-5 animate-pulse" />
            <span>پروژه جدید</span>
          </button>
        </div>
      </header>

      {/* Main Grid Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 pt-8 max-w-[1600px] mx-auto w-full scroll-fade-edge">
        {projects.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {projects.map(project => {
              const stats = calculateProjectStats(project.id, tasks);
              return (
                <ProjectCard 
                  key={project.id} 
                  project={project} 
                  stats={stats} 
                  onDelete={deleteProject} 
                  onEdit={setEditingProject} 
                  onView={setViewingProject} 
                />
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 flex flex-col items-center">
            <BriefcaseIcon className="w-14 h-14 mx-auto text-[var(--text-muted)] opacity-30 mb-4" />
            <h3 className="text-sm font-bold text-[var(--text-muted)]">پروژه‌ای پیدا نشد</h3>
            <p className="text-xs text-[var(--text-muted)] opacity-60 mt-2 max-w-sm leading-relaxed font-semibold">
              شما می‌توانید اهداف و کارهای بزرگ را تحت قالب پروژه‌ها دسته‌بندی و مدیریت کنید تا ذهن ساختاریافته‌تری داشته باشید.
            </p>
            <button 
              onClick={openAddModal} 
              className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-[var(--color-primary)] rounded-xl text-[var(--text-on-primary)] font-bold text-xs hover:bg-[var(--color-primary-hover)] transition-colors shadow-[0_0_15px_rgb(var(--color-primary-rgb)/0.3)]"
            >
              <PlusIcon className="w-4 h-4" />
              <span>ساخت اولین پروژه</span>
            </button>
          </div>
        )}
      </div>

      {/* --- Inline elegant Edit/Add Project Modal --- */}
      {editingProject && (
        <div 
          className="fixed inset-0 bg-black/40 dark:bg-black/70 backdrop-blur-md z-[60] flex justify-center items-end sm:items-center p-0 sm:p-4 transition-opacity duration-300" 
          onClick={() => setEditingProject(null)}
        >
          <div 
            onClick={e => e.stopPropagation()} 
            className="bg-[var(--bg-card)] border-t sm:border border-[var(--border-subtle)] w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col h-[100dvh] sm:h-auto animate-slide-up"
          >
            <div className="p-5 border-b border-[var(--border-subtle)] flex justify-between items-center bg-transparent shrink-0 pt-safe">
              <h3 className="text-base font-bold text-[var(--text-main)] font-sans">{isAdding ? 'پروژه جدید' : 'ویرایش پروژه'}</h3>
              <button 
                onClick={() => setEditingProject(null)} 
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-black/5 dark:hover:bg-white/5 rounded-xl transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto min-h-0 p-5 sm:p-6 space-y-4">
              <input 
                type="text" 
                value={editingProject.title || ''} 
                onChange={e => setEditingProject(s => s ? { ...s, title: e.target.value } : null)} 
                placeholder="عنوان پروژه..." 
                className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] px-4 py-3 rounded-xl text-sm font-semibold text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-all text-right" 
                autoFocus
              />
              <textarea 
                value={editingProject.description || ''} 
                onChange={e => setEditingProject(s => s ? { ...s, description: e.target.value } : null)} 
                placeholder="توضیحات و اهداف پروژه..." 
                rows={4} 
                className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] px-4 py-3 rounded-xl text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] min-h-[100px] resize-none transition-all text-right leading-relaxed" 
              />
              
              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] font-bold text-[var(--text-muted)]">اولویت پروژه:</span>
                <select 
                  value={editingProject.priority} 
                  onChange={e => setEditingProject(s => s ? { ...s, priority: e.target.value as Priority } : null)} 
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] p-3 rounded-xl text-xs font-bold text-[var(--text-main)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] transition-all text-right cursor-pointer"
                >
                  {Object.values(Priority).map(p => {
                    const label = priorityClasses[p]?.label || p;
                    return <option key={p} value={p} className="bg-[var(--bg-base)] text-[var(--text-main)]">{label}</option>;
                  })}
                </select>
              </div>

              <div className="space-y-3 pt-4">
                <span className="text-[11px] font-bold text-[var(--text-muted)] block">رنگ شناسه پروژه:</span>
                <div className="flex items-center gap-3 bg-black/10 dark:bg-white/5 p-3 rounded-xl border border-[var(--border-subtle)] justify-center">
                  {Object.keys(colorClasses).map(color => (
                    <button 
                      key={color} 
                      onClick={() => setEditingProject(s => s ? { ...s, color } : null)} 
                      className={`w-7 h-7 rounded-full ${colorClasses[color].solidBg} transition-all hover:scale-110 relative ${
                        editingProject.color === color ? 'ring-2 ring-offset-2 ring-offset-[var(--bg-base)] ring-white scale-110' : ''
                      }`}
                      aria-label={`Select color ${color}`}
                    >
                      {editingProject.color === color && (
                        <CheckIcon className="w-4 h-4 absolute inset-0 m-auto text-white shadow-sm" strokeWidth={3} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-[var(--border-subtle)] shrink-0 bg-transparent flex gap-3 pb-safe">
              <button 
                onClick={handleSaveProject} 
                className="flex-1 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-[var(--text-on-primary)] font-bold rounded-xl transition-all text-sm shadow-[0_0_15px_rgb(var(--color-primary-rgb)/0.3)]"
              >
                {isAdding ? 'اضافه کردن پروژه جدید' : 'ذخیره نهایی تغییرات'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Project Details Command Center Modal */}
      {viewingProject && (
        <ProjectDetailsModal 
          project={viewingProject} 
          tasks={tasks} 
          notes={notes} 
          isOpen={!!viewingProject} 
          onClose={() => setViewingProject(null)} 
          onEditTask={setEditingTask} 
          onEditNote={setEditingNote} 
        />
      )}
      
      {/* Item Editor Modals linking seamlessly */}
      {editingTask && (
        <TaskEditorModal 
          isOpen={!!editingTask} 
          task={editingTask} 
          projects={projects} 
          notes={notes} 
          onClose={() => setEditingTask(null)} 
          onSave={handleUpdateTask} 
          onDelete={deleteTask} 
        />
      )}
      {editingNote && (
        <NoteEditorModal 
          note={editingNote} 
          isOpen={!!editingNote} 
          projects={projects} 
          tasks={tasks} 
          allNotes={notes} 
          onClose={() => setEditingNote(null)} 
          onSave={handleSaveNote} 
          onDelete={deleteNote} 
        />
      )}
    </div>
  );
};

export default ProjectsView;
