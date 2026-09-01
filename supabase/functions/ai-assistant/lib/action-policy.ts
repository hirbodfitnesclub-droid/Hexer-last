import type { AiAction, ExecutableAction } from './ai-contract.ts';
import type { AiIntent } from './intent.ts';

const CREATE_ACTIONS: readonly ExecutableAction[] = ['CREATE_TASK', 'CREATE_NOTE', 'CREATE_PROJECT', 'CREATE_HABIT', 'CREATE_REMINDER'];
const MUTATE_ACTIONS: readonly ExecutableAction[] = [
  'UPDATE_TASK', 'COMPLETE_TASK', 'REOPEN_TASK', 'UPDATE_TASK_CHECKLIST',
  'UPDATE_NOTE', 'UPDATE_PROJECT', 'UPDATE_HABIT', 'SET_HABIT_COMPLETION',
  'UPDATE_REMINDER', 'SNOOZE_REMINDER', 'MARK_REMINDER_READ', 'LINK_TASK_NOTE', 'UNLINK_TASK_NOTE',
];
const KNOWN_ACTIONS: readonly ExecutableAction[] = [...CREATE_ACTIONS, 'SUGGEST_LINK', ...MUTATE_ACTIONS];

export type ActionRejectionReason = 'invalid_shape' | 'unknown_action' | 'non_executable' | `intent_${AiIntent}_disallows`;

export interface RejectedAction {
  index: number;
  action: unknown;
  reason: ActionRejectionReason;
}

export interface ActionPolicyResult {
  accepted: Array<AiAction & { policyIndex: number }>;
  rejected: RejectedAction[];
}

export function allowedActionsFor(intent: AiIntent): readonly ExecutableAction[] {
  if (intent === 'create') return CREATE_ACTIONS;
  if (intent === 'link') return ['SUGGEST_LINK', 'LINK_TASK_NOTE', 'UNLINK_TASK_NOTE'];
  if (intent === 'mutate') return MUTATE_ACTIONS;
  return [];
}

export function isMutationAction(action: ExecutableAction): boolean {
  return CREATE_ACTIONS.includes(action) || MUTATE_ACTIONS.includes(action);
}

export function filterActionsByPolicy(intent: AiIntent, actions: unknown): ActionPolicyResult {
  if (!Array.isArray(actions)) {
    return { accepted: [], rejected: [{ index: -1, action: actions, reason: 'invalid_shape' }] };
  }
  const allowed = allowedActionsFor(intent);
  const accepted: Array<AiAction & { policyIndex: number }> = [];
  const rejected: RejectedAction[] = [];

  actions.forEach((candidate, index) => {
    if (!isRecord(candidate) || typeof candidate.action !== 'string' || !isRecord(candidate.params)) {
      rejected.push({ index, action: candidate, reason: 'invalid_shape' });
      return;
    }
    if (candidate.action === 'CHAT') {
      rejected.push({ index, action: candidate, reason: 'non_executable' });
      return;
    }
    if (!KNOWN_ACTIONS.includes(candidate.action as ExecutableAction)) {
      rejected.push({ index, action: candidate, reason: 'unknown_action' });
      return;
    }
    if (!allowed.includes(candidate.action as ExecutableAction)) {
      rejected.push({ index, action: candidate, reason: `intent_${intent}_disallows` });
      return;
    }
    accepted.push({ ...(candidate as AiAction), policyIndex: index });
  });

  return { accepted, rejected };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
