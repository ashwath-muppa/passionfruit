import Link from "next/link";

export function AppHeader({ parentEmail }: { parentEmail: string }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/dashboard" className="font-bold text-brand-700">
          Passionfruit
        </Link>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="hidden sm:inline">{parentEmail}</span>
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="btn-ghost px-3 py-1.5 text-xs">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
