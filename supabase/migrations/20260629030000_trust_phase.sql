-- ──────────────────────────────────────────────────────────────────────────
-- Passionfruit — Trust phase (features #5, #9).
-- The real-artifact pipeline (upload → portfolio → shareable) and the capped
-- mentor-checkpoint layer. Mirrors lib/db/schema.ts.
-- ──────────────────────────────────────────────────────────────────────────

-- ── #5 Artifact pipeline: extend artifacts for portfolio uploads + sharing. ──
alter table artifacts alter column project_id drop not null;
alter table artifacts add column student_id uuid references students (id) on delete cascade;
alter table artifacts add column url        text;
alter table artifacts add column mime_type  text;
alter table artifacts add column slug       text unique;
alter table artifacts add column shared     boolean not null default false;
create index artifacts_student_id_idx on artifacts (student_id);

-- Public Storage bucket for uploaded work (share links resolve to public URLs;
-- uploads happen server-side via the service-role client).
insert into storage.buckets (id, name, public)
values ('artifacts', 'artifacts', true)
on conflict (id) do nothing;

-- ── #9 Mentor checkpoints. ──
alter table students add column tier text not null default 'core';  -- core | plus

create type checkpoint_status as enum ('requested', 'scheduled', 'completed', 'cancelled');

create table mentors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text,
  field      text,
  bio        text,
  credential text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table checkpoints (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students (id) on delete cascade,
  mentor_id    uuid references mentors (id) on delete set null,
  scheduled_at timestamptz,
  status       checkpoint_status not null default 'requested',
  term         text not null,
  notes        text,
  created_at   timestamptz not null default now()
);
create index checkpoints_student_id_idx on checkpoints (student_id);
