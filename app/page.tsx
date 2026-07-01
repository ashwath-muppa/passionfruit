import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
        {/* LEFT: brand + headline + CTAs */}
        <div>
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
        </div>

        {/* RIGHT: decorative preview panel (hidden on mobile) */}
        <div aria-hidden className="relative hidden lg:block">
          <div className="rounded-sheet border border-passionfruit-line bg-passionfruit-card p-6 shadow-frame">
            {/* learner header */}
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-passionfruit-accent font-display text-lg font-semibold text-white">
                M
              </span>
              <div className="flex-1">
                <div className="font-display text-[15px] font-semibold text-passionfruit-ink">Maya, grade 7</div>
                <div className="text-[12px] text-passionfruit-faint">Learner graph · 3 active paths</div>
              </div>
              <span className="rounded-full bg-passionfruit-gold/20 px-2.5 py-1 text-[11px] font-medium text-passionfruit-ink">
                on track
              </span>
            </div>

            {/* project paths */}
            <div className="mt-5 space-y-3">
              <div className="rounded-[15px] border border-passionfruit-line bg-passionfruit-paper p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-passionfruit-ink">Build a tide-pool field guide</span>
                  <span className="h-2.5 w-2.5 rounded-full bg-passionfruit-accent" />
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-passionfruit-line">
                  <span className="block h-full w-3/4 rounded-full bg-passionfruit-accent" />
                </div>
                <div className="mt-2 text-[11px] text-passionfruit-faint">Week 6 of 8 · marine biology</div>
              </div>

              <div className="rounded-[15px] border border-passionfruit-line bg-passionfruit-paper p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-passionfruit-ink">Compose a game soundtrack</span>
                  <span className="h-2.5 w-2.5 rounded-full bg-passionfruit-gold" />
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-passionfruit-line">
                  <span className="block h-full w-2/5 rounded-full bg-passionfruit-gold" />
                </div>
                <div className="mt-2 text-[11px] text-passionfruit-faint">Week 2 of 5 · music + code</div>
              </div>
            </div>
          </div>

          {/* floating mentor-note card */}
          <div className="absolute -bottom-6 -left-6 w-56 rounded-sheet border border-passionfruit-line bg-passionfruit-card p-4 shadow-frame">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-passionfruit-berry" />
              <span className="text-[11px] font-medium uppercase tracking-wide text-passionfruit-berry">Mentor note</span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-passionfruit-muted">
              Maya shipped her first data viz this week — momentum is real.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
