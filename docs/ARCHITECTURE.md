# Architecture

The first vertical slice, and where the rest plugs in.

## The learner graph (the moat)

Owned entirely in our own Postgres — no third-party memory-as-a-service. Two
layers:

1. **Current structured state** — `interests` (with strength + last-updated),
   `strengths`, `constraints` (time/budget/location), `goals`. This is the
   "who they are right now" snapshot the AI reasons over.
2. **Longitudinal memory** — `observations`, an append-only log of signals over
   time. This is what makes the memory multi-year: state can change, but the
   history of how a kid grew is never overwritten.

Semantic recall sits on top: the embedded columns (`interests`, `strengths`,
`goals`, `observations`, `artifacts`) are queried by cosine similarity via
`lib/db/retrieval.ts` and folded into prompts. Embeddings go through the same
gateway as everything else, so the embedding model is swappable too.

```
parent ──< student ──< interests / strengths / constraints / goals   (state)
                   ──< observations                                   (history)
                   ──< project_paths (snapshot of generated options)
                   ──< projects ──< milestones
                                ──< artifacts
ai_interactions   (audit: every model call)
safety_flags      (escalation queue: flagged content)
```

## AI gateway

```
tasks.ts  ── public, audited + moderated API (runIntake, matchProjectPaths, …)
   │
   ├── gateway.ts        ── provider selection + low-level primitives
   │      └── providers/gemini.ts   (implements ModelProvider)
   ├── safety/moderation.ts  ── moderateContent() on every input + output
   └── audit/log.ts          ── one ai_interactions row per call
```

- **Routing by task**: `FAST_MODEL` for parsing/classification/matching,
  `QUALITY_MODEL` for anything a kid or parent reads. Set in env.
- **Swappable provider**: add a file implementing `ModelProvider`, register it
  in `gateway.ts`, point `AI_PROVIDER` at it.
- **Prompts** are split into a stable `system` block and a variable `user`
  block (`lib/ai/prompts/`) so context caching can be added later without
  reshaping call sites.
- **Safety is mandatory**: `tasks.ts` moderates input before the model sees it
  (high severity is blocked) and moderates output before it's returned; flags
  land in `safety_flags`.

## Seams (where deferred work plugs in)

| Deferred | Seam |
| --- | --- |
| Stripe / billing | Add to the `parents` account model; gate student creation. |
| Scheduled jobs | Task fns are on-demand now; wrap `planWeeklySteps` / `generateParentSummary` in a cron worker. |
| Email of parent summary | `app/api/parent-summary` returns the summary; add a mailer at the seam comment. |
| Multimodal artifacts | `artifacts` table holds metadata + text; add Storage upload + parsing. |
| RLS | Ownership is enforced in `lib/auth/parent.ts`; before any shared deploy, enable RLS keyed on `parents.auth_user_id = auth.uid()`. See the TODO block at the end of the migration. |
| Separate student login | Today students operate under the parent session; add scoped student auth later. |
| Mentor scheduling / SMS / analytics | Not started. |

## Request flow (happy path)

```
signup → POST /api/students (consent gate) → /students/[id]/intake
  → POST /api/intake (per turn; persists graph on completion)
  → /students/[id]/paths → POST /api/paths (generate + snapshot)
  → pick → POST /api/plan (weekly steps + promote to project)
  → /students/[id] dashboard → POST /api/parent-summary (on demand)
```
