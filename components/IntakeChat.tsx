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
    <div className="card-sheet flex h-[70vh] flex-col p-5">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <Turn key={i} role={m.role} text={m.text} studentName={studentName} />
        ))}
        {loading && <Turn role="mentor" loading studentName={studentName} />}
        {error && (
          <p className="rounded-2xl bg-passionfruit-wash px-3 py-2 text-[13px] text-passionfruit-accentInk">
            {error}
          </p>
        )}
      </div>

      {complete ? (
        <div className="mt-4 rounded-sheet border border-passionfruit-accentLine bg-passionfruit-wash p-4 text-center">
          <p className="mentor-voice text-[15px]">
            Nice — I&apos;ve got a great picture of {studentName}. Let&apos;s look at some project
            ideas.
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

function MentorAvatar() {
  return (
    <div
      className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[15px]"
      style={{ background: "linear-gradient(140deg,#F2B23E,#E8694A)" }}
      aria-hidden
    >
      🌱
    </div>
  );
}

function Turn({
  role,
  text,
  loading = false,
  studentName,
}: {
  role: "mentor" | "student";
  text?: string;
  loading?: boolean;
  studentName: string;
}) {
  if (role === "mentor") {
    return (
      <div className="flex gap-2.5">
        <MentorAvatar />
        <div className="flex-1">
          <p className="mb-0.5 text-[11px] font-bold text-passionfruit-faint">Sage · your mentor</p>
          {loading ? (
            <div className="space-y-2 pt-1" aria-label="Sage is writing">
              <div className="h-3.5 w-[88%] animate-pulse rounded bg-passionfruit-sunk" />
              <div className="h-3.5 w-[64%] animate-pulse rounded bg-passionfruit-sunk" />
            </div>
          ) : (
            <p className="mentor-voice whitespace-pre-wrap text-[16px]">{text}</p>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%]">
        <p className="mb-1 text-right text-[11px] font-bold text-passionfruit-faint">{studentName}</p>
        <div className="whitespace-pre-wrap rounded-2xl rounded-tr-sm bg-passionfruit-sunk px-4 py-2 text-[14px] text-passionfruit-body">
          {text}
        </div>
      </div>
    </div>
  );
}
