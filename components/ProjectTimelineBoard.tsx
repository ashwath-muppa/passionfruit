"use client";

// Desktop Project Timeline (DESIGN.md / "Project Timeline.dc.html"): a zigzag
// milestone band over a progress rail, with a detail panel that updates on
// click. Data-driven from real milestones.

import { useState } from "react";
import type { Milestone } from "@/lib/db/schema";
import { ProgressRing } from "@/components/ProgressRing";
import { CheckpointDetail } from "@/components/CheckpointDetail";
import { markerState, milestoneIcon, milestoneKind, projectProgress, type MarkerState } from "@/lib/ui";

const ACCENT = "#E8694A";
const DEEP = "#D4533A";

export function ProjectTimelineBoard({
  title,
  studentName,
  studentId,
  deliverable,
  milestones,
}: {
  title: string;
  studentName: string;
  studentId: string;
  deliverable: string;
  milestones: Milestone[];
}) {
  const total = milestones.length;
  const prog = projectProgress(milestones);
  const [selectedId, setSelectedId] = useState<string>(
    milestones[prog.currentIndex]?.id ?? milestones[0]?.id ?? "",
  );
  // Which milestone's full-screen checkpoint detail is open (double-click).
  const [openId, setOpenId] = useState<string | null>(null);
  const openMilestone = openId ? milestones.find((m) => m.id === openId) ?? null : null;

  const states: MarkerState[] = milestones.map((m, i) => markerState(m, i, prog.currentIndex, total));
  const selIndex = Math.max(0, milestones.findIndex((m) => m.id === selectedId));
  const sel = milestones[selIndex]!;
  const selState = states[selIndex]!;
  const fillPercent = total ? ((prog.currentIndex + 0.5) / total) * 100 : 0;

  return (
    <div>
      {/* header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="mb-2.5 flex items-center gap-2">
            <span className="h-[22px] w-[22px] rounded-[7px] bg-passionfruit-accent" />
            <span className="font-display text-[17px] font-semibold text-passionfruit-ink">Passionfruit</span>
            <span className="border-l border-passionfruit-line pl-2.5 text-[10px] font-bold uppercase tracking-[1px] text-passionfruit-faint">
              Project timeline
            </span>
          </div>
          <h1 className="font-display text-[34px] font-semibold leading-[1.08] tracking-[-0.3px] text-passionfruit-ink">
            {title}
          </h1>
          <p className="mt-2 text-[13.5px] text-passionfruit-muted">
            A {deliverable.toLowerCase()} by <b className="text-passionfruit-body">{studentName}</b> ·{" "}
            {prog.doneCount} of {total} deliverables complete
          </p>
        </div>
        <div className="flex items-center gap-3.5 rounded-card border border-passionfruit-line bg-passionfruit-card px-4 py-3 shadow-sheet">
          <ProgressRing percent={prog.percent} size={54} fill={ACCENT} track="#EFE5D6" innerBg="#fff" textColor="#2C2420" />
          <div>
            <div className="text-[14px] font-extrabold text-passionfruit-ink">{prog.weekLabel}</div>
            <div className="text-[12px] text-passionfruit-muted">{prog.paceLine}</div>
          </div>
        </div>
      </div>

      {/* legend */}
      <div className="mb-1 flex flex-wrap items-center gap-5 text-[12px] text-passionfruit-muted">
        <Legend swatch={<span className="h-3.5 w-3.5 rounded-[4px]" style={{ background: ACCENT }} />} label="Completed" />
        <Legend swatch={<span className="h-3.5 w-3.5 rounded-[4px] border-[2.5px] bg-white" style={{ borderColor: ACCENT }} />} label="This week" />
        <Legend swatch={<span className="h-3.5 w-3.5 rounded-[4px] border border-passionfruit-line bg-passionfruit-sunk" />} label="Upcoming" />
        <span className="text-[11.5px] text-passionfruit-faint">
          — tap a milestone to preview · <b className="text-passionfruit-muted">double-click</b> to open the full checkpoint
        </span>
      </div>

      {/* timeline band */}
      <div className="relative my-2.5" style={{ height: 360 }}>
        {/* rail + fill */}
        <div className="absolute left-0 right-0 top-1/2 h-[5px] -translate-y-1/2 rounded bg-passionfruit-lineSoft" />
        <div
          className="absolute left-0 top-1/2 h-[5px] -translate-y-1/2 rounded"
          style={{ width: `${fillPercent}%`, background: `linear-gradient(90deg,${ACCENT},${DEEP})` }}
        />
        <div className="absolute inset-0 flex items-stretch">
          {milestones.map((m, i) => {
            const above = i % 2 === 0;
            const state = states[i]!;
            const selected = m.id === selectedId;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedId(m.id)}
                onDoubleClick={() => setOpenId(m.id)}
                className="relative flex-1"
                title="Double-click to open this checkpoint"
                aria-label={`Week ${m.weekNo}: ${m.title}. Double-click to open the full checkpoint.`}
              >
                {/* cap label */}
                <div
                  className="absolute left-1/2 w-[150px] -translate-x-1/2 text-center"
                  style={{ top: above ? 8 : 296 }}
                >
                  <div
                    className="text-[9px] font-bold uppercase tracking-[1px]"
                    style={{ color: state === "current" ? ACCENT : "#A0917F" }}
                  >
                    {state === "current" ? "This week" : `Week ${m.weekNo}`}
                  </div>
                  <div
                    className={`text-[12.5px] font-bold leading-tight ${
                      state === "upcoming" ? "text-[#B6A899]" : "text-passionfruit-ink"
                    }`}
                  >
                    {m.title}
                  </div>
                </div>
                {/* square marker */}
                <Square
                  state={state}
                  icon={milestoneIcon(m, state === "final")}
                  selected={selected}
                  top={above ? 70 : 220}
                />
                {/* dot on rail */}
                <div
                  className="absolute left-1/2 top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-[6px]"
                  style={
                    state === "done" || state === "final"
                      ? { background: ACCENT }
                      : state === "current"
                        ? { background: "#fff", border: `3px solid ${ACCENT}` }
                        : { background: "#E0D3C2" }
                  }
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* detail panel */}
      <div className="rounded-sheet border border-passionfruit-line bg-passionfruit-card p-6 shadow-elev">
        <div className="flex items-start gap-5">
          <Tile state={selState} icon={milestoneIcon(sel, selState === "final")} />
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2.5">
              <span className="chip-eyebrow bg-passionfruit-wash text-passionfruit-accentInk">
                {milestoneKind(sel)}
              </span>
              <StatusChip state={selState} />
              <span className="text-[12px] text-passionfruit-faint">
                Week {sel.weekNo}
                {sel.source ? ` · ${sel.source}` : ""}
              </span>
            </div>
            <h2 className="font-display text-[25px] font-semibold leading-[1.12] text-passionfruit-ink">
              {sel.title}
            </h2>
            {sel.detail && (
              <p className="mt-2.5 max-w-[640px] text-[14px] leading-[1.55] text-passionfruit-body">
                {sel.detail}
              </p>
            )}
            {sel.coach && (
              <div
                className="mt-4 max-w-[560px] rounded-2xl border p-3.5"
                style={{ background: "rgba(232,105,74,.07)", borderColor: "rgba(232,105,74,.22)" }}
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[12px]"
                    style={{ background: "linear-gradient(140deg,#F2B23E,#E8694A)" }}
                  >
                    🌱
                  </span>
                  <span className="text-[11px] font-bold text-passionfruit-ink">Sage · your mentor</span>
                </div>
                <p className="mentor-voice text-[15px]">{sel.coach}</p>
              </div>
            )}
          </div>
          <div className="flex flex-none flex-col items-end gap-3">
            <div className="flex gap-2">
              <NavBtn dir="‹" disabled={selIndex === 0} onClick={() => setSelectedId(milestones[selIndex - 1]!.id)} />
              <NavBtn dir="›" disabled={selIndex === total - 1} onClick={() => setSelectedId(milestones[selIndex + 1]!.id)} />
            </div>
            <span className="text-[11px] text-passionfruit-faint">
              {selIndex + 1} of {total}
            </span>
            <button
              type="button"
              onClick={() => setOpenId(sel.id)}
              className="btn-soft text-[12px]"
            >
              Open checkpoint
            </button>
          </div>
        </div>
      </div>

      {/* full-screen checkpoint detail (double-click) */}
      {openMilestone && (
        <CheckpointDetail
          milestoneId={openMilestone.id}
          studentId={studentId}
          title={openMilestone.title}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-2">
      {swatch}
      {label}
    </span>
  );
}

function Square({ state, icon, selected, top }: { state: MarkerState; icon: string; selected: boolean; top: number }) {
  const base = "absolute left-1/2 flex h-[72px] w-[72px] -translate-x-1/2 items-center justify-center rounded-2xl text-[28px] transition";
  let style: React.CSSProperties = { top };
  if (state === "done" || state === "final") {
    style = { ...style, background: `linear-gradient(150deg,${ACCENT},${DEEP})`, color: "#fff", boxShadow: selected ? `0 0 0 5px rgba(232,105,74,.18)` : `0 10px 22px -12px rgba(212,83,58,.55)` };
  } else if (state === "current") {
    style = { ...style, background: "#fff", border: `2.5px solid ${ACCENT}`, color: ACCENT, boxShadow: `0 0 0 6px rgba(232,105,74,.10)` };
  } else {
    style = { ...style, background: "#F4EDE2", color: "#C9BBAA", border: "1px solid #EAE0D2" };
  }
  return (
    <div className={`${base} ${state === "current" ? "animate-pf-float" : ""}`} style={style}>
      {icon}
    </div>
  );
}

function Tile({ state, icon }: { state: MarkerState; icon: string }) {
  const base = "flex h-[66px] w-[66px] flex-none items-center justify-center rounded-2xl text-[28px]";
  let style: React.CSSProperties = {};
  if (state === "done" || state === "final") style = { background: `linear-gradient(150deg,${ACCENT},${DEEP})`, color: "#fff" };
  else if (state === "current") style = { background: "#fff", border: `2.5px solid ${ACCENT}`, color: ACCENT };
  else style = { background: "#F4EDE2", color: "#C9BBAA", border: "1px solid #EAE0D2" };
  return (
    <div className={base} style={style}>
      {icon}
    </div>
  );
}

function StatusChip({ state }: { state: MarkerState }) {
  const text = state === "current" ? "In progress" : state === "upcoming" ? "Upcoming" : "Completed";
  const style: React.CSSProperties =
    state === "current"
      ? { background: ACCENT, color: "#fff" }
      : state === "upcoming"
        ? { background: "#F1E9DD", color: "#9A8C80" }
        : { background: "rgba(232,105,74,.13)", color: DEEP };
  return (
    <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.5px]" style={style}>
      {text}
    </span>
  );
}

function NavBtn({ dir, disabled, onClick }: { dir: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-[34px] w-[34px] items-center justify-center rounded-full border text-[18px] transition disabled:opacity-40"
      style={{ background: disabled ? "#F7F0E6" : "#fff", borderColor: "#EFE5D6", color: "#6F6258" }}
    >
      {dir}
    </button>
  );
}
