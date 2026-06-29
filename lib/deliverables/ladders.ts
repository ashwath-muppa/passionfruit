// Spike ladders (#3) — the multi-year "climb" that selective admissions reward:
// depth over breadth, one laddered competition/credential carried up over years
// (strategy doc §6.2). Encoded as ordered rungs; a rung links to a catalog
// entry when an exact slug exists, otherwise it's a descriptive step only.
//
// Dependency-free on purpose: NO "server-only", NO DB. The matcher, a server
// component, and the presentational <SpikeLadder> can all import it.

export interface Ladder {
  id: string;
  label: string;
  domains: string[];
  rungs: { label: string; deliverableSlug?: string }[];
}

// Slugs verified against lib/deliverables/catalog.json. Only rungs whose step
// maps to a real catalog entry carry a `deliverableSlug`; the rest are
// descriptive (the catalog has no entry for, e.g., F=ma, USABO, the IMO, the
// Concord Review's mid rungs, hackathons, Rattle, etc.).
export const LADDERS: Ladder[] = [
  {
    id: "math",
    label: "Math olympiad track",
    domains: ["math"],
    rungs: [
      { label: "MATHCOUNTS / AMC 8", deliverableSlug: "amc-8" },
      { label: "AMC 10", deliverableSlug: "amc-10" },
      { label: "AIME", deliverableSlug: "aime" },
      { label: "USA(J)MO" },
      { label: "MOP / IMO" },
    ],
  },
  {
    id: "science-research",
    label: "Science research track",
    domains: ["science-general", "engineering-robotics", "biology", "chemistry", "physics"],
    rungs: [
      { label: "Regional science fair" },
      { label: "Thermo Fisher JIC", deliverableSlug: "thermo-fisher-jic" },
      { label: "ISEF", deliverableSlug: "regeneron-isef" },
      { label: "Regeneron STS", deliverableSlug: "regeneron-sts" },
    ],
  },
  {
    id: "subject-olympiads",
    label: "Subject olympiad track",
    domains: ["biology", "chemistry", "physics"],
    rungs: [
      { label: "School registration / F=ma" },
      { label: "USABO / USNCO / USAPhO" },
      { label: "Camp invite" },
      { label: "IBO / IChO / IPhO" },
    ],
  },
  {
    id: "cs-algorithm",
    label: "CS algorithms track",
    domains: ["computer-science"],
    rungs: [
      { label: "Bebras / picoCTF", deliverableSlug: "picoctf" },
      { label: "USACO Bronze", deliverableSlug: "usaco" },
      { label: "Silver" },
      { label: "Gold" },
      { label: "Platinum" },
    ],
  },
  {
    id: "cs-builder",
    label: "CS builder track",
    domains: ["computer-science", "engineering-robotics"],
    rungs: [
      { label: "Verizon App Challenge", deliverableSlug: "verizon-app-challenge" },
      { label: "Congressional App Challenge", deliverableSlug: "congressional-app-challenge" },
      { label: "Hackathons" },
      { label: "A deployed app" },
    ],
  },
  {
    id: "writing-history",
    label: "History writing track",
    domains: ["history", "humanities"],
    rungs: [
      { label: "National History Day Jr", deliverableSlug: "national-history-day" },
      { label: "World Historian Essay" },
      { label: "The Concord Review", deliverableSlug: "concord-review" },
    ],
  },
  {
    id: "writing-creative",
    label: "Creative writing track",
    domains: ["writing-creative"],
    rungs: [
      { label: "Rattle Young Poets" },
      { label: "Scholastic Gold Key", deliverableSlug: "scholastic-art-writing" },
      { label: "Scholastic National Medal / Adroit", deliverableSlug: "adroit-prizes" },
    ],
  },
  {
    id: "service",
    label: "Service track",
    domains: ["leadership-service"],
    rungs: [
      { label: "Congressional Award (Bronze)", deliverableSlug: "congressional-award" },
      { label: "Congressional Award (Gold) + a sustained, measurable project" },
    ],
  },
];

/**
 * Pick the ladder the student's current target sits on.
 *
 * Priority:
 *   1. If `targetSlug` is given and a ladder contains it, that ladder wins
 *      (ties broken by domain overlap), and the current rung is that slug's rung.
 *   2. Otherwise pick the ladder with the most domain overlap.
 *   3. If nothing overlaps and no target matches, return null.
 *
 * `currentRungIndex` when there's no matching target rung is estimated from
 * grade: ≤7 → 0, 8–9 → min(1, last), ≥10 → min(2, last); default 0.
 */
export function pickLadder(opts: {
  domains: Set<string>;
  targetSlug?: string | null;
  grade?: number | null;
}): { ladder: Ladder; currentRungIndex: number } | null {
  const { domains, targetSlug, grade } = opts;

  const overlap = (l: Ladder) => l.domains.filter((d) => domains.has(d)).length;

  // 1) A ladder that contains the target slug takes priority.
  if (targetSlug) {
    const onTarget = LADDERS.filter((l) =>
      l.rungs.some((r) => r.deliverableSlug === targetSlug),
    );
    if (onTarget.length > 0) {
      const ladder = onTarget.reduce((best, l) => (overlap(l) > overlap(best) ? l : best));
      const currentRungIndex = ladder.rungs.findIndex((r) => r.deliverableSlug === targetSlug);
      return { ladder, currentRungIndex: currentRungIndex >= 0 ? currentRungIndex : 0 };
    }
  }

  // 2) Otherwise, most domain overlap wins.
  let best: Ladder | null = null;
  let bestOverlap = 0;
  for (const l of LADDERS) {
    const o = overlap(l);
    if (o > bestOverlap) {
      best = l;
      bestOverlap = o;
    }
  }
  if (!best || bestOverlap === 0) return null;

  return { ladder: best, currentRungIndex: estimateRung(best, grade) };
}

function estimateRung(ladder: Ladder, grade?: number | null): number {
  const lastIndex = ladder.rungs.length - 1;
  if (grade == null) return 0;
  if (grade <= 7) return 0;
  if (grade <= 9) return Math.min(1, lastIndex);
  return Math.min(2, lastIndex);
}
