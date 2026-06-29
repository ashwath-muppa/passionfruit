// A vetted real-world target (Deliverables Engine, #1). Mirrors the hero:
// tier + age/cost chips, why-it-fits, how-to-start, and a credibility line that
// is a verified-safe note for clean items or a red-flag caution for flagged ones.

import type { Deliverable } from "@/lib/db/schema";

const TIER_LABEL: Record<Deliverable["prestigeTier"], string> = {
  t1: "Tier 1 · flagship",
  t2: "Tier 2 · selective",
  t3: "Tier 3 · solid first win",
  t4: "Tier 4 · participation",
  flag: "Flagged",
};
const CATEGORY_LABEL: Record<Deliverable["category"], string> = {
  paper: "Research paper",
  competition: "Competition",
  award: "Award",
};
const COST_LABEL: Record<Deliverable["costBand"], string> = {
  free: "Free",
  low: "Low cost",
  medium: "Paid — optional",
  high: "Higher cost — optional",
};

export function DeliverableCard({
  deliverable: d,
  rationale,
  caution,
  approved = false,
}: {
  deliverable: Deliverable;
  /** Why this fits THIS student (from the match or the saved target). */
  rationale?: string | null;
  /** Mandatory caveat for flagged items; pass through from the matcher. */
  caution?: string | null;
  approved?: boolean;
}) {
  const flagged = d.prestigeTier === "flag";
  return (
    <div
      className={`card ${flagged ? "border-[#E5B8A8] bg-[#FBEEE8]" : "border-passionfruit-accentLine"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[15px]" aria-hidden>
          🎯
        </span>
        <span className="font-display text-[17px] font-semibold leading-tight text-passionfruit-ink">
          {d.name}
        </span>
        <span
          className={`chip-eyebrow ${
            flagged
              ? "bg-[#F3D9CD] text-[#9A3B22]"
              : "bg-passionfruit-wash text-passionfruit-accentInk"
          }`}
        >
          {TIER_LABEL[d.prestigeTier]}
        </span>
        {d.msAccessible && (
          <span className="chip-eyebrow bg-[#E4F0E4] text-[#3F7A45]">middle-school ok</span>
        )}
        <span
          className={`chip-eyebrow ${
            d.costBand === "free" || d.costBand === "low"
              ? "bg-[#E4F0E4] text-[#3F7A45]"
              : "bg-passionfruit-sunk text-passionfruit-muted"
          }`}
        >
          {COST_LABEL[d.costBand]}
        </span>
        <span className="pill">{CATEGORY_LABEL[d.category]}</span>
        {approved && (
          <span className="pill-accent ml-auto">★ parent-approved</span>
        )}
      </div>

      {rationale && (
        <p className="mt-2.5 text-[13px] leading-[1.55] text-passionfruit-muted">
          <span className="font-semibold text-passionfruit-body">Why it fits: </span>
          {rationale}
        </p>
      )}

      {d.howToStart && (
        <p className="mt-1.5 text-[12px] leading-[1.5] text-passionfruit-faint">
          <span className="font-semibold text-passionfruit-muted">How to start: </span>
          {d.howToStart}
        </p>
      )}

      {flagged ? (
        <div className="mt-2.5 flex items-start gap-1.5 rounded-xl bg-[#F3D9CD] px-2.5 py-2 text-[12px] text-[#9A3B22]">
          <span aria-hidden>⚠</span>
          <span>{caution ?? "Community red flag — only a low-stakes learning experience, never a credential."}</span>
        </div>
      ) : (
        <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-[#3F7A45]">
          <span aria-hidden>✓</span> Verified safe — a credible, non-predatory target
        </div>
      )}

      {d.url && (
        <a
          href={d.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-[12px] font-semibold text-passionfruit-accentInk hover:underline"
        >
          Official site ↗
        </a>
      )}
    </div>
  );
}
