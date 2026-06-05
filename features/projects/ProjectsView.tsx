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
    updateTask(task); 
    setEditingTask(null); 
  };
  
  const handleSaveNote = (note: Note | Partial<Note>) => {
    if ('id' in note) {
      updateNote(note as Note);
    }
    setEditingNote(null);
  };

  return (
    <div className="min-h-full pb-32 bg-slate-950 text-white relative flex flex-col h-full" dir="rtl">
      {/* Header Section */}
      <header className="sticky top-0 z-30 px-6 py-8 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 shrink-0">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-right">
            <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-sky-300">
              پروژه‌ها
            </h1>
            <p className="text-zinc-500 text-xs mt-1 font-bold font-sans">ایجاد تعادل و مدیریت اهداف بزرگ زندگی</p>
          </div>
          
          <button 
            onClick={openAddModal} 
            className="flex items-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-xl text-white font-bold text-xs transition-all shadow-lg shadow-sky-950/20 w-fit shrink-0 self-start md:self-auto"
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
            <BriefcaseIcon className="w-14 h-14 mx-auto text-zinc-800 mb-4" />
            <h3 className="text-sm font-bold text-zinc-400">پروژه‌ای پیدا نشد</h3>
            <p className="text-xs text-zinc-650 mt-2 max-w-sm leading-relaxed font-semibold">
              شما می‌توانید اهداف و کارهای بزرگ را تحت قالب پروژه‌ها دسته‌بندی و مدیریت کنید تا ذهن ساختاریافته‌تری داشته باشید.
            </p>
            <button 
              onClick={openAddModal} 
              className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-sky-600 rounded-xl text-white font-bold text-xs hover:bg-sky-500 transition-colors shadow-lg shadow-sky-950/20"
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
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex justify-center items-end sm:items-center p-0 sm:p-4 animate-fade-in" 
          onClick={() => setEditingProject(null)}
        >
          <div 
            onClick={e => e.stopPropagation()} 
            className="bg-slate-900 border-t sm:border border-slate-700/85 w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col h-[100dvh] sm:h-auto animate-slide-up"
          >
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-slate-900 shrink-0">
              <h3 className="text-base font-bold text-white font-sans">{isAdding ? 'پروژه جدید' : 'ویرایش پروژه'}</h3>
              <button 
                onClick={() => setEditingProject(null)} 
                className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
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
                className="w-full bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-xl text-sm font-semibold text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all text-right" 
                autoFocus
              />
              <textarea 
                value={editingProject.description || ''} 
                onChange={e => setEditingProject(s => s ? { ...s, description: e.target.value } : null)} 
                placeholder="توضیحات و اهداف پروژه..." 
                rows={4} 
                className="w-full bg-zinc-900 border border-zinc-800 px-4 py-3 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-sky-500 min-h-[100px] resize-none transition-all text-right leading-relaxed" 
              />
              
              <div className="space-y-1.5 pt-2">
                <span className="text-[11px] font-bold text-zinc-400">اولویت پروژه:</span>
                <select 
                  value={editingProject.priority} 
                  onChange={e => setEditingProject(s => s ? { ...s, priority: e.target.value as Priority } : null)} 
                  className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-xs font-bold text-zinc-200 focus:outline-none focus:ring-1 focus:ring-sky-500 transition-all text-right cursor-pointer"
                >
                  {Object.values(Priority).map(p => {
                    const label = priorityClasses[p]?.label || p;
                    return <option key={p} value={p} className="bg-slate-900">{label}</option>;
                  })}
                </select>
              </div>

              <div className="space-y-3 pt-4">
                <span className="text-[11px] font-bold text-zinc-400 block">رنگ شناسه پروژه:</span>
                <div className="flex items-center gap-3 bg-zinc-950/30 p-3 rounded-xl border border-white/5 justify-center">
                  {Object.keys(colorClasses).map(color => (
                    <button 
                      key={color} 
                      onClick={() => setEditingProject(s => s ? { ...s, color } : null)} 
                      className={`w-7 h-7 rounded-full ${colorClasses[color].solidBg} transition-all hover:scale-110 relative ${
                        editingProject.color === color ? 'ring-2 ring-offset-2 ring-offset-slate-900 ring-white scale-110' : ''
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

            <div className="p-5 border-t border-white/5 shrink-0 bg-slate-900 flex gap-3">
              <button 
                onClick={handleSaveProject} 
                className="flex-1 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition-all text-sm shadow-md shadow-sky-950/15"
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
