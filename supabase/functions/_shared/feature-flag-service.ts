import { decideFeature, type FeatureDecision, type FeatureFlagOverrideRecord, type FeatureFlagRecord } from './feature-flags.ts';

export async function resolveFeatureDecision(input: {
  serviceClient: any;
  key: string;
  userId: string;
  requestId: string;
  now?: string;
  environment?: string;
}): Promise<FeatureDecision> {
  const now = input.now ?? new Date().toISOString();
  const environment = input.environment ?? 'production';
  const { data: flag, error: flagError } = await input.serviceClient
    .from('feature_flags')
    .select('key,stage,enabled,rollout_percent,rollout_salt,config,starts_at,expires_at,version')
    .eq('key', input.key)
    .maybeSingle();
  if (flagError) throw new Error(`Feature flag lookup failed: ${flagError.message}`);

  let override: FeatureFlagOverrideRecord | null = null;
  if (flag) {
    const { data, error } = await input.serviceClient
      .from('feature_flag_overrides')
      .select('enabled,stage,config,expires_at')
      .eq('flag_key', input.key)
      .eq('environment', environment)
      .eq('user_id', input.userId)
      .maybeSingle();
    if (error) throw new Error(`Feature override lookup failed: ${error.message}`);
    override = data;
  }

  const decision = decideFeature({
    flag: flag as FeatureFlagRecord | null,
    override,
    userId: input.userId,
    now,
  });
  if (!flag) return decision;

  const { error: exposureError } = await input.serviceClient
    .from('feature_flag_exposures')
    .upsert({
      request_id: input.requestId,
      user_id: input.userId,
      flag_key: input.key,
      flag_version: decision.version,
      stage: decision.stage,
      enabled: decision.enabled,
      bucket: decision.bucket,
      reason: decision.reason,
    }, { onConflict: 'request_id,flag_key', ignoreDuplicates: true });
  if (exposureError) throw new Error(`Feature exposure insert failed: ${exposureError.message}`);
  return decision;
}
