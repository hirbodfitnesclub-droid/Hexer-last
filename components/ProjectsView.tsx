

import React, { useState, useEffect } from 'react';
import { Project, Priority, Task, Note } from '../types';
import { PlusIcon, TrashIcon, BriefcaseIcon, PencilIcon, XIcon, ListChecksIcon, NotebookIcon, LayoutGridIcon, ChevronDownIcon } from './icons';
import Modal from './Modal';
import TaskEditorModal from './TaskEditorModal';
import NoteEditorModal from './NoteEditorModal';

const colorClasses: { [key: string]: { bg: string; border: string; text: string; gradient: string; solidBg: string; } } = {
    sky:    { bg: 'bg-sky-500/10',    border: 'border-sky-500/50',    text: 'text-sky-300',    gradient: 'from-sky-500/20',    solidBg: 'bg-sky-500' },
    red:    { bg: 'bg-red-500/10',    border: 'border-red-500/50',    text: 'text-red-300',    gradient: 'from-red-500/20',    solidBg: 'bg-red-500' },
    green:  { bg: 'bg-green-500/10',  border: 'border-green-500/50',  text: 'text-green-300',  gradient: 'from-green-500/20',  solidBg: 'bg-green-500' },
    yellow: { bg: 'bg-yellow-500/10', border: 'border-yellow-500/50', text: 'text-yellow-300', gradient: 'from-yellow-500/20', solidBg: 'bg-yellow-500' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/50', text: 'text-purple-300', gradient: 'from-purple-500/20', solidBg: 'bg-purple-500' },
    gray:   { bg: 'bg-gray-500/10',   border: 'border-gray-500/50',   text: 'text-gray-300',   gradient: 'from-gray-500/20',   solidBg: 'bg-gray-500' },
};

const priorityClasses: { [key: string]: { text: string; label: string; bg: string; color: string; } } = {
    [Priority.High]: { text: 'text-red-300', label: 'زیاد', bg: 'bg-red-500/10', color: 'red' },
    [Priority.Medium]: { text: 'text-yellow-300', label: 'متوسط', bg: 'bg-yellow-500/10', color: 'yellow' },
    [Priority.Low]: { text: 'text-sky-300', label: 'کم', bg: 'bg-sky-500/10', color: 'sky' },
};


// --- New Project "Command Center" Modal ---
const ProjectDetailsModal: React.FC<{
    project: Project; tasks: Task[]; notes: Note[]; isOpen: boolean; onClose: () => void;
    onEditTask: (task: Task) => void; onEditNote: (note: Note) => void;
}> = ({ project, tasks, notes, isOpen, onClose, onEditTask, onEditNote }) => {
    const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'notes'>('overview');
    const [showCompleted, setShowCompleted] = useState(false);
    
    useEffect(() => {
      // Reset to overview tab when a new project is opened
      setActiveTab('overview');
      setShowCompleted(false);
    }, [project]);

    // FIX: Property 'projectId' does not exist on type 'Task'. Did you mean 'project_id'?
    const projectTasks = tasks.filter(t => t.project_id === project.id);
    // FIX: Property 'projectId' does not exist on type 'Note'. Did you mean 'project_id'?
    const projectNotes = notes.filter(n => n.project_id === project.id);
    // FIX: Property 'isCompleted' does not exist on type 'Task'.
    const activeTasks = projectTasks.filter(t => t.status !== 'done');
    // FIX: Property 'isCompleted' does not exist on type 'Task'.
    const completedTasks = projectTasks.filter(t => t.status === 'done');
    const progress = projectTasks.length > 0 ? Math.round((completedTasks.length / projectTasks.length) * 100) : 0;
    
    const colors = colorClasses[project.color] || colorClasses.gray;
    const priorityInfo = priorityClasses[project.priority] || priorityClasses[Priority.Medium];

    if (!isOpen) return null;
    
    const TabButton: React.FC<{
        label: string; count: number; isActive: boolean; onClick: () => void; icon: React.ReactNode;
    }> = ({ label, count, isActive, onClick, icon }) => (
        <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-2 p-3 text-sm font-semibold border-b-2 transition-colors duration-300 ${isActive ? `${colors.text} border-current` : 'text-gray-500 border-transparent hover:text-gray-200'}`}>
            {icon}
            <span>{label}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${isActive ? `${colors.bg} ${colors.text}` : 'bg-gray-700 text-gray-400'}`}>{count}</span>
        </button>
    );

    const ItemRow: React.FC<{onClick: () => void, children: React.ReactNode, icon: React.ReactNode}> = ({onClick, children, icon}) => (
        <button onClick={onClick} className="w-full group flex items-center gap-3 p-3 rounded-lg text-sm text-left text-gray-200 bg-gray-800/50 hover:bg-gray-800 transition-colors">
            {icon}
            <span className="flex-1 truncate">{children}</span>
            <PencilIcon className="w-4 h-4 text-gray-600 group-hover:text-sky-400 transition-colors" />
        </button>
    );

    return (
        <div onClick={onClose} className="fixed inset-0 bg-black/70 backdrop-blur-xl flex items-center justify-center z-50 p-2 sm:p-4 transition-opacity duration-300" style={{ opacity: isOpen ? 1 : 0 }}>
            <div onClick={e => e.stopPropagation()} className={`bg-gray-900/80 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[95vh] transition-transform duration-300 ${isOpen ? 'scale-100' : 'scale-95'}`}>
                <header className={`relative p-4 sm:p-5 border-b border-white/10 bg-gradient-to-br ${colors.gradient} to-transparent flex-shrink-0`}>
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-lg ${colors.solidBg} flex items-center justify-center flex-shrink-0`}>
                           <BriefcaseIcon className="w-7 h-7 text-white/80" />
                        </div>
                        <div>
                           <h2 className="text-xl sm:text-2xl font-bold text-white">{project.title}</h2>
                           <div className={`inline-flex mt-1.5 px-2 py-0.5 text-xs font-semibold rounded-md ${priorityInfo.bg} ${priorityInfo.text}`}>اولویت: {priorityInfo.label}</div>
                        </div>
                    </div>
                     <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-gray-500 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                        <XIcon className="w-5 h-5" />
                    </button>
                </header>

                <nav className="flex-shrink-0 border-b border-white/10 px-2 sm:px-4">
                    <div className="flex items-center">
                        <TabButton label="نمای کلی" count={0} icon={<LayoutGridIcon className="w-4 h-4"/>} isActive={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
                        <TabButton label="کارها" count={projectTasks.length} icon={<ListChecksIcon className="w-4 h-4"/>} isActive={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} />
                        <TabButton label="یادداشت‌ها" count={projectNotes.length} icon={<NotebookIcon className="w-4 h-4"/>} isActive={activeTab === 'notes'} onClick={() => setActiveTab('notes')} />
                    </div>
                </nav>
                
                <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                    {activeTab === 'overview' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="p-4 bg-gray-800/50 rounded-xl">
                                <div className="flex justify-between items-center text-xs text-gray-400 mb-2">
                                    <span>پیشرفت پروژه</span>
                                    <span className="font-semibold text-white">{progress}%</span>
                                </div>
                                <div className="w-full bg-gray-700/50 rounded-full h-2.5 overflow-hidden"><div className={`${colors.solidBg} h-full rounded-full transition-all duration-500`} style={{ width: `${progress}%` }}></div></div>
                                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10">
                                   <div className="text-center"><p className="text-2xl font-bold text-white">{activeTasks.length}</p><p className="text-xs text-gray-400">کارهای فعال</p></div>
                                   <div className="text-center"><p className="text-2xl font-bold text-white">{completedTasks.length}</p><p className="text-xs text-gray-400">انجام شده</p></div>
                                   <div className="text-center"><p className="text-2xl font-bold text-white">{projectNotes.length}</p><p className="text-xs text-gray-400">یادداشت‌ها</p></div>
                                </div>
                            </div>
                            {project.description && (
                                <div>
                                    <h3 className="text-base font-semibold text-gray-300 mb-2">توضیحات</h3>
                                    <p className="text-sm text-gray-400 bg-gray-800/50 p-3 rounded-lg whitespace-pre-wrap">{project.description}</p>
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === 'tasks' && (
                         <div className="space-y-4 animate-fade-in">
                            <h3 className="text-base font-semibold text-gray-300">کارهای فعال ({activeTasks.length})</h3>
                            {activeTasks.length > 0 ? activeTasks.map(t => {
                                const prioColor = priorityClasses[t.priority]?.color || 'sky';
                                const prioSolid = colorClasses[prioColor]?.solidBg || colors.solidBg;
                                return <ItemRow key={t.id} onClick={() => onEditTask(t)} icon={<div className={`w-2.5 h-2.5 rounded-full ${prioSolid}`}></div>}>{t.title}</ItemRow>
                            }) : <p className="text-gray-500 text-sm text-center py-4">کارهای فعال تمام شده‌اند!</p>}
                           
                           {completedTasks.length > 0 && (
                               <div className="pt-2">
                                    <button onClick={() => setShowCompleted(!showCompleted)} className="w-full flex justify-between items-center px-1 py-1 text-xs text-gray-500 hover:text-white transition-colors">
                                        <span>انجام‌شده ({completedTasks.length})</span>
                                        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${!showCompleted ? '' : 'rotate-180'}`} />
                                    </button>
                                    {showCompleted && <div className="pt-2 space-y-2">
                                        {completedTasks.map(t => <ItemRow key={t.id} onClick={() => onEditTask(t)} icon={<ListChecksIcon className="w-4 h-4 text-green-400" />}>{t.title}</ItemRow>)}
                                    </div>}
                               </div>
                           )}
                        </div>
                    )}
                    {activeTab === 'notes' && (
                         <div className="space-y-2 animate-fade-in">
                            {projectNotes.length > 0 ? projectNotes.map(n => <ItemRow key={n.id} onClick={() => onEditNote(n)} icon={<NotebookIcon className="w-4 h-4 text-purple-400" />}>{n.title}</ItemRow>) : <p className="text-gray-500 text-sm text-center py-4">یادداشتی برای این پروژه ثبت نشده است.</p>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}


// --- Project Card ---
const ProjectCard: React.FC<{
    project: Project;
    stats: { progress: number; activeTasks: number; };
    onDelete: (id: string) => void;
    onEdit: (project: Project) => void;
    onView: (project: Project) => void;
}> = ({ project, stats, onDelete, onEdit, onView }) => {
    const colors = colorClasses[project.color] || colorClasses.gray;
    const priority = priorityClasses[project.priority] || priorityClasses[Priority.Medium];
    
    return (
        <div 
            onClick={() => onView(project)}
            className="bg-gray-800/50 rounded-2xl border border-white/10 overflow-hidden cursor-pointer transition-all duration-300 hover:border-white/20 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-1"
        >
            <div className={`h-2 ${colors.solidBg}`}></div>
            <div className="p-5">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-lg text-white">{project.title}</h3>
                         <div className={`inline-flex items-center gap-2 mt-2 px-2 py-1 text-xs rounded-md ${priority.bg} ${priority.text}`}>
                            اولویت {priority.label}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 -mr-2 -mt-2">
                        <button onClick={(e) => { e.stopPropagation(); onEdit(project); }} className="p-2 text-gray-400 hover:text-sky-400 hover:bg-white/5 rounded-md transition-colors">
                            <PencilIcon className="w-5 h-5"/>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(project.id); }} className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-md transition-colors">
                            <TrashIcon className="w-5 h-5"/>
                        </button>
                    </div>
                </div>
                
                <p className="text-sm text-gray-400 mt-3 line-clamp-2 min-h-[40px]">{project.description}</p>

                <div className="mt-4">
                    <div className="flex justify-between items-center text-xs text-gray-400 mb-1">
                        <span>پیشرفت</span>
                        <span className="font-semibold text-white">{stats.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                        <div className={`h-2 rounded-full ${colors.solidBg} transition-all duration-500`} style={{ width: `${stats.progress}%` }}></div>
                    </div>
                     <div className="flex items-center gap-2 text-xs text-gray-400 mt-2">
                        <ListChecksIcon className="w-3.5 h-3.5" />
                        <span>{stats.activeTasks > 0 ? `${stats.activeTasks} کار باقی مانده` : 'تمام کارها انجام شده!'}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- Main View ---
interface ProjectsViewProps {
  projects: Project[];
  tasks: Task[];
  notes: Note[];
  addProject: (project: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => void;
  updateProject: (project: Project) => void;
  deleteProject: (id: string) => void;
  updateTask: (task: Task) => void;
  deleteTask: (id: string) => void;
  updateNote: (note: Note) => void;
  deleteNote: (id: string) => void;
  editingProject: Partial<Project> | null;
  setEditingProject: React.Dispatch<React.SetStateAction<Partial<Project> | null>>;
}

const calculateProjectStats = (projectId: string, tasks: Task[]) => {
    // FIX: Property 'projectId' does not exist on type 'Task'. Did you mean 'project_id'?
    const projectTasks = tasks.filter(t => t.project_id === projectId);
    if (projectTasks.length === 0) return { progress: 0, activeTasks: 0 };
    
    // FIX: Property 'isCompleted' does not exist on type 'Task'.
    const completedTasks = projectTasks.filter(t => t.status === 'done').length;
    const progress = Math.round((completedTasks / projectTasks.length) * 100);
    const activeTasks = projectTasks.length - completedTasks;
    
    return { progress, activeTasks };
};

const ProjectsView: React.FC<ProjectsViewProps> = ({ projects, tasks, notes, addProject, updateProject, deleteProject, updateTask, deleteTask, updateNote, deleteNote, editingProject, setEditingProject }) => {
    const [viewingProject, setViewingProject] = useState<Project | null>(null);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [editingNote, setEditingNote] = useState<Note | null>(null);
    const isAdding = editingProject ? !('id' in editingProject) : false;

    const openAddModal = () => {
        setEditingProject({ title: '', color: 'sky', description: '', priority: Priority.Medium });
    };

    const handleSaveProject = () => {
        if (!editingProject || !editingProject.title?.trim()) return;
        if (isAdding) { addProject(editingProject as Omit<Project, 'id' | 'created_at' | 'updated_at' | 'user_id'>); } 
        else { updateProject(editingProject as Project); }
        setEditingProject(null);
    };

    const handleUpdateTask = (task: Task) => { updateTask(task); setEditingTask(null); };
    const handleUpdateNote = (note: Note) => { 
        updateNote(note); 
        setEditingNote(null); 
    };
    const handleSaveNote = (note: Note | Partial<Note>) => {
        if ('id' in note) {
            updateNote(note as Note);
        }
        setEditingNote(null);
    }


  return (
    <div className="p-4 pt-8 pb-28">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">پروژه‌ها</h1>
        <button onClick={openAddModal} className="flex items-center gap-2 px-4 py-2 bg-sky-500 rounded-lg text-white font-semibold hover:bg-sky-600 transition-colors">
            <PlusIcon className="w-5 h-5" />
            <span>پروژه جدید</span>
        </button>
      </header>
      
       {projects.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {projects.map(project => {
                    const stats = calculateProjectStats(project.id, tasks);
                    return (<ProjectCard key={project.id} project={project} stats={stats} onDelete={deleteProject} onEdit={setEditingProject} onView={setViewingProject} />)
                })}
            </div>
        ) : (
            <div className="text-center py-16 flex flex-col items-center">
                <BriefcaseIcon className="w-16 h-16 mx-auto text-gray-700 mb-4" />
                <h3 className="text-lg font-semibold text-gray-400">اولین پروژه خود را شروع کنید</h3>
                <p className="text-gray-500 mt-2 max-w-sm">پروژه‌ها به شما کمک می‌کنند تا کارهای بزرگ و مرتبط را در یک مکان سازماندهی کنید.</p>
                 <button onClick={openAddModal} className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-sky-600 rounded-lg text-white font-semibold hover:bg-sky-700 transition-colors shadow-lg shadow-sky-900/40">
                    <PlusIcon className="w-5 h-5" />
                    <span>ساخت اولین پروژه</span>
                </button>
            </div>
      )}

      {/* --- Edit/Add Project Modal --- */}
      <Modal title={isAdding ? "پروژه جدید" : "ویرایش پروژه"} isOpen={!!editingProject} onClose={() => setEditingProject(null)}>
        {editingProject && (
            <div className="space-y-4">
                <input type="text" value={editingProject.title || ''} onChange={e => setEditingProject(s => s ? { ...s, title: e.target.value } : null)} placeholder="نام پروژه" className="w-full bg-gray-700/80 p-3 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                <textarea value={editingProject.description || ''} onChange={e => setEditingProject(s => s ? { ...s, description: e.target.value } : null)} placeholder="توضیحات پروژه..." rows={4} className="w-full bg-gray-700/80 p-3 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                <select value={editingProject.priority} onChange={e => setEditingProject(s => s ? { ...s, priority: e.target.value as Priority } : null)} className="w-full bg-gray-700/80 p-3 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500">
                    {Object.values(Priority).map(p => {
                         const label = priorityClasses[p]?.label || p;
                         return <option key={p} value={p}>{label}</option>
                    })}
                </select>
                <div className="flex items-center gap-2 pt-2">
                    <span className="text-sm text-gray-400">رنگ:</span>
                     {Object.keys(colorClasses).map(color => (<button key={color} onClick={() => setEditingProject(s => s ? { ...s, color } : null)} className={`w-6 h-6 rounded-full ${colorClasses[color].solidBg} transition-transform hover:scale-110 ${editingProject.color === color ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-white' : ''}`}></button>))}
                </div>
                <button onClick={handleSaveProject} className="w-full p-3 bg-sky-500 rounded-lg text-white font-semibold mt-4">{isAdding ? 'افزودن پروژه' : 'ذخیره تغییرات'}</button>
            </div>
        )}
      </Modal>
      
      {/* --- View Details Modal --- */}
      {viewingProject && (
          <ProjectDetailsModal project={viewingProject} tasks={tasks} notes={notes} isOpen={!!viewingProject} onClose={() => setViewingProject(null)} onEditTask={setEditingTask} onEditNote={setEditingNote} />
      )}
      
      {/* --- Item Editor Modals --- */}
      {editingTask && (
          <TaskEditorModal isOpen={!!editingTask} task={editingTask} projects={projects} notes={notes} onClose={() => setEditingTask(null)} onSave={handleUpdateTask} onDelete={deleteTask} />
      )}
      {editingNote && (
          <NoteEditorModal note={editingNote} isOpen={!!editingNote} projects={projects} tasks={tasks} allNotes={notes} onClose={() => setEditingNote(null)} onSave={handleSaveNote} onDelete={deleteNote} />
      )}

    </div>
  );
};

export default ProjectsView;