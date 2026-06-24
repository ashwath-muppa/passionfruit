"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StudentForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [grade, setGrade] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const under13 = typeof age === "number" && age < 13;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (under13 && !consent) {
      setError("Parental consent is required for children under 13 (COPPA).");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          age: typeof age === "number" ? age : undefined,
          grade: grade || undefined,
          parentalConsent: consent,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create student");
      router.push(`/students/${data.studentId}/intake`);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mt-6 space-y-4">
      <div>
        <label className="label" htmlFor="name">Student&apos;s name</label>
        <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="age">Age</label>
          <input
            id="age"
            type="number"
            min={8}
            max={18}
            className="input"
            value={age}
            onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="grade">Grade</label>
          <input id="grade" className="input" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. 7" />
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span className="text-slate-700">
          I am this child&apos;s parent or legal guardian and I consent to their use of
          Next in Research.
          {under13 && (
            <strong className="block text-amber-700">
              Required for children under 13 (COPPA).
            </strong>
          )}
        </span>
      </label>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? "Creating…" : "Create profile & start intake"}
      </button>
    </form>
  );
}
