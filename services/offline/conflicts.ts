export type ConflictResolution = 'accept_server' | 'reapply_local' | 'review_merge';

export interface FieldConflict {
  field: string;
  base: unknown;
  local: unknown;
  server: unknown;
  kind: 'local_only' | 'server_only' | 'same_change' | 'conflict';
}

export function compareEntityVersions(input: {
  baseVersion?: number | null;
  serverVersion?: number | null;
}): 'current' | 'stale' | 'unknown' {
  if (!isVersion(input.baseVersion) || !isVersion(input.serverVersion)) return 'unknown';
  return input.baseVersion === input.serverVersion ? 'current' : 'stale';
}

export function diffConflictFields(input: {
  base: Record<string, unknown>;
  local: Record<string, unknown>;
  server: Record<string, unknown>;
  fields: string[];
}): FieldConflict[] {
  return [...new Set(input.fields)].map((field) => {
    const base = input.base[field];
    const local = input.local[field];
    const server = input.server[field];
    const localChanged = !sameValue(local, base);
    const serverChanged = !sameValue(server, base);
    const kind: FieldConflict['kind'] = localChanged && serverChanged
      ? sameValue(local, server) ? 'same_change' : 'conflict'
      : localChanged ? 'local_only'
        : serverChanged ? 'server_only'
          : 'same_change';
    return { field, base, local, server, kind };
  });
}

export function recommendedResolution(conflicts: FieldConflict[]): ConflictResolution {
  if (conflicts.some((field) => field.kind === 'conflict')) return 'review_merge';
  if (conflicts.some((field) => field.kind === 'local_only')) return 'reapply_local';
  return 'accept_server';
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalize(nested)]));
  }
  return value;
}

function isVersion(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}
