import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { requireParent, listStudents } from "@/lib/auth/parent";
import { db } from "@/lib/db/client";
import { interests, projects } from "@/lib/db/schema";
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

export default async function DashboardPage() {
  const parent = await requireParent();
  const kids = await listStudents();
  const statuses = await Promise.all(kids.map((k) => studentStatus(k.id)));

  return (
    <div className="min-h-screen">
      <AppHeader parentEmail={parent.email} />
      <main className="mx-auto max-w-5xl px-6 py-10">
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
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {kids.map((kid, i) => {
              const status = statuses[i]!;
              return (
                <Link
                  key={kid.id}
                  href={`/students/${kid.id}${status.href}`}
                  className="card-sheet transition hover:-translate-y-0.5 hover:shadow-elev"
                >
                  <div className="flex items-start gap-3">
                    <StudentAvatar name={kid.name} size={42} />
                    <div className="flex-1">
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
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className={`pill ${TONE[status.tone]}`}>{status.label}</span>
                    <span className="text-[13px] font-semibold text-passionfruit-accentInk">
                      {status.cta} →
                    </span>
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
