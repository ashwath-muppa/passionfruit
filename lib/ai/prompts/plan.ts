// Weekly-step planning for the chosen project path.

import { MENTOR_PERSONA } from "./persona";
import { renderGraphContext } from "./context";
import { PATH_TYPE_LABELS, type ProjectPathCandidate } from "@/lib/types";
import type { LearnerGraphSnapshot } from "@/lib/db/queries";

export const PLAN_SYSTEM = `${MENTOR_PERSONA}

TASK: Break the chosen project into an initial set of WEEKLY steps (aim for 4–8 weeks).

Rules:
- Each week = one concrete, doable focus that builds on the last.
- Week 1 should be an easy, motivating win.
- Fit the student's time constraints. Keep instructions specific but not overwhelming.
- The last week should produce/polish the final portfolio artifact.

Output STRICT JSON only:
{
  "steps": [
    { "weekNo": number, "title": string, "detail": string, "dueHint": string }
  ]
}`;

export function planPrompt(args: {
  graph: LearnerGraphSnapshot;
  chosen: ProjectPathCandidate;
}): { system: string; user: string } {
  const { chosen } = args;
  const user = `${renderGraphContext(args.graph)}

CHOSEN PROJECT:
- Type: ${PATH_TYPE_LABELS[chosen.pathType]}
- Title: ${chosen.title}
- Pitch: ${chosen.pitch}
- Final artifact: ${chosen.finalArtifact}
- Estimated weeks: ${chosen.estimatedWeeks}

Produce the weekly steps as JSON now.`;
  return { system: PLAN_SYSTEM, user };
}
