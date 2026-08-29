export const EXECUTABLE_ACTIONS = [
  'CREATE_TASK',
  'CREATE_NOTE',
  'CREATE_PROJECT',
  'CREATE_HABIT',
  'SUGGEST_LINK',
  'UPDATE_TASK',
  'COMPLETE_TASK',
  'REOPEN_TASK',
  'UPDATE_TASK_CHECKLIST',
  'UPDATE_NOTE',
  'UPDATE_PROJECT',
  'UPDATE_HABIT',
  'SET_HABIT_COMPLETION',
  'CREATE_REMINDER',
  'UPDATE_REMINDER',
  'SNOOZE_REMINDER',
  'MARK_REMINDER_READ',
  'LINK_TASK_NOTE',
  'UNLINK_TASK_NOTE',
] as const;

export type ExecutableAction = typeof EXECUTABLE_ACTIONS[number];
export type Priority = 'low' | 'medium' | 'high';
export type JsonObject = Record<string, unknown>;

export interface ChecklistDraft {
  id?: string;
  text: string;
  isCompleted?: boolean;
}

export interface CreateTaskParams {
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority?: Priority;
  projectId?: string | null;
  tags?: string[];
  checklist?: ChecklistDraft[];
}

export interface CreateNoteParams {
  title: string;
  content?: string | null;
  projectId?: string | null;
  tags?: string[];
}

export interface CreateProjectParams {
  title: string;
  description?: string | null;
  priority?: Priority;
  color?: string;
}

export interface CreateHabitParams {
  name: string;
  description?: string | null;
  frequency?: string;
  target_count?: number;
}

export interface SuggestLinkParams {
  queryText: string;
}

export interface UpdateTaskParams {
  taskId?: string | null;
  title?: string | null;
  taskTitle?: string | null;
  updates: {
    title?: string;
    description?: string | null;
    status?: string;
    priority?: Priority;
    dueDate?: string | null;
    projectId?: string | null;
    tags?: string[];
    checklist?: ChecklistDraft[];
  };
}

export interface CompleteTaskParams {
  taskId?: string | null;
  title?: string | null;
  taskTitle?: string | null;
}

export type ReopenTaskParams = CompleteTaskParams;

export interface UpdateTaskChecklistParams extends CompleteTaskParams {
  updates: { checklist: ChecklistDraft[] };
}

export interface UpdateNoteParams {
  noteId?: string | null;
  noteTitle?: string | null;
  updates: { title?: string; content?: string | null; projectId?: string | null; tags?: string[] };
}

export interface UpdateProjectParams {
  projectId?: string | null;
  projectTitle?: string | null;
  updates: { title?: string; description?: string | null; status?: string; priority?: Priority; color?: string };
}

export interface UpdateHabitParams {
  habitId?: string | null;
  habitName?: string | null;
  updates: { name?: string; description?: string | null; frequency?: string; target_count?: number };
}

export interface SetHabitCompletionParams {
  habitId?: string | null;
  habitName?: string | null;
  completionDate: string;
  completed: boolean;
}

export interface CreateReminderParams {
  title: string;
  body?: string | null;
  remindAt: string;
  type?: 'task' | 'habit' | 'custom';
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}

export interface UpdateReminderParams {
  reminderId?: string | null;
  reminderTitle?: string | null;
  updates: { title?: string; body?: string | null; remindAt?: string; isRead?: boolean };
}

export interface SnoozeReminderParams {
  reminderId?: string | null;
  reminderTitle?: string | null;
  remindAt: string;
}

export interface MarkReminderReadParams {
  reminderId?: string | null;
  reminderTitle?: string | null;
  isRead: boolean;
}

export interface LinkTaskNoteParams {
  taskId?: string | null;
  taskTitle?: string | null;
  noteId?: string | null;
  noteTitle?: string | null;
}

export type AiAction =
  | { action: 'CREATE_TASK'; params: CreateTaskParams }
  | { action: 'CREATE_NOTE'; params: CreateNoteParams }
  | { action: 'CREATE_PROJECT'; params: CreateProjectParams }
  | { action: 'CREATE_HABIT'; params: CreateHabitParams }
  | { action: 'SUGGEST_LINK'; params: SuggestLinkParams }
  | { action: 'UPDATE_TASK'; params: UpdateTaskParams }
  | { action: 'COMPLETE_TASK'; params: CompleteTaskParams }
  | { action: 'REOPEN_TASK'; params: ReopenTaskParams }
  | { action: 'UPDATE_TASK_CHECKLIST'; params: UpdateTaskChecklistParams }
  | { action: 'UPDATE_NOTE'; params: UpdateNoteParams }
  | { action: 'UPDATE_PROJECT'; params: UpdateProjectParams }
  | { action: 'UPDATE_HABIT'; params: UpdateHabitParams }
  | { action: 'SET_HABIT_COMPLETION'; params: SetHabitCompletionParams }
  | { action: 'CREATE_REMINDER'; params: CreateReminderParams }
  | { action: 'UPDATE_REMINDER'; params: UpdateReminderParams }
  | { action: 'SNOOZE_REMINDER'; params: SnoozeReminderParams }
  | { action: 'MARK_REMINDER_READ'; params: MarkReminderReadParams }
  | { action: 'LINK_TASK_NOTE'; params: LinkTaskNoteParams }
  | { action: 'UNLINK_TASK_NOTE'; params: LinkTaskNoteParams };

export interface ExtractionProposal {
  kind: 'task' | 'note';
  draft: {
    title: string;
    description?: string;
    content?: string;
    dueDate?: string;
    priority?: Priority;
    tags?: string[];
    checklist?: ChecklistDraft[];
  };
  confidence: number;
}

export interface AiResponse {
  transcription: string;
  reply: string;
  actions: AiAction[];
  proposals: ExtractionProposal[];
}

const nullableString = { type: ['string', 'null'] } as const;
const stringArray = { type: 'array', items: { type: 'string' } } as const;
const priority = { type: 'string', enum: ['low', 'medium', 'high'] } as const;
const checklist = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['text'],
    properties: {
      id: { type: 'string' },
      text: { type: 'string', minLength: 1 },
      isCompleted: { type: 'boolean' },
    },
  },
} as const;

export const AI_RESPONSE_JSON_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'HexerAiResponse',
  type: 'object',
  additionalProperties: false,
  required: ['transcription', 'reply', 'actions', 'proposals'],
  properties: {
    transcription: { type: 'string' },
    reply: { type: 'string' },
    actions: {
      type: 'array',
      maxItems: 64,
      items: {
        oneOf: [
          actionSchema('CREATE_TASK', ['title'], {
            title: { type: 'string', minLength: 1 }, description: nullableString,
            dueDate: nullableString, priority, projectId: nullableString, tags: stringArray, checklist,
          }),
          actionSchema('CREATE_NOTE', ['title'], {
            title: { type: 'string', minLength: 1 }, content: nullableString,
            projectId: nullableString, tags: stringArray,
          }),
          actionSchema('CREATE_PROJECT', ['title'], {
            title: { type: 'string', minLength: 1 }, description: nullableString, priority, color: { type: 'string' },
          }),
          actionSchema('CREATE_HABIT', ['name'], {
            name: { type: 'string', minLength: 1 }, description: nullableString,
            frequency: { type: 'string' }, target_count: { type: 'number', minimum: 1 },
          }),
          actionSchema('SUGGEST_LINK', ['queryText'], { queryText: { type: 'string', minLength: 1 } }),
          actionSchema('UPDATE_TASK', ['updates'], {
            taskId: nullableString, title: nullableString, taskTitle: nullableString,
            updates: {
              type: 'object', additionalProperties: false, minProperties: 1,
              properties: {
                title: { type: 'string', minLength: 1 }, description: nullableString,
                status: { type: 'string' }, priority, dueDate: nullableString,
                projectId: nullableString, tags: stringArray, checklist,
              },
            },
          }),
          actionSchema('COMPLETE_TASK', [], { taskId: nullableString, title: nullableString, taskTitle: nullableString }),
          actionSchema('REOPEN_TASK', [], { taskId: nullableString, title: nullableString, taskTitle: nullableString }),
          actionSchema('UPDATE_TASK_CHECKLIST', ['updates'], {
            taskId: nullableString, title: nullableString, taskTitle: nullableString,
            updates: {
              type: 'object', additionalProperties: false, required: ['checklist'],
              properties: { checklist },
            },
          }),
          actionSchema('UPDATE_NOTE', ['updates'], {
            noteId: nullableString, noteTitle: nullableString,
            updates: updateObject({ title: { type: 'string', minLength: 1 }, content: nullableString, projectId: nullableString, tags: stringArray }),
          }),
          actionSchema('UPDATE_PROJECT', ['updates'], {
            projectId: nullableString, projectTitle: nullableString,
            updates: updateObject({ title: { type: 'string', minLength: 1 }, description: nullableString, status: { type: 'string' }, priority, color: { type: 'string' } }),
          }),
          actionSchema('UPDATE_HABIT', ['updates'], {
            habitId: nullableString, habitName: nullableString,
            updates: updateObject({ name: { type: 'string', minLength: 1 }, description: nullableString, frequency: { type: 'string' }, target_count: { type: 'number', minimum: 1 } }),
          }),
          actionSchema('SET_HABIT_COMPLETION', ['completionDate', 'completed'], {
            habitId: nullableString, habitName: nullableString, completionDate: { type: 'string', minLength: 10 }, completed: { type: 'boolean' },
          }),
          actionSchema('CREATE_REMINDER', ['title', 'remindAt'], {
            title: { type: 'string', minLength: 1 }, body: nullableString, remindAt: { type: 'string', minLength: 1 },
            type: { type: 'string', enum: ['task', 'habit', 'custom'] }, relatedEntityType: nullableString, relatedEntityId: nullableString,
          }),
          actionSchema('UPDATE_REMINDER', ['updates'], {
            reminderId: nullableString, reminderTitle: nullableString,
            updates: updateObject({ title: { type: 'string', minLength: 1 }, body: nullableString, remindAt: { type: 'string', minLength: 1 }, isRead: { type: 'boolean' } }),
          }),
          actionSchema('SNOOZE_REMINDER', ['remindAt'], {
            reminderId: nullableString, reminderTitle: nullableString, remindAt: { type: 'string', minLength: 1 },
          }),
          actionSchema('MARK_REMINDER_READ', ['isRead'], {
            reminderId: nullableString, reminderTitle: nullableString, isRead: { type: 'boolean' },
          }),
          actionSchema('LINK_TASK_NOTE', [], { taskId: nullableString, taskTitle: nullableString, noteId: nullableString, noteTitle: nullableString }),
          actionSchema('UNLINK_TASK_NOTE', [], { taskId: nullableString, taskTitle: nullableString, noteId: nullableString, noteTitle: nullableString }),
        ],
      },
    },
    proposals: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['kind', 'draft', 'confidence'],
        properties: {
          kind: { type: 'string', enum: ['task', 'note'] },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          draft: {
            type: 'object', additionalProperties: false, required: ['title'],
            properties: {
              title: { type: 'string', minLength: 1 }, description: { type: 'string' }, content: { type: 'string' },
              dueDate: { type: 'string' }, priority, tags: stringArray, checklist,
            },
          },
        },
      },
    },
  },
} as const;

function updateObject(properties: JsonObject) {
  return { type: 'object', additionalProperties: false, minProperties: 1, properties } as const;
}

function actionSchema(action: ExecutableAction, requiredParams: string[], properties: JsonObject) {
  return {
    type: 'object', additionalProperties: false, required: ['action', 'params'],
    properties: {
      action: { const: action },
      params: { type: 'object', additionalProperties: false, required: requiredParams, properties },
    },
  } as const;
}

export type ValidationResult =
  | { ok: true; value: AiResponse }
  | { ok: false; errors: string[] };

export function validateAiResponse(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) return { ok: false, errors: ['$ must be an object'] };
  rejectExtra(value, ['transcription', 'reply', 'actions', 'proposals'], '$', errors);
  requireString(value.transcription, '$.transcription', errors);
  requireString(value.reply, '$.reply', errors);
  if (!Array.isArray(value.actions)) errors.push('$.actions must be an array');
  else if (value.actions.length > 64) errors.push('$.actions must contain at most 64 items');
  else value.actions.forEach((action, index) => validateAction(action, `$.actions[${index}]`, errors));
  if (!Array.isArray(value.proposals)) errors.push('$.proposals must be an array');
  else value.proposals.forEach((proposal, index) => validateProposal(proposal, `$.proposals[${index}]`, errors));
  return errors.length ? { ok: false, errors } : { ok: true, value: value as unknown as AiResponse };
}

export function parseAiResponse(value: unknown): AiResponse {
  const result = validateAiResponse(value);
  if (result.ok === false) throw new Error(`Invalid AI response: ${result.errors.join('; ')}`);
  return result.value;
}

function validateAction(value: unknown, path: string, errors: string[]) {
  if (!isRecord(value)) return errors.push(`${path} must be an object`);
  rejectExtra(value, ['action', 'params'], path, errors);
  if (typeof value.action !== 'string' || !EXECUTABLE_ACTIONS.includes(value.action as ExecutableAction)) {
    errors.push(`${path}.action is not executable`);
    return;
  }
  if (!isRecord(value.params)) return errors.push(`${path}.params must be an object`);
  const validators: Record<ExecutableAction, (params: JsonObject) => void> = {
    CREATE_TASK: (params) => validateParams(params, ['title'], ['title', 'description', 'dueDate', 'priority', 'projectId', 'tags', 'checklist'], path, errors),
    CREATE_NOTE: (params) => validateParams(params, ['title'], ['title', 'content', 'projectId', 'tags'], path, errors),
    CREATE_PROJECT: (params) => validateParams(params, ['title'], ['title', 'description', 'priority', 'color'], path, errors),
    CREATE_HABIT: (params) => validateParams(params, ['name'], ['name', 'description', 'frequency', 'target_count'], path, errors),
    SUGGEST_LINK: (params) => validateParams(params, ['queryText'], ['queryText'], path, errors),
    UPDATE_TASK: (params) => validateTypedUpdate(params, ['taskId', 'title', 'taskTitle'], ['title', 'description', 'status', 'priority', 'dueDate', 'projectId', 'tags', 'checklist'], path, errors),
    COMPLETE_TASK: (params) => validateParams(params, [], ['taskId', 'title', 'taskTitle'], path, errors),
    REOPEN_TASK: (params) => validateParams(params, [], ['taskId', 'title', 'taskTitle'], path, errors),
    UPDATE_TASK_CHECKLIST: (params) => validateTypedUpdate(params, ['taskId', 'title', 'taskTitle'], ['checklist'], path, errors),
    UPDATE_NOTE: (params) => validateTypedUpdate(params, ['noteId', 'noteTitle'], ['title', 'content', 'projectId', 'tags'], path, errors),
    UPDATE_PROJECT: (params) => validateTypedUpdate(params, ['projectId', 'projectTitle'], ['title', 'description', 'status', 'priority', 'color'], path, errors),
    UPDATE_HABIT: (params) => validateTypedUpdate(params, ['habitId', 'habitName'], ['name', 'description', 'frequency', 'target_count'], path, errors),
    SET_HABIT_COMPLETION: (params) => validateParams(params, ['completionDate'], ['habitId', 'habitName', 'completionDate', 'completed'], path, errors),
    CREATE_REMINDER: (params) => validateParams(params, ['title', 'remindAt'], ['title', 'body', 'remindAt', 'type', 'relatedEntityType', 'relatedEntityId'], path, errors),
    UPDATE_REMINDER: (params) => validateTypedUpdate(params, ['reminderId', 'reminderTitle'], ['title', 'body', 'remindAt', 'isRead'], path, errors),
    SNOOZE_REMINDER: (params) => validateParams(params, ['remindAt'], ['reminderId', 'reminderTitle', 'remindAt'], path, errors),
    MARK_REMINDER_READ: (params) => validateParams(params, ['isRead'], ['reminderId', 'reminderTitle', 'isRead'], path, errors),
    LINK_TASK_NOTE: (params) => validateParams(params, [], ['taskId', 'taskTitle', 'noteId', 'noteTitle'], path, errors),
    UNLINK_TASK_NOTE: (params) => validateParams(params, [], ['taskId', 'taskTitle', 'noteId', 'noteTitle'], path, errors),
  };
  validators[value.action as ExecutableAction](value.params);
}

function validateParams(params: JsonObject, required: string[], allowed: string[], path: string, errors: string[]) {
  rejectExtra(params, allowed, `${path}.params`, errors);
  for (const key of required) {
    if (!(key in params)) errors.push(`${path}.params.${key} is required`);
  }
  validateCommonFields(params, `${path}.params`, errors);
}

function validateTypedUpdate(params: JsonObject, identifiers: string[], updateFields: string[], path: string, errors: string[]) {
  rejectExtra(params, [...identifiers, 'updates'], `${path}.params`, errors);
  if (!isRecord(params.updates) || Object.keys(params.updates).length === 0) {
    errors.push(`${path}.params.updates must be a non-empty object`);
    return;
  }
  rejectExtra(params.updates, updateFields, `${path}.params.updates`, errors);
  validateCommonFields(params.updates, `${path}.params.updates`, errors);
  validateCommonFields(params, `${path}.params`, errors);
}

function validateCommonFields(value: JsonObject, path: string, errors: string[]) {
  for (const key of ['title', 'name', 'queryText', 'remindAt', 'completionDate']) if (key in value) requireNonEmptyString(value[key], `${path}.${key}`, errors);
  for (const key of ['description', 'content', 'dueDate', 'projectId', 'taskId', 'taskTitle', 'noteId', 'noteTitle', 'projectTitle', 'habitId', 'habitName', 'reminderId', 'reminderTitle', 'body', 'relatedEntityType', 'relatedEntityId']) {
    if (key in value && value[key] !== null && typeof value[key] !== 'string') errors.push(`${path}.${key} must be a string or null`);
  }
  if ('priority' in value && !['low', 'medium', 'high'].includes(String(value.priority))) errors.push(`${path}.priority is invalid`);
  if ('type' in value && !['task', 'habit', 'custom'].includes(String(value.type))) errors.push(`${path}.type is invalid`);
  if ('tags' in value && (!Array.isArray(value.tags) || value.tags.some((tag) => typeof tag !== 'string'))) errors.push(`${path}.tags must be strings`);
  if ('target_count' in value && (typeof value.target_count !== 'number' || value.target_count < 1)) errors.push(`${path}.target_count must be at least 1`);
  for (const key of ['completed', 'isRead']) if (key in value && typeof value[key] !== 'boolean') errors.push(`${path}.${key} must be boolean`);
  if ('checklist' in value) validateChecklist(value.checklist, `${path}.checklist`, errors);
}

function validateChecklist(value: unknown, path: string, errors: string[]) {
  if (!Array.isArray(value)) return errors.push(`${path} must be an array`);
  value.forEach((item, index) => {
    if (!isRecord(item)) return errors.push(`${path}[${index}] must be an object`);
    rejectExtra(item, ['id', 'text', 'isCompleted'], `${path}[${index}]`, errors);
    requireNonEmptyString(item.text, `${path}[${index}].text`, errors);
    if ('id' in item && typeof item.id !== 'string') errors.push(`${path}[${index}].id must be a string`);
    if ('isCompleted' in item && typeof item.isCompleted !== 'boolean') errors.push(`${path}[${index}].isCompleted must be boolean`);
  });
}

function validateProposal(value: unknown, path: string, errors: string[]) {
  if (!isRecord(value)) return errors.push(`${path} must be an object`);
  rejectExtra(value, ['kind', 'draft', 'confidence'], path, errors);
  if (value.kind !== 'task' && value.kind !== 'note') errors.push(`${path}.kind is invalid`);
  if (typeof value.confidence !== 'number' || value.confidence < 0 || value.confidence > 1) errors.push(`${path}.confidence must be between 0 and 1`);
  if (!isRecord(value.draft)) return errors.push(`${path}.draft must be an object`);
  rejectExtra(value.draft, ['title', 'description', 'content', 'dueDate', 'priority', 'tags', 'checklist'], `${path}.draft`, errors);
  requireNonEmptyString(value.draft.title, `${path}.draft.title`, errors);
  validateCommonFields(value.draft, `${path}.draft`, errors);
}

function rejectExtra(value: JsonObject, allowed: readonly string[], path: string, errors: string[]) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) errors.push(`${path}.${key} is not allowed`);
}

function requireString(value: unknown, path: string, errors: string[]) {
  if (typeof value !== 'string') errors.push(`${path} must be a string`);
}

function requireNonEmptyString(value: unknown, path: string, errors: string[]) {
  if (typeof value !== 'string' || !value.trim()) errors.push(`${path} must be a non-empty string`);
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
