-- Billing schema shared by all of Bhargav's AI apps (one Supabase project, one row per user per app).
-- Run once in Supabase: Dashboard → SQL Editor → New query → paste this file → Run.
-- Safe to run again: every statement is idempotent.
-- Only the server (service role key) touches these tables; row level security is on with no policies,
-- so the public anon key cannot read or write them.

create table if not exists public.entitlements (
  user_id      uuid not null references auth.users (id) on delete cascade,
  app          text not null,
  plan         text not null default 'free' check (plan in ('free', 'day', 'month')),
  expires_at   timestamptz,
  free_used    integer not null default 0,
  period_used  integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (user_id, app)
);

create table if not exists public.payments (
  order_id    text primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  app         text not null,
  plan        text not null check (plan in ('day', 'month')),
  amount      integer not null, -- paise
  status      text not null default 'created' check (status in ('created', 'paid')),
  payment_id  text,
  created_at  timestamptz not null default now(),
  paid_at     timestamptz
);
create index if not exists payments_user_idx on public.payments (user_id, app, created_at desc);

create table if not exists public.ai_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  app         text not null,
  calls       integer not null default 0,
  max_calls   integer not null,
  created_at  timestamptz not null default now()
);
create index if not exists ai_sessions_user_idx on public.ai_sessions (user_id, created_at desc);

alter table public.entitlements enable row level security;
alter table public.payments     enable row level security;
alter table public.ai_sessions  enable row level security;

-- Expire a finished paid plan back to free. Caller must hold the row lock.
create or replace function public._normalise_entitlement(p_user uuid, p_app text)
returns public.entitlements
language plpgsql
as $$
declare e public.entitlements;
begin
  insert into public.entitlements (user_id, app) values (p_user, p_app) on conflict do nothing;
  select * into e from public.entitlements where user_id = p_user and app = p_app for update;
  if e.plan <> 'free' and (e.expires_at is null or e.expires_at <= now()) then
    update public.entitlements
       set plan = 'free', expires_at = null, period_used = 0, updated_at = now()
     where user_id = p_user and app = p_app
     returning * into e;
  end if;
  return e;
end;
$$;

-- Read a user's plan without using anything up.
create or replace function public.billing_status(p_user uuid, p_app text)
returns public.entitlements
language plpgsql
security definer set search_path = public
as $$
begin
  return public._normalise_entitlement(p_user, p_app);
end;
$$;

-- Atomically use one AI "use" (an interview, a statement, a plan…) and open an AI session for it.
create or replace function public.consume_use(
  p_user uuid, p_app text,
  p_free_limit integer, p_day_limit integer, p_month_limit integer,
  p_max_calls integer
)
returns table (allowed boolean, reason text, session_id uuid, plan text, used integer, use_limit integer, expires_at timestamptz)
language plpgsql
security definer set search_path = public
as $$
#variable_conflict use_column
declare
  e public.entitlements;
  cap integer;
  sid uuid;
begin
  e := public._normalise_entitlement(p_user, p_app);

  if e.plan = 'free' then
    if e.free_used >= p_free_limit then
      return query select false, 'limit'::text, null::uuid, e.plan, e.free_used, p_free_limit, e.expires_at;
      return;
    end if;
    update public.entitlements set free_used = free_used + 1, updated_at = now()
     where user_id = p_user and app = p_app returning * into e;
    cap := p_free_limit;
  else
    cap := case when e.plan = 'day' then p_day_limit else p_month_limit end;
    if e.period_used >= cap then
      return query select false, 'limit'::text, null::uuid, e.plan, e.period_used, cap, e.expires_at;
      return;
    end if;
    update public.entitlements set period_used = period_used + 1, updated_at = now()
     where user_id = p_user and app = p_app returning * into e;
  end if;

  insert into public.ai_sessions (user_id, app, max_calls) values (p_user, p_app, p_max_calls) returning id into sid;
  return query select true, 'ok'::text, sid, e.plan,
    case when e.plan = 'free' then e.free_used else e.period_used end, cap, e.expires_at;
end;
$$;

-- Count one AI call against an open session. Returns false when the session is unknown, used up or older than 3 hours.
create or replace function public.use_session_call(p_session uuid, p_user uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare ok boolean;
begin
  update public.ai_sessions set calls = calls + 1
   where id = p_session and user_id = p_user
     and calls < max_calls and created_at > now() - interval '3 hours'
  returning true into ok;
  return coalesce(ok, false);
end;
$$;

-- Mark an order paid and switch the plan on. Idempotent: a second call for the same order changes nothing.
-- Buying the same plan again while it is active extends it; buying a different plan starts it now.
-- Either way the usage counter restarts, so a buyer who hit the limit can continue straight away.
create or replace function public.activate_order(p_order text, p_payment text)
returns table (activated boolean, plan text, expires_at timestamptz)
language plpgsql
security definer set search_path = public
as $$
#variable_conflict use_column
declare
  p public.payments;
  e public.entitlements;
  span interval;
begin
  select * into p from public.payments where order_id = p_order for update;
  if not found then
    return query select false, null::text, null::timestamptz;
    return;
  end if;
  if p.status = 'paid' then
    select * into e from public.entitlements where user_id = p.user_id and app = p.app;
    return query select false, e.plan, e.expires_at;
    return;
  end if;

  update public.payments set status = 'paid', payment_id = p_payment, paid_at = now() where order_id = p_order;
  span := case when p.plan = 'day' then interval '24 hours' else interval '30 days' end;
  e := public._normalise_entitlement(p.user_id, p.app);

  if e.plan = p.plan and e.expires_at > now() then
    update public.entitlements set expires_at = e.expires_at + span, period_used = 0, updated_at = now()
     where user_id = p.user_id and app = p.app returning * into e;
  else
    update public.entitlements set plan = p.plan, expires_at = now() + span, period_used = 0, updated_at = now()
     where user_id = p.user_id and app = p.app returning * into e;
  end if;
  return query select true, e.plan, e.expires_at;
end;
$$;

revoke all on function public._normalise_entitlement(uuid, text) from public, anon, authenticated;
revoke all on function public.billing_status(uuid, text) from public, anon, authenticated;
revoke all on function public.consume_use(uuid, text, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.use_session_call(uuid, uuid) from public, anon, authenticated;
revoke all on function public.activate_order(text, text) from public, anon, authenticated;
