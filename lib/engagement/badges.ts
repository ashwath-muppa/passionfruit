// Engagement (#7): the collectible badge catalog and the pure rule that decides
// which are earned. Dependency-free on purpose — both server code (to award
// rows) and presentational components (to render the full collectible set) read
// from the same source of truth, and the rule stays trivially unit-testable.

export interface BadgeDef {
  /** Stable id stored on the `badges` row. */
  slug: string;
  label: string;
  emoji: string;
}

// The full collectible set, in display order (early wins first, the shippy ones
// last). Labels are kid-facing and celebratory; emoji are used sparingly but
// freely, matching the Warm-Paper voice.
export const BADGE_DEFS: BadgeDef[] = [
  { slug: "first-task", label: "First task done", emoji: "✅" },
  { slug: "halfway", label: "Halfway there", emoji: "⛰️" },
  { slug: "three-week-streak", label: "3-week streak", emoji: "🔥" },
  { slug: "ten-week-streak", label: "10-week streak", emoji: "🚀" },
  { slug: "first-ship", label: "First project shipped", emoji: "🎯" },
  { slug: "published", label: "Published", emoji: "🌟" },
];

/** The signals a badge condition can depend on. */
export interface BadgeState {
  /** Milestones marked done. */
  tasksDone: number;
  /** Total milestones in the active project. */
  total: number;
  /** The active project itself is complete. */
  projectDone: boolean;
  /** Consecutive weekly check-ins (the streak count). */
  streakWeeks: number;
}

const BADGE_RULES: Record<string, (s: BadgeState) => boolean> = {
  "first-task": (s) => s.tasksDone >= 1,
  halfway: (s) => s.total > 0 && s.tasksDone / s.total >= 0.5,
  "three-week-streak": (s) => s.streakWeeks >= 3,
  "ten-week-streak": (s) => s.streakWeeks >= 10,
  "first-ship": (s) => s.projectDone,
  // Shipping the project *is* publishing it in this product's model.
  published: (s) => s.projectDone,
};

/** Pure: the BadgeDefs whose condition the given state satisfies (in catalog order). */
export function evaluateBadges(state: BadgeState): BadgeDef[] {
  return BADGE_DEFS.filter((b) => BADGE_RULES[b.slug]?.(state) ?? false);
}
