// The STUDENT's home — a momentum-first cockpit (distinct from the parent's
// oversight view). This is where a student lands on login: this week with Sage,
// their streak + badges, the next checkpoint to tackle, their project at a
// glance, and their Running Resume. First-person and encouraging.

import Link from "next/link";
import { requireStudentView } from "@/lib/auth/parent";
import { getActiveProject, getLearnerGraphSnapshot } from "@/lib/db/queries";
import { getStudentArtifacts } from "@/lib/artifacts/store";
import { getCurrentFocus } from "@/lib/habit/loop";
import { getActivation } from "@/lib/habit/activation";
import { getEngagement } from "@/lib/engagement";
import { projectProgress } from "@/lib/ui";
import { PATH_TYPE_LABELS } from "@/lib/types";
import { ProgressRing } from "@/components/ProgressRing";
import { WeeklyFocusCard } from "@/components/WeeklyFocusCard";
import { ActivationBanner } from "@/components/ActivationBanner";
import { StreakBadges } from "@/components/StreakBadges";
import { CheckInButton } from "@/components/CheckInButton";
import { StudentAvatar } from "@/components/StudentAvatar";

export const dynamic = "force-dynamic";

export default async function StudentHome({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { student } = await requireStudentView(id);
  const firstName = student.name.split(" ")[0] ?? student.name;

  const [project, graph, artifacts, focus, activation, engagement] = await Promise.all([
    getActiveProject(id),
    getLearnerGraphSnapshot(id),
    getStudentArtifacts(id),
    getCurrentFocus(id),
    getActivation(id),
    getEngagement(id),
  ]);

  const hasGraph = !!graph && graph.interests.length > 0;
  const prog = project ? projectProgress(project.milestones) : null;
  const nextCheckpoint = project?.milestones.find((m) => m.status !== "done") ?? null;
  const streak = engagement.streak.current;

  return (
    <div className="min-h-screen">
      {/* Student header — warm, first-person, with a streak chip. */}
      <header className="border-b border-passionfruit-line bg-passionfruit-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <span className="h-[22px] w-[22px] rounded-[7px] bg-passionfruit-accent" />
            <span className="font-display text-[19px] font-semibold text-passionfruit-ink">Passionfruit</span>
          </div>
          <div className="flex items-center gap-3">
            {streak > 0 && (
              <span className="pill-accent gap-1">🔥 {streak}-week streak</span>
            )}
            <StudentAvatar name={student.name} size={30} />
            <form action="/api/auth/signout" method="post">
              <button type="submit" className="btn-ghost px-3.5 py-1.5 text-xs">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Greeting */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-[30px] font-semibold leading-tight text-passionfruit-ink sm:text-[38px]">
              Hi {firstName} 👋
            </h1>
            <p className="mt-1 text-[15px] text-passionfruit-muted">
              {project ? "Here's your week. Let's keep the momentum." : "Let's get your first project going."}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* MAIN */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            {/* This week with Sage */}
            <div>
              <span className="eyebrow">This week with Sage</span>
              <div className="mt-2">
                <WeeklyFocusCard studentId={id} focus={focus} />
              </div>
            </div>

            {/* Project + next checkpoint / or the on-ramp */}
            {project ? (
              <div
                className="rounded-3xl p-6 text-white shadow-frame sm:p-7"
                style={{ background: "linear-gradient(150deg,#E8694A,#D4533A)" }}
              >
                <div className="text-[10px] font-bold uppercase tracking-[1px] opacity-85">
                  Your project · {PATH_TYPE_LABELS[project.project.pathType]}
                </div>
                <div className="my-1.5 mb-4 font-display text-[24px] font-semibold leading-[1.15] sm:text-[28px]">
                  {project.project.title}
                </div>
                <div className="flex items-center gap-3.5">
                  {prog && <ProgressRing percent={prog.percent} />}
                  <div>
                    <div className="text-[14px] font-bold">{prog?.weekLabel}</div>
                    <div className="text-[12px] opacity-90">{prog?.paceLine}</div>
                  </div>
                </div>

                {nextCheckpoint && (
                  <div className="mt-5 rounded-2xl bg-white/15 p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-[.6px] opacity-85">
                      Next checkpoint
                    </div>
                    <div className="mt-0.5 text-[15px] font-semibold">{nextCheckpoint.title}</div>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2.5">
                  <Link
                    href={`/students/${id}/timeline`}
                    className="rounded-full bg-white px-4 py-2 text-[13px] font-bold text-passionfruit-accentInk"
                  >
                    Open my checkpoints →
                  </Link>
                  <Link
                    href={`/students/${id}/plan`}
                    className="rounded-full bg-white/15 px-4 py-2 text-[13px] font-bold text-white hover:bg-white/25"
                  >
                    My weekly plan
                  </Link>
                </div>
              </div>
            ) : (
              <div className="card-sheet p-6 text-center">
                <p className="font-display text-[18px] font-semibold text-passionfruit-ink">
                  {hasGraph ? "Ready to pick your project?" : "Let's meet Sage first"}
                </p>
                <p className="mx-auto mt-1 max-w-md text-[13px] text-passionfruit-muted">
                  {hasGraph
                    ? "Sage lined up a few project paths built around what you love. Pick the one that sparks something."
                    : "A short, friendly chat so Sage gets to know you — then you'll get real project ideas."}
                </p>
                <Link
                  href={hasGraph ? `/students/${id}/paths` : `/students/${id}/intake`}
                  className="btn-primary mt-4"
                >
                  {hasGraph ? "See my project paths →" : "Start with Sage →"}
                </Link>
              </div>
            )}
          </div>

          {/* SIDE */}
          <aside className="flex flex-col gap-4 lg:col-span-1">
            {!activation.firstWin && activation.dayOfSprint <= 7 && (
              <ActivationBanner state={activation} />
            )}
            <CheckInButton studentId={id} />
            <StreakBadges engagement={engagement} />

            {/* Running Resume snapshot */}
            <div className="card">
              <div className="flex items-center justify-between">
                <span className="eyebrow">Your Running Resume</span>
                <span className="pill">{artifacts.length}</span>
              </div>
              <p className="mt-1.5 text-[13px] text-passionfruit-muted">
                {artifacts.length > 0
                  ? "Everything you've made, in one place."
                  : "Finish a checkpoint and your work lands here."}
              </p>
              <Link href={`/students/${id}/portfolio`} className="btn-ghost mt-3 w-full text-xs">
                Open my resume →
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
