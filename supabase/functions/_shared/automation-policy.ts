/**
 * Deterministic automation evaluation. The model may phrase a suggestion, but it never
 * decides whether a rule fires: that is pure code, so the same trigger always produces
 * the same outcome and can be replayed safely.
 */

export type AutomationMode = 'suggest' | 'confirm' | 'automatic';

export type AutomationActionType = 'suggest_task' | 'suggest_reschedule' | 'create_reminder' | 'notify';

/** Only these actions may ever run without asking, and only on an opted-in rule. */
export const AUTOMATIC_ALLOWLIST: ReadonlySet<AutomationActionType> = new Set([
  'create_reminder',
  'notify',
]);

export interface QuietHours {
  /** Tehran wall-clock hour, inclusive. */
  startHour?: number;
  /** Tehran wall-clock hour, exclusive. */
  endHour?: number;
}

export interface AutomationRule {
  id: string;
  userId: string;
  triggerType: string;
  actionType: AutomationActionType;
  mode: AutomationMode;
  enabled: boolean;
  version: number;
  quietHours?: QuietHours;
  conditions?: AutomationCondition[];
}

export interface AutomationCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'gt' | 'lt' | 'contains' | 'exists';
  value?: unknown;
}

export interface AutomationEvent {
  type: string;
  userId: string;
  occurrenceKey: string;
  /** Tehran wall-clock hour the event is being evaluated at. */
  tehranHour: number;
  payload: Record<string, unknown>;
}

export type AutomationDecision =
  | { outcome: 'skip'; reason: 'disabled' | 'trigger_mismatch' | 'wrong_user' | 'condition_unmet' | 'quiet_hours' | 'loop_guard' }
  | { outcome: 'suggest'; idempotencyKey: string }
  | { outcome: 'confirm'; idempotencyKey: string }
  | { outcome: 'execute'; idempotencyKey: string };

/** An automation must never react to its own output. */
export const AUTOMATION_ORIGIN = 'automation';

export function evaluateRule(rule: AutomationRule, event: AutomationEvent): AutomationDecision {
  if (!rule.enabled) return { outcome: 'skip', reason: 'disabled' };
  if (rule.userId !== event.userId) return { outcome: 'skip', reason: 'wrong_user' };
  if (rule.triggerType !== event.type) return { outcome: 'skip', reason: 'trigger_mismatch' };
  if (event.payload.origin === AUTOMATION_ORIGIN) return { outcome: 'skip', reason: 'loop_guard' };
  if (isQuietHour(rule.quietHours, event.tehranHour)) return { outcome: 'skip', reason: 'quiet_hours' };
  if (!conditionsMet(rule.conditions ?? [], event.payload)) return { outcome: 'skip', reason: 'condition_unmet' };

  const idempotencyKey = `${rule.id}:${rule.version}:${event.occurrenceKey}`;

  // An 'automatic' rule still falls back to asking when its action is not allowlisted.
  if (rule.mode === 'automatic' && AUTOMATIC_ALLOWLIST.has(rule.actionType)) {
    return { outcome: 'execute', idempotencyKey };
  }
  if (rule.mode === 'automatic' || rule.mode === 'confirm') {
    return { outcome: 'confirm', idempotencyKey };
  }
  return { outcome: 'suggest', idempotencyKey };
}

export function isQuietHour(quietHours: QuietHours | undefined, hour: number): boolean {
  if (!quietHours || quietHours.startHour === undefined || quietHours.endHour === undefined) return false;
  const { startHour, endHour } = quietHours;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return false;
  // A window like 22 to 7 wraps past midnight.
  if (startHour === endHour) return false;
  return startHour < endHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}

export function conditionsMet(conditions: AutomationCondition[], payload: Record<string, unknown>): boolean {
  return conditions.every(condition => {
    const actual = payload[condition.field];
    switch (condition.operator) {
      case 'exists': return actual !== undefined && actual !== null;
      case 'equals': return actual === condition.value;
      case 'not_equals': return actual !== condition.value;
      case 'gt': return typeof actual === 'number' && typeof condition.value === 'number' && actual > condition.value;
      case 'lt': return typeof actual === 'number' && typeof condition.value === 'number' && actual < condition.value;
      case 'contains':
        return typeof actual === 'string' && typeof condition.value === 'string' && actual.includes(condition.value);
      default: return false;
    }
  });
}

/**
 * Fact lifecycle for conversational memory. A newly extracted fact starts in shadow and
 * is only usable for personalization after the user confirms it.
 */
export type FactStatus = 'shadow' | 'active' | 'superseded' | 'forgotten';

export function isFactUsable(fact: {
  status: FactStatus;
  userConfirmed: boolean;
  expiresAt?: string | null;
  now?: string;
}): boolean {
  if (fact.status !== 'active' || !fact.userConfirmed) return false;
  if (!fact.expiresAt) return true;
  const expires = Date.parse(fact.expiresAt);
  const now = Date.parse(fact.now ?? new Date().toISOString());
  return Number.isFinite(expires) && Number.isFinite(now) && now < expires;
}
