"use client";

// Research Accelerator — a guided three-stage walkthrough of the research
// process for research-type checkpoints (DESIGN.md · Warm Paper). It rides the
// checkpoint data model: research working state (question / sources / outline)
// persists via PATCH /api/checkpoint, and the finished paper is submitted as the
// deliverable via POST /api/artifacts so it lands on the running resume.
//
// Stage 1 — lock a research QUESTION (AI steps are the prompts).
// Stage 2 — build a LITERATURE REVIEW (annotated sources).
// Stage 3 — outline + submit the PAPER (link or file).

import { useMemo, useRef, useState } from "react";
import type { CheckpointDetail, ResearchState } from "@/lib/types";

type Stage = 1 | 2 | 3;

const EMPTY: ResearchState = { question: null, sources: [], outline: [] };

const STAGES: { n: Stage; eyebrow: string; label: string }[] = [
  { n: 1, eyebrow: "Stage 1", label: "Your question" },
  { n: 2, eyebrow: "Stage 2", label: "Literature review" },
  { n: 3, eyebrow: "Stage 3", label: "Draft & submit" },
];

export function ResearchAccelerator(props: {
  milestoneId: string;
  studentId: string;
  detail: CheckpointDetail;
}): React.JSX.Element {
  const { milestoneId, studentId, detail } = props;
  const initial = detail.research ?? EMPTY;

  const [stage, setStage] = useState<Stage>(initial.question ? 2 : 1);

  // ── Working state (mirrors ResearchState) ──────────────────────────────────
  const [question, setQuestion] = useState<string>(initial.question ?? "");
  const [sources, setSources] = useState<ResearchState["sources"]>(initial.sources ?? []);
  const [outline, setOutline] = useState<string[]>(initial.outline ?? []);

  // Draft inputs for adding a source.
  const [srcTitle, setSrcTitle] = useState("");
  const [srcUrl, setSrcUrl] = useState("");
  const [srcNote, setSrcNote] = useState("");
  const [newSection, setNewSection] = useState("");

  // Save state.
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Submit (deliverable) state.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitMode, setSubmitMode] = useState<"link" | "file">("link");
  const [paperTitle, setPaperTitle] = useState("");
  const [paperLink, setPaperLink] = useState("");
  const [paperFileName, setPaperFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const trimmedQuestion = question.trim();
  const questionLocked = (initial.question ?? "").trim().length > 0 || trimmedQuestion.length > 0;

  // The AI steps double as research prompts; pull two as gentle nudges.
  const prompts = useMemo(() => detail.steps.slice(0, 3), [detail.steps]);

  // Persist the current working state. Called on blur / explicit Save / mutate.
  async function persist(next?: Partial<ResearchState>) {
    const research: ResearchState = {
      question: (next?.question !== undefined ? next.question : trimmedQuestion) || null,
      sources: next?.sources ?? sources,
      outline: next?.outline ?? outline,
    };
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/checkpoint", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestoneId, research }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? data?.error ?? "Couldn't save. Try again.");
      }
      setSavedAt(Date.now());
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function addSource() {
    const title = srcTitle.trim();
    if (!title) return;
    const entry: ResearchState["sources"][number] = { title };
    if (srcUrl.trim()) entry.url = srcUrl.trim();
    if (srcNote.trim()) entry.note = srcNote.trim();
    const nextSources = [...sources, entry];
    setSources(nextSources);
    setSrcTitle("");
    setSrcUrl("");
    setSrcNote("");
    void persist({ sources: nextSources });
  }

  function removeSource(idx: number) {
    const nextSources = sources.filter((_, i) => i !== idx);
    setSources(nextSources);
    void persist({ sources: nextSources });
  }

  function addSection() {
    const sec = newSection.trim();
    if (!sec) return;
    const nextOutline = [...outline, sec];
    setOutline(nextOutline);
    setNewSection("");
    void persist({ outline: nextOutline });
  }

  function updateSection(idx: number, value: string) {
    setOutline((o) => o.map((s, i) => (i === idx ? value : s)));
  }

  function removeSection(idx: number) {
    const nextOutline = outline.filter((_, i) => i !== idx);
    setOutline(nextOutline);
    void persist({ outline: nextOutline });
  }

  async function submitPaper(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const title = paperTitle.trim() || (trimmedQuestion ? trimmedQuestion : "My research paper");

    const fd = new FormData();
    fd.set("studentId", studentId);
    fd.set("milestoneId", milestoneId);
    fd.set("title", title);

    if (submitMode === "file") {
      const file = fileInputRef.current?.files?.[0];
      if (!file) {
        setSubmitError("Choose your paper file to submit it.");
        return;
      }
      fd.set("kind", "document");
      fd.set("file", file);
    } else {
      if (!paperLink.trim()) {
        setSubmitError("Paste a link to your paper to submit it.");
        return;
      }
      fd.set("kind", "link");
      fd.set("linkUrl", paperLink.trim());
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/artifacts", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message ?? data?.error ?? "Couldn't submit your paper. Try again.");
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-[22px]">
      {/* ── Header: what this checkpoint is + the goal ── */}
      <div className="card-sheet">
        <span className="eyebrow">Research accelerator</span>
        <h2 className="mt-1 font-display text-[22px] font-semibold leading-tight text-passionfruit-ink">
          Let&apos;s turn a curiosity into a real paper
        </h2>
        <p className="mt-2 text-[13px] leading-[1.5] text-passionfruit-body">{detail.description}</p>
        {detail.deliverableSpec && (
          <div className="mt-3 rounded-2xl bg-passionfruit-wash px-3.5 py-2.5">
            <span className="eyebrow text-passionfruit-accentInk">What you&apos;ll hand in</span>
            <p className="mt-0.5 text-[12.5px] leading-[1.5] text-passionfruit-accentInk">
              {detail.deliverableSpec}
            </p>
          </div>
        )}
      </div>

      {/* ── 3-step progress indicator ── */}
      <div className="card">
        <span className="eyebrow">Your path</span>
        <div className="mt-2.5 flex gap-2.5">
          {STAGES.map((s) => {
            const active = s.n === stage;
            const done = s.n < stage;
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => setStage(s.n)}
                className={`flex flex-1 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-passionfruit-accent bg-passionfruit-wash"
                    : "border-passionfruit-line bg-passionfruit-card hover:border-passionfruit-accentLine"
                }`}
              >
                <span
                  className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-[12px] font-extrabold ${
                    active
                      ? "bg-passionfruit-accent text-white"
                      : done
                        ? "bg-passionfruit-gold/80 text-white"
                        : "bg-passionfruit-sunk text-passionfruit-faint"
                  }`}
                >
                  {done ? "✓" : s.n}
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-[1px] text-passionfruit-faint">
                    {s.eyebrow}
                  </span>
                  <span
                    className={`block truncate text-[13px] font-bold ${
                      active ? "text-passionfruit-accentInk" : "text-passionfruit-body"
                    }`}
                  >
                    {s.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-passionfruit-faint">
          {saving ? (
            <span>Saving…</span>
          ) : saveError ? (
            <span className="text-passionfruit-accentInk">{saveError}</span>
          ) : savedAt ? (
            <span>Saved — your work is safe.</span>
          ) : (
            <span>Your progress saves as you go.</span>
          )}
        </div>
      </div>

      {/* ── Research aids: the real resources ── */}
      {detail.resources.length > 0 && (
        <div className="card">
          <span className="eyebrow">Research aids · real links</span>
          <div className="mt-3 flex flex-col gap-2.5">
            {detail.resources.map((r, i) => (
              <a
                key={`${r.url}-${i}`}
                href={r.url}
                target="_blank"
                rel="noreferrer"
                className="group block rounded-2xl border border-passionfruit-line bg-passionfruit-card px-3.5 py-2.5 transition hover:border-passionfruit-accentLine hover:bg-passionfruit-wash/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-passionfruit-ink group-hover:text-passionfruit-accentInk">
                    {r.title}
                  </span>
                  <span className="pill flex-none capitalize">{r.kind}</span>
                </div>
                <p className="mt-0.5 text-[11.5px] leading-snug text-passionfruit-muted">{r.note}</p>
                <span className="meta mt-1 block">{r.provider}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ───────────────────────── STAGE 1 — QUESTION ───────────────────────── */}
      {stage === 1 && (
        <div className="card-sheet">
          <span className="eyebrow">Stage 1 · Your question</span>
          <h3 className="mt-1 font-display text-[18px] font-semibold text-passionfruit-ink">
            What do you really want to find out?
          </h3>
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-passionfruit-muted">
            A great research question is specific and open — something a quick search can&apos;t
            just answer. Brainstorm freely, then lock the one that sparks something.
          </p>

          {prompts.length > 0 && (
            <div className="mt-3.5 rounded-2xl bg-passionfruit-sunk px-3.5 py-3">
              <span className="eyebrow">Prompts from Sage</span>
              <ul className="mt-2 flex flex-col gap-2">
                {prompts.map((p, i) => (
                  <li key={i} className="text-[12.5px] leading-snug text-passionfruit-body">
                    <span className="font-bold text-passionfruit-ink">{p.title}.</span>{" "}
                    {p.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <label className="label" htmlFor="ra-question">
              Your research question
            </label>
            <textarea
              id="ra-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onBlur={() => void persist({ question: trimmedQuestion || null })}
              placeholder="e.g. How does sleep on school nights affect 7th-graders' test scores?"
              rows={3}
              className="input resize-none leading-[1.5]"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!trimmedQuestion || saving}
              onClick={async () => {
                await persist({ question: trimmedQuestion || null });
                setStage(2);
              }}
              className="btn-primary disabled:!bg-none disabled:!bg-passionfruit-sunk disabled:!text-passionfruit-faint disabled:!shadow-none"
            >
              {questionLocked ? "Lock it in → Literature review" : "Lock my question →"}
            </button>
            <span className="text-[11px] text-passionfruit-faint">
              You can always come back and refine it.
            </span>
          </div>
        </div>
      )}

      {/* ─────────────────────── STAGE 2 — LIT REVIEW ──────────────────────── */}
      {stage === 2 && (
        <div className="card-sheet">
          <span className="eyebrow">Stage 2 · Literature review</span>
          <h3 className="mt-1 font-display text-[18px] font-semibold text-passionfruit-ink">
            Gather what others already know
          </h3>
          {trimmedQuestion && (
            <p className="mentor-voice mt-2 !text-[15px]">
              You&apos;re investigating: <span className="text-passionfruit-accentInk">{trimmedQuestion}</span>
            </p>
          )}
          <p className="mt-2 text-[12.5px] leading-[1.5] text-passionfruit-muted">
            Find a few solid sources — an article, a video, a dataset. For each, jot one note on
            what it tells you. Aim for three to start.
          </p>

          {/* Source list */}
          {sources.length > 0 ? (
            <ul className="mt-3.5 flex flex-col gap-2.5">
              {sources.map((s, i) => (
                <li
                  key={i}
                  className="rounded-2xl border border-passionfruit-line bg-passionfruit-card px-3.5 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {s.url ? (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[13px] font-bold text-passionfruit-ink underline-offset-2 hover:text-passionfruit-accentInk hover:underline"
                        >
                          {s.title}
                        </a>
                      ) : (
                        <span className="text-[13px] font-bold text-passionfruit-ink">{s.title}</span>
                      )}
                      {s.note && (
                        <p className="mt-1 text-[12px] leading-snug text-passionfruit-muted">{s.note}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSource(i)}
                      className="flex-none text-[11px] font-bold text-passionfruit-faint hover:text-passionfruit-accentInk"
                      aria-label={`Remove ${s.title}`}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3.5 rounded-2xl bg-passionfruit-sunk px-3.5 py-3 text-[12.5px] text-passionfruit-muted">
              No sources yet — add your first one below.
            </p>
          )}

          {/* Add a source */}
          <div className="mt-4 rounded-2xl border border-passionfruit-line bg-passionfruit-paper/60 p-3.5">
            <span className="eyebrow">Add a source</span>
            <div className="mt-2.5 flex flex-col gap-2.5">
              <input
                type="text"
                value={srcTitle}
                onChange={(e) => setSrcTitle(e.target.value)}
                placeholder="Title — e.g. “Sleep & Memory in Teens” (Nature, 2021)"
                className="input"
                maxLength={160}
              />
              <input
                type="url"
                inputMode="url"
                value={srcUrl}
                onChange={(e) => setSrcUrl(e.target.value)}
                placeholder="Link (optional) — https://…"
                className="input"
              />
              <textarea
                value={srcNote}
                onChange={(e) => setSrcNote(e.target.value)}
                placeholder="Your note — what does this source tell you?"
                rows={2}
                className="input resize-none leading-[1.5]"
              />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={addSource}
                  disabled={!srcTitle.trim()}
                  className="btn-soft disabled:opacity-50"
                >
                  + Add source
                </button>
                <span className="text-[11px] text-passionfruit-faint">
                  {sources.length} gathered
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => setStage(1)} className="btn-ghost">
              ‹ Back
            </button>
            <button type="button" onClick={() => setStage(3)} className="btn-primary">
              Next → Draft your paper
            </button>
          </div>
        </div>
      )}

      {/* ───────────────────── STAGE 3 — OUTLINE + SUBMIT ──────────────────── */}
      {stage === 3 && (
        <div className="card-sheet">
          <span className="eyebrow">Stage 3 · Draft &amp; submit</span>
          <h3 className="mt-1 font-display text-[18px] font-semibold text-passionfruit-ink">
            Outline it, write it, hand it in
          </h3>
          <p className="mt-1.5 text-[12.5px] leading-[1.5] text-passionfruit-muted">
            Sketch your sections first — that&apos;s your skeleton. Then write the paper in your
            doc, and submit the link or file here to add it to your resume.
          </p>

          {/* Outline */}
          <div className="mt-4">
            <span className="eyebrow">Paper outline</span>
            {outline.length > 0 ? (
              <ol className="mt-2.5 flex flex-col gap-2">
                {outline.map((sec, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-passionfruit-sunk text-[11px] font-bold text-passionfruit-muted">
                      {i + 1}
                    </span>
                    <input
                      type="text"
                      value={sec}
                      onChange={(e) => updateSection(i, e.target.value)}
                      onBlur={() => void persist()}
                      className="input flex-1"
                      maxLength={160}
                    />
                    <button
                      type="button"
                      onClick={() => removeSection(i)}
                      className="flex-none text-[11px] font-bold text-passionfruit-faint hover:text-passionfruit-accentInk"
                      aria-label={`Remove section ${i + 1}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2.5 rounded-2xl bg-passionfruit-sunk px-3.5 py-3 text-[12.5px] text-passionfruit-muted">
                Try: Introduction · Background · Method · Findings · Conclusion.
              </p>
            )}
            <div className="mt-2.5 flex items-center gap-2.5">
              <input
                type="text"
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSection();
                  }
                }}
                placeholder="Add a section…"
                className="input flex-1"
                maxLength={160}
              />
              <button
                type="button"
                onClick={addSection}
                disabled={!newSection.trim()}
                className="btn-soft disabled:opacity-50"
              >
                + Add
              </button>
            </div>
          </div>

          <div className="my-4 h-px bg-passionfruit-line" />

          {/* Submit the paper as the deliverable */}
          {submitted ? (
            <div className="rounded-2xl border border-passionfruit-accentLine bg-passionfruit-wash p-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-passionfruit-accent text-[15px] text-white">
                  ✓
                </span>
                <div>
                  <p className="font-display text-[16px] font-semibold text-passionfruit-ink">
                    Paper submitted — nice work!
                  </p>
                  <p className="text-[12px] text-passionfruit-accentInk">
                    It&apos;s on your resume now. That&apos;s a real piece of research you made.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setPaperLink("");
                  setPaperFileName(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="btn-ghost mt-3 text-[13px]"
              >
                Submit another version
              </button>
            </div>
          ) : (
            <form onSubmit={submitPaper} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className="eyebrow">Submit your paper</span>
                <div className="flex rounded-full bg-passionfruit-sunk p-0.5 text-[12px] font-bold">
                  {(["link", "file"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setSubmitMode(m);
                        setSubmitError(null);
                      }}
                      className={`rounded-full px-3 py-1 transition ${
                        submitMode === m
                          ? "bg-passionfruit-card text-passionfruit-ink shadow-sheet"
                          : "text-passionfruit-muted"
                      }`}
                    >
                      {m === "link" ? "Paste link" : "Upload file"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label" htmlFor="ra-paper-title">
                  Paper title
                </label>
                <input
                  id="ra-paper-title"
                  type="text"
                  value={paperTitle}
                  onChange={(e) => setPaperTitle(e.target.value)}
                  placeholder={trimmedQuestion || "Title your paper"}
                  className="input"
                  maxLength={160}
                />
              </div>

              {submitMode === "link" ? (
                <div>
                  <label className="label" htmlFor="ra-paper-link">
                    Link to your paper
                  </label>
                  <input
                    id="ra-paper-link"
                    type="url"
                    inputMode="url"
                    value={paperLink}
                    onChange={(e) => setPaperLink(e.target.value)}
                    placeholder="https://docs.google.com/document/…"
                    className="input"
                  />
                </div>
              ) : (
                <div>
                  <label className="label" htmlFor="ra-paper-file">
                    Paper file
                  </label>
                  <input
                    id="ra-paper-file"
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.doc,.docx,.txt,.md"
                    onChange={(e) => setPaperFileName(e.target.files?.[0]?.name ?? null)}
                    className="block w-full text-[13px] text-passionfruit-muted file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-passionfruit-wash file:px-3.5 file:py-2 file:text-[12px] file:font-bold file:text-passionfruit-accentInk hover:file:brightness-[.98]"
                  />
                  {paperFileName && (
                    <p className="mt-1.5 truncate text-[12px] text-passionfruit-faint">
                      Selected: {paperFileName}
                    </p>
                  )}
                </div>
              )}

              {submitError && (
                <p className="rounded-2xl bg-passionfruit-wash px-3 py-2 text-[12px] font-medium text-passionfruit-accentInk">
                  {submitError}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => setStage(2)} className="btn-ghost">
                  ‹ Back
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? "Submitting…" : "Submit & add to resume →"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
