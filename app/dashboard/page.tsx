import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { requireParent, listStudents } from "@/lib/auth/parent";
import { db } from "@/lib/db/client";
import { interests, projects } from "@/lib/db/schema";
import { AppHeader } from "@/components/AppHeader";

export const dynamic = "force-dynamic";

async function studentStatus(studentId: string) {
  const [[ic], [pc]] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(interests)
      .where(eq(interests.studentId, studentId)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(projects)
      .where(eq(projects.studentId, studentId)),
  ]);
  const hasGraph = (ic?.n ?? 0) > 0;
  const hasProject = (pc?.n ?? 0) > 0;
  if (hasProject) return { label: "Project in progress", href: "", cta: "Open dashboard", color: "bg-green-100 text-green-800" };
  if (hasGraph) return { label: "Ready for project paths", href: "/paths", cta: "See project paths", color: "bg-brand-100 text-brand-800" };
  return { label: "Needs intake", href: "/intake", cta: "Start intake", color: "bg-amber-100 text-amber-800" };
}

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
            <h1 className="text-2xl font-bold">Your students</h1>
            <p className="text-sm text-slate-500">
              You hold the account. Each profile below belongs to you.
            </p>
          </div>
          <Link href="/students/new" className="btn-primary">
            + Add a student
          </Link>
        </div>

        {kids.length === 0 ? (
          <div className="card mt-8 text-center">
            <p className="text-slate-600">No students yet.</p>
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
                  className="card transition hover:border-brand-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">{kid.name}</h2>
                      <p className="text-sm text-slate-500">
                        {[kid.age ? `Age ${kid.age}` : null, kid.grade ? `Grade ${kid.grade}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    {kid.under13 && (
                      <span className="pill bg-slate-100 text-slate-600">Under 13</span>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className={`pill ${status.color}`}>{status.label}</span>
                    <span className="text-sm font-medium text-brand-600">{status.cta} →</span>
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
