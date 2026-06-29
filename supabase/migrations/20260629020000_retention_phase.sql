-- ──────────────────────────────────────────────────────────────────────────
-- Passionfruit — Retention phase (features #6, #7, #8).
-- The weekly habit loop + activation, the engagement system (streaks/badges),
-- and the parent digest log. Mirrors lib/db/schema.ts.
-- ──────────────────────────────────────────────────────────────────────────

create type weekly_focus_status as enum ('open', 'celebrated');
create type digest_kind         as enum ('monthly', 'weekly');

-- Activation sprint (#6): when the student hit their first tangible win.
alter table students add column first_win_at timestamptz;

-- Engagement (#7): one streak row per student.
create table streaks (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null unique references students (id) on delete cascade,
  current       integer not null default 0,
  longest       integer not null default 0,
  last_check_in timestamptz,
  created_at    timestamptz not null default now()
);

-- Engagement (#7): collectible milestone badges (one per slug per student).
create table badges (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  slug       text not null,
  label      text not null,
  emoji      text,
  earned_at  timestamptz not null default now(),
  constraint badges_student_slug_uniq unique (student_id, slug)
);
create index badges_student_id_idx on badges (student_id);

-- Weekly habit loop (#6): the AI-generated "here's your week" focus card.
create table weekly_focus (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  week_start timestamptz not null,
  headline   text not null,
  tasks      jsonb not null default '[]'::jsonb,
  status     weekly_focus_status not null default 'open',
  created_at timestamptz not null default now()
);
create index weekly_focus_student_id_idx on weekly_focus (student_id, week_start desc);

-- Parent digests (#8): a log of monthly summaries + weekly support nudges.
create table digests (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  kind       digest_kind not null,
  subject    text,
  body       text,
  channel    text not null default 'onscreen',
  sent_at    timestamptz not null default now()
);
create index digests_student_id_idx on digests (student_id, sent_at desc);
