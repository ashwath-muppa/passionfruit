import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { requireParent, listStudents } from "@/lib/auth/parent";
import { db } from "@/lib/db/client";
import { interests, projects } from "@/lib/db/schema";
import { getActiveProject, getOpenSafetyFlags } from "@/lib/db/queries";
import { getEngagement } from "@/lib/engagement";
import { projectProgress } from "@/lib/ui";
import { AppHeader } from "@/components/AppHeader";
import { StudentAvatar } from "@/components/StudentAvatar";

export const dynamic = "force-dynamic";

async function studentStatus(studentId: string) {
  const [[ic], [pc]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(interests).where(eq(interests.studentId, studentId)),
    db.select({ n: sql<number>`count(*)::int` }).from(projects).where(eq(projects.studentId, studentId)),
  ]);
  const hasGraph = (ic?.n ?? 0) > 0;
  const hasProject = (pc?.n ?? 0) > 0;
  if (hasProject)
    return { label: "Project in progress", href: "", cta: "Open dashboard", tone: "accent" as const };
  if (hasGraph)
    return { label: "Ready for project paths", href: "/paths", cta: "See project paths", tone: "gold" as const };
  return { label: "Needs intake", href: "/intake", cta: "Start intake", tone: "muted" as const };
}

const TONE: Record<"accent" | "gold" | "muted", string> = {
  accent: "bg-passionfruit-wash text-passionfruit-accentInk",
  gold: "bg-[#FBEFD6] text-[#9A6B12]",
  muted: "bg-passionfruit-sunk text-passionfruit-muted",
};

interface Glance {
  status: Awaited<ReturnType<typeof studentStatus>>;
  projectTitle: string | null;
  percent: number;
  paceLine: string;
  weekLabel: string;
  streak: number;
  openFlags: number;
}

async function studentGlance(studentId: string): Promise<Glance> {
  const [status, active, engagement, flags] = await Promise.all([
    studentStatus(studentId),
    getActiveProject(studentId),
    getEngagement(studentId),
    getOpenSafetyFlags(studentId),
  ]);
  const prog = active ? projectProgress(active.milestones) : null;
  return {
    status,
    projectTitle: active?.project.title ?? null,
    percent: prog?.percent ?? 0,
    paceLine: prog?.paceLine ?? "",
    weekLabel: prog?.weekLabel ?? "",
    streak: engagement.streak.current,
    openFlags: flags.length,
  };
}

export default async function DashboardPage() {
  const parent = await requireParent();
  const kids = await listStudents();
  const glances = await Promise.all(kids.map((k) => studentGlance(k.id)));

  return (
    <div className="min-h-screen">
      <AppHeader parentEmail={parent.email} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-[28px] font-semibold text-passionfruit-ink">Your students</h1>
            <p className="text-[13px] text-passionfruit-muted">
              You hold the account. Each profile below belongs to you.
            </p>
          </div>
          <Link href="/students/new" className="btn-primary">
            + Add a student
          </Link>
        </div>

        {kids.length === 0 ? (
          <div className="card-sheet mt-8 p-8 text-center">
            <p className="text-passionfruit-muted">No students yet.</p>
            <Link href="/students/new" className="btn-primary mt-4">
              Create your first student profile
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {kids.map((kid, i) => {
              const g = glances[i]!;
              const hasProject = g.projectTitle !== null;
              return (
                <Link
                  key={kid.id}
                  href={`/students/${kid.id}${g.status.href}`}
                  className="card-sheet flex flex-col transition hover:-translate-y-0.5 hover:shadow-elev"
                >
                  {/* Header: avatar, name, age/grade, safety indicator */}
                  <div className="flex items-start gap-3">
                    <StudentAvatar name={kid.name} size={42} />
                    <div className="min-w-0 flex-1">
                      <h2 className="font-display text-[18px] font-semibold text-passionfruit-ink">
                        {kid.name}
                      </h2>
                      <p className="text-[12px] text-passionfruit-faint">
                        {[kid.age ? `Age ${kid.age}` : null, kid.grade ? `Grade ${kid.grade}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                        {kid.under13 && " · Under 13"}
                      </p>
                    </div>
                    {g.openFlags > 0 ? (
                      <span className="inline-flex flex-none items-center gap-1 rounded-full bg-[#FBEFD6] px-2.5 py-1 text-[11px] font-bold text-[#9A6B12]">
                        <span className="h-1.5 w-1.5 rounded-full bg-passionfruit-gold" />
                        {g.openFlags} flagged
                      </span>
                    ) : (
                      <span className="inline-flex flex-none items-center gap-1.5 rounded-full bg-passionfruit-sunk px-2.5 py-1 text-[11px] font-semibold text-passionfruit-muted">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#3E9A62]" />
                        All clear
                      </span>
                    )}
                  </div>

                  {/* Momentum: project + progress, or the intake/paths state */}
                  <div className="mt-4 flex-1">
                    {hasProject ? (
                      <>
                        <p className="truncate text-[13px] font-semibold text-passionfruit-ink">
                          {g.projectTitle}
                        </p>
                        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-passionfruit-sunk">
                          <div
                            className="h-full rounded-full bg-passionfruit-accent transition-[width]"
                            style={{ width: `${g.percent}%` }}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-passionfruit-faint">
                          <span>{g.weekLabel}</span>
                          <span className="font-semibold text-passionfruit-accentInk">{g.percent}%</span>
                        </div>
                        {g.paceLine && (
                          <p className="mt-1 text-[12px] text-passionfruit-muted">{g.paceLine}</p>
                        )}
                      </>
                    ) : (
                      <div className="rounded-2xl bg-passionfruit-sunk/60 px-3.5 py-3 text-[13px] text-passionfruit-muted">
                        {g.status.label}
                      </div>
                    )}

                    {g.streak > 0 && (
                      <span className="pill-accent mt-3 gap-1">🔥 {g.streak}-week streak</span>
                    )}
                  </div>

                  {/* Footer: status pill + view affordance */}
                  <div className="mt-4 flex items-center justify-between border-t border-passionfruit-line pt-3">
                    <span className={`pill ${TONE[g.status.tone]}`}>{g.status.label}</span>
                    <span className="text-[13px] font-semibold text-passionfruit-accentInk">View →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
