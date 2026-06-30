"use client";

// Full-screen "checkpoint detail" view (opened by double-clicking a checkpoint
// box on the project timeline board). Lazily fetches the AI-generated
// mini-curriculum for the milestone (POST /api/checkpoint — slow the first
// time, cached after), then renders a TYPE-ADAPTIVE detail: rationale in the
// serif mentor voice, real resources, a step-by-step guide, and a defined
// deliverable the student can add to their resume.
//
// Style follows DESIGN.md "Warm Paper": cream paper, soft cards, one confident
// coral accent, serif display for warmth. Loading is a warm mentor-note
// skeleton — never a spinner.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CHECKPOINT_TYPE_LABELS,
  type CheckpointDetail as CheckpointDetailData,
  type CheckpointDifficulty,
  type CheckpointResource,
} from "@/lib/types";
import { ResearchAccelerator } from "@/components/ResearchAccelerator";

const DIFFICULTY_LABELS: Record<CheckpointDifficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

const RESOURCE_KIND_ICON: Record<CheckpointResource["kind"], string> = {
  course: "🎓",
  video: "▶️",
  dataset: "📊",
  tool: "🛠️",
  reading: "📖",
  other: "🔗",
};

/** Maps a deliverable kind → the artifact "kind" accepted by /api/artifacts. */
function artifactKindFor(detail: CheckpointDetailData): "image" | "document" | "code" | "link" | "other" {
  switch (detail.deliverableKind) {
    case "image":
      return "image";
    case "repo":
      return "code";
    case "paper":
    case "certificate":
      return "document";
    case "link":
      return "link";
    default:
      return "other";
  }
}

export function CheckpointDetail({
  milestoneId,
  studentId,
  title,
  onClose,
}: {
  milestoneId: string;
  studentId: string;
  title: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<CheckpointDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(
    async (force: boolean) => {
      setError(null);
      if (force) setRegenerating(true);
      else setLoading(true);
      try {
        const res = await fetch("/api/checkpoint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ milestoneId, force }),
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = (await res.json()) as { detail: CheckpointDetailData; cached: boolean };
        setDetail(data.detail);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setLoading(false);
        setRegenerating(false);
      }
    },
    [milestoneId],
  );

  // Fetch on open.
  useEffect(() => {
    void load(false);
  }, [load]);

  // Esc to close + focus management.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    // Lock background scroll while the overlay is open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto p-4 sm:p-8"
      style={{ background: "rgba(44,36,32,.42)", backdropFilter: "blur(2px)" }}
      role="dialog"
      aria-modal="true"
      aria-label={`Checkpoint: ${title}`}
      onMouseDown={(e) => {
        // Backdrop click (not a click inside the sheet) closes.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="my-auto w-full max-w-3xl rounded-sheet border border-passionfruit-line bg-passionfruit-paper shadow-frame">
        {/* sticky header */}
        <div className="sticky top-0 z-10 flex items-start gap-3 rounded-t-sheet border-b border-passionfruit-line bg-passionfruit-paper/95 px-6 py-4 backdrop-blur">
          <div className="min-w-0 flex-1">
            <div className="eyebrow mb-1.5">Checkpoint</div>
            <h2 className="font-display text-[26px] font-semibold leading-[1.1] tracking-[-0.2px] text-passionfruit-ink">
              {title}
            </h2>
            {detail && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <span className="chip-eyebrow bg-passionfruit-wash text-passionfruit-accentInk">
                  {CHECKPOINT_TYPE_LABELS[detail.type]}
                </span>
                <DifficultyPill difficulty={detail.difficulty} />
              </div>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-passionfruit-line bg-passionfruit-card text-[18px] text-passionfruit-muted transition hover:bg-passionfruit-sunk focus:outline-none focus:ring-4 focus:ring-passionfruit-wash"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-6">
          {loading && <LoadingState />}

          {!loading && error && (
            <div className="card-sheet">
              <p className="text-[14px] text-passionfruit-body">
                Couldn’t load this checkpoint. {error}
              </p>
              <button type="button" className="btn-soft mt-3" onClick={() => load(false)}>
                Try again
              </button>
            </div>
          )}

          {!loading && !error && detail && (
            <div className="space-y-7">
              {/* rationale — mentor voice */}
              <section>
                <div className="rounded-sheet border border-passionfruit-line bg-passionfruit-card p-5 shadow-sheet">
                  <div className="eyebrow mb-2">Why this checkpoint, for you</div>
                  <p className="mentor-voice">{detail.description}</p>
                </div>
              </section>

              {/* resources */}
              {detail.resources.length > 0 && (
                <section>
                  <SectionHeading>Resources</SectionHeading>
                  <ul className="mt-3 space-y-2.5">
                    {detail.resources.map((r, i) => (
                      <li key={i}>
                        <a
                          href={r.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex gap-3 rounded-card border border-passionfruit-line bg-passionfruit-card p-3.5 transition hover:border-passionfruit-accentLine hover:shadow-sheet"
                        >
                          <span className="text-[20px] leading-none" aria-hidden>
                            {RESOURCE_KIND_ICON[r.kind]}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="font-display text-[15px] font-semibold text-passionfruit-ink group-hover:text-passionfruit-accentInk">
                                {r.title}
                              </span>
                              <span className="pill">{r.provider}</span>
                              <span className="chip-eyebrow bg-passionfruit-sunk text-passionfruit-muted">
                                {r.kind}
                              </span>
                            </span>
                            {r.note && (
                              <span className="mt-1 block text-[13px] leading-[1.5] text-passionfruit-muted">
                                {r.note}
                              </span>
                            )}
                          </span>
                          <span
                            className="flex-none self-center text-[14px] text-passionfruit-faint transition group-hover:text-passionfruit-accentInk"
                            aria-hidden
                          >
                            ↗
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* type-adaptive: research vs. generic guide + deliverable */}
              {detail.type === "research" ? (
                <ResearchAccelerator
                  milestoneId={milestoneId}
                  studentId={studentId}
                  detail={detail}
                />
              ) : (
                <>
                  {detail.steps.length > 0 && (
                    <section>
                      <SectionHeading>Step-by-step guide</SectionHeading>
                      <ol className="mt-3 space-y-3">
                        {detail.steps.map((s, i) => (
                          <li key={i} className="flex gap-3.5">
                            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-passionfruit-wash text-[12px] font-bold text-passionfruit-accentInk">
                              {i + 1}
                            </span>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <div className="font-display text-[15px] font-semibold text-passionfruit-ink">
                                {s.title}
                              </div>
                              {s.detail && (
                                <p className="mt-1 text-[13.5px] leading-[1.55] text-passionfruit-body">
                                  {s.detail}
                                </p>
                              )}
                              {s.resourceUrl && (
                                <a
                                  href={s.resourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-semibold text-passionfruit-accentInk hover:underline"
                                >
                                  Open resource ↗
                                </a>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </section>
                  )}

                  <DeliverableSection
                    detail={detail}
                    milestoneId={milestoneId}
                    studentId={studentId}
                    defaultTitle={title}
                  />
                </>
              )}

              {/* footer actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-passionfruit-line pt-5">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => load(true)}
                  disabled={regenerating}
                >
                  {regenerating ? "Regenerating…" : "↻ Regenerate"}
                </button>
                <button type="button" className="btn-soft" onClick={onClose}>
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display text-[17px] font-semibold text-passionfruit-ink">{children}</h3>
  );
}

function DifficultyPill({ difficulty }: { difficulty: CheckpointDifficulty }) {
  const dots = difficulty === "beginner" ? 1 : difficulty === "intermediate" ? 2 : 3;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-passionfruit-sunk px-2.5 py-1 text-[11px] font-bold text-passionfruit-muted">
      <span className="flex items-center gap-0.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: i < dots ? "#E8694A" : "#E0D3C2" }}
          />
        ))}
      </span>
      {DIFFICULTY_LABELS[difficulty]}
    </span>
  );
}

function LoadingState() {
  return (
    <div className="space-y-7">
      <div className="rounded-sheet border border-passionfruit-line bg-passionfruit-card p-5 shadow-sheet">
        <div className="mb-3 flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[16px]"
            style={{ background: "linear-gradient(140deg,#F2B23E,#E8694A)" }}
            aria-hidden
          >
            🌱
          </span>
          <div>
            <div className="text-[13px] font-bold text-passionfruit-ink">
              Sage is building this checkpoint
            </div>
            <div className="text-[11px] text-passionfruit-faint">
              Finding the right resources for you — this takes a moment the first time.
            </div>
          </div>
        </div>
        <div className="space-y-2" aria-label="Loading">
          <div className="h-4 w-[92%] animate-pulse rounded bg-passionfruit-sunk" />
          <div className="h-4 w-[80%] animate-pulse rounded bg-passionfruit-sunk" />
          <div className="h-4 w-[60%] animate-pulse rounded bg-passionfruit-sunk" />
        </div>
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded-card border border-passionfruit-line bg-passionfruit-card"
          />
        ))}
      </div>
    </div>
  );
}

function DeliverableSection({
  detail,
  milestoneId,
  studentId,
  defaultTitle,
}: {
  detail: CheckpointDetailData;
  milestoneId: string;
  studentId: string;
  defaultTitle: string;
}) {
  const [mode, setMode] = useState<"link" | "file">("link");
  const [linkUrl, setLinkUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [artifactTitle, setArtifactTitle] = useState(defaultTitle);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kind = artifactKindFor(detail);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === "link" && !linkUrl.trim()) {
      setError("Paste a link to your deliverable.");
      return;
    }
    if (mode === "file" && !file) {
      setError("Choose a file to add.");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("studentId", studentId);
      form.append("milestoneId", milestoneId);
      form.append("title", artifactTitle.trim() || defaultTitle);
      // For a link deliverable, force kind=link; otherwise use the mapped kind.
      form.append("kind", mode === "link" ? "link" : kind);
      if (mode === "link") form.append("linkUrl", linkUrl.trim());
      else if (file) form.append("file", file);

      const res = await fetch("/api/artifacts", { method: "POST", body: form });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      await res.json();
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t add to your resume.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <SectionHeading>Your deliverable</SectionHeading>
      <div className="mt-3 rounded-sheet border border-passionfruit-accentLine bg-passionfruit-wash p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip-eyebrow bg-passionfruit-card text-passionfruit-accentInk">
            {detail.deliverableKind}
          </span>
          <span className="text-[12px] font-semibold text-passionfruit-accentInk">
            adds to your resume
          </span>
        </div>
        <p className="mt-2.5 text-[14px] leading-[1.55] text-passionfruit-body">
          {detail.deliverableSpec}
        </p>

        {done ? (
          <div className="mt-4 flex items-center gap-2.5 rounded-card border border-passionfruit-accentLine bg-passionfruit-card p-3.5">
            <span
              className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] text-white"
              style={{ background: "linear-gradient(150deg,#E8694A,#D4533A)" }}
              aria-hidden
            >
              ✓
            </span>
            <p className="mentor-voice text-[15px]">
              Nice — that’s on your{" "}
              <span className="text-passionfruit-accentInk">resume</span> now.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <div className="flex gap-2" role="tablist" aria-label="Deliverable source">
              <ModeTab active={mode === "link"} onClick={() => setMode("link")}>
                Paste a link
              </ModeTab>
              <ModeTab active={mode === "file"} onClick={() => setMode("file")}>
                Upload a file
              </ModeTab>
            </div>

            <div>
              <label className="label" htmlFor="artifact-title">
                Title
              </label>
              <input
                id="artifact-title"
                className="input"
                value={artifactTitle}
                onChange={(e) => setArtifactTitle(e.target.value)}
                placeholder={defaultTitle}
              />
            </div>

            {mode === "link" ? (
              <div>
                <label className="label" htmlFor="artifact-link">
                  Link
                </label>
                <input
                  id="artifact-link"
                  type="url"
                  className="input"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>
            ) : (
              <div>
                <label className="label" htmlFor="artifact-file">
                  File
                </label>
                <input
                  id="artifact-file"
                  type="file"
                  className="input file:mr-3 file:rounded-full file:border-0 file:bg-passionfruit-sunk file:px-3 file:py-1 file:text-[12px] file:font-bold file:text-passionfruit-muted"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
            )}

            {error && <p className="text-[13px] text-passionfruit-accentInk">{error}</p>}

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Adding…" : "Add to resume"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
        active
          ? "bg-passionfruit-card text-passionfruit-accentInk shadow-sheet"
          : "bg-transparent text-passionfruit-muted hover:bg-passionfruit-card/60"
      }`}
    >
      {children}
    </button>
  );
}
