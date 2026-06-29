// Deadline & Calendar Engine (#4) — .ics export. GET serves the student's synced
// opportunities as an all-day calendar feed so deadlines land in the family's
// real calendar (Apple/Google/Outlook). Ownership-gated via requireParent +
// getOwnedStudent; force-dynamic since it reflects live opportunity rows.

import { requireParent, getOwnedStudent } from "@/lib/auth/parent";
import { getOpportunities } from "@/lib/db/queries";
import { toIcs } from "@/lib/calendar/deadlines";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireParent();
  const { id } = await params;

  const student = await getOwnedStudent(id);
  if (!student) return new Response("Not found", { status: 404 });

  const opportunities = await getOpportunities(id);
  const ics = toIcs(
    opportunities.map((o) => ({ title: o.title, whenHint: o.whenHint ?? "", url: null })),
  );

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="passionfruit.ics"',
    },
  });
}
