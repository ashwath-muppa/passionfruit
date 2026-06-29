"use client";

// Intersection-Narrative card (#10, Passionfruit's signature move). For a
// multi-interest kid, fuses 2–3 interests into ONE signature theme aimed at the
// real venue the family chose — so the kid becomes "the only person with THIS
// combination." The student's interests are the route; the family picks the
// destination. Rendered as a mentor moment, never a chatbot.

import { useState } from "react";
import { MentorNote, Spark, MENTOR_NAME } from "@/components/MentorNote";
import { hueForCategory } from "@/lib/ui";
import type { IntersectionResult } from "@/lib/ai/intersection";

// Split a sentence so we can wrap its tail in <Spark> (the one accent phrase).
// Keeps the first sentence plain and sparks the rest, falling back gracefully.
function withSpark(pitch: string) {
  const trimmed = pitch.trim();
  const m = trimmed.match(/^(.*?[.!?])\s+(.+)$/s);
  if (!m || !m[1] || !m[2]) return { head: trimmed, spark: null as string | null };
  return { head: m[1], spark: m[2] };
}

export function IntersectionCard({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IntersectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function discover() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/intersection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      if (res.status === 429) {
        throw new Error(`${MENTOR_NAME} is taking a breather — try again in a minute.`);
      }
      if (!res.ok) {
        // Never surface raw internal errors to a parent — keep it warm + generic.
        throw new Error(`${MENTOR_NAME} couldn't shape a theme just now — try again in a moment.`);
      }
      const { intersection } = (await res.json()) as { intersection: IntersectionResult };
      setResult(intersection);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `${MENTOR_NAME} is taking a breather — try again in a minute.`,
      );
    } finally {
      setLoading(false);
    }
  }

  // Loading: a soft skeleton of the mentor note itself.
  if (loading) return <MentorNote loading />;

  // Error: warm, recoverable.
  if (error) {
    return (
      <div className="card border-passionfruit-accentLine">
        <span className="eyebrow">{studentName}&apos;s signature theme</span>
        <p className="mentor-voice mt-2 text-passionfruit-body">{error}</p>
        <button onClick={discover} className="btn-soft mt-3 text-xs">
          Try again →
        </button>
      </div>
    );
  }

  // Result: the signature theme as a mentor moment.
  if (result) {
    const { head, spark } = withSpark(result.pitch);
    return (
      <MentorNote title={`${studentName}'s signature theme`}>
        <h3 className="font-display text-[19px] font-semibold leading-tight text-passionfruit-ink">
          {result.theme}
        </h3>

        <p className="mt-2 text-passionfruit-body">
          {head}
          {spark && (
            <>
              {" "}
              <Spark>{spark}</Spark>
            </>
          )}
        </p>

        {result.interests.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {result.interests.map((label, i) => {
              const hue = hueForCategory(label);
              return (
                <span
                  key={`${label}-${i}`}
                  className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                  style={{
                    background: hue.pillBg,
                    color: hue.pillFg,
                    borderColor: hue.pillBorder,
                  }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        )}

        <p className="mt-3 text-[12px] font-semibold text-passionfruit-accentInk">
          Aim at: <span className="text-passionfruit-body">{result.suggestedVenue}</span>
        </p>

        <p className="mt-1.5 text-[12px] leading-[1.5] text-passionfruit-muted">
          {result.whyUnique}
        </p>

        <button onClick={discover} className="btn-soft mt-3 text-xs">
          Try another fusion →
        </button>
      </MentorNote>
    );
  }

  // Initial: invite the family to discover the theme.
  return (
    <div className="card border-passionfruit-accentLine">
      <span className="eyebrow">{studentName}&apos;s signature theme</span>
      <p className="mt-1.5 text-[13px] leading-relaxed text-passionfruit-muted">
        {MENTOR_NAME} fuses {studentName}&apos;s interests into one signature theme — pointed at the
        real goal your family chose. You stay the guide; {MENTOR_NAME} maps the route.
      </p>
      <button onClick={discover} className="btn-primary mt-3.5 text-xs">
        Discover the theme →
      </button>
    </div>
  );
}
