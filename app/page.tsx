import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-16">
      <div className="mb-5 flex items-center gap-2.5">
        <span className="h-7 w-7 rounded-[9px] bg-passionfruit-accent" />
        <span className="font-display text-[22px] font-semibold text-passionfruit-ink">Passionfruit</span>
      </div>
      <h1 className="font-display text-4xl font-semibold leading-[1.08] tracking-[-0.5px] text-passionfruit-ink sm:text-[52px]">
        A persistent mentor for ambitious
        <span className="text-passionfruit-accentInk"> middle-schoolers</span>.
      </h1>
      <p className="mt-5 max-w-xl text-[17px] leading-relaxed text-passionfruit-muted">
        We turn a kid&apos;s interests into real, portfolio-worthy projects — and keep a multi-year
        memory of how they grow. Parent-held accounts, safety-checked from day one.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/signup" className="btn-primary">
          Create a parent account
        </Link>
        <Link href="/login" className="btn-ghost">
          Log in as parent
        </Link>
        <Link href="/login/student" className="btn-ghost">
          Log in as student
        </Link>
      </div>
      <p className="mt-12 text-[12px] text-passionfruit-faint">
        Signup → student profile → AI intake → project paths → weekly plan → parent dashboard.
      </p>
    </main>
  );
}
