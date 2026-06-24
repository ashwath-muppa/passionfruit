// Semantic recall over the learner graph. Embeds a query, then cosine-searches
// the embedded graph tables and returns a ranked, unified context list that the
// AI gateway folds into prompts. This is the read-side of the longitudinal
// memory.

import "server-only";
import { and, cosineDistance, desc, eq, gt, sql, type SQL } from "drizzle-orm";
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
  const simOf = (col: Parameters<typeof cosineDistance>[0]): SQL<number> =>
    sql<number>`1 - (${cosineDistance(col, queryEmbedding)})`;

  const interestSim = simOf(interests.embedding);
  const strengthSim = simOf(strengths.embedding);
  const goalSim = simOf(goals.embedding);
  const obsSim = simOf(observations.embedding);
  const artifactSim = simOf(artifacts.embedding);

  const [int, str, gl, obs, art] = await Promise.all([
    db
      .select({ id: interests.id, text: interests.label, similarity: interestSim })
      .from(interests)
      .where(and(eq(interests.studentId, studentId), gt(interestSim, minSimilarity)))
      .orderBy(desc(interestSim))
      .limit(perSource),
    db
      .select({ id: strengths.id, text: strengths.label, similarity: strengthSim })
      .from(strengths)
      .where(and(eq(strengths.studentId, studentId), gt(strengthSim, minSimilarity)))
      .orderBy(desc(strengthSim))
      .limit(perSource),
    db
      .select({ id: goals.id, text: goals.text, similarity: goalSim })
      .from(goals)
      .where(and(eq(goals.studentId, studentId), gt(goalSim, minSimilarity)))
      .orderBy(desc(goalSim))
      .limit(perSource),
    db
      .select({ id: observations.id, text: observations.content, similarity: obsSim })
      .from(observations)
      .where(and(eq(observations.studentId, studentId), gt(obsSim, minSimilarity)))
      .orderBy(desc(obsSim))
      .limit(perSource),
    // Artifacts join through projects to scope by student.
    db
      .select({ id: artifacts.id, text: artifacts.title, similarity: artifactSim })
      .from(artifacts)
      .innerJoin(projects, eq(artifacts.projectId, projects.id))
      .where(and(eq(projects.studentId, studentId), gt(artifactSim, minSimilarity)))
      .orderBy(desc(artifactSim))
      .limit(perSource),
  ]);

  const tag = (
    rows: { id: string; text: string; similarity: number }[],
    source: RecallSource,
  ): RecallItem[] =>
    rows.map((r) => ({ source, id: r.id, text: r.text, similarity: Number(r.similarity) }));

  return [
    ...tag(int, "interest"),
    ...tag(str, "strength"),
    ...tag(gl, "goal"),
    ...tag(obs, "observation"),
    ...tag(art, "artifact"),
  ].sort((a, b) => b.similarity - a.similarity);
}
