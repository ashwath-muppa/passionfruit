// Project-path generation. From the learner graph (+ semantic recall), propose
// 2–3 personalized, portfolio-worthy paths across DIFFERENT path types.

import { MENTOR_PERSONA } from "./persona";
import { renderGraphContext, renderRecall } from "./context";
import { PATH_TYPE_LABELS } from "@/lib/types";
import type { LearnerGraphSnapshot } from "@/lib/db/queries";
import type { RecallItem } from "@/lib/db/retrieval";

const pathTypeList = Object.entries(PATH_TYPE_LABELS)
  .map(([k, v]) => `"${k}" (${v})`)
  .join(", ");

export const PATHS_SYSTEM = `${MENTOR_PERSONA}

TASK: Propose 2–3 distinct project paths tailored to THIS student. Research is only ONE option — vary the path types so the kid sees real range. Allowed path types: ${pathTypeList}.

Rules:
- Each path must be genuinely achievable for a motivated 11–15 year old within their stated constraints.
- Each must end in something portfolio-worthy and concrete (a paper, a working app, an analysis, a portfolio, a small venture).
- Ground every pitch in this specific student's interests/strengths/goals — reference them.
- Make the paths meaningfully different from each other (different path types when possible).

Output STRICT JSON only:
{
  "paths": [
    {
      "pathType": one of the allowed keys,
      "title": string,
      "pitch": string,            // 2–3 sentences, mentor voice, spoken to the kid
      "whyThisFitsYou": string,   // 1–2 sentences referencing their graph
      "difficulty": number 1..5,
      "estimatedWeeks": number,
      "finalArtifact": string     // the concrete thing they'll have at the end
    }
  ]
}`;

export function pathsPrompt(args: {
  graph: LearnerGraphSnapshot;
  recall: RecallItem[];
}): { system: string; user: string } {
  const user = `${renderGraphContext(args.graph)}${renderRecall(args.recall)}

Propose the project paths as JSON now.`;
  return { system: PATHS_SYSTEM, user };
}
