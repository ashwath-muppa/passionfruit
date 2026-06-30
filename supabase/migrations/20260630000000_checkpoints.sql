-- ──────────────────────────────────────────────────────────────────────────
-- Passionfruit — Functional checkpoints.
-- A milestone, leveled up into a self-contained mini-curriculum: real
-- resources, an AI rationale, a difficulty, a step-by-step guide, and a defined
-- deliverable artifact (which flows into the Running Resume). The rich detail is
-- generated lazily on first open and cached here. Mirrors lib/db/schema.ts.
-- ──────────────────────────────────────────────────────────────────────────

create type checkpoint_type       as enum ('course', 'build', 'creative', 'research');
create type checkpoint_difficulty as enum ('beginner', 'intermediate', 'advanced');
create type deliverable_kind      as enum ('certificate', 'repo', 'image', 'paper', 'link', 'other');

-- Which detail treatment a milestone renders (null until generated).
alter table milestones add column checkpoint_type checkpoint_type;

-- The lazily-generated, cached mini-curriculum (one row per milestone).
create table checkpoint_details (
  id               uuid primary key default gen_random_uuid(),
  milestone_id     uuid not null unique references milestones (id) on delete cascade,
  student_id       uuid not null references students (id) on delete cascade,
  type             checkpoint_type not null,
  difficulty       checkpoint_difficulty not null,
  description      text not null,
  resources        jsonb not null default '[]'::jsonb,
  steps            jsonb not null default '[]'::jsonb,
  deliverable_kind deliverable_kind not null,
  deliverable_spec text not null,
  research         jsonb,
  model            text,
  generated_at     timestamptz not null default now()
);
create index checkpoint_details_student_idx on checkpoint_details (student_id);

-- A completed checkpoint's deliverable becomes a resume artifact; trace it back.
alter table artifacts add column milestone_id uuid references milestones (id) on delete set null;
create index artifacts_milestone_idx on artifacts (milestone_id);
