// The mentor moment (DESIGN.md §6) — the single most important component.
// Anywhere the AI speaks, render this: a named, signed note in the serif voice,
// never a chat bubble or typing indicator. Loading = a soft skeleton of itself.
//
// Note: the product's mentor persona is "Sage" (see lib/ai/prompts/persona.ts).
// The design mockups use a placeholder name ("Sol"); we keep the real persona.

import type { ReactNode } from "react";

export const MENTOR_NAME = "Sage";

/** The one accent-colored phrase per note — the "spark." */
export function Spark({ children }: { children: ReactNode }) {
  return <span className="text-passionfruit-accentInk">{children}</span>;
}

function Avatar({ size = 38 }: { size?: number }) {
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.47,
        background: "linear-gradient(140deg,#F2B23E,#E8694A)",
      }}
      aria-hidden
    >
      🌱
    </div>
  );
}

interface MentorNoteProps {
  /** Title override; defaults to "A note from {MENTOR_NAME}" (kid) or, for the
   *  parent variant, pass familyName to get "A note for the {family} family". */
  title?: string;
  familyName?: string;
  /** The serif voice. Wrap the emphasis phrase in <Spark>. */
  children?: ReactNode;
  variant?: "kid" | "parent";
  loading?: boolean;
  className?: string;
}

export function MentorNote({
  title,
  familyName,
  children,
  variant = "kid",
  loading = false,
  className = "",
}: MentorNoteProps) {
  const heading =
    title ??
    (variant === "parent" && familyName
      ? `A note for the ${familyName} family`
      : `A note from ${MENTOR_NAME}`);

  const tint =
    variant === "parent"
      ? "bg-passionfruit-wash border-passionfruit-accentLine"
      : "bg-passionfruit-card border-passionfruit-line shadow-sheet";

  return (
    <div className={`rounded-sheet border p-4 ${tint} ${className}`}>
      <div className="mb-2.5 flex items-center gap-2.5">
        <Avatar size={variant === "parent" ? 30 : 38} />
        <div>
          <div className="text-[13px] font-bold text-passionfruit-ink">{heading}</div>
          <div className="text-[11px] text-passionfruit-faint">your mentor</div>
        </div>
      </div>
      {loading ? (
        <div className="space-y-2" aria-label="Sage is writing">
          <div className="h-4 w-[92%] animate-pulse rounded bg-passionfruit-sunk" />
          <div className="h-4 w-[78%] animate-pulse rounded bg-passionfruit-sunk" />
          <div className="h-4 w-[55%] animate-pulse rounded bg-passionfruit-sunk" />
        </div>
      ) : (
        <div className="mentor-voice">{children}</div>
      )}
    </div>
  );
}
