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
        <Link href="/dashboard" className="text-sm text-brand-600">← Back</Link>
        <h1 className="mt-3 text-2xl font-bold">Add a student profile</h1>
        <p className="text-sm text-slate-500">
          This profile belongs to your account. Next, you&apos;ll do a short,
          parent-assisted intake chat together.
        </p>
        <StudentForm />
      </main>
    </div>
  );
}
