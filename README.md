# Test Traders

Indie developers test each other's games for points. Earn points by testing and doing tasks,
spend them to get your own game tested.

**Stack:** Next.js 16 (App Router, server actions) · Supabase (Postgres, Auth, Storage) ·
Cloudflare Workers via OpenNext · Tailwind CSS 4. Everything runs on free tiers.

## How the point economy works

- Users start with 0 points. Starter tasks give up to 60 points, locked until the user's first
  test of someone else's game is accepted.
- Listing a game holds `(reward + 10% fee) × testers` in escrow. Each accepted report pays the
  tester and burns the fee. Closing a campaign refunds unused slots.
- Unreviewed reports are auto-accepted after 72 h. Rejections need a reason and can be disputed
  for 72 h; a moderator decides.
- All point movements are rows in `ledger_entries`; balance is their sum. Clients can't write the
  ledger: every change goes through `SECURITY DEFINER` functions in
  `supabase/migrations/20261031000001_core.sql`. Tunable numbers live in `public.econ()`.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL and anon key
npm run dev
```

Database tests (plain Postgres 15+ with `psql`, `createdb` on PATH):

```bash
npm run test:db
```

## Setting up Supabase

1. Create a free project (region close to your users, e.g. Frankfurt).
2. SQL Editor: run the files in `supabase/migrations/` in order
   (or `npx supabase link` then `npx supabase db push`).
3. Authentication > URL Configuration: set Site URL to your domain and add
   `https://YOUR-DOMAIN/auth/callback` to Redirect URLs.
4. Authentication > Providers: enable Discord and GitHub (and Google if you like). Each provider's
   OAuth app uses `https://YOUR-PROJECT.supabase.co/auth/v1/callback` as its callback URL.
5. Make yourself admin: `update profiles set role = 'admin' where username = 'you';`

## Deploying to Cloudflare Workers

Connect the repository in Cloudflare (Workers & Pages > Create > Import a repository) with:

- Build command: `npx opennextjs-cloudflare build`
- Deploy command: `npx opennextjs-cloudflare deploy`
- Build variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`

Or from your machine: `npx wrangler login && npm run deploy`.

## Project layout

```
src/app/actions.ts          all server actions (forms call these)
src/app/...                 pages: games, my-games, tests, tasks, wallet, admin, ...
src/lib/                    Supabase clients, auth helpers, types, error messages
src/proxy.ts                session refresh + private route guard
supabase/migrations/        schema, economy functions, RLS, cron, storage
supabase/tests/             economy test on plain Postgres
```
