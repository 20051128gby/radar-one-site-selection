create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key,
  email text unique not null,
  display_name text,
  role text not null default 'operator' check (role in ('admin', 'operator', 'viewer')),
  plan_id text not null default 'free',
  is_disabled boolean not null default false,
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  alter column plan_id set default 'free';

create table if not exists public.projects (
  id text primary key,
  owner_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  business_type text not null,
  cuisine_focus text not null,
  target_address text not null,
  target_audience text,
  average_ticket text,
  budget_range text,
  store_scale text,
  rent_tolerance text,
  preferred_area_type text,
  coverage_radius_meters integer not null default 1800,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.site_analyses (
  id text primary key,
  project_id text not null references public.projects(id) on delete cascade,
  status text not null check (status in ('draft', 'running', 'complete', 'failed')),
  last_completed_stage text check (last_completed_stage in ('collect', 'score', 'summarize')),
  summary text not null,
  provider text,
  result_json jsonb,
  cost_estimate_json jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id text not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'active',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analysis_events (
  id uuid primary key default gen_random_uuid(),
  project_id text references public.projects(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_key text not null,
  actor_type text not null check (actor_type in ('guest', 'user')),
  provider text not null,
  status text not null check (status in ('success', 'failed')),
  analysis_tier text not null default 'basic' check (analysis_tier in ('basic', 'premium')),
  credit_source text not null default 'free_basic',
  address text not null,
  business_type text not null,
  cuisine_focus text not null,
  estimated_usd numeric(10,4) not null default 0,
  failure_reason text,
  created_at timestamptz not null default now()
);

alter table public.analysis_events
  add column if not exists analysis_tier text not null default 'basic';

alter table public.analysis_events
  add column if not exists credit_source text not null default 'free_basic';

create table if not exists public.usage_balances (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan_id text not null default 'free',
  basic_credits_included integer not null default 5 check (basic_credits_included >= 0),
  basic_credits_bonus integer not null default 0 check (basic_credits_bonus >= 0),
  basic_credits_used integer not null default 0 check (basic_credits_used >= 0),
  premium_credits_included integer not null default 0 check (premium_credits_included >= 0),
  premium_credits_bonus integer not null default 0 check (premium_credits_bonus >= 0),
  premium_credits_used integer not null default 0 check (premium_credits_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.guest_trial_claims (
  ip_hash text primary key,
  first_user_agent_hash text,
  first_claimed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.share_reward_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reward_type text not null default 'share_premium_analysis'
    check (reward_type in ('share_premium_analysis')),
  share_reference text not null unique,
  share_channel text,
  status text not null default 'pending' check (status in ('pending', 'awarded', 'reversed')),
  premium_credits_awarded integer not null default 1 check (premium_credits_awarded >= 0),
  awarded_at timestamptz,
  metadata_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_owner_updated
  on public.projects(owner_id, updated_at desc);

create index if not exists idx_site_analyses_project_updated
  on public.site_analyses(project_id, updated_at desc);

create index if not exists idx_analysis_events_actor_created
  on public.analysis_events(actor_key, created_at desc);

create index if not exists idx_analysis_events_status_created
  on public.analysis_events(status, created_at desc);

create index if not exists idx_usage_balances_plan
  on public.usage_balances(plan_id, updated_at desc);

create index if not exists idx_share_reward_events_user_created
  on public.share_reward_events(user_id, created_at desc);

create index if not exists idx_share_reward_events_status_created
  on public.share_reward_events(status, created_at desc);

create or replace function public.basic_credits_for_plan(p_plan_id text)
returns integer
language sql
immutable
as $$
  select case coalesce(p_plan_id, 'free')
    when 'starter' then 60
    when 'growth' then 250
    when 'scale' then 1000
    when 'guest' then 0
    else 5
  end;
$$;

create or replace function public.premium_credits_for_plan(p_plan_id text)
returns integer
language sql
immutable
as $$
  select case coalesce(p_plan_id, 'free')
    when 'starter' then 0
    when 'growth' then 0
    when 'scale' then 0
    else 0
  end;
$$;

create or replace function public.sync_usage_balance_plan(
  p_user_id uuid,
  p_plan_id text default 'free'
)
returns public.usage_balances
language plpgsql
as $$
declare
  normalized_plan text := coalesce(nullif(p_plan_id, ''), 'free');
  next_basic integer := public.basic_credits_for_plan(normalized_plan);
  next_premium integer := public.premium_credits_for_plan(normalized_plan);
  balance public.usage_balances;
begin
  insert into public.usage_balances (
    user_id,
    plan_id,
    basic_credits_included,
    premium_credits_included
  )
  values (
    p_user_id,
    normalized_plan,
    next_basic,
    next_premium
  )
  on conflict (user_id) do update
    set plan_id = excluded.plan_id,
        basic_credits_included = excluded.basic_credits_included,
        premium_credits_included = excluded.premium_credits_included,
        updated_at = now()
  returning * into balance;

  return balance;
end;
$$;

create or replace function public.consume_analysis_credit(
  p_user_id uuid,
  p_tier text default 'basic'
)
returns table (
  allowed boolean,
  reason text,
  source text,
  plan_id text,
  basic_remaining integer,
  premium_remaining integer
)
language plpgsql
as $$
declare
  normalized_tier text := case when p_tier = 'premium' then 'premium' else 'basic' end;
  current_plan text;
  balance public.usage_balances;
begin
  select profiles.plan_id
  into current_plan
  from public.profiles
  where profiles.id = p_user_id;

  if current_plan is null then
    return query
    select false, '未找到用户资料。', 'free_basic', 'free', 0, 0;
    return;
  end if;

  perform public.sync_usage_balance_plan(p_user_id, current_plan);

  if normalized_tier = 'premium' then
    update public.usage_balances
      set premium_credits_used = premium_credits_used + 1,
          updated_at = now()
    where user_id = p_user_id
      and premium_credits_used < premium_credits_included + premium_credits_bonus
    returning * into balance;

    if found then
      return query
      select
        true,
        null::text,
        case
          when balance.premium_credits_used <= balance.premium_credits_included then 'plan_premium'
          else 'bonus_premium'
        end,
        balance.plan_id,
        greatest((balance.basic_credits_included + balance.basic_credits_bonus) - balance.basic_credits_used, 0),
        greatest((balance.premium_credits_included + balance.premium_credits_bonus) - balance.premium_credits_used, 0);
      return;
    end if;

    select * into balance
    from public.usage_balances
    where user_id = p_user_id;

    return query
    select
      false,
      '当前没有可用的高级分析额度。',
      'bonus_premium',
      coalesce(balance.plan_id, current_plan),
      greatest((coalesce(balance.basic_credits_included, 0) + coalesce(balance.basic_credits_bonus, 0)) - coalesce(balance.basic_credits_used, 0), 0),
      greatest((coalesce(balance.premium_credits_included, 0) + coalesce(balance.premium_credits_bonus, 0)) - coalesce(balance.premium_credits_used, 0), 0);
    return;
  end if;

  update public.usage_balances
    set basic_credits_used = basic_credits_used + 1,
        updated_at = now()
  where user_id = p_user_id
    and basic_credits_used < basic_credits_included + basic_credits_bonus
  returning * into balance;

  if found then
    return query
    select
      true,
      null::text,
      case
        when balance.basic_credits_used <= balance.basic_credits_included and balance.plan_id = 'free' then 'free_basic'
        when balance.basic_credits_used <= balance.basic_credits_included then 'plan_basic'
        else 'bonus_basic'
      end,
      balance.plan_id,
      greatest((balance.basic_credits_included + balance.basic_credits_bonus) - balance.basic_credits_used, 0),
      greatest((balance.premium_credits_included + balance.premium_credits_bonus) - balance.premium_credits_used, 0);
    return;
  end if;

  select * into balance
  from public.usage_balances
  where user_id = p_user_id;

  return query
  select
    false,
    case
      when coalesce(balance.plan_id, current_plan) = 'free' then '5 次免费基础分析已用完，请升级套餐后继续。'
      else '当前套餐的基础分析额度已用完。'
    end,
    case
      when coalesce(balance.plan_id, current_plan) = 'free' then 'free_basic'
      else 'plan_basic'
    end,
    coalesce(balance.plan_id, current_plan),
    greatest((coalesce(balance.basic_credits_included, 0) + coalesce(balance.basic_credits_bonus, 0)) - coalesce(balance.basic_credits_used, 0), 0),
    greatest((coalesce(balance.premium_credits_included, 0) + coalesce(balance.premium_credits_bonus, 0)) - coalesce(balance.premium_credits_used, 0), 0);
end;
$$;

create or replace function public.refund_analysis_credit(
  p_user_id uuid,
  p_tier text default 'basic'
)
returns public.usage_balances
language plpgsql
as $$
declare
  normalized_tier text := case when p_tier = 'premium' then 'premium' else 'basic' end;
  balance public.usage_balances;
begin
  if normalized_tier = 'premium' then
    update public.usage_balances
      set premium_credits_used = greatest(premium_credits_used - 1, 0),
          updated_at = now()
    where user_id = p_user_id
    returning * into balance;
  else
    update public.usage_balances
      set basic_credits_used = greatest(basic_credits_used - 1, 0),
          updated_at = now()
    where user_id = p_user_id
    returning * into balance;
  end if;

  return balance;
end;
$$;

create or replace function public.claim_guest_trial(
  p_ip_hash text,
  p_user_agent_hash text default null
)
returns boolean
language plpgsql
as $$
declare
  inserted_rows integer := 0;
begin
  insert into public.guest_trial_claims (
    ip_hash,
    first_user_agent_hash
  )
  values (
    p_ip_hash,
    p_user_agent_hash
  )
  on conflict (ip_hash) do nothing;

  get diagnostics inserted_rows = row_count;
  return inserted_rows > 0;
end;
$$;

create or replace function public.release_guest_trial(p_ip_hash text)
returns void
language sql
as $$
  delete from public.guest_trial_claims
  where ip_hash = p_ip_hash;
$$;

create or replace function public.grant_share_premium_reward(
  p_user_id uuid,
  p_share_reference text,
  p_share_channel text default null,
  p_premium_credits integer default 1
)
returns table (
  awarded boolean,
  reason text,
  premium_remaining integer
)
language plpgsql
as $$
declare
  current_plan text;
  balance public.usage_balances;
begin
  if coalesce(nullif(p_share_reference, ''), '') = '' then
    return query select false, 'share_reference 不能为空。', 0;
    return;
  end if;

  select profiles.plan_id
  into current_plan
  from public.profiles
  where profiles.id = p_user_id;

  if current_plan is null then
    return query select false, '未找到用户资料。', 0;
    return;
  end if;

  perform public.sync_usage_balance_plan(p_user_id, current_plan);

  insert into public.share_reward_events (
    user_id,
    reward_type,
    share_reference,
    share_channel,
    status,
    premium_credits_awarded,
    awarded_at
  )
  values (
    p_user_id,
    'share_premium_analysis',
    p_share_reference,
    p_share_channel,
    'awarded',
    greatest(p_premium_credits, 0),
    now()
  )
  on conflict (share_reference) do nothing;

  if not found then
    select * into balance
    from public.usage_balances
    where user_id = p_user_id;

    return query
    select
      false,
      '该分享奖励已经发放过。',
      greatest((coalesce(balance.premium_credits_included, 0) + coalesce(balance.premium_credits_bonus, 0)) - coalesce(balance.premium_credits_used, 0), 0);
    return;
  end if;

  update public.usage_balances
    set premium_credits_bonus = premium_credits_bonus + greatest(p_premium_credits, 0),
        updated_at = now()
  where user_id = p_user_id
  returning * into balance;

  return query
  select
    true,
    null::text,
    greatest((balance.premium_credits_included + balance.premium_credits_bonus) - balance.premium_credits_used, 0);
end;
$$;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.site_analyses enable row level security;
alter table public.subscriptions enable row level security;
alter table public.analysis_events enable row level security;
alter table public.usage_balances enable row level security;
alter table public.guest_trial_claims enable row level security;
alter table public.share_reward_events enable row level security;

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read"
on public.profiles for select
using (auth.uid() = id);

drop policy if exists "projects owner read" on public.projects;
create policy "projects owner read"
on public.projects for select
using (auth.uid() = owner_id);

drop policy if exists "projects owner write" on public.projects;
create policy "projects owner write"
on public.projects for all
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "site analyses owner read" on public.site_analyses;
create policy "site analyses owner read"
on public.site_analyses for select
using (
  exists (
    select 1
    from public.projects
    where public.projects.id = public.site_analyses.project_id
      and public.projects.owner_id = auth.uid()
  )
);

drop policy if exists "subscriptions owner read" on public.subscriptions;
create policy "subscriptions owner read"
on public.subscriptions for select
using (auth.uid() = user_id);

drop policy if exists "analysis events owner read" on public.analysis_events;
create policy "analysis events owner read"
on public.analysis_events for select
using (auth.uid() = actor_id);

drop policy if exists "usage balances owner read" on public.usage_balances;
create policy "usage balances owner read"
on public.usage_balances for select
using (auth.uid() = user_id);

drop policy if exists "share rewards owner read" on public.share_reward_events;
create policy "share rewards owner read"
on public.share_reward_events for select
using (auth.uid() = user_id);
