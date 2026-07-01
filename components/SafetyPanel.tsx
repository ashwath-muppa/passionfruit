// Safety & consent (DESIGN.md §9) — the parent-only reassurance surface for the
// oversight dashboard. Two calm rows: consent-on-file status (COPPA/FERPA) and
// the escalation queue. Designed as peace of mind, not a warning: the common
// case (no flags) reads as "all clear." Display-only; safe as a server component.

import type { OpenSafetyFlag } from "@/lib/db/queries";

interface SafetyPanelProps {
  consent: {
    parentalConsent: boolean;
    under13: boolean;
    consentAt: Date | null;
  };
  flags: OpenSafetyFlag[];
}

const DATE_FMT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", DATE_FMT);
}

type Severity = OpenSafetyFlag["severity"];

/** Severity → pill styling. high = accent/red, medium = gold, low = muted. */
function severityPillClass(severity: Severity): string {
  const base = "chip-eyebrow";
  switch (severity) {
    case "high":
      return `${base} bg-passionfruit-wash text-passionfruit-accentInk`;
    case "medium":
      return `${base} bg-[#FBEFD3] text-[#8A6410]`;
    case "low":
    default:
      return `${base} bg-passionfruit-sunk text-passionfruit-faint`;
  }
}

function truncate(text: string, max = 90): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}…`;
}

export function SafetyPanel({ consent, flags }: SafetyPanelProps) {
  const { parentalConsent, under13, consentAt } = consent;

  return (
    <div className="card-sheet">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-[16px] font-semibold text-passionfruit-ink">
          Safety &amp; consent
        </h3>
        <span className="chip-eyebrow bg-passionfruit-sunk text-passionfruit-faint">
          COPPA · FERPA
        </span>
      </div>
      <p className="mt-1 text-[12px] leading-[1.5] text-passionfruit-faint">
        Every AI moment is safety-checked and logged. You see what we see.
      </p>

      {/* Consent on file */}
      <div className="mt-3.5 rounded-card border border-passionfruit-line bg-passionfruit-paper p-3.5">
        {parentalConsent ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#E4F1E4] text-[11px] leading-none text-[#2F7A44]">
              ✓
            </span>
            <span className="text-[13px] font-bold text-[#2F7A44]">Consent on file</span>
            {consentAt && (
              <span className="text-[12px] text-passionfruit-faint">
                · granted {formatDate(consentAt)}
              </span>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#FBEFD3] text-[11px] leading-none text-[#8A6410]">
              !
            </span>
            <span className="text-[13px] font-bold text-[#8A6410]">No consent on file</span>
          </div>
        )}
        {under13 && (
          <p className="mt-2 text-[11px] font-medium text-passionfruit-faint">
            Under 13 · COPPA protections applied to every session.
          </p>
        )}
      </div>

      {/* Escalation queue */}
      <div className="mt-3">
        <p className="eyebrow mb-2">Escalation queue</p>
        {flags.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-card border border-passionfruit-line bg-passionfruit-paper p-3.5">
            <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-[#E4F1E4] text-[12px] leading-none text-[#2F7A44]">
              ✓
            </span>
            <div>
              <p className="text-[13px] font-bold text-passionfruit-body">
                All clear — nothing has been flagged
              </p>
              <p className="text-[12px] text-passionfruit-faint">
                We&apos;ll surface anything that needs your attention here.
              </p>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {flags.map((flag) => (
              <li
                key={flag.id}
                className="rounded-card border border-passionfruit-line bg-passionfruit-paper p-3.5"
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={severityPillClass(flag.severity)}>{flag.severity}</span>
                  {flag.categories.map((category) => (
                    <span key={category} className="pill">
                      {category}
                    </span>
                  ))}
                  <span className="ml-auto text-[11px] font-medium text-passionfruit-faint">
                    {formatDate(flag.createdAt)}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-[1.45] text-passionfruit-muted">
                  {truncate(flag.content)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
