import Link from "next/link";
import { notFound } from "next/navigation";
import { requireParent, getOwnedStudent } from "@/lib/auth/parent";
import { getLearnerGraphSnapshot } from "@/lib/db/queries";
import { PathPicker } from "@/components/PathPicker";
import { PhoneFrame } from "@/components/PhoneFrame";
import { StudentAvatar } from "@/components/StudentAvatar";

export const dynamic = "force-dynamic";

export default async function PathsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireParent();
  const student = await getOwnedStudent(id);
  if (!student) notFound();

  const graph = await getLearnerGraphSnapshot(id);
  const spark = graph?.interests[0]?.label.toLowerCase() ?? null;

  return (
    <main className="mx-auto min-h-screen max-w-[392px] px-4 py-8">
      <div className="mb-4 px-1">
        <Link href={`/students/${id}`} className="text-[13px] font-semibold text-passionfruit-muted">
          ← {student.name}
        </Link>
      </div>
      <PhoneFrame>
        {/* brand row */}
        <div className="flex items-center justify-between px-[22px] pb-1 pt-1.5">
          <div className="flex items-center gap-2">
            <div className="h-[22px] w-[22px] rounded-[7px] bg-passionfruit-accent" />
            <span className="font-display text-[18px] font-semibold text-passionfruit-ink">Passionfruit</span>
          </div>
          <StudentAvatar name={student.name} size={34} />
        </div>
        <PathPicker studentId={student.id} studentName={student.name} spark={spark} />
      </PhoneFrame>
    </main>
  );
}
