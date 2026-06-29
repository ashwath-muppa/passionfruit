// The deliverables matcher. Maps a student's learner graph onto the right next
// real-world target, the authentic depth-over-breadth way the admissions
// community rewards (catalog §0). The guardrails are non-negotiable:
//   • NEVER recommend status != 'active'.
//   • NEVER surface a FLAG / predatory item as a credential — only, if asked,
//     as a captioned low-stakes "learning experience".
//   • Lead with free/low cost; treat high-cost paid programs as strictly
//     optional, never the only path (free alternatives almost always exist).
//   • Respect the parent's cost ceiling and chosen end-goal direction (#10).

import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { deliverables } from "@/lib/db/schema";
import type { Deliverable } from "@/lib/db/schema";
import type { LearnerGraphSnapshot } from "@/lib/db/queries";
import type { DeliverableCostBand } from "./types";

const COST_RANK: Record<DeliverableCostBand, number> = { free: 0, low: 1, medium: 2, high: 3 };

// Parent end-goal direction → how it biases the match (#10).
export type EndGoalPref = "research" | "competition" | "portfolio" | "venture" | "award" | "open";

export interface MatchOptions {
  grade?: number | null;
  /** Parent cost ceiling; deliverables above it become optional, never sole path. */
  costCeiling?: DeliverableCostBand;
  /** Parent-chosen end-goal direction (#10). */
  endGoalPref?: EndGoalPref | null;
  /** Hard-gate to middle-school-accessible items (young students). */
  msOnly?: boolean;
  /** Include FLAG items as captioned "learning experience" options (default false). */
  includeFlagged?: boolean;
  limit?: number;
}

export type MatchRole = "first_win" | "north_star" | "option";

export interface MatchedDeliverable {
  deliverable: Deliverable;
  score: number;
  role: MatchRole;
  reasons: string[];
  /** Set ONLY for flagged items — a credibility caveat the UI must show. */
  caution?: string;
}

// ── Interest → catalog-domain inference ──────────────────────────────────────
const DOMAIN_KEYWORDS: [RegExp, string[]][] = [
  [/\b(algebra|geometry|calculus|math)\b/i, ["math"]],
  [/\b(stat|statistic|data|analytics)\b/i, ["math", "science-general", "computer-science"]],
  [/\b(cod(e|ing)|program|software|app|web|game ?dev|ai|machine learning|ml|comput)\b/i, ["computer-science"]],
  [/\b(robot|engineer|build|maker|hardware)\b/i, ["engineering-robotics"]],
  [/\b(bio|biology|life science|ecology|animal|genetic|medicine|health)\b/i, ["biology", "science-general"]],
  [/\b(chem|chemistry)\b/i, ["chemistry", "science-general"]],
  [/\b(physics|astro|space|rocket)\b/i, ["physics", "earth-space-science", "science-general"]],
  [/\b(environment|climate|water|ocean|sustainab|nature|earth)\b/i, ["environment", "earth-space-science"]],
  [/\b(science)\b/i, ["science-general"]],
  [/\b(writ|story|stories|poet|fiction|novel|narrativ)\b/i, ["writing-creative"]],
  [/\b(essay)\b/i, ["writing-essay"]],
  [/\b(history|historical)\b/i, ["history", "humanities"]],
  [/\b(art|draw|paint|illustrat|design|visual)\b/i, ["arts-visual"]],
  [/\b(music|song|instrument|compose)\b/i, ["music"]],
  [/\b(debate|speech|rhetoric)\b/i, ["debate-speech"]],
  [/\b(business|entrepreneur|startup|venture|market)\b/i, ["business-entrepreneurship"]],
  [/\b(econ|finance|invest|stock|money)\b/i, ["economics", "finance"]],
  [/\b(psych)\b/i, ["psychology", "social-science"]],
  [/\b(neuro|brain)\b/i, ["neuroscience"]],
  [/\b(language|latin|spanish|french|classics)\b/i, ["languages-classics"]],
  [/\b(civic|law|government|politic|constitution)\b/i, ["civics-law"]],
  [/\b(service|volunteer|community|leader)\b/i, ["leadership-service"]],
  [/\b(sport|soccer|basketball|football|athlet)\b/i, ["science-general", "math"]],
];

export function inferDomains(graph: LearnerGraphSnapshot): Set<string> {
  const out = new Set<string>();
  const text = [
    ...graph.interests.map((i) => `${i.label} ${i.category ?? ""}`),
    ...graph.goals.map((g) => g.text),
  ].join(" ");
  for (const [re, domains] of DOMAIN_KEYWORDS) {
    if (re.test(text)) domains.forEach((d) => out.add(d));
  }
  if (out.size === 0) out.add("interdisciplinary");
  return out;
}

const PREF_CATEGORY: Record<EndGoalPref, Deliverable["category"] | null> = {
  research: "paper",
  competition: "competition",
  award: "award",
  portfolio: null, // biased by domain (arts/writing) instead
  venture: null, // biased by domain (business) instead
  open: null,
};
const PREF_DOMAINS: Partial<Record<EndGoalPref, string[]>> = {
  portfolio: ["arts-visual", "writing-creative"],
  venture: ["business-entrepreneurship"],
};

/** Fetch the active catalog (and, when asked, flagged items as cautioned options). */
async function loadCandidates(includeFlagged: boolean): Promise<Deliverable[]> {
  const rows = await db.select().from(deliverables).where(eq(deliverables.status, "active"));
  return includeFlagged ? rows : rows.filter((d) => d.prestigeTier !== "flag");
}

const FIRST_WIN_TIERS = new Set(["t3", "t4"]);
const NORTH_STAR_TIERS = new Set(["t1", "t2"]);

/**
 * Rank the catalog for a student. Returns a small, sequenced set: one accessible
 * first-win + one aspirational north-star on the same theme, plus a few options.
 */
export async function matchDeliverables(
  graph: LearnerGraphSnapshot,
  opts: MatchOptions = {},
): Promise<MatchedDeliverable[]> {
  const grade = opts.grade ?? graphGrade(graph);
  const costCeil = opts.costCeiling ? COST_RANK[opts.costCeiling] : COST_RANK.high;
  const wantDomains = inferDomains(graph);
  const prefCategory = opts.endGoalPref ? PREF_CATEGORY[opts.endGoalPref] : null;
  const prefDomains = opts.endGoalPref ? PREF_DOMAINS[opts.endGoalPref] ?? [] : [];

  const candidates = await loadCandidates(!!opts.includeFlagged);

  const scored: MatchedDeliverable[] = [];
  for (const d of candidates) {
    const reasons: string[] = [];

    // Hard gate: middle-school-only mode excludes non-MS items.
    if (opts.msOnly && !d.msAccessible) continue;
    // Hard gate: don't recommend something the student can't start for years.
    if (grade != null && d.minGrade != null && d.minGrade > grade + 1) continue;

    let score = 0;

    // Domain overlap — the primary signal.
    const overlap = d.domains.filter((dom) => wantDomains.has(dom)).length;
    score += overlap * 10;
    if (overlap > 0) reasons.push(`matches ${d.domains.filter((dom) => wantDomains.has(dom)).join(", ")}`);

    // Age fit.
    if (d.msAccessible) {
      score += 4;
      if (grade != null && grade <= 8) reasons.push("middle-school accessible");
    }
    if (grade != null && d.minGrade != null && d.minGrade <= grade) score += 2;

    // Cost: lead free/low; rank down above the parent's ceiling but keep as option.
    score += (3 - COST_RANK[d.costBand]) * 2;
    const overCeiling = COST_RANK[d.costBand] > costCeil;
    if (overCeiling) {
      score -= 8;
      reasons.push("above your cost preference — optional, a free alternative exists");
    } else if (d.costBand === "free") {
      reasons.push("free");
    }

    // Parent end-goal direction (#10).
    if (prefCategory && d.category === prefCategory) {
      score += 6;
      reasons.push(`fits your goal of a ${opts.endGoalPref}`);
    }
    if (prefDomains.length && d.domains.some((dom) => prefDomains.includes(dom))) {
      score += 6;
      reasons.push(`fits your goal of a ${opts.endGoalPref}`);
    }

    // Tier shaping handled at role-assignment; small nudge toward recognized signals.
    if (d.prestigeTier === "t1") score += 1;

    scored.push({ deliverable: d, score, role: "option", reasons });
  }

  scored.sort((a, b) => b.score - a.score);

  // Sequence: prefer a ladder (an accessible first-win + an aspirational north-star)
  // over a scatter of unrelated items (catalog §0: "prefer ladders over scatter").
  const firstWin = scored.find(
    (m) =>
      FIRST_WIN_TIERS.has(m.deliverable.prestigeTier) &&
      (m.deliverable.difficulty === "intro" || m.deliverable.difficulty === "intermediate") &&
      COST_RANK[m.deliverable.costBand] <= costCeil,
  );
  const northStar = scored.find(
    (m) => NORTH_STAR_TIERS.has(m.deliverable.prestigeTier) && m !== firstWin,
  );
  if (firstWin) firstWin.role = "first_win";
  if (northStar) northStar.role = "north_star";

  // Flagged items (only present when includeFlagged) carry a mandatory caveat and
  // are never a credential.
  for (const m of scored) {
    if (m.deliverable.prestigeTier === "flag") {
      m.caution =
        "Community red flag (" +
        (m.deliverable.flags.join(", ") || "low signal") +
        "). Worth doing only as a low-stakes learning experience — never present it as a credential.";
      m.role = "option";
    }
  }

  const limit = opts.limit ?? 6;
  // Put the sequenced pair first, then the rest by score.
  const ordered = [
    ...(firstWin ? [firstWin] : []),
    ...(northStar ? [northStar] : []),
    ...scored.filter((m) => m !== firstWin && m !== northStar),
  ];
  return ordered.slice(0, limit);
}

function graphGrade(graph: LearnerGraphSnapshot): number | null {
  const g = graph.student.grade;
  if (!g) return null;
  const n = parseInt(g, 10);
  return Number.isFinite(n) ? n : null;
}
