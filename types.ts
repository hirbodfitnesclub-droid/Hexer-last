
import { User } from '@supabase/supabase-js';

export type AppUser = User;

export interface Project {
  id: string; // uuid
  user_id: string; // uuid
  title: string; // text
  description?: string | null; // text
  status?: string | null; // text, e.g., 'active'
  priority: string; // text, e.g., 'medium' - made required for easier handling
  color: string; // text - made required
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
  version?: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  isCompleted: boolean;
}

/** End condition embedded in recurrence JSONB (no separate DB column). */
export type TaskRecurrenceEnd =
  | { kind: 'on_date'; date: string } // YYYY-MM-DD Tehran calendar day, inclusive
  | { kind: 'after_n'; remaining: number }; // further occurrences after this open one

export type TaskRecurrence =
  | { type: 'daily'; end?: TaskRecurrenceEnd }
  | { type: 'weekly'; weekdays: number[]; end?: TaskRecurrenceEnd } // Date.getDay(): 0=Sun … 6=Sat
  | { type: 'monthly'; days: number[]; end?: TaskRecurrenceEnd } // 1..31
  | { type: 'yearly'; dates: Array<{ month: number; day: number }>; end?: TaskRecurrenceEnd }; // Jalali month/day

export interface Task {
  id: string; // uuid
  user_id: string; // uuid
  project_id?: string | null; // uuid
  title: string; // text
  description?: string | null; // text
  status: string; // text, e.g., 'todo', 'done' - made required
  priority: string; // text, e.g., 'medium' - made required
  due_date?: string | null; // timestamptz
  completed_at?: string | null; // timestamptz
  tags?: string[] | null;
  checklist?: ChecklistItem[]; // New field for subtasks
  recurrence?: TaskRecurrence | null;
  recurrence_series_id?: string | null;
  recurrence_occurrence_key?: string | null;
  recurrence_sequence?: number;
  recurrence_status?: 'active' | 'completed' | 'skipped' | 'cancelled' | 'overridden';
  recurrence_rule_version?: number | null;
  recurrence_calculator_version?: string | null;
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
  version?: number;
}

export interface Note {
  id: string; // uuid
  user_id: string; // uuid
  project_id?: string | null; // uuid
  title: string; // text
  content?: string | null; // text
  tags?: string[] | null; // text[]
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
  version?: number;
}

export interface Habit {
  id: string; // uuid
  user_id: string; // uuid
  name: string; // text
  description?: string | null; // text
  frequency?: string | null; // text, e.g., 'daily'
  target_count?: number | null; // integer
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
  version?: number;
  completedDates: string[]; // Joined from habit_completions in service layer
}

// --- App Specific Types ---

export type ChatMode = 'auto' | 'action' | 'memory';

/** Structured search filters for AI chat (memory / type-aware RAG). */
export type ChatSearchFilters = {
  types?: Array<'task' | 'note' | 'project'>;
  timeRange?: 'all' | 'today' | 'last_week';
};

export interface Citation {
  id: string;
  type: 'task' | 'note' | 'project';
  title: string;
  snippet?: string;
  similarity: number;
}

export interface ActionResult {
    type: 'task' | 'note' | 'project' | 'habit' | 'reminder' | 'link' | 'habit_completion';
    data: any;
    operation: 'create' | 'update' | 'suggest_link' | 'link' | 'unlink' | 'complete' | 'undo';
    receiptId?: string;
    undoExpiresAt?: string;
    undoKind?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  mode?: ChatMode; // To track which mode generated this message
  citations?: Citation[]; // Sources used for the response
  actionResults?: ActionResult[]; // The items created/updated by the AI (Array support)
}

export enum Page {
  Dashboard = 'داشبورد',
  Tasks = 'کارها',
  Notes = 'یادداشت‌ها',
  Projects = 'پروژه‌ها',
  Chat = 'چت',
  Subscription = 'اشتراک',
}

export enum Priority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
}

export interface Plan {
  plan_code: string;
  display_name: string;
  price_irr: number;
  monthly_quota: number;
  period_days: number;
  ai_model: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_code: string;
  status: 'active' | 'expired' | 'canceled' | 'pending' | 'pending_manual';
  started_at: string;
  expires_at: string;
}

export type ManualPaymentStatus = 'none' | 'pending' | 'rejected';

export interface ManualPaymentState {
  state: ManualPaymentStatus;
  reason?: string;
}

export interface UsageStatus {
  plan_code: string;
  display_name: string;
  monthly_quota: number;
  request_count: number;
  remaining: number;
  period_start: string;
  period_end: string;
  expires_at: string;
}

export interface EntityLink {
  id: string;
  user_id: string;
  task_id: string;
  note_id: string;
  created_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  session_date: string; // YYYY-MM-DD
  created_at: string;
}

export interface ExtractionProposal {
  id: string; // Client-side generated uuid/temp-id
  kind: 'task' | 'note';
  draft: {
    title: string;
    description?: string;
    content?: string;
    dueDate?: string; // YYYY-MM-DD
    priority?: 'low' | 'medium' | 'high';
    tags?: string[];
    project_id?: string | null;
    /** Sub-tasks — same shape as Task.checklist (AI / media parity) */
    checklist?: ChecklistItem[];
  };
  confidence: number;
  status: 'pending' | 'approved' | 'rejected';
}

