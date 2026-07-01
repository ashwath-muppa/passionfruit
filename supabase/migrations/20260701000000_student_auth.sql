-- ──────────────────────────────────────────────────────────────────────────
-- Passionfruit — student logins.
-- Students can now have their OWN auth account (created by the parent). A
-- student's auth user maps to a students row; a parent's auth user maps to a
-- parents row. Ownership/role is resolved from these links (lib/auth/parent.ts).
-- ──────────────────────────────────────────────────────────────────────────

alter table students
  add column auth_user_id uuid unique references auth.users (id) on delete set null;
