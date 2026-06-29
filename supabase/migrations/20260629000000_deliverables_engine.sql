-- ──────────────────────────────────────────────────────────────────────────
-- Passionfruit — Deliverables Engine (feature #1).
-- The vetted catalog of real-world targets (papers/competitions/awards), the
-- parent-approval gate that anchors a project to a target, and parent-set
-- end-goal direction. Mirrors the additions in lib/db/schema.ts.
-- ──────────────────────────────────────────────────────────────────────────

-- ── Enums ──
create type deliverable_category   as enum ('paper', 'competition', 'award');
create type deliverable_difficulty as enum ('intro', 'intermediate', 'advanced', 'elite');
create type prestige_tier          as enum ('t1', 't2', 't3', 't4', 'flag');
create type cost_band              as enum ('free', 'low', 'medium', 'high');
create type deliverable_status     as enum ('active', 'paused', 'discontinued', 'uncertain');
create type target_status          as enum ('suggested', 'parent_approved', 'active', 'submitted', 'achieved', 'declined');

-- ── Parent-set direction on the student (student drives interests; parent
--    steers the end-goal). Null = let the mentor suggest. ──
alter table students add column end_goal_pref text;  -- research|competition|portfolio|venture|award|open
alter table students add column goal_note     text;

-- ── The deliverables catalog ──
create table deliverables (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  category      deliverable_category not null,
  subtype       text,
  domains       jsonb not null default '[]'::jsonb,
  min_grade     integer,
  ms_accessible boolean not null default false,
  age_note      text,
  difficulty    deliverable_difficulty not null,
  prestige_tier prestige_tier not null,
  prerequisites text,
  cost_band     cost_band not null,
  cost_note     text,
  cadence       text,
  how_to_start  text,
  a2c_insight   text,
  status        deliverable_status not null default 'active',
  flags         jsonb not null default '[]'::jsonb,
  url           text,
  embedding     vector(768),
  created_at    timestamptz not null default now()
);
create index deliverables_category_idx   on deliverables (category);
create index deliverables_tier_idx       on deliverables (prestige_tier);
create index deliverables_status_idx     on deliverables (status);
create index deliverables_embedding_idx  on deliverables using hnsw (embedding vector_cosine_ops);

-- ── A project's anchored target + the parent-approval gate ──
create table project_targets (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references students (id) on delete cascade,
  project_id      uuid references projects (id) on delete set null,
  deliverable_id  uuid not null references deliverables (id) on delete cascade,
  rationale       text,
  status          target_status not null default 'suggested',
  parent_approved boolean not null default false,
  created_at      timestamptz not null default now()
);
create index project_targets_student_id_idx on project_targets (student_id);

-- ── Calendar engine (#4) links a deadline opportunity back to its deliverable ──
alter table opportunities add column deliverable_id uuid;
