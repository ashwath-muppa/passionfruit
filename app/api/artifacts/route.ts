// Real Artifact Pipeline (#5): upload a piece of work (file or link) to a
// student's portfolio, and toggle any piece public.
//
// Uploads are authorized server-side: resolveOwnedStudent confirms the current
// parent owns the student, then the store writes to Storage via a service-role
// client. The service-role key is never exposed to the browser.

import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, jsonError, resolveOwnedStudent } from "@/lib/api/helpers";
import {
  addLinkArtifact,
  setArtifactShared,
  uploadArtifact,
} from "@/lib/artifacts/store";

// Hard cap so a stray giant file can't blow up the request (10 MB).
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const KINDS = ["image", "document", "code", "link", "other"] as const;

function normalizeKind(value: FormDataEntryValue | null): string {
  const k = typeof value === "string" ? value.trim() : "";
  return (KINDS as readonly string[]).includes(k) ? k : "other";
}

export async function POST(req: Request) {
  return guard(async () => {
    const form = await req.formData();
    const studentId =
      typeof form.get("studentId") === "string" ? (form.get("studentId") as string) : undefined;

    const owned = await resolveOwnedStudent(studentId);
    if (!owned.ok) return owned.response;

    const title = (form.get("title") as string | null)?.trim() ?? "";
    if (!title) return jsonError(400, "A title is required.");

    const kind = normalizeKind(form.get("kind"));
    const projectIdRaw = form.get("projectId");
    const projectId =
      typeof projectIdRaw === "string" && projectIdRaw.length > 0 ? projectIdRaw : null;

    const fileEntry = form.get("file");
    const linkRaw = form.get("linkUrl");
    const linkUrl = typeof linkRaw === "string" ? linkRaw.trim() : "";

    // Prefer a real file when present; otherwise fall back to a link.
    if (fileEntry instanceof File && fileEntry.size > 0) {
      if (fileEntry.size > MAX_FILE_BYTES) {
        return jsonError(413, "That file is too large (max 10 MB).");
      }
      const bytes = await fileEntry.arrayBuffer();
      const artifact = await uploadArtifact({
        studentId: owned.student.id,
        projectId,
        title,
        kind,
        file: {
          bytes,
          name: fileEntry.name || "upload",
          type: fileEntry.type || "application/octet-stream",
        },
      });
      return NextResponse.json({ artifact });
    }

    if (linkUrl) {
      const parsed = z.string().url().safeParse(linkUrl);
      if (!parsed.success) return jsonError(400, "That doesn't look like a valid link.");
      const artifact = await addLinkArtifact({
        studentId: owned.student.id,
        projectId,
        title,
        kind: kind === "image" || kind === "document" ? "link" : kind,
        url: parsed.data,
      });
      return NextResponse.json({ artifact });
    }

    return jsonError(400, "Add a file or a link to upload.");
  });
}

const patchSchema = z.object({
  artifactId: z.string().uuid(),
  studentId: z.string().uuid(),
  shared: z.boolean(),
});

export async function PATCH(req: Request) {
  return guard(async () => {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);

    const owned = await resolveOwnedStudent(parsed.data.studentId);
    if (!owned.ok) return owned.response;

    await setArtifactShared(parsed.data.artifactId, owned.student.id, parsed.data.shared);
    return NextResponse.json({ ok: true });
  });
}
