-- SIEMBRA core schema: profiles, wallet, loyalty, gift cards and audit.
-- Review in a staging Supabase project before production.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  avatar_url text,
  member_id text unique not null default ('SMB-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  marketing_email_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance_cents bigint not null default 0 check (balance_cents >= 0),
  currency text not null default 'USD' check (currency = 'USD'),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents bigint not null check (amount_cents <> 0),
  balance_after_cents bigint not null check (balance_after_cents >= 0),
  transaction_type text not null check (transaction_type in (
    'gift_card_redemption','purchase','refund','promotion','admin_adjustment','expiration','correction'
  )),
  source_id text,
  idempotency_key text not null unique,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists wallet_transactions_user_created_idx on public.wallet_transactions(user_id, created_at desc);

create table if not exists public.loyalty_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  points_balance bigint not null default 0 check (points_balance >= 0),
  tier text not null default 'semilla' check (tier in ('semilla','brote','raiz','florecer')),
  updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  points bigint not null check (points <> 0),
  balance_after bigint not null check (balance_after >= 0),
  transaction_type text not null check (transaction_type in ('earn','redeem','promotion','admin_adjustment','correction','expiration')),
  source_id text,
  idempotency_key text not null unique,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists loyalty_transactions_user_created_idx on public.loyalty_transactions(user_id, created_at desc);

create table if not exists public.gift_card_orders (
  id uuid primary key default gen_random_uuid(),
  purchaser_user_id uuid not null references auth.users(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  currency text not null default 'USD' check (currency = 'USD'),
  format text not null check (format in ('digital','physical')),
  recipient_name text not null,
  recipient_email text,
  message text,
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled','refunded')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists gift_card_orders_purchaser_created_idx on public.gift_card_orders(purchaser_user_id, created_at desc);

create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.gift_card_orders(id) on delete restrict,
  code_hash text not null unique,
  code_last4 text not null,
  amount_cents bigint not null check (amount_cents > 0),
  status text not null default 'active' check (status in ('active','redeemed','cancelled','expired')),
  redeemed_by_user_id uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key,
  event_type text not null,
  status text not null default 'processing' check (status in ('processing','processed','failed','ignored')),
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  reason text,
  before_data jsonb,
  after_data jsonb,
  request_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_target_created_idx on public.audit_logs(target_user_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, first_name, last_name, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  ) on conflict (id) do nothing;
  insert into public.wallets (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.loyalty_accounts (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.apply_wallet_transaction(
  p_user_id uuid,
  p_amount_cents bigint,
  p_transaction_type text,
  p_idempotency_key text,
  p_source_id text default null,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(transaction_id uuid, new_balance_cents bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
  v_id uuid;
begin
  if p_amount_cents = 0 then raise exception 'amount_must_be_nonzero'; end if;

  select wt.id, wt.balance_after_cents into v_id, v_balance
  from public.wallet_transactions wt
  where wt.idempotency_key = p_idempotency_key;
  if found then return query select v_id, v_balance; return; end if;

  insert into public.wallets(user_id) values (p_user_id) on conflict do nothing;
  select balance_cents into v_balance from public.wallets where user_id = p_user_id for update;
  v_balance := v_balance + p_amount_cents;
  if v_balance < 0 then raise exception 'insufficient_wallet_balance'; end if;

  update public.wallets set balance_cents = v_balance, updated_at = now() where user_id = p_user_id;
  insert into public.wallet_transactions(
    user_id, amount_cents, balance_after_cents, transaction_type,
    source_id, idempotency_key, description, metadata
  ) values (
    p_user_id, p_amount_cents, v_balance, p_transaction_type,
    p_source_id, p_idempotency_key, p_description, coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_id;
  return query select v_id, v_balance;
end;
$$;

create or replace function public.apply_loyalty_transaction(
  p_user_id uuid,
  p_points bigint,
  p_transaction_type text,
  p_idempotency_key text,
  p_source_id text default null,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns table(transaction_id uuid, new_points_balance bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
  v_id uuid;
begin
  if p_points = 0 then raise exception 'points_must_be_nonzero'; end if;
  select lt.id, lt.balance_after into v_id, v_balance
  from public.loyalty_transactions lt
  where lt.idempotency_key = p_idempotency_key;
  if found then return query select v_id, v_balance; return; end if;

  insert into public.loyalty_accounts(user_id) values (p_user_id) on conflict do nothing;
  select points_balance into v_balance from public.loyalty_accounts where user_id = p_user_id for update;
  v_balance := v_balance + p_points;
  if v_balance < 0 then raise exception 'insufficient_points'; end if;

  update public.loyalty_accounts set points_balance = v_balance, updated_at = now() where user_id = p_user_id;
  insert into public.loyalty_transactions(
    user_id, points, balance_after, transaction_type,
    source_id, idempotency_key, description, metadata
  ) values (
    p_user_id, p_points, v_balance, p_transaction_type,
    p_source_id, p_idempotency_key, p_description, coalesce(p_metadata, '{}'::jsonb)
  ) returning id into v_id;
  return query select v_id, v_balance;
end;
$$;

revoke all on function public.apply_wallet_transaction(uuid,bigint,text,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.apply_loyalty_transaction(uuid,bigint,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.apply_wallet_transaction(uuid,bigint,text,text,text,text,jsonb) to service_role;
grant execute on function public.apply_loyalty_transaction(uuid,bigint,text,text,text,text,jsonb) to service_role;

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_transactions enable row level security;
alter table public.gift_card_orders enable row level security;
alter table public.gift_cards enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_own" on public.profiles for select to authenticated
using ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "wallets_select_own" on public.wallets for select to authenticated
using ((select auth.uid()) = user_id);
create policy "wallet_transactions_select_own" on public.wallet_transactions for select to authenticated
using ((select auth.uid()) = user_id);
create policy "loyalty_accounts_select_own" on public.loyalty_accounts for select to authenticated
using ((select auth.uid()) = user_id);
create policy "loyalty_transactions_select_own" on public.loyalty_transactions for select to authenticated
using ((select auth.uid()) = user_id);
create policy "gift_card_orders_select_own" on public.gift_card_orders for select to authenticated
using ((select auth.uid()) = purchaser_user_id);

-- Intentionally no authenticated client policies for gift_cards, webhook events or audit logs.
-- Server routes using service_role perform sensitive writes after authorization and validation.
