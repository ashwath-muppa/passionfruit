// "Up next" — mentor check-ins and opportunity windows (DESIGN.md §7c).

import type { Opportunity } from "@/lib/db/schema";

const DOT: Record<Opportunity["kind"], string> = {
  check_in: "#F2B23E", // gold
  window: "#D87BA0", // berry
  deadline: "#E8694A", // coral
};

export function UpNext({ opportunities }: { opportunities: Opportunity[] }) {
  return (
    <div className="card">
      <h3 className="mb-3 font-display text-[15px] font-semibold text-passionfruit-ink">Up next</h3>
      {opportunities.length === 0 ? (
        <p className="text-[12px] text-passionfruit-faint">
          Check-ins and opportunity windows will show up here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {opportunities.map((o) => (
            <li key={o.id} className="flex items-center gap-2.5">
              <span
                className="h-2 w-2 flex-none rounded-full"
                style={{ background: DOT[o.kind] }}
              />
              <span className="text-[13px] text-passionfruit-body">
                <b className="font-semibold">{o.title}</b>
                {o.whenHint ? ` · ${o.whenHint}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
