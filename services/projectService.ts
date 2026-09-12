import { supabase } from './supabaseClient';
import { Project } from '../types';

type ProjectInsert = Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
type ProjectUpdate = Partial<Omit<Project, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

const PROJECT_SELECT =
  'id, user_id, title, description, status, priority, color, created_at, updated_at';

const PROJECT_UPDATE_ALLOWED = ['title', 'description', 'status', 'priority', 'color'] as const;

const sanitizeProjectUpdate = (updates: ProjectUpdate | Record<string, unknown>) => {
  const src = updates as Record<string, unknown>;
  const cleanUpdates: Record<string, unknown> = {};

  for (const key of PROJECT_UPDATE_ALLOWED) {
    if (!(key in src) || src[key] === undefined) continue;
    cleanUpdates[key] = src[key];
  }

  return cleanUpdates;
};

export const getProjects = async (limit: number = 20): Promise<Project[]> => {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_SELECT)
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
    .select(PROJECT_SELECT)
    .single();

  if (error) throw error;
  return data as Project;
};

export const updateProject = async (id: string, updates: ProjectUpdate) => {
  // Canonical whitelist: never send id/user_id/timestamps/embedding/search_vector
  // (server-managed or generated columns) or UI-joined fields in the PATCH body.
  const cleanUpdates = sanitizeProjectUpdate(updates);

  const { data, error } = await supabase
    .from('projects')
    .update(cleanUpdates)
    .eq('id', id)
    .select(PROJECT_SELECT)
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
