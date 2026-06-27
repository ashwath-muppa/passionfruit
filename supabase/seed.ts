// Seed script — demoable immediately after `npx supabase db reset`.
// Creates one demo PARENT account holding three STUDENTS with distinct interest
// profiles, each with a fully populated learner graph (interests, strengths,
// constraints, goals, longitudinal observations). Embeddings are generated when
// a real GEMINI_API_KEY is present; otherwise rows are seeded without vectors
// (structured path-matching still works).
//
// Run: npm run seed   (loads .env.local via node --env-file)

import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import {
  constraints,
  goals,
  interests,
  observations,
  parents,
  strengths,
  students,
} from "../lib/db/schema";

const DEMO_PARENT = {
  email: "demo.parent@example.com",
  password: "password123",
  name: "Demo Parent",
};

// ── env ──
const DATABASE_URL = process.env.DATABASE_URL!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS ?? "768");

if (!DATABASE_URL || !SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error(
    "Missing env. Need DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local.",
  );
}

const sql = postgres(DATABASE_URL, { max: 4 });
const db = drizzle(sql);
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── embeddings (best-effort) ──
const keyLooksReal =
  GEMINI_API_KEY.length > 0 && !GEMINI_API_KEY.startsWith("placeholder") && GEMINI_API_KEY !== "your-gemini-api-key";
let embeddingsDisabled = !keyLooksReal;

async function embed(text: string): Promise<number[] | null> {
  if (embeddingsDisabled) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text }] },
          outputDimensionality: EMBEDDING_DIMENSIONS,
        }),
      },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { embedding?: { values?: number[] } };
    return data.embedding?.values ?? null;
  } catch (err) {
    if (!embeddingsDisabled) {
      console.warn(`  ⚠ Embeddings disabled (${(err as Error).message}). Seeding without vectors.`);
      embeddingsDisabled = true;
    }
    return null;
  }
}

interface Profile {
  name: string;
  age: number;
  grade: string;
  interests: { label: string; category: string; strength: number }[];
  strengths: { label: string; evidence: string }[];
  constraints: { kind: "time" | "budget" | "location" | "other"; value: string }[];
  goals: { horizon: "short" | "long"; text: string }[];
  observations: string[];
}

const PROFILES: Profile[] = [
  {
    name: "Maya",
    age: 13,
    grade: "8",
    interests: [
      { label: "Soccer", category: "sports", strength: 0.95 },
      { label: "Data & statistics", category: "stem", strength: 0.7 },
      { label: "Spreadsheets", category: "stem", strength: 0.55 },
    ],
    strengths: [
      { label: "Organized", evidence: "Keeps detailed notes and trackers" },
      { label: "Persistent", evidence: "Practices a skill until it clicks" },
    ],
    constraints: [
      { kind: "time", value: "About 3 hours per week" },
      { kind: "budget", value: "Low — free tools only" },
      { kind: "location", value: "Suburban; access to a school field" },
    ],
    goals: [
      { horizon: "short", text: "Help her soccer team understand their performance better" },
      { horizon: "long", text: "Study sports science one day" },
    ],
    observations: [
      "Lights up when talking about her team's games.",
      "Already tracks her own practice stats by hand.",
    ],
  },
  {
    name: "Leo",
    age: 11,
    grade: "6",
    interests: [
      { label: "Video games", category: "technology", strength: 0.9 },
      { label: "Digital art", category: "creative", strength: 0.8 },
      { label: "Storytelling", category: "creative", strength: 0.6 },
    ],
    strengths: [
      { label: "Creative", evidence: "Invents detailed game worlds" },
      { label: "Fast learner", evidence: "Picks up new tools quickly" },
    ],
    constraints: [
      { kind: "time", value: "About 4 hours per week" },
      { kind: "location", value: "Has a laptop at home" },
      { kind: "budget", value: "Low" },
    ],
    goals: [
      { horizon: "short", text: "Make a small playable game" },
      { horizon: "long", text: "Become a game designer" },
    ],
    observations: [
      "Sketches characters constantly in a notebook.",
      "Prefers building things over following tutorials.",
    ],
  },
  {
    name: "Priya",
    age: 14,
    grade: "9",
    interests: [
      { label: "Environmental science", category: "stem", strength: 0.92 },
      { label: "Biology", category: "stem", strength: 0.8 },
      { label: "Public speaking", category: "humanities", strength: 0.6 },
    ],
    strengths: [
      { label: "Strong writer", evidence: "Wrote a class blog on recycling" },
      { label: "Leadership", evidence: "Organized a school cleanup" },
    ],
    constraints: [
      { kind: "time", value: "About 2 hours per week" },
      { kind: "budget", value: "Moderate" },
      { kind: "location", value: "Urban neighborhood" },
    ],
    goals: [
      { horizon: "short", text: "Raise awareness about local water quality" },
      { horizon: "long", text: "Become an environmental scientist" },
    ],
    observations: [
      "Cares deeply about her community.",
      "Comfortable speaking in front of groups.",
    ],
  },
];

async function ensureParentAuthUser(): Promise<string> {
  const created = await supabaseAdmin.auth.admin.createUser({
    email: DEMO_PARENT.email,
    password: DEMO_PARENT.password,
    email_confirm: true,
    user_metadata: { name: DEMO_PARENT.name },
  });
  if (created.data.user) return created.data.user.id;

  // Likely already exists — find it.
  const list = await supabaseAdmin.auth.admin.listUsers();
  const existing = list.data.users.find((u) => u.email === DEMO_PARENT.email);
  if (!existing) throw new Error(`Could not create or find demo parent: ${created.error?.message}`);
  return existing.id;
}

async function main() {
  console.log("Seeding Passionfruit demo data…");
  if (embeddingsDisabled) {
    console.log("  ℹ No real GEMINI_API_KEY — seeding without embeddings (set one and reseed for semantic recall).");
  }

  const authUserId = await ensureParentAuthUser();

  // Upsert the parent row.
  let [parent] = await db.select().from(parents).where(eq(parents.authUserId, authUserId)).limit(1);
  if (!parent) {
    [parent] = await db
      .insert(parents)
      .values({ authUserId, email: DEMO_PARENT.email, name: DEMO_PARENT.name })
      .returning();
  }
  const parentId = parent!.id;

  // Clean reseed: remove this parent's existing students (cascades the graph).
  await db.delete(students).where(eq(students.parentId, parentId));

  for (const p of PROFILES) {
    const [student] = await db
      .insert(students)
      .values({
        parentId,
        name: p.name,
        age: p.age,
        grade: p.grade,
        under13: p.age < 13,
        parentalConsent: true,
        consentAt: new Date(),
      })
      .returning();
    const studentId = student!.id;

    for (const i of p.interests) {
      await db.insert(interests).values({
        studentId,
        label: i.label,
        category: i.category,
        strength: i.strength,
        source: "seed",
        embedding: await embed(`${i.label} ${i.category}`),
      });
    }
    for (const s of p.strengths) {
      await db.insert(strengths).values({
        studentId,
        label: s.label,
        evidence: s.evidence,
        embedding: await embed(`${s.label} ${s.evidence}`),
      });
    }
    for (const c of p.constraints) {
      await db.insert(constraints).values({ studentId, kind: c.kind, value: c.value });
    }
    for (const g of p.goals) {
      await db.insert(goals).values({
        studentId,
        horizon: g.horizon,
        text: g.text,
        embedding: await embed(g.text),
      });
    }
    for (const content of p.observations) {
      await db.insert(observations).values({
        studentId,
        type: "seed_signal",
        content,
        source: "intake",
        embedding: await embed(content),
      });
    }

    console.log(`  ✓ ${p.name} (age ${p.age}) — graph seeded`);
  }

  console.log("\nDone. Log in with:");
  console.log(`  email:    ${DEMO_PARENT.email}`);
  console.log(`  password: ${DEMO_PARENT.password}`);
  console.log("\nThese students already have a learner graph, so you can jump straight to");
  console.log("'See project paths' for any of them.");

  await sql.end();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await sql.end();
  process.exit(1);
});
