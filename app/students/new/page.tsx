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
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="text-[13px] font-semibold text-passionfruit-muted">← Back</Link>
        <h1 className="mt-3 font-display text-[26px] font-semibold text-passionfruit-ink">Add a student profile</h1>
        <p className="max-w-2xl text-[13px] text-passionfruit-muted">
          This profile belongs to your account. Next, you&apos;ll do a short,
          parent-assisted intake chat together.
        </p>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="max-w-3xl">
            <StudentForm />
          </div>

          <aside className="hidden lg:block">
            <div className="card-sheet p-6">
              <span className="eyebrow">What happens next</span>
              <ol className="mt-4 space-y-4">
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-passionfruit-wash text-[13px] font-semibold text-passionfruit-accentInk">
                    1
                  </span>
                  <div>
                    <h3 className="text-[14px] font-semibold text-passionfruit-ink">Intake</h3>
                    <p className="mt-0.5 text-[12px] text-passionfruit-muted">
                      A short, parent-assisted chat builds the learner graph of interests and skills.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-passionfruit-wash text-[13px] font-semibold text-passionfruit-accentInk">
                    2
                  </span>
                  <div>
                    <h3 className="text-[14px] font-semibold text-passionfruit-ink">Paths</h3>
                    <p className="mt-0.5 text-[12px] text-passionfruit-muted">
                      Passionfruit proposes project paths tuned to what lights your child up.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-passionfruit-wash text-[13px] font-semibold text-passionfruit-accentInk">
                    3
                  </span>
                  <div>
                    <h3 className="text-[14px] font-semibold text-passionfruit-ink">Plan</h3>
                    <p className="mt-0.5 text-[12px] text-passionfruit-muted">
                      A weekly plan turns the chosen path into real, finished work.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
