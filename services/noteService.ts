
import { supabase } from './supabaseClient';
import { Note } from '../types';

type NoteInsert = Omit<Note, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
type NoteUpdate = Partial<Omit<Note, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;

const triggerVectorization = (id: string, content: string) => {
    supabase.functions.invoke('vectorize', {
        body: { type: 'note', id, content }
    }).then(({ error }) => {
        if (error) console.error("Vectorization failed:", error);
    }).catch(err => console.error("Vectorization error:", err));
};

export const getNotes = async (): Promise<Note[]> => {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Note[];
};

export const createNote = async (note: NoteInsert): Promise<Note> => {
  const rpcParams = {
    title: note.title,
    content: note.content || null,
    project_id: note.project_id || null,
    tags: note.tags || []
  };

  const { data, error } = await supabase
    .rpc('create_note_with_tags', rpcParams)
    .single();
    
  if (error) throw error;
  
  const createdNote = data as Note;
  
  triggerVectorization(createdNote.id, `${createdNote.title} ${createdNote.content || ''} ${createdNote.tags ? createdNote.tags.join(' ') : ''}`);
  
  return createdNote;
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

  if (updates.title || updates.content || updates.tags) {
      const content = `${data.title} ${data.content || ''} ${data.tags ? data.tags.join(' ') : ''}`;
      triggerVectorization(data.id, content);
  }

  return data as Note;
};

export const deleteNote = async (id: string) => {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id);

  if (error) throw error;
};
