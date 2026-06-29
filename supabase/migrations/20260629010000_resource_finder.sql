-- ──────────────────────────────────────────────────────────────────────────
-- Passionfruit — Live Resource Finder (feature #2).
-- Concrete external resources (best free course / program / portfolio / dataset)
-- attached to a milestone: web-sourced + vetted, then cached with a freshness
-- date. Mirrors lib/db/schema.ts.
-- ──────────────────────────────────────────────────────────────────────────

create type resource_kind as enum (
  'course', 'program', 'portfolio', 'dataset', 'tool', 'competition', 'reading', 'other'
);

create table resources (
  id            uuid primary key default gen_random_uuid(),
  milestone_id  uuid references milestones (id) on delete cascade,
  student_id    uuid references students (id) on delete cascade,
  kind          resource_kind not null,
  title         text not null,
  provider      text,
  url           text,
  cost_note     text,
  summary       text,
  flags         jsonb not null default '[]'::jsonb,
  source        text not null default 'curated',
  last_verified timestamptz not null default now(),
  created_at    timestamptz not null default now()
);
create index resources_milestone_id_idx on resources (milestone_id);
