import React, { useState, useMemo } from 'react';
import { useData } from '../../contexts/DataContext';
import { Task, Priority, ViewMode } from '../../types';
import { 
  PlusIcon, ChevronDownIcon, ListChecksIcon, 
  CalendarIcon, BriefcaseIcon, FlagIcon, SearchIcon, XIcon 
} from '../../components/icons';
import { TaskCard } from './components/TaskCard';
import { TaskEditorModal } from './components/TaskEditorModal';
import { groupTasks } from '../../utils/taskGrouping';

const CollapsibleSection: React.FC<{ title: string; count: number; children: React.ReactNode }> = ({ title, count, children }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  if (count === 0) return null;

  return (
    <div className="border-t border-zinc-800/80 pt-2 mt-4">
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)} 
        className="w-full flex justify-between items-center px-1 py-2.5 text-xs font-bold text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <span>{title} ({count})</span>
        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-350 ${isCollapsed ? '' : 'rotate-180'}`} />
      </button>
      {!isCollapsed && (
        <div className="pt-2 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
};

export const TasksView: React.FC = () => {
  const { 
    tasks, 
    projects, 
    notes, 
    addTask, 
    updateTask, 
    toggleTaskCompletion, 
    deleteTask 
  } = useData();

  const [viewMode, setViewMode] = useState<'agenda' | 'project' | 'priority'>('agenda');
  const [editingTask, setEditingTask] = useState<Task | Partial<Task> | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSaveTask = (taskToSave: Task | Partial<Task>) => {
    if (!taskToSave.title?.trim()) {
      setEditingTask(null);
      return;
    }

    if ('id' in taskToSave && taskToSave.id) {
      updateTask(taskToSave);
    } else {
      const { title, description, due_date, priority, tags, project_id, checklist } = taskToSave as Partial<Task>;
      addTask({ 
        title: title || '', 
        description: description || null, 
        due_date: due_date || null, 
        priority: priority || Priority.Medium, 
        tags: tags || [], 
        project_id: project_id || null, 
        checklist: checklist || [] 
      });
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
    return groupTasks(filteredTasks, projects, viewMode);
  }, [filteredTasks, projects, viewMode]);

  const ViewModeButton: React.FC<{ mode: 'agenda' | 'project' | 'priority', label: string, icon: React.ReactNode }> = ({ mode, label, icon }) => (
    <button 
      onClick={() => setViewMode(mode)} 
      className={`flex items-center justify-center gap-2 p-2.5 rounded-lg transition-all w-full ${
        viewMode === mode 
          ? 'bg-sky-500/10 border border-sky-500/20 text-sky-450 shadow-sm' 
          : 'text-zinc-500 border border-transparent hover:bg-zinc-900 hover:text-zinc-300'
      }`}
    >
      {icon}
      <span className="text-xs font-bold font-sans">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-full bg-slate-950" dir="rtl">
      <header className="p-4 pt-8 sticky top-0 bg-slate-950/80 backdrop-blur-md z-10 border-b border-white/5 space-y-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-2xl font-black text-white pr-1">کارها</h1>
          <div className="relative w-full md:max-w-xs group">
            <input 
              type="text"
              placeholder="جستجو در کارها..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-10 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-500/50 transition-all font-medium text-xs text-right"
            />
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-sky-500/80 transition-colors">
              <SearchIcon className="w-4 h-4" />
            </div>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 left-3 flex items-center text-zinc-500 hover:text-white"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="p-1 bg-zinc-900/50 rounded-xl grid grid-cols-3 gap-1 border border-white/5">
          <ViewModeButton mode="agenda" label="دستور کار" icon={<CalendarIcon className="w-4 h-4"/>} />
          <ViewModeButton mode="project" label="پروژه" icon={<BriefcaseIcon className="w-4 h-4"/>} />
          <ViewModeButton mode="priority" label="اولویت" icon={<FlagIcon className="w-4 h-4"/>} />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 space-y-8 pb-32 pt-4 scroll-fade-edge">
        {groupedTasks.length > 0 ? (
          groupedTasks.map(group => (
            <div key={group.id} className="space-y-3">
              <h2 className="font-extrabold text-sm text-zinc-400 mb-2 border-r-2 border-sky-500 pr-2">
                {group.title}
              </h2>
              <div className="space-y-3">
                {group.active.map(task => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    onToggle={toggleTaskCompletion} 
                    onDelete={deleteTask} 
                    onEdit={setEditingTask} 
                  />
                ))}
              </div>
              <CollapsibleSection title="انجام‌شده‌ها" count={group.completed.length}>
                {group.completed
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map(task => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      onToggle={toggleTaskCompletion} 
                      onDelete={deleteTask} 
                      onEdit={setEditingTask} 
                    />
                  ))}
              </CollapsibleSection>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-zinc-500 pt-16">
            <ListChecksIcon className="w-12 h-12 text-zinc-800 mb-4" />
            <h3 className="text-sm font-bold text-zinc-400">
              {searchQuery ? 'نتیجه‌ای یافت نشد' : '🎉 عالیه! همه کارها انجام شده.'}
            </h3>
            <p className="text-xs text-zinc-600 mt-1 pb-4 leading-relaxed">
              {searchQuery ? 'عبارت دیگری را امتحان کنید.' : 'برای افزودن کار جدید، دکمه + پایین صفحه را بزنید.'}
            </p>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')} 
                className="text-xs text-sky-450 hover:text-sky-400 font-bold"
              >
                پاک کردن جستجو
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Floating Add Button */}
      <button 
        onClick={handleAddNewTask} 
        className="fixed bottom-24 right-5 w-14 h-14 bg-gradient-to-br from-sky-500 to-fuchsia-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-sky-500/20 hover:scale-105 transition-all duration-300 z-30" 
        aria-label="Add new task"
      >
        <PlusIcon className="w-7 h-7"/>
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
