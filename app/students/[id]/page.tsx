import Link from "next/link";
import { notFound } from "next/navigation";
import { requireParent, getOwnedStudent } from "@/lib/auth/parent";
import {
  getActiveProject,
  getLearnerGraphSnapshot,
  getOpportunities,
  getSkills,
} from "@/lib/db/queries";
import { AppHeader } from "@/components/AppHeader";
import { LearnerGraph } from "@/components/LearnerGraph";
import { SkillsPlanner } from "@/components/SkillsPlanner";
import { ParentSummaryCard } from "@/components/ParentSummaryCard";
import { ProjectTimelineRail } from "@/components/ProjectTimelineRail";
import { UpNext } from "@/components/UpNext";
import { StudentAvatar } from "@/components/StudentAvatar";
import { PATH_TYPE_LABELS } from "@/lib/types";
import { projectProgress } from "@/lib/ui";

export const dynamic = "force-dynamic";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function StudentDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parent = await requireParent();
  const student = await getOwnedStudent(id);
  if (!student) notFound();

  const [graph, project, skills, opportunities] = await Promise.all([
    getLearnerGraphSnapshot(id),
    getActiveProject(id),
    getSkills(id),
    getOpportunities(id),
  ]);

  const firstName = student.name.split(" ")[0] ?? student.name;
  const hasGraph = !!graph && graph.interests.length > 0;
  const period = `${MONTHS[new Date().getMonth()]} summary`;
  const prog = project ? projectProgress(project.milestones) : null;

  return (
    <div className="min-h-screen">
      <AppHeader parentEmail={parent.email} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link href="/dashboard" className="text-[13px] font-semibold text-passionfruit-muted">
          ← All students
        </Link>

        {/* Dashboard sheet */}
        <div className="mt-3 rounded-[24px] border border-passionfruit-line bg-passionfruit-paper p-5 shadow-frame sm:p-[22px]">
          {/* header */}
          <div className="mb-[18px] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="h-6 w-6 rounded-[7px] bg-passionfruit-accent" />
              <span className="font-display text-[20px] font-semibold text-passionfruit-ink">Passionfruit</span>
              <span className="ml-1 border-l border-passionfruit-line pl-2.5 text-[12px] text-passionfruit-faint">
                Parent view
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-full border border-passionfruit-line bg-passionfruit-card py-1.5 pl-1.5 pr-3.5"
              >
                <StudentAvatar name={student.name} size={26} />
                <span className="text-[13px] font-bold text-passionfruit-ink">
                  {firstName}
                  {student.grade ? ` · Grade ${student.grade}` : ""}
                </span>
                <span className="text-passionfruit-faint">▾</span>
              </Link>
              <span className="hidden text-[12px] text-passionfruit-faint sm:inline">{period}</span>
            </div>
          </div>

          {/* body grid */}
          <div className="grid gap-4 lg:grid-cols-[296px_1fr]">
            {/* LEFT */}
            <div className="flex flex-col gap-4">
              <SkillsPlanner skills={skills} />
              <ParentSummaryCard studentId={id} studentFirstName={firstName} />
              {!hasGraph && (
                <div className="card text-center">
                  <p className="text-[13px] text-passionfruit-muted">
                    Run the intake chat to build {firstName}&apos;s learner graph.
                  </p>
                  <Link href={`/students/${id}/intake`} className="btn-primary mt-3 text-xs">
                    Start intake →
                  </Link>
                </div>
              )}
            </div>

            {/* RIGHT */}
            <div className="flex flex-col gap-4">
              {hasGraph ? (
                <LearnerGraph
                  studentName={student.name}
                  interests={graph!.interests}
                  skills={skills}
                  projectTitle={project?.project.title ?? null}
                />
              ) : (
                <div className="card flex min-h-[180px] items-center justify-center text-center">
                  <p className="max-w-xs text-[13px] text-passionfruit-faint">
                    {firstName}&apos;s learner graph — the living map of interests, skills, and
                    projects — appears here once intake is done.
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {project ? (
                  <ProjectTimelineRail
                    milestones={project.milestones}
                    timelineHref={`/students/${id}/timeline`}
                  />
                ) : (
                  <div className="card flex flex-col justify-between">
                    <div>
                      <h3 className="font-display text-[15px] font-semibold text-passionfruit-ink">
                        Project
                      </h3>
                      <p className="mt-1 text-[12px] text-passionfruit-muted">
                        {hasGraph
                          ? "The learner graph is ready — generate project paths to begin."
                          : "Finish intake first to unlock project paths."}
                      </p>
                    </div>
                    {hasGraph && (
                      <div className="mt-3 flex flex-col gap-1.5">
                        <Link href={`/students/${id}/paths`} className="btn-primary text-xs">
                          See project paths →
                        </Link>
                        <Link
                          href={`/students/${id}/builder`}
                          className="text-center text-[12px] font-semibold text-passionfruit-accentInk hover:underline"
                        >
                          Or try the spark quiz
                        </Link>
                      </div>
                    )}
                  </div>
                )}
                <UpNext opportunities={opportunities} />
              </div>

              {project && (
                <div className="flex flex-wrap items-center gap-2 px-1">
                  <span className="pill-accent">{PATH_TYPE_LABELS[project.project.pathType]}</span>
                  <span className="text-[13px] font-semibold text-passionfruit-ink">
                    {project.project.title}
                  </span>
                  {prog && (
                    <span className="text-[12px] text-passionfruit-faint">· {prog.weekLabel}</span>
                  )}
                  <Link
                    href={`/students/${id}/plan`}
                    className="ml-auto text-[12px] font-semibold text-passionfruit-accentInk hover:underline"
                  >
                    Open weekly plan →
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Consent / safety reassurance strip (DESIGN.md §9) */}
        <p className="mt-3 px-1 text-[12px] text-passionfruit-faint">
          {[student.age ? `Age ${student.age}` : null, student.grade ? `Grade ${student.grade}` : null]
            .filter(Boolean)
            .join(" · ")}
          {student.under13 && " · Under 13"}
          {" · "}
          {student.parentalConsent ? "Parental consent on file" : "Awaiting parental consent"}
          {" · every AI moment is safety-checked and logged."}
        </p>
      </main>
    </div>
  );
}
