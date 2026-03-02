# WORKLOG.md

## 2026-03-02 — Human — Project Kickoff
Status: Phase 0 starting
Repo: https://github.com/vedl1/family-calendar
Linear: https://linear.app/vchldn
Next agent: Claude Code — start with VCH-22 (DB migrations)

---

## 2026-03-02 — Claude Code (Orchestrator) — VCH-22
**Completed:** Created `supabase/migrations/20260302000000_initial_schema.sql` with all 6 MVP tables, constraints, indexes, and `updated_at` triggers. Initialized Supabase project config (`supabase/config.toml`, `supabase/seed.sql`).
**Decisions made:**
- Used `uuid_generate_v4()` (via `uuid-ossp` extension) for all primary keys — consistent with Supabase conventions.
- `groups.created_by` and `events.created_by` use `ON DELETE SET NULL` (not CASCADE) to preserve records if a user is deleted.
- `set_updated_at()` defined as a shared trigger function (not per-table) to stay DRY.
**Contracts changed:** No
**Dependencies introduced:** None (no new npm packages; Supabase CLI used via npx)
**Next agent needs to know:**
- VCH-25 (RLS) must add policies against the `users` table defined here. Note: `users` mirrors `auth.users` — RLS policies will use `auth.uid()`.
- VCH-28 (types.ts) should derive types from this schema exactly.
- VCH-31 (client init) should use the Supabase URL/anon key from `.env.local`.
**Open questions:**
- `supabase db push` requires human to run `supabase login` (or set `SUPABASE_ACCESS_TOKEN`) and then `supabase link --project-ref tkmlftjbzwvdjdsutauz` before pushing. The migration SQL is complete and correct; it just needs authenticated CLI access to push.
**Tests:** N/A — no test framework configured yet (VCH-31 scope)
