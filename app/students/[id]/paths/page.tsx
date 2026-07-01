import Link from "next/link";
import { requireStudentView } from "@/lib/auth/parent";
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
  const { student, actor } = await requireStudentView(id);

  const graph = await getLearnerGraphSnapshot(id);
  const spark = graph?.interests[0]?.label.toLowerCase() ?? null;
  // Serve the stored snapshot so a revisit renders instantly with no AI call.
  const initialPaths = await getLatestProjectPaths(id);

  return (
    <div className="min-h-screen">
      <AppHeader parentEmail={actor.role === "parent" ? actor.parent.email : student.name} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
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
