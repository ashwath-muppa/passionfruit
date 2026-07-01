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
      <main className="mx-auto max-w-2xl px-6 py-8">
        <Link href={`/students/${id}`} className="text-[13px] font-semibold text-passionfruit-muted">← {student.name}</Link>
        <h1 className="mt-2 font-display text-[26px] font-semibold text-passionfruit-ink">Intake with {student.name}</h1>
        <p className="mb-4 text-[13px] text-passionfruit-muted">
          A short, friendly chat so Sage gets to know {student.name}. Sit together —
          this is parent-assisted. It populates {student.name}&apos;s learner graph.
        </p>
        <IntakeChat studentId={student.id} studentName={student.name} />
        <p className="mt-3 text-center text-[12px] text-passionfruit-faint">
          Prefer a quick, playful start?{" "}
          <Link href={`/students/${id}/builder`} className="font-semibold text-passionfruit-accentInk hover:underline">
            Try the spark quiz →
          </Link>
        </p>
      </main>
    </div>
  );
}
