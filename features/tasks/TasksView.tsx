import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useData } from '../../contexts/DataContext';
import { Task, Priority } from '../../types';
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
    <div className="border-t border-[var(--border-subtle)] pt-2 mt-4">
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)} 
        className="w-full flex justify-between items-center px-1 py-2.5 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
      >
        <span>{title} ({count})</span>
        <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`} />
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

  // Accordion state for projects grouping
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('expanded_projects_state');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('Error reading accordion state from localStorage:', e);
      return {};
    }
  });

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  // UX Optimization: Auto-expand the project's accordion when a new task is added
  const prevTasksRef = useRef<Task[]>(tasks);

  useEffect(() => {
    const previousTasks = prevTasksRef.current;
    if (previousTasks !== tasks) {
      const prevIds = new Set(previousTasks.map(t => t.id));
      const newlyAddedTask = tasks.find(t => !prevIds.has(t.id));

      if (newlyAddedTask) {
        const pId = newlyAddedTask.project_id || 'no-project';
        setExpandedProjects(prev => {
          if (!prev[pId]) {
            return {
              ...prev,
              [pId]: true
            };
          }
          return prev;
        });
      }
      prevTasksRef.current = tasks;
    }
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('expanded_projects_state', JSON.stringify(expandedProjects));
  }, [expandedProjects]);

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
          ? 'bg-primary/10 border border-[var(--border-neon)] text-[var(--color-primary)] shadow-sm' 
          : 'text-[var(--text-muted)] border border-transparent hover:bg-[var(--nav-hover-bg)] hover:text-[var(--text-main)]'
      }`}
    >
      {icon}
      <span className="text-xs font-bold font-sans">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-full text-[var(--text-main)]" dir="rtl">
      <header 
        className="p-4 pt-8 sticky top-0 pt-safe backdrop-blur-md z-10 border-b border-[var(--border-subtle)] space-y-4 shrink-0"
        style={{ background: 'var(--bg-app-glass)' }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-2xl font-black text-[var(--text-main)] pr-1">کارها</h1>
          <div className="relative w-full md:max-w-xs group">
            <input 
              type="text"
              placeholder="جستجو در کارها..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl py-2 px-10 text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--input-focus-ring)] transition-all font-medium text-xs text-right"
            />
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-[var(--text-muted)] group-focus-within:text-[var(--color-primary)] transition-colors">
              <SearchIcon className="w-4 h-4" />
            </div>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 left-3 flex items-center text-[var(--text-muted)] hover:text-[var(--text-main)]"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="p-1 bg-[var(--bg-card)] rounded-xl grid grid-cols-3 gap-1 border border-[var(--border-subtle)]">
          <ViewModeButton mode="agenda" label="دستور کار" icon={<CalendarIcon className="w-4 h-4"/>} />
          <ViewModeButton mode="project" label="پروژه" icon={<BriefcaseIcon className="w-4 h-4"/>} />
          <ViewModeButton mode="priority" label="اولویت" icon={<FlagIcon className="w-4 h-4"/>} />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-4 pt-4 scroll-fade-edge">
        {groupedTasks.length > 0 ? (
          groupedTasks.map(group => {
            if (viewMode === 'project') {
              const isExpanded = !!expandedProjects[group.id];
              const activeCount = group.active.length;
              const completedCount = group.completed.length;
              const totalCount = activeCount + completedCount;

              return (
                <div key={group.id} className="bg-[var(--bg-card)] backdrop-blur-xl border border-[var(--border-subtle)] rounded-[var(--radius-lg)] overflow-hidden transition-all duration-300">
                  {/* Accordion Header Button */}
                  <button
                    onClick={() => toggleProjectExpanded(group.id)}
                    className="w-full min-h-[48px] flex items-center justify-between px-4 py-3 hover:bg-[var(--nav-hover-bg)] transition-all text-right select-none"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-extrabold text-sm text-[var(--text-main)] truncate">{group.title}</span>
                      <span className="text-[11px] font-medium text-[var(--text-muted)] bg-[var(--bg-card)] border border-[var(--border-subtle)] px-2.5 py-0.5 rounded-full font-mono">
                        {activeCount} از {totalCount} فعال
                      </span>
                    </div>
                    <ChevronDownIcon 
                      className={`w-4 h-4 text-[var(--text-muted)] transition-transform duration-300 shrink-0 ${
                        isExpanded ? 'rotate-180' : ''
                      }`} 
                    />
                  </button>

                  {/* Accordion Content */}
                  {isExpanded && (
                    <div className="p-4 pt-2 space-y-4 border-t border-[var(--border-subtle)]">
                      {group.active.length > 0 ? (
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
                      ) : (
                        <p className="text-xs text-[var(--text-muted)] text-center py-2.5 leading-relaxed">کار فعالی در این پروژه وجود ندارد.</p>
                      )}

                      {group.completed.length > 0 && (
                        <CollapsibleSection title="انجام‌شده‌ها" count={group.completed.length}>
                          <div className="space-y-3">
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
                          </div>
                        </CollapsibleSection>
                      )}
                    </div>
                  )}
                </div>
              );
            }

            // Normal Group view (agenda & priority)
            return (
              <div key={group.id} className="space-y-3 pt-2">
                <h2 className="font-extrabold text-sm text-[var(--text-main)] mb-2 border-r-2 border-[var(--color-primary)] pr-2">
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
                {group.completed.length > 0 && (
                  <CollapsibleSection title="انجام‌شده‌ها" count={group.completed.length}>
                    <div className="space-y-3">
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
                    </div>
                  </CollapsibleSection>
                )}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-[var(--text-muted)] pt-16">
            <ListChecksIcon className="w-12 h-12 text-[var(--text-muted)] opacity-30 mb-4" />
            <h3 className="text-sm font-bold text-[var(--text-muted)]">
              {searchQuery ? 'نتیجه‌ای یافت نشد' : '🎉 عالیه! همه کارها انجام شده.'}
            </h3>
            <p className="text-xs text-[var(--text-muted)] opacity-60 mt-1 pb-4 leading-relaxed">
              {searchQuery ? 'عبارت دیگری را امتحان کنید.' : 'برای افزودن کار جدید، دکمه + پایین صفحه را بزنید.'}
            </p>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')} 
                className="text-xs text-[var(--color-primary)] hover:opacity-80 font-bold"
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
        className="fixed bottom-[calc(var(--bottom-nav-space)+var(--safe-area-inset-bottom)+1rem)] right-5 w-14 h-14 bg-lime rounded-full flex items-center justify-center text-[var(--text-on-primary)] shadow-[0_0_15px_rgb(var(--color-primary-rgb)/0.3)] hover:scale-105 transition-all duration-300 z-30" 
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
