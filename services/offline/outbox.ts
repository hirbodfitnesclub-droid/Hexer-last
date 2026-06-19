import { getFromStore, putToStore, deleteFromStore, getAllFromStore, clearStore } from './idb';

export interface Mutation {
  id: string; // Outbox transaction ID (could be same as entity ID)
  entity: string; // 'projects' | 'tasks' | 'notes' | 'habits' | 'links'
  action: 'insert' | 'update' | 'delete' | 'set_completion' | 'toggle';
  payload: any;
  timestamp: number;
  retryCount: number;
  error?: string;
  failedAt?: string;
}

export async function enqueue(mutation: Omit<Mutation, 'timestamp' | 'retryCount'>): Promise<void> {
  const item: Mutation = {
    ...mutation,
    timestamp: Date.now(),
    retryCount: 0
  };
  await putToStore('outbox', item);
}

export async function listPending(): Promise<Mutation[]> {
  const items = await getAllFromStore('outbox') as Mutation[];
  return items.sort((a, b) => a.timestamp - b.timestamp);
}

export async function remove(id: string): Promise<void> {
  await deleteFromStore('outbox', id);
}

export async function bumpRetry(id: string): Promise<void> {
  const item = await getFromStore('outbox', id) as Mutation | undefined;
  if (item) {
    item.retryCount = (item.retryCount || 0) + 1;
    await putToStore('outbox', item);
  }
}

/**
 * Replaces any trace of tempId with realId in outbox payloads and task structure.
 */
export async function remapTempId(tempId: string, realId: string): Promise<void> {
  const items = await getAllFromStore('outbox') as Mutation[];
  for (const item of items) {
    let changed = false;

    // Helper to recursively replace string inside object
    const replaceValue = (obj: any): any => {
      if (typeof obj === 'string') {
        if (obj === tempId) {
          changed = true;
          return realId;
        }
        return obj;
      }
      if (Array.isArray(obj)) {
        return obj.map(element => replaceValue(element));
      }
      if (obj && typeof obj === 'object') {
        const next: any = {};
        for (const k of Object.keys(obj)) {
          next[k] = replaceValue(obj[k]);
        }
        return next;
      }
      return obj;
    };

    const nextPayload = replaceValue(item.payload);
    
    let nextId = item.id;
    if (item.id === tempId) {
      nextId = realId;
      changed = true;
    }

    if (changed) {
      if (nextId !== item.id) {
        await deleteFromStore('outbox', item.id);
      }
      await putToStore('outbox', {
        ...item,
        id: nextId,
        payload: nextPayload
      });
    }
  }
}

// Dead-Letter Queue (failed store) helpers
export async function moveToFailed(id: string, errorMsg: string): Promise<void> {
  const item = await getFromStore('outbox', id) as Mutation | undefined;
  if (item) {
    await deleteFromStore('outbox', id);
    await putToStore('failed', {
      ...item,
      error: errorMsg,
      failedAt: new Date().toISOString()
    });
  }
}

export async function listFailed(): Promise<any[]> {
  return await getAllFromStore('failed');
}

export async function removeFailed(id: string): Promise<void> {
  await deleteFromStore('failed', id);
}

export async function clearFailed(): Promise<void> {
  await clearStore('failed');
}
