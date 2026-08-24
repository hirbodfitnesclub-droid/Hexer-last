begin;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema public;
create extension if not exists pg_trgm with schema public;
create extension if not exists vector with schema public;

CREATE OR REPLACE FUNCTION public.hexer_fa_normalize(p_input text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE PARALLEL SAFE
AS $function$
BEGIN
  RETURN lower(
    regexp_replace(
      translate(
        COALESCE(p_input, ''),
        -- Normalizing Arabic Yeh -> Persian, Arabic Kaf -> Persian Keheh, ZWNJ -> space, hyphen -> space to bypass websearch NOT behavior, delete diacritics and kashida
        E'\u064A\u0643\u200C-\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652\u0640',
        E'\u06CC\u06A9  '
      ),
      '\s+', ' ', 'g'
    )
  );
END;
$function$;
CREATE OR REPLACE FUNCTION public.immutable_array_to_string(p_arr text[], p_sep text DEFAULT ' '::text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
AS $function$
    SELECT array_to_string(p_arr, p_sep);
$function$;
create table if not exists public.ai_requests_log (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  mode text not null,
  model text not null,
  tokens_estimate integer,
  created_at timestamp with time zone default now(),
  constraint ai_requests_log_pkey PRIMARY KEY (id)
);
create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  session_id uuid not null,
  sender text not null,
  text text not null,
  mode text,
  citations jsonb default '[]'::jsonb,
  action_results jsonb default '[]'::jsonb,
  created_at timestamp with time zone default now(),
  constraint chat_messages_pkey PRIMARY KEY (id),
  constraint chat_messages_sender_check CHECK (sender = ANY (ARRAY['user'::text, 'ai'::text]))
);
create table if not exists public.chat_sessions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  session_date date not null,
  created_at timestamp with time zone default now(),
  constraint chat_sessions_pkey PRIMARY KEY (id),
  constraint chat_sessions_user_id_session_date_key UNIQUE (user_id, session_date)
);
create table if not exists public.daily_briefs (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  brief_date date not null,
  content text not null,
  tasks_signature text not null,
  model text default 'deepseek/deepseek-v4-flash'::text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint daily_briefs_pkey PRIMARY KEY (id),
  constraint daily_briefs_user_id_brief_date_key UNIQUE (user_id, brief_date)
);
create table if not exists public.discount_codes (
  id uuid default gen_random_uuid() not null,
  code text not null,
  discount_percent integer,
  discount_amount_irr bigint,
  max_uses integer,
  used_count integer default 0 not null,
  expires_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  is_active boolean default true not null,
  constraint check_discount_type CHECK (discount_percent IS NOT NULL AND discount_amount_irr IS NULL OR discount_percent IS NULL AND discount_amount_irr IS NOT NULL),
  constraint check_limits CHECK (max_uses IS NULL OR used_count <= max_uses),
  constraint discount_codes_code_key UNIQUE (code),
  constraint discount_codes_discount_amount_irr_check CHECK (discount_amount_irr >= 0),
  constraint discount_codes_discount_percent_check CHECK (discount_percent >= 0 AND discount_percent <= 100),
  constraint discount_codes_pkey PRIMARY KEY (id)
);
create table if not exists public.habit_completions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  habit_id uuid not null,
  completion_date date not null,
  created_at timestamp with time zone default now(),
  constraint habit_completions_habit_id_completion_date_key UNIQUE (habit_id, completion_date),
  constraint habit_completions_pkey PRIMARY KEY (id)
);
create table if not exists public.habits (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  name text not null,
  description text,
  frequency text default 'daily'::text,
  target_count integer,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint habits_pkey PRIMARY KEY (id)
);
create table if not exists public.media_assets (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  bucket text not null,
  path text not null,
  mime_type text,
  size_bytes bigint,
  purpose text,
  created_at timestamp with time zone default now(),
  constraint media_assets_pkey PRIMARY KEY (id)
);
create table if not exists public.notes (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  project_id uuid,
  title text not null,
  content text,
  tags text[],
  embedding vector(768),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  search_vector tsvector generated always as ((setweight(to_tsvector('simple'::regconfig, hexer_fa_normalize(title)), 'A'::"char") || setweight(to_tsvector('simple'::regconfig, hexer_fa_normalize(COALESCE(content, ''::text))), 'B'::"char")) || setweight(to_tsvector('simple'::regconfig, hexer_fa_normalize(COALESCE(immutable_array_to_string(tags, ' '::text), ''::text))), 'C'::"char")) stored,
  constraint notes_pkey PRIMARY KEY (id)
);
create table if not exists public.payments (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  plan_code text not null,
  amount_irr bigint not null,
  gateway text default 'zibal'::text not null,
  track_id text,
  ref_number text,
  status text default 'pending'::text not null,
  created_at timestamp with time zone default now(),
  paid_at timestamp with time zone,
  discount_code_id uuid,
  discount_amount_irr bigint default 0,
  final_amount_irr bigint default 0,
  offline_receipt_url text,
  manual_decline_reason text,
  constraint payments_pkey PRIMARY KEY (id)
);
create table if not exists public.plans (
  plan_code text not null,
  display_name text not null,
  price_irr bigint not null,
  monthly_quota integer not null,
  period_days integer not null,
  ai_model text not null,
  constraint plans_pkey PRIMARY KEY (plan_code)
);
create table if not exists public.profiles (
  id uuid not null,
  full_name text,
  avatar_url text,
  timezone text default 'Asia/Tehran'::text,
  onboarding_completed boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  specialty text,
  interests text[] default '{}'::text[],
  anonymous_id uuid,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  constraint profiles_pkey PRIMARY KEY (id)
);
create table if not exists public.projects (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  title text not null,
  description text,
  status text default 'active'::text,
  priority text default 'medium'::text,
  color text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  embedding vector(768),
  search_vector tsvector generated always as (setweight(to_tsvector('simple'::regconfig, hexer_fa_normalize(title)), 'A'::"char") || setweight(to_tsvector('simple'::regconfig, hexer_fa_normalize(COALESCE(description, ''::text))), 'B'::"char")) stored,
  constraint projects_pkey PRIMARY KEY (id)
);
create table if not exists public.push_dispatch_log (
  id uuid default gen_random_uuid() not null,
  ran_at timestamp with time zone default now() not null,
  sent_count integer default 0 not null,
  failed_count integer default 0 not null,
  cleaned_count integer default 0 not null,
  notes text,
  constraint push_dispatch_log_pkey PRIMARY KEY (id)
);
create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamp with time zone default now(),
  constraint push_subscriptions_pkey PRIMARY KEY (id),
  constraint push_subscriptions_user_id_endpoint_key UNIQUE (user_id, endpoint)
);
create table if not exists public.reminders (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  title text not null,
  body text,
  remind_at timestamp with time zone not null,
  type text not null,
  related_entity_type text,
  related_entity_id uuid,
  is_sent boolean default false,
  is_read boolean default false,
  created_at timestamp with time zone default now(),
  constraint reminders_pkey PRIMARY KEY (id)
);
create table if not exists public.subscriptions (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  plan_code text not null,
  status text default 'active'::text not null,
  started_at timestamp with time zone default now(),
  expires_at timestamp with time zone not null,
  updated_at timestamp with time zone default now(),
  constraint subscriptions_pkey PRIMARY KEY (id),
  constraint subscriptions_user_id_key UNIQUE (user_id)
);
create table if not exists public.support_tickets (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  subject text not null,
  message text not null,
  status text default 'open'::text not null,
  created_at timestamp with time zone default now() not null,
  constraint chk_status CHECK (status = ANY (ARRAY['open'::text, 'closed'::text])),
  constraint support_tickets_pkey PRIMARY KEY (id)
);
create table if not exists public.task_note_links (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  task_id uuid not null,
  note_id uuid not null,
  created_at timestamp with time zone default now(),
  constraint task_note_links_pkey PRIMARY KEY (id),
  constraint task_note_links_task_id_note_id_key UNIQUE (task_id, note_id)
);
create table if not exists public.tasks (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  project_id uuid,
  title text not null,
  description text,
  status text default 'todo'::text,
  priority text default 'medium'::text,
  due_date timestamp with time zone,
  completed_at timestamp with time zone,
  tags text[],
  checklist jsonb default '[]'::jsonb,
  embedding vector(768),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  search_vector tsvector generated always as ((setweight(to_tsvector('simple'::regconfig, hexer_fa_normalize(title)), 'A'::"char") || setweight(to_tsvector('simple'::regconfig, hexer_fa_normalize(COALESCE(description, ''::text))), 'B'::"char")) || setweight(to_tsvector('simple'::regconfig, hexer_fa_normalize(COALESCE(immutable_array_to_string(tags, ' '::text), ''::text))), 'C'::"char")) stored,
  recurrence jsonb,
  recurrence_series_id uuid,
  constraint tasks_pkey PRIMARY KEY (id)
);
create table if not exists public.telegram_settings (
  id integer default 1 not null,
  bot_token text,
  chat_id text,
  is_enabled boolean default true not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  constraint one_row CHECK (id = 1),
  constraint telegram_settings_pkey PRIMARY KEY (id)
);
create table if not exists public.usage_counters (
  user_id uuid not null,
  period_start timestamp with time zone default now() not null,
  period_end timestamp with time zone not null,
  request_count integer default 0 not null,
  updated_at timestamp with time zone default now(),
  constraint usage_counters_pkey PRIMARY KEY (user_id)
);

alter table public.ai_requests_log add constraint ai_requests_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.chat_messages add constraint chat_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.chat_sessions(id) ON DELETE CASCADE;
alter table public.chat_messages add constraint chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.chat_sessions add constraint chat_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.daily_briefs add constraint daily_briefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.habit_completions add constraint habit_completions_habit_id_fkey FOREIGN KEY (habit_id) REFERENCES public.habits(id) ON DELETE CASCADE;
alter table public.habit_completions add constraint habit_completions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.habits add constraint habits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.media_assets add constraint media_assets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.notes add constraint notes_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
alter table public.notes add constraint notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.payments add constraint payments_discount_code_id_fkey FOREIGN KEY (discount_code_id) REFERENCES public.discount_codes(id) ON DELETE SET NULL;
alter table public.payments add constraint payments_plan_code_fkey FOREIGN KEY (plan_code) REFERENCES public.plans(plan_code);
alter table public.payments add constraint payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.projects add constraint projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.push_subscriptions add constraint push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.reminders add constraint reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.subscriptions add constraint subscriptions_plan_code_fkey FOREIGN KEY (plan_code) REFERENCES public.plans(plan_code);
alter table public.subscriptions add constraint subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.support_tickets add constraint support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.task_note_links add constraint task_note_links_note_id_fkey FOREIGN KEY (note_id) REFERENCES public.notes(id) ON DELETE CASCADE;
alter table public.task_note_links add constraint task_note_links_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
alter table public.task_note_links add constraint task_note_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.tasks add constraint tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE SET NULL;
alter table public.tasks add constraint tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.usage_counters add constraint usage_counters_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX idx_chat_messages_session_order ON public.chat_messages USING btree (user_id, session_id, created_at);
CREATE INDEX idx_chat_sessions_session_date ON public.chat_sessions USING btree (session_date);
CREATE INDEX idx_chat_sessions_user_id ON public.chat_sessions USING btree (user_id);
CREATE INDEX idx_daily_briefs_user_date ON public.daily_briefs USING btree (user_id, brief_date);
CREATE INDEX idx_discount_codes_code ON public.discount_codes USING btree (code);
CREATE INDEX idx_habit_completions_habit_id ON public.habit_completions USING btree (habit_id);
CREATE INDEX idx_habit_completions_habit_id_completion_date ON public.habit_completions USING btree (habit_id, completion_date);
CREATE INDEX idx_habit_completions_user_id ON public.habit_completions USING btree (user_id);
CREATE INDEX idx_habits_user_id ON public.habits USING btree (user_id);
CREATE INDEX idx_media_assets_user_id ON public.media_assets USING btree (user_id);
CREATE INDEX idx_notes_embedding_hnsw ON public.notes USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_notes_project_id ON public.notes USING btree (project_id);
CREATE INDEX idx_notes_search_vector ON public.notes USING gin (search_vector);
CREATE INDEX idx_notes_user_id ON public.notes USING btree (user_id);
CREATE INDEX idx_notes_user_id_created_at_desc ON public.notes USING btree (user_id, created_at DESC);
CREATE INDEX idx_payments_user_id ON public.payments USING btree (user_id);
CREATE INDEX idx_profiles_anonymous_id ON public.profiles USING btree (anonymous_id);
CREATE INDEX idx_projects_search_vector ON public.projects USING gin (search_vector);
CREATE INDEX idx_projects_user_id ON public.projects USING btree (user_id);
CREATE INDEX idx_push_subs_user ON public.push_subscriptions USING btree (user_id);
CREATE INDEX idx_reminders_user_id_remind_at ON public.reminders USING btree (user_id, remind_at);
CREATE INDEX idx_support_tickets_user_created ON public.support_tickets USING btree (user_id, created_at);
CREATE INDEX idx_task_note_links_note_id ON public.task_note_links USING btree (note_id);
CREATE INDEX idx_task_note_links_task_id ON public.task_note_links USING btree (task_id);
CREATE INDEX idx_task_note_links_user_id ON public.task_note_links USING btree (user_id);
CREATE INDEX idx_tasks_due_pending ON public.tasks USING btree (due_date) WHERE (completed_at IS NULL);
CREATE INDEX idx_tasks_embedding_hnsw ON public.tasks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_tasks_project_id ON public.tasks USING btree (project_id);
CREATE INDEX idx_tasks_recurrence_series_id ON public.tasks USING btree (user_id, recurrence_series_id) WHERE (recurrence_series_id IS NOT NULL);
CREATE INDEX idx_tasks_search_vector ON public.tasks USING gin (search_vector);
CREATE INDEX idx_tasks_user_id ON public.tasks USING btree (user_id);
CREATE INDEX idx_tasks_user_id_created_at_desc ON public.tasks USING btree (user_id, created_at DESC);
CREATE INDEX idx_tasks_user_id_due_date ON public.tasks USING btree (user_id, due_date);

CREATE OR REPLACE FUNCTION public.activate_manual_subscription(p_payment_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_payment_status TEXT;
    v_plan_code TEXT;
    v_user_id UUID;
    v_period_days INT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- 1. Read payment and user ID, and validate state
    SELECT status, plan_code, user_id
    INTO v_payment_status, v_plan_code, v_user_id
    FROM public.payments
    WHERE id = p_payment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'تراکنش پرداخت یافت نشد.';
    END IF;

    IF v_payment_status != 'pending_manual' THEN
        RAISE EXCEPTION 'وضعیت تراکنش برای ارتقای اشتراک نامعتبر است.';
    END IF;

    -- 2. Fetch Plan period
    SELECT period_days INTO v_period_days
    FROM public.plans
    WHERE plan_code = v_plan_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'طرح اشتراک مربوطه یافت نشد.';
    END IF;

    -- 3. Update payment status
    UPDATE public.payments
    SET status = 'paid', paid_at = now()
    WHERE id = p_payment_id;

    -- 4. Upsert subscription
    v_expires_at := now() + (interval '1 day' * v_period_days);

    INSERT INTO public.subscriptions (user_id, plan_code, status, started_at, expires_at, updated_at)
    VALUES (v_user_id, v_plan_code, 'active', now(), v_expires_at, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
        plan_code = EXCLUDED.plan_code,
        status = 'active',
        started_at = EXCLUDED.started_at,
        expires_at = EXCLUDED.expires_at,
        updated_at = now();

    -- 5. Reset user usage counter
    INSERT INTO public.usage_counters (user_id, period_start, period_end, request_count, updated_at)
    VALUES (v_user_id, now(), v_expires_at, 0, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
        period_start = EXCLUDED.period_start,
        period_end = EXCLUDED.period_end,
        request_count = 0,
        updated_at = now();

    -- Return true (since coupon was already reserved inside submit_manual_payment)
    RETURN TRUE;
END;
$function$;
CREATE OR REPLACE FUNCTION public.activate_subscription(p_user_id uuid, p_plan_code text, p_payment_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_payment_status TEXT;
    v_period_days INT;
    v_expires_at TIMESTAMPTZ;
    v_discount_code_id UUID;
    v_discount_code TEXT;
    v_max_uses INT;
    v_used_count INT;
    v_expires_at_code TIMESTAMPTZ;
BEGIN
    -- 1. Validate payment trace records and extract discount fields
    SELECT status, discount_code_id INTO v_payment_status, v_discount_code_id
    FROM public.payments 
    WHERE id = p_payment_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Record of payment not found.';
    END IF;

    -- Update order status to paid (Idempotency check)
    IF v_payment_status = 'pending' THEN
        -- Check and process discount code capacity if any exists
        IF v_discount_code_id IS NOT NULL THEN
            -- Lock the discount code row to prevent race conditions during concurrent verifications
            SELECT code, max_uses, used_count, expires_at 
            INTO v_discount_code, v_max_uses, v_used_count, v_expires_at_code
            FROM public.discount_codes
            WHERE id = v_discount_code_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Discount code not found.';
            END IF;

            -- Validate expiration
            IF v_expires_at_code IS NOT NULL AND v_expires_at_code < now() THEN
                RAISE EXCEPTION 'کد تخفیف % منقضی شده است.', v_discount_code;
            END IF;

            -- Guardrail 2: Strict limit capacity check inside active transaction
            -- If used_count already reached max_uses, RAISE EXCEPTION to roll back transaction
            IF v_max_uses IS NOT NULL AND v_used_count >= v_max_uses THEN
                RAISE EXCEPTION 'کد تخفیف % ظرفیت آن به پایان رسیده است و فعال‌سازی لغو گردید.', v_discount_code;
            END IF;

            -- Increment used counter
            UPDATE public.discount_codes
            SET used_count = used_count + 1
            WHERE id = v_discount_code_id;
        END IF;

        UPDATE public.payments
        SET status = 'paid', paid_at = now()
        WHERE id = p_payment_id AND user_id = p_user_id;
    ELSIF v_payment_status != 'paid' THEN
        RAISE EXCEPTION 'Payment is in an invalid state: %', v_payment_status;
    END IF;

    -- 2. Extract Plan boundaries
    SELECT period_days INTO v_period_days
    FROM public.plans
    WHERE plan_code = p_plan_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Plan code % not found.', p_plan_code;
    END IF;

    v_expires_at := now() + (interval '1 day' * v_period_days);

    -- 3. Upsert subscriptions schema
    INSERT INTO public.subscriptions (user_id, plan_code, status, started_at, expires_at, updated_at)
    VALUES (p_user_id, p_plan_code, 'active', now(), v_expires_at, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        plan_code = EXCLUDED.plan_code,
        status = 'active',
        started_at = EXCLUDED.started_at,
        expires_at = EXCLUDED.expires_at,
        updated_at = now();

    -- 4. Upsert dynamic usage tracker
    INSERT INTO public.usage_counters (user_id, period_start, period_end, request_count, updated_at)
    VALUES (p_user_id, now(), v_expires_at, 0, now())
    ON CONFLICT (user_id)
    DO UPDATE SET
        period_start = EXCLUDED.period_start,
        period_end = EXCLUDED.period_end,
        request_count = 0,
        updated_at = now();

    RETURN TRUE;
END;
$function$;
CREATE OR REPLACE FUNCTION public.consume_ai_quota()
 RETURNS TABLE(allowed boolean, model text, remaining integer, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_sub_plan TEXT;
    v_sub_status TEXT;
    v_sub_expires TIMESTAMPTZ;
    v_plan_quota INT;
    v_plan_period_days INT;
    v_plan_model TEXT;
    v_counter_start TIMESTAMPTZ;
    v_counter_end TIMESTAMPTZ;
    v_counter_count INT;
    v_new_count INT;
    v_remaining INT;
BEGIN
    -- 1. Establish User context safely
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN QUERY SELECT false, NULL::text, 0, 'unauthorized'::text;
        RETURN;
    END IF;

    -- 2. Fetch Active status & plan restrictions
    SELECT 
        s.plan_code, s.status, s.expires_at, p.monthly_quota, p.period_days, p.ai_model
    INTO 
        v_sub_plan, v_sub_status, v_sub_expires, v_plan_quota, v_plan_period_days, v_plan_model
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_code = p.plan_code
    WHERE s.user_id = v_user_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::text, 0, 'no_subscription'::text;
        RETURN;
    END IF;

    -- 3. Locking user counters to avoid race conditions
    SELECT 
        period_start, period_end, request_count
    INTO 
        v_counter_start, v_counter_end, v_counter_count
    FROM public.usage_counters
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        -- Initialize usage counter if missing
        INSERT INTO public.usage_counters (user_id, period_start, period_end, request_count, updated_at)
        VALUES (v_user_id, now(), v_sub_expires, 0, now())
        RETURNING period_start, period_end, request_count INTO v_counter_start, v_counter_end, v_counter_count;
    END IF;

    -- 4. Verify Free Plan rules
    IF v_sub_plan = 'free' THEN
        -- Checks expiration
        IF now() > v_sub_expires THEN
            RETURN QUERY SELECT false, v_plan_model, 0, 'trial_expired'::text;
            RETURN;
        END IF;
        -- Checks quota
        IF v_counter_count >= v_plan_quota THEN
            RETURN QUERY SELECT false, v_plan_model, 0, 'quota_exceeded'::text;
            RETURN;
        END IF;
    ELSE
        -- 5. Verify Paid Plans rules
        IF v_sub_status != 'active' OR now() > v_sub_expires THEN
            RETURN QUERY SELECT false, v_plan_model, 0, 'subscription_expired'::text;
            RETURN;
        END IF;

        -- Dynamic Period Reset if billing cycle ended (Atomic Reset)
        IF now() > v_counter_end THEN
            v_counter_start := now();
            v_counter_end := now() + (interval '1 day' * v_plan_period_days);
            v_counter_count := 0;

            UPDATE public.usage_counters
            SET 
                period_start = v_counter_start,
                period_end = v_counter_end,
                request_count = v_counter_count,
                updated_at = now()
            WHERE user_id = v_user_id;
        END IF;

        -- Check quota limits
        IF v_counter_count >= v_plan_quota THEN
            RETURN QUERY SELECT false, v_plan_model, 0, 'quota_exceeded'::text;
            RETURN;
        END IF;
    END IF;

    -- 6. Process quota usage transaction
    v_new_count := v_counter_count + 1;
    v_remaining := GREATEST(0, v_plan_quota - v_new_count);

    UPDATE public.usage_counters
    SET 
        request_count = v_new_count,
        updated_at = now()
    WHERE user_id = v_user_id;

    -- Insert request log
    INSERT INTO public.ai_requests_log (user_id, mode, model, created_at)
    VALUES (v_user_id, 'consume_ai_quota', v_plan_model, now());

    RETURN QUERY SELECT true, v_plan_model, v_remaining, 'quota_available'::text;
END;
$function$;
CREATE OR REPLACE FUNCTION public.create_note_with_tags(p_title text, p_content text DEFAULT NULL::text, p_project_id uuid DEFAULT NULL::uuid, p_tags text[] DEFAULT '{}'::text[], p_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF notes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_id UUID := COALESCE(p_id, gen_random_uuid());
BEGIN
    INSERT INTO public.notes (
        id, user_id, project_id, title, content, tags, created_at, updated_at
    )
    VALUES (
        v_id, auth.uid(), p_project_id, p_title, p_content, p_tags, now(), now()
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN QUERY
        SELECT * FROM public.notes WHERE id = v_id AND user_id = auth.uid();
END;
$function$;
CREATE OR REPLACE FUNCTION public.create_task_with_tags(p_title text, p_description text DEFAULT NULL::text, p_project_id uuid DEFAULT NULL::uuid, p_due_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_priority text DEFAULT 'medium'::text, p_tags text[] DEFAULT '{}'::text[], p_checklist jsonb DEFAULT '[]'::jsonb, p_id uuid DEFAULT NULL::uuid, p_recurrence jsonb DEFAULT NULL::jsonb, p_recurrence_series_id uuid DEFAULT NULL::uuid)
 RETURNS SETOF tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_id UUID := COALESCE(p_id, gen_random_uuid());
BEGIN
    INSERT INTO public.tasks (
        id, user_id, project_id, title, description, priority, due_date, tags, checklist,
        recurrence, recurrence_series_id, created_at, updated_at
    )
    VALUES (
        v_id, auth.uid(), p_project_id, p_title, p_description, p_priority, p_due_date, p_tags, p_checklist,
        p_recurrence, p_recurrence_series_id, now(), now()
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN QUERY
        SELECT * FROM public.tasks WHERE id = v_id AND user_id = auth.uid();
END;
$function$;
CREATE OR REPLACE FUNCTION public.enqueue_vectorize()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_supabase_url TEXT;
    v_service_key TEXT;
    v_content TEXT;
    v_type TEXT;
BEGIN
    -- STEP 1: Fetch Supabase Endpoint URL from configurations
    v_supabase_url := COALESCE(
        NULLIF(current_setting('app.settings.supabase_url', true), ''),
        NULLIF(current_setting('app.settings.supabase_api_url', true), ''),
        'http://kong:8000' -- fallback default for local docker/emulator
    );

    -- STEP 2: Fetch Secure Service Role Key
    v_service_key := COALESCE(
        NULLIF(current_setting('app.settings.supabase_service_role_key', true), ''),
        NULLIF(current_setting('app.settings.service_role_key', true), ''),
        NULLIF(current_setting('app.settings.service_key', true), ''),
        '' -- empty fallback to prevent execution if unconfigured in cloud
    );

    -- STEP 3: Handle missing service key gracefully on production/cloud environments
    IF v_service_key = '' AND v_supabase_url NOT LIKE '%kong%' AND v_supabase_url NOT LIKE '%localhost%' THEN
        RAISE WARNING 'enqueue_vectorize skipped: app.settings.supabase_service_role_key is empty. Please run altered database commands.';
        RETURN NEW;
    END IF;

    -- STEP 4: Determine schema types and collect vectorized content string
    IF TG_TABLE_NAME = 'tasks' THEN
        v_type := 'task';
        v_content := COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.description, '');
    ELSIF TG_TABLE_NAME = 'notes' THEN
        v_type := 'note';
        v_content := COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.content, '');
    ELSIF TG_TABLE_NAME = 'projects' THEN
        v_type := 'project';
        v_content := COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.description, '');
    ELSE
        RETURN NEW;
    END IF;

    -- Avoid sending request if content is completely empty
    IF TRIM(v_content) = '' THEN
        RETURN NEW;
    END IF;

    -- STEP 5: Perform non-blocking webhook request using pg_net
    PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/vectorize',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
        ),
        body := jsonb_build_object(
            'type', v_type,
            'id', NEW.id,
            'content', v_content
        )
    );

    RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_chat_sessions(p_limit integer)
 RETURNS SETOF chat_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Lazy auto-cleanup fallback for older chat sessions representing retention period
    DELETE FROM public.chat_sessions
    WHERE user_id = v_user_id 
      AND session_date < ((now() AT TIME ZONE 'Asia/Tehran')::date - INTERVAL '30 days');

    RETURN QUERY
    SELECT * FROM public.chat_sessions
    WHERE user_id = v_user_id
    ORDER BY session_date DESC
    LIMIT p_limit;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_daily_nudge_candidates()
 RETURNS TABLE(user_id uuid, endpoint text, p256dh text, auth text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Restrict daily nudge triggers to waking hours (hour >= 9 AM in Tehran)
  if extract(hour from now() at time zone 'Asia/Tehran') >= 9 then
    return query
    select distinct
      s.user_id,
      s.endpoint,
      s.p256dh,
      s.auth
    from public.push_subscriptions s
    -- The user must have at least one uncompleted task due today
    where exists (
      select 1 from public.tasks t
      where t.user_id = s.user_id
        and t.completed_at is null
        and (t.due_date at time zone 'Asia/Tehran')::date = (now() at time zone 'Asia/Tehran')::date
    )
    -- The user must not have received a daily nudge today yet
    and not exists (
      select 1 from public.reminders r
      where r.user_id = s.user_id
        and r.type = 'custom'
        and r.related_entity_type = 'daily_nudge'
        and (r.created_at at time zone 'Asia/Tehran')::date = (now() at time zone 'Asia/Tehran')::date
    );
  end if;
end; $function$;
CREATE OR REPLACE FUNCTION public.get_daily_usage(p_days integer)
 RETURNS TABLE(usage_date date, request_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    RETURN QUERY
    SELECT 
        (created_at AT TIME ZONE 'Asia/Tehran')::date AS usage_date,
        COUNT(*)::int AS request_count
    FROM public.ai_requests_log
    WHERE user_id = v_user_id 
      AND created_at >= (now() AT TIME ZONE 'Asia/Tehran' - (p_days || ' days')::interval)
    GROUP BY (created_at AT TIME ZONE 'Asia/Tehran')::date
    ORDER BY usage_date ASC;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_linked_notes(p_task_id uuid)
 RETURNS SETOF notes
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Verify task ownership first
    IF NOT EXISTS(SELECT 1 FROM public.tasks WHERE id = p_task_id AND user_id = v_user_id) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT n.*
    FROM public.notes n
    JOIN public.task_note_links l ON n.id = l.note_id
    WHERE l.task_id = p_task_id AND l.user_id = v_user_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_linked_tasks(p_note_id uuid)
 RETURNS SETOF tasks
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Verify note ownership first
    IF NOT EXISTS(SELECT 1 FROM public.notes WHERE id = p_note_id AND user_id = v_user_id) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT t.*
    FROM public.tasks t
    JOIN public.task_note_links l ON t.id = l.task_id
    WHERE l.note_id = p_note_id AND l.user_id = v_user_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_or_create_today_session()
 RETURNS SETOF chat_sessions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_today DATE;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    v_today := (now() AT TIME ZONE 'Asia/Tehran')::date;

    -- Try insertion; handle duplicate key constraint gracefully
    INSERT INTO public.chat_sessions (user_id, session_date)
    VALUES (v_user_id, v_today)
    ON CONFLICT (user_id, session_date) DO NOTHING;

    RETURN QUERY
    SELECT * FROM public.chat_sessions
    WHERE user_id = v_user_id AND session_date = v_today;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_related_knowledge_today(p_date text DEFAULT NULL::text)
 RETURNS TABLE(task_id uuid, task_title text, note_id uuid, note_title text, note_snippet text, similarity double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_date DATE;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Parse input date, fallback to Tehran today if null or empty
    IF p_date IS NULL OR p_date = '' THEN
        v_date := (now() AT TIME ZONE 'Asia/Tehran')::date;
    ELSE
        -- Safeguard date parsing
        BEGIN
            v_date := p_date::date;
        EXCEPTION WHEN OTHERS THEN
            v_date := (now() AT TIME ZONE 'Asia/Tehran')::date;
        END;
    END IF;

    RETURN QUERY
    WITH matches AS (
        SELECT 
            t.id AS m_task_id,
            t.title AS m_task_title,
            n_matches.id AS m_note_id,
            n_matches.title AS m_note_title,
            left(n_matches.content, 120) AS m_note_snippet,
            n_matches.sim::float8 AS m_similarity
        FROM (
            SELECT id, title, embedding
            FROM public.tasks
            WHERE user_id = v_user_id
              AND status NOT IN ('done', 'deleted', 'archived')
              AND embedding IS NOT NULL
              -- Match tasks where due_date is p_date under Asia/Tehran timezone
              AND (due_date AT TIME ZONE 'Asia/Tehran')::date = v_date
        ) t
        CROSS JOIN LATERAL (
            SELECT n.id, n.title, n.content,
                   (1 - (n.embedding <=> t.embedding))::float8 AS sim
            FROM public.notes n
            WHERE n.user_id = v_user_id
              AND n.embedding IS NOT NULL
              AND (1 - (n.embedding <=> t.embedding)) >= 0.5
            ORDER BY n.embedding <=> t.embedding
            LIMIT 2
        ) n_matches
    ),
    deduped AS (
        SELECT 
            m.m_task_id, m.m_task_title, m.m_note_id, m.m_note_title, m.m_note_snippet, m.m_similarity,
            ROW_NUMBER() OVER (PARTITION BY m.m_note_id ORDER BY m.m_similarity DESC) as rn
        FROM matches m
    )
    SELECT 
        d.m_task_id AS task_id, 
        d.m_task_title AS task_title, 
        d.m_note_id AS note_id, 
        d.m_note_title AS note_title, 
        d.m_note_snippet AS note_snippet, 
        d.m_similarity AS similarity
    FROM deduped d
    WHERE d.rn = 1
    ORDER BY d.m_similarity DESC
    LIMIT 8;
END;
$function$;
CREATE OR REPLACE FUNCTION public.get_usage_status()
 RETURNS TABLE(plan_code text, display_name text, monthly_quota integer, request_count integer, remaining integer, period_start timestamp with time zone, period_end timestamp with time zone, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    RETURN QUERY
    SELECT 
        s.plan_code::text,
        p.display_name::text,
        p.monthly_quota::int,
        COALESCE(c.request_count, 0)::int,
        GREATEST(0, p.monthly_quota - COALESCE(c.request_count, 0))::int AS remaining,
        COALESCE(c.period_start, s.started_at) AS period_start,
        COALESCE(c.period_end, s.expires_at) AS period_end,
        s.expires_at
    FROM public.subscriptions s
    JOIN public.plans p ON s.plan_code = p.plan_code
    LEFT JOIN public.usage_counters c ON s.user_id = c.user_id
    WHERE s.user_id = v_user_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- Insert Profile & Attribution Data
    INSERT INTO public.profiles (
        id, full_name, avatar_url, timezone, onboarding_completed, created_at, updated_at,
        anonymous_id, utm_source, utm_medium, utm_campaign, utm_content, utm_term
    )
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
        COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
        'Asia/Tehran',
        false,
        now(),
        now(),
        NULLIF(new.raw_user_meta_data->>'anonymous_id', '')::UUID,
        new.raw_user_meta_data->>'utm_source',
        new.raw_user_meta_data->>'utm_medium',
        new.raw_user_meta_data->>'utm_campaign',
        new.raw_user_meta_data->>'utm_content',
        new.raw_user_meta_data->>'utm_term'
    )
    ON CONFLICT (id) DO UPDATE SET
        anonymous_id = EXCLUDED.anonymous_id,
        utm_source = EXCLUDED.utm_source,
        utm_medium = EXCLUDED.utm_medium,
        utm_campaign = EXCLUDED.utm_campaign,
        utm_content = EXCLUDED.utm_content,
        utm_term = EXCLUDED.utm_term;

    -- Insert Free Subscription
    INSERT INTO public.subscriptions (id, user_id, plan_code, status, started_at, expires_at, updated_at)
    VALUES (
        gen_random_uuid(), new.id, 'free', 'active', now(), now() + interval '3 days', now()
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- Insert Usage Counters (FIXED)
    INSERT INTO public.usage_counters (user_id, period_start, period_end, request_count, updated_at)
    VALUES (
        new.id, now(), now() + interval '3 days', 0, now()
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN new;
END;
$function$;
CREATE OR REPLACE FUNCTION public.hybrid_search(p_query_embedding vector, p_query_text text, p_match_count integer)
 RETURNS TABLE(id uuid, type text, title text, snippet text, score double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    RETURN QUERY
    WITH vector_results AS (
        SELECT 
            sub.id, sub.type, sub.title, sub.snippet, sub.val_vector,
            ROW_NUMBER() OVER (ORDER BY sub.val_vector DESC) AS rank_val
        FROM (
            SELECT 
                t.id, 'task'::text AS type, t.title, COALESCE(t.description, '') AS snippet,
                CASE WHEN t.embedding IS NULL THEN 0.0::float8 ELSE (1 - (t.embedding <=> p_query_embedding))::float8 END AS val_vector
            FROM public.tasks t
            WHERE t.user_id = v_user_id
            UNION ALL
            SELECT 
                n.id, 'note'::text AS type, n.title, COALESCE(n.content, '') AS snippet,
                CASE WHEN n.embedding IS NULL THEN 0.0::float8 ELSE (1 - (n.embedding <=> p_query_embedding))::float8 END AS val_vector
            FROM public.notes n
            WHERE n.user_id = v_user_id
            UNION ALL
            SELECT 
                p.id, 'project'::text AS type, p.title, COALESCE(p.description, '') AS snippet,
                CASE WHEN p.embedding IS NULL THEN 0.0::float8 ELSE (1 - (p.embedding <=> p_query_embedding))::float8 END AS val_vector
            FROM public.projects p
            WHERE p.user_id = v_user_id
        ) sub
        WHERE sub.val_vector >= 0.25
    ),
    text_results AS (
        SELECT 
            sub.id, sub.type, sub.title, sub.snippet, sub.val_text,
            ROW_NUMBER() OVER (ORDER BY sub.val_text DESC) AS rank_val
        FROM (
            SELECT 
                t.id, 'task'::text AS type, t.title, COALESCE(t.description, '') AS snippet,
                similarity(COALESCE(t.title, '') || ' ' || COALESCE(t.description, ''), p_query_text)::float8 AS val_text
            FROM public.tasks t
            WHERE t.user_id = v_user_id
            UNION ALL
            SELECT 
                n.id, 'note'::text AS type, n.title, COALESCE(n.content, '') AS snippet,
                similarity(COALESCE(n.title, '') || ' ' || COALESCE(n.content, ''), p_query_text)::float8 AS val_text
            FROM public.notes n
            WHERE n.user_id = v_user_id
            UNION ALL
            SELECT 
                p.id, 'project'::text AS type, p.title, COALESCE(p.description, '') AS snippet,
                similarity(COALESCE(p.title, '') || ' ' || COALESCE(p.description, ''), p_query_text)::float8 AS val_text
            FROM public.projects p
            WHERE p.user_id = v_user_id
        ) sub
        WHERE sub.val_text >= 0.01
    )
    SELECT 
        COALESCE(v.id, t.id) AS id,
        COALESCE(v.type, t.type) AS type,
        COALESCE(v.title, t.title) AS title,
        COALESCE(v.snippet, t.snippet) AS snippet,
        (
            COALESCE(1.0 / (60.0 + v.rank_val), 0.0) + 
            COALESCE(1.0 / (60.0 + t.rank_val), 0.0)
        )::float8 AS score
    FROM vector_results v
    FULL OUTER JOIN text_results t ON v.id = t.id AND v.type = t.type
    ORDER BY score DESC
    LIMIT p_match_count;
END;
$function$;
CREATE OR REPLACE FUNCTION public.link_task_note(p_task_id uuid, p_note_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_task_exists BOOLEAN;
    v_note_exists BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Verify user owns the task
    SELECT EXISTS(
        SELECT 1 FROM public.tasks 
        WHERE id = p_task_id AND user_id = v_user_id
    ) INTO v_task_exists;

    -- Verify user owns the note
    SELECT EXISTS(
        SELECT 1 FROM public.notes 
        WHERE id = p_note_id AND user_id = v_user_id
    ) INTO v_note_exists;

    IF NOT v_task_exists OR NOT v_note_exists THEN
        RAISE EXCEPTION 'Task or Note not found or ownership verify failed.';
    END IF;

    -- Atomic idempotent insert
    INSERT INTO public.task_note_links (user_id, task_id, note_id)
    VALUES (v_user_id, p_task_id, p_note_id)
    ON CONFLICT (task_id, note_id) DO NOTHING;

    RETURN TRUE;
END;
$function$;
CREATE OR REPLACE FUNCTION public.match_documents(query_embedding vector, match_threshold double precision, match_count integer)
 RETURNS TABLE(id uuid, type text, title text, content text, similarity double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT combined.id, combined.type, combined.title, combined.content, combined.similarity
    FROM (
        SELECT 
            t.id,
            'task'::text AS type,
            t.title,
            t.description AS content,
            (1 - (t.embedding <=> query_embedding))::float8 AS similarity
        FROM public.tasks t
        WHERE t.user_id = auth.uid() AND t.embedding IS NOT NULL
        UNION ALL
        SELECT 
            n.id,
            'note'::text AS type,
            n.title,
            n.content AS content,
            (1 - (n.embedding <=> query_embedding))::float8 AS similarity
        FROM public.notes n
        WHERE n.user_id = auth.uid() AND n.embedding IS NOT NULL
    ) combined
    WHERE combined.similarity >= match_threshold
    ORDER BY combined.similarity DESC
    LIMIT match_count;
END;
$function$;
CREATE OR REPLACE FUNCTION public.notify_telegram_on_manual_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_bot_token TEXT;
    v_chat_id TEXT;
    v_enabled BOOLEAN;
    v_user_name TEXT;
    v_plan_name TEXT;
    v_message TEXT;
    v_amount_formatted TEXT;
BEGIN
    -- Only trigger for offline card_to_card payments in pending_manual status
    IF NEW.gateway = 'card_to_card' AND NEW.status = 'pending_manual' THEN
        
        -- Retrieve settings
        SELECT bot_token, chat_id, is_enabled
        INTO v_bot_token, v_chat_id, v_enabled
        FROM public.telegram_settings
        WHERE id = 1;
        
        -- Check if notification is enabled and settings exist
        IF v_enabled = true AND v_bot_token IS NOT NULL AND trim(v_bot_token) <> '' AND v_chat_id IS NOT NULL AND trim(v_chat_id) <> '' THEN
            
            -- Fetch User full_name safely
            SELECT COALESCE(full_name, 'کاربر بدون نام')
            INTO v_user_name
            FROM public.profiles
            WHERE id = NEW.user_id;
            
            -- Fetch Plan display_name safely
            SELECT COALESCE(display_name, NEW.plan_code)
            INTO v_plan_name
            FROM public.plans
            WHERE plan_code = NEW.plan_code;
            
            -- Format final payment amount nicely
            v_amount_formatted := to_char(NEW.final_amount_irr, 'FM999,999,999,999') || ' ریال';
            
            -- Construct the notification text message in Persian (HTML formatted)
            v_message := '🔔 <b>درخواست کارت به کارت جدید</b>' || E'\n\n' ||
                         '👤 <b>کاربر:</b> ' || v_user_name || E'\n' ||
                         '📦 <b>پلن انتخابی:</b> ' || v_plan_name || E'\n' ||
                         '💰 <b>مبلغ پرداختی:</b> ' || v_amount_formatted || E'\n\n' ||
                         '👇 برای بررسی فیش بانکی ارسالی و تغییر اشتراک، به پنل مدیریت سایت مراجعه نمایید.';
            
            -- Perform the non-blocking HTTP request asynchronously to Telegram sendMessage API
            PERFORM net.http_post(
                url := 'https://api.telegram.org/bot' || v_bot_token || '/sendMessage',
                headers := '{"Content-Type": "application/json"}'::jsonb,
                body := jsonb_build_object(
                    'chat_id', v_chat_id,
                    'text', v_message,
                    'parse_mode', 'HTML'
                ),
                timeout_milliseconds := 5000
            );
            
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.notify_telegram_on_new_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_bot_token TEXT;
    v_chat_id TEXT;
    v_enabled BOOLEAN;
    v_user_name TEXT;
    v_user_email TEXT;
    v_user_phone TEXT;
    v_message TEXT;
BEGIN
    -- Retrieve settings from telegram_settings
    SELECT bot_token, chat_id, is_enabled
    INTO v_bot_token, v_chat_id, v_enabled
    FROM public.telegram_settings
    WHERE id = 1;
    
    -- Check if notification is enabled and settings exist
    IF v_enabled = true AND v_bot_token IS NOT NULL AND trim(v_bot_token) <> '' AND v_chat_id IS NOT NULL AND trim(v_chat_id) <> '' THEN
        
        -- Fetch User full_name safely
        SELECT COALESCE(full_name, 'کاربر بدون نام')
        INTO v_user_name
        FROM public.profiles
        WHERE id = NEW.user_id;

        -- Fetch User email and phone safely from auth.users
        SELECT email, phone
        INTO v_user_email, v_user_phone
        FROM auth.users
        WHERE id = NEW.user_id;
        
        -- Construct the notification text message in Persian (HTML formatted)
        v_message := '✉️ <b>تیکت پشتیبانی جدید</b>' || E'\n\n' ||
                     '👤 <b>کاربر:</b> ' || v_user_name || E'\n' ||
                     '📧 <b>ایمیل:</b> ' || COALESCE(v_user_email, 'نامشخص') || E'\n' ||
                     '📱 <b>موبایل:</b> ' || COALESCE(v_user_phone, 'نامشخص') || E'\n' ||
                     '🏷️ <b>موضوع:</b> ' || NEW.subject || E'\n\n' ||
                     '📝 <b>متن تیکت:</b>' || E'\n' || NEW.message || E'\n\n' ||
                     '👇 برای پاسخ یا مدیریت تیکت‌ها، به پنل مدیریت مراجعه کنید.
                     panel.hexerapp.ir
                     ';
        
        -- Perform the non-blocking HTTP request asynchronously to Telegram sendMessage API
        PERFORM net.http_post(
            url := 'https://api.telegram.org/bot' || v_bot_token || '/sendMessage',
            headers := '{"Content-Type": "application/json"}'::jsonb,
            body := jsonb_build_object(
                'chat_id', v_chat_id,
                'text', v_message,
                'parse_mode', 'HTML'
            ),
            timeout_milliseconds := 5000
        );
        
    END IF;
    RETURN NEW;
END;
$function$;
CREATE OR REPLACE FUNCTION public.preview_discount(p_plan_code text, p_code text)
 RETURNS TABLE(valid boolean, reason text, plan_price bigint, discount_amount bigint, final_amount bigint, is_full_discount boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_price_irr BIGINT;
    v_sanitized_code TEXT;
    v_discount_id UUID;
    v_percent INT;
    v_amt_irr BIGINT;
    v_max_uses INT;
    v_used_count INT;
    v_expires_at TIMESTAMPTZ;
    v_calc_discount BIGINT := 0;
    v_final BIGINT := 0;
BEGIN
    -- 1. Fetch Plan details
    SELECT price_irr INTO v_price_irr
    FROM public.plans
    WHERE plan_code = p_plan_code;

    IF NOT FOUND THEN
        valid := false;
        reason := 'طرح انتخاب شده یافت نشد.';
        plan_price := 0;
        discount_amount := 0;
        final_amount := 0;
        is_full_discount := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- 2. If code is empty or null, return price details with no discount
    IF p_code IS NULL OR trim(p_code) = '' THEN
        valid := true;
        reason := NULL;
        plan_price := v_price_irr;
        discount_amount := 0;
        final_amount := v_price_irr;
        is_full_discount := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- 3. Sanitize code
    v_sanitized_code := upper(trim(p_code));

    -- 4. Fetch discount code details
    SELECT id, discount_percent, discount_amount_irr, max_uses, used_count, expires_at
    INTO v_discount_id, v_percent, v_amt_irr, v_max_uses, v_used_count, v_expires_at
    FROM public.discount_codes
    WHERE code = v_sanitized_code;

    IF NOT FOUND THEN
        valid := false;
        reason := 'کد تخفیف وارد شده معتبر نیست.';
        plan_price := v_price_irr;
        discount_amount := 0;
        final_amount := v_price_irr;
        is_full_discount := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- 5. Expiration check
    IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
        valid := false;
        reason := 'کد تخفیف وارد شده منقضی شده است.';
        plan_price := v_price_irr;
        discount_amount := 0;
        final_amount := v_price_irr;
        is_full_discount := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- 6. Max uses check
    IF v_max_uses IS NOT NULL AND v_used_count >= v_max_uses THEN
        valid := false;
        reason := 'ظرفیت استفاده از این کد تخفیف به پایان رسیده است.';
        plan_price := v_price_irr;
        discount_amount := 0;
        final_amount := v_price_irr;
        is_full_discount := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- 7. Calculate discount
    IF v_percent IS NOT NULL THEN
        v_calc_discount := floor(v_price_irr * v_percent / 100.0)::bigint;
    ELSIF v_amt_irr IS NOT NULL THEN
        v_calc_discount := v_amt_irr;
    END IF;

    -- Cap discount
    v_calc_discount := least(v_price_irr, v_calc_discount);
    v_final := v_price_irr - v_calc_discount;

    -- Guardrail 1: bottom threshold check
    IF v_final > 0 AND v_final < 10000 THEN
        valid := false;
        reason := 'مبلغ نهایی پس از اعمال تخفیف، کمتر از حداقل مجاز شبکه بانکی (۱۰۰۰ تومان) است.';
        plan_price := v_price_irr;
        discount_amount := v_calc_discount;
        final_amount := v_final;
        is_full_discount := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Valid coupon successfully simulated
    valid := true;
    reason := NULL;
    plan_price := v_price_irr;
    discount_amount := v_calc_discount;
    final_amount := v_final;
    is_full_discount := (v_final = 0);
    RETURN NEXT;
END;
$function$;
CREATE OR REPLACE FUNCTION public.reject_manual_payment(p_payment_id uuid, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_payment_status TEXT;
    v_discount_id UUID;
BEGIN
    -- 1. Read payment status and discount_code_id
    SELECT status, discount_code_id
    INTO v_payment_status, v_discount_id
    FROM public.payments
    WHERE id = p_payment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'تراکنش پرداخت یافت نشد.';
    END IF;

    IF v_payment_status != 'pending_manual' THEN
        RAISE EXCEPTION 'وضعیت تراکنش برای رد شدن نامعتبر است.';
    END IF;

    -- 2. Mark as failed and store reason
    UPDATE public.payments
    SET status = 'failed', manual_decline_reason = p_reason
    WHERE id = p_payment_id;

    -- 3. Rollback reserved coupon usage if it had one
    IF v_discount_id IS NOT NULL THEN
        UPDATE public.discount_codes
        SET used_count = greatest(0, used_count - 1)
        WHERE id = v_discount_id;
    END IF;

    RETURN TRUE;
END;
$function$;
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;
CREATE OR REPLACE FUNCTION public.submit_manual_payment(p_plan_code text, p_code text, p_receipt_path text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_existing_pending BOOLEAN;
    v_price_irr BIGINT;
    v_discount_id UUID := NULL;
    v_percent INT;
    v_amt_irr BIGINT;
    v_max_uses INT;
    v_used_count INT;
    v_expires_at TIMESTAMPTZ;
    v_calc_discount BIGINT := 0;
    v_final_amount BIGINT;
    v_payment_id UUID;
    v_sanitized_code TEXT;
BEGIN
    -- Get caller UID
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'کاربر وارد نشده است.';
    END IF;

    -- 1. Check if user already has a pending_manual payment
    SELECT EXISTS (
        SELECT 1 
        FROM public.payments 
        WHERE user_id = v_user_id AND status = 'pending_manual'
    ) INTO v_existing_pending;

    IF v_existing_pending THEN
        RAISE EXCEPTION 'شما یک درخواست در انتظار بررسی دارید.';
    END IF;

    -- 2. Fetch Plan details
    SELECT price_irr INTO v_price_irr
    FROM public.plans
    WHERE plan_code = p_plan_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'طرح انتخاب شده یافت نشد.';
    END IF;

    -- 3. If discount code provided
    IF p_code IS NOT NULL AND trim(p_code) != '' THEN
        v_sanitized_code := upper(trim(p_code));

        -- Lock the row using FOR UPDATE to prevent concurrency/race conditions
        SELECT id, discount_percent, discount_amount_irr, max_uses, used_count, expires_at
        INTO v_discount_id, v_percent, v_amt_irr, v_max_uses, v_used_count, v_expires_at
        FROM public.discount_codes
        WHERE code = v_sanitized_code
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'کد تخفیف وارد شده معتبر نیست.';
        END IF;

        -- Check expiration
        IF v_expires_at IS NOT NULL AND v_expires_at < now() THEN
            RAISE EXCEPTION 'کد تخفیف وارد شده منقضی شده است.';
        END IF;

        -- Check max uses
        IF v_max_uses IS NOT NULL AND v_used_count >= v_max_uses THEN
            RAISE EXCEPTION 'ظرفیت استفاده از این کد تخفیف به پایان رسیده است.';
        END IF;

        -- Calculate discount
        IF v_percent IS NOT NULL THEN
            v_calc_discount := floor(v_price_irr * v_percent / 100.0)::bigint;
        ELSIF v_amt_irr IS NOT NULL THEN
            v_calc_discount := v_amt_irr;
        END IF;

        v_calc_discount := least(v_price_irr, v_calc_discount);

        -- Increment used counter
        UPDATE public.discount_codes
        SET used_count = used_count + 1
        WHERE id = v_discount_id;

    END IF;

    v_final_amount := v_price_irr - v_calc_discount;

    -- 4. Check if final amount is zero (Zero-priced checkout must use bypass mode/startCheckout instead of manual receipt submit)
    IF v_final_amount = 0 THEN
        RAISE EXCEPTION 'پرداخت کارت به کارت برای مبلغ صفر مجاز نیست. لطفاً از فعال‌سازی رایگان استفاده کنید.';
    END IF;

    -- 5. Insert row in payments
    INSERT INTO public.payments (
        user_id,
        plan_code,
        amount_irr,
        discount_code_id,
        discount_amount_irr,
        final_amount_irr,
        status,
        gateway,
        offline_receipt_url
    )
    VALUES (
        v_user_id,
        p_plan_code,
        v_price_irr,
        v_discount_id,
        v_calc_discount,
        v_final_amount,
        'pending_manual',
        'card_to_card',
        p_receipt_path
    )
    RETURNING id INTO v_payment_id;

    RETURN v_payment_id;
END;
$function$;
CREATE OR REPLACE FUNCTION public.unlink_task_note(p_task_id uuid, p_note_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    DELETE FROM public.task_note_links
    WHERE user_id = v_user_id AND task_id = p_task_id AND note_id = p_note_id;

    RETURN TRUE;
END;
$function$;
CREATE OR REPLACE FUNCTION public.upsert_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into public.push_subscriptions(user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (user_id, endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent;
end; $function$;
create or replace view public.pending_push_reminders with (security_invoker=true) as  SELECT t.id AS task_id,
    t.user_id,
    t.title,
    COALESCE(t.description, ''::text) AS description,
    t.due_date,
    s.endpoint,
    s.p256dh,
    s.auth
   FROM (tasks t
     JOIN push_subscriptions s ON ((s.user_id = t.user_id)))
  WHERE ((t.due_date <= now()) AND (t.completed_at IS NULL) AND (NOT (EXISTS ( SELECT 1
           FROM reminders r
          WHERE ((r.related_entity_id = t.id) AND (r.related_entity_type = 'task'::text) AND (r.is_sent = true))))));

CREATE TRIGGER trigger_vectorize_note_insert AFTER INSERT ON public.notes FOR EACH ROW EXECUTE FUNCTION public.enqueue_vectorize();
CREATE TRIGGER trigger_vectorize_note_update AFTER UPDATE OF title, content ON public.notes FOR EACH ROW WHEN (old.title IS DISTINCT FROM new.title OR old.content IS DISTINCT FROM new.content) EXECUTE FUNCTION public.enqueue_vectorize();
CREATE TRIGGER trg_notify_telegram_on_manual_payment AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.notify_telegram_on_manual_payment();
CREATE TRIGGER trigger_vectorize_project_insert AFTER INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.enqueue_vectorize();
CREATE TRIGGER trigger_vectorize_project_update AFTER UPDATE OF title, description ON public.projects FOR EACH ROW WHEN (old.title IS DISTINCT FROM new.title OR old.description IS DISTINCT FROM new.description) EXECUTE FUNCTION public.enqueue_vectorize();
CREATE TRIGGER trg_notify_telegram_on_new_ticket AFTER INSERT ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.notify_telegram_on_new_ticket();
CREATE TRIGGER trigger_vectorize_task_insert AFTER INSERT ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.enqueue_vectorize();
CREATE TRIGGER trigger_vectorize_task_update AFTER UPDATE OF title, description ON public.tasks FOR EACH ROW WHEN (old.title IS DISTINCT FROM new.title OR old.description IS DISTINCT FROM new.description) EXECUTE FUNCTION public.enqueue_vectorize();

alter table public.ai_requests_log enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.daily_briefs enable row level security;
alter table public.discount_codes enable row level security;
alter table public.habit_completions enable row level security;
alter table public.habits enable row level security;
alter table public.media_assets enable row level security;
alter table public.notes enable row level security;
alter table public.payments enable row level security;
alter table public.plans enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.push_dispatch_log enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminders enable row level security;
alter table public.subscriptions enable row level security;
alter table public.support_tickets enable row level security;
alter table public.task_note_links enable row level security;
alter table public.tasks enable row level security;
alter table public.telegram_settings enable row level security;
alter table public.usage_counters enable row level security;

create policy "Users can view their own ai requests log" on public.ai_requests_log as permissive for select to authenticated using ((auth.uid() = user_id));
create policy "Users can manage their own chat messages" on public.chat_messages as permissive for all to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can manage their own chat sessions" on public.chat_sessions as permissive for all to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can read their own daily briefs" on public.daily_briefs as permissive for select to authenticated using ((auth.uid() = user_id));
create policy "Allow select for authenticated users" on public.discount_codes as permissive for select to authenticated using (true);
create policy "Users can manage their own habit completions" on public.habit_completions as permissive for all to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can manage their own habits" on public.habits as permissive for all to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can manage their own media assets" on public.media_assets as permissive for all to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can manage their own notes" on public.notes as permissive for all to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can only view their own payments" on public.payments as permissive for select to authenticated using ((auth.uid() = user_id));
create policy "Users can manage their own profiles" on public.profiles as permissive for all to authenticated using ((auth.uid() = id)) with check ((auth.uid() = id));
create policy "Users can manage their own projects" on public.projects as permissive for all to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "own push subs" on public.push_subscriptions as permissive for all to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can manage their own reminders" on public.reminders as permissive for all to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can view their own subscriptions" on public.subscriptions as permissive for select to authenticated using ((auth.uid() = user_id));
create policy "Users can insert their own support tickets" on public.support_tickets as permissive for insert to authenticated with check ((auth.uid() = user_id));
create policy "Users can view their own support tickets" on public.support_tickets as permissive for select to authenticated using ((auth.uid() = user_id));
create policy "Users can manage their own task note links" on public.task_note_links as permissive for all to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can manage their own tasks" on public.tasks as permissive for all to authenticated using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));
create policy "Users can view their own usage counters" on public.usage_counters as permissive for select to authenticated using ((auth.uid() = user_id));
create policy "Allow authenticated deletes" on storage.objects as permissive for delete to authenticated using (((storage.foldername(name))[1] = (auth.uid())::text));
create policy "Allow authenticated inserts" on storage.objects as permissive for insert to authenticated with check (((storage.foldername(name))[1] = (auth.uid())::text));
create policy "Allow authenticated selects" on storage.objects as permissive for select to authenticated using (((storage.foldername(name))[1] = (auth.uid())::text));
create policy "Allow authenticated updates" on storage.objects as permissive for update to authenticated using (((storage.foldername(name))[1] = (auth.uid())::text)) with check (((storage.foldername(name))[1] = (auth.uid())::text));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('avatars','avatars','f',null,null) on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('chat-media','chat-media','f',null,null) on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('receipts','receipts','f',null,null) on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

commit;
