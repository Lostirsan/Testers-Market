-- Testers Market: core schema, point economy and RLS.
-- All point movements happen inside SECURITY DEFINER functions; clients never
-- write to the ledger directly. Balance = sum of the user's ledger entries.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Economy constants (single place to tune)
-- ---------------------------------------------------------------------------
create or replace function public.econ(key text) returns int
language sql immutable as $$
  select case key
    when 'min_reward'            then 10   -- points per test, floor
    when 'max_reward'            then 200  -- points per test, ceiling
    when 'fee_percent'           then 10   -- platform fee, burned
    when 'max_active_tests'      then 3    -- concurrent taken slots per tester
    when 'take_deadline_hours'   then 48   -- time to submit after taking a slot
    when 'review_hours'          then 72   -- auto-accept after this
    when 'dispute_hours'         then 72   -- tester may dispute a rejection
    when 'pair_monthly_limit'    then 3    -- tests by same tester for same author / 30 days
    when 'min_report_chars'      then 150
    when 'min_reject_chars'      then 20
    when 'max_slots'             then 50
  end
$$;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('user', 'moderator', 'admin');
create type public.campaign_status as enum ('active', 'closed');
create type public.assignment_status as enum
  ('taken', 'submitted', 'accepted', 'rejected', 'disputed', 'rejected_final', 'expired', 'abandoned');
create type public.task_kind as enum ('starter', 'player', 'advertiser');
create type public.completion_status as enum ('pending', 'approved', 'rejected');
create type public.ledger_kind as enum
  ('task_reward', 'test_reward', 'escrow_hold', 'escrow_refund', 'fee_burn', 'purchase', 'admin');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  username         text not null unique check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name     text check (char_length(display_name) <= 60),
  avatar_url       text,
  bio              text check (char_length(bio) <= 500),
  itch_url         text,
  steam_url        text,
  role             public.user_role not null default 'user',
  is_banned        boolean not null default false,
  starter_unlocked boolean not null default false,
  created_at       timestamptz not null default now()
);

create table public.games (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(title) between 2 and 80),
  description text not null check (char_length(description) between 20 and 4000),
  genre       text not null check (char_length(genre) between 2 and 40),
  platforms   text[] not null default '{}',
  build_url   text not null check (build_url ~ '^https://'),
  cover_url   text,
  created_at  timestamptz not null default now()
);
create index on public.games (owner_id);

create table public.test_campaigns (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references public.games (id) on delete cascade,
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  instructions text not null check (char_length(instructions) between 20 and 4000),
  min_minutes  int  not null check (min_minutes between 5 and 180),
  reward       int  not null,
  fee          int  not null,
  slots        int  not null check (slots >= 1),
  accepted     int  not null default 0,
  status       public.campaign_status not null default 'active',
  created_at   timestamptz not null default now(),
  closed_at    timestamptz
);
create index on public.test_campaigns (status, created_at desc);
create index on public.test_campaigns (owner_id);

create table public.test_assignments (
  id                 uuid primary key default gen_random_uuid(),
  campaign_id        uuid not null references public.test_campaigns (id) on delete cascade,
  tester_id          uuid not null references public.profiles (id) on delete cascade,
  author_id          uuid not null references public.profiles (id) on delete cascade,
  status             public.assignment_status not null default 'taken',
  taken_at           timestamptz not null default now(),
  deadline_at        timestamptz not null,
  submitted_at       timestamptz,
  review_deadline_at timestamptz,
  decided_at         timestamptz,
  dispute_deadline_at timestamptz,
  unique (campaign_id, tester_id)
);
create index on public.test_assignments (tester_id, status);
create index on public.test_assignments (campaign_id, status);
create index on public.test_assignments (status, deadline_at);

create table public.test_reports (
  assignment_id uuid primary key references public.test_assignments (id) on delete cascade,
  body          text not null,
  bugs          text,
  game_rating   int  not null check (game_rating between 1 and 5),
  media_urls    text[] not null default '{}',
  author_score  int  check (author_score between 1 and 5),
  reject_reason text,
  created_at    timestamptz not null default now()
);

create table public.disputes (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.test_assignments (id) on delete cascade,
  opened_by     uuid not null references public.profiles (id),
  comment       text not null check (char_length(comment) between 10 and 2000),
  resolved_by   uuid references public.profiles (id),
  resolution    text,
  tester_won    boolean,
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create table public.tasks (
  id           uuid primary key default gen_random_uuid(),
  kind         public.task_kind not null,
  code         text unique,              -- starter tasks are checked by code
  title        text not null,
  description  text not null,
  reward       int  not null check (reward > 0),
  manual_review boolean not null default false,
  action_url   text,
  advertiser   text,
  daily_cap    int,                      -- max completions per day across users (advertiser budgets)
  active       boolean not null default true,
  sort         int not null default 0,
  created_at   timestamptz not null default now()
);

create table public.task_completions (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  status     public.completion_status not null default 'pending',
  proof      text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (task_id, user_id)
);

create table public.ledger_entries (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles (id) on delete cascade, -- null = platform (burns)
  amount     int not null check (amount <> 0),
  kind       public.ledger_kind not null,
  ref_type   text,
  ref_id     uuid,
  note       text,
  created_at timestamptz not null default now()
);
create index on public.ledger_entries (user_id, created_at desc);

create table public.reports_abuse (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id),
  target_type text not null check (target_type in ('game', 'user', 'report')),
  target_id   uuid not null,
  reason      text not null check (char_length(reason) between 5 and 1000),
  handled     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.current_profile() returns public.profiles
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null then raise exception 'not_authenticated'; end if;
  if p.is_banned then raise exception 'banned'; end if;
  return p;
end $$;

create or replace function public.is_staff(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and role in ('moderator', 'admin'))
$$;

create or replace function public.ledger_add(
  p_user uuid, p_amount int, p_kind public.ledger_kind, p_ref_type text, p_ref uuid, p_note text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.ledger_entries (user_id, amount, kind, ref_type, ref_id, note)
  values (p_user, p_amount, p_kind, p_ref_type, p_ref, p_note);
$$;

-- Wallet: balance, locked starter points, spendable, held in active campaigns.
create or replace function public.wallet(p_user uuid default null)
returns table (balance int, locked int, spendable int, held int)
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := coalesce(p_user, auth.uid());
  v_balance int; v_starter int; v_unlocked boolean; v_held int; v_locked int;
begin
  if uid <> auth.uid() and not public.is_staff(auth.uid()) then raise exception 'forbidden'; end if;
  select coalesce(sum(amount), 0) into v_balance from public.ledger_entries where user_id = uid;
  select coalesce(sum(l.amount), 0) into v_starter
    from public.ledger_entries l join public.tasks t on t.id = l.ref_id
    where l.user_id = uid and l.kind = 'task_reward' and t.kind = 'starter';
  select starter_unlocked into v_unlocked from public.profiles where id = uid;
  select coalesce(sum((c.slots - c.accepted) * (c.reward + c.fee)), 0) into v_held
    from public.test_campaigns c where c.owner_id = uid and c.status = 'active';
  v_locked := case when v_unlocked then 0 else least(v_balance, v_starter) end;
  return query select v_balance, v_locked, v_balance - v_locked, v_held;
end $$;

-- Spend guard: locks the profile row so concurrent spends serialize.
create or replace function public.spend(p_user uuid, p_amount int, p_ref_type text, p_ref uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_spendable int;
begin
  perform 1 from public.profiles where id = p_user for update;
  select w.spendable into v_spendable from public.wallet(p_user) w;
  if v_spendable < p_amount then
    raise exception 'insufficient_points: need %, have %', p_amount, v_spendable;
  end if;
  perform public.ledger_add(p_user, -p_amount, 'escrow_hold', p_ref_type, p_ref);
end $$;

-- ---------------------------------------------------------------------------
-- New user -> profile
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := regexp_replace(
    coalesce(new.raw_user_meta_data ->> 'user_name',
             new.raw_user_meta_data ->> 'preferred_username',
             new.raw_user_meta_data ->> 'name',
             split_part(new.email, '@', 1),
             'dev'), '[^a-zA-Z0-9_]', '', 'g');
  if char_length(base) < 3 then base := base || 'dev'; end if;
  base := left(base, 20);
  candidate := base;
  while exists (select 1 from public.profiles where lower(username) = lower(candidate)) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;
  insert into public.profiles (id, username, display_name, avatar_url)
  values (new.id, candidate,
          left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', candidate), 60),
          new.raw_user_meta_data ->> 'avatar_url');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Campaigns
-- ---------------------------------------------------------------------------
create or replace function public.create_campaign(
  p_game uuid, p_instructions text, p_min_minutes int, p_reward int, p_slots int)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me public.profiles := public.current_profile();
  v_fee int; v_id uuid;
begin
  if not exists (select 1 from public.games where id = p_game and owner_id = me.id) then
    raise exception 'not_your_game';
  end if;
  if p_reward < greatest(public.econ('min_reward'), p_min_minutes) then
    raise exception 'reward_too_low: at least % points', greatest(public.econ('min_reward'), p_min_minutes);
  end if;
  if p_reward > public.econ('max_reward') then raise exception 'reward_too_high'; end if;
  if p_slots < 1 or p_slots > public.econ('max_slots') then raise exception 'bad_slots'; end if;
  if exists (select 1 from public.test_campaigns where game_id = p_game and status = 'active') then
    raise exception 'campaign_already_active';
  end if;
  v_fee := ceil(p_reward * public.econ('fee_percent') / 100.0);
  insert into public.test_campaigns (game_id, owner_id, instructions, min_minutes, reward, fee, slots)
  values (p_game, me.id, p_instructions, p_min_minutes, p_reward, v_fee, p_slots)
  returning id into v_id;
  perform public.spend(me.id, (p_reward + v_fee) * p_slots, 'campaign', v_id);
  return v_id;
end $$;

-- Internal: refund unused capacity and close.
create or replace function public._close_campaign(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.test_campaigns; v_refund int;
begin
  select * into c from public.test_campaigns where id = p_id for update;
  if c.status = 'closed' then return; end if;
  update public.test_assignments set status = 'expired', decided_at = now()
    where campaign_id = p_id and status = 'taken';
  v_refund := (c.slots - c.accepted) * (c.reward + c.fee);
  if v_refund > 0 then
    perform public.ledger_add(c.owner_id, v_refund, 'escrow_refund', 'campaign', c.id);
  end if;
  update public.test_campaigns set status = 'closed', closed_at = now() where id = p_id;
end $$;

create or replace function public.close_campaign(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.current_profile(); c public.test_campaigns;
begin
  select * into c from public.test_campaigns where id = p_id for update;
  if c.owner_id is distinct from me.id and not public.is_staff(me.id) then raise exception 'forbidden'; end if;
  if exists (select 1 from public.test_assignments
             where campaign_id = p_id and status in ('submitted', 'rejected', 'disputed')) then
    raise exception 'pending_reports: review submitted reports first';
  end if;
  perform public._close_campaign(p_id);
end $$;

-- ---------------------------------------------------------------------------
-- Testing flow
-- ---------------------------------------------------------------------------
create or replace function public.take_slot(p_campaign uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me public.profiles := public.current_profile();
  c public.test_campaigns; v_occupied int; v_id uuid;
begin
  select * into c from public.test_campaigns where id = p_campaign for update;
  if c.id is null or c.status <> 'active' then raise exception 'campaign_closed'; end if;
  if c.owner_id = me.id then raise exception 'own_game'; end if;
  if exists (select 1 from public.test_assignments where campaign_id = c.id and tester_id = me.id) then
    raise exception 'already_tested';
  end if;
  if (select count(*) from public.test_assignments where tester_id = me.id and status = 'taken')
     >= public.econ('max_active_tests') then
    raise exception 'too_many_active_tests';
  end if;
  if (select count(*) from public.test_assignments
      where tester_id = me.id and author_id = c.owner_id and taken_at > now() - interval '30 days'
        and status not in ('expired', 'abandoned')) >= public.econ('pair_monthly_limit') then
    raise exception 'pair_limit: too many tests for this author this month';
  end if;
  select count(*) into v_occupied from public.test_assignments
    where campaign_id = c.id and status in ('taken', 'submitted', 'accepted', 'rejected', 'disputed');
  if v_occupied >= c.slots then raise exception 'no_free_slots'; end if;
  insert into public.test_assignments (campaign_id, tester_id, author_id, deadline_at)
  values (c.id, me.id, c.owner_id, now() + make_interval(hours => public.econ('take_deadline_hours')))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.abandon_slot(p_assignment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.current_profile();
begin
  update public.test_assignments set status = 'abandoned', decided_at = now()
    where id = p_assignment and tester_id = me.id and status = 'taken';
  if not found then raise exception 'not_found'; end if;
end $$;

create or replace function public.submit_report(
  p_assignment uuid, p_body text, p_bugs text, p_rating int, p_media text[])
returns void language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.current_profile(); a public.test_assignments;
begin
  select * into a from public.test_assignments where id = p_assignment for update;
  if a.tester_id is distinct from me.id then raise exception 'not_found'; end if;
  if a.status <> 'taken' then raise exception 'not_open'; end if;
  if a.deadline_at < now() then raise exception 'deadline_passed'; end if;
  if char_length(coalesce(p_body, '')) < public.econ('min_report_chars') then
    raise exception 'report_too_short: at least % characters', public.econ('min_report_chars');
  end if;
  if coalesce(array_length(p_media, 1), 0) < 1 then raise exception 'screenshot_required'; end if;
  insert into public.test_reports (assignment_id, body, bugs, game_rating, media_urls)
  values (a.id, p_body, p_bugs, p_rating, p_media);
  update public.test_assignments
    set status = 'submitted', submitted_at = now(),
        review_deadline_at = now() + make_interval(hours => public.econ('review_hours'))
    where id = a.id;
end $$;

-- Internal: pay the tester, burn the fee, unlock starter points, maybe close campaign.
create or replace function public._accept(p_assignment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare a public.test_assignments; c public.test_campaigns;
begin
  select * into a from public.test_assignments where id = p_assignment for update;
  select * into c from public.test_campaigns where id = a.campaign_id for update;
  update public.test_assignments set status = 'accepted', decided_at = now() where id = a.id;
  perform public.ledger_add(a.tester_id, c.reward, 'test_reward', 'assignment', a.id);
  perform public.ledger_add(null, c.fee, 'fee_burn', 'assignment', a.id);
  update public.profiles set starter_unlocked = true where id = a.tester_id and not starter_unlocked;
  update public.test_campaigns set accepted = accepted + 1 where id = c.id;
  if c.accepted + 1 >= c.slots then perform public._close_campaign(c.id); end if;
end $$;

create or replace function public.accept_report(p_assignment uuid, p_score int)
returns void language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.current_profile(); a public.test_assignments;
begin
  select * into a from public.test_assignments where id = p_assignment for update;
  if a.author_id is distinct from me.id then raise exception 'not_found'; end if;
  if a.status <> 'submitted' then raise exception 'not_submitted'; end if;
  update public.test_reports set author_score = p_score where assignment_id = a.id;
  perform public._accept(a.id);
end $$;

create or replace function public.reject_report(p_assignment uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.current_profile(); a public.test_assignments;
begin
  select * into a from public.test_assignments where id = p_assignment for update;
  if a.author_id is distinct from me.id then raise exception 'not_found'; end if;
  if a.status <> 'submitted' then raise exception 'not_submitted'; end if;
  if char_length(coalesce(p_reason, '')) < public.econ('min_reject_chars') then
    raise exception 'reason_required: at least % characters', public.econ('min_reject_chars');
  end if;
  update public.test_reports set reject_reason = p_reason where assignment_id = a.id;
  update public.test_assignments
    set status = 'rejected', decided_at = now(),
        dispute_deadline_at = now() + make_interval(hours => public.econ('dispute_hours'))
    where id = a.id;
end $$;

create or replace function public.open_dispute(p_assignment uuid, p_comment text)
returns void language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.current_profile(); a public.test_assignments;
begin
  select * into a from public.test_assignments where id = p_assignment for update;
  if a.tester_id is distinct from me.id then raise exception 'not_found'; end if;
  if a.status <> 'rejected' or a.dispute_deadline_at < now() then raise exception 'cannot_dispute'; end if;
  insert into public.disputes (assignment_id, opened_by, comment) values (a.id, me.id, p_comment);
  update public.test_assignments set status = 'disputed' where id = a.id;
end $$;

create or replace function public.resolve_dispute(p_dispute uuid, p_tester_won boolean, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.current_profile(); d public.disputes; a public.test_assignments;
begin
  if not public.is_staff(me.id) then raise exception 'forbidden'; end if;
  select * into d from public.disputes where id = p_dispute for update;
  if d.id is null or d.resolved_at is not null then raise exception 'not_open'; end if;
  select * into a from public.test_assignments where id = d.assignment_id;
  if a.tester_id = me.id or a.author_id = me.id then raise exception 'conflict_of_interest'; end if;
  update public.disputes
    set resolved_by = me.id, resolution = p_note, tester_won = p_tester_won, resolved_at = now()
    where id = d.id;
  if p_tester_won then
    perform public._accept(a.id);
  else
    update public.test_assignments set status = 'rejected_final' where id = a.id;
  end if;
end $$;

-- Called every 15 minutes by pg_cron (see cron migration). Safe to call any time.
create or replace function public.process_timeouts()
returns int language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  update public.test_assignments set status = 'expired', decided_at = now()
    where status = 'taken' and deadline_at < now();
  get diagnostics n = row_count;
  for r in select id from public.test_assignments
           where status = 'submitted' and review_deadline_at < now() loop
    perform public._accept(r.id); n := n + 1;
  end loop;
  update public.test_assignments set status = 'rejected_final'
    where status = 'rejected' and dispute_deadline_at < now();
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create or replace function public._grant_task(p_task public.tasks, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.ledger_add(p_user, p_task.reward, 'task_reward', 'task', p_task.id, p_task.title);
end $$;

-- Starter tasks are verified server-side by code.
create or replace function public.claim_starter_task(p_code text)
returns int language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.current_profile(); t public.tasks; ok boolean;
begin
  select * into t from public.tasks where code = p_code and kind = 'starter' and active;
  if t.id is null then raise exception 'unknown_task'; end if;
  if exists (select 1 from public.task_completions where task_id = t.id and user_id = me.id) then
    raise exception 'already_claimed';
  end if;
  ok := case p_code
    when 'complete_profile' then coalesce(char_length(me.bio), 0) >= 20
                                 and (me.itch_url is not null or me.steam_url is not null)
    when 'read_rules'       then true
    when 'add_game'         then exists (select 1 from public.games where owner_id = me.id)
    when 'first_test'       then exists (select 1 from public.test_assignments
                                         where tester_id = me.id and status = 'accepted')
    else false end;
  if not ok then raise exception 'requirements_not_met'; end if;
  insert into public.task_completions (task_id, user_id, status, decided_at) values (t.id, me.id, 'approved', now());
  perform public._grant_task(t, me.id);
  return t.reward;
end $$;

-- Player/advertiser tasks with manual review: user submits proof, staff approves.
create or replace function public.submit_task(p_task uuid, p_proof text)
returns void language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.current_profile(); t public.tasks;
begin
  select * into t from public.tasks where id = p_task and active and kind <> 'starter';
  if t.id is null then raise exception 'unknown_task'; end if;
  if t.daily_cap is not null and (select count(*) from public.task_completions
       where task_id = t.id and created_at > now() - interval '1 day') >= t.daily_cap then
    raise exception 'daily_cap_reached';
  end if;
  insert into public.task_completions (task_id, user_id, proof) values (t.id, me.id, p_proof);
end $$;

create or replace function public.review_task(p_completion uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.current_profile(); tc public.task_completions; t public.tasks;
begin
  if not public.is_staff(me.id) then raise exception 'forbidden'; end if;
  select * into tc from public.task_completions where id = p_completion for update;
  if tc.status <> 'pending' then raise exception 'not_pending'; end if;
  update public.task_completions set status = case when p_approve then 'approved'::public.completion_status
    else 'rejected'::public.completion_status end, decided_at = now() where id = tc.id;
  if p_approve then
    select * into t from public.tasks where id = tc.task_id;
    perform public._grant_task(t, tc.user_id);
  end if;
end $$;

create or replace function public.admin_adjust(p_user uuid, p_amount int, p_note text)
returns void language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.current_profile();
begin
  if me.role <> 'admin' then raise exception 'forbidden'; end if;
  perform public.ledger_add(p_user, p_amount, 'admin', 'admin', me.id, p_note);
end $$;

create or replace function public.set_ban(p_user uuid, p_banned boolean)
returns void language plpgsql security definer set search_path = public as $$
declare me public.profiles := public.current_profile();
begin
  if not public.is_staff(me.id) then raise exception 'forbidden'; end if;
  update public.profiles set is_banned = p_banned where id = p_user and role = 'user';
end $$;

-- ---------------------------------------------------------------------------
-- Public stats views
-- ---------------------------------------------------------------------------
create or replace view public.tester_stats with (security_invoker = false) as
  select p.id as user_id,
         count(*) filter (where a.status = 'accepted')       as accepted,
         count(*) filter (where a.status = 'rejected_final') as rejected,
         round(avg(r.author_score), 2)                        as avg_score
  from public.profiles p
  left join public.test_assignments a on a.tester_id = p.id
  left join public.test_reports r on r.assignment_id = a.id
  group by p.id;

create or replace view public.author_stats with (security_invoker = false) as
  select p.id as user_id,
         count(*) filter (where a.status in ('accepted', 'rejected', 'disputed', 'rejected_final')) as reviewed,
         count(*) filter (where a.status in ('rejected', 'disputed', 'rejected_final'))             as rejected
  from public.profiles p
  left join public.test_assignments a on a.author_id = p.id
  group by p.id;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.games            enable row level security;
alter table public.test_campaigns   enable row level security;
alter table public.test_assignments enable row level security;
alter table public.test_reports     enable row level security;
alter table public.disputes         enable row level security;
alter table public.tasks            enable row level security;
alter table public.task_completions enable row level security;
alter table public.ledger_entries   enable row level security;
alter table public.reports_abuse    enable row level security;

create policy "profiles readable" on public.profiles for select using (true);
create policy "own profile update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
-- role / ban / starter flags cannot be changed by the user:
revoke update on public.profiles from anon, authenticated;
grant update (username, display_name, avatar_url, bio, itch_url, steam_url) on public.profiles to authenticated;

create policy "games readable" on public.games for select using (true);
create policy "own games insert" on public.games for insert
  with check (owner_id = auth.uid() and not exists (select 1 from public.profiles where id = auth.uid() and is_banned));
create policy "own games update" on public.games for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own games delete" on public.games for delete
  using (owner_id = auth.uid() and not exists (select 1 from public.test_campaigns c where c.game_id = id and c.status = 'active'));

create policy "campaigns readable" on public.test_campaigns for select using (true);

create policy "assignments visible to parties" on public.test_assignments for select
  using (tester_id = auth.uid() or author_id = auth.uid() or public.is_staff(auth.uid()));

create policy "reports visible to parties" on public.test_reports for select
  using (exists (select 1 from public.test_assignments a where a.id = assignment_id
                 and (a.tester_id = auth.uid() or a.author_id = auth.uid() or public.is_staff(auth.uid()))));

create policy "disputes visible to parties" on public.disputes for select
  using (exists (select 1 from public.test_assignments a where a.id = assignment_id
                 and (a.tester_id = auth.uid() or a.author_id = auth.uid())) or public.is_staff(auth.uid()));

create policy "tasks readable" on public.tasks for select using (active or public.is_staff(auth.uid()));
create policy "own completions" on public.task_completions for select
  using (user_id = auth.uid() or public.is_staff(auth.uid()));

create policy "own ledger" on public.ledger_entries for select
  using (user_id = auth.uid() or public.is_staff(auth.uid()));

create policy "abuse insert" on public.reports_abuse for insert with check (reporter_id = auth.uid());
create policy "abuse staff read" on public.reports_abuse for select using (public.is_staff(auth.uid()));

-- Only the RPCs below are callable by clients; internal helpers are not.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.econ(text), public.wallet(uuid), public.create_campaign(uuid, text, int, int, int),
  public.close_campaign(uuid), public.take_slot(uuid), public.abandon_slot(uuid),
  public.submit_report(uuid, text, text, int, text[]), public.accept_report(uuid, int),
  public.reject_report(uuid, text), public.open_dispute(uuid, text),
  public.resolve_dispute(uuid, boolean, text), public.claim_starter_task(text),
  public.submit_task(uuid, text), public.review_task(uuid, boolean),
  public.admin_adjust(uuid, int, text), public.set_ban(uuid, boolean), public.is_staff(uuid)
  to authenticated;
grant execute on function public.econ(text), public.is_staff(uuid) to anon;
grant select on public.tester_stats, public.author_stats to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed: starter tasks (total 60 points)
-- ---------------------------------------------------------------------------
insert into public.tasks (kind, code, title, description, reward, sort) values
  ('starter', 'read_rules',       'Read the community rules', 'Learn how points, reports and disputes work.', 10, 1),
  ('starter', 'complete_profile', 'Complete your profile',    'Write a short bio (20+ characters) and add your itch.io or Steam link.', 10, 2),
  ('starter', 'add_game',         'Add your first game',      'Add a game you are working on. You can list it for testing later.', 10, 3),
  ('starter', 'first_test',       'Get your first test accepted', 'Test someone else''s game and get your report accepted. This also unlocks your starter points.', 30, 4);
