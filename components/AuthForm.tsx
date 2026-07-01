"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/auth/supabase-browser";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createSupabaseBrowserClient();

    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push("/go");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* LEFT: branded panel — hidden on mobile, fills its half on lg */}
      <div className="hidden bg-gradient-to-br from-passionfruit-accent to-passionfruit-accentDeep lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold text-white">
          <span className="h-[22px] w-[22px] rounded-[7px] bg-white/90" /> Passionfruit
        </Link>
        <div>
          <h2 className="font-display text-[34px] font-semibold leading-tight text-white">
            {isSignup ? "Start something worth sharing." : "Welcome back."}
          </h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/85">
            A warm little home for your child&apos;s best work — kept, celebrated, and shared with the people who matter.
          </p>
        </div>
        <p className="text-[13px] text-white/70">Made with Passionfruit 🌱</p>
      </div>

      {/* RIGHT: the form card, vertically centered */}
      <div className="flex min-h-screen items-center justify-center p-6 lg:min-h-full">
        <div className="w-full max-w-md">
          <Link href="/" className="flex items-center gap-2 text-[13px] font-semibold text-passionfruit-muted lg:hidden">
            <span className="h-[18px] w-[18px] rounded-[6px] bg-passionfruit-accent" /> ← Passionfruit
          </Link>
          <div className="card-sheet mt-4 p-6 lg:mt-0">
            <h1 className="font-display text-[26px] font-semibold text-passionfruit-ink">
              {isSignup ? "Create your parent account" : "Welcome back"}
            </h1>
            <p className="mt-1 text-[13px] text-passionfruit-muted">
              {isSignup
                ? "You're the account holder. You'll add your child's profile next."
                : "Log in to your parent account."}
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              {isSignup && (
                <div>
                  <label className="label" htmlFor="name">Your name</label>
                  <input
                    id="name"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              )}
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  minLength={6}
                  required
                />
              </div>

              {error && (
                <p className="rounded-2xl bg-passionfruit-wash px-3 py-2 text-[13px] text-passionfruit-accentInk">
                  {error}
                </p>
              )}

              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? "Please wait…" : isSignup ? "Create account" : "Log in"}
              </button>
            </form>

            <p className="mt-4 text-center text-[13px] text-passionfruit-muted">
              {isSignup ? (
                <>Already have an account? <Link href="/login" className="font-semibold text-passionfruit-accentInk">Log in</Link></>
              ) : (
                <>New here? <Link href="/signup" className="font-semibold text-passionfruit-accentInk">Create an account</Link></>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
