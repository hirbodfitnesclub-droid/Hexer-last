
import { supabase } from './supabaseClient';
import { Task } from '../types';

type TaskInsert = Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status' | 'completed_at'>;
type TaskUpdate = Partial<Omit<Task, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

const triggerVectorization = (id: string, content: string) => {
    // Fire-and-forget call to the edge function.
    // We do NOT await this.
    supabase.functions.invoke('vectorize', {
        body: { type: 'task', id, content }
    }).then(({ error }) => {
        if (error) console.error("Vectorization failed:", error);
    }).catch(err => console.error("Vectorization error:", err));
};

export const getTasks = async (): Promise<Task[]> => {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Task[];
};

export const createTask = async (task: TaskInsert): Promise<Task> => {
  // Use the RPC we defined in SQL
  const rpcParams = {
    title: task.title,
    description: task.description || null,
    project_id: task.project_id || null,
    due_date: task.due_date || null,
    priority: task.priority || 'medium',
    tags: task.tags || []
  };

  const { data, error } = await supabase
    .rpc('create_task_with_tags', rpcParams)
    .single();

  if (error) throw error;
  
  let createdTask = data as Task;

  // Since RPC doesn't handle the new checklist column, we might need to update it immediately if provided
  if (task.checklist && task.checklist.length > 0) {
      const { data: updatedData, error: updateError } = await supabase
          .from('tasks')
          .update({ checklist: task.checklist })
          .eq('id', createdTask.id)
          .select()
          .single();
      
      if (!updateError && updatedData) {
          createdTask = updatedData as Task;
      }
  }

  // Trigger background vectorization including checklist content
  const checklistText = createdTask.checklist ? createdTask.checklist.map(i => i.text).join(' ') : '';
  const content = `${createdTask.title} ${createdTask.description || ''} ${createdTask.tags ? createdTask.tags.join(' ') : ''} ${checklistText}`;
  triggerVectorization(createdTask.id, content);

  return createdTask;
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

  // Trigger re-vectorization if text content changed
  if (updates.title || updates.description || updates.tags || updates.checklist) {
       const checklistText = data.checklist ? data.checklist.map((i: any) => i.text).join(' ') : '';
       const content = `${data.title} ${data.description || ''} ${data.tags ? data.tags.join(' ') : ''} ${checklistText}`;
       triggerVectorization(data.id, content);
  }

  return data as Task;
};

export const deleteTask = async (id: string) => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) throw error;
};
