// The 7-day activation sprint banner (#6). A small, low-pressure nudge shown
// only during a brand-new student's first week. Presentational — it just
// reflects the ActivationState the page computed.

import type { ActivationState } from "@/lib/habit/activation";

export function ActivationBanner({ state }: { state: ActivationState }) {
  // Graduated: hide once they've had their first win or the sprint window passes.
  if (state.firstWin || state.dayOfSprint > 7) return null;

  return (
    <div className="rounded-2xl border border-passionfruit-accentLine bg-passionfruit-wash px-3.5 py-3">
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-[15px]">
          🌱
        </span>
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[.6px] text-passionfruit-accentInk">
            Day {state.dayOfSprint} of your first week
          </div>
          <div className="mt-0.5 truncate text-[13px] font-medium text-passionfruit-body">
            {state.nextStep}
          </div>
        </div>
      </div>
    </div>
  );
}
