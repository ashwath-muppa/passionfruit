// Shape of a deliverables-catalog entry (the drop-in JSON the recommendation
// engine consumes). Mirrors the field spec in the catalog doc. Kept
// dependency-free so the seed, the matcher, and the UI can all import it.

export const DELIVERABLE_DOMAINS = [
  "math",
  "computer-science",
  "biology",
  "chemistry",
  "physics",
  "earth-space-science",
  "science-general",
  "engineering-robotics",
  "research-general",
  "writing-creative",
  "writing-essay",
  "humanities",
  "history",
  "social-science",
  "economics",
  "business-entrepreneurship",
  "finance",
  "arts-visual",
  "music",
  "performing-arts",
  "civics-law",
  "debate-speech",
  "languages-classics",
  "environment",
  "psychology",
  "neuroscience",
  "linguistics",
  "geography",
  "quiz-knowledge",
  "leadership-service",
  "interdisciplinary",
] as const;
export type DeliverableDomain = (typeof DELIVERABLE_DOMAINS)[number];

export type DeliverableCategory = "paper" | "competition" | "award";
export type DeliverableDifficulty = "intro" | "intermediate" | "advanced" | "elite";
export type PrestigeTier = "t1" | "t2" | "t3" | "t4" | "flag";
export type DeliverableCostBand = "free" | "low" | "medium" | "high";
export type DeliverableStatus = "active" | "paused" | "discontinued" | "uncertain";

export interface CatalogEntry {
  slug: string;
  name: string;
  category: DeliverableCategory;
  subtype?: string;
  domains: string[];
  minGrade?: number | null;
  msAccessible: boolean;
  ageNote?: string;
  difficulty: DeliverableDifficulty;
  prestigeTier: PrestigeTier;
  prerequisites?: string;
  costBand: DeliverableCostBand;
  costNote?: string;
  cadence?: string;
  howToStart?: string;
  a2cInsight?: string;
  status: DeliverableStatus;
  flags: string[];
  url?: string;
}
