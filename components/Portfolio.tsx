"use client";

// Running Resume: the growing record of a student's real accomplishments — the
// proof a parent can see and share. Image artifacts render as thumbnails; links
// and docs as cards. Deliverables earned from a completed checkpoint carry a
// "From a checkpoint" chip. Each piece can be flipped public, revealing a
// copyable /p/{slug} link.

import { useState } from "react";
import type { Artifact } from "@/lib/db/schema";

const KIND_LABEL: Record<string, string> = {
  image: "Image",
  document: "Document",
  code: "Code",
  link: "Link",
  other: "Work",
};

function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? "Work";
}

function isImage(a: Artifact): boolean {
  return !!a.mimeType && a.mimeType.startsWith("image/");
}

export function Portfolio({
  studentId,
  artifacts,
  canShare = false,
}: {
  studentId: string;
  artifacts: Artifact[];
  canShare?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <WhyThisHelps />

      {artifacts.length === 0 ? (
        <div className="card-sheet flex min-h-[160px] flex-col items-center justify-center text-center">
          <span className="text-2xl" aria-hidden>
            🌱
          </span>
          <p className="mt-2 max-w-xs text-[13px] text-passionfruit-muted">
            Nothing on your resume yet — add the first piece, or finish a checkpoint and
            its deliverable lands here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {artifacts.map((a) => (
            <PortfolioCard key={a.id} studentId={studentId} artifact={a} canShare={canShare} />
          ))}
        </div>
      )}
    </div>
  );
}

function WhyThisHelps() {
  return (
    <div className="rounded-sheet border border-passionfruit-accentLine bg-passionfruit-wash p-4">
      <span className="eyebrow text-passionfruit-accentInk">Why this helps</span>
      <p className="mt-1 text-[13px] leading-[1.5] text-passionfruit-body">
        This is your growing record of real accomplishments. Anything you finish from a
        checkpoint shows up here on its own — handy later for a{" "}
        <span className="text-passionfruit-accentInk">LinkedIn profile</span> or just to show
        anyone what you&apos;ve actually built.
      </p>
    </div>
  );
}

function PortfolioCard({
  studentId,
  artifact,
  canShare,
}: {
  studentId: string;
  artifact: Artifact;
  canShare: boolean;
}) {
  const [shared, setShared] = useState(artifact.shared);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shareUrl = `/p/${artifact.slug}`;

  async function toggleShared() {
    const next = !shared;
    setBusy(true);
    setError(null);
    // Optimistic — revert on failure.
    setShared(next);
    try {
      const res = await fetch("/api/artifacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifactId: artifact.id, studentId, shared: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? data?.error ?? "Could not update sharing.");
      }
    } catch (err) {
      setShared(!next);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    const abs =
      typeof window !== "undefined" ? `${window.location.origin}${shareUrl}` : shareUrl;
    try {
      await navigator.clipboard.writeText(abs);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setError("Couldn't copy — long-press the link to copy it.");
    }
  }

  return (
    <div className="card flex flex-col gap-3">
      {/* visual / preview */}
      {isImage(artifact) && artifact.url ? (
        <a href={artifact.url} target="_blank" rel="noopener noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={artifact.url}
            alt={artifact.title}
            className="h-40 w-full rounded-2xl border border-passionfruit-line object-cover"
          />
        </a>
      ) : (
        <div className="flex h-40 w-full items-center justify-center rounded-2xl border border-passionfruit-line bg-passionfruit-sunk text-3xl">
          <span aria-hidden>{artifact.kind === "code" ? "💻" : artifact.kind === "link" ? "🔗" : "📄"}</span>
        </div>
      )}

      {/* meta */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-[15px] font-semibold leading-tight text-passionfruit-ink">
          {artifact.title}
        </h3>
        <span className="pill shrink-0">{kindLabel(artifact.kind)}</span>
      </div>

      {artifact.milestoneId && (
        <span className="pill-accent w-fit" title="Earned by completing a checkpoint">
          ✓ From a checkpoint
        </span>
      )}

      {artifact.text && artifact.text !== artifact.title && (
        <p className="text-[12px] leading-[1.5] text-passionfruit-muted">{artifact.text}</p>
      )}

      {artifact.url && (
        <a
          href={artifact.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] font-semibold text-passionfruit-accentInk hover:underline"
        >
          Open ↗
        </a>
      )}

      {canShare && (
        <div className="mt-auto border-t border-passionfruit-line pt-3">
          <label className="flex cursor-pointer items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-passionfruit-body">
              {shared ? "Shared publicly" : "Share"}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={shared}
              aria-label="Share publicly"
              disabled={busy}
              onClick={toggleShared}
              className={`relative h-5 w-9 rounded-full transition disabled:opacity-50 ${
                shared ? "bg-passionfruit-accent" : "bg-passionfruit-sunk"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sheet transition-all ${
                  shared ? "left-[18px]" : "left-0.5"
                }`}
              />
            </button>
          </label>

          {shared && (
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-passionfruit-sunk px-2 py-1 text-[11px] text-passionfruit-muted">
                {shareUrl}
              </code>
              <button
                type="button"
                onClick={copyLink}
                className="btn-soft px-3 py-1.5 text-[11px]"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
          )}

          {error && (
            <p className="mt-2 text-[11px] font-medium text-passionfruit-accentInk">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
