
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
}

export interface ChecklistItem {
  id: string;
  text: string;
  isCompleted: boolean;
}

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
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
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
  completedDates: string[]; // Joined from habit_completions in service layer
}

// --- App Specific Types ---

export type ChatMode = 'auto' | 'action' | 'memory';

export interface Citation {
  id: string;
  type: 'task' | 'note' | 'project';
  title: string;
  similarity: number;
}

export interface ActionResult {
    type: 'task' | 'note' | 'project' | 'habit';
    data: any; // The created/updated object
    operation: 'create' | 'update';
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
  };
  confidence: number;
  status: 'pending' | 'approved' | 'rejected';
}

