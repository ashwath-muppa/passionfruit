// ──────────────────────────────────────────────────────────────────────────
// The learner graph — the structured, persistent, per-student memory.
// This is the core moat. Owned in our own Postgres; no memory-as-a-service.
//
// Drizzle is the typed source of truth. The checked-in SQL migration in
// supabase/migrations mirrors this exactly (it additionally enables pgvector,
// wires the FK to auth.users, and creates ivfflat indexes).
// ──────────────────────────────────────────────────────────────────────────

import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import type {
  ProjectPathCandidate,
  ModerationResult,
  CheckpointResource,
  CheckpointStep,
  ResearchState,
} from "../types";

// Embedding width. MUST match EMBEDDING_MODEL output (Gemini text-embedding-004
// = 768). Changing this requires a migration (pgvector columns are fixed-width).
export const EMBEDDING_DIMENSIONS = 768;

// ── Enums ──
export const constraintKind = pgEnum("constraint_kind", [
  "time",
  "budget",
  "location",
  "other",
]);
export const goalHorizon = pgEnum("goal_horizon", ["short", "long"]);
export const goalStatus = pgEnum("goal_status", [
  "open",
  "in_progress",
  "achieved",
  "dropped",
]);
export const observationSource = pgEnum("observation_source", [
  "intake",
  "project",
  "reflection",
  "system",
]);
export const pathType = pgEnum("path_type", [
  "research",
  "app",
  "sports_analytics",
  "creative",
  "venture",
]);
export const projectStatus = pgEnum("project_status", [
  "proposed",
  "active",
  "done",
]);
export const milestoneStatus = pgEnum("milestone_status", [
  "todo",
  "doing",
  "done",
]);
// "Up next" surface on the parent dashboard (DESIGN.md §7c).
export const opportunityKind = pgEnum("opportunity_kind", [
  "check_in",
  "window",
  "deadline",
]);
export const aiTask = pgEnum("ai_task", [
  "intake",
  "match_paths",
  "plan_steps",
  "parent_summary",
  "moderation",
  "embed",
]);
export const flagSeverity = pgEnum("flag_severity", ["low", "medium", "high"]);
export const flagStatus = pgEnum("flag_status", [
  "open",
  "reviewed",
  "dismissed",
]);

// ── Deliverables catalog (the vetted real-world targets). Mirrors the field
//    spec in passionfruit_deliverables_catalog. ──
export const deliverableCategory = pgEnum("deliverable_category", [
  "paper",
  "competition",
  "award",
]);
export const deliverableDifficulty = pgEnum("deliverable_difficulty", [
  "intro",
  "intermediate",
  "advanced",
  "elite",
]);
// t1 = flagship scarcity signal … t4 = participation; flag = community red flag.
export const prestigeTier = pgEnum("prestige_tier", ["t1", "t2", "t3", "t4", "flag"]);
export const costBand = pgEnum("cost_band", ["free", "low", "medium", "high"]);
export const deliverableStatus = pgEnum("deliverable_status", [
  "active",
  "paused",
  "discontinued",
  "uncertain",
]);
// Lifecycle of a project's anchored real-world target. Parent approval is an
// explicit gate so the family steers the end-goal (the student drives interests).
export const targetStatus = pgEnum("target_status", [
  "suggested", // AI proposed it
  "parent_approved", // the parent chose/approved it as the north star
  "active", // the project is working toward it
  "submitted", // submitted / entered
  "achieved", // accepted / placed / won
  "declined", // parent or student set it aside
]);

// Live Resource Finder (#2): concrete external resources attached to a step.
export const resourceKind = pgEnum("resource_kind", [
  "course",
  "program",
  "portfolio",
  "dataset",
  "tool",
  "competition",
  "reading",
  "other",
]);

// Retention phase enums (#6 habit loop, #8 parent digest).
export const weeklyFocusStatus = pgEnum("weekly_focus_status", ["open", "celebrated"]);
export const digestKind = pgEnum("digest_kind", ["monthly", "weekly"]);

// Mentor checkpoints (#9) — the capped human layer.
export const checkpointStatus = pgEnum("checkpoint_status", [
  "requested",
  "scheduled",
  "completed",
  "cancelled",
]);

// Functional checkpoints — a milestone leveled up into a mini-curriculum.
export const checkpointType = pgEnum("checkpoint_type", [
  "course",
  "build",
  "creative",
  "research",
]);
export const checkpointDifficulty = pgEnum("checkpoint_difficulty", [
  "beginner",
  "intermediate",
  "advanced",
]);
export const deliverableKind = pgEnum("deliverable_kind", [
  "certificate",
  "repo",
  "image",
  "paper",
  "link",
  "other",
]);

// ── Accounts: parent is the account holder (COPPA / parent-mediated). ──
export const parents = pgTable("parents", {
  id: uuid("id").primaryKey().defaultRandom(),
  // FK to auth.users(id) — declared in the SQL migration (cross-schema).
  authUserId: uuid("auth_user_id").notNull().unique(),
  email: text("email").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Students belong to a parent. All student data is owned by the parent. ──
export const students = pgTable("students", {
  id: uuid("id").primaryKey().defaultRandom(),
  parentId: uuid("parent_id")
    .notNull()
    .references(() => parents.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  age: integer("age"),
  grade: text("grade"),
  under13: boolean("under_13").notNull().default(false),
  parentalConsent: boolean("parental_consent").notNull().default(false),
  consentAt: timestamp("consent_at", { withTimezone: true }),
  // Parent-set direction (DESIGN #10): the student drives interests; the parent
  // chooses the kind of end-goal they'd love their child to aim at, and adds a
  // free-text aspiration. The AI proposes targets *within* this guardrail so the
  // family feels they're steering. Null = "let the mentor suggest".
  endGoalPref: text("end_goal_pref"), // research | competition | portfolio | venture | award | open
  goalNote: text("goal_note"),
  // Activation sprint (#6): when the student hit their first tangible win.
  firstWinAt: timestamp("first_win_at", { withTimezone: true }),
  // Plan tier — gates the mentor-checkpoint cap (#9). Billing plugs in here later.
  tier: text("tier").notNull().default("core"), // core | plus
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Learner graph: current structured state ──
export const interests = pgTable("interests", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  category: text("category"),
  strength: real("strength").notNull().default(0.5),
  source: text("source"),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
  lastUpdated: timestamp("last_updated", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const strengths = pgTable("strengths", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  evidence: text("evidence"),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const constraints = pgTable("constraints", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  kind: constraintKind("kind").notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const goals = pgTable("goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  horizon: goalHorizon("horizon").notNull(),
  text: text("text").notNull(),
  status: goalStatus("status").notNull().default("open"),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Longitudinal memory: append-only log of signals over time. ──
// This is what makes the learner graph multi-year and longitudinal.
export const observations = pgTable("observations", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  content: text("content").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  source: observationSource("source").notNull(),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Projects ──
// The 2–3 generated options are stored as JSON snapshots; the chosen one
// is promoted to a `projects` row.
export const projectPaths = pgTable("project_paths", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  candidates: jsonb("candidates").$type<ProjectPathCandidate[]>().notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  pathType: pathType("path_type").notNull(),
  title: text("title").notNull(),
  summary: text("summary"),
  status: projectStatus("status").notNull().default("proposed"),
  chosenAt: timestamp("chosen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const milestones = pgTable("milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  weekNo: integer("week_no").notNull(),
  title: text("title").notNull(),
  detail: text("detail"),
  status: milestoneStatus("status").notNull().default("todo"),
  dueHint: text("due_hint"),
  // Presentation metadata for the timeline surfaces (DESIGN.md §7b/§7d). All
  // nullable: AI-generated plans leave these null and the UI derives sensible
  // defaults; the seed populates them for a design-accurate demo.
  kind: text("kind"), // deliverable type eyebrow, e.g. "Course", "Dataset"
  source: text("source"), // resource line, e.g. "Coursera", "38 matches"
  icon: text("icon"), // emoji marker
  coach: text("coach"), // mentor coaching note (shown on the current week)
  // Functional-checkpoint type. Nullable; inferred when the rich detail is
  // generated lazily on first open. Drives which detail treatment renders.
  checkpointType: checkpointType("checkpoint_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Checkpoint detail: the lazily-generated mini-curriculum for a milestone.
//    One row per milestone, created on first open and cached (regenerate by
//    deleting the row). Personalized to the student's learner graph. ──
export const checkpointDetails = pgTable("checkpoint_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  milestoneId: uuid("milestone_id")
    .notNull()
    .unique()
    .references(() => milestones.id, { onDelete: "cascade" }),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  type: checkpointType("type").notNull(),
  difficulty: checkpointDifficulty("difficulty").notNull(),
  description: text("description").notNull(),
  resources: jsonb("resources").$type<CheckpointResource[]>().notNull().default([]),
  steps: jsonb("steps").$type<CheckpointStep[]>().notNull().default([]),
  deliverableKind: deliverableKind("deliverable_kind").notNull(),
  deliverableSpec: text("deliverable_spec").notNull(),
  // Research-accelerator working state (only for type = "research").
  research: jsonb("research").$type<ResearchState>(),
  model: text("model"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Skills planner (parent dashboard): categorical progress bars. ──
// Distinct from `strengths` (qualitative evidence); skills carry a measurable
// progress and a domain category that maps to a stable hue in the UI.
export const skills = pgTable("skills", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  category: text("category").notNull(), // domain; mapped to a hue in the UI
  progress: real("progress").notNull().default(0), // 0..1
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── "Up next": mentor check-ins and opportunity windows. ──
export const opportunities = pgTable("opportunities", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  kind: opportunityKind("kind").notNull(),
  title: text("title").notNull(),
  whenHint: text("when_hint"), // soft schedule, e.g. "Thu 4pm"
  // Optional link back to the deliverable this opportunity is a deadline for
  // (set by the calendar engine, #4). Nullable for free-form items.
  deliverableId: uuid("deliverable_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── The deliverables catalog: vetted real-world targets (papers, competitions,
//    awards). Owned in our DB; the matcher reads from here. ──
export const deliverables = pgTable("deliverables", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(), // stable id from the catalog
  name: text("name").notNull(),
  category: deliverableCategory("category").notNull(),
  subtype: text("subtype"),
  domains: jsonb("domains").$type<string[]>().notNull().default([]),
  minGrade: integer("min_grade"),
  msAccessible: boolean("ms_accessible").notNull().default(false),
  ageNote: text("age_note"),
  difficulty: deliverableDifficulty("difficulty").notNull(),
  prestigeTier: prestigeTier("prestige_tier").notNull(),
  prerequisites: text("prerequisites"),
  costBand: costBand("cost_band").notNull(),
  costNote: text("cost_note"),
  cadence: text("cadence"),
  howToStart: text("how_to_start"),
  a2cInsight: text("a2c_insight"),
  status: deliverableStatus("status").notNull().default("active"),
  // Community red flags (pay-to-publish, fee-on-acceptance, high-acceptance, …).
  // The matcher NEVER surfaces a flagged item as a credential.
  flags: jsonb("flags").$type<string[]>().notNull().default([]),
  url: text("url"),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── A project's anchored real-world target, with the parent-approval gate. ──
export const projectTargets = pgTable("project_targets", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  // Null until a path is promoted to a project; the target can be chosen first.
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  deliverableId: uuid("deliverable_id")
    .notNull()
    .references(() => deliverables.id, { onDelete: "cascade" }),
  rationale: text("rationale"), // why this fits THIS student
  status: targetStatus("status").notNull().default("suggested"),
  parentApproved: boolean("parent_approved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Live resources attached to a milestone (#2): the best free course / program
//    / portfolio / dataset for that step. Web-sourced + vetted, then cached. ──
export const resources = pgTable("resources", {
  id: uuid("id").primaryKey().defaultRandom(),
  milestoneId: uuid("milestone_id").references(() => milestones.id, { onDelete: "cascade" }),
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
  kind: resourceKind("kind").notNull(),
  title: text("title").notNull(),
  provider: text("provider"), // e.g. "Coursera", "Kaggle"
  url: text("url"),
  costNote: text("cost_note"), // e.g. "Free audit"
  summary: text("summary"), // why it helps this step
  flags: jsonb("flags").$type<string[]>().notNull().default([]),
  source: text("source").notNull().default("curated"), // grounded | curated | catalog
  lastVerified: timestamp("last_verified", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Engagement (#7): one streak row per student (Duolingo-style consistency). ──
export const streaks = pgTable("streaks", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .unique()
    .references(() => students.id, { onDelete: "cascade" }),
  current: integer("current").notNull().default(0),
  longest: integer("longest").notNull().default(0),
  lastCheckIn: timestamp("last_check_in", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Engagement (#7): collectible milestone badges. ──
export const badges = pgTable(
  "badges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(), // stable id, e.g. "first-ship"
    label: text("label").notNull(),
    emoji: text("emoji"),
    earnedAt: timestamp("earned_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ studentSlug: unique("badges_student_slug_uniq").on(t.studentId, t.slug) }),
);

// ── Weekly habit loop (#6): the AI-generated "here's your week" focus card. ──
export const weeklyFocus = pgTable("weekly_focus", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  weekStart: timestamp("week_start", { withTimezone: true }).notNull(),
  headline: text("headline").notNull(),
  tasks: jsonb("tasks").$type<{ text: string; done: boolean }[]>().notNull().default([]),
  status: weeklyFocusStatus("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Parent digests (#8): a log of monthly summaries + weekly support nudges. ──
export const digests = pgTable("digests", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  kind: digestKind("kind").notNull(),
  subject: text("subject"),
  body: text("body"),
  channel: text("channel").notNull().default("onscreen"), // email | onscreen
  sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Mentor pool (#9): the human half. TJ / top-college students, recruited
//    ahead of demand. Capped checkpoints protect the software margin. ──
export const mentors = pgTable("mentors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email"),
  field: text("field"), // their domain, e.g. "Data science"
  bio: text("bio"),
  credential: text("credential"), // e.g. "TJHSST '26"
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Checkpoints (#9): capped human check-ins (2/term Core, 4/term Plus). The cap
//    is enforced in code — it is the margin guardrail. ──
export const checkpoints = pgTable("checkpoints", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, { onDelete: "cascade" }),
  mentorId: uuid("mentor_id").references(() => mentors.id, { onDelete: "set null" }),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  status: checkpointStatus("status").notNull().default("requested"),
  term: text("term").notNull(), // e.g. "2026-fall" — the cap counts per term
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Artifacts: outputs / reflections. Metadata + text only for now. ──
export const artifacts = pgTable("artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Nullable so a portfolio upload can exist without a project (#5).
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  // Direct owner link for the portfolio + share surfaces (#5).
  studentId: uuid("student_id").references(() => students.id, { onDelete: "cascade" }),
  // The checkpoint whose deliverable this artifact is (Running Resume flow).
  milestoneId: uuid("milestone_id").references(() => milestones.id, { onDelete: "set null" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  text: text("text"),
  // Uploaded file (Supabase Storage): public URL + mime; slug for the share link.
  url: text("url"),
  mimeType: text("mime_type"),
  slug: text("slug").unique(),
  shared: boolean("shared").notNull().default(false),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Audit: every AI interaction is logged for later review. ──
export const aiInteractions = pgTable("ai_interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Nullable: some calls (e.g. pre-profile moderation) have no student yet.
  studentId: uuid("student_id").references(() => students.id, {
    onDelete: "set null",
  }),
  task: aiTask("task").notNull(),
  model: text("model").notNull(),
  prompt: text("prompt").notNull(),
  response: text("response"),
  inputFlagged: boolean("input_flagged").notNull().default(false),
  outputFlagged: boolean("output_flagged").notNull().default(false),
  latencyMs: integer("latency_ms"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Safety: escalation queue for flagged content. ──
export const safetyFlags = pgTable("safety_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: uuid("student_id").references(() => students.id, {
    onDelete: "set null",
  }),
  aiInteractionId: uuid("ai_interaction_id").references(() => aiInteractions.id, {
    onDelete: "set null",
  }),
  severity: flagSeverity("severity").notNull(),
  categories: jsonb("categories").$type<ModerationResult["categories"]>().notNull(),
  content: text("content").notNull(),
  status: flagStatus("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Inferred row types for use across the app ──
export type Parent = typeof parents.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Interest = typeof interests.$inferSelect;
export type Strength = typeof strengths.$inferSelect;
export type Constraint = typeof constraints.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type Observation = typeof observations.$inferSelect;
export type ProjectPathRow = typeof projectPaths.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Milestone = typeof milestones.$inferSelect;
export type CheckpointDetailRow = typeof checkpointDetails.$inferSelect;
export type Skill = typeof skills.$inferSelect;
export type Opportunity = typeof opportunities.$inferSelect;
export type Deliverable = typeof deliverables.$inferSelect;
export type ProjectTarget = typeof projectTargets.$inferSelect;
export type Resource = typeof resources.$inferSelect;
export type Streak = typeof streaks.$inferSelect;
export type Badge = typeof badges.$inferSelect;
export type WeeklyFocus = typeof weeklyFocus.$inferSelect;
export type Digest = typeof digests.$inferSelect;
export type Mentor = typeof mentors.$inferSelect;
export type Checkpoint = typeof checkpoints.$inferSelect;
export type Artifact = typeof artifacts.$inferSelect;
export type AiInteraction = typeof aiInteractions.$inferSelect;
export type SafetyFlag = typeof safetyFlags.$inferSelect;
