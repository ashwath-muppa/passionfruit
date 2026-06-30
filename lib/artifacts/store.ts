// Real Artifact Pipeline (#5): the data layer for a student's portfolio — the
// tangible proof a parent can see and share.
//
// Uploads go through a SERVICE-ROLE Supabase Storage client so the server can
// write to the public `artifacts` bucket without exposing any user session /
// RLS to the browser. The service-role key NEVER leaves this server-only module.

import "server-only";
import { createClient } from "@supabase/supabase-js";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { artifacts } from "@/lib/db/schema";
import type { Artifact } from "@/lib/db/schema";
import { generateText } from "@/lib/ai/gateway";

const STORAGE_BUCKET = "artifacts";

// Server-only storage client. Bypasses RLS — keep it out of any client bundle.
function storageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase storage env. Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** Make a filename safe for a storage path (keep it readable, drop the rest). */
function safeName(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return cleaned.slice(0, 80) || "file";
}

/**
 * Best-effort one-line caption in Sage's encouraging voice. Falls back to the
 * title if the AI is unavailable / quota-limited — never throws.
 */
async function captionFor(title: string, kind: string): Promise<string> {
  try {
    const caption = await generateText({
      tier: "fast",
      system:
        "You are Sage, a warm mentor for a middle-schooler. Write ONE short, " +
        "specific, encouraging caption (max ~16 words) for a piece of work in " +
        "their portfolio. No quotes, no emoji, no preamble — just the sentence.",
      user: `Piece: "${title}" (kind: ${kind}). Write the caption.`,
      temperature: 0.7,
      maxOutputTokens: 60,
    });
    const line = caption.trim().split("\n")[0]?.trim();
    return line && line.length > 0 ? line.slice(0, 240) : title;
  } catch {
    return title;
  }
}

/**
 * Upload a real file to Storage and record it on the portfolio.
 * Path: artifacts/{studentId}/{uuid}-{safeName}.
 */
export async function uploadArtifact(input: {
  studentId: string;
  projectId?: string | null;
  /** The checkpoint this deliverable completes (Running Resume flow). */
  milestoneId?: string | null;
  title: string;
  kind: string;
  file: { bytes: ArrayBuffer | Uint8Array; name: string; type: string };
}): Promise<Artifact> {
  const sb = storageClient();
  const objectId = crypto.randomUUID();
  const path = `${input.studentId}/${objectId}-${safeName(input.file.name)}`;

  const bytes =
    input.file.bytes instanceof Uint8Array
      ? input.file.bytes
      : new Uint8Array(input.file.bytes);
  const contentType = input.file.type || "application/octet-stream";

  const { error: uploadError } = await sb.storage
    .from(STORAGE_BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const url = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  const caption = await captionFor(input.title, input.kind);

  const [row] = await db
    .insert(artifacts)
    .values({
      studentId: input.studentId,
      projectId: input.projectId ?? null,
      milestoneId: input.milestoneId ?? null,
      kind: input.kind,
      title: input.title,
      text: caption,
      url,
      mimeType: contentType,
      slug: crypto.randomUUID(),
      shared: false,
    })
    .returning();
  return row!;
}

/**
 * Record a link-only artifact (e.g. a GitHub repo, a published page). No file
 * upload — just the URL plus a shareable slug.
 */
export async function addLinkArtifact(input: {
  studentId: string;
  projectId?: string | null;
  /** The checkpoint this deliverable completes (Running Resume flow). */
  milestoneId?: string | null;
  title: string;
  kind: string;
  url: string;
}): Promise<Artifact> {
  const caption = await captionFor(input.title, input.kind);
  const [row] = await db
    .insert(artifacts)
    .values({
      studentId: input.studentId,
      projectId: input.projectId ?? null,
      milestoneId: input.milestoneId ?? null,
      kind: input.kind,
      title: input.title,
      text: caption,
      url: input.url,
      mimeType: null,
      slug: crypto.randomUUID(),
      shared: false,
    })
    .returning();
  return row!;
}

/** A student's portfolio, newest first. */
export async function getStudentArtifacts(studentId: string): Promise<Artifact[]> {
  return db
    .select()
    .from(artifacts)
    .where(eq(artifacts.studentId, studentId))
    .orderBy(desc(artifacts.createdAt));
}

/** A single artifact by its public share slug (or null). */
export async function getArtifactBySlug(slug: string): Promise<Artifact | null> {
  const [row] = await db
    .select()
    .from(artifacts)
    .where(eq(artifacts.slug, slug))
    .limit(1);
  return row ?? null;
}

/**
 * Toggle an artifact's public visibility. Scoped to studentId so a parent can
 * only ever flip their own student's work (defense in depth on top of the
 * route's ownership check).
 */
export async function setArtifactShared(
  id: string,
  studentId: string,
  shared: boolean,
): Promise<void> {
  await db
    .update(artifacts)
    .set({ shared })
    .where(and(eq(artifacts.id, id), eq(artifacts.studentId, studentId)));
}
