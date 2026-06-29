// Resolve the best resources for a milestone: a live, web-grounded search
// (current courses/programs/tools — beyond any static list), vetted with the
// same free-first, no-predatory-upsell rules, then cached with a freshness date.
// Falls back to curated picks when the live call returns nothing.

import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { resources } from "@/lib/db/schema";
import type { Milestone, Resource } from "@/lib/db/schema";
import { generateGrounded } from "@/lib/ai/gateway";
import { curatedResources, type ResourceSeed } from "./curated";

const KINDS = new Set([
  "course",
  "program",
  "portfolio",
  "dataset",
  "tool",
  "competition",
  "reading",
  "other",
]);
const FRESH_MS = 30 * 24 * 60 * 60 * 1000;

const SYSTEM = `You find real, current, FREE-FIRST online resources for a middle/high-school student's project step (ages 11-15). Use web search to ground every result in a real, currently-live page.

Hard rules:
- Prefer free and official sources. Mark anything paid in costNote and add a "paid" flag.
- NEVER recommend pay-to-publish "research journals", paid "research mentorship/fellowship" upsells, or anything not currently active.
- Age-appropriate only.

Output STRICT JSON only — an array of up to 3 objects:
{"kind": "course|program|portfolio|dataset|tool|competition|reading|other", "title": string, "provider": string, "url": string, "costNote": string, "summary": string (one sentence on why it helps THIS step), "flags": string[]}`;

function parseResources(raw: string): ResourceSeed[] {
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.title === "string" && KINDS.has(x.kind))
      .map((x) => ({
        kind: x.kind as ResourceSeed["kind"],
        title: String(x.title).slice(0, 120),
        provider: String(x.provider ?? "").slice(0, 60),
        url: typeof x.url === "string" ? x.url : "",
        costNote: String(x.costNote ?? "").slice(0, 40),
        summary: String(x.summary ?? "").slice(0, 220),
        flags: Array.isArray(x.flags) ? x.flags.map(String) : [],
        source: "grounded" as const,
      }))
      .slice(0, 3);
  } catch {
    return [];
  }
}

async function groundedFind(milestone: Milestone, domains: Set<string>): Promise<ResourceSeed[]> {
  const user = `Step: "${milestone.title}". Detail: ${milestone.detail ?? ""}. Topic domains: ${[...domains].join(", ") || "general"}. Find up to 3 resources. JSON array only.`;
  const raw = await generateGrounded({ tier: "fast", system: SYSTEM, user, maxOutputTokens: 1024, temperature: 0.2 });
  return parseResources(raw);
}

export async function getCachedResources(milestoneId: string): Promise<Resource[]> {
  return db
    .select()
    .from(resources)
    .where(eq(resources.milestoneId, milestoneId))
    .orderBy(desc(resources.lastVerified));
}

/** Cache-first resolve. Tries a live grounded search; falls back to curated. */
export async function resolveMilestoneResources(
  milestone: Milestone,
  studentId: string | null,
  domains: Set<string>,
  opts: { force?: boolean } = {},
): Promise<Resource[]> {
  const existing = await getCachedResources(milestone.id);
  const fresh =
    existing.length > 0 && existing[0]!.lastVerified.getTime() > Date.now() - FRESH_MS;
  if (fresh && !opts.force) return existing;

  let found: ResourceSeed[] = [];
  try {
    found = await groundedFind(milestone, domains);
  } catch {
    found = [];
  }
  if (found.length === 0) found = curatedResources(milestone, domains);

  await db.delete(resources).where(eq(resources.milestoneId, milestone.id));
  return db
    .insert(resources)
    .values(
      found.map((f) => ({
        milestoneId: milestone.id,
        studentId,
        kind: f.kind,
        title: f.title,
        provider: f.provider || null,
        url: f.url || null,
        costNote: f.costNote || null,
        summary: f.summary || null,
        flags: f.flags,
        source: f.source,
      })),
    )
    .returning();
}
