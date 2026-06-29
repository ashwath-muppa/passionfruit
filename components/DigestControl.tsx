"use client";

// Parent digest control (#8). Two soft buttons under the on-screen parent note:
// email this month's growth narrative, or send a light weekly support nudge.
// After a send, a warm status line reflects the channel actually used — "Sent ✓"
// when an email provider is configured, or "shown here" when it degraded to the
// on-screen fallback. Compact, Warm Paper styling.

import { useState } from "react";

type Kind = "monthly" | "weekly";
type Channel = "email" | "onscreen";

interface SendState {
  kind: Kind;
  channel: Channel;
}

function formatLastSent(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function DigestControl({
  studentId,
  studentName,
  lastSent,
}: {
  studentId: string;
  studentName: string;
  lastSent?: string | null;
}) {
  const [pending, setPending] = useState<Kind | null>(null);
  const [result, setResult] = useState<SendState | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(kind: Kind) {
    setPending(kind);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, kind }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Could not send");
      setResult({ kind, channel: data.channel as Channel });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(null);
    }
  }

  const lastSentLabel = lastSent ? formatLastSent(lastSent) : null;

  return (
    <div className="rounded-sheet border border-passionfruit-accentLine bg-passionfruit-wash p-4">
      <div className="mb-1 text-[13px] font-bold text-passionfruit-ink">
        Send it to your inbox
      </div>
      <p className="text-[12px] leading-relaxed text-passionfruit-muted">
        Get {studentName}&apos;s growth note by email, plus a light weekly nudge with one small
        way to cheer them on.
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => send("monthly")}
          disabled={pending !== null}
          className="btn-soft text-xs disabled:opacity-60"
        >
          {pending === "monthly" ? "Sending…" : "Email this month's note"}
        </button>
        <button
          onClick={() => send("weekly")}
          disabled={pending !== null}
          className="btn-soft text-xs disabled:opacity-60"
        >
          {pending === "weekly" ? "Sending…" : "Weekly support nudge"}
        </button>
      </div>

      {result && (
        <p className="mt-2.5 text-[12px] font-semibold text-passionfruit-accentInk">
          {result.channel === "email"
            ? "Sent ✓ to your inbox"
            : "Ready (email not configured — shown here)"}
        </p>
      )}
      {error && <p className="mt-2.5 text-[12px] text-passionfruit-accentInk">{error}</p>}
      {!result && !error && lastSentLabel && (
        <p className="mt-2.5 text-[12px] text-passionfruit-faint">Last sent {lastSentLabel}</p>
      )}
    </div>
  );
}
