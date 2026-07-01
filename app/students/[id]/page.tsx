import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudentView } from "@/lib/auth/parent";
import {
  getActiveProject,
  getActiveTarget,
  getLearnerGraphSnapshot,
  getOpenSafetyFlags,
  getOpportunities,
  getSkills,
} from "@/lib/db/queries";
import { AppHeader } from "@/components/AppHeader";
import { LearnerGraph } from "@/components/LearnerGraph";
import { SkillsPlanner } from "@/components/SkillsPlanner";
import { ParentSummaryCard } from "@/components/ParentSummaryCard";
import { ProjectTimelineRail } from "@/components/ProjectTimelineRail";
import { UpNext } from "@/components/UpNext";
import { ParentTargetControl } from "@/components/ParentTargetControl";
import { IntersectionCard } from "@/components/IntersectionCard";
import { CalendarActions } from "@/components/CalendarActions";
import { SpikeLadder } from "@/components/SpikeLadder";
import { StreakBadges } from "@/components/StreakBadges";
import { DigestControl } from "@/components/DigestControl";
import { CheckpointBooking } from "@/components/CheckpointBooking";
import { SafetyPanel } from "@/components/SafetyPanel";
import { StudentAvatar } from "@/components/StudentAvatar";
import { PATH_TYPE_LABELS } from "@/lib/types";
import { projectProgress } from "@/lib/ui";
import { pickLadder } from "@/lib/deliverables/ladders";
import { inferDomains } from "@/lib/deliverables/match";
import { getEngagement } from "@/lib/engagement";
import { listMentors, getCheckpoints, checkpointUsage } from "@/lib/mentors/checkpoints";

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
  const { student, actor } = await requireStudentView(id);
  // This is the PARENT oversight view. A student belongs on their own cockpit.
  if (actor.role === "student") redirect(`/students/${id}/home`);

  const [
    graph,
    project,
    skills,
    opportunities,
    target,
    engagement,
    mentors,
    checkpoints,
    usage,
    safetyFlags,
  ] = await Promise.all([
    getLearnerGraphSnapshot(id),
    getActiveProject(id),
    getSkills(id),
    getOpportunities(id),
    getActiveTarget(id),
    getEngagement(id),
    listMentors(),
    getCheckpoints(id),
    checkpointUsage(id),
    getOpenSafetyFlags(id),
  ]);

  const firstName = student.name.split(" ")[0] ?? student.name;
  const hasGraph = !!graph && graph.interests.length > 0;
  const period = `${MONTHS[new Date().getMonth()]} summary`;
  const prog = project ? projectProgress(project.milestones) : null;

  // The spike ladder this student's target sits on (#3) — the moat made visible.
  const gradeNum = student.grade ? parseInt(student.grade, 10) : null;
  const ladder = hasGraph
    ? pickLadder({
        domains: inferDomains(graph!),
        targetSlug: target?.deliverable.slug ?? null,
        grade: Number.isFinite(gradeNum) ? gradeNum : null,
      })
    : null;

  return (
    <div className="min-h-screen">
      <AppHeader parentEmail={actor.role === "parent" ? actor.parent.email : student.name} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
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

          {/* ── GROWTH ── the learner graph hero + how it's compounding */}
          <section>
            <p className="eyebrow">Growth</p>
            <div className="mt-2 grid gap-4 lg:grid-cols-[296px_1fr]">
              <div className="flex flex-col gap-4">
                <ParentSummaryCard studentId={id} studentFirstName={firstName} />
                <SkillsPlanner skills={skills} />
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
                {ladder && (
                  <SpikeLadder ladder={ladder.ladder} currentRungIndex={ladder.currentRungIndex} />
                )}
                <StreakBadges engagement={engagement} />
              </div>
            </div>
          </section>

          {/* ── THE PROJECT ── the real thing being built, and what's next */}
          <section className="mt-7">
            <p className="eyebrow">The project</p>
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
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
              <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
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

            {/* Real Artifact Pipeline (#5): the wall of finished work to see + share. */}
            <div className="mt-2 flex flex-wrap items-center gap-2 px-1">
              <span className="pill">Running Resume</span>
              <span className="text-[13px] text-passionfruit-muted">
                {firstName}&apos;s real, finished work
              </span>
              <Link
                href={`/students/${id}/portfolio`}
                className="ml-auto text-[12px] font-semibold text-passionfruit-accentInk hover:underline"
              >
                Open running resume →
              </Link>
            </div>
          </section>

          {/* ── STEERING ── the family sets the end-goal; Sage maps the route (#10) */}
          {hasGraph && (
            <section className="mt-7">
              <p className="eyebrow">Steering</p>
              <div className="mt-2 flex flex-col gap-4">
                {/* Parent north-star: the family steers the end-goal; Sage maps the
                    route from the student's interests. */}
                <ParentTargetControl
                  studentId={id}
                  studentName={firstName}
                  initialPref={student.endGoalPref}
                  activeTarget={
                    target
                      ? {
                          deliverable: { ...target.deliverable, embedding: null },
                          rationale: target.target.rationale,
                          approved: target.target.parentApproved,
                        }
                      : null
                  }
                />
                {/* Signature theme: fuse the student's interests into one ownable
                    direction aimed at the family's chosen end-goal. */}
                <IntersectionCard studentId={id} studentName={firstName} />
              </div>
            </section>
          )}

          {/* ── SUPPORT ── the ways the family stays in the loop */}
          <section className="mt-7">
            <p className="eyebrow">Support</p>
            <div className="mt-2 flex flex-col gap-4">
              <CheckpointBooking
                studentId={id}
                studentName={firstName}
                mentors={mentors}
                checkpoints={checkpoints}
                usage={usage}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <DigestControl studentId={id} studentName={firstName} />
                <CalendarActions studentId={id} />
              </div>
            </div>
          </section>

          {/* ── SAFETY & CONSENT ── the calm oversight surface (DESIGN.md §9) */}
          <section className="mt-7">
            <p className="eyebrow">Safety &amp; consent</p>
            <div className="mt-2">
              <SafetyPanel
                consent={{
                  parentalConsent: student.parentalConsent,
                  under13: student.under13,
                  consentAt: student.consentAt,
                }}
                flags={safetyFlags}
              />
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
