-- 1. Adding UTM columns safely
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_source TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_medium TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_campaign TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_content TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_term TEXT;

-- 2. Replacing the trigger function securely (Bug Fixed)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
