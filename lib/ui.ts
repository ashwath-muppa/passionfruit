// Pure presentation helpers shared across surfaces. Dependency-free so both
// server and client components can import them. Colors mirror docs/DESIGN.md §3
// — the categorical hues (coral / gold / berry) and their tinted pill variants.

import type { Milestone } from "@/lib/db/schema";

export type HueKey = "coral" | "gold" | "berry";

export interface Hue {
  /** Solid fill — skill bars, graph project tags, "up next" dots. */
  solid: string;
  /** Tinted pill background / foreground / border — graph interest pills. */
  pillBg: string;
  pillFg: string;
  pillBorder: string;
}

export const HUES: Record<HueKey, Hue> = {
  coral: { solid: "#E8694A", pillBg: "#FCE9E0", pillFg: "#C2492C", pillBorder: "#F4D9CC" },
  gold: { solid: "#F2B23E", pillBg: "#FBEFD6", pillFg: "#9A6B12", pillBorder: "#F2E2BC" },
  berry: { solid: "#D87BA0", pillBg: "#F6E5EC", pillFg: "#A64C75", pillBorder: "#EFD3DF" },
};

// Stable category → hue mapping. Known domains are fixed; anything else falls
// back to a deterministic slot so a given category always reads the same color.
const FIXED: Record<string, HueKey> = {
  // STEM / data / tech → coral
  stem: "coral",
  technology: "coral",
  cs: "coral",
  "computer science": "coral",
  data: "coral",
  math: "coral",
  // life science → gold
  biology: "gold",
  science: "gold",
  sports: "gold",
  health: "gold",
  // humanities / creative / business → berry
  humanities: "berry",
  creative: "berry",
  business: "berry",
  arts: "berry",
};
const ORDER: HueKey[] = ["coral", "gold", "berry"];

export function hueForCategory(category: string): Hue {
  const key = category.trim().toLowerCase();
  const fixed = FIXED[key];
  if (fixed) return HUES[fixed];
  // Deterministic fallback by character sum.
  let sum = 0;
  for (let i = 0; i < key.length; i++) sum += key.charCodeAt(i);
  return HUES[ORDER[sum % ORDER.length]!];
}

// ── Milestone presentation ──
// AI-generated plans leave kind/source/icon null; derive friendly defaults so
// the timeline always reads well. Seeded demo milestones supply real values.

const ICON_BY_KEYWORD: [RegExp, string][] = [
  [/course|learn|intro|study/i, "📚"],
  [/data|collect|dataset|spreadsheet/i, "📋"],
  [/chart|graph|visuali|plot/i, "📊"],
  [/write|analysis|draft|essay|story/i, "✍️"],
  [/app|build|ship|dashboard|code/i, "🧮"],
  [/publish|share|present|final/i, "🏁"],
  [/research|read|source/i, "🔎"],
  [/design|sketch|art|draw/i, "🎨"],
];

export function milestoneIcon(m: Pick<Milestone, "icon" | "title" | "weekNo">, isFinal: boolean): string {
  if (m.icon) return m.icon;
  if (isFinal) return "🏁";
  for (const [re, emoji] of ICON_BY_KEYWORD) if (re.test(m.title)) return emoji;
  return "🎯";
}

export function milestoneKind(m: Pick<Milestone, "kind" | "title">): string {
  if (m.kind) return m.kind;
  if (/course|learn|intro/i.test(m.title)) return "Course";
  if (/data|collect/i.test(m.title)) return "Dataset";
  if (/chart|graph|visuali/i.test(m.title)) return "Visualization";
  if (/write|analysis|draft/i.test(m.title)) return "Analysis";
  if (/app|build|ship|dashboard/i.test(m.title)) return "Shipped app";
  if (/publish|share|present/i.test(m.title)) return "Published story";
  return "Milestone";
}

export interface ProjectProgress {
  doneCount: number;
  total: number;
  /** Index of the active milestone (first not-done), or last if all done. */
  currentIndex: number;
  /** 0..100, share of milestones complete. */
  percent: number;
  /** "Week N of M" using milestone week numbers. */
  weekLabel: string;
  paceLine: string;
}

export function projectProgress(ms: Milestone[]): ProjectProgress {
  const total = ms.length;
  const doneCount = ms.filter((m) => m.status === "done").length;
  let currentIndex = ms.findIndex((m) => m.status !== "done");
  if (currentIndex === -1) currentIndex = Math.max(0, total - 1);
  const percent = total ? Math.round((doneCount / total) * 100) : 0;
  const current = ms[currentIndex];
  const lastWeek = total ? ms[total - 1]!.weekNo : 0;
  const weekLabel = current ? `Week ${current.weekNo} of ${lastWeek}` : "—";
  const paceLine =
    doneCount === total && total > 0
      ? "Project complete 🎉"
      : doneCount === 0
        ? "Just getting started"
        : "You're right on pace 🎉";
  return { doneCount, total, currentIndex, percent, weekLabel, paceLine };
}

/** Marker visual state for a milestone in a timeline. */
export type MarkerState = "done" | "current" | "upcoming" | "final";

// markFinal gives the LAST milestone the gold "final deliverable" look even
// while upcoming — that's the kid Weekly Plan treatment (§7b). The desktop
// board and dashboard rail keep markers purely status-based (markFinal = false)
// so a future final milestone reads as upcoming, not done.
export function markerState(
  m: Milestone,
  index: number,
  currentIndex: number,
  total: number,
  markFinal = false,
): MarkerState {
  if (m.status === "done") return "done";
  if (markFinal && index === total - 1) return "final";
  if (index === currentIndex) return "current";
  return "upcoming";
}
