"use client";

import { useState } from "react";
import type { ParentSummary } from "@/lib/types";

export function ParentSummaryCard({ studentId }: { studentId: string }) {
  const [summary, setSummary] = useState<ParentSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/parent-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Could not generate summary");
      setSummary(data.summary);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Parent summary</h2>
        <button className="btn-ghost px-3 py-1.5 text-xs" onClick={generate} disabled={loading}>
          {loading ? "Writing…" : summary ? "Refresh" : "Generate"}
        </button>
      </div>

      {!summary && !loading && (
        <p className="mt-2 text-sm text-slate-500">
          An AI-written, parent-facing note on who your child is becoming and how to
          support it. {/* TODO(seam): email delivery — on screen only for now. */}
        </p>
      )}

      {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {summary && (
        <div className="mt-3">
          <p className="font-medium text-slate-800">{summary.headline}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{summary.body}</p>
          {summary.suggestedActions.length > 0 && (
            <ul className="mt-3 space-y-1">
              {summary.suggestedActions.map((a, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-700">
                  <span className="text-brand-500">→</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
