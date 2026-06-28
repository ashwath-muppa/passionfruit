// Skills planner (DESIGN.md §7c) — categorical progress bars. Each skill's
// domain maps to a stable hue (coral / gold / berry) via hueForCategory.

import type { Skill } from "@/lib/db/schema";
import { hueForCategory } from "@/lib/ui";

export function SkillsPlanner({ skills }: { skills: Skill[] }) {
  return (
    <div className="card">
      <h2 className="font-display text-[16px] font-semibold text-passionfruit-ink">Skills planner</h2>
      {skills.length === 0 ? (
        <p className="mt-3 text-[13px] text-passionfruit-faint">
          Skills appear here as {`they`} take shape through projects.
        </p>
      ) : (
        <div className="mt-3.5 flex flex-col gap-3.5">
          {skills.map((s) => {
            const hue = hueForCategory(s.category);
            const pct = Math.round(s.progress * 100);
            return (
              <div key={s.id}>
                <div className="mb-1.5 flex items-center justify-between text-[13px]">
                  <span className="font-semibold text-passionfruit-body">{s.label}</span>
                  <span className="font-bold text-passionfruit-faint">{pct}%</span>
                </div>
                <div className="h-2 rounded-lg bg-passionfruit-sunk">
                  <div className="h-2 rounded-lg" style={{ width: `${pct}%`, background: hue.solid }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
