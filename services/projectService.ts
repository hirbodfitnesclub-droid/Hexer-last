import { supabase } from './supabaseClient';
import { Project } from '../types';

type ProjectInsert = Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
type ProjectUpdate = Partial<Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export const getProjects = async (limit: number = 20): Promise<Project[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select('id, user_id, title, description, status, priority, color, created_at, updated_at')
    .order('created_at', { ascending: false })
    .range(0, limit - 1);

  if (error) throw error;
  return data as Project[];
};

export const createProject = async (project: ProjectInsert & { id?: string }, id?: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const finalId = id || project.id;
  const row: any = {
    ...project,
    user_id: user.id
  };
  if (finalId) {
    row.id = finalId;
  }

  const { data, error } = await supabase
    .from('projects')
    .upsert([row], { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return data as Project;
};

export const updateProject = async (id: string, updates: ProjectUpdate) => {
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Project;
};

export const deleteProject = async (id: string) => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
};
