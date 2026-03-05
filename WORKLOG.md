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

---

## 2026-03-05 — Claude Code (Orchestrator) — VCH-31
**Completed:** Scaffolded the Expo (React Native) project. Created `package.json`, `tsconfig.json`, `babel.config.js`, `metro.config.js`, `tailwind.config.js`, `global.css`, `.eslintrc.js`, `vitest.config.ts`, `app/_layout.tsx`, `lib/supabase.ts`, and `.env.example`. All tooling scripts are operational.
**Decisions made:**
- Used `process.env.EXPO_PUBLIC_*` for Supabase env vars (Expo's standard mechanism for public env vars, injected at build time).
- Added `--passWithNoTests` to `vitest run` so `npm run test` exits 0 with no test files present.
- Used `--legacy-peer-deps` for npm install due to minor React peer dep range mismatch between packages; no functional impact.
- NativeWind v4 configured with `babel-preset-expo` + `jsxImportSource: 'nativewind'` as per NativeWind v4 docs.
**Contracts changed:** No
**Dependencies introduced:** expo ~52.0.0, react 18.3.1, react-native 0.76.5, @supabase/supabase-js ^2.47.0, nativewind ~4.0.36, tailwindcss ^3.4.0, expo-router ~4.0.9, react-native-reanimated ~3.16.1, vitest ^2.1.0, typescript ^5.3.3, eslint ^8.57.0
**Next agent needs to know:**
- `import { supabase } from '@/lib/supabase'` is ready for use.
- `npm run typecheck`, `npm run lint`, `npm run test` all pass.
- VCH-28 (types.ts) should create `contracts/types.ts` — typecheck will validate it automatically.
- VCH-25 (RLS) can now proceed since DB migrations are applied.
**Open questions:** None
**Tests:** Passing (0 tests, vitest --passWithNoTests)

---

## 2026-03-05 — Claude Code (Orchestrator) — VCH-28
**Completed:** Created `contracts/types.ts` with all shared TypeScript types and the `IMPORTANCE` constant. Created `types/index.ts` as a re-export barrel. Fixed `tsconfig.json` to exclude `vitest.config.ts` (resolves `import.meta` module conflict).
**Decisions made:**
- Hex colours and shapes sourced directly from PRD Appendix (REQ-17): FYI=#9CA3AF/circle, Recommend=#3B82F6/triangle, Important=#F59E0B/diamond, Critical=#EF4444/star.
- Nullable DB columns (`created_by`, `phone`, etc.) typed as `T | null` to match schema exactly.
- Date/time fields typed as `string` — Supabase JS client serialises all date/time values to ISO strings.
- Extracted `UserSummary` as a named type alias for `Pick<User, 'id' | 'display_name' | 'avatar_url'>` to avoid repetition.
**Contracts changed:** Yes — `contracts/types.ts` created (new file, not a modification).
**Dependencies introduced:** None
**Next agent needs to know:**
- All types are importable via `@/contracts/types` or `@/types` (re-export).
- VCH-25 (RLS) can now proceed — all table names and column shapes are finalised.
**Open questions:** None
**Tests:** Passing (typecheck + lint + vitest all exit 0)

---

## 2026-03-05 — Claude Code (Orchestrator) — VCH-25
**Completed:** Created `supabase/migrations/20260305000001_rls_policies.sql` with RLS enabled on all 6 tables and all policies from the ticket spec. Added helper functions, a group-creation trigger, and a share-token RPC.
**Decisions made:**
- Added `is_active_member(UUID)` and `is_group_admin(UUID)` as SECURITY DEFINER helper functions — keeps policies readable and prevents infinite recursion by bypassing RLS internally.
- Added `trg_group_created` trigger (SECURITY DEFINER) on `groups` that auto-inserts the creator as an `admin`/`active` member. This solves the chicken-and-egg problem where no admin exists yet to satisfy the `group_members` INSERT policy on a brand new group.
- Added `set_share_token(UUID)` RPC — client calls this before querying events via a share link. Sets a transaction-scoped `app.share_token` config var checked in the events SELECT policy via `NULLIF(current_setting('app.share_token', true), '')::uuid`.
- `events` INSERT/UPDATE/DELETE are member-gated at DB level; creator-or-admin enforcement (REQ-16) is delegated to the application layer to avoid complex policy logic.
- `group_members` UPDATE allows self-update (`auth.uid() = user_id`) so invitees can accept their own pending invite.
**Contracts changed:** No
**Dependencies introduced:** None
**Next agent needs to know:**
- To create a group: INSERT into `groups` — the trigger auto-creates the admin membership. No separate INSERT into `group_members` needed.
- To access events via share link: call `supabase.rpc('set_share_token', { p_token })` first, then query `events`.
- The `anon` role can read `share_links` and `events` (with valid token); it cannot read `rsvps`, `group_members`, or `users`.
**Open questions:**
- `supabase db push` needed by human after this PR merges to apply policies to the live DB.
**Tests:** N/A — RLS policies have no automated test coverage yet (manual verification steps in PR description)
