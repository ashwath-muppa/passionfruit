// The learner graph (DESIGN.md §7d) — the moat made visible. A living
// constellation of interests → skills → projects around the student. Built from
// the real learner graph: ring of interest pills (tinted + emoji), skills
// (dashed outline), and the chosen project (solid accent tag).
//
// Layout is normalized (0..1) so the SVG link layer and the absolutely
// positioned pills always align at any container width.

import type { Interest, Skill } from "@/lib/db/schema";
import { hueForCategory } from "@/lib/ui";

const EMOJI: [RegExp, string][] = [
  [/soccer|football|sport/i, "⚽"],
  [/stat|data|number/i, "📊"],
  [/story|writ|narrat/i, "✍️"],
  [/game|video/i, "🎮"],
  [/art|draw|design|paint/i, "🎨"],
  [/music|song/i, "🎵"],
  [/environment|climate|water|nature/i, "🌍"],
  [/bio|science|lab/i, "🔬"],
  [/speak|debate|present/i, "🗣️"],
  [/business|venture|startup/i, "💡"],
  [/math/i, "🔢"],
  [/code|app|program|comput/i, "💻"],
];
function emojiFor(label: string): string {
  for (const [re, e] of EMOJI) if (re.test(label)) return e;
  return "✨";
}

interface Node {
  nx: number;
  ny: number;
  kind: "interest" | "skill" | "project";
  label: string;
  emoji?: string;
  hueSolid?: string;
  hueBg?: string;
  hueFg?: string;
  hueBorder?: string;
}

export function LearnerGraph({
  studentName,
  interests,
  skills,
  projectTitle,
}: {
  studentName: string;
  interests: Interest[];
  skills: Skill[];
  projectTitle?: string | null;
}) {
  // Build the peripheral node list (capped to keep the constellation legible).
  const nodes: Node[] = [];
  for (const i of interests.slice(0, 4)) {
    const hue = hueForCategory(i.category ?? "");
    nodes.push({
      nx: 0,
      ny: 0,
      kind: "interest",
      label: i.label,
      emoji: emojiFor(i.label),
      hueBg: hue.pillBg,
      hueFg: hue.pillFg,
      hueBorder: hue.pillBorder,
    });
  }
  for (const s of skills.slice(0, 3)) {
    nodes.push({ nx: 0, ny: 0, kind: "skill", label: s.label });
  }
  if (projectTitle) {
    nodes.push({ nx: 0, ny: 0, kind: "project", label: "Project", hueSolid: "#E8694A" });
  }

  // Distribute on an ellipse around the center.
  const n = Math.max(nodes.length, 1);
  const rx = 0.42;
  const ry = 0.4;
  nodes.forEach((node, i) => {
    const theta = (-90 + (i * 360) / n) * (Math.PI / 180);
    node.nx = 0.5 + rx * Math.cos(theta);
    node.ny = 0.5 + ry * Math.sin(theta);
  });

  const firstName = studentName.split(" ")[0] ?? studentName;

  return (
    <div className="card relative overflow-hidden">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[16px] font-semibold text-passionfruit-ink">
          {firstName}&apos;s learner graph
        </h2>
        <span className="text-[11px] text-passionfruit-faint">grows every week</span>
      </div>

      <div className="relative mt-1" style={{ height: 224 }}>
        {/* link layer */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          {nodes.map((node, i) => (
            <line
              key={i}
              x1={50}
              y1={50}
              x2={node.nx * 100}
              y2={node.ny * 100}
              stroke={node.kind === "project" ? "#F4D9CC" : "#EBDFCF"}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {/* center student node */}
        <div
          className="absolute flex items-center justify-center rounded-full font-extrabold text-white"
          style={{
            left: "50%",
            top: "50%",
            transform: "translate(-50%,-50%)",
            width: 58,
            height: 58,
            fontSize: 14,
            background: "linear-gradient(140deg,#E8694A,#D4533A)",
            boxShadow: "0 8px 18px -8px rgba(216,84,60,.7)",
          }}
        >
          {firstName}
        </div>

        {/* peripheral nodes */}
        {nodes.map((node, i) => {
          const base = "absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap";
          const pos = { left: `${node.nx * 100}%`, top: `${node.ny * 100}%` } as const;
          if (node.kind === "interest") {
            return (
              <div
                key={i}
                className={`${base} rounded-full border px-3 py-1.5 text-[12px] font-bold`}
                style={{ ...pos, background: node.hueBg, color: node.hueFg, borderColor: node.hueBorder }}
              >
                {node.emoji} {node.label}
              </div>
            );
          }
          if (node.kind === "skill") {
            return (
              <div
                key={i}
                className={`${base} rounded-full border-[1.5px] border-dashed bg-passionfruit-card px-3 py-1.5 text-[11px] font-bold text-passionfruit-muted`}
                style={{ ...pos, borderColor: "#E0D3C2" }}
              >
                {node.label}
              </div>
            );
          }
          return (
            <div
              key={i}
              className={`${base} rounded-xl px-2.5 py-1.5 text-[10px] font-bold text-white`}
              style={{ ...pos, background: node.hueSolid }}
            >
              {node.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
