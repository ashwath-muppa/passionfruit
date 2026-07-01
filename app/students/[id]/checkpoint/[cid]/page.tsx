// Mentor prep view (#9) — the credible, professional sheet a mentor reads
// before a capped checkpoint. Parent-owned access for the MVP (the mentor pool
// is recruited ahead of demand; a mentor-auth seam comes later). It pulls the
// learner-graph snapshot, the active project's progress, and the fixed rubric so
// the checkpoint runs to one bar: accountability, raise the bar, unblock,
// encourage — never do the work.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudentView } from "@/lib/auth/parent";
import { AppHeader } from "@/components/AppHeader";
import { getCheckpointPrep } from "@/lib/mentors/checkpoints";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  requested: "Requested",
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default async function CheckpointPrepPage({
  params,
}: {
  params: Promise<{ id: string; cid: string }>;
}) {
  const { id, cid } = await params;
  const { student, actor } = await requireStudentView(id);

  const prep = await getCheckpointPrep(cid);
  // notFound if the checkpoint doesn't exist or belongs to a different student
  // (don't leak across students even within the same parent).
  if (!prep || prep.checkpoint.studentId !== id) notFound();

  const { checkpoint, mentor, graph, progressPercent, rubric } = prep;
  const firstName = student.name.split(" ")[0] ?? student.name;

  const scheduled = checkpoint.scheduledAt
    ? new Date(checkpoint.scheduledAt).toLocaleString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const interests = graph.interests.slice(0, 6);
  const strengths = graph.strengths.slice(0, 6);
  const goals = graph.goals;
  const constraints = graph.constraints;

  return (
    <div className="min-h-screen">
      <AppHeader parentEmail={actor.role === "parent" ? actor.parent.email : student.name} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link href={`/students/${id}`} className="text-[13px] font-semibold text-passionfruit-muted">
          ← {firstName}
        </Link>

        {/* Header */}
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <span className="eyebrow">Mentor prep sheet</span>
          <span className="chip-eyebrow bg-passionfruit-wash text-passionfruit-accentInk">
            {STATUS_LABEL[checkpoint.status] ?? checkpoint.status}
          </span>
          <span className="text-[11px] text-passionfruit-faint">Term {checkpoint.term}</span>
        </div>
        <h1 className="mt-1.5 font-display text-[26px] font-semibold leading-tight text-passionfruit-ink">
          Checkpoint prep · {firstName}
        </h1>
        {scheduled ? (
          <p className="mt-1 text-[13px] text-passionfruit-muted">Scheduled for {scheduled}</p>
        ) : (
          <p className="mt-1 text-[13px] text-passionfruit-muted">
            Requested — confirm a time with the family.
          </p>
        )}

        {/* Mentor */}
        <div className="card-sheet mt-5 p-4">
          <div className="eyebrow">Mentor on this checkpoint</div>
          {mentor ? (
            <div className="mt-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-[17px] font-semibold text-passionfruit-ink">
                  {mentor.name}
                </span>
                {mentor.credential && (
                  <span className="pill-accent">{mentor.credential}</span>
                )}
                {mentor.field && <span className="pill">{mentor.field}</span>}
              </div>
              {mentor.bio && (
                <p className="mt-2 text-[13px] leading-[1.55] text-passionfruit-muted">{mentor.bio}</p>
              )}
            </div>
          ) : (
            <p className="mt-1.5 text-[13px] text-passionfruit-muted">
              A mentor will be matched to {firstName}&apos;s field before the checkpoint.
            </p>
          )}
        </div>

        {/* The context a mentor needs */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* Learner graph snapshot */}
          <div className="card">
            <h2 className="font-display text-[15px] font-semibold text-passionfruit-ink">
              Who {firstName} is
            </h2>

            <div className="mt-3">
              <div className="eyebrow">Interests</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {interests.length > 0 ? (
                  interests.map((i) => (
                    <span key={i.id} className="pill-accent">
                      {i.label}
                    </span>
                  ))
                ) : (
                  <span className="text-[12px] text-passionfruit-faint">No interests recorded yet.</span>
                )}
              </div>
            </div>

            <div className="mt-3">
              <div className="eyebrow">Strengths</div>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {strengths.length > 0 ? (
                  strengths.map((s) => (
                    <li key={s.id} className="text-[13px] leading-[1.5] text-passionfruit-body">
                      <span className="font-semibold">{s.label}</span>
                      {s.evidence && (
                        <span className="text-passionfruit-muted"> — {s.evidence}</span>
                      )}
                    </li>
                  ))
                ) : (
                  <li className="text-[12px] text-passionfruit-faint">No strengths recorded yet.</li>
                )}
              </ul>
            </div>

            {goals.length > 0 && (
              <div className="mt-3">
                <div className="eyebrow">Goals</div>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {goals.map((g) => (
                    <li key={g.id} className="flex items-start gap-1.5 text-[13px] leading-[1.5] text-passionfruit-body">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-passionfruit-gold" />
                      <span>{g.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {constraints.length > 0 && (
              <div className="mt-3">
                <div className="eyebrow">Constraints to respect</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {constraints.map((c) => (
                    <span key={c.id} className="pill">
                      {c.value}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Project + progress */}
          <div className="card">
            <h2 className="font-display text-[15px] font-semibold text-passionfruit-ink">
              What they&apos;re building
            </h2>
            <div className="mt-3">
              <div className="eyebrow">Project progress</div>
              <div className="mt-2 flex items-center gap-2.5">
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-passionfruit-sunk">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${progressPercent}%`,
                      background: "linear-gradient(90deg,#E8694A,#D4533A)",
                    }}
                  />
                </div>
                <span className="text-[13px] font-bold text-passionfruit-ink">{progressPercent}%</span>
              </div>
            </div>

            {graph.recentObservations.length > 0 && (
              <div className="mt-4">
                <div className="eyebrow">Recent signals</div>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {graph.recentObservations.slice(0, 5).map((o, i) => (
                    <li key={i} className="text-[12px] leading-[1.5] text-passionfruit-muted">
                      {o.content}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {checkpoint.notes && (
              <div className="mt-4">
                <div className="eyebrow">Notes</div>
                <p className="mt-1.5 text-[13px] leading-[1.5] text-passionfruit-body">
                  {checkpoint.notes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* The rubric — the bar every checkpoint runs to */}
        <div className="card-sheet mt-4 p-4">
          <h2 className="font-display text-[16px] font-semibold text-passionfruit-ink">
            A good checkpoint:
          </h2>
          <ul className="mt-2.5 flex flex-col gap-2">
            {rubric.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-passionfruit-wash text-[11px] font-bold text-passionfruit-accentInk"
                  aria-hidden
                >
                  ✓
                </span>
                <span className="text-[14px] leading-[1.5] text-passionfruit-body">{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-passionfruit-line pt-3 text-[12px] leading-[1.5] text-passionfruit-faint">
            Mentor time is capped on purpose. Your job is to raise the bar and unblock —
            {firstName} does the work. That&apos;s what makes the win theirs.
          </p>
        </div>
      </main>
    </div>
  );
}
