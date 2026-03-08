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

---

## 2026-03-05 — Factory (Claude Code) — VCH-39 + VCH-40 (rev 2)
**Completed:** `lib/auth.ts` and `hooks/useAuth.ts` reworked per orchestrator review on PR #9.
**Decisions made:**
- Removed `signInWithEmail` / `signUpWithEmail` — not in PRD (REQ-01 Google OAuth, REQ-02 Phone OTP only).
- Added `signInWithGoogle()`: uses `expo-auth-session` `makeRedirectUri` + `expo-web-browser` `openAuthSessionAsync`, then calls `supabase.auth.exchangeCodeForSession(redirectUrl)` for PKCE completion. `WebBrowser.maybeCompleteAuthSession()` called at module level.
- Renamed `signInWithPhone` → `sendOTP`, `verifyPhoneOtp` → `verifyOTP` to match VCH-39 spec names.
- All functions now throw on error and return typed values (`Promise<void>`, `Promise<Session>`, etc.) rather than raw Supabase response objects.
- Added `createOrUpdateUserProfile({ display_name, avatar_url? }): Promise<User>` — upserts to public `users` table using auth user id/email/phone; required for onboarding (VCH-8).
- Added `getCurrentUser(): Promise<User | null>` — fetches profile from `users` table; returns null on PGRST116 (pre-onboarding state).
- `hooks/useAuth.ts`: `user` is now `User` from `@/contracts/types` (profile row), not supabase-js auth user. Hook fetches profile via `getCurrentUser()` on mount and after each auth state change.
- `loading` renamed to `isLoading`; added `isAuthenticated: session !== null`.
- Hook now returns full action set: `signInWithGoogle`, `sendOTP`, `verifyOTP`, `signOut`, `updateProfile`.
- Added `AsyncStorage` from `@react-native-async-storage/async-storage` to `lib/supabase.ts` auth config for reliable session persistence on React Native.
**Contracts changed:** No
**Dependencies introduced:** `expo-auth-session ~5.5.2`, `expo-web-browser ~14.0.1`, `expo-crypto ~13.0.2`, `@react-native-async-storage/async-storage ^2.0.0`
**Next agent needs to know:**
- Import auth functions: `import { signInWithGoogle, sendOTP, verifyOTP, signOut } from '@/lib/auth'`
- Import the hook: `import { useAuth } from '@/hooks/useAuth'`
- `useAuth()` returns `{ user, session, isLoading, isAuthenticated, signInWithGoogle, sendOTP, verifyOTP, signOut, updateProfile }`
- `user` is the public `users` profile row — will be `null` until `updateProfile` is called post-sign-in (pre-onboarding).
**Open questions:** None
**Tests:** Passing (typecheck + lint + vitest all exit 0)

---

## 2026-03-05 — Codex — VCH-41
**Completed:** Created `tests/unit/auth/auth.test.ts` (25 tests) and `tests/unit/auth/useAuth.test.ts` (12 tests) covering all functions in `lib/auth.ts` and `hooks/useAuth.ts`.
**Decisions made:**
- `lib/auth.ts` tests: full happy-path + error-path coverage for all 7 exported functions (`signInWithGoogle`, `sendOTP`, `verifyOTP`, `signOut`, `getSession`, `createOrUpdateUserProfile`, `getCurrentUser`). Supabase, `expo-web-browser`, and `expo-auth-session` fully mocked.
- `hooks/useAuth.ts` tests: React's `useState`/`useEffect` mocked via `vi.mock('react')` so the hook can be called outside a render cycle in the node environment (no jsdom/`@testing-library/react` needed). Tests cover returned shape, initial state, `isAuthenticated` derivation, all action delegation, and mount-time effects.
- `vi.hoisted()` used in `useAuth.test.ts` to share mock references inside hoisted `vi.mock` factories.
**Contracts changed:** No
**Dependencies introduced:** None
**Next agent needs to know:** All auth tests pass; full hook lifecycle/state-transition tests (e.g. `onAuthStateChange` firing and state updating) would require jsdom + `@testing-library/react` if needed in the future.
**Open questions:** None
**Tests:** 37 passed (25 lib/auth + 12 useAuth) — typecheck + lint + vitest all exit 0

---

## 2026-03-06 — Cursor — VCH-6
**Completed:** Built sign-in screen at `app/(auth)/sign-in.tsx` with Google OAuth and phone OTP (REQ-01, REQ-02). Added `app/(auth)/_layout.tsx` for the auth route group and `app/nativewind.d.ts` so NativeWind `className` types are applied.
**Decisions made:**
- All auth actions use `useAuth()` from `@/hooks/useAuth` (signInWithGoogle, sendOTP, verifyOTP). On success, redirect via `router.replace('/')`.
- Phone flow: single phone field (E.164 hint), then "Send code" → OTP input + "Verify"; "Use a different number" resets to phone entry. Errors shown in a red banner.
- Loading states: full-screen loader while `isLoading`; button-level loaders for Google and phone actions.
- Design: minimal layout (Cron/Notion style), SafeAreaView, KeyboardAvoidingView, ScrollView. Styling via NativeWind (Tailwind) classes.
- `app/nativewind.d.ts` references `react-native-css-interop/types.d.ts` so TypeScript accepts `className` on RN components without changing lib/ or contracts.
**Contracts changed:** No
**Dependencies introduced:** None
**Next agent needs to know:** Sign-in route is `/sign-in`. Root index (`/`) should handle post-auth (e.g. redirect unauthenticated users to `/sign-in`).
**Open questions:** None
**Tests:** typecheck + lint pass

---

## 2026-03-06 — Factory (Claude Code) — VCH-42
**Completed:** Created `lib/groups.ts` with all 10 required exported functions plus the `GroupMustHaveAdminError` custom error class.
**Decisions made:**
- `createGroup`: plain INSERT into `groups`; DB trigger (trg_group_created) handles the admin membership row — no manual insert into group_members.
- `getGroupsForUser`: queries `group_members` with `groups!inner(*)` (Supabase inner-join syntax) filtered to `status='active'`, maps to `Group[]`. Cast via `unknown` to avoid Supabase's untyped array inference on join columns.
- `inviteMember`: detects email vs E.164 phone by presence of `@`; looks up user in `users` table, inserts a `pending` membership row.
- `demoteMember`: counts active admins with `{ count: 'exact', head: true }` before the UPDATE; throws `GroupMustHaveAdminError` if count === 1.
- `joinGroupByInviteLink`: validates `revoked` and `expires_at` on the share_link row, then upserts the membership with `onConflict: 'group_id,user_id'` (handles re-joining after removal).
- `getMembers`: selects `*, users(*)` and remaps the `users` key → `user` to match the contract type `(GroupMember & { user: User })[]`.
**Contracts changed:** No
**Dependencies introduced:** None
**Next agent needs to know:**
- Import: `import { createGroup, getGroupsForUser, inviteMember, ... } from '@/lib/groups'`
- `GroupMustHaveAdminError` is exported for callers to catch specifically.
- `approveMember`/`rejectMember` filter on `status='pending'`; calling them on non-pending rows is a no-op (Supabase returns no error).
**Open questions:** None
**Tests:** Passing (typecheck + lint + vitest all exit 0)

---

## 2026-03-06 — Factory (Claude Code) — VCH-43
**Completed:** Created `hooks/useGroup.ts` exporting the `useGroup()` hook with the full specified interface.
**Decisions made:**
- AsyncStorage key `activeGroupId` stores the persisted group ID. On mount, groups are fetched then the stored ID is matched; falls back to `groups[0]` if stored ID is not found.
- Two separate effects: (1) loads groups + restores activeGroup on `user.id` change; (2) loads members on `activeGroup.id` change. A `useRef` (`groupsRef`) carries the latest `groups` value into effect 2 without adding it as a dep (avoids infinite re-fetch loop).
- Both effects use a `cancelled` flag to discard results after unmount/re-run (prevents stale state).
- `isAdmin` is derived (not stored) — `members.some(m => m.user_id === user.id && m.role === 'admin' && m.status === 'active')`.
- `setActiveGroup` is synchronous per spec; AsyncStorage write is fire-and-forget.
- `removeMember`: if the caller removes themselves (userId === user.id), immediately removes the group from the list and switches to the next available group (or null).
- All action functions set `error` state on failure and re-throw so callers can also catch.
- `// eslint-disable-next-line react-hooks/exhaustive-deps` used on the two effects where intentional dep omissions are documented inline.
**Contracts changed:** No
**Dependencies introduced:** None (AsyncStorage already in package.json from VCH-39)
**Next agent needs to know:**
- Import: `import { useGroup } from '@/hooks/useGroup'`
- `members` contains the full `(GroupMember & { user: User })[]` shape; no separate fetch needed.
- `error` is the last error string; callers should display it and can rely on the thrown error for their own try/catch.
- `inviteMember` takes a single `emailOrPhone` string scoped to the current `activeGroup`.
**Open questions:** None
**Tests:** Passing (37 tests: 25 lib/auth + 12 useAuth; typecheck + lint + vitest all exit 0)

---

## 2026-03-08 — Factory — VCH-45
**Completed:** Created `lib/events.ts` with all 7 exported functions: `createEvent`, `getEvents`, `updateEvent`, `deleteEvent`, `upsertRSVP`, `removeRSVP`, `subscribeToEvents`.
**Decisions made:**
- `createEvent` accepts `start_at`/`end_at` ISO datetime strings and maps them to DB columns `event_date`, `start_time`, `duration_mins` (parsed via UTC Date methods).
- `getEvents` uses Supabase embedded joins: `creator:users!created_by(...)` and `rsvps(*, user:users!user_id(...))` to produce `EventWithMeta[]` in a single query, filtered by `event_date` range with `.gte()`/`.lte()`.
- `upsertRSVP` / `removeRSVP` fetch the current auth user via `supabase.auth.getUser()` and throw if not authenticated.
- `subscribeToEvents` uses `postgres_changes` with `event: '*'` and `filter: group_id=eq.{groupId}` on a named channel.
- `deleteEvent` is a hard delete; RLS enforces permissions at DB level.
**Contracts changed:** No
**Dependencies introduced:** None
**Next agent needs to know:**
- Import: `import { createEvent, getEvents, ... } from '@/lib/events'`
- `getEvents` returns `EventWithMeta[]` with nested `creator` and `rsvps[].user` already populated.
- `subscribeToEvents` returns a `RealtimeChannel` — caller must call `.unsubscribe()` on cleanup.
**Open questions:** None
**Tests:** Passing (58 tests; typecheck + lint + vitest all exit 0)

---

## 2026-03-08 — Factory — VCH-46
**Completed:** Created `hooks/useEvents.ts` exporting the `useEvents(groupId)` hook with the full specified interface.
**Decisions made:**
- Fetches events for the current calendar month on mount via `getMonthRange()` helper (computes first/last day of current month as YYYY-MM-DD strings).
- `groupId: null` → returns empty state immediately (no fetch, no subscription).
- Two separate effects: (1) fetches events on `groupId` change; (2) subscribes to realtime updates via `subscribeToEvents`, re-fetches on any change event, and unsubscribes on cleanup.
- `upsertRSVP` and `removeRSVP` apply optimistic local state updates before the async call; on failure, re-fetch events to revert.
- `useCallback` used on all action functions for referential stability.
- `groupIdRef` carries the latest groupId into async callbacks without causing re-renders.
- All actions set `error` state on failure and re-throw for caller handling (same pattern as `useGroup`).
**Contracts changed:** No
**Dependencies introduced:** None
**Next agent needs to know:**
- Import: `import { useEvents } from '@/hooks/useEvents'`
- `events` contains `EventWithMeta[]` for the current calendar month; re-fetched on realtime changes.
- RSVP actions are optimistic — UI updates instantly, reverts on server error.
**Open questions:** None
**Tests:** Passing (58 tests; typecheck + lint + vitest all exit 0)

---

## 2026-03-08 — Factory — VCH-48
**Completed:** Created `lib/shareLinks.ts` with 4 exported functions: `generateShareLink`, `revokeShareLink`, `validateShareLink`, `getShareLinksForGroup`.
**Decisions made:**
- `generateShareLink`: uses `randomUUID()` from `expo-crypto` (already a project dependency) for client-side token generation; inserts with `expires_at: null` and `revoked: false`.
- `validateShareLink`: fetches by token via `.single()`, then checks `revoked` and `expires_at` in application code — throws descriptive errors for each invalid state.
- `revokeShareLink`: sets `revoked = true` on the row matched by `id`.
- `getShareLinksForGroup`: returns all links for a group ordered by `created_at` descending.
**Contracts changed:** No
**Dependencies introduced:** None (`expo-crypto` already in package.json)
**Next agent needs to know:**
- Import: `import { generateShareLink, revokeShareLink, validateShareLink, getShareLinksForGroup } from '@/lib/shareLinks'`
- `validateShareLink` throws `'This share link has been revoked'` or `'This share link has expired'` — callers can catch and display these messages.
- `joinGroupByInviteLink(token)` in `lib/groups.ts` performs its own validation; `validateShareLink` is for UI-level pre-checks.
**Open questions:** None
**Tests:** Passing (58 tests; typecheck + lint + vitest all exit 0)

---

## 2026-03-06 — Codex — VCH-44
**Completed:** Created `tests/unit/groups/groups.test.ts` (21 tests) covering `lib/groups.ts` functions and the `isAdmin` derivation in `hooks/useGroup.ts`.
**Decisions made:**
- Used a `buildChain(result)` helper that returns a fully chainable Supabase mock (all builder methods return `chain`, `.single()` and `await` resolve to `result`). This cleanly handles all query shapes — inserts, updates, count queries, inner joins — without per-function chain scaffolding.
- `demoteMember` two-call scenario handled via `mockReturnValueOnce` on `mockFromChain` — first call returns the count chain, second returns the update chain.
- `inviteMember` similarly uses two `mockReturnValueOnce` calls: user lookup chain, then insert chain.
- `useGroup.isAdmin` tests use the same `stateConfig.overrides` pattern as `useAuth.test.ts`: override the 3rd `useState` call (index 2, the `members` slot) to inject specific member arrays; `user` is controlled via the `useAuth` mock.
- Rebased onto `origin/develop` to pick up `lib/groups.ts` + `hooks/useGroup.ts` from the merged PR #14 (VCH-42/VCH-43) before writing tests.
**Contracts changed:** No
**Dependencies introduced:** None
**Next agent needs to know:** All group tests pass; 58 total tests (25 lib/auth + 12 useAuth + 21 groups).
**Open questions:** None
**Tests:** 58 passed (21 groups + 37 existing) — typecheck + lint + vitest all exit 0
