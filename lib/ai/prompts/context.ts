// Renders a learner-graph snapshot (+ optional semantic-recall items) into a
// compact context block for prompts. Deterministic formatting keeps prompts
// stable and cache-friendly.

import type { LearnerGraphSnapshot } from "@/lib/db/queries";
import type { RecallItem } from "@/lib/db/retrieval";

export function renderStudentHeader(s: LearnerGraphSnapshot["student"]): string {
  const parts = [`Name: ${s.name}`];
  if (s.age != null) parts.push(`Age: ${s.age}`);
  if (s.grade) parts.push(`Grade: ${s.grade}`);
  return parts.join(" | ");
}

export function renderGraphContext(graph: LearnerGraphSnapshot): string {
  const lines: string[] = [];
  lines.push(`STUDENT: ${renderStudentHeader(graph.student)}`);

  if (graph.interests.length) {
    lines.push("\nINTERESTS (strongest first):");
    for (const i of graph.interests) {
      lines.push(`- ${i.label}${i.category ? ` [${i.category}]` : ""} (strength ${i.strength.toFixed(2)})`);
    }
  }
  if (graph.strengths.length) {
    lines.push("\nSTRENGTHS:");
    for (const s of graph.strengths) {
      lines.push(`- ${s.label}${s.evidence ? ` — ${s.evidence}` : ""}`);
    }
  }
  if (graph.constraints.length) {
    lines.push("\nCONSTRAINTS:");
    for (const c of graph.constraints) lines.push(`- [${c.kind}] ${c.value}`);
  }
  if (graph.goals.length) {
    lines.push("\nGOALS:");
    for (const g of graph.goals) lines.push(`- [${g.horizon}] ${g.text}`);
  }
  if (graph.recentObservations.length) {
    lines.push("\nRECENT SIGNALS (longitudinal memory):");
    for (const o of graph.recentObservations) lines.push(`- ${o.content}`);
  }
  return lines.join("\n");
}

export function renderRecall(items: RecallItem[]): string {
  if (!items.length) return "";
  const lines = ["\nMOST RELEVANT MEMORY (semantic recall):"];
  for (const it of items) {
    lines.push(`- (${it.source}, ${(it.similarity * 100).toFixed(0)}%) ${it.text}`);
  }
  return lines.join("\n");
}
