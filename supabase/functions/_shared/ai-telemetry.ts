export type UsageSource = 'provider' | 'estimated' | 'unknown';

export interface NormalizedAiUsage {
  providerRequestId: string | null;
  actualModel: string | null;
  actualProvider: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  cachedTokens: number | null;
  costMicrounits: number | null;
  currency: string | null;
  usageSource: UsageSource;
}

export function normalizeOpenRouterUsage(response: unknown): NormalizedAiUsage {
  const root = isRecord(response) ? response : {};
  const usage = isRecord(root.usage) ? root.usage : {};
  const inputTokens = nonNegativeInteger(usage.prompt_tokens ?? usage.input_tokens);
  const outputTokens = nonNegativeInteger(usage.completion_tokens ?? usage.output_tokens);
  const reasoningTokens = nonNegativeInteger(
    usage.reasoning_tokens ?? nestedNumber(usage, ['completion_tokens_details', 'reasoning_tokens'])
  );
  const cachedTokens = nonNegativeInteger(
    usage.cached_tokens ?? nestedNumber(usage, ['prompt_tokens_details', 'cached_tokens'])
  );
  const costMicrounits = normalizeCostMicrounits(usage.cost ?? root.cost);
  const provider = stringValue(root.provider)
    ?? stringValue(isRecord(root.metadata) ? root.metadata.provider : null);
  const hasProviderUsage = [inputTokens, outputTokens, reasoningTokens, cachedTokens, costMicrounits]
    .some((value) => value !== null);

  return {
    providerRequestId: stringValue(root.id),
    actualModel: stringValue(root.model),
    actualProvider: provider,
    inputTokens,
    outputTokens,
    reasoningTokens,
    cachedTokens,
    costMicrounits,
    currency: costMicrounits === null ? null : 'USD',
    usageSource: hasProviderUsage ? 'provider' : 'unknown',
  };
}

function normalizeCostMicrounits(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 1_000_000);
}

function nestedNumber(value: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = value;
  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return current;
}

function nonNegativeInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.floor(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
