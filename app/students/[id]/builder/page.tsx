import Link from "next/link";
import { requireStudentView } from "@/lib/auth/parent";
import { getLearnerGraphSnapshot } from "@/lib/db/queries";
import { AppHeader } from "@/components/AppHeader";
import { CourseBuilder } from "@/components/CourseBuilder";

export const dynamic = "force-dynamic";

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { student, actor } = await requireStudentView(id);

  const graph = await getLearnerGraphSnapshot(id);
  const spark = graph?.interests[0]?.label.toLowerCase() ?? null;
  const firstName = student.name.split(" ")[0] ?? student.name;

  return (
    <div className="min-h-screen">
      <AppHeader parentEmail={actor.role === "parent" ? actor.parent.email : student.name} />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-[22px] w-[22px] rounded-[7px] bg-passionfruit-accent" />
            <span className="font-display text-[17px] font-semibold text-passionfruit-ink">Passionfruit</span>
            <span className="border-l border-passionfruit-line pl-2.5 text-[10px] font-bold uppercase tracking-[1px] text-passionfruit-faint">
              Building your path
            </span>
          </div>
          <Link href={`/students/${id}`} className="text-[13px] font-semibold text-passionfruit-muted">
            ← {student.name}
          </Link>
        </div>
        <CourseBuilder studentId={id} studentName={firstName} spark={spark} />
      </main>
    </div>
  );
}
