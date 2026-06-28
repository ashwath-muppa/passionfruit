import Link from "next/link";

export function AppHeader({ parentEmail }: { parentEmail: string }) {
  return (
    <header className="border-b border-passionfruit-line bg-passionfruit-paper/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="h-[22px] w-[22px] rounded-[7px] bg-passionfruit-accent" />
          <span className="font-display text-[19px] font-semibold text-passionfruit-ink">Passionfruit</span>
        </Link>
        <div className="flex items-center gap-3 text-sm text-passionfruit-muted">
          <span className="hidden sm:inline text-[12px] text-passionfruit-faint">{parentEmail}</span>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="btn-ghost px-3.5 py-1.5 text-xs">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
