// Semantic recall over the learner graph. Embeds a query, then cosine-searches
// the embedded graph tables and returns a ranked, unified context list that the
// AI gateway folds into prompts. This is the read-side of the longitudinal
// memory.

import "server-only";
import { and, cosineDistance, eq, gt, sql } from "drizzle-orm";
import { db } from "./client";
import {
  artifacts,
  goals,
  interests,
  observations,
  projects,
  strengths,
} from "./schema";
import { embedText } from "@/lib/ai/gateway";

export type RecallSource =
  | "interest"
  | "strength"
  | "goal"
  | "observation"
  | "artifact";

export interface RecallItem {
  source: RecallSource;
  id: string;
  text: string;
  /** Cosine similarity in [0,1]; higher is closer. */
  similarity: number;
}

interface RecallOptions {
  /** Max items returned per source table (default 4). */
  perSource?: number;
  /** Minimum similarity to include (default 0.3). */
  minSimilarity?: number;
}

/**
 * Retrieve the most semantically relevant pieces of a student's learner graph
 * for a given query (e.g. "what projects fit this student?").
 */
export async function semanticRecall(
  studentId: string,
  queryText: string,
  opts: RecallOptions = {},
): Promise<RecallItem[]> {
  const perSource = opts.perSource ?? 4;
  const minSimilarity = opts.minSimilarity ?? 0.3;

  const queryEmbedding = await embedText(queryText);

  // similarity = 1 - cosine distance
  const sim = (col: Parameters<typeof cosineDistance>[0]) =>
    sql<number>`1 - (${cosineDistance(col, queryEmbedding)})`;

  const [int, str, gl, obs, art] = await Promise.all([
    db
      .select({ id: interests.id, text: interests.label, similarity: sim(interests.embedding) })
      .from(interests)
      .where(and(eq(interests.studentId, studentId), gt(sim(interests.embedding), minSimilarity)))
      .orderBy((t) => sql`${t.similarity} desc`)
      .limit(perSource),
    db
      .select({ id: strengths.id, text: strengths.label, similarity: sim(strengths.embedding) })
      .from(strengths)
      .where(and(eq(strengths.studentId, studentId), gt(sim(strengths.embedding), minSimilarity)))
      .orderBy((t) => sql`${t.similarity} desc`)
      .limit(perSource),
    db
      .select({ id: goals.id, text: goals.text, similarity: sim(goals.embedding) })
      .from(goals)
      .where(and(eq(goals.studentId, studentId), gt(sim(goals.embedding), minSimilarity)))
      .orderBy((t) => sql`${t.similarity} desc`)
      .limit(perSource),
    db
      .select({ id: observations.id, text: observations.content, similarity: sim(observations.embedding) })
      .from(observations)
      .where(and(eq(observations.studentId, studentId), gt(sim(observations.embedding), minSimilarity)))
      .orderBy((t) => sql`${t.similarity} desc`)
      .limit(perSource),
    // Artifacts join through projects to scope by student.
    db
      .select({ id: artifacts.id, text: artifacts.title, similarity: sim(artifacts.embedding) })
      .from(artifacts)
      .innerJoin(projects, eq(artifacts.projectId, projects.id))
      .where(and(eq(projects.studentId, studentId), gt(sim(artifacts.embedding), minSimilarity)))
      .orderBy((t) => sql`${t.similarity} desc`)
      .limit(perSource),
  ]);

  const tag = (rows: { id: string; text: string; similarity: number }[], source: RecallSource) =>
    rows.map((r) => ({ source, id: r.id, text: r.text, similarity: Number(r.similarity) }));

  return [
    ...tag(int, "interest"),
    ...tag(str, "strength"),
    ...tag(gl, "goal"),
    ...tag(obs, "observation"),
    ...tag(art, "artifact"),
  ].sort((a, b) => b.similarity - a.similarity);
}
