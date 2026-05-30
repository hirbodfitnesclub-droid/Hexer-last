import { supabase } from './supabaseClient';
import { ChatMessage, ChatMode } from '../types';

/**
 * Sends a chat message to the Hexer AI Assistant, including Chat History context.
 */
export const sendChatMessage = async (
  message: string,
  history: ChatMessage[],
  mode: ChatMode,
  audioPath?: string,
  imagePath?: string
): Promise<any> => {
  const { data, error } = await supabase.functions.invoke('ai-assistant', {
    body: {
      message,
      history: history.slice(-10), // Limit to last 10 messages for token efficiency
      mode,
      audioPath,
      imagePath
    }
  });

  if (error) {
    if (error.status === 402 || (error.message && error.message.includes('402'))) {
      throw new Error('402');
    }
    throw error;
  }

  if (data?.error) {
    if (data.reason === 'quota_exceeded' || data.reason === 'trial_expired') {
      throw new Error('402');
    }
    throw new Error(data.error);
  }

  return data;
};

/**
 * Performs a semantic hybrid search query in the AI layer, returning list of references.
 */
export const searchSemantic = async (query: string): Promise<any[]> => {
  const { data, error } = await supabase.functions.invoke('ai-assistant', {
    body: {
      message: query,
      mode: 'memory', // Forced memory RAG mode for semantic search
      history: []
    }
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  return data?.citations || [];
};

/**
 * Sends media files (audio or image) to AI Edge Function for zero-error proposal extraction.
 */
export const extractFromMedia = async (
  audioPath?: string,
  imagePath?: string,
  message?: string
): Promise<any> => {
  const { data, error } = await supabase.functions.invoke('ai-assistant', {
    body: {
      message: message || '',
      mode: 'action',
      audioPath,
      imagePath,
      history: []
    }
  });

  if (error) {
    if (error.status === 402 || (error.message && error.message.includes('402'))) {
      throw new Error('402');
    }
    throw error;
  }

  if (data?.error) {
    if (data.reason === 'quota_exceeded' || data.reason === 'trial_expired') {
      throw new Error('402');
    }
    throw new Error(data.error);
  }

  return data; // returns structure including proposals, transcription, citations etc.
};
