import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudentView } from "@/lib/auth/parent";
import { getActiveProject, getResourcesForProject } from "@/lib/db/queries";
import type { Resource } from "@/lib/db/schema";
import { PATH_TYPE_LABELS } from "@/lib/types";
import { projectProgress } from "@/lib/ui";
import { ProgressRing } from "@/components/ProgressRing";
import { MilestoneList } from "@/components/MilestoneList";
import { WeeklyFocusCard } from "@/components/WeeklyFocusCard";
import { ActivationBanner } from "@/components/ActivationBanner";
import { StreakBadges } from "@/components/StreakBadges";
import { CheckInButton } from "@/components/CheckInButton";
import { getCurrentFocus } from "@/lib/habit/loop";
import { getActivation } from "@/lib/habit/activation";
import { getEngagement } from "@/lib/engagement";

export const dynamic = "force-dynamic";

export default async function WeeklyPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { student } = await requireStudentView(id);

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

  // Retention: the weekly habit loop (#6), activation sprint (#6), streak + badges (#7).
  const [focus, activation, engagement] = await Promise.all([
    getCurrentFocus(id),
    getActivation(id),
    getEngagement(id),
  ]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4">
        <Link href={`/students/${id}`} className="text-[13px] font-semibold text-passionfruit-muted">
          ← {student.name}
        </Link>
      </div>

      {/* project header */}
      <div
        className="rounded-3xl p-6 text-white shadow-frame sm:p-7"
        style={{ background: "linear-gradient(150deg,#E8694A,#D4533A)" }}
      >
        <div className="text-[10px] font-bold uppercase tracking-[1px] opacity-85">
          Your project · {PATH_TYPE_LABELS[project.project.pathType]}
        </div>
        <div className="my-1.5 mb-3.5 font-display text-[24px] font-semibold leading-[1.15] sm:text-[28px]">
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

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* MAIN column: weekly focus + milestones */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <div>
            <span className="eyebrow">This week with Sage</span>
            <div className="mt-2">
              <WeeklyFocusCard studentId={id} focus={focus} />
            </div>
          </div>

          <div>
            <span className="eyebrow">Your milestones</span>
            <div className="mt-2">
              <MilestoneList
                initial={project.milestones}
                resourcesByMilestone={resourcesByMilestone}
              />
            </div>
          </div>
        </div>

        {/* SIDE column: check-in + streak + activation */}
        <aside className="flex flex-col gap-4 lg:col-span-1">
          {!activation.firstWin && activation.dayOfSprint <= 7 && (
            <ActivationBanner state={activation} />
          )}
          <CheckInButton studentId={id} />
          <StreakBadges engagement={engagement} />
        </aside>
      </div>
    </main>
  );
}
