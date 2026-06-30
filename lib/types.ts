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

// ── Functional checkpoints ─────────────────────────────────────────────────
// A milestone, leveled up into a self-contained mini-curriculum: real
// resources, an AI rationale, a difficulty, a step-by-step guide, and a defined
// deliverable artifact. Generated lazily on first open and cached.

export const CHECKPOINT_TYPES = ["course", "build", "creative", "research"] as const;
export type CheckpointType = (typeof CHECKPOINT_TYPES)[number];

export const CHECKPOINT_TYPE_LABELS: Record<CheckpointType, string> = {
  course: "Course",
  build: "Build",
  creative: "Creative",
  research: "Research",
};

export const CHECKPOINT_DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export type CheckpointDifficulty = (typeof CHECKPOINT_DIFFICULTIES)[number];

/** The concrete output a completed checkpoint produces (flows into the resume). */
export const DELIVERABLE_KINDS = [
  "certificate",
  "repo",
  "image",
  "paper",
  "link",
  "other",
] as const;
export type DeliverableKind = (typeof DELIVERABLE_KINDS)[number];

/** One real resource (course / video / dataset / tool) attached to a checkpoint. */
export interface CheckpointResource {
  title: string;
  /** e.g. "Coursera", "YouTube", "Kaggle". */
  provider: string;
  url: string;
  kind: "course" | "video" | "dataset" | "tool" | "reading" | "other";
  /** Why this resource helps, and cost note (free-first). */
  note: string;
}

/** One ordered step in the guided path to completion. */
export interface CheckpointStep {
  title: string;
  /** Plain, assume-nothing instructions for a middle-schooler. */
  detail: string;
  /** Optional supporting resource for this specific step. */
  resourceUrl?: string;
}

/** Research-accelerator working state (only for type === "research"). */
export interface ResearchState {
  question: string | null;
  /** Literature-review sources the student is gathering. */
  sources: Array<{ title: string; url?: string; note?: string }>;
  /** Paper outline sections. */
  outline: string[];
}

/** The full, AI-generated detail for a checkpoint (cached after first open). */
export interface CheckpointDetail {
  type: CheckpointType;
  difficulty: CheckpointDifficulty;
  /** Why this checkpoint is here, in the context of THIS student's goals. */
  description: string;
  resources: CheckpointResource[];
  /** Ordered guide to completion (build/creative/research carry a full path). */
  steps: CheckpointStep[];
  deliverableKind: DeliverableKind;
  /** Exactly what to produce and add to the resume. */
  deliverableSpec: string;
  /** Specialized fields for research checkpoints. */
  research?: ResearchState;
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
