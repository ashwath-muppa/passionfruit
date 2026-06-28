"use client";

// Course Builder — the "spark" quiz (DESIGN.md / "Course Builder.dc.html"). A
// short, gamified front door that surfaces skills live as the kid answers, then
// reveals that paths are ready. On finish it persists the discovered skills to
// the learner graph and routes to /paths.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { hueForCategory } from "@/lib/ui";
import { MentorNote, Spark } from "@/components/MentorNote";

type Cat = "data" | "story" | "craft";
interface Opt {
  id: string;
  emoji: string;
  label: string;
  desc: string;
  tag: { label: string; category: string };
}
interface Question {
  emoji: string;
  heading: string;
  sub: string;
  mentor: string;
  opts: Opt[];
}

// Category tag → graph category (drives the hue via hueForCategory).
const TAG_CATEGORY: Record<Cat, string> = { data: "stem", story: "humanities", craft: "creative" };

function questions(spark: string): Question[] {
  return [
    {
      emoji: "✨",
      heading: "When you're really into something, what grabs you?",
      sub: `Pick the one that feels most like you${spark ? ` — think about ${spark}` : ""}.`,
      mentor: "Let's start with what you love. When you're deep in it, what are you really paying attention to?",
      opts: [
        { id: "stats", emoji: "📊", label: "The numbers", desc: "Patterns, stats, trends", tag: { label: "Data analysis", category: TAG_CATEGORY.data } },
        { id: "drama", emoji: "🎭", label: "The drama", desc: "Stories, twists, stakes", tag: { label: "Storytelling", category: TAG_CATEGORY.story } },
        { id: "tactics", emoji: "🧠", label: "The systems", desc: "How it all fits together", tag: { label: "Systems thinking", category: TAG_CATEGORY.data } },
        { id: "flair", emoji: "🎨", label: "The look", desc: "Style and craft", tag: { label: "Design eye", category: TAG_CATEGORY.craft } },
        { id: "people", emoji: "🗣️", label: "The people", desc: "Stories behind it", tag: { label: "Empathy", category: TAG_CATEGORY.story } },
        { id: "energy", emoji: "🎉", label: "The energy", desc: "Big moments, crowds", tag: { label: "Audience sense", category: TAG_CATEGORY.craft } },
      ],
    },
    {
      emoji: "🛠️",
      heading: "How do you like to figure things out?",
      sub: "Think about the last time you got really into something.",
      mentor: "Good. Now — when something puzzles you, how do you crack it open?",
      opts: [
        { id: "patterns", emoji: "🔢", label: "Spot patterns", desc: "Find the hidden trend", tag: { label: "Data analysis", category: TAG_CATEGORY.data } },
        { id: "write", emoji: "✍️", label: "Write it out", desc: "Think by writing", tag: { label: "Writing", category: TAG_CATEGORY.story } },
        { id: "sketch", emoji: "📐", label: "Sketch it", desc: "Draw the idea", tag: { label: "Visualization", category: TAG_CATEGORY.craft } },
        { id: "talk", emoji: "🗣️", label: "Talk it through", desc: "Out loud with others", tag: { label: "Collaboration", category: TAG_CATEGORY.story } },
        { id: "build", emoji: "🧩", label: "Build and test", desc: "Trial and error", tag: { label: "Tinkering", category: TAG_CATEGORY.data } },
        { id: "read", emoji: "📚", label: "Read up first", desc: "Learn, then do", tag: { label: "Research", category: TAG_CATEGORY.craft } },
      ],
    },
    {
      emoji: "🎯",
      heading: "What would you be proud to show people?",
      sub: "Imagine it's done. What are you handing them?",
      mentor: "Last big one. Picture the finish line — what do you want to have made?",
      opts: [
        { id: "chart", emoji: "📈", label: "A live chart", desc: "They can play with it", tag: { label: "Data viz", category: TAG_CATEGORY.data } },
        { id: "story", emoji: "📰", label: "A data story", desc: "Changes their mind", tag: { label: "Data story", category: TAG_CATEGORY.story } },
        { id: "app", emoji: "📱", label: "A real app", desc: "People actually use", tag: { label: "Building apps", category: TAG_CATEGORY.data } },
        { id: "video", emoji: "🎬", label: "An explainer", desc: "A video that clicks", tag: { label: "Explaining", category: TAG_CATEGORY.craft } },
        { id: "comp", emoji: "🏆", label: "A win", desc: "Enter a competition", tag: { label: "Competing", category: TAG_CATEGORY.craft } },
        { id: "team", emoji: "🤝", label: "A team boost", desc: "Make the group better", tag: { label: "Leadership", category: TAG_CATEGORY.story } },
      ],
    },
    {
      emoji: "⏱️",
      heading: "How much time feels right?",
      sub: "You can always extend later — this just sets the pace.",
      mentor: "Almost there. How big do you want this first project to feel?",
      opts: [
        { id: "w4", emoji: "⚡", label: "4 weeks", desc: "Quick and focused", tag: { label: "Sprint pace", category: TAG_CATEGORY.craft } },
        { id: "w6", emoji: "🌱", label: "6 weeks", desc: "Room to grow", tag: { label: "Steady pace", category: TAG_CATEGORY.craft } },
        { id: "w8", emoji: "🛠️", label: "8 weeks", desc: "Build something real", tag: { label: "8-week build", category: TAG_CATEGORY.data } },
        { id: "sem", emoji: "🎓", label: "A semester", desc: "Go deep", tag: { label: "Deep dive", category: TAG_CATEGORY.data } },
      ],
    },
  ];
}

export function CourseBuilder({
  studentId,
  studentName,
  spark,
}: {
  studentId: string;
  studentName: string;
  spark: string | null;
}) {
  const router = useRouter();
  const qs = useMemo(() => questions(spark ?? ""), [spark]);
  const [qi, setQi] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const total = qs.length;
  const q = qs[qi]!;
  const selectedId = answers[qi];
  const answeredCount = Object.keys(answers).length;

  // Discovered skills (deduped, in answer order).
  const discovered = useMemo(() => {
    const seen = new Set<string>();
    const out: { label: string; category: string }[] = [];
    if (spark) {
      out.push({ label: spark, category: "stem" });
      seen.add(spark.toLowerCase());
    }
    Object.keys(answers)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((idx) => {
        const opt = qs[idx]?.opts.find((o) => o.id === answers[idx]);
        if (opt && !seen.has(opt.tag.label.toLowerCase())) {
          seen.add(opt.tag.label.toLowerCase());
          out.push(opt.tag);
        }
      });
    return out;
  }, [answers, qs, spark]);

  const pct = done ? 100 : Math.round(((qi + (selectedId ? 1 : 0)) / total) * 100);

  function pick(id: string) {
    setAnswers((a) => ({ ...a, [qi]: id }));
  }
  function next() {
    if (qi < total - 1) setQi(qi + 1);
    else setDone(true);
  }
  function back() {
    setDone(false);
    setQi(Math.max(0, qi - 1));
  }

  async function reveal() {
    setSubmitting(true);
    try {
      await fetch("/api/builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, skills: discovered }),
      });
    } catch {
      // Non-fatal: paths still generate from the existing graph.
    }
    router.push(`/students/${studentId}/paths`);
  }

  const cols = q.opts.length === 4 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3";

  return (
    <div className="grid gap-[22px] lg:grid-cols-[312px_1fr]">
      {/* LEFT RAIL */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-5 lg:self-start">
        <MentorNote
          title={done ? `A note from Sage` : `Sage`}
        >
          {done ? "That's everything I need." : q.mentor}
        </MentorNote>

        <div className="card">
          <div className="mb-1 flex items-center justify-between">
            <span className="eyebrow">Taking shape</span>
            <span className="text-[11px] font-bold text-passionfruit-accentInk">{discovered.length} found</span>
          </div>
          <div className="mb-3.5 font-display text-[18px] font-semibold text-passionfruit-ink">Your spark</div>
          <div className="flex flex-wrap gap-2">
            {discovered.map((s, i) => {
              const hue = hueForCategory(s.category);
              const fresh = i === discovered.length - 1 && i > 0;
              return (
                <span
                  key={s.label}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-bold ${fresh ? "animate-pf-pop" : ""}`}
                  style={{ background: hue.pillBg, color: hue.pillFg, borderColor: hue.pillBorder }}
                >
                  {s.label}
                </span>
              );
            })}
          </div>
          <div className="my-3 h-px bg-passionfruit-line" />
          <p className="text-[11.5px] leading-relaxed text-passionfruit-faint">
            {answeredCount === 0
              ? "Every answer adds to your spark — the mix becomes your project paths."
              : `Sage is mapping your spark into skills. ${discovered.length} so far.`}
          </p>
        </div>
      </div>

      {/* RIGHT MAIN */}
      <div>
        {!done ? (
          <div className="animate-pf-in">
            <div className="font-display text-[30px] font-semibold leading-[1.12] tracking-[-0.3px] text-passionfruit-ink">
              <span className="mr-2">{q.emoji}</span>
              {q.heading}
            </div>
            <div className="mb-[22px] mt-1.5 text-[13.5px] text-passionfruit-muted">{q.sub}</div>

            <div className={`grid gap-3.5 ${cols}`}>
              {q.opts.map((o) => {
                const sel = o.id === selectedId;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => pick(o.id)}
                    className={`relative min-h-[116px] rounded-[18px] p-[18px] text-left transition ${
                      sel
                        ? "-translate-y-0.5 border-2 border-passionfruit-accent bg-passionfruit-wash shadow-elev"
                        : "border border-passionfruit-line bg-passionfruit-card hover:border-passionfruit-accentLine"
                    }`}
                  >
                    {sel && (
                      <span className="absolute right-3 top-3 flex h-[22px] w-[22px] animate-pf-pop items-center justify-center rounded-full bg-passionfruit-accent text-[12px] font-extrabold text-white">
                        ✓
                      </span>
                    )}
                    <div className="mb-2.5 text-[32px] leading-none">{o.emoji}</div>
                    <div className="text-[14px] font-bold text-passionfruit-ink">{o.label}</div>
                    <div className="mt-0.5 text-[11.5px] text-passionfruit-faint">{o.desc}</div>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={back}
                disabled={qi === 0}
                className="text-[13px] font-semibold text-passionfruit-muted disabled:text-passionfruit-faint"
              >
                ‹ Back
              </button>
              <button
                type="button"
                onClick={next}
                disabled={!selectedId}
                className="btn-primary disabled:!bg-none disabled:!bg-passionfruit-sunk disabled:!text-passionfruit-faint disabled:!shadow-none"
              >
                {qi < total - 1 ? "Continue →" : "Build my paths →"}
              </button>
            </div>
          </div>
        ) : (
          <div className="animate-pf-in rounded-sheet border border-passionfruit-accentLine bg-passionfruit-card p-7 shadow-elev">
            <div className="mb-4 flex items-center gap-3">
              <div
                className="flex h-[50px] w-[50px] items-center justify-center rounded-full text-[24px]"
                style={{ background: "linear-gradient(140deg,#F2B23E,#E8694A)" }}
              >
                🌱
              </div>
              <div>
                <div className="text-[14px] font-bold text-passionfruit-ink">A note from Sage</div>
                <div className="text-[11.5px] text-passionfruit-faint">your mentor</div>
              </div>
            </div>
            <div className="max-w-[620px] font-display text-[25px] leading-[1.34] text-passionfruit-ink">
              I see it now, {studentName}. Three project paths fit how you think — all built around{" "}
              <Spark>your spark</Spark>.
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={reveal} disabled={submitting} className="btn-primary">
                {submitting ? "Getting them ready…" : "See your three paths →"}
              </button>
              <button
                onClick={() => {
                  setAnswers({});
                  setQi(0);
                  setDone(false);
                }}
                className="btn-soft"
              >
                Start over
              </button>
            </div>
          </div>
        )}

        {/* PROGRESS */}
        <div className="mt-[30px]">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="eyebrow">Progress</span>
            <span className="text-[12px] font-bold text-passionfruit-ink">{done ? "Complete" : `${pct}%`}</span>
          </div>
          <div className="relative h-[9px] overflow-hidden rounded-[9px] bg-passionfruit-lineSoft">
            <div
              className="absolute left-0 top-0 h-full rounded-[9px] transition-[width] duration-500"
              style={{ width: `${pct}%`, background: "linear-gradient(90deg,#E8694A,#D4533A)" }}
            />
          </div>
          <div className="mt-2.5 flex gap-1.5">
            {qs.map((qq, i) => {
              const isDone = done || i < qi || (i === qi && !!selectedId);
              const isCurrent = !done && i === qi;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-[10px] py-1 text-center text-[13px] ${
                    isCurrent ? "border border-passionfruit-accentLine bg-passionfruit-wash" : "border border-transparent"
                  }`}
                  style={{ opacity: isDone || isCurrent ? 1 : 0.35, filter: isDone || isCurrent ? "none" : "grayscale(1)" }}
                >
                  {qq.emoji}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
