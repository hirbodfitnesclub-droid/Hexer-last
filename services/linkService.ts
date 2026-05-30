import { supabase } from './supabaseClient';
import { Task, Note } from '../types';

export const linkTaskNote = async (taskId: string, noteId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('link_task_note', {
    p_task_id: taskId,
    p_note_id: noteId
  });
  if (error) {
    console.error('Error in link_task_note:', error);
    throw error;
  }
  return !!data;
};

export const unlinkTaskNote = async (taskId: string, noteId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('unlink_task_note', {
    p_task_id: taskId,
    p_note_id: noteId
  });
  if (error) {
    console.error('Error in unlink_task_note:', error);
    throw error;
  }
  return !!data;
};

export const getLinkedNotes = async (taskId: string): Promise<Note[]> => {
  const { data, error } = await supabase.rpc('get_linked_notes', {
    p_task_id: taskId
  });
  if (error) {
    console.error('Error in get_linked_notes:', error);
    throw error;
  }
  return (data as Note[]) || [];
};

export const getLinkedTasks = async (noteId: string): Promise<Task[]> => {
  const { data, error } = await supabase.rpc('get_linked_tasks', {
    p_note_id: noteId
  });
  if (error) {
    console.error('Error in get_linked_tasks:', error);
    throw error;
  }
  return (data as Task[]) || [];
};
