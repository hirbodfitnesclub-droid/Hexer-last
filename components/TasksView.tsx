
import React, { useState, useMemo, useEffect } from 'react';
import { Task, Priority, Project, Note } from '../types';
import { PlusIcon, TrashIcon, ChevronDownIcon, ListChecksIcon, CalendarIcon, BriefcaseIcon, FlagIcon, LinkIcon, SearchIcon, XIcon } from './icons';
import TaskEditorModal from './TaskEditorModal';
import { formatPersianDate } from '../utils/dateUtils';

// --- Helper Functions & Constants ---
const getStartOfDay = (date: Date) => {
    const newDate = new Date(date);
    newDate.setHours(0, 0, 0, 0);
    return newDate;
};
const today = getStartOfDay(new Date());
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);

const priorityConfig = {
  [Priority.High]: { color: 'red', label: 'زیاد', bg: 'bg-red-500/10', text: 'text-red-300' },
  [Priority.Medium]: { color: 'yellow', label: 'متوسط', bg: 'bg-yellow-500/10', text: 'text-yellow-300' },
  [Priority.Low]: { color: 'sky', label: 'کم', bg: 'bg-sky-500/10', text: 'text-sky-300' },
};

type ViewMode = 'agenda' | 'project' | 'priority';

// --- Sub-components ---

interface TaskCardProps {
    task: Task & { project?: Project }; // Enriched task
    onToggle: (id: string) => void;
    onDelete: (id: string) => void;
    onEdit: (task: Task) => void;
}

const TaskCard: React.FC<TaskCardProps> = React.memo(({ task, onToggle, onDelete, onEdit }) => {
    const { color: priorityColor } = priorityConfig[task.priority] || priorityConfig[Priority.Medium];
    const [isAnimatingOut, setIsAnimatingOut] = useState(false);

    const handleToggle = () => {
        setIsAnimatingOut(true);
        setTimeout(() => {
            onToggle(task.id);
        }, 300);
    };

    const checklistTotal = task.checklist?.length || 0;
    const checklistCompleted = task.checklist?.filter(i => i.isCompleted).length || 0;
    
    return (
        <div 
            className={`flex items-start gap-3 transition-all duration-300 ${isAnimatingOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'} ${task.status === 'done' ? 'opacity-60' : ''}`}
        >
            <div className="pt-1.5">
                <button 
                    onClick={handleToggle} 
                    className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all duration-300 group ${task.status === 'done' ? `bg-${priorityColor}-500 border-${priorityColor}-500` : 'border-gray-600 hover:border-sky-400'}`}
                    aria-label={task.status === 'done' ? 'لغو انجام' : 'انجام تسک'}
                >
                     {task.status === 'done' && (
                        <svg className="w-4 h-4 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>
                     )}
                </button>
            </div>
            <div 
              onClick={() => onEdit(task)}
              className="flex-1 bg-gray-800/60 p-3.5 rounded-xl border border-white/10 group relative overflow-hidden cursor-pointer hover:bg-gray-800/80 transition-colors"
            >
                <p className={`font-medium transition-colors duration-300 break-words ${task.status === 'done' ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                    {task.title}
                </p>
                <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
                    {task.project && (
                         <div className="flex items-center gap-1.5">
                             <div className={`w-2 h-2 rounded-full bg-${task.project.color}-500`}></div>
                            <span>{task.project.title}</span>
                        </div>
                    )}
                    {task.due_date && (
                        <span>{formatPersianDate(task.due_date)}</span>
                    )}
                    {checklistTotal > 0 && (
                        <div className={`flex items-center gap-1.5 ${checklistCompleted === checklistTotal ? 'text-green-400' : 'text-gray-400'}`}>
                            <ListChecksIcon className="w-3.5 h-3.5" />
                            <span>{checklistCompleted}/{checklistTotal}</span>
                        </div>
                    )}
                </div>
                 <div className="absolute top-2 left-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button onClick={(e) => { e.stopPropagation(); onDelete(task.id); }} className="p-1.5 rounded-md bg-gray-700/50 hover:bg-gray-700 text-gray-400 hover:text-red-400">
                        <TrashIcon className="w-3.5 h-3.5"/>
                    </button>
                </div>
                <div className={`absolute top-0 right-0 h-full w-1 bg-${priorityColor}-500/50`}></div>
            </div>
        </div>
    );
});


const CollapsibleSection: React.FC<{ title: string; count: number; children: React.ReactNode }> = ({ title, count, children }) => {
    const [isCollapsed, setIsCollapsed] = useState(true);
    if (count === 0) return null;

    return (
        <div className="border-t border-white/10 pt-2 mt-4">
            <button onClick={() => setIsCollapsed(!isCollapsed)} className="w-full flex justify-between items-center px-1 py-2 text-sm text-gray-500 hover:text-white transition-colors">
                <span>{title} ({count})</span>
                <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`} />
            </button>
            {!isCollapsed && (
                <div className="pt-2 space-y-4">
                    {children}
                </div>
            )}
        </div>
    );
};

// --- Main View Component ---
interface TasksViewProps {
  tasks: Task[];
  projects: Project[];
  notes: Note[];
  toggleTaskCompletion: (id: string) => void;
  deleteTask: (id: string) => void;
  addTask: (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'completed_at'>) => void;
  updateTask: (task: Task) => void;
}

const TasksView: React.FC<TasksViewProps> = ({ tasks, projects, notes, addTask, updateTask, toggleTaskCompletion, deleteTask }) => {
    const [viewMode, setViewMode] = useState<ViewMode>('agenda');
    const [editingTask, setEditingTask] = useState<Task | Partial<Task> | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const handleSaveTask = (taskToSave: Task | Partial<Task>) => {
        if (!taskToSave.title?.trim()) {
            setEditingTask(null);
            return;
        }

        if ('id' in taskToSave && taskToSave.id) {
            updateTask(taskToSave as Task);
        } else {
            const { title, description, due_date, priority, tags, project_id, checklist } = taskToSave as Partial<Task>;
            addTask({ title: title || '', description, due_date, priority: priority || Priority.Medium, tags: tags || [], project_id, checklist });
        }
        setEditingTask(null);
    };
    
    const handleAddNewTask = () => {
        setEditingTask({
            title: '',
            description: '',
            priority: Priority.Medium,
            tags: [],
            status: 'todo',
            completed_at: null,
            checklist: []
        });
    };
    
    const projectMap = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
    
    type EnrichedTask = Task & { project?: Project };

    const filteredTasks = useMemo(() => {
        if (!searchQuery.trim()) return tasks;
        const query = searchQuery.toLowerCase();
        return tasks.filter(t => 
            t.title.toLowerCase().includes(query) ||
            (t.description && t.description.toLowerCase().includes(query)) ||
            (t.project_id && projectMap.get(t.project_id)?.title.toLowerCase().includes(query))
        );
    }, [tasks, searchQuery, projectMap]);

    const groupedTasks = useMemo(() => {
        const enrichedTasks: EnrichedTask[] = filteredTasks.map(t => ({...t, project: t.project_id ? projectMap.get(t.project_id) : undefined}));

        if (viewMode === 'agenda') {
            const groups: Record<string, { active: EnrichedTask[], completed: EnrichedTask[] }> = { 
                overdue: { active: [], completed: [] }, 
                today: { active: [], completed: [] }, 
                tomorrow: { active: [], completed: [] }, 
                upcoming: { active: [], completed: [] }, 
                noDate: { active: [], completed: [] } 
            };
            
            enrichedTasks.forEach(task => {
                let category = 'noDate';
                if (task.due_date) {
                    const taskDate = getStartOfDay(new Date(task.due_date));
                    if (taskDate.getTime() < today.getTime()) category = 'overdue';
                    else if (taskDate.getTime() === today.getTime()) category = 'today';
                    else if (taskDate.getTime() === tomorrow.getTime()) category = 'tomorrow';
                    else category = 'upcoming';
                }
                if (task.status === 'done') {
                    groups[category].completed.push(task);
                } else {
                    groups[category].active.push(task);
                }
            });

            return [
                { id: 'overdue', title: 'عقب‌افتاده', ...groups.overdue },
                { id: 'today', title: 'امروز', ...groups.today },
                { id: 'tomorrow', title: 'فردا', ...groups.tomorrow },
                { id: 'upcoming', title: 'آینده', ...groups.upcoming },
                { id: 'noDate', title: 'بدون تاریخ', ...groups.noDate },
            ].filter(g => g.active.length > 0 || g.completed.length > 0);
        }

        if (viewMode === 'project') {
             const groups: Record<string, { active: EnrichedTask[], completed: EnrichedTask[] }> = { 'no-project': { active: [], completed: [] } };
             projects.forEach(p => groups[p.id] = { active: [], completed: [] });
             
             enrichedTasks.forEach(task => {
                const key = task.project_id || 'no-project';
                if (!groups[key]) groups[key] = { active: [], completed: [] };
                if (task.status === 'done') {
                    groups[key].completed.push(task);
                } else {
                    groups[key].active.push(task);
                }
             });
             
             return [
                ...projects.map(p => ({ id: p.id, title: p.title, ...groups[p.id] })),
                { id: 'no-project', title: 'بدون پروژه', ...groups['no-project'] }
            ].filter(g => g.active.length > 0 || g.completed.length > 0);
        }

        if (viewMode === 'priority') {
            const groups: Record<string, { active: EnrichedTask[], completed: EnrichedTask[] }> = { 
                [Priority.High]: { active: [], completed: [] }, 
                [Priority.Medium]: { active: [], completed: [] }, 
                [Priority.Low]: { active: [], completed: [] } 
            };

            enrichedTasks.forEach(task => {
                if (task.status === 'done') {
                    groups[task.priority].completed.push(task);
                } else {
                    groups[task.priority].active.push(task);
                }
            });
            
            return [
                { id: Priority.High, title: 'اولویت زیاد', ...groups[Priority.High] },
                { id: Priority.Medium, title: 'اولویت متوسط', ...groups[Priority.Medium] },
                { id: Priority.Low, title: 'اولویت کم', ...groups[Priority.Low] },
            ].filter(g => g.active.length > 0 || g.completed.length > 0);
        }
        return [];

    }, [filteredTasks, projectMap, viewMode, projects]);

    const ViewModeButton: React.FC<{mode: ViewMode, label: string, icon: React.ReactNode}> = ({mode, label, icon}) => (
        <button onClick={() => setViewMode(mode)} className={`flex items-center justify-center gap-2 p-2 rounded-lg transition-colors w-full ${viewMode === mode ? 'bg-sky-500/20 text-sky-300' : 'text-gray-500 hover:bg-gray-800 hover:text-white'}`}>
             {icon}
            <span className="text-sm font-semibold">{label}</span>
        </button>
    );
    
    return (
        <div className="flex flex-col h-full">
            <header className="p-4 pt-8 sticky top-0 bg-gray-950/80 backdrop-blur-md z-10 border-b border-white/10 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h1 className="text-3xl font-bold text-white">کارها</h1>
                    <div className="relative w-full md:max-w-xs">
                        <input 
                            type="text"
                            placeholder="جستجو در کارها..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full bg-gray-800/70 border border-white/10 rounded-xl py-2 pr-10 pl-8 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 transition-all text-sm"
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-500">
                            <SearchIcon className="w-4 h-4" />
                        </div>
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 left-0 flex items-center pl-2 text-gray-500 hover:text-white"
                            >
                                <XIcon className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
                <div className="p-1 bg-gray-900/50 rounded-xl grid grid-cols-3 gap-1">
                    <ViewModeButton mode="agenda" label="دستور کار" icon={<CalendarIcon className="w-5 h-5"/>} />
                    <ViewModeButton mode="project" label="پروژه" icon={<BriefcaseIcon className="w-5 h-5"/>} />
                    <ViewModeButton mode="priority" label="اولویت" icon={<FlagIcon className="w-5 h-5"/>} />
                </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 space-y-8 pb-28 pt-4">
                {groupedTasks.length > 0 ? (
                    groupedTasks.map(group => (
                        <div key={group.id}>
                            <h2 className="font-bold text-lg text-gray-300 mb-4">{group.title}</h2>
                            <div className="space-y-4">
                                {group.active.map(task => (
                                    <TaskCard key={task.id} task={task} onToggle={toggleTaskCompletion} onDelete={deleteTask} onEdit={setEditingTask} />
                                ))}
                            </div>
                            <CollapsibleSection title="انجام‌شده‌ها" count={group.completed.length}>
                                {group.completed.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(task => (
                                     <TaskCard key={task.id} task={task} onToggle={toggleTaskCompletion} onDelete={deleteTask} onEdit={setEditingTask} />
                                ))}
                            </CollapsibleSection>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 pt-16">
                        <ListChecksIcon className="w-16 h-16 text-gray-700 mb-4" />
                        <h3 className="text-lg font-semibold text-gray-300">
                            {searchQuery ? 'نتیجه‌ای یافت نشد' : '🎉 عالیه! همه کارها انجام شده.'}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                            {searchQuery ? 'عبارت دیگری را امتحان کنید.' : 'برای افزودن کار جدید، دکمه + پایین صفحه را بزنید.'}
                        </p>
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="mt-4 text-sky-400 hover:text-sky-300 text-sm font-semibold">
                                پاک کردن جستجو
                            </button>
                        )}
                    </div>
                )}
            </div>
            
            <button onClick={handleAddNewTask} className="fixed bottom-24 right-6 w-16 h-16 bg-gradient-to-br from-sky-500 to-fuchsia-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-sky-500/30 hover:scale-110 transition-transform duration-300 z-30" aria-label="Add new task">
                <PlusIcon className="w-8 h-8"/>
            </button>
            
            {editingTask && (
                <TaskEditorModal
                    task={editingTask}
                    projects={projects}
                    notes={notes}
                    isOpen={!!editingTask}
                    onClose={() => setEditingTask(null)}
                    onSave={handleSaveTask}
                    onDelete={deleteTask}
                />
            )}
        </div>
    );
};

export default TasksView;
