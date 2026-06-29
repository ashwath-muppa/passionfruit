// Student-aware wrapper over the matcher. Pulls the learner graph, the parent's
// end-goal direction, and the family's cost constraint, then ranks the catalog.
// Kept separate from queries.ts to avoid an import cycle with match.ts.

import "server-only";
import { getLearnerGraphSnapshot } from "@/lib/db/queries";
import type { Constraint } from "@/lib/db/schema";
import { matchDeliverables, type EndGoalPref, type MatchedDeliverable } from "./match";
import type { DeliverableCostBand } from "./types";

const VALID_PREFS: EndGoalPref[] = [
  "research",
  "competition",
  "portfolio",
  "venture",
  "award",
  "open",
];

export function asEndGoalPref(value: string | null | undefined): EndGoalPref | null {
  if (!value) return null;
  return VALID_PREFS.includes(value as EndGoalPref) ? (value as EndGoalPref) : null;
}

/** Read the family's cost ceiling from the budget constraint, leading free/low. */
function deriveCostCeiling(constraints: Constraint[]): DeliverableCostBand {
  const budget = constraints.find((c) => c.kind === "budget")?.value.toLowerCase() ?? "";
  if (/free|no |zero|none/.test(budget)) return "free";
  if (/low|tight|little/.test(budget)) return "low";
  if (/moder|medium|some/.test(budget)) return "medium";
  return "high";
}

export async function suggestTargetsForStudent(
  studentId: string,
  overridePref?: EndGoalPref | null,
): Promise<MatchedDeliverable[]> {
  const graph = await getLearnerGraphSnapshot(studentId);
  if (!graph) return [];

  const gradeNum = graph.student.grade ? parseInt(graph.student.grade, 10) : null;
  const grade = Number.isFinite(gradeNum) ? gradeNum : null;
  const endGoalPref = overridePref ?? asEndGoalPref(graph.student.endGoalPref);

  return matchDeliverables(graph, {
    grade,
    costCeiling: deriveCostCeiling(graph.constraints),
    endGoalPref,
    // Young students (grade ≤ 7) are hard-gated to middle-school-accessible items.
    msOnly: grade != null && grade <= 7,
    limit: 6,
  });
}
