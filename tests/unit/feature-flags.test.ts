import { describe, expect, it } from 'vitest';
import manifest from '../scenarios/feature-flags.json';
import {
  decideFeature,
  featureBucket,
  type FeatureFlagOverrideRecord,
  type FeatureFlagRecord,
} from '../../supabase/functions/_shared/feature-flags';

const baseFlag: FeatureFlagRecord = {
  key: 'test_flag',
  stage: 'off',
  enabled: false,
  rollout_percent: 0,
  rollout_salt: 'test-v1',
  config: {},
  starts_at: null,
  expires_at: null,
  version: 1,
};

describe('server feature flag resolution', () => {
  for (const scenario of manifest.scenarios) {
    it(scenario.id, () => {
      const rawFlag = scenario.input.flag;
      const flag = rawFlag == null ? null : {
        ...baseFlag,
        ...rawFlag,
        rollout_percent: typeof rawFlag.rollout_percent === 'number'
          ? rawFlag.rollout_percent
          : Number.NaN,
      } as FeatureFlagRecord;
      const override = scenario.input.override == null ? null : {
        enabled: null,
        stage: null,
        config: null,
        expires_at: null,
        ...scenario.input.override,
      } as FeatureFlagOverrideRecord;
      expect(decideFeature({
        flag,
        override,
        userId: scenario.input.userId,
        now: scenario.input.now,
      })).toMatchObject(scenario.expected);
    });
  }

  it('assigns the same user to a stable bucket', () => {
    expect(featureBucket('user-1', 'memory_v2', 'v1')).toBe(featureBucket('user-1', 'memory_v2', 'v1'));
  });

  it('changes bucketing inputs without exceeding the range', () => {
    const buckets = [
      featureBucket('user-1', 'memory_v2', 'v1'),
      featureBucket('user-2', 'memory_v2', 'v1'),
      featureBucket('user-1', 'voice_actions_v2', 'v1'),
      featureBucket('user-1', 'memory_v2', 'v2'),
    ];
    expect(new Set(buckets).size).toBeGreaterThan(1);
    expect(buckets.every((bucket) => bucket >= 0 && bucket < 10_000)).toBe(true);
  });
});
