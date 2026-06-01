import { Task } from '../../../types';

export const calculateProjectStats = (projectId: string, tasks: Task[]) => {
  const projectTasks = tasks.filter(t => t.project_id === projectId);
  if (projectTasks.length === 0) return { progress: 0, activeTasks: 0 };
  
  const completedTasks = projectTasks.filter(t => t.status === 'done').length;
  const progress = Math.round((completedTasks / projectTasks.length) * 100);
  const activeTasks = projectTasks.length - completedTasks;
  
  return { progress, activeTasks };
};
export default calculateProjectStats;
