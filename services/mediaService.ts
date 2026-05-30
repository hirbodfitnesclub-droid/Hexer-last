import { supabase } from './supabaseClient';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function uploadChatMedia(blob: Blob, ext: string): Promise<string> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('کاربر احراز هویت نشده است.');
  }

  const userId = user.id;
  const uuid = generateUUID();
  const relativePath = `${userId}/${uuid}.${ext}`;

  // Upload to client-side storage bucket 'chat-media'
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('chat-media')
    .upload(relativePath, blob, {
      contentType: blob.type,
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    console.error('Error uploading chat media:', uploadError);
    throw uploadError;
  }

  // Register asset in media_assets database table
  try {
    const { error: dbError } = await supabase
      .from('media_assets')
      .insert({
        user_id: userId,
        bucket: 'chat-media',
        path: relativePath,
        mime_type: blob.type,
        size_bytes: blob.size,
        purpose: blob.type.startsWith('image/') ? 'chat_image' : 'chat_audio'
      });
    if (dbError) {
      console.warn('Could not register media asset in database:', dbError);
    }
  } catch (dbErr) {
    console.warn('Could not register media asset in database:', dbErr);
  }

  return relativePath;
}
