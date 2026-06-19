
import { supabase } from './supabaseClient';
import { Task } from '../types';

type TaskInsert = Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'completed_at'>;
type TaskUpdate = Partial<Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export const getTasks = async (limit: number = 20): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('id, user_id, project_id, title, description, status, priority, due_date, completed_at, tags, checklist, created_at, updated_at')
    .order('created_at', { ascending: false })
    .range(0, limit - 1);

  if (error) throw error;
  return data as Task[];
};

export const createTask = async (task: TaskInsert & { id?: string }, id?: string): Promise<Task> => {
  // Use the RPC we defined in SQL with checklist support
  const rpcParams = {
    p_title: task.title,
    p_description: task.description || null,
    p_project_id: task.project_id || null,
    p_due_date: task.due_date || null,
    p_priority: task.priority || 'medium',
    p_tags: task.tags || [],
    p_checklist: task.checklist || [], // mapped as jsonb atomically
    p_id: id || task.id || null
  };

  const { data, error } = await supabase
    .rpc('create_task_with_tags', rpcParams)
    .single();

  if (error) throw error;
  
  return data as Task;
};

export const updateTask = async (id: string, updates: TaskUpdate) => {
  // SANITIZATION: Remove UI-only fields (like 'project' object joined for display) 
  // before sending to DB to avoid "column does not exist" errors.
  const { project, ...cleanUpdates } = updates as any;

  const { data, error } = await supabase
    .from('tasks')
    .update(cleanUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return data as Task;
};

export const deleteTask = async (id: string) => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

