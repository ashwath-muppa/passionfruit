"use client";

// Real Artifact Pipeline (#5): the "add a piece" card. A kid drops in a file
// (image / PDF / doc) OR pastes a link, names it, and it lands on the portfolio.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Kind = "image" | "document" | "code" | "link" | "other";
type Mode = "file" | "link";

const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: "image", label: "Image" },
  { value: "document", label: "Document" },
  { value: "code", label: "Code" },
  { value: "link", label: "Link" },
  { value: "other", label: "Other" },
];

const FILE_ACCEPT =
  "image/*,application/pdf,.doc,.docx,.ppt,.pptx,.txt,.md,.csv";

export function ArtifactUpload({
  studentId,
  projectId,
}: {
  studentId: string;
  projectId?: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("file");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<Kind>("image");
  const [linkUrl, setLinkUrl] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setLinkUrl("");
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Give it a title so you remember what it is.");
      return;
    }

    const fd = new FormData();
    fd.set("studentId", studentId);
    if (projectId) fd.set("projectId", projectId);
    fd.set("title", title.trim());
    fd.set("kind", kind);

    if (mode === "file") {
      const file = fileInputRef.current?.files?.[0];
      if (!file) {
        setError("Choose a file to upload.");
        return;
      }
      fd.set("file", file);
    } else {
      if (!linkUrl.trim()) {
        setError("Paste a link to add it.");
        return;
      }
      fd.set("linkUrl", linkUrl.trim());
    }

    setBusy(true);
    try {
      const res = await fetch("/api/artifacts", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message ?? data?.error ?? "Upload failed. Try again.");
      }
      reset();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card-sheet">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <span className="eyebrow">Add to portfolio</span>
          <h3 className="font-display text-[16px] font-semibold leading-tight text-passionfruit-ink">
            Put your finished work here
          </h3>
        </div>
        {/* file / link toggle */}
        <div className="flex rounded-full bg-passionfruit-sunk p-0.5 text-[12px] font-bold">
          {(["file", "link"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
                setKind(m === "link" ? "link" : "image");
              }}
              className={`rounded-full px-3 py-1 transition ${
                mode === m
                  ? "bg-passionfruit-card text-passionfruit-ink shadow-sheet"
                  : "text-passionfruit-muted"
              }`}
            >
              {m === "file" ? "Upload file" : "Paste link"}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        {mode === "file" ? (
          <div>
            <label className="label" htmlFor="artifact-file">
              File
            </label>
            <input
              id="artifact-file"
              ref={fileInputRef}
              type="file"
              accept={FILE_ACCEPT}
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              className="block w-full text-[13px] text-passionfruit-muted file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-passionfruit-wash file:px-3.5 file:py-2 file:text-[12px] file:font-bold file:text-passionfruit-accentInk hover:file:brightness-[.98]"
            />
            {fileName && (
              <p className="mt-1.5 truncate text-[12px] text-passionfruit-faint">
                Selected: {fileName}
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className="label" htmlFor="artifact-link">
              Link
            </label>
            <input
              id="artifact-link"
              type="url"
              inputMode="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://github.com/you/your-project"
              className="input"
            />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
          <div>
            <label className="label" htmlFor="artifact-title">
              Title
            </label>
            <input
              id="artifact-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What is it?"
              className="input"
              maxLength={120}
            />
          </div>
          <div>
            <label className="label" htmlFor="artifact-kind">
              Kind
            </label>
            <select
              id="artifact-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className="input"
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="rounded-2xl bg-passionfruit-wash px-3 py-2 text-[12px] font-medium text-passionfruit-accentInk">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button type="submit" disabled={busy} className="btn-primary text-sm">
            {busy ? "Uploading…" : "Add to portfolio"}
          </button>
          <span className="text-[11px] text-passionfruit-faint">
            Images, PDFs, docs, or a link · up to 10 MB
          </span>
        </div>
      </form>
    </div>
  );
}
