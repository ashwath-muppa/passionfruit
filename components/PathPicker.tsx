"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PATH_TYPE_LABELS, type PathType, type ProjectPathCandidate } from "@/lib/types";
import { MentorNote, Spark } from "@/components/MentorNote";

// Short deliverable eyebrow per path type (DESIGN.md §7a).
const DELIVERABLE: Record<PathType, string> = {
  research: "Research paper",
  app: "Shipped app",
  sports_analytics: "Data story",
  creative: "Creative",
  venture: "Social venture",
};

export function PathPicker({
  studentId,
  studentName,
  spark,
  initialPaths = null,
}: {
  studentId: string;
  studentName: string;
  spark: string | null;
  /** Paths already stored in Supabase (server-provided). When present we render
   *  them directly — no API call — so revisits never regenerate. */
  initialPaths?: ProjectPathCandidate[] | null;
}) {
  const router = useRouter();
  const hasStored = !!initialPaths && initialPaths.length > 0;
  const [paths, setPaths] = useState<ProjectPathCandidate[] | null>(initialPaths);
  const [generating, setGenerating] = useState(!hasStored);
  const [pickingIdx, setPickingIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  // `force` is only true for an explicit "Regenerate ideas" — the one case that
  // is allowed to call the AI again and overwrite the stored snapshot.
  async function generate(force: boolean) {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/paths", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, force }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Could not generate paths");
      setPaths(data.paths);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    // Generate only when nothing is stored yet (the true first visit).
    if (!hasStored) void generate(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function pick(idx: number, chosen: ProjectPathCandidate) {
    setPickingIdx(idx);
    setError(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, chosen }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Could not build the plan");
      router.push(`/students/${studentId}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setPickingIdx(null);
    }
  }

  return (
    <div className="pb-6">
      {/* Mentor note — skeleton while generating, then the warm intro. */}
      <div className="max-w-2xl">
        {generating ? (
          <MentorNote loading />
        ) : (
          <MentorNote>
            Hi {studentName} — I found <Spark>three paths</Spark> that fit how you think
            {spark ? ` about ${spark}` : ""}. Pick the one that sparks something.
          </MentorNote>
        )}
      </div>

      <div className="px-0.5 pb-2.5 pt-[18px]">
        <span className="eyebrow">Your paths · picked for you</span>
      </div>

      {error && (
        <div className="card mb-3">
          <p className="text-[13px] text-passionfruit-accentInk">{error}</p>
          <button className="btn-ghost mt-3 text-xs" onClick={() => generate(false)}>
            Try again
          </button>
        </div>
      )}

      {generating && !paths && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-[220px] animate-pulse" />
          ))}
        </div>
      )}

      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {paths?.map((p, i) => {
          const best = i === 0;
          const picking = pickingIdx === i;
          return (
            <div
              key={i}
              className={`flex h-full flex-col rounded-[20px] bg-passionfruit-card p-[15px] ${
                best ? "border-[1.5px] border-passionfruit-accent" : "border border-passionfruit-line"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`chip-eyebrow ${
                    best
                      ? "bg-passionfruit-wash text-passionfruit-accent"
                      : "bg-passionfruit-sunk text-passionfruit-faint"
                  }`}
                >
                  {DELIVERABLE[p.pathType]}
                </span>
                {best && (
                  <span className="text-[11px] font-semibold text-passionfruit-accent">★ best fit</span>
                )}
              </div>

              <h3 className="mt-2 font-display text-[21px] font-semibold leading-[1.2] text-passionfruit-ink">
                {p.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-[1.45] text-passionfruit-muted">{p.pitch}</p>

              {best && (
                <p className="mt-2 text-[12px] leading-[1.45] text-passionfruit-faint">
                  <span className="font-semibold text-passionfruit-muted">Why it fits: </span>
                  {p.whyThisFitsYou}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="pill">~{p.estimatedWeeks} weeks</span>
                <span className="pill">difficulty {p.difficulty}/5</span>
                <span className="pill">{PATH_TYPE_LABELS[p.pathType]}</span>
              </div>

              <p className="mt-2.5 text-[12px] text-passionfruit-faint">
                Ends in: {p.finalArtifact}
              </p>

              <div className="mt-auto pt-3.5">
                <button
                  className="btn-primary w-full"
                  disabled={pickingIdx !== null}
                  onClick={() => pick(i, p)}
                >
                  {picking ? "Building your weekly plan…" : "Choose this path →"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {paths && (
        <div className="mt-4 text-center">
          <button
            className="btn-soft text-xs"
            onClick={() => generate(true)}
            disabled={pickingIdx !== null || generating}
          >
            {generating ? "Regenerating…" : "Regenerate ideas"}
          </button>
        </div>
      )}
    </div>
  );
}
