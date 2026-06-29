// Email delivery seam (#8). Sends via Resend when RESEND_API_KEY is configured;
// otherwise degrades gracefully to an "on-screen" channel (logs the subject and
// reports back so the caller can show the content in the UI instead). NEVER
// throws — a missing key, a network error, or a non-2xx response all resolve to
// a well-typed result. No email SDK; plain fetch only.

import "server-only";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  ok: boolean;
  channel: "email" | "onscreen";
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/**
 * Best-effort transactional send. Returns the channel actually used so callers
 * can log it and tailor their UI ("Sent ✓" vs "shown here").
 */
export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  // No provider configured → on-screen fallback. This is the default in dev.
  if (!apiKey) {
    console.log("[digest:onscreen]", opts.subject);
    return { ok: true, channel: "onscreen" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Passionfruit <onboarding@resend.dev>",
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      }),
    });
    return { ok: res.ok, channel: "email" };
  } catch (err) {
    // Network/DNS/etc. — never bubble up; fall back to on-screen.
    console.log("[digest:onscreen]", opts.subject, "(email send failed)", err);
    return { ok: true, channel: "onscreen" };
  }
}
