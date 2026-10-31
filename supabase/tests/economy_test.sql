-- End-to-end test of the point economy. Run with: npm run test:db
\set ON_ERROR_STOP 1
grant select on all tables in schema public to authenticated;

-- users
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@x.dev', '{"user_name":"alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@x.dev',   '{"user_name":"bob"}'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@x.dev', '{"user_name":"carol"}'),
  ('00000000-0000-0000-0000-00000000000d', 'mod@x.dev',   '{"user_name":"mod"}');
update public.profiles set role = 'moderator' where username = 'mod';

create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', u, false); end $$;
create or replace function pg_temp.expect_error(q text, pattern text) returns void language plpgsql as $$
begin
  begin execute q; exception when others then
    if sqlerrm !~ pattern then raise exception 'expected % got %', pattern, sqlerrm; end if;
    raise notice 'ok (expected error): %', pattern; return;
  end;
  raise exception 'expected error % but query succeeded: %', pattern, q;
end $$;
create or replace function pg_temp.check(cond boolean, label text) returns void language plpgsql as $$
begin if not cond then raise exception 'FAILED: %', label; end if; raise notice 'ok: %', label; end $$;

set role authenticated;

-- Alice: starter tasks give locked points
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.claim_starter_task('read_rules');
select pg_temp.expect_error($$select public.claim_starter_task('read_rules')$$, 'already_claimed');
select pg_temp.expect_error($$select public.claim_starter_task('complete_profile')$$, 'requirements_not_met');
update public.profiles set bio = 'Solo dev making a cozy farming roguelite.', itch_url = 'https://alice.itch.io'
  where id = auth.uid();
select public.claim_starter_task('complete_profile');
insert into public.games (owner_id, title, description, genre, build_url)
  values (auth.uid(), 'Cozy Farm', 'A cozy farming roguelite with runs.', 'Roguelite', 'https://alice.itch.io/cozy');
select public.claim_starter_task('add_game');
select pg_temp.check((select balance = 30 and locked = 30 and spendable = 0 from public.wallet()), 'alice 30 locked');
select pg_temp.expect_error($$select public.create_campaign((select id from games where title='Cozy Farm'),
  'Play the first run and report bugs please', 10, 10, 1)$$, 'insufficient_points');
-- cannot escalate own role
select pg_temp.expect_error($$update public.profiles set role = 'admin' where id = auth.uid()$$, 'permission denied');
select pg_temp.expect_error($$insert into public.ledger_entries (user_id, amount, kind) values (auth.uid(), 1000, 'admin')$$, 'permission denied|row-level');

-- Bob: same starter path + game, admin gives him real points to fund campaign
reset role;
insert into public.ledger_entries (user_id, amount, kind, note)
  values ('00000000-0000-0000-0000-00000000000b', 100, 'admin', 'test grant');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.games (owner_id, title, description, genre, build_url)
  values (auth.uid(), 'Space Dash', 'Fast-paced space runner with dashes.', 'Arcade', 'https://bob.itch.io/dash');
select pg_temp.expect_error($$select public.create_campaign((select id from games where title='Space Dash'),
  'Play three levels and tell me what you think', 15, 12, 2)$$, 'reward_too_low');
-- 2 slots x (20 + fee 2) = 44
select public.create_campaign((select id from games where title='Space Dash'),
  'Play three levels and tell me what you think', 15, 20, 2);
select pg_temp.check((select balance = 56 and held = 44 from public.wallet()), 'bob 44 held');
select pg_temp.expect_error($$select public.take_slot((select id from test_campaigns limit 1))$$, 'own_game');

-- Alice takes a slot and submits
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.take_slot((select id from test_campaigns limit 1));
select pg_temp.expect_error($$select public.take_slot((select id from test_campaigns limit 1))$$, 'already_tested');
select pg_temp.expect_error($$select public.submit_report((select id from test_assignments limit 1), 'too short', null, 4, array['https://x/s.png'])$$, 'report_too_short');
select public.submit_report((select id from test_assignments limit 1),
  repeat('Level two has a collision bug near the second gate. ', 4), 'Crash on pause', 4, array['https://x/s.png']);

-- Bob accepts -> Alice paid 20, starter unlocked, fee burned
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select public.accept_report((select id from test_assignments limit 1), 5);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.claim_starter_task('first_test');
select pg_temp.check((select balance = 80 and locked = 0 and spendable = 80 from public.wallet()), 'alice 80 spendable');
reset role;
select pg_temp.check((select sum(amount) = 2 from public.ledger_entries where kind = 'fee_burn'), 'fee burned');
set role authenticated;

-- Carol takes the second slot; Bob rejects; Carol disputes; moderator sides with Carol -> campaign closes
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.take_slot((select id from test_campaigns limit 1));
select public.submit_report((select id from test_assignments where tester_id = auth.uid()),
  repeat('The dash feels great but the jump has input lag. ', 4), null, 3, array['https://x/c.png']);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.expect_error($$select public.reject_report((select id from test_assignments where tester_id='00000000-0000-0000-0000-00000000000c'), 'bad')$$, 'reason_required');
select public.reject_report((select id from test_assignments where tester_id='00000000-0000-0000-0000-00000000000c'), 'Did not play the levels I asked for.');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.open_dispute((select id from test_assignments where tester_id = auth.uid()), 'I played all three levels, see screenshot.');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.resolve_dispute((select id from disputes limit 1), true, 'Screenshot shows level 3.');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select pg_temp.check((select balance = 20 and locked = 0 from public.wallet()), 'carol paid 20');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select status = 'closed' from test_campaigns limit 1), 'campaign auto-closed');
select pg_temp.check((select balance = 56 and held = 0 from public.wallet()), 'bob 56, nothing held');

-- Close with refund: Alice lists Cozy Farm for 3 slots, nobody tests, she closes -> full refund
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select public.create_campaign((select id from games where title='Cozy Farm'),
  'Play the first run and report bugs please', 10, 10, 3);
select pg_temp.check((select balance = 47 from public.wallet()), 'alice 33 held');
select public.close_campaign((select id from test_campaigns where status='active'));
select pg_temp.check((select balance = 80 from public.wallet()), 'alice refunded');

-- Timeouts: auto-accept after review deadline
select public.create_campaign((select id from games where title='Cozy Farm'),
  'Play the first run and report bugs please', 10, 10, 1);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
select public.take_slot((select id from test_campaigns where status='active'));
select public.submit_report((select id from test_assignments where tester_id = auth.uid() and status='taken'),
  repeat('Farming loop is relaxing, crops sometimes vanish. ', 4), null, 4, array['https://x/c2.png']);
reset role;
update public.test_assignments set review_deadline_at = now() - interval '1 minute' where status = 'submitted';
select public.process_timeouts();
set role authenticated;
select pg_temp.check((select balance = 30 from public.wallet()), 'carol auto-accepted +10');

-- Global invariant: total points = minted (tasks + admin + purchases) - burned
reset role;
select pg_temp.check(
  (select coalesce(sum(amount) filter (where user_id is not null), 0) from public.ledger_entries)
  = (select coalesce(sum(amount), 0) from public.ledger_entries where kind in ('task_reward','admin','purchase'))
    - (select coalesce(sum(amount), 0) from public.ledger_entries where kind = 'fee_burn')
    - (select coalesce(sum((slots - accepted) * (reward + fee)), 0) from public.test_campaigns where status = 'active'),
  'ledger invariant');
\echo ALL TESTS PASSED
