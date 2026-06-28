// Compact horizontal project-timeline rail for the parent dashboard
// (DESIGN.md §7c, bottom-left). Full zigzag lives on /timeline.

import Link from "next/link";
import type { Milestone } from "@/lib/db/schema";
import { markerState, projectProgress } from "@/lib/ui";

export function ProjectTimelineRail({
  milestones,
  timelineHref,
}: {
  milestones: Milestone[];
  timelineHref: string;
}) {
  const total = milestones.length;
  const prog = projectProgress(milestones);

  return (
    <div className="card">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-display text-[15px] font-semibold text-passionfruit-ink">Project timeline</h3>
        <Link href={timelineHref} className="text-[11px] font-semibold text-passionfruit-accentInk hover:underline">
          Full timeline →
        </Link>
      </div>
      <div className="relative h-11">
        <div className="absolute left-0 right-0 top-[21px] h-0.5 bg-passionfruit-lineSoft" />
        {milestones.map((m, i) => {
          const state = markerState(m, i, prog.currentIndex, total);
          const left = total > 1 ? `${(i / (total - 1)) * 92 + 4}%` : "50%";
          const style: React.CSSProperties =
            state === "done"
              ? { background: "#E8694A" }
              : state === "current"
                ? { background: "#fff", border: "2.5px solid #E8694A" }
                : state === "final"
                  ? { background: "#F2B23E" }
                  : { background: "#F4EDE2" };
          return (
            <div
              key={m.id}
              className="absolute top-3.5 h-4 w-4 -translate-x-1/2 rounded-[5px]"
              style={{ left, ...style }}
              title={`Week ${m.weekNo}: ${m.title}`}
            />
          );
        })}
      </div>
      <div className="mt-1 text-[12px] text-passionfruit-muted">
        {prog.doneCount} of {total} deliverables complete · {prog.doneCount === total ? "complete" : "on pace"}
      </div>
    </div>
  );
}
