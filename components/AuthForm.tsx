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
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-20 max-w-md px-6">
      <Link href="/" className="text-sm font-semibold text-brand-600">
        ← Next in Research
      </Link>
      <div className="card mt-4">
        <h1 className="text-2xl font-bold">
          {isSignup ? "Create your parent account" : "Welcome back"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
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
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? "Please wait…" : isSignup ? "Create account" : "Log in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          {isSignup ? (
            <>Already have an account? <Link href="/login" className="text-brand-600">Log in</Link></>
          ) : (
            <>New here? <Link href="/signup" className="text-brand-600">Create an account</Link></>
          )}
        </p>
      </div>
    </div>
  );
}
