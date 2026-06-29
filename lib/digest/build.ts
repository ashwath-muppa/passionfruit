// Builds the parent-facing digest emails (#8). The monthly note reuses the
// already-moderated, already-audited generateParentSummary() so there's zero
// founder labor; the weekly nudge is a single light "one small thing" prompt.
//
// Tone rule (the whole point of this feature): frame everything to help the
// parent ENCOURAGE, not pressure. The parent-nags → teen-resists backfire is the
// thing we're designing against, so the copy stays warm, low-stakes, and never
// turns a suggestion into a chore the parent must enforce.
//
// AI is best-effort: the dev Gemini key is free-tier and may be exhausted, so
// every model call is wrapped and we degrade to a simple name-derived fallback.

import "server-only";
import { generateParentSummary } from "@/lib/ai/tasks";
import type { ParentSummary } from "@/lib/types";

export interface BuiltMessage {
  subject: string;
  html: string;
  text: string;
}

// ── Email-safe styling. Inline only; conservative, table-free, system serif for
//    the heading to echo the Warm Paper display face without a webfont. ──
const PAPER = "#FBF6EE";
const INK = "#2C2420";
const BODY = "#3A2D27";
const MUTED = "#6F6258";
const ACCENT_INK = "#C2492C";
const WASH = "#FCE9E0";
const ACCENT_LINE = "#F4D9CC";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Split a body string into paragraphs on blank lines (or single newlines). */
function paragraphs(body: string): string[] {
  return body
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function shell(innerHtml: string): string {
  return `<div style="margin:0;padding:24px;background:${PAPER};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${BODY};">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid ${ACCENT_LINE};border-radius:16px;padding:28px;">
    ${innerHtml}
    <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:${MUTED};">
      From Sage, ${esc("your child's")} mentor at Passionfruit. Every AI moment is safety-checked and logged.
    </p>
  </div>
</div>`;
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;font-weight:600;color:${INK};">${esc(
    text,
  )}</h1>`;
}

function bodyHtml(body: string): string {
  return paragraphs(body)
    .map(
      (p) =>
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:${BODY};">${esc(p)}</p>`,
    )
    .join("\n    ");
}

function supportList(name: string, actions: string[]): string {
  if (actions.length === 0) return "";
  const items = actions
    .map(
      (a) =>
        `<li style="margin:0 0 8px;font-size:14px;line-height:1.55;color:${BODY};">${esc(a)}</li>`,
    )
    .join("\n      ");
  return `<div style="margin:18px 0 0;padding:16px 18px;background:${WASH};border:1px solid ${ACCENT_LINE};border-radius:12px;">
      <div style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${ACCENT_INK};">Ways to support ${esc(
        name,
      )} this week</div>
      <ul style="margin:0;padding-left:18px;">
      ${items}
      </ul>
    </div>`;
}

/** A gentle, low-pressure fallback when the model is unavailable. */
function fallbackSummary(name: string): ParentSummary {
  return {
    headline: `${name} is steadily building momentum`,
    body: `${name} has been showing up and chipping away at their project, and that consistency is exactly what compounds over time. Progress at this age rarely looks like a straight line — it's the steady, curious effort that matters most, and ${name} is putting that in.\n\nThe most powerful thing you can do is notice the effort out loud. A little genuine curiosity from you goes a long way, and it keeps this something ${name} gets to own rather than something they feel managed into.`,
    suggestedActions: [
      `Ask ${name} to show you one thing they worked on — and just be curious, no fixing needed.`,
      `Celebrate the effort, not only the outcome ("I love how you stuck with that").`,
      `Leave the next step to ${name}; your encouragement lands best when it doesn't feel like a nudge.`,
    ],
  };
}

/**
 * The monthly growth narrative. Reuses generateParentSummary (moderated +
 * audited); on any failure (quota, parse, etc.) falls back to a warm, generic
 * note so the parent always receives something of value.
 */
export async function buildMonthly(
  studentId: string,
  studentName: string,
): Promise<BuiltMessage> {
  let summary: ParentSummary;
  try {
    summary = await generateParentSummary({ studentId });
  } catch {
    summary = fallbackSummary(studentName);
  }

  const subject = `${studentName}'s month with Sage`;

  const inner = `${heading(summary.headline)}
    ${bodyHtml(summary.body)}
    ${supportList(studentName, summary.suggestedActions)}`;

  const html = shell(inner);

  const textParts = [
    summary.headline,
    "",
    ...paragraphs(summary.body),
  ];
  if (summary.suggestedActions.length > 0) {
    textParts.push("", `Ways to support ${studentName} this week:`);
    for (const a of summary.suggestedActions) textParts.push(`  • ${a}`);
  }
  textParts.push(
    "",
    `From Sage, your child's mentor at Passionfruit. Every AI moment is safety-checked and logged.`,
  );
  const text = textParts.join("\n");

  return { subject, html, text };
}

/**
 * The light weekly nudge: exactly one concrete, encouraging "one small thing"
 * the parent can do. Derived from a suggested action if the model is available,
 * otherwise a gentle generic. Deliberately short — a nudge, not a report.
 */
export async function buildWeeklyNudge(
  studentId: string,
  studentName: string,
): Promise<BuiltMessage> {
  let oneThing: string | null = null;
  try {
    const summary = await generateParentSummary({ studentId });
    oneThing = summary.suggestedActions.find((a) => a.trim().length > 0) ?? null;
  } catch {
    oneThing = null;
  }

  const action =
    oneThing ??
    `Ask ${studentName} what they're most curious about right now — then just listen. Your interest is the encouragement.`;

  const subject = `One small thing for ${studentName} this week`;

  const intro = `Hi! A tiny, no-pressure idea to help ${studentName} keep their momentum this week. Totally optional — the goal is encouragement, never another to-do.`;
  const closer = `That's it for this week. ${studentName} is doing the real work; you just get to cheer.`;

  const inner = `${heading(`One small thing for ${studentName}`)}
    <p style="margin:0 0 12px;font-size:15px;line-height:1.65;color:${BODY};">${esc(intro)}</p>
    <div style="margin:16px 0;padding:16px 18px;background:${WASH};border:1px solid ${ACCENT_LINE};border-radius:12px;">
      <div style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${ACCENT_INK};">This week</div>
      <p style="margin:0;font-size:15px;line-height:1.6;color:${INK};">${esc(action)}</p>
    </div>
    <p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:${MUTED};">${esc(closer)}</p>`;

  const html = shell(inner);

  const text = [
    `One small thing for ${studentName}`,
    "",
    intro,
    "",
    `This week: ${action}`,
    "",
    closer,
  ].join("\n");

  return { subject, html, text };
}
