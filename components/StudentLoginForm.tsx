"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";
import { studentUsernameToEmail } from "@/lib/auth/student-identity";

export function StudentLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: studentUsernameToEmail(username),
        password,
      });
      if (error) throw error;
      router.push("/go");
      router.refresh();
    } catch {
      setError("That username or password doesn't match. Try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-20 max-w-md px-6">
      <Link href="/" className="flex items-center gap-2 text-[13px] font-semibold text-passionfruit-muted">
        <span className="h-[18px] w-[18px] rounded-[6px] bg-passionfruit-accent" /> ← Passionfruit
      </Link>
      <div className="card-sheet mt-4 p-6">
        <h1 className="font-display text-[26px] font-semibold text-passionfruit-ink">
          Student log in
        </h1>
        <p className="mt-1 text-[13px] text-passionfruit-muted">
          Use the username your parent set up for you — not an email.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="username">Username</label>
            <input
              id="username"
              className="input"
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <p className="rounded-2xl bg-passionfruit-wash px-3 py-2 text-[13px] text-passionfruit-accentInk">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Please wait…" : "Log in"}
          </button>
        </form>

        <p className="mt-4 text-center text-[13px] text-passionfruit-muted">
          Are you a parent? <Link href="/login" className="font-semibold text-passionfruit-accentInk">Parent log in</Link>
        </p>
      </div>
    </div>
  );
}
