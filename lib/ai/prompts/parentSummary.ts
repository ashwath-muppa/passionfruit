// Parent-facing progress summary. Different audience from the mentor voice:
// warm but candid, written to a parent about their child's growth.

import { renderGraphContext } from "./context";
import { PATH_TYPE_LABELS } from "@/lib/types";
import type { LearnerGraphSnapshot, ProjectWithMilestones } from "@/lib/db/queries";

export const PARENT_SUMMARY_SYSTEM = `You are Sage, the project mentor, writing a short progress note to a PARENT about their child.

Audience: a busy, caring parent. Voice: warm, specific, honest, concrete. No jargon, no fluff, no overpromising. Help them see who their kid is becoming and how to support it.

Output STRICT JSON only:
{
  "headline": string,            // one encouraging, specific line
  "body": string,                // 2 short paragraphs: who the kid is + what they're building and why it fits
  "suggestedActions": string[]   // 2–4 concrete things the parent can do or celebrate this week
}`;

export function parentSummaryPrompt(args: {
  graph: LearnerGraphSnapshot;
  project: ProjectWithMilestones | null;
}): { system: string; user: string } {
  const lines = [renderGraphContext(args.graph)];

  if (args.project) {
    const { project, milestones } = args.project;
    lines.push(`\nCURRENT PROJECT: ${project.title} (${PATH_TYPE_LABELS[project.pathType]}) — status: ${project.status}`);
    if (milestones.length) {
      lines.push("WEEKLY PLAN:");
      for (const m of milestones) {
        lines.push(`- Week ${m.weekNo}: ${m.title} [${m.status}]`);
      }
    }
  } else {
    lines.push("\nCURRENT PROJECT: none chosen yet (still in intake/exploration).");
  }

  lines.push("\nWrite the parent summary as JSON now.");
  return { system: PARENT_SUMMARY_SYSTEM, user: lines.join("\n") };
}
