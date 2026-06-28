"use client";

import { useState } from "react";
import type { ParentSummary } from "@/lib/types";
import { MentorNote, Spark } from "@/components/MentorNote";

// Parent-facing mentor note (DESIGN.md §6 parent variant): warm body that ends
// in one concrete support action. Generated on demand.
export function ParentSummaryCard({
  studentId,
  studentFirstName,
}: {
  studentId: string;
  studentFirstName: string;
}) {
  const title = `A note for ${studentFirstName}'s family`;
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

  if (loading) return <MentorNote variant="parent" title={title} loading />;

  if (summary) {
    const action = summary.suggestedActions[0];
    return (
      <div className="relative">
        <MentorNote variant="parent" title={title}>
          {summary.body}
          {action && (
            <>
              {" "}
              <Spark>{action}</Spark>
            </>
          )}
        </MentorNote>
        <button
          onClick={generate}
          className="absolute right-3 top-3 text-[11px] font-semibold text-passionfruit-accentInk hover:underline"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-sheet border border-passionfruit-accentLine bg-passionfruit-wash p-4">
      <div className="mb-2 text-[13px] font-bold text-passionfruit-ink">{title}</div>
      <p className="text-[13px] leading-relaxed text-passionfruit-muted">
        A warm, parent-facing note on who your child is becoming and one concrete way to support
        them this week.
      </p>
      {error && <p className="mt-2 text-[12px] text-passionfruit-accentInk">{error}</p>}
      <button onClick={generate} className="btn-primary mt-3 text-xs">
        Write this week&apos;s note
      </button>
    </div>
  );
}
