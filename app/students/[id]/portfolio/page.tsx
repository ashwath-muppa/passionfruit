// Running Resume: the student's growing record of real accomplishments — upload
// work and watch completed-checkpoint deliverables collect here automatically.
// Route stays /portfolio. Parent-owned; share toggles live here.

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireParent, getOwnedStudent } from "@/lib/auth/parent";
import { getActiveProject } from "@/lib/db/queries";
import { getStudentArtifacts } from "@/lib/artifacts/store";
import { AppHeader } from "@/components/AppHeader";
import { ArtifactUpload } from "@/components/ArtifactUpload";
import { Portfolio } from "@/components/Portfolio";

export const dynamic = "force-dynamic";

export default async function PortfolioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parent = await requireParent();
  const student = await getOwnedStudent(id);
  if (!student) notFound();

  const [artifacts, project] = await Promise.all([
    getStudentArtifacts(id),
    getActiveProject(id),
  ]);

  const firstName = student.name.split(" ")[0] ?? student.name;
  const projectId = project?.project.id ?? null;

  return (
    <div className="min-h-screen">
      <AppHeader parentEmail={parent.email} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link
          href={`/students/${id}`}
          className="text-[13px] font-semibold text-passionfruit-muted hover:text-passionfruit-ink"
        >
          ← Back to dashboard
        </Link>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <span className="eyebrow">Running Resume</span>
            <h1 className="font-display text-[26px] font-semibold leading-tight text-passionfruit-ink">
              {firstName}&apos;s running resume
            </h1>
            <p className="mt-1 text-[13px] text-passionfruit-muted">
              Every accomplishment in one place — real, finished work you can see and share.
            </p>
          </div>
          {artifacts.length > 0 && (
            <span className="pill-accent">
              {artifacts.length} {artifacts.length === 1 ? "piece" : "pieces"}
            </span>
          )}
        </div>

        <div className="mt-5">
          <ArtifactUpload studentId={id} projectId={projectId} />
        </div>

        <div className="mt-6">
          <Portfolio studentId={id} artifacts={artifacts} canShare />
        </div>
      </main>
    </div>
  );
}
