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
}: {
  studentId: string;
  studentName: string;
  spark: string | null;
}) {
  const router = useRouter();
  const [paths, setPaths] = useState<ProjectPathCandidate[] | null>(null);
  const [generating, setGenerating] = useState(true);
  const [pickingIdx, setPickingIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/paths", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
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
    void generate();
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
    <div className="px-[18px] pb-6">
      {/* Mentor note — skeleton while generating, then the warm intro. */}
      {generating ? (
        <MentorNote loading />
      ) : (
        <MentorNote>
          Hi {studentName} — I found <Spark>three paths</Spark> that fit how you think
          {spark ? ` about ${spark}` : ""}. Pick the one that sparks something.
        </MentorNote>
      )}

      <div className="px-0.5 pb-2.5 pt-[18px]">
        <span className="eyebrow">Your paths · picked for you</span>
      </div>

      {error && (
        <div className="card mb-3">
          <p className="text-[13px] text-passionfruit-accentInk">{error}</p>
          <button className="btn-ghost mt-3 text-xs" onClick={generate}>
            Try again
          </button>
        </div>
      )}

      {generating && !paths && (
        <div className="flex flex-col gap-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="card h-[132px] animate-pulse" />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {paths?.map((p, i) => {
          const best = i === 0;
          const picking = pickingIdx === i;
          return (
            <div
              key={i}
              className={`rounded-[20px] bg-passionfruit-card p-[15px] ${
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

              <button
                className="btn-primary mt-3.5 w-full"
                disabled={pickingIdx !== null}
                onClick={() => pick(i, p)}
              >
                {picking ? "Building your weekly plan…" : "Choose this path →"}
              </button>
            </div>
          );
        })}
      </div>

      {paths && (
        <div className="mt-4 text-center">
          <button className="btn-soft text-xs" onClick={generate} disabled={pickingIdx !== null}>
            Regenerate ideas
          </button>
        </div>
      )}
    </div>
  );
}
