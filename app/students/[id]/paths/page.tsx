import Link from "next/link";
import { notFound } from "next/navigation";
import { requireParent, getOwnedStudent } from "@/lib/auth/parent";
import { getLearnerGraphSnapshot, getLatestProjectPaths } from "@/lib/db/queries";
import { PathPicker } from "@/components/PathPicker";
import { AppHeader } from "@/components/AppHeader";

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

  const graph = await getLearnerGraphSnapshot(id);
  const spark = graph?.interests[0]?.label.toLowerCase() ?? null;
  // Serve the stored snapshot so a revisit renders instantly with no AI call.
  const initialPaths = await getLatestProjectPaths(id);

  return (
    <div className="min-h-screen">
      <AppHeader parentEmail={parent.email} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link href={`/students/${id}`} className="text-[13px] font-semibold text-passionfruit-muted">
          ← {student.name}
        </Link>
        <div className="mt-4">
          <PathPicker
            studentId={student.id}
            studentName={student.name}
            spark={spark}
            initialPaths={initialPaths}
          />
        </div>
      </main>
    </div>
  );
}
