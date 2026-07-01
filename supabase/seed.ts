// Seed script — demoable immediately after `npx supabase db reset`.
// Creates one demo PARENT account holding three STUDENTS with distinct interest
// profiles, each with a fully populated learner graph (interests, strengths,
// constraints, goals, longitudinal observations). Embeddings are generated when
// a real GEMINI_API_KEY is present; otherwise rows are seeded without vectors
// (structured path-matching still works).
//
// Run: npm run seed   (loads .env.local via node --env-file)

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import {
  constraints,
  deliverables,
  goals,
  interests,
  mentors,
  milestones,
  observations,
  opportunities,
  parents,
  projects,
  projectTargets,
  resources,
  skills,
  strengths,
  students,
} from "../lib/db/schema";
import type { CatalogEntry } from "../lib/deliverables/types";
import { studentUsernameToEmail } from "../lib/auth/student-identity";

const DEMO_PARENT = {
  email: "demo.parent@example.com",
  password: "password123",
  name: "Demo Parent",
};

// Demo student logins share one password; username = first name, lowercased.
const DEMO_STUDENT_PASSWORD = "password123";

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

interface SeedResource {
  kind: "course" | "program" | "portfolio" | "dataset" | "tool" | "competition" | "reading" | "other";
  title: string;
  provider: string;
  url: string;
  costNote: string;
  summary: string;
}

interface SeedMilestone {
  weekNo: number;
  title: string;
  detail: string;
  status: "todo" | "doing" | "done";
  kind: string;
  source: string;
  icon: string;
  coach?: string;
  dueHint?: string;
  // Functional-checkpoint type hint (course | build | creative | research) so
  // the timeline shows variety immediately; the rich detail is still generated
  // lazily on first open. Null = inferred at generation time.
  checkpointType?: "course" | "build" | "creative" | "research";
  resources?: SeedResource[];
}

interface Profile {
  name: string;
  age: number;
  grade: string;
  // Parent-set end-goal direction (#10): the parent steers, the student's
  // interests drive the "how".
  endGoalPref?: string;
  goalNote?: string;
  interests: { label: string; category: string; strength: number }[];
  strengths: { label: string; evidence: string }[];
  constraints: { kind: "time" | "budget" | "location" | "other"; value: string }[];
  goals: { horizon: "short" | "long"; text: string }[];
  observations: string[];
  skills: { label: string; category: string; progress: number }[];
  opportunities: { kind: "check_in" | "window" | "deadline"; title: string; whenHint?: string }[];
  project?: {
    pathType: "research" | "app" | "sports_analytics" | "creative" | "venture";
    title: string;
    summary: string;
    status: "proposed" | "active" | "done";
    // Slug of the catalog deliverable this project is anchored to (parent-approved).
    targetSlug?: string;
    milestones: SeedMilestone[];
  };
}

// Ingest the vetted deliverables catalog (global, idempotent by slug).
async function ingestDeliverables() {
  const file = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../lib/deliverables/catalog.json",
  );
  const entries = JSON.parse(readFileSync(file, "utf8")) as CatalogEntry[];
  for (const e of entries) {
    const embedding = await embed(`${e.name}. ${e.domains.join(", ")}. ${e.a2cInsight ?? ""}`);
    const row = {
      slug: e.slug,
      name: e.name,
      category: e.category,
      subtype: e.subtype ?? null,
      domains: e.domains,
      minGrade: e.minGrade ?? null,
      msAccessible: e.msAccessible,
      ageNote: e.ageNote ?? null,
      difficulty: e.difficulty,
      prestigeTier: e.prestigeTier,
      prerequisites: e.prerequisites ?? null,
      costBand: e.costBand,
      costNote: e.costNote ?? null,
      cadence: e.cadence ?? null,
      howToStart: e.howToStart ?? null,
      a2cInsight: e.a2cInsight ?? null,
      status: e.status,
      flags: e.flags,
      url: e.url ?? null,
      embedding,
    };
    await db
      .insert(deliverables)
      .values(row)
      .onConflictDoUpdate({ target: deliverables.slug, set: row });
  }
  console.log(`  ✓ ${entries.length} deliverables ingested`);
}

const PROFILES: Profile[] = [
  {
    name: "Maya",
    age: 13,
    grade: "8",
    endGoalPref: "research",
    goalNote: "We'd love for Maya to aim at a real research project she's proud of.",
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
    skills: [
      { label: "Python & data", category: "stem", progress: 0.33 },
      { label: "Sports science", category: "sports", progress: 0.42 },
      { label: "Storytelling", category: "humanities", progress: 0.25 },
    ],
    opportunities: [
      { kind: "check_in", title: "Mentor check-in", whenHint: "Thu 4pm" },
      { kind: "window", title: "Science Fair window opens", whenHint: "in 3 weeks" },
    ],
    project: {
      pathType: "sports_analytics",
      title: "What Makes a Winning Streak?",
      summary:
        "Break down the team's season with real stats — the way Maya already watches the game — and turn the numbers into a data story.",
      status: "active",
      targetSlug: "thermo-fisher-jic",
      milestones: [
        {
          weekNo: 1,
          title: "Finish “Intro to Python”",
          detail: "The foundations — variables, loops, and functions — behind everything that follows.",
          status: "done",
          kind: "Course",
          source: "Coursera",
          icon: "🐍",
          checkpointType: "course",
          resources: [
            {
              kind: "course",
              title: "Python for Everybody",
              provider: "Coursera (U. Michigan)",
              url: "https://www.coursera.org/specializations/python",
              costNote: "Free audit",
              summary: "A gentle, well-loved intro to programming you can audit for free.",
            },
          ],
        },
        {
          weekNo: 2,
          title: "Build a Kaggle score-prediction model",
          detail: "Collect the season data and train a first model that predicts match scores — then push it to GitHub.",
          status: "done",
          kind: "Build",
          source: "Kaggle → GitHub",
          icon: "📋",
          checkpointType: "build",
          resources: [
            {
              kind: "dataset",
              title: "Kaggle Datasets",
              provider: "Kaggle",
              url: "https://www.kaggle.com/datasets",
              costNote: "Free",
              summary: "Thousands of open datasets to practice with (parental consent under 18).",
            },
          ],
        },
        {
          weekNo: 3,
          title: "Chart goals-per-game",
          detail: "Build the first real chart and spot the shape of a streak.",
          status: "done",
          kind: "Visualization",
          source: "Notebook",
          icon: "📊",
          checkpointType: "build",
          resources: [
            {
              kind: "tool",
              title: "Google Colab",
              provider: "Google",
              url: "https://colab.research.google.com",
              costNote: "Free",
              summary: "A free, no-install Python notebook with charts — perfect for first analyses.",
            },
          ],
        },
        {
          weekNo: 4,
          title: "Brainstorm your research question",
          detail: "Turn your curiosity into one sharp, answerable research question about what drives a winning streak.",
          status: "doing",
          kind: "Research",
          source: "Research Accelerator",
          icon: "🔬",
          checkpointType: "research",
          coach:
            "A great question is specific and answerable with your own data. Let's narrow it together on Thursday →",
          dueHint: "by end of week 4",
          resources: [
            {
              kind: "reading",
              title: "Purdue OWL",
              provider: "Purdue University",
              url: "https://owl.purdue.edu",
              costNote: "Free",
              summary: "The standard free guide to citations and clear academic writing.",
            },
            {
              kind: "tool",
              title: "Datawrapper",
              provider: "Datawrapper",
              url: "https://www.datawrapper.de",
              costNote: "Free tier",
              summary: "Make clean, shareable charts to back up your argument.",
            },
          ],
        },
        {
          weekNo: 6,
          title: "Run a literature review",
          detail: "Find what's already known about momentum and winning streaks, and gather your annotated sources.",
          status: "todo",
          kind: "Research",
          source: "Research Accelerator",
          icon: "📚",
          checkpointType: "research",
        },
        {
          weekNo: 8,
          title: "Write & submit your research paper",
          detail: "Bring your question, data, and sources together into a real paper — and submit it to a portfolio or journal.",
          status: "todo",
          kind: "Research",
          source: "Research Accelerator",
          icon: "🏁",
          checkpointType: "research",
        },
      ],
    },
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
    skills: [
      { label: "Game design", category: "technology", progress: 0.38 },
      { label: "Digital art", category: "creative", progress: 0.55 },
      { label: "Storytelling", category: "humanities", progress: 0.3 },
    ],
    opportunities: [
      { kind: "check_in", title: "Mentor check-in", whenHint: "Tue 5pm" },
      { kind: "window", title: "Young Game Makers jam", whenHint: "next month" },
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
    skills: [
      { label: "Environmental science", category: "stem", progress: 0.48 },
      { label: "Field biology", category: "biology", progress: 0.4 },
      { label: "Public speaking", category: "humanities", progress: 0.35 },
    ],
    opportunities: [
      { kind: "check_in", title: "Mentor check-in", whenHint: "Wed 4pm" },
      { kind: "deadline", title: "Community science grant due", whenHint: "in 5 weeks" },
    ],
  },
];

// Mentor pool (#9) — global, capped human layer (TJ / top-college students).
const MENTORS = [
  {
    name: "Aisha Rahman",
    email: "aisha.rahman@mentors.passionfruit.app",
    field: "Data science",
    bio: "Ran a sports-analytics club and placed at a regional science fair with a soccer-stats project. Loves helping students turn a pile of numbers into one clear, honest claim.",
    credential: "TJHSST '26",
  },
  {
    name: "Marcus Lee",
    email: "marcus.lee@mentors.passionfruit.app",
    field: "Game design & creative coding",
    bio: "Shipped two small indie games in high school and now studies CS. Big on finishing things — he'll push for a real playable build, not a pile of half-started ideas.",
    credential: "MIT '27",
  },
  {
    name: "Priyanka Nair",
    email: "priyanka.nair@mentors.passionfruit.app",
    field: "Environmental science",
    bio: "Led a community water-quality study that turned into a published local report. Helps students aim at real, credible targets and find their voice presenting the work.",
    credential: "Stanford '27",
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

/** Create (or find) a demo student login. Returns the auth user id. */
async function ensureStudentAuthUser(username: string, name: string): Promise<string> {
  const email = studentUsernameToEmail(username);
  const created = await supabaseAdmin.auth.admin.createUser({
    email,
    password: DEMO_STUDENT_PASSWORD,
    email_confirm: true,
    user_metadata: { role: "student", name, username },
  });
  if (created.data.user) return created.data.user.id;

  const list = await supabaseAdmin.auth.admin.listUsers();
  const existing = list.data.users.find((u) => u.email === email);
  if (!existing) throw new Error(`Could not create or find demo student ${username}: ${created.error?.message}`);
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

  // Ingest the vetted deliverables catalog (global; before students so targets resolve).
  await ingestDeliverables();

  // Mentor pool (#9) — global, idempotent: clear + reinsert (no natural unique key).
  // Safe because checkpoints.mentorId is ON DELETE SET NULL.
  await db.delete(mentors);
  await db.insert(mentors).values(MENTORS);
  console.log(`  ✓ ${MENTORS.length} mentors seeded`);

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
        endGoalPref: p.endGoalPref ?? null,
        goalNote: p.goalNote ?? null,
      })
      .returning();
    const studentId = student!.id;

    // Give the student their own demo login (username = first name).
    const studentUsername = p.name.toLowerCase();
    const studentAuthId = await ensureStudentAuthUser(studentUsername, p.name);
    await db.update(students).set({ authUserId: studentAuthId }).where(eq(students.id, studentId));

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
    for (const s of p.skills) {
      await db.insert(skills).values({
        studentId,
        label: s.label,
        category: s.category,
        progress: s.progress,
      });
    }
    for (const o of p.opportunities) {
      await db.insert(opportunities).values({
        studentId,
        kind: o.kind,
        title: o.title,
        whenHint: o.whenHint ?? null,
      });
    }
    if (p.project) {
      const [project] = await db
        .insert(projects)
        .values({
          studentId,
          pathType: p.project.pathType,
          title: p.project.title,
          summary: p.project.summary,
          status: p.project.status,
          chosenAt: new Date(),
        })
        .returning();
      for (const m of p.project.milestones) {
        const [ms] = await db
          .insert(milestones)
          .values({
            projectId: project!.id,
            weekNo: m.weekNo,
            title: m.title,
            detail: m.detail,
            status: m.status,
            kind: m.kind,
            source: m.source,
            icon: m.icon,
            coach: m.coach ?? null,
            dueHint: m.dueHint ?? null,
            checkpointType: m.checkpointType ?? null,
          })
          .returning();
        for (const r of m.resources ?? []) {
          await db.insert(resources).values({
            milestoneId: ms!.id,
            studentId,
            kind: r.kind,
            title: r.title,
            provider: r.provider,
            url: r.url,
            costNote: r.costNote,
            summary: r.summary,
            source: "curated",
          });
        }
      }
      // Anchor the project to its real-world target (parent-approved).
      if (p.project.targetSlug) {
        const [target] = await db
          .select()
          .from(deliverables)
          .where(eq(deliverables.slug, p.project.targetSlug))
          .limit(1);
        if (target) {
          await db.insert(projectTargets).values({
            studentId,
            projectId: project!.id,
            deliverableId: target.id,
            rationale: "A sports-analytics study is a legitimate science-fair project — a real first rung toward ISEF.",
            status: "active",
            parentApproved: true,
          });
        }
      }
    }

    console.log(`  ✓ ${p.name} (age ${p.age}) — graph seeded`);
  }

  console.log("\nDone. Log in as PARENT with:");
  console.log(`  email:    ${DEMO_PARENT.email}`);
  console.log(`  password: ${DEMO_PARENT.password}`);
  console.log("\nOr log in as a STUDENT (username / password):");
  for (const p of PROFILES) {
    console.log(`  ${p.name.toLowerCase().padEnd(8)} / ${DEMO_STUDENT_PASSWORD}`);
  }
  console.log("\nStudents already have a learner graph, so you can jump straight in.");

  await sql.end();
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await sql.end();
  process.exit(1);
});
