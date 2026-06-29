// Resolve the best resources for a milestone (Live Resource Finder, #2): a live
// web-grounded search, vetted + cached, with a curated fallback. Body:
// { milestoneId, force? }.

import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { milestones, projects } from "@/lib/db/schema";
import { getLearnerGraphSnapshot } from "@/lib/db/queries";
import { guard, jsonError, resolveOwnedStudent } from "@/lib/api/helpers";
import { inferDomains } from "@/lib/deliverables/match";
import { resolveMilestoneResources } from "@/lib/resources/find";

const bodySchema = z.object({ milestoneId: z.string().uuid(), force: z.boolean().optional() });

export async function POST(req: Request) {
  return guard(async () => {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, parsed.error.message);

    const [milestone] = await db
      .select()
      .from(milestones)
      .where(eq(milestones.id, parsed.data.milestoneId))
      .limit(1);
    if (!milestone) return jsonError(404, "Milestone not found");

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, milestone.projectId))
      .limit(1);
    if (!project) return jsonError(404, "Project not found");

    const owned = await resolveOwnedStudent(project.studentId);
    if (!owned.ok) return owned.response;

    const graph = await getLearnerGraphSnapshot(project.studentId);
    const domains = graph ? inferDomains(graph) : new Set<string>();
    const out = await resolveMilestoneResources(milestone, project.studentId, domains, {
      force: parsed.data.force,
    });
    return NextResponse.json({ resources: out });
  });
}
