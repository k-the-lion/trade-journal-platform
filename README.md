# Trade Journal Platform

Multi-user trading journal with AI coaching, performance reports, and coach-managed student groups.

## Features

- **Auth** — Email/password signup and login via Supabase
- **Trade logging** — Manual entry with tags, setup, rule adherence, account type
- **Reports** — Win rate, profit factor, equity curve, breakdowns by symbol/setup/day
- **AI Coach** — Chat powered by OpenAI using coach-defined playbooks + trade context
- **Coach dashboard** — Create orgs, invite students, view group performance
- **CSV import** — Flexible column mapping with dedup via `external_id`
- **Broker-ready** — Import adapter interface for future API sync (Tradovate stub included)

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migration in `supabase/migrations/001_initial_schema.sql` via the SQL editor
3. Copy your project URL and anon key

### 2. Environment

```bash
cp .env.local.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...   # optional; chat works with fallback message without it
```

### 3. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Deploy

- **App**: Deploy to [Vercel](https://vercel.com) (connect repo, add env vars)
- **Database**: Supabase (already hosted)
- Set auth redirect URL: `https://your-domain.com/auth/callback`

## Invite flow

Coaches invite students from `/coach`. Share the invite link:

```
https://your-domain.com/invite?token=INVITE_TOKEN
```

Student must sign up / sign in with the invited email, then accept.

## CSV import

Expected columns (auto-detected if headers match):

| Field | Default header |
|-------|----------------|
| Date | Date |
| Symbol | Symbol |
| Direction | Direction |
| Entry | Entry |
| Exit | Exit |
| Quantity | Quantity |
| PnL | PnL |
| R | R |
| Setup | Setup |
| Notes | Notes |
| ID | ID |

## Project structure

```
src/
  app/(dashboard)/   # Authenticated pages
  components/      # UI components
  lib/
    actions.ts     # Server actions
    ai/            # AI prompt building
    imports/       # CSV + broker adapter layer
    reports/       # Stats engine
    supabase/      # Auth clients
supabase/migrations/
```

## Disclaimer

Educational tool only — not financial advice.

## Agent auto-run (optional)

This repo includes [`.cursor/sandbox.json`](.cursor/sandbox.json) and [`.cursor/permissions.json`](.cursor/permissions.json) so Cursor agents can run npm/git/build commands with fewer approval prompts.

For fully hands-off builds, also set **Cursor Settings → Agents → Run Mode → Run Everything** and enable **Auto-apply edits** if desired.

