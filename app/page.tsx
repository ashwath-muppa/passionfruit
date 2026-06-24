import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-600">
        Next in Research
      </p>
      <h1 className="text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
        A persistent AI mentor for ambitious middle-schoolers.
      </h1>
      <p className="mt-5 max-w-xl text-lg text-slate-600">
        We turn a kid&apos;s interests into real, portfolio-worthy projects — and
        keep a multi-year memory of how they grow. Parent-held accounts,
        safety-checked from day one.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/signup" className="btn-primary">
          Create a parent account
        </Link>
        <Link href="/login" className="btn-ghost">
          Log in
        </Link>
      </div>
      <p className="mt-12 text-xs text-slate-400">
        Prototype — first vertical slice. Signup → student profile → AI intake →
        project paths → weekly plan → parent dashboard.
      </p>
    </main>
  );
}
