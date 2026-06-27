-- ──────────────────────────────────────────────────────────────────────────
-- Passionfruit — initial schema: the learner graph.
-- Mirrors lib/db/schema.ts. Enables pgvector, wires the auth.users FK, and
-- creates HNSW cosine indexes for semantic recall.
-- ──────────────────────────────────────────────────────────────────────────

create extension if not exists vector;

-- ── Enums ──
create type constraint_kind   as enum ('time', 'budget', 'location', 'other');
create type goal_horizon       as enum ('short', 'long');
create type goal_status        as enum ('open', 'in_progress', 'achieved', 'dropped');
create type observation_source as enum ('intake', 'project', 'reflection', 'system');
create type path_type          as enum ('research', 'app', 'sports_analytics', 'creative', 'venture');
create type project_status     as enum ('proposed', 'active', 'done');
create type milestone_status   as enum ('todo', 'doing', 'done');
create type ai_task            as enum ('intake', 'match_paths', 'plan_steps', 'parent_summary', 'moderation', 'embed');
create type flag_severity      as enum ('low', 'medium', 'high');
create type flag_status        as enum ('open', 'reviewed', 'dismissed');

-- ── Accounts: parent is the account holder (parent-mediated / COPPA). ──
create table parents (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  email        text not null,
  name         text,
  created_at   timestamptz not null default now()
);

-- ── Students belong to a parent. All student data owned by the parent. ──
create table students (
  id               uuid primary key default gen_random_uuid(),
  parent_id        uuid not null references parents (id) on delete cascade,
  name             text not null,
  age              integer,
  grade            text,
  under_13         boolean not null default false,
  parental_consent boolean not null default false,
  consent_at       timestamptz,
  created_at       timestamptz not null default now()
);
create index students_parent_id_idx on students (parent_id);

-- ── Learner graph: current structured state ──
create table interests (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students (id) on delete cascade,
  label        text not null,
  category     text,
  strength     real not null default 0.5,
  source       text,
  embedding    vector(768),
  last_updated timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index interests_student_id_idx on interests (student_id);
create index interests_embedding_idx on interests using hnsw (embedding vector_cosine_ops);

create table strengths (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  label      text not null,
  evidence   text,
  embedding  vector(768),
  created_at timestamptz not null default now()
);
create index strengths_student_id_idx on strengths (student_id);
create index strengths_embedding_idx on strengths using hnsw (embedding vector_cosine_ops);

create table constraints (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  kind       constraint_kind not null,
  value      text not null,
  created_at timestamptz not null default now()
);
create index constraints_student_id_idx on constraints (student_id);

create table goals (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  horizon    goal_horizon not null,
  text       text not null,
  status     goal_status not null default 'open',
  embedding  vector(768),
  created_at timestamptz not null default now()
);
create index goals_student_id_idx on goals (student_id);
create index goals_embedding_idx on goals using hnsw (embedding vector_cosine_ops);

-- ── Longitudinal memory: append-only log of signals over time. ──
create table observations (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  type       text not null,
  content    text not null,
  payload    jsonb,
  source     observation_source not null,
  embedding  vector(768),
  created_at timestamptz not null default now()
);
create index observations_student_id_idx on observations (student_id);
create index observations_created_at_idx on observations (student_id, created_at desc);
create index observations_embedding_idx on observations using hnsw (embedding vector_cosine_ops);

-- ── Projects ──
create table project_paths (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students (id) on delete cascade,
  candidates   jsonb not null,
  generated_at timestamptz not null default now()
);
create index project_paths_student_id_idx on project_paths (student_id);

create table projects (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  path_type  path_type not null,
  title      text not null,
  summary    text,
  status     project_status not null default 'proposed',
  chosen_at  timestamptz,
  created_at timestamptz not null default now()
);
create index projects_student_id_idx on projects (student_id);

create table milestones (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  week_no    integer not null,
  title      text not null,
  detail     text,
  status     milestone_status not null default 'todo',
  due_hint   text,
  created_at timestamptz not null default now()
);
create index milestones_project_id_idx on milestones (project_id);

-- ── Artifacts: outputs / reflections (metadata + text for now). ──
create table artifacts (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects (id) on delete cascade,
  kind       text not null,
  title      text not null,
  text       text,
  meta       jsonb,
  embedding  vector(768),
  created_at timestamptz not null default now()
);
create index artifacts_project_id_idx on artifacts (project_id);
create index artifacts_embedding_idx on artifacts using hnsw (embedding vector_cosine_ops);

-- ── Audit: every AI interaction logged for later review. ──
create table ai_interactions (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid references students (id) on delete set null,
  task          ai_task not null,
  model         text not null,
  prompt        text not null,
  response      text,
  input_flagged boolean not null default false,
  output_flagged boolean not null default false,
  latency_ms    integer,
  created_at    timestamptz not null default now()
);
create index ai_interactions_student_id_idx on ai_interactions (student_id, created_at desc);

-- ── Safety: escalation queue for flagged content. ──
create table safety_flags (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid references students (id) on delete set null,
  ai_interaction_id uuid references ai_interactions (id) on delete set null,
  severity          flag_severity not null,
  categories        jsonb not null,
  content           text not null,
  status            flag_status not null default 'open',
  created_at        timestamptz not null default now()
);
create index safety_flags_status_idx on safety_flags (status, created_at desc);

-- ──────────────────────────────────────────────────────────────────────────
-- TODO(seam): Row-Level Security. For the local prototype, ownership is
-- enforced in the data layer (lib/auth/parent.ts). Before any shared/hosted
-- deployment, enable RLS on every table and add policies keyed on
-- parents.auth_user_id = auth.uid(). Left off here intentionally so seeding
-- and local dev are frictionless.
-- ──────────────────────────────────────────────────────────────────────────
