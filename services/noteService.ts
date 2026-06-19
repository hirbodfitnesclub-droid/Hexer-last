
import { supabase } from './supabaseClient';
import { Note } from '../types';

type NoteInsert = Omit<Note, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
type NoteUpdate = Partial<Omit<Note, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

export const getNotes = async (limit: number = 20): Promise<Note[]> => {
  const { data, error } = await supabase
    .from('notes')
    .select('id, user_id, project_id, title, content, tags, created_at, updated_at')
    .order('created_at', { ascending: false })
    .range(0, limit - 1);

  if (error) throw error;
  return data as Note[];
};

export const createNote = async (note: NoteInsert & { id?: string }, id?: string): Promise<Note> => {
  const rpcParams = {
    p_title: note.title,
    p_content: note.content || null,
    p_project_id: note.project_id || null,
    p_tags: note.tags || [],
    p_id: id || note.id || null
  };

  const { data, error } = await supabase
    .rpc('create_note_with_tags', rpcParams)
    .single();
    
  if (error) throw error;
  
  return data as Note;
};

export const updateNote = async (id: string, updates: NoteUpdate) => {
  // SANITIZATION: Remove potential UI-joined fields
  const { project, ...cleanUpdates } = updates as any;

  const { data, error } = await supabase
    .from('notes')
    .update(cleanUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  return data as Note;
};

export const deleteNote = async (id: string) => {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

