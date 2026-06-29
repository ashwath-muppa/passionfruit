import Link from "next/link";
import { requireParent } from "@/lib/auth/parent";
import { AppHeader } from "@/components/AppHeader";
import { StudentForm } from "@/components/StudentForm";

export const dynamic = "force-dynamic";

export default async function NewStudentPage() {
  const parent = await requireParent();
  return (
    <div className="min-h-screen">
      <AppHeader parentEmail={parent.email} />
      <main className="mx-auto max-w-xl px-6 py-10">
        <Link href="/dashboard" className="text-[13px] font-semibold text-passionfruit-muted">← Back</Link>
        <h1 className="mt-3 font-display text-[26px] font-semibold text-passionfruit-ink">Add a student profile</h1>
        <p className="text-[13px] text-passionfruit-muted">
          This profile belongs to your account. Next, you&apos;ll do a short,
          parent-assisted intake chat together.
        </p>
        <StudentForm />
      </main>
    </div>
  );
}
