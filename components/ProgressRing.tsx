// Conic progress ring with a % label. Used on the Weekly Plan project header
// (white-on-coral) and the Project Timeline (coral-on-paper).

interface ProgressRingProps {
  percent: number;
  size?: number;
  fill?: string; // completed arc color
  track?: string; // remaining arc color
  innerBg?: string; // inner disc color
  textColor?: string;
  label?: string; // defaults to "{percent}%"
}

export function ProgressRing({
  percent,
  size = 52,
  fill = "#ffffff",
  track = "rgba(255,255,255,.28)",
  innerBg = "#DA543C",
  textColor = "#ffffff",
  label,
}: ProgressRingProps) {
  const p = Math.max(0, Math.min(100, percent));
  const inner = Math.round(size * 0.77);
  return (
    <div
      className="relative flex flex-none items-center justify-center rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(${fill} 0 ${p}%, ${track} ${p}% 100%)` }}
    >
      <div
        className="flex items-center justify-center rounded-full font-extrabold"
        style={{ width: inner, height: inner, background: innerBg, color: textColor, fontSize: size * 0.25 }}
      >
        {label ?? `${p}%`}
      </div>
    </div>
  );
}
