// Intersection-Narrative generation (#10, Passionfruit's signature move). Fuses
// 2–3 of a multi-interest kid's interests into ONE coherent, ownable signature
// theme aimed at a real venue — so the kid becomes "the only person with THIS
// combination." The student's interests are the ROUTE; the parent's chosen
// end-goal direction (endGoalPref) is the DESTINATION. The fusion must be
// authentic and produce a real deliverable, never three hobbies stapled together.

import { MENTOR_PERSONA } from "./persona";
import { renderGraphContext } from "./context";
import type { LearnerGraphSnapshot } from "@/lib/db/queries";

// Friendly description of each parent end-goal direction, so the model biases
// the suggested venue/deliverable toward the destination the family chose.
const END_GOAL_GUIDANCE: Record<string, string> = {
  research: "a real research paper or study (e.g. a student research journal, a science fair, a preprint-style write-up)",
  competition: "a real competition or challenge result (e.g. a themed contest, hackathon, or olympiad-style event)",
  portfolio: "a portfolio-worthy creative body of work (e.g. a published series, an exhibition, a public showcase)",
  venture: "a small real-world venture (e.g. a tiny product, a service, a community initiative people actually use)",
  award: "an award, honor, or recognition (e.g. a juried prize, a youth honor, a recognized submission)",
  open: "the single most authentic real venue or deliverable for this fusion — pick the destination that fits best",
};

export const INTERSECTION_SYSTEM = `${MENTOR_PERSONA}

TASK: This kid has several real interests. Fuse 2–3 of their STRONGEST, most authentic interests into ONE coherent "signature theme" — a single project direction that makes them the only person with THIS exact combination. Think CS + biology → a bioinformatics tool; art + activism → a measured mural campaign; music + neuroscience → research on music and memory.

The intersection doctrine:
- The fusion is the spark. Pick interests that genuinely strengthen each other, and name the ONE idea where they meet. Never staple three hobbies together — find the real overlap that yields a real deliverable.
- The STUDENT drives the interests — they are the route. The PARENT sets the end-goal direction (endGoalPref) — that is the destination. Respect the parent's chosen direction: the suggested venue/deliverable MUST aim toward it when one is set.
- Make the family feel they are GUIDING their child: you map the route, the family picks the destination. Never sound like you are taking over.
- Real and ownable. The theme must be genuinely achievable for a motivated 11–15 year old and lead to something portfolio-worthy and concrete.

Output STRICT JSON only — no prose, no markdown, no code fences:
{
  "theme": string,          // a short, memorable name for the signature theme
  "pitch": string,          // 2–3 warm mentor-voice sentences, second person, referencing their ACTUAL interests; the fusion is the spark
  "interests": string[],    // the 2–3 fused interests (use the kid's real interest labels)
  "suggestedVenue": string, // a real, age-appropriate venue or deliverable type, biased to the parent's end-goal direction
  "whyUnique": string       // ONE sentence on why this combination is rare and ownable
}`;

export function intersectionPrompt(args: { graph: LearnerGraphSnapshot }): {
  system: string;
  user: string;
} {
  const pref = args.graph.student.endGoalPref;
  const guidance = (pref && END_GOAL_GUIDANCE[pref]) || END_GOAL_GUIDANCE.open;
  const destination = pref
    ? `The PARENT has chosen this end-goal direction (the destination): "${pref}" — aim the suggested venue toward ${guidance}.`
    : `The parent has not set an end-goal direction yet (destination is open): aim for ${guidance}.`;

  const user = `${renderGraphContext(args.graph)}

PARENT'S CHOSEN DESTINATION (endGoalPref): ${destination}

Now fuse 2–3 of this student's strongest, most authentic interests into ONE signature theme that aims toward the parent's destination. Return the JSON now.`;

  return { system: INTERSECTION_SYSTEM, user };
}
