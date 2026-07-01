import Link from "next/link";
import { requireStudentView } from "@/lib/auth/parent";
import { AppHeader } from "@/components/AppHeader";
import { IntakeChat } from "@/components/IntakeChat";

export const dynamic = "force-dynamic";

export default async function IntakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { student, actor } = await requireStudentView(id);

  return (
    <div className="min-h-screen">
      <AppHeader parentEmail={actor.role === "parent" ? actor.parent.email : student.name} />
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href={`/students/${id}`} className="text-[13px] font-semibold text-passionfruit-muted">← {student.name}</Link>
        <h1 className="mt-2 font-display text-[26px] font-semibold text-passionfruit-ink">Intake with {student.name}</h1>
        <p className="mb-6 max-w-2xl text-[13px] text-passionfruit-muted">
          A short, friendly chat so Sage gets to know {student.name}. Sit together —
          this is parent-assisted. It populates {student.name}&apos;s learner graph.
        </p>
        <div className="grid gap-6 lg:grid-cols-[1fr_260px] lg:items-start">
          <div>
            <IntakeChat studentId={student.id} studentName={student.name} />
            <p className="mt-3 text-center text-[12px] text-passionfruit-faint">
              Prefer a quick, playful start?{" "}
              <Link href={`/students/${id}/builder`} className="font-semibold text-passionfruit-accentInk hover:underline">
                Try the spark quiz →
              </Link>
            </p>
          </div>
          <aside className="card p-5 lg:sticky lg:top-8">
            <p className="eyebrow mb-2">Why Sage asks</p>
            <p className="text-[13px] leading-relaxed text-passionfruit-muted">
              Each question helps Sage map {student.name}&apos;s interests, strengths, and
              curiosities into a learner graph. The richer the picture, the more tailored
              the project paths Sage can suggest next.
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-passionfruit-muted">
              There are no wrong answers — answer in {student.name}&apos;s own words, and
              feel free to go on tangents.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
