// Deadline & Calendar Engine (#4) — pure, dependency-free heuristics.
//
// Turns a deliverable's free-text `cadence` string into 1–2 short, dated-ish
// reminder items, and renders a minimal-but-valid VCALENDAR (.ics) so the
// family's real calendar catches the fall registration windows they otherwise
// miss (AMC in Nov; MATHCOUNTS/Science Olympiad/USACO/Congressional App, etc.).
//
// No DB, no "server-only": safe to unit-test and to import from anywhere.

import type { Deliverable } from "@/lib/db/schema";

export interface ReminderItem {
  title: string;
  whenHint: string;
  kind: "deadline" | "window";
}

// Long → short month label, matched case-insensitively in the cadence text.
const MONTHS: { re: RegExp; label: string }[] = [
  { re: /\bjan(uary)?\b/i, label: "January" },
  { re: /\bfeb(ruary)?\b/i, label: "February" },
  { re: /\bmar(ch)?\b/i, label: "March" },
  { re: /\bapr(il)?\b/i, label: "April" },
  { re: /\bmay\b/i, label: "May" },
  { re: /\bjun(e)?\b/i, label: "June" },
  { re: /\bjul(y)?\b/i, label: "July" },
  { re: /\baug(ust)?\b/i, label: "August" },
  { re: /\bsep(t|tember)?\b/i, label: "September" },
  { re: /\boct(ober)?\b/i, label: "October" },
  { re: /\bnov(ember)?\b/i, label: "November" },
  { re: /\bdec(ember)?\b/i, label: "December" },
];

/** First month name mentioned in the cadence text, or null. */
function firstMonth(text: string): string | null {
  let best: { label: string; index: number } | null = null;
  for (const m of MONTHS) {
    const match = m.re.exec(text);
    if (match && (best === null || match.index < best.index)) {
      best = { label: m.label, index: match.index };
    }
  }
  return best?.label ?? null;
}

/** Keep reminder titles short and scannable in the "Up next" card. */
function clip(s: string, max = 50): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + "…";
}

/**
 * Read a deliverable's `cadence` text into 1–2 reminder items. Heuristic, not
 * exact: surfaces the *action* (register / enter / submit) and a soft when-hint.
 * Returns [] only when there's no cadence to read.
 */
export function parseDeadlines(
  d: Pick<Deliverable, "name" | "cadence" | "url">,
): ReminderItem[] {
  const cadence = (d.cadence ?? "").trim();
  if (!cadence) return [];

  const lower = cadence.toLowerCase();
  const name = d.name;
  const items: ReminderItem[] = [];

  const month = firstMonth(cadence);
  const mentionsFall = /\bfall\b/.test(lower) || /register in the fall/.test(lower);
  const mentionsSpring = /\bspring\b/.test(lower);
  const mentionsWinter = /\bwinter\b/.test(lower);
  const isRolling = /\brolling\b/.test(lower);
  const isAnnual = /\bannual(ly)?\b/.test(lower);
  const isQuarterly = /\bquarterly\b/.test(lower);

  // Registration cue — the strategy note: families miss fall sign-ups.
  if (/register in the fall/.test(lower)) {
    items.push({ title: clip(`Register: ${name}`), whenHint: "by early fall", kind: "deadline" });
  } else if (/\bregister\b/.test(lower) && mentionsFall) {
    items.push({ title: clip(`Register: ${name}`), whenHint: "by early fall", kind: "deadline" });
  }

  // Rolling / anytime submissions → a window, not a hard deadline.
  if (isRolling) {
    items.push({
      title: clip(`Submit to ${name} when ready`),
      whenHint: "rolling — anytime",
      kind: "window",
    });
  }

  // A concrete month → an "Enter" deadline anchored to that month.
  if (items.length === 0 && month) {
    items.push({ title: clip(`Enter: ${name}`), whenHint: `around ${month}`, kind: "deadline" });
  }

  // Season-only cues (no explicit month) → soft seasonal deadline.
  if (items.length === 0 && (mentionsFall || mentionsSpring || mentionsWinter)) {
    const season = mentionsFall ? "fall" : mentionsSpring ? "spring" : "winter";
    items.push({ title: clip(`Enter: ${name}`), whenHint: `in the ${season}`, kind: "deadline" });
  }

  // Recurring cadences with no month/season anchor → a gentle window.
  if (items.length === 0 && (isAnnual || isQuarterly)) {
    items.push({
      title: clip(`Enter: ${name}`),
      whenHint: isAnnual ? "once a year" : "each quarter",
      kind: "window",
    });
  }

  // Fallback: cadence exists but matched no pattern — still surface one item.
  if (items.length === 0) {
    items.push({ title: clip(`Plan for ${name}`), whenHint: clip(cadence), kind: "window" });
  }

  // Cap at 2 short items.
  return items.slice(0, 2);
}

// ── .ics generation ──────────────────────────────────────────────────────────

export interface IcsItem {
  title: string;
  whenHint: string;
  url?: string | null;
}

/** Escape per RFC 5545 text rules (backslash, semicolon, comma, newlines). */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

/** yyyymmdd in UTC for a Date. */
function dateStamp(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** yyyymmddThhmmssZ in UTC for DTSTAMP. */
function utcStamp(date: Date): string {
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${dateStamp(date)}T${hh}${mm}${ss}Z`;
}

/** A short, stable, ASCII-safe UID seed from the title. */
function slugifyUid(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "event";
}

/**
 * Minimal valid VCALENDAR: one all-day VEVENT per item. Exact dates are fuzzy,
 * so every event lands on a soft placeholder ~30 days out; the real timing lives
 * in the whenHint carried in DESCRIPTION. Families can drag the event later.
 */
export function toIcs(items: IcsItem[]): string {
  const now = new Date();
  const soft = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const dtstamp = utcStamp(now);
  const dtstart = dateStamp(soft);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Passionfruit//Deadline Engine//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  items.forEach((item, i) => {
    const descParts = [item.whenHint, item.url ?? ""].filter((s) => s && s.trim());
    const description = descParts.join(" — ");
    const uid = `${slugifyUid(item.title)}-${i}@passionfruit`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${dtstart}`,
      `SUMMARY:${escapeText(item.title)}`,
      `DESCRIPTION:${escapeText(description)}`,
      "END:VEVENT",
    );
  });

  lines.push("END:VCALENDAR");
  // RFC 5545 mandates CRLF line endings.
  return lines.join("\r\n") + "\r\n";
}
