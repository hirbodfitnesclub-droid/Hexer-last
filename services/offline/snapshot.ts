import { getFromStore, putToStore } from './idb';

export async function saveSnapshot(userId: string, entity: string, rows: any[]): Promise<void> {
  if (!userId) return;
  const id = `${userId}:${entity}`;
  await putToStore('snapshot', {
    id,
    userId,
    entity,
    data: rows,
    updated_at: new Date().toISOString()
  });
}

export async function loadSnapshot(userId: string, entity: string): Promise<any[]> {
  if (!userId) return [];
  const id = `${userId}:${entity}`;
  try {
    const record = await getFromStore('snapshot', id);
    return record ? record.data : [];
  } catch (error) {
    console.warn(`[Snapshot] Failed to load snapshot for ${entity}:`, error);
    return [];
  }
}
