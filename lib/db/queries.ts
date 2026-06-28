// Read helpers over the learner graph. Centralizes the joins/selects so routes,
// task functions, and the dashboard share one shape.

import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./client";
import {
  constraints,
  goals,
  interests,
  milestones,
  observations,
  opportunities,
  projects,
  skills,
  strengths,
  students,
} from "./schema";
import type {
  Constraint,
  Goal,
  Interest,
  Milestone,
  Opportunity,
  Project,
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
