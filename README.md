# Next in Research

A persistent AI mentor for ambitious middle-schoolers (ages 11–15). It turns a
kid's interests into real, portfolio-worthy projects and keeps a multi-year
**learner graph** — the structured, per-student memory that is the core of the
product. This repo is the **first vertical slice**.

> Status: prototype. One end-to-end flow works; everything else is stubbed with
> clear TODO seams.

## The flow that works end-to-end

1. **Parent signs up** and creates a **student profile** (with an under-13
   COPPA consent flag).
2. **Conversational AI intake** (parent-assisted, under the parent session)
   populates the learner graph.
3. The system generates **2–3 personalized project paths** from the graph
   (research paper, app, sports-analytics, creative portfolio, social venture —
   research is just one option).
4. The student **picks a path**; the system breaks it into **weekly steps**.
5. A **parent dashboard** shows the profile, chosen project, progress, and an
   **AI-generated parent summary**.

Every AI call is **moderated (input + output)** and **audit-logged**. Risky
content is written to an **escalation queue**.

## Stack

- **Next.js (App Router) + TypeScript** (strict)
- **Supabase**: Postgres + Auth + Storage, **pgvector** enabled
- **Drizzle ORM** with SQL migrations checked into the repo
- **AI gateway** (`lib/ai/`): provider-agnostic, **Gemini** wired by default.
  Models swap via env (`FAST_MODEL`, `QUALITY_MODEL`, `EMBEDDING_MODEL`).

## Prerequisites

- Node 20+ and npm
- **Docker** running (local Supabase needs it)
- A **Gemini API key** — free at https://aistudio.google.com/app/apikey

## Run it locally

```bash
# 1. Install deps (includes the Supabase CLI as a dev dependency)
npm install

# 2. Start local Supabase (Postgres + Auth + Storage). Requires Docker running.
npx supabase start

# 3. Configure env
cp .env.example .env.local
#   - paste your GEMINI_API_KEY
#   - paste the anon + service_role keys printed by `npx supabase status`
#     (the DATABASE_URL / SUPABASE_URL local defaults already match)

# 4. Apply migrations (enables pgvector + creates the learner-graph schema)
npx supabase db reset

# 5. Seed 2–3 sample students at different interest profiles
npm run seed

# 6. Run the app
npm run dev
# open http://localhost:3000
```

Sign in with a seeded parent (printed by the seed script) or create a new
account at `/signup`.

## Project layout

```
app/            App Router pages + API routes
lib/ai/         model gateway, Gemini provider, task fns, prompts
lib/db/         Drizzle schema, client, semantic retrieval, queries
lib/auth/       Supabase SSR auth + parent ownership helpers
lib/safety/     moderateContent() -> safety_flags
lib/audit/      AI interaction logging -> ai_interactions
supabase/       config.toml, SQL migrations, seed.ts
components/     UI primitives + feature components
```

## What's intentionally out of this slice

Stripe/billing, scheduled jobs (run on-demand), full multimodal upload, mentor
scheduling/video, SMS, analytics dashboards, RLS policies. Each has a `TODO`
seam where it plugs in. See `docs/ARCHITECTURE.md` for the seams.
