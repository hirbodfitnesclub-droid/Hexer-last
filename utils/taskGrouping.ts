import { Task, Priority, Project } from '../types';
import { getTehranDateString } from './dateUtils';

export type EnrichedTask = Task & { project?: Project };

export interface TaskGroup {
  id: string;
  title: string;
  active: EnrichedTask[];
  completed: EnrichedTask[];
}

/**
 * Groups tasks based on target viewMode ('agenda' | 'project' | 'priority') using Asia/Tehran timezone date formatting.
 */
export const groupTasks = (
  tasks: Task[],
  projects: Project[],
  viewMode: 'agenda' | 'project' | 'priority'
): TaskGroup[] => {
  const projectMap = new Map(projects.map(p => [p.id, p]));
  const enrichedTasks: EnrichedTask[] = tasks.map(t => ({
    ...t,
    project: t.project_id ? projectMap.get(t.project_id) : undefined
  }));

  if (viewMode === 'agenda') {
    const todayStr = getTehranDateString();
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = getTehranDateString(tomorrowDate);

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
        // Safe conversion of UTC timestamp to Tehran YYYY-MM-DD
        const taskDayStr = getTehranDateString(new Date(task.due_date));
        if (taskDayStr < todayStr) {
          category = 'overdue';
        } else if (taskDayStr === todayStr) {
          category = 'today';
        } else if (taskDayStr === tomorrowStr) {
          category = 'tomorrow';
        } else {
          category = 'upcoming';
        }
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
    const groups: Record<string, { active: EnrichedTask[], completed: EnrichedTask[] }> = {
      'no-project': { active: [], completed: [] }
    };
    projects.forEach(p => {
      groups[p.id] = { active: [], completed: [] };
    });

    enrichedTasks.forEach(task => {
      const key = task.project_id || 'no-project';
      if (!groups[key]) {
        groups[key] = { active: [], completed: [] };
      }
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
      const prio = task.priority || Priority.Medium;
      if (!groups[prio]) {
        groups[prio] = { active: [], completed: [] };
      }
      if (task.status === 'done') {
        groups[prio].completed.push(task);
      } else {
        groups[prio].active.push(task);
      }
    });

    return [
      { id: Priority.High, title: 'اولویت زیاد', ...groups[Priority.High] },
      { id: Priority.Medium, title: 'اولویت متوسط', ...groups[Priority.Medium] },
      { id: Priority.Low, title: 'اولویت کم', ...groups[Priority.Low] },
    ].filter(g => g.active.length > 0 || g.completed.length > 0);
  }

  return [];
};
