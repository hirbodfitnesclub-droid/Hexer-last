export const FEATURE_STAGES = [
  'off',
  'shadow',
  'suggestion',
  'canary_write',
  'gradual',
  'active',
  'deprecated',
] as const;

export type FeatureStage = typeof FEATURE_STAGES[number];

export interface FeatureFlagRecord {
  key: string;
  stage: FeatureStage;
  enabled: boolean;
  rollout_percent: number;
  rollout_salt: string;
  config: Record<string, unknown> | null;
  starts_at: string | null;
  expires_at: string | null;
  version: number;
}

export interface FeatureFlagOverrideRecord {
  enabled: boolean | null;
  stage: FeatureStage | null;
  config: Record<string, unknown> | null;
  expires_at: string | null;
}

export interface FeatureDecision {
  key: string;
  enabled: boolean;
  stage: FeatureStage;
  bucket: number;
  rolloutPercent: number;
  version: number;
  config: Record<string, unknown>;
  reason: 'missing' | 'inactive' | 'override' | 'rollout' | 'enabled';
}

export function featureBucket(userId: string, key: string, salt: string): number {
  const value = `${userId}:${key}:${salt}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 10_000;
}

export function decideFeature(input: {
  flag: FeatureFlagRecord | null;
  override?: FeatureFlagOverrideRecord | null;
  userId: string;
  now: string;
}): FeatureDecision {
  const { flag, override, userId } = input;
  if (!flag) return missingDecision('missing');

  const bucket = featureBucket(userId, flag.key, flag.rollout_salt);
  const base = {
    key: flag.key,
    bucket,
    rolloutPercent: clampPercent(flag.rollout_percent),
    version: flag.version,
  };

  const withinWindow = isWithinWindow(flag.starts_at, flag.expires_at, input.now);
  const killed = flag.stage === 'off' || !withinWindow;

  // `stage: off` and an elapsed window are absolute kill switches. A flag that is
  // merely not enabled yet can still be opened for a canary through an override.
  if (killed) {
    return { ...base, enabled: false, stage: flag.stage, config: flag.config ?? {}, reason: 'inactive' };
  }

  if (override && isWithinWindow(null, override.expires_at, input.now)) {
    const stage = override.stage ?? flag.stage;
    const enabled = override.enabled ?? stage !== 'off';
    return {
      ...base,
      enabled: enabled && stage !== 'off',
      stage,
      config: { ...(flag.config ?? {}), ...(override.config ?? {}) },
      reason: 'override',
    };
  }

  if (!flag.enabled) {
    return { ...base, enabled: false, stage: flag.stage, config: flag.config ?? {}, reason: 'inactive' };
  }

  const enabled = bucket < Math.round(base.rolloutPercent * 100);
  return {
    ...base,
    enabled,
    stage: flag.stage,
    config: flag.config ?? {},
    reason: base.rolloutPercent >= 100 ? 'enabled' : 'rollout',
  };
}

function missingDecision(reason: 'missing'): FeatureDecision {
  return {
    key: '', enabled: false, stage: 'off', bucket: 0, rolloutPercent: 0,
    version: 0, config: {}, reason,
  };
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function isWithinWindow(startsAt: string | null, expiresAt: string | null, now: string): boolean {
  const timestamp = Date.parse(now);
  if (!Number.isFinite(timestamp)) return false;
  if (startsAt) {
    const starts = Date.parse(startsAt);
    if (!Number.isFinite(starts) || timestamp < starts) return false;
  }
  if (expiresAt) {
    const expires = Date.parse(expiresAt);
    if (!Number.isFinite(expires) || timestamp >= expires) return false;
  }
  return true;
}
