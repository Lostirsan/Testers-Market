-- Control questions: developers add up to 3 multiple-choice questions about their game.
-- Testers must answer all of them correctly to submit a report. Correct answers never leave
-- the database; testers get 2 attempts, after the second failure the slot is lost.

create table public.campaign_questions (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.test_campaigns (id) on delete cascade,
  position    int  not null check (position between 0 and 2),
  question    text not null check (char_length(question) between 5 and 300),
  options     text[] not null check (array_length(options, 1) between 2 and 5),
  correct     int  not null,
  check (correct >= 0 and correct < array_length(options, 1)),
  unique (campaign_id, position)
);

alter table public.campaign_questions enable row level security;
-- Only the campaign owner and staff can read questions with answers.
create policy "questions visible to owner" on public.campaign_questions for select
  using (exists (select 1 from public.test_campaigns c where c.id = campaign_id and c.owner_id = auth.uid())
         or public.is_staff(auth.uid()));

alter table public.test_assignments add column quiz_attempts int not null default 0;

create or replace function public.econ_quiz_attempts() returns int language sql immutable as $$ select 2 $$;

-- create_campaign gains an optional questions argument:
-- [{"question": "...", "options": ["a", "b", "c"], "correct": 1}, ...]
drop function public.create_campaign(uuid, text, int, int, int);
create or replace function public.create_campaign(
  p_game uuid, p_instructions text, p_min_minutes int, p_reward int, p_slots int,
  p_questions jsonb default '[]'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me public.profiles := public.current_profile();
  v_fee int; v_id uuid; q jsonb; i int := 0; v_opts text[];
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
  if jsonb_typeof(coalesce(p_questions, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_questions, '[]'::jsonb)) > 3 then
    raise exception 'bad_questions: up to 3 questions';
  end if;
  v_fee := ceil(p_reward * public.econ('fee_percent') / 100.0);
  insert into public.test_campaigns (game_id, owner_id, instructions, min_minutes, reward, fee, slots)
  values (p_game, me.id, p_instructions, p_min_minutes, p_reward, v_fee, p_slots)
  returning id into v_id;
  for q in select * from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    select array_agg(trim(x)) into v_opts from jsonb_array_elements_text(q -> 'options') x where trim(x) <> '';
    if coalesce(array_length(v_opts, 1), 0) < 2 or array_length(v_opts, 1) > 5
       or (q ->> 'correct')::int not between 0 and array_length(v_opts, 1) - 1
       or char_length(trim(q ->> 'question')) < 5 then
      raise exception 'bad_questions: each question needs text, 2 to 5 answers and one correct answer';
    end if;
    insert into public.campaign_questions (campaign_id, position, question, options, correct)
    values (v_id, i, trim(q ->> 'question'), v_opts, (q ->> 'correct')::int);
    i := i + 1;
  end loop;
  perform public.spend(me.id, (p_reward + v_fee) * p_slots, 'campaign', v_id);
  return v_id;
end $$;

-- Questions without answers, for the tester holding the slot.
create or replace function public.get_quiz(p_assignment uuid)
returns table (qpos int, question text, options text[])
language plpgsql stable security definer set search_path = public as $$
declare a public.test_assignments;
begin
  select * into a from public.test_assignments where id = p_assignment;
  if a.tester_id is distinct from auth.uid() then raise exception 'not_found'; end if;
  return query select q.position, q.question, q.options
    from public.campaign_questions q where q.campaign_id = a.campaign_id order by q.position;
end $$;

-- submit_report now checks answers and returns a status instead of raising on wrong answers,
-- so the attempt counter is kept: 'submitted' | 'wrong_answers' | 'slot_lost'.
drop function public.submit_report(uuid, text, text, int, text[]);
create or replace function public.submit_report(
  p_assignment uuid, p_body text, p_bugs text, p_rating int, p_media text[], p_answers int[] default '{}')
returns text language plpgsql security definer set search_path = public as $$
declare
  me public.profiles := public.current_profile();
  a public.test_assignments; v_correct int[]; v_attempts int;
begin
  select * into a from public.test_assignments where id = p_assignment for update;
  if a.tester_id is distinct from me.id then raise exception 'not_found'; end if;
  if a.status <> 'taken' then raise exception 'not_open'; end if;
  if a.deadline_at < now() then raise exception 'deadline_passed'; end if;
  if char_length(coalesce(p_body, '')) < public.econ('min_report_chars') then
    raise exception 'report_too_short: at least % characters', public.econ('min_report_chars');
  end if;
  if coalesce(array_length(p_media, 1), 0) < 1 then raise exception 'screenshot_required'; end if;

  select array_agg(correct order by position) into v_correct
    from public.campaign_questions where campaign_id = a.campaign_id;
  if v_correct is not null and coalesce(p_answers, '{}') is distinct from v_correct then
    v_attempts := a.quiz_attempts + 1;
    if v_attempts >= public.econ_quiz_attempts() then
      update public.test_assignments set quiz_attempts = v_attempts, status = 'expired', decided_at = now()
        where id = a.id;
      return 'slot_lost';
    end if;
    update public.test_assignments set quiz_attempts = v_attempts where id = a.id;
    return 'wrong_answers';
  end if;

  insert into public.test_reports (assignment_id, body, bugs, game_rating, media_urls)
  values (a.id, p_body, p_bugs, p_rating, p_media);
  update public.test_assignments
    set status = 'submitted', submitted_at = now(),
        review_deadline_at = now() + make_interval(hours => public.econ('review_hours'))
    where id = a.id;
  return 'submitted';
end $$;

revoke execute on function public.create_campaign(uuid, text, int, int, int, jsonb),
  public.get_quiz(uuid), public.submit_report(uuid, text, text, int, text[], int[]),
  public.econ_quiz_attempts() from public, anon;
grant execute on function public.create_campaign(uuid, text, int, int, int, jsonb),
  public.get_quiz(uuid), public.submit_report(uuid, text, text, int, text[], int[])
  to authenticated;
