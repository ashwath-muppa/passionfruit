-- ──────────────────────────────────────────────────────────────────────────
-- Passionfruit — design surfaces (Direction A · Warm Paper).
-- Adds the data behind the Skills planner and "Up next" on the parent
-- dashboard, plus presentation metadata on milestones for the timeline
-- surfaces. Mirrors the additions in lib/db/schema.ts.
-- ──────────────────────────────────────────────────────────────────────────

-- ── Milestone presentation metadata (all nullable; UI derives defaults). ──
alter table milestones add column kind   text;  -- deliverable eyebrow, e.g. "Course"
alter table milestones add column source text;  -- resource line, e.g. "Coursera"
alter table milestones add column icon   text;  -- emoji marker
alter table milestones add column coach  text;  -- mentor coaching note (current week)

-- ── Skills planner: categorical progress bars. ──
create table skills (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  label      text not null,
  category   text not null,
  progress   real not null default 0,
  created_at timestamptz not null default now()
);
create index skills_student_id_idx on skills (student_id);

-- ── "Up next": mentor check-ins and opportunity windows. ──
create type opportunity_kind as enum ('check_in', 'window', 'deadline');
create table opportunities (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  kind       opportunity_kind not null,
  title      text not null,
  when_hint  text,
  created_at timestamptz not null default now()
);
create index opportunities_student_id_idx on opportunities (student_id);
