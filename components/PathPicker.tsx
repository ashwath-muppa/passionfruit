"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PATH_TYPE_LABELS, type ProjectPathCandidate } from "@/lib/types";

export function PathPicker({ studentId }: { studentId: string }) {
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

  if (generating) {
    return (
      <div className="card mt-6 text-center text-slate-500">
        <p className="animate-pulse">Sage is designing project paths from the learner graph…</p>
        <p className="mt-1 text-xs">This uses the quality model and can take a few seconds.</p>
      </div>
    );
  }

  if (error && !paths) {
    return (
      <div className="card mt-6">
        <p className="text-sm text-red-700">{error}</p>
        <button className="btn-ghost mt-3" onClick={generate}>Try again</button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {paths?.map((p, i) => (
        <div key={i} className="card">
          <div className="flex items-center justify-between">
            <span className="pill bg-brand-100 text-brand-800">{PATH_TYPE_LABELS[p.pathType]}</span>
            <span className="text-xs text-slate-400">
              ~{p.estimatedWeeks} weeks · difficulty {p.difficulty}/5
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold">{p.title}</h3>
          <p className="mt-1 text-sm text-slate-700">{p.pitch}</p>
          <p className="mt-3 text-sm text-slate-500">
            <span className="font-medium text-slate-600">Why this fits you: </span>
            {p.whyThisFitsYou}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            <span className="font-medium text-slate-600">You&apos;ll end up with: </span>
            {p.finalArtifact}
          </p>
          <button
            className="btn-primary mt-4"
            disabled={pickingIdx !== null}
            onClick={() => pick(i, p)}
          >
            {pickingIdx === i ? "Building your weekly plan…" : "Choose this path"}
          </button>
        </div>
      ))}

      <div className="text-center">
        <button className="btn-ghost" onClick={generate} disabled={pickingIdx !== null}>
          Regenerate ideas
        </button>
      </div>
    </div>
  );
}
