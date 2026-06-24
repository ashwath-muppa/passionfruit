import Link from "next/link";
import { notFound } from "next/navigation";
import { requireParent, getOwnedStudent } from "@/lib/auth/parent";
import { AppHeader } from "@/components/AppHeader";
import { IntakeChat } from "@/components/IntakeChat";

export const dynamic = "force-dynamic";

export default async function IntakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parent = await requireParent();
  const student = await getOwnedStudent(id);
  if (!student) notFound();

  return (
    <div className="min-h-screen">
      <AppHeader parentEmail={parent.email} />
      <main className="mx-auto max-w-2xl px-6 py-8">
        <Link href={`/students/${id}`} className="text-sm text-brand-600">← {student.name}</Link>
        <h1 className="mt-2 text-2xl font-bold">Intake with {student.name}</h1>
        <p className="mb-4 text-sm text-slate-500">
          A short, friendly chat so Sage gets to know {student.name}. Sit together —
          this is parent-assisted. It populates {student.name}&apos;s learner graph.
        </p>
        <IntakeChat studentId={student.id} studentName={student.name} />
      </main>
    </div>
  );
}
