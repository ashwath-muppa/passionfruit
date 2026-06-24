"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatMessage } from "@/lib/types";

export function IntakeChat({
  studentId,
  studentName,
}: {
  studentId: string;
  studentName: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(history: ChatMessage[]) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, messages: history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Something went wrong");
      setMessages((m) => [...m, { role: "mentor", text: data.reply }]);
      if (data.complete) setComplete(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  // Kick off with the mentor's opener (guarded against StrictMode double-run).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void send([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const next: ChatMessage[] = [...messages, { role: "student", text }];
    setMessages(next);
    setInput("");
    await send(next);
  }

  return (
    <div className="card flex h-[70vh] flex-col">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} text={m.text} mentorName="Sage" studentName={studentName} />
        ))}
        {loading && <Bubble role="mentor" text="…" mentorName="Sage" studentName={studentName} />}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
      </div>

      {complete ? (
        <div className="mt-4 rounded-xl bg-brand-50 p-4 text-center">
          <p className="text-sm text-brand-800">
            Nice — Sage has a great picture of {studentName}. Let&apos;s look at some
            project ideas.
          </p>
          <button
            className="btn-primary mt-3"
            onClick={() => router.push(`/students/${studentId}/paths`)}
          >
            See project paths →
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-4 flex gap-2">
          <input
            className="input"
            placeholder={`Type ${studentName}'s answer…`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn-primary" disabled={loading || !input.trim()}>
            Send
          </button>
        </form>
      )}
    </div>
  );
}

function Bubble({
  role,
  text,
  mentorName,
  studentName,
}: {
  role: "mentor" | "student";
  text: string;
  mentorName: string;
  studentName: string;
}) {
  const isMentor = role === "mentor";
  return (
    <div className={`flex ${isMentor ? "justify-start" : "justify-end"}`}>
      <div className={isMentor ? "max-w-[80%]" : "max-w-[80%] text-right"}>
        <p className="mb-1 text-xs font-semibold text-slate-400">
          {isMentor ? mentorName : studentName}
        </p>
        <div
          className={`whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm ${
            isMentor ? "bg-slate-100 text-slate-800" : "bg-brand-600 text-white"
          }`}
        >
          {text}
        </div>
      </div>
    </div>
  );
}
