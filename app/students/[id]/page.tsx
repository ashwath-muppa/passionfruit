import Link from "next/link";
import { notFound } from "next/navigation";
import { requireParent, getOwnedStudent } from "@/lib/auth/parent";
import { getActiveProject, getLearnerGraphSnapshot } from "@/lib/db/queries";
import { AppHeader } from "@/components/AppHeader";
import { MilestoneList } from "@/components/MilestoneList";
import { ParentSummaryCard } from "@/components/ParentSummaryCard";
import { PATH_TYPE_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StudentDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parent = await requireParent();
  const student = await getOwnedStudent(id);
  if (!student) notFound();

  const [graph, project] = await Promise.all([
    getLearnerGraphSnapshot(id),
    getActiveProject(id),
  ]);

  const hasGraph = !!graph && graph.interests.length > 0;

  return (
    <div className="min-h-screen">
      <AppHeader parentEmail={parent.email} />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <Link href="/dashboard" className="text-sm text-brand-600">← All students</Link>

        {/* Profile header */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{student.name}</h1>
            <p className="text-sm text-slate-500">
              {[student.age ? `Age ${student.age}` : null, student.grade ? `Grade ${student.grade}` : null]
                .filter(Boolean)
                .join(" · ")}
              {student.under13 && " · Under 13"}
              {" · "}
              {student.parentalConsent ? (
                <span className="text-green-700">Consent on file</span>
              ) : (
                <span className="text-amber-700">No consent</span>
              )}
            </p>
          </div>
          {!project && (
            <Link
              href={hasGraph ? `/students/${id}/paths` : `/students/${id}/intake`}
              className="btn-primary"
            >
              {hasGraph ? "See project paths" : "Start intake"}
            </Link>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Left: project + progress */}
          <div className="space-y-6 lg:col-span-2">
            {project ? (
              <div className="card">
                <div className="flex items-center justify-between">
                  <span className="pill bg-brand-100 text-brand-800">
                    {PATH_TYPE_LABELS[project.project.pathType]}
                  </span>
                  <span className="pill bg-green-100 text-green-800">{project.project.status}</span>
                </div>
                <h2 className="mt-3 text-xl font-semibold">{project.project.title}</h2>
                {project.project.summary && (
                  <p className="mt-1 text-sm text-slate-600">{project.project.summary}</p>
                )}
                <hr className="my-4 border-slate-100" />
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Weekly plan</h3>
                <MilestoneList initial={project.milestones} />
              </div>
            ) : (
              <div className="card text-center">
                <p className="text-slate-600">
                  {hasGraph
                    ? "Learner graph is ready. Generate project paths to get started."
                    : "Run the intake chat to build the learner graph."}
                </p>
                <Link
                  href={hasGraph ? `/students/${id}/paths` : `/students/${id}/intake`}
                  className="btn-primary mt-4"
                >
                  {hasGraph ? "See project paths" : "Start intake"}
                </Link>
              </div>
            )}

            <ParentSummaryCard studentId={id} />
          </div>

          {/* Right: learner graph */}
          <div className="space-y-4">
            <div className="card">
              <h2 className="font-semibold">Learner graph</h2>
              <p className="text-xs text-slate-400">The persistent memory of who {student.name} is.</p>

              <GraphSection title="Interests">
                {graph?.interests.length ? (
                  graph.interests.map((i) => (
                    <span key={i.id} className="pill bg-brand-50 text-brand-700">
                      {i.label}
                    </span>
                  ))
                ) : (
                  <Empty />
                )}
              </GraphSection>

              <GraphSection title="Strengths">
                {graph?.strengths.length ? (
                  graph.strengths.map((s) => (
                    <span key={s.id} className="pill bg-slate-100 text-slate-700">{s.label}</span>
                  ))
                ) : (
                  <Empty />
                )}
              </GraphSection>

              <GraphSection title="Constraints">
                {graph?.constraints.length ? (
                  graph.constraints.map((c) => (
                    <span key={c.id} className="pill bg-slate-100 text-slate-700">
                      {c.kind}: {c.value}
                    </span>
                  ))
                ) : (
                  <Empty />
                )}
              </GraphSection>

              <GraphSection title="Goals">
                {graph?.goals.length ? (
                  <ul className="space-y-1">
                    {graph.goals.map((g) => (
                      <li key={g.id} className="text-sm text-slate-600">• {g.text}</li>
                    ))}
                  </ul>
                ) : (
                  <Empty />
                )}
              </GraphSection>
            </div>

            {graph && graph.recentObservations.length > 0 && (
              <div className="card">
                <h2 className="font-semibold">Recent signals</h2>
                <p className="text-xs text-slate-400">Longitudinal, append-only memory.</p>
                <ul className="mt-2 space-y-1">
                  {graph.recentObservations.slice(0, 6).map((o, i) => (
                    <li key={i} className="text-sm text-slate-600">• {o.content}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function GraphSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Empty() {
  return <span className="text-sm text-slate-400">—</span>;
}
