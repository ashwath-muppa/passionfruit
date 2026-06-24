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
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import type {
  ProjectPathCandidate,
  ModerationResult,
} from "@/lib/types";

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
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Artifacts: outputs / reflections. Metadata + text only for now. ──
export const artifacts = pgTable("artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  text: text("text"),
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
export type Artifact = typeof artifacts.$inferSelect;
export type AiInteraction = typeof aiInteractions.$inferSelect;
export type SafetyFlag = typeof safetyFlags.$inferSelect;
