
import { supabase } from './supabaseClient';
import { Task } from '../types';

type TaskInsert = Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'completed_at'>;
type TaskUpdate = Partial<Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

const TASK_SELECT =
  'id, user_id, project_id, title, description, status, priority, due_date, completed_at, tags, checklist, created_at, updated_at';

export const getTasks = async (limit: number = 20): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select(TASK_SELECT)
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

const TASK_UPDATE_ALLOWED = [
  'title',
  'description',
  'status',
  'priority',
  'due_date',
  'project_id',
  'tags',
  'checklist',
  'completed_at',
] as const;

const sanitizeTaskUpdate = (updates: TaskUpdate | Record<string, unknown>) => {
  const src = updates as Record<string, unknown>;
  const cleanUpdates: Record<string, unknown> = {};

  for (const key of TASK_UPDATE_ALLOWED) {
    if (!(key in src) || src[key] === undefined) continue;
    cleanUpdates[key] = src[key];
  }

  if ('tags' in cleanUpdates && !Array.isArray(cleanUpdates.tags)) {
    cleanUpdates.tags = [];
  }
  if ('checklist' in cleanUpdates && !Array.isArray(cleanUpdates.checklist)) {
    cleanUpdates.checklist = [];
  }

  return cleanUpdates;
};

export const updateTask = async (id: string, updates: TaskUpdate) => {
  // Canonical whitelist: never send id/user_id/timestamps/embedding/join fields in PATCH body.
  const cleanUpdates = sanitizeTaskUpdate(updates);

  const { data, error } = await supabase
    .from('tasks')
    .update(cleanUpdates)
    .eq('id', id)
    .select(TASK_SELECT)
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

