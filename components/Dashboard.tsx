

import React, { useMemo, useState } from 'react';
import { Task, Note, Priority, Project, Habit } from '../types';
import { PlusIcon, ListChecksIcon, BriefcaseIcon, CheckIcon, FlameIcon, NotebookIcon, UserIcon, LogOutIcon, BellIcon, MoonIcon, ShieldIcon, XIcon } from './icons';
import { useAuth } from '../contexts/AuthContext';
import { User } from '@supabase/supabase-js';
import { formatPersianDate, toJalaali, persianMonths } from '../utils/dateUtils';
import ProfileModal from './ProfileModal';

interface DashboardProps {
  tasks: Task[];
  notes: Note[];
  projects: Project[];
  habits: Habit[];
  toggleHabitCompletion: (habitId: string, date: string) => void;
  toggleTaskCompletion: (taskId: string) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  addTask: (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'completed_at'>) => void;
  addNote: (note: Omit<Note, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void;
  editHabit: (habit: Habit | Partial<Habit>) => void;
  subscription?: any;
  profile?: any;
  onTriggerUpgrade?: () => void;
}

// --- Helper Functions ---
const getDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
};

const getCustomDayName = (date: Date) => {
    const dayIndex = date.getDay(); // 0 = Sunday, 6 = Saturday
    switch (dayIndex) {
        case 6: return 'شنبه';
        case 0: return 'یک';
        case 1: return 'دو';
        case 2: return 'سه';
        case 3: return 'چهار';
        case 4: return 'پنج';
        case 5: return 'جمعه';
        default: return '';
    }
};

// --- Generic Widget Wrapper ---
const Widget: React.FC<{children: React.ReactNode, className?: string}> = ({ children, className }) => (
  <div className={`bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl shadow-black/30 ${className}`}>
    {children}
  </div>
);

// --- Header Component (Hexer Style with Neon Progress Ring) ---
const DashboardHeader: React.FC<{ user: User | null; onOpenProfile: () => void; todayProgress: number; hasTasksToday: boolean }> = ({ user, onOpenProfile, todayProgress, hasTasksToday }) => {
    // Circle Config
    // Avatar is w-10 (40px). 
    // We want the ring to be tight.
    // SVG Size: 44px
    // Stroke: 3px
    // Inner Radius: (44/2) - 3 + (some center logic) -> effectively radius of path is 20.5. Inner edge is 19px.
    // Avatar Outer Radius: 20px.
    // 1px Overlap -> Perfect "no gap" fit.
    const size = 44; 
    const strokeWidth = 3; 
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (todayProgress / 100) * circumference;
    
    // Determining color based on progress
    // If no tasks: gray. If 100%: Green/Gold Neon. Else: Purple/Blue Neon.
    const isComplete = hasTasksToday && todayProgress === 100;
    
    return (
        <header className="sticky top-0 z-50 w-full bg-gray-950/80 backdrop-blur-xl border-b border-white/10 transition-all duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                {/* Right Side: Profile & Greeting (RTL Start) */}
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onOpenProfile}
                        className="relative group flex items-center justify-center"
                        style={{ width: size, height: size }}
                        aria-label="پروفایل کاربری"
                    >
                        {/* Neon Progress Ring SVG */}
                        <svg 
                            className="absolute inset-0 transform -rotate-90 overflow-visible" 
                            width={size} 
                            height={size}
                            style={{ filter: isComplete ? 'drop-shadow(0 0 4px rgba(34,197,94,0.6))' : 'drop-shadow(0 0 4px rgba(168,85,247,0.6))' }}
                        >
                            {/* Track */}
                            <circle
                                cx={size / 2}
                                cy={size / 2}
                                r={radius}
                                stroke="rgba(255,255,255,0.1)"
                                strokeWidth={strokeWidth}
                                fill="none"
                            />
                            {/* Progress */}
                            {hasTasksToday && (
                                <>
                                    <defs>
                                        <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                            <stop offset="0%" stopColor={isComplete ? "#4ade80" : "#a855f7"} />
                                            <stop offset="100%" stopColor={isComplete ? "#22c55e" : "#3b82f6"} />
                                        </linearGradient>
                                    </defs>
                                    <circle
                                        cx={size / 2}
                                        cy={size / 2}
                                        r={radius}
                                        stroke="url(#neonGradient)"
                                        strokeWidth={strokeWidth}
                                        fill="none"
                                        strokeDasharray={circumference}
                                        strokeDashoffset={offset}
                                        strokeLinecap="round"
                                        style={{ 
                                            transition: 'stroke-dashoffset 1s ease-out',
                                        }}
                                    />
                                </>
                            )}
                        </svg>

                        {/* Avatar - w-10 = 40px */}
                        <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden relative z-10 border border-gray-800">
                            {user?.email?.[0].toUpperCase() || <UserIcon className="w-5 h-5"/>}
                            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        </div>
                    </button>
                    
                    <div className="flex flex-col justify-center">
                        <span className="text-white font-bold text-sm sm:text-base leading-none">سلام رفیق</span>
                        <span className="text-gray-400 text-[10px] font-medium mt-1 leading-none">
                            {hasTasksToday 
                                ? (isComplete ? 'همه کارها تموم شد! 🎉' : `${todayProgress}% کارهای امروز`) 
                                : 'امروز برنامه‌ای نیست'}
                        </span>
                    </div>
                </div>

                {/* Left Side: Brand (RTL End) */}
                <div>
                     <h1 className="text-xl sm:text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-purple-500 to-fuchsia-500 select-none">
                        HEXER
                    </h1>
                </div>
            </div>
        </header>
    );
};

// --- Calendar ---
const WeekCalendar: React.FC<{ selectedDate: Date; onDateChange: (date: Date) => void; }> = ({ selectedDate, onDateChange }) => {
    const weekDays = useMemo(() => {
        const days = [];
        const today = new Date();
        const startOfWeek = new Date(selectedDate);
        startOfWeek.setDate(startOfWeek.getDate() - 3);

        for (let i = 0; i < 7; i++) {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            days.push({
                date,
                isToday: isSameDay(date, today),
                isSelected: isSameDay(date, selectedDate),
                dayName: getCustomDayName(date),
                dayNumber: date.toLocaleDateString('fa-IR', { day: 'numeric' }),
            });
        }
        return days;
    }, [selectedDate]);

    const headerInfo = useMemo(() => {
        const j = toJalaali(selectedDate);
        return `${persianMonths[j.jm - 1]} ${j.jy}`;
    }, [selectedDate]);

    return (
        <div className="space-y-4">
             {/* Header Info (Month Year) */}
            <div className="flex items-center justify-center mb-2">
                <span className="text-xs font-bold text-gray-400 tracking-wide bg-gray-800/40 px-3 py-1 rounded-full border border-white/5">{headerInfo}</span>
            </div>
            
            <div className="grid grid-cols-7 gap-2">
                {weekDays.map(({ date, isSelected, dayNumber, dayName, isToday }) => (
                    <button
                        key={date.toISOString()}
                        onClick={() => onDateChange(date)}
                        className={`
                            group relative flex flex-col items-center justify-between p-1 rounded-[1.2rem] transition-all duration-300
                            ${isSelected 
                                ? 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-purple-500/30 scale-105 z-10' 
                                : 'bg-gray-800/40 border border-white/5 hover:bg-gray-800'}
                        `}
                        style={{ height: '4.5rem' }}
                    >
                        {/* Top: Day Name */}
                        <span className={`text-[9px] sm:text-[10px] font-medium mt-1 ${isSelected ? 'text-white/90' : 'text-gray-500 group-hover:text-gray-400'}`}>
                            {dayName}
                        </span>

                        {/* Bottom: Number Container (Nested Box) */}
                        <div className={`
                            w-full flex-1 flex flex-col items-center justify-center rounded-xl mt-1
                            ${isSelected ? 'bg-black/10 backdrop-blur-sm' : 'bg-gray-900/30'}
                        `}>
                            <span className={`text-base sm:text-lg font-bold leading-none ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                {dayNumber}
                            </span>
                            
                            {/* Dot for today - positioned inside the inner container */}
                            {isToday && (
                                <div className={`w-1 h-1 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-sky-500'}`}></div>
                            )}
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

// --- New Dashboard Widgets ---

const TodaysPlan: React.FC<{
  tasks: Task[];
  selectedDate: Date;
  toggleTaskCompletion: (id: string) => void;
}> = ({ tasks, selectedDate, toggleTaskCompletion }) => {
    const todaysTasks = useMemo(() => {
        const selectedDateStr = getDateString(selectedDate);
        return tasks.filter(t => t.due_date && t.due_date.startsWith(selectedDateStr))
                    .sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0));
    }, [tasks, selectedDate]);

    return (
        <Widget>
            <h2 className="text-lg font-bold text-white mb-4">برنامه امروز</h2>
            {todaysTasks.length > 0 ? (
                <div className="max-h-64 overflow-y-auto pr-2 space-y-3">
                    {todaysTasks.map(task => (
                        <div key={task.id} className={`flex items-center gap-3 transition-opacity ${task.status === 'done' ? 'opacity-50' : ''}`}>
                            <button
                                onClick={() => toggleTaskCompletion(task.id)}
                                className={`w-5 h-5 flex-shrink-0 rounded-md border-2 flex items-center justify-center transition-all duration-300 ${task.status === 'done' ? 'bg-sky-500 border-sky-400' : 'border-gray-600 hover:border-sky-500'}`}
                                aria-label={task.status === 'done' ? `لغو انجام ${task.title}` : `انجام ${task.title}`}
                            >
                                {task.status === 'done' && <CheckIcon className="w-3.5 h-3.5 text-white"/>}
                            </button>
                            <span className={`flex-1 text-sm ${task.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-200'}`}>{task.title}</span>
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${task.priority === Priority.High ? 'bg-red-400' : task.priority === Priority.Medium ? 'bg-yellow-400' : 'bg-sky-400'}`}></div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-10 text-gray-500 text-sm">
                    <ListChecksIcon className="w-10 h-10 mx-auto mb-2 text-gray-600" />
                    <p>در این تاریخ کاری ثبت نشده است.</p>
                </div>
            )}
        </Widget>
    );
};

const TodaysNotes: React.FC<{ notes: Note[]; selectedDate: Date }> = ({ notes, selectedDate }) => {
    const todaysNotes = useMemo(() => {
        return notes.filter(n => isSameDay(new Date(n.created_at), selectedDate));
    }, [notes, selectedDate]);

    return (
        <div className="bg-black/30 rounded-2xl p-4 shadow-inner ring-1 ring-black/20 flex gap-4 h-40">
            <div className="flex-shrink-0 flex flex-col items-center justify-center w-20 text-center text-gray-400 border-l border-white/10 pr-2">
                <NotebookIcon className="w-10 h-10 mb-2" />
                <span className="text-xs font-semibold">یادداشت ها</span>
            </div>
            <div className="flex-1 overflow-hidden flex items-center">
                {todaysNotes.length > 0 ? (
                    <div className="flex gap-3 overflow-x-auto pb-2 -mb-2 w-full">
                        {todaysNotes.map(note => (
                            <div key={note.id} className="w-48 h-28 flex-shrink-0 bg-gray-800/60 p-3 rounded-lg border border-white/5 flex flex-col">
                                <h4 className="font-semibold text-sm text-gray-200 truncate">{note.title}</h4>
                                <p className="text-xs text-gray-400 mt-1 line-clamp-3 flex-1">{note.content}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center justify-center w-full">
                        <p className="text-gray-600 text-sm">امروز یادداشتی ثبت نشده.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const QuickCapture: React.FC<{
    onAddTask: (task: Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'completed_at'>) => void;
    onAddNote: (note: Omit<Note, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => void;
    selectedDate: Date;
}> = ({ onAddTask, onAddNote, selectedDate }) => {
    const [input, setInput] = useState('');

    const handleAction = (type: 'task' | 'note') => {
        if (!input.trim()) return;
        if (type === 'task') {
            onAddTask({
                title: input,
                priority: Priority.Medium,
                tags: [],
                due_date: getDateString(selectedDate),
            });
        } else {
            onAddNote({
                title: `یادداشت سریع: ${input.substring(0, 20)}`,
                content: input,
                tags: ['سریع']
            });
        }
        setInput('');
    };

    return (
        <Widget>
            <h2 className="text-lg font-bold text-white mb-3">ثبت سریع</h2>
            <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="یک ایده، فکر یا وظیفه را سریع ثبت کن..."
                className="w-full bg-gray-800/70 p-3 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 h-20"
            />
            <div className="grid grid-cols-2 gap-3 mt-3">
                <button onClick={() => handleAction('task')} disabled={!input.trim()} className="flex items-center justify-center gap-2 w-full p-2.5 bg-sky-600/80 rounded-lg text-white font-semibold hover:bg-sky-600 transition-colors disabled:bg-gray-600 disabled:opacity-50">
                    <ListChecksIcon className="w-5 h-5"/> <span>ثبت کار</span>
                </button>
                 <button onClick={() => handleAction('note')} disabled={!input.trim()} className="flex items-center justify-center gap-2 w-full p-2.5 bg-purple-600/80 rounded-lg text-white font-semibold hover:bg-purple-600 transition-colors disabled:bg-gray-600 disabled:opacity-50">
                    <NotebookIcon className="w-5 h-5"/> <span>ثبت یادداشت</span>
                </button>
            </div>
        </Widget>
    );
};

const StatsOverview: React.FC<{ tasks: Task[], projects: Project[] }> = ({ tasks, projects }) => {
    const stats = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const overdue = tasks.filter(t => t.status !== 'done' && t.due_date && new Date(t.due_date).setHours(0,0,0,0) < today.getTime()).length;
        const highPriorityProjects = projects.filter(p => p.priority === Priority.High).length;
        const completedToday = tasks.filter(t => t.status === 'done' && t.due_date && isSameDay(new Date(t.due_date), new Date())).length;
        const inbox = tasks.filter(t => t.status !== 'done' && !t.due_date).length;
        return { overdue, highPriorityProjects, completedToday, inbox };
    }, [tasks, projects]);

    const StatCard: React.FC<{ icon: React.ReactNode; value: number; label: string; colorClass: string }> = ({ icon, value, label, colorClass }) => (
        <div className="bg-gray-800/70 p-4 rounded-xl flex items-center gap-4">
            <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg ${colorClass}`}>
                {icon}
            </div>
            <div>
                <span className="text-2xl font-bold text-white">{value}</span>
                <p className="text-xs text-gray-400">{label}</p>
            </div>
        </div>
    );
    
    return (
        <Widget>
            <h2 className="text-lg font-bold text-white mb-4">در یک نگاه</h2>
            <div className="grid grid-cols-2 gap-3">
                <StatCard icon={<FlameIcon className="w-5 h-5"/>} value={stats.overdue} label="عقب افتاده" colorClass="bg-red-500/20 text-red-300"/>
                <StatCard icon={<BriefcaseIcon className="w-5 h-5"/>} value={stats.highPriorityProjects} label="پروژه مهم" colorClass="bg-yellow-500/20 text-yellow-300"/>
                <StatCard icon={<CheckIcon className="w-5 h-5"/>} value={stats.completedToday} label="انجام شده امروز" colorClass="bg-green-500/20 text-green-300"/>
                <StatCard icon={<PlusIcon className="w-5 h-5"/>} value={stats.inbox} label="بدون تاریخ" colorClass="bg-gray-500/20 text-gray-300"/>
            </div>
        </Widget>
    );
};

const HabitTracker: React.FC<{
    habits: Habit[];
    onToggle: (id: string, date: string) => void;
    onEdit: (habit: Habit) => void;
    onCreate: () => void;
    selectedDate: Date;
}> = ({ habits, onToggle, onEdit, onCreate, selectedDate }) => {
    const selectedDateString = getDateString(selectedDate);

    return (
         <Widget>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-white">رهگیر عادت‌ها</h2>
                <button onClick={onCreate} className="p-1.5 bg-orange-600/20 text-orange-400 hover:bg-orange-600/40 hover:text-orange-200 rounded-lg transition-colors">
                    <PlusIcon className="w-4 h-4"/>
                </button>
            </div>
            
            {habits.length > 0 ? (
                <div className="space-y-2">
                    {habits.map(habit => {
                        const isCompleted = habit.completedDates.includes(selectedDateString);
                        return (
                            <div key={habit.id} className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${isCompleted ? 'bg-green-500/20' : 'bg-gray-800/70 hover:bg-gray-800'}`}>
                                <button 
                                    onClick={() => onToggle(habit.id, selectedDateString)}
                                    className={`w-6 h-6 flex-shrink-0 rounded-md flex items-center justify-center border-2 transition-all duration-300 ${isCompleted ? 'bg-green-500 border-green-400' : 'border-gray-600 hover:border-orange-500'}`}
                                >
                                    {isCompleted && <CheckIcon className="w-4 h-4 text-white"/>}
                                </button>
                                <button onClick={() => onEdit(habit)} className={`text-sm flex-1 text-right transition-colors duration-300 ${isCompleted ? 'text-green-300 line-through decoration-white/50' : 'text-gray-300 hover:text-white'}`}>
                                    {habit.name}
                                </button>
                            </div>
                        )
                    })}
                </div>
            ) : (
                <div className="text-center py-6 text-gray-500 text-sm flex flex-col items-center">
                    <FlameIcon className="w-8 h-8 text-gray-700 mb-2"/>
                    <p>هیچ عادتی ثبت نشده.</p>
                    <button onClick={onCreate} className="mt-2 text-xs text-orange-400 hover:text-orange-300 font-semibold">ساخت عادت جدید</button>
                </div>
            )}
        </Widget>
    );
};

const KeyProjects: React.FC<{ projects: Project[]; tasks: Task[] }> = ({ projects, tasks }) => {
    const highPriorityProjects = useMemo(() => {
        return projects
            .filter(p => p.priority === Priority.High)
            .map(p => {
                const projectTasks = tasks.filter(t => t.project_id === p.id);
                const completed = projectTasks.filter(t => t.status === 'done').length;
                const progress = projectTasks.length > 0 ? Math.round((completed / projectTasks.length) * 100) : 0;
                return { ...p, progress, remaining: projectTasks.length - completed };
            })
            .slice(0, 3);
    }, [projects, tasks]);
    
    if (highPriorityProjects.length === 0) return null;

    return (
        <Widget>
            <h2 className="text-lg font-bold text-white mb-4">پروژه‌های کلیدی</h2>
            <div className="space-y-4">
                {highPriorityProjects.map(p => (
                    <div key={p.id}>
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="font-semibold text-sm text-gray-200">{p.title}</span>
                            <span className="text-xs font-mono text-gray-400">{p.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-700/50 rounded-full h-1.5">
                            <div className={`bg-${p.color}-500 h-1.5 rounded-full transition-all duration-500`} style={{ width: `${p.progress}%` }}></div>
                        </div>
                    </div>
                ))}
            </div>
        </Widget>
    );
};

// --- Main Dashboard Component ---
const Dashboard: React.FC<DashboardProps> = (props) => {
  const { tasks, notes, projects, habits, toggleHabitCompletion, toggleTaskCompletion, selectedDate, setSelectedDate, addTask, addNote, editHabit, subscription, profile, onTriggerUpgrade } = props;
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { user, signOut } = useAuth();

  // Calculate Today's Progress for the Header Ring
  const todaysProgressStats = useMemo(() => {
    const now = new Date();
    const todayStr = getDateString(now);
    
    const todaysTasks = tasks.filter(t => t.due_date && t.due_date.startsWith(todayStr));
    const total = todaysTasks.length;
    const completed = todaysTasks.filter(t => t.status === 'done').length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return { progress, hasTasks: total > 0 };
  }, [tasks]);


  return (
    <div className="pb-24">
      {/* Sticky Header with Smart Profile Ring */}
      <DashboardHeader 
        user={user} 
        onOpenProfile={() => setIsProfileOpen(true)} 
        todayProgress={todaysProgressStats.progress}
        hasTasksToday={todaysProgressStats.hasTasks}
      />
      
      {/* Scrollable Content Container with Top Padding for Separation */}
      <div className="px-4 sm:px-6 max-w-7xl mx-auto space-y-6 pt-5">
          <WeekCalendar selectedDate={selectedDate} onDateChange={setSelectedDate} />
          
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Main Column */}
            <div className="lg:col-span-3 space-y-6">
                <TodaysPlan tasks={tasks} selectedDate={selectedDate} toggleTaskCompletion={toggleTaskCompletion} />
                <TodaysNotes notes={notes} selectedDate={selectedDate} />
                <QuickCapture onAddTask={addTask} onAddNote={addNote} selectedDate={selectedDate} />
            </div>

            {/* Side Column */}
            <div className="lg:col-span-2 space-y-6">
                <StatsOverview tasks={tasks} projects={projects} />
                <HabitTracker 
                    habits={habits} 
                    onToggle={toggleHabitCompletion} 
                    onEdit={editHabit}
                    onCreate={() => editHabit({ frequency: 'daily', target_count: 1 })}
                    selectedDate={selectedDate} 
                />
                <KeyProjects projects={projects} tasks={tasks} />
            </div>
          </div>
      </div>

      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        user={user} 
        signOut={signOut} 
        subscription={subscription}
        profile={profile}
        onTriggerUpgrade={onTriggerUpgrade}
      />
    </div>
  );
};

export default Dashboard;
