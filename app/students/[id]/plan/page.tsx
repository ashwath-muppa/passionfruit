import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireParent, getOwnedStudent } from "@/lib/auth/parent";
import { getActiveProject, getResourcesForProject } from "@/lib/db/queries";
import type { Resource } from "@/lib/db/schema";
import { PATH_TYPE_LABELS } from "@/lib/types";
import { projectProgress } from "@/lib/ui";
import { PhoneFrame } from "@/components/PhoneFrame";
import { ProgressRing } from "@/components/ProgressRing";
import { MilestoneList } from "@/components/MilestoneList";

export const dynamic = "force-dynamic";

export default async function WeeklyPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireParent();
  const student = await getOwnedStudent(id);
  if (!student) notFound();

  const project = await getActiveProject(id);
  if (!project) redirect(`/students/${id}`);

  const prog = projectProgress(project.milestones);

  // Group cached Live Resource Finder chips by milestone (#2).
  const resourceRows = await getResourcesForProject(project.project.id);
  const resourcesByMilestone = resourceRows.reduce<Record<string, Resource[]>>((acc, r) => {
    if (!r.milestoneId) return acc;
    (acc[r.milestoneId] ??= []).push(r);
    return acc;
  }, {});

  return (
    <main className="mx-auto min-h-screen max-w-[392px] px-4 py-8">
      <div className="mb-4 px-1">
        <Link href={`/students/${id}`} className="text-[13px] font-semibold text-passionfruit-muted">
          ← {student.name}
        </Link>
      </div>
      <PhoneFrame>
        {/* project header */}
        <div
          className="mx-[18px] mt-2 rounded-3xl p-[18px] text-white"
          style={{ background: "linear-gradient(150deg,#E8694A,#D4533A)" }}
        >
          <div className="text-[10px] font-bold uppercase tracking-[1px] opacity-85">
            Your project · {PATH_TYPE_LABELS[project.project.pathType]}
          </div>
          <div className="my-1.5 mb-3.5 font-display text-[22px] font-semibold leading-[1.15]">
            {project.project.title}
          </div>
          <div className="flex items-center gap-3.5">
            <ProgressRing percent={prog.percent} />
            <div>
              <div className="text-[14px] font-bold">{prog.weekLabel}</div>
              <div className="text-[12px] opacity-90">{prog.paceLine}</div>
            </div>
          </div>
        </div>

        <div className="px-5 pb-1.5 pt-4">
          <span className="eyebrow">Your milestones</span>
        </div>
        <div className="px-5 pb-6">
          <MilestoneList
            initial={project.milestones}
            resourcesByMilestone={resourcesByMilestone}
          />
        </div>
      </PhoneFrame>
    </main>
  );
}
