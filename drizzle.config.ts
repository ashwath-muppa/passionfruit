import type { Config } from "drizzle-kit";

// Drizzle is the typed source of truth for the schema. The checked-in SQL
// migration lives in supabase/migrations (applied by `npx supabase db reset`),
// so it enables pgvector, the auth.users FK, and ivfflat indexes in one place.
// Use `npm run db:gen` to diff the schema into ./drizzle when iterating.
export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  },
} satisfies Config;
