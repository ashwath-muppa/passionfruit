// Intake prompts. Two jobs each turn:
//  1) a warm mentor REPLY (quality model) the student reads
//  2) a structured EXTRACTION (fast model) that feeds the learner graph
// Both share the conversation transcript as variable context.

import { MENTOR_PERSONA } from "./persona";
import { renderStudentHeader } from "./context";
import type { LearnerGraphSnapshot } from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/types";

function renderTranscript(messages: ChatMessage[]): string {
  if (!messages.length) return "(conversation hasn't started yet)";
  return messages
    .map((m) => `${m.role === "mentor" ? "Sage" : "Student"}: ${m.text}`)
    .join("\n");
}

const INTAKE_REPLY_GUIDE = `You are running a first-meeting INTAKE conversation to get to know this student.

Goal: in a natural, friendly chat, discover their INTERESTS, STRENGTHS, real-world CONSTRAINTS (time per week, budget, location/equipment), and GOALS.

How to do it well:
- Ask ONE good question at a time. Build on what they just said.
- Be specific and curious. Reflect back what you heard.
- Around 5–6 exchanges in, if you have a decent picture, warmly wrap up: tell them you've got a great sense of them and that you'll put together some project ideas. End that wrap-up message with the token [[INTAKE_COMPLETE]] on its own line.
- Otherwise keep gently exploring. Do not rush, do not interrogate.`;

export function intakeReplyPrompt(args: {
  student: LearnerGraphSnapshot["student"];
  messages: ChatMessage[];
}): { system: string; user: string } {
  const system = `${MENTOR_PERSONA}\n\n${INTAKE_REPLY_GUIDE}`;
  const user = `Student profile: ${renderStudentHeader(args.student)}

Conversation so far:
${renderTranscript(args.messages)}

Write Sage's next message. Just the message text.`;
  return { system, user };
}

export const INTAKE_EXTRACTION_SYSTEM = `You extract structured learner-profile signals from an intake conversation for an education product. Output STRICT JSON only.

Extract only what the student actually expressed or clearly implied. Do not invent. If a field has nothing, use an empty array.

Shape:
{
  "interests":   [{"label": string, "category": string, "strength": number 0..1}],
  "strengths":   [{"label": string, "evidence": string}],
  "constraints": [{"kind": "time"|"budget"|"location"|"other", "value": string}],
  "goals":       [{"horizon": "short"|"long", "text": string}],
  "observations":[string]   // notable signals worth remembering long-term
}`;

export function intakeExtractionPrompt(messages: ChatMessage[]): {
  system: string;
  user: string;
} {
  return {
    system: INTAKE_EXTRACTION_SYSTEM,
    user: `Conversation:\n${renderTranscript(messages)}\n\nExtract the JSON now.`,
  };
}

export const INTAKE_COMPLETE_TOKEN = "[[INTAKE_COMPLETE]]";
