// Per-milestone resource chips (Live Resource Finder, #2): the best free course
// / dataset / tool / portfolio for this step, each a real link.

import type { Resource } from "@/lib/db/schema";

const ICON: Record<Resource["kind"], string> = {
  course: "▶",
  program: "◆",
  portfolio: "❖",
  dataset: "▥",
  tool: "⚙",
  competition: "🏁",
  reading: "📖",
  other: "•",
};

export function ResourceChips({ items }: { items: Resource[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((r) => {
        const flagged = r.flags.length > 0;
        return (
          <a
            key={r.id}
            href={r.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            title={r.summary ?? ""}
            className="inline-flex items-center gap-1.5 rounded-full border border-passionfruit-line bg-passionfruit-card px-2.5 py-1 text-[11px] text-passionfruit-muted transition hover:border-passionfruit-accentLine"
          >
            <span aria-hidden className="text-passionfruit-faint">
              {ICON[r.kind]}
            </span>
            <span className="font-semibold text-passionfruit-body">
              {r.provider ? `${r.provider} — ` : ""}
              {r.title}
            </span>
            {r.costNote && <span className="text-passionfruit-faint">· {r.costNote}</span>}
            {flagged && <span className="text-passionfruit-accentInk">⚠</span>}
          </a>
        );
      })}
    </div>
  );
}
