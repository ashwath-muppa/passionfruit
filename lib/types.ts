// Shared domain types used across the DB schema, AI gateway, and UI.
// Kept dependency-free so both server and client modules can import them.

export const PATH_TYPES = [
  "research",
  "app",
  "sports_analytics",
  "creative",
  "venture",
] as const;
export type PathType = (typeof PATH_TYPES)[number];

export const PATH_TYPE_LABELS: Record<PathType, string> = {
  research: "Research paper",
  app: "App / software",
  sports_analytics: "Sports analytics",
  creative: "Creative portfolio",
  venture: "Small social venture",
};

/** A single proposed project path (2–3 are generated and stored as JSON). */
export interface ProjectPathCandidate {
  pathType: PathType;
  title: string;
  /** One-paragraph pitch written in mentor voice for the kid. */
  pitch: string;
  /** Why this fits THIS student — references their graph. */
  whyThisFitsYou: string;
  /** Rough difficulty 1–5 and weeks estimate. */
  difficulty: number;
  estimatedWeeks: number;
  /** The concrete, portfolio-worthy thing they'll have at the end. */
  finalArtifact: string;
}

/** One weekly step in a project plan. */
export interface WeeklyStep {
  weekNo: number;
  title: string;
  detail: string;
  /** Soft, encouraging due hint, e.g. "by end of week 2". */
  dueHint: string;
}

/** Structured output of the intake parse — what we extract into the graph. */
export interface IntakeExtraction {
  interests: Array<{
    label: string;
    category: string;
    /** 0–1 confidence/strength of this interest signal. */
    strength: number;
  }>;
  strengths: Array<{ label: string; evidence: string }>;
  constraints: Array<{
    kind: "time" | "budget" | "location" | "other";
    value: string;
  }>;
  goals: Array<{ horizon: "short" | "long"; text: string }>;
  /** Free-text signals worth remembering longitudinally. */
  observations: string[];
}

/** Result of a moderation check on a single piece of content. */
export interface ModerationResult {
  flagged: boolean;
  severity: "low" | "medium" | "high";
  categories: string[];
  /** Short rationale for the audit trail. */
  reason: string;
}

/** A turn in the intake conversation. */
export interface ChatMessage {
  role: "mentor" | "student";
  text: string;
}

export interface ParentSummary {
  headline: string;
  body: string;
  /** 2–4 concrete things the parent can do or celebrate this week. */
  suggestedActions: string[];
}
