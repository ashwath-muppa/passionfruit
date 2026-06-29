// Spike Ladder (#3) — the multi-year climb made visible, the moat families can
// SEE. Lights the current rung + the next one or two above so progress reads as
// compounding over years (depth over breadth). Presentational only: it takes a
// resolved ladder + current rung and draws the climb. Style mirrors the dash
// right-column rails (ProjectTimelineRail / the ladder strip) in Warm Paper.

import type { Ladder } from "@/lib/deliverables/ladders";

export function SpikeLadder({
  ladder,
  currentRungIndex,
}: {
  ladder: Ladder;
  currentRungIndex: number;
}) {
  const current = Math.max(0, Math.min(currentRungIndex, ladder.rungs.length - 1));

  return (
    <div className="card">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-[15px] font-semibold text-passionfruit-ink">
          The multi-year climb
        </h3>
        <span className="chip-eyebrow bg-passionfruit-wash text-passionfruit-accentInk">
          the moat
        </span>
      </div>
      <p className="mt-1 text-[12px] leading-[1.5] text-passionfruit-faint">
        depth over breadth — climbing one ladder for years is what selective
        admissions reward.
      </p>

      {/* Connected rung rail. Wraps gracefully in the ~520px right column. */}
      <ol className="mt-3.5 flex flex-wrap items-stretch gap-x-1.5 gap-y-2.5">
        {ladder.rungs.map((rung, i) => {
          const state = i < current ? "done" : i === current ? "current" : "future";
          return (
            <li key={i} className="flex items-stretch gap-x-1.5">
              <div className="flex flex-col items-center">
                <span className={rungClass(state)}>
                  {state === "done" && (
                    <span className="text-[10px] leading-none" aria-hidden>
                      ✓
                    </span>
                  )}
                  <span>{rung.label}</span>
                </span>
                {state === "current" ? (
                  <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.8px] text-passionfruit-accentInk">
                    you are here
                  </span>
                ) : (
                  <span className="mt-1 h-[11px]" aria-hidden />
                )}
              </div>
              {i < ladder.rungs.length - 1 && (
                <span
                  className="self-start pt-[7px] text-[12px] leading-none text-passionfruit-faint"
                  aria-hidden
                >
                  →
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

type RungState = "done" | "current" | "future";

function rungClass(state: RungState): string {
  const base =
    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold leading-tight whitespace-nowrap";
  if (state === "done") {
    return `${base} bg-passionfruit-accent text-white`;
  }
  if (state === "current") {
    return `${base} border-2 border-passionfruit-accent bg-passionfruit-card text-passionfruit-accentInk`;
  }
  return `${base} bg-passionfruit-sunk text-passionfruit-faint`;
}
