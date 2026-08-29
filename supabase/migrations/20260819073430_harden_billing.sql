begin;

create unique index if not exists payments_track_id_unique
  on public.payments(track_id)
  where track_id is not null;

create or replace function public.preview_discount(
  p_plan_code text,
  p_code text
)
returns table (
  valid boolean,
  reason text,
  plan_price bigint,
  discount_amount bigint,
  final_amount bigint,
  is_full_discount boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_price bigint;
  v_discount public.discount_codes%rowtype;
  v_amount bigint := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select price_irr into v_price
  from public.plans
  where plan_code = p_plan_code;

  if not found then
    return query select false, 'طرح انتخاب شده یافت نشد.'::text, 0::bigint, 0::bigint, 0::bigint, false;
    return;
  end if;

  if p_code is null or btrim(p_code) = '' then
    return query select true, null::text, v_price, 0::bigint, v_price, false;
    return;
  end if;

  select * into v_discount
  from public.discount_codes
  where code = upper(btrim(p_code))
    and is_active = true;

  if not found then
    return query select false, 'کد تخفیف وارد شده معتبر نیست.'::text, v_price, 0::bigint, v_price, false;
    return;
  end if;

  if v_discount.expires_at is not null and v_discount.expires_at < now() then
    return query select false, 'کد تخفیف وارد شده منقضی شده است.'::text, v_price, 0::bigint, v_price, false;
    return;
  end if;

  if v_discount.max_uses is not null and v_discount.used_count >= v_discount.max_uses then
    return query select false, 'ظرفیت استفاده از این کد تخفیف به پایان رسیده است.'::text, v_price, 0::bigint, v_price, false;
    return;
  end if;

  if v_discount.discount_percent is not null then
    v_amount := floor(v_price * v_discount.discount_percent / 100.0)::bigint;
  else
    v_amount := coalesce(v_discount.discount_amount_irr, 0);
  end if;
  v_amount := least(v_price, greatest(0, v_amount));

  if v_price - v_amount between 1 and 9999 then
    return query select false, 'مبلغ نهایی کمتر از حداقل مجاز شبکه بانکی است.'::text,
      v_price, v_amount, v_price - v_amount, false;
    return;
  end if;

  return query select true, null::text, v_price, v_amount, v_price - v_amount, v_price = v_amount;
end;
$$;

create or replace function public.submit_manual_payment(
  p_plan_code text,
  p_code text,
  p_receipt_path text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, storage
as $$
declare
  v_user_id uuid := auth.uid();
  v_price bigint;
  v_discount public.discount_codes%rowtype;
  v_discount_amount bigint := 0;
  v_payment_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_receipt_path is null
     or p_receipt_path !~ ('^' || v_user_id::text || '/[0-9a-fA-F-]+\\.(jpg|jpeg|png|webp)$')
     or not exists (
       select 1 from storage.objects
       where bucket_id = 'receipts'
         and name = p_receipt_path
         and (storage.foldername(name))[1] = v_user_id::text
     ) then
    raise exception 'رسید معتبر در پوشه کاربر یافت نشد.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('manual-payment:' || v_user_id::text, 0));
  if exists (
    select 1 from public.payments
    where user_id = v_user_id and status = 'pending_manual'
  ) then
    raise exception 'شما یک درخواست در انتظار بررسی دارید.';
  end if;

  select price_irr into v_price
  from public.plans
  where plan_code = p_plan_code;
  if not found then
    raise exception 'طرح انتخاب شده یافت نشد.';
  end if;

  if p_code is not null and btrim(p_code) <> '' then
    select * into v_discount
    from public.discount_codes
    where code = upper(btrim(p_code))
      and is_active = true
    for update;

    if not found
       or (v_discount.expires_at is not null and v_discount.expires_at < now())
       or (v_discount.max_uses is not null and v_discount.used_count >= v_discount.max_uses) then
      raise exception 'کد تخفیف وارد شده معتبر نیست.';
    end if;

    if v_discount.discount_percent is not null then
      v_discount_amount := floor(v_price * v_discount.discount_percent / 100.0)::bigint;
    else
      v_discount_amount := coalesce(v_discount.discount_amount_irr, 0);
    end if;
    v_discount_amount := least(v_price, greatest(0, v_discount_amount));

    update public.discount_codes
    set used_count = used_count + 1
    where id = v_discount.id;
  end if;

  if v_price - v_discount_amount <= 0 then
    raise exception 'پرداخت کارت به کارت برای مبلغ صفر مجاز نیست.';
  end if;

  insert into public.payments (
    user_id, plan_code, amount_irr, discount_code_id,
    discount_amount_irr, final_amount_irr, status, gateway, offline_receipt_url
  ) values (
    v_user_id, p_plan_code, v_price, v_discount.id,
    v_discount_amount, v_price - v_discount_amount,
    'pending_manual', 'card_to_card', p_receipt_path
  ) returning id into v_payment_id;

  return v_payment_id;
end;
$$;

create or replace function public.activate_subscription(
  p_user_id uuid,
  p_plan_code text,
  p_payment_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_payment public.payments%rowtype;
  v_period_days integer;
  v_expires_at timestamptz;
  v_discount public.discount_codes%rowtype;
begin
  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment record not found';
  end if;
  if v_payment.user_id <> p_user_id or v_payment.plan_code <> p_plan_code then
    raise exception 'Payment ownership or plan mismatch';
  end if;
  if v_payment.gateway not in ('zibal', 'bypass') then
    raise exception 'Unsupported payment gateway';
  end if;
  if v_payment.status not in ('pending', 'paid') then
    raise exception 'Payment is in an invalid state';
  end if;
  if v_payment.final_amount_irr < 0 or v_payment.final_amount_irr > v_payment.amount_irr then
    raise exception 'Payment amount is invalid';
  end if;
  if v_payment.gateway = 'bypass' and v_payment.final_amount_irr <> 0 then
    raise exception 'Bypass payment must have zero final amount';
  end if;
  if v_payment.gateway = 'zibal' and v_payment.final_amount_irr < 10000 then
    raise exception 'Gateway payment amount is below the minimum';
  end if;

  select period_days into v_period_days
  from public.plans
  where plan_code = v_payment.plan_code;
  if not found then
    raise exception 'Payment plan not found';
  end if;

  if v_payment.status = 'pending' and v_payment.discount_code_id is not null then
    select * into v_discount
    from public.discount_codes
    where id = v_payment.discount_code_id and is_active = true
    for update;

    if not found
       or (v_discount.expires_at is not null and v_discount.expires_at < now())
       or (v_discount.max_uses is not null and v_discount.used_count >= v_discount.max_uses) then
      raise exception 'Discount is no longer valid';
    end if;

    update public.discount_codes
    set used_count = used_count + 1
    where id = v_discount.id;
  end if;

  v_expires_at := now() + make_interval(days => v_period_days);

  update public.payments
  set status = 'paid', paid_at = coalesce(paid_at, now())
  where id = v_payment.id;

  insert into public.subscriptions(user_id, plan_code, status, started_at, expires_at, updated_at)
  values(v_payment.user_id, v_payment.plan_code, 'active', now(), v_expires_at, now())
  on conflict(user_id) do update
  set plan_code = excluded.plan_code,
      status = 'active',
      started_at = excluded.started_at,
      expires_at = excluded.expires_at,
      updated_at = now();

  insert into public.usage_counters(user_id, period_start, period_end, request_count, updated_at)
  values(v_payment.user_id, now(), v_expires_at, 0, now())
  on conflict(user_id) do update
  set period_start = excluded.period_start,
      period_end = excluded.period_end,
      request_count = 0,
      updated_at = now();

  return true;
end;
$$;

revoke execute on function public.activate_subscription(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.activate_subscription(uuid, text, uuid) to service_role;
revoke execute on function public.preview_discount(text, text) from public, anon;
grant execute on function public.preview_discount(text, text) to authenticated;
revoke execute on function public.submit_manual_payment(text, text, text) from public, anon;
grant execute on function public.submit_manual_payment(text, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
