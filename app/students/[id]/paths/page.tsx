import Link from "next/link";
import { notFound } from "next/navigation";
import { requireParent, getOwnedStudent } from "@/lib/auth/parent";
import { AppHeader } from "@/components/AppHeader";
import { PathPicker } from "@/components/PathPicker";

export const dynamic = "force-dynamic";

export default async function PathsPage({
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
        <h1 className="mt-2 text-2xl font-bold">Project paths for {student.name}</h1>
        <p className="text-sm text-slate-500">
          Built from {student.name}&apos;s learner graph. Pick one and Sage will
          break it into weekly steps.
        </p>
        <PathPicker studentId={student.id} />
      </main>
    </div>
  );
}
