// Read helpers over the learner graph. Centralizes the joins/selects so routes,
// task functions, and the dashboard share one shape.

import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./client";
import {
  checkpointDetails,
  constraints,
  deliverables,
  goals,
  interests,
  milestones,
  observations,
  opportunities,
  projectPaths,
  projects,
  projectTargets,
  resources,
  skills,
  strengths,
  students,
} from "./schema";
import type { ProjectPathCandidate } from "@/lib/types";
import type {
  CheckpointDetailRow,
  Constraint,
  Deliverable,
  Goal,
  Interest,
  Milestone,
  Opportunity,
  Project,
  ProjectTarget,
  Resource,
  Skill,
  Strength,
  Student,
} from "./schema";

export interface LearnerGraphSnapshot {
  student: Student;
  interests: Interest[];
  strengths: Strength[];
  constraints: Constraint[];
  goals: Goal[];
  recentObservations: { content: string; type: string; createdAt: Date }[];
}

/** Current structured state of a student's learner graph, for prompt context. */
export async function getLearnerGraphSnapshot(
  studentId: string,
): Promise<LearnerGraphSnapshot | null> {
  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);
  if (!student) return null;

  const [int, str, con, gl, obs] = await Promise.all([
    db.select().from(interests).where(eq(interests.studentId, studentId)).orderBy(desc(interests.strength)),
    db.select().from(strengths).where(eq(strengths.studentId, studentId)),
    db.select().from(constraints).where(eq(constraints.studentId, studentId)),
    db.select().from(goals).where(eq(goals.studentId, studentId)),
    db
      .select({ content: observations.content, type: observations.type, createdAt: observations.createdAt })
      .from(observations)
      .where(eq(observations.studentId, studentId))
      .orderBy(desc(observations.createdAt))
      .limit(12),
  ]);

  return {
    student,
    interests: int,
    strengths: str,
    constraints: con,
    goals: gl,
    recentObservations: obs,
  };
}

export interface ProjectWithMilestones {
  project: Project;
  milestones: Milestone[];
}

/** The student's active/most-recent chosen project plus its weekly steps. */
export async function getActiveProject(
  studentId: string,
): Promise<ProjectWithMilestones | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.studentId, studentId)))
    .orderBy(desc(projects.createdAt))
    .limit(1);
  if (!project) return null;

  const steps = await db
    .select()
    .from(milestones)
    .where(eq(milestones.projectId, project.id))
    .orderBy(milestones.weekNo);

  return { project, milestones: steps };
}

/** Skills planner rows (categorical progress bars), strongest first. */
export async function getSkills(studentId: string): Promise<Skill[]> {
  return db
    .select()
    .from(skills)
    .where(eq(skills.studentId, studentId))
    .orderBy(desc(skills.progress));
}

/** "Up next" items: mentor check-ins and opportunity windows. */
export async function getOpportunities(studentId: string): Promise<Opportunity[]> {
  return db
    .select()
    .from(opportunities)
    .where(eq(opportunities.studentId, studentId))
    .orderBy(opportunities.createdAt);
}

export interface ActiveTarget {
  target: ProjectTarget;
  deliverable: Deliverable;
}

/** The student's current anchored real-world target (latest), with its deliverable. */
export async function getActiveTarget(studentId: string): Promise<ActiveTarget | null> {
  const [row] = await db
    .select({ target: projectTargets, deliverable: deliverables })
    .from(projectTargets)
    .innerJoin(deliverables, eq(projectTargets.deliverableId, deliverables.id))
    .where(eq(projectTargets.studentId, studentId))
    .orderBy(desc(projectTargets.createdAt))
    .limit(1);
  return row ?? null;
}

/** A single deliverable by slug (for resolving a chosen target). */
export async function getDeliverableBySlug(slug: string): Promise<Deliverable | null> {
  const [row] = await db.select().from(deliverables).where(eq(deliverables.slug, slug)).limit(1);
  return row ?? null;
}

/** All cached resources across a project's milestones (for the weekly plan). */
export async function getResourcesForProject(projectId: string): Promise<Resource[]> {
  const rows = await db
    .select({ resource: resources })
    .from(resources)
    .innerJoin(milestones, eq(resources.milestoneId, milestones.id))
    .where(eq(milestones.projectId, projectId));
  return rows.map((r) => r.resource);
}

// ── Functional checkpoints ──

export interface MilestoneContext {
  milestone: Milestone;
  project: Project;
  student: Student;
}

/** A milestone with its project + owning student (for ownership + generation). */
export async function getMilestoneContext(
  milestoneId: string,
): Promise<MilestoneContext | null> {
  const [row] = await db
    .select({ milestone: milestones, project: projects, student: students })
    .from(milestones)
    .innerJoin(projects, eq(milestones.projectId, projects.id))
    .innerJoin(students, eq(projects.studentId, students.id))
    .where(eq(milestones.id, milestoneId))
    .limit(1);
  return row ?? null;
}

/** The cached checkpoint detail for a milestone, or null if not generated yet. */
export async function getCheckpointDetail(
  milestoneId: string,
): Promise<CheckpointDetailRow | null> {
  const [row] = await db
    .select()
    .from(checkpointDetails)
    .where(eq(checkpointDetails.milestoneId, milestoneId))
    .limit(1);
  return row ?? null;
}

/**
 * The most recent stored project-path snapshot for a student, or null. Paths
 * are generated once and persisted; this read serves them back so we never
 * regenerate on a revisit (only an explicit "regenerate" does).
 */
export async function getLatestProjectPaths(
  studentId: string,
): Promise<ProjectPathCandidate[] | null> {
  const [row] = await db
    .select({ candidates: projectPaths.candidates })
    .from(projectPaths)
    .where(eq(projectPaths.studentId, studentId))
    .orderBy(desc(projectPaths.generatedAt))
    .limit(1);
  return row?.candidates ?? null;
}
