import { supabase } from './supabaseClient';
import { ChatMessage, ChatMode } from '../types';

/**
 * Helper to recognize quota exhausted (402 Payment Required) errors.
 * Inspects status code, error names, and string messages/contexts.
 */
const isQuotaError = (err: any): boolean => {
  if (!err) return false;
  
  // Direct status checks (e.g. status or statusCode)
  if (err.status === 402 || err.statusCode === 402) return true;
  
  // Context-specific checks for certain Supabase FunctionsHttpError structures
  if (err.context && (err.context.status === 402 || err.context.statusCode === 402)) {
    return true;
  }
  
  // Inspect message or error name
  const message = (err.message || '').toString();
  const name = (err.name || '').toString();
  
  if (message.includes('402') || message.includes('Payment Required')) {
    return true;
  }
  
  if (name === 'FunctionsHttpError' && (message.includes('402') || message.includes('Payment Required'))) {
    return true;
  }

  // Fallback to check nested or JSON-stringified raw representations
  try {
    const errorStr = JSON.stringify(err);
    if (errorStr.includes('402')) return true;
  } catch (jsonErr) {}

  return false;
};

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
  try {
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
      if (isQuotaError(error)) {
        throw new Error('402');
      }
      throw error;
    }

    if (data?.error) {
      if (data.reason === 'quota_exceeded' || data.reason === 'trial_expired' || data.error === '402') {
        throw new Error('402');
      }
      throw new Error(data.error);
    }

    return data;
  } catch (err: any) {
    if (isQuotaError(err)) {
      throw new Error('402');
    }
    throw err;
  }
};

/**
 * Performs a semantic hybrid search query in the AI layer, returning list of references.
 */
export const searchSemantic = async (query: string): Promise<any[]> => {
  try {
    const { data, error } = await supabase.functions.invoke('ai-assistant', {
      body: {
        message: query,
        mode: 'memory', // Forced memory RAG mode for semantic search
        history: []
      }
    });

    if (error) {
      if (isQuotaError(error)) {
        throw new Error('402');
      }
      throw error;
    }

    if (data?.error) {
      if (data.reason === 'quota_exceeded' || data.reason === 'trial_expired' || data.error === '402') {
        throw new Error('402');
      }
      throw new Error(data.error);
    }

    return data?.citations || [];
  } catch (err: any) {
    if (isQuotaError(err)) {
      throw new Error('402');
    }
    throw err;
  }
};

/**
 * Sends media files (audio or image) to AI Edge Function for zero-error proposal extraction.
 */
export const extractFromMedia = async (
  audioPath?: string,
  imagePath?: string,
  message?: string
): Promise<any> => {
  try {
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
      if (isQuotaError(error)) {
        throw new Error('402');
      }
      throw error;
    }

    if (data?.error) {
      if (data.reason === 'quota_exceeded' || data.reason === 'trial_expired' || data.error === '402') {
        throw new Error('402');
      }
      throw new Error(data.error);
    }

    return data; // returns structure including proposals, transcription, citations etc.
  } catch (err: any) {
    if (isQuotaError(err)) {
      throw new Error('402');
    }
    throw err;
  }
};
