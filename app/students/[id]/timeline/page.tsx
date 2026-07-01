import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudentView } from "@/lib/auth/parent";
import { getActiveProject } from "@/lib/db/queries";
import { PATH_TYPE_LABELS } from "@/lib/types";
import { AppHeader } from "@/components/AppHeader";
import { ProjectTimelineBoard } from "@/components/ProjectTimelineBoard";

export const dynamic = "force-dynamic";

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { student, actor } = await requireStudentView(id);

  const project = await getActiveProject(id);
  if (!project) redirect(`/students/${id}`);

  return (
    <div className="min-h-screen">
      <AppHeader parentEmail={actor.role === "parent" ? actor.parent.email : student.name} />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Link href={`/students/${id}`} className="text-[13px] font-semibold text-passionfruit-muted">
          ← {student.name}
        </Link>
        <div className="mt-4">
          <ProjectTimelineBoard
            title={project.project.title}
            studentName={student.name}
            studentId={id}
            deliverable={PATH_TYPE_LABELS[project.project.pathType]}
            milestones={project.milestones}
          />
        </div>
      </main>
    </div>
  );
}
