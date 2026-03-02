# AGENTS.md
> Master configuration file for all AI coding agents working on this project.
> Every agent (Claude Code, Cursor, Codex, Factory) must read this file before starting any task.
> Last updated: [DATE] | Maintained by: [YOUR NAME]

---

## 1. Project Overview

```
Project:     [PROJECT NAME]
Description: [1-2 sentence summary of what this product does]
Stage:       [MVP / Alpha / Beta / Production]
Stack:       [e.g. Next.js 14, TypeScript, Postgres, Prisma, Tailwind]
Repo:        [GitHub URL]
Linear:      [Linear workspace URL]
```

### Core Purpose
[What problem does this solve? Who is the user? Write 2-3 sentences.
Agents use this to make good judgment calls when specs are ambiguous.]

---

## 2. Agent Roles & Responsibilities

### Orchestrator — Claude Code
- Owns the integration layer and overall code coherence
- Reviews output from all other agents before merging
- Resolves conflicts between implementations
- Updates WORKLOG.md after each session
- Has final say on architecture decisions
- **Trigger phrase**: "Claude Code: orchestrate"

### Backend — Factory
- Owns all server-side logic, APIs, database migrations
- Works from tickets in the `backend` Linear label
- Must not change shared contract files without orchestrator approval
- Outputs: working endpoints, passing tests, updated API docs
- **Trigger phrase**: "Factory: implement [ticket ID]"

### Frontend — Cursor (with human co-pilot)
- Owns all UI components, pages, client state
- Works from tickets in the `frontend` Linear label
- Consumes contracts from `/contracts` — never invents API shapes
- Human (you) stays in the loop on all Cursor sessions
- **Trigger phrase**: "Cursor: build [ticket ID]"

### Tests & Boilerplate — Codex
- Writes unit tests, integration tests, and repetitive scaffolding
- Works against contracts and completed implementations
- Should run after Factory completes a module, before Cursor consumes it
- **Trigger phrase**: "Codex: test [module name]"

---

## 3. Directory Structure

```
/
├── AGENTS.md              ← YOU ARE HERE. All agents read this first.
├── ARCHITECTURE.md        ← System design, data flow, ADRs
├── WORKLOG.md             ← Append-only session log (all agents write here)
├── CONVENTIONS.md         ← Code style, patterns, examples
│
├── contracts/             ← SACRED. Only orchestrator may update.
│   ├── api-schema.ts      ← All API endpoint shapes
│   ├── db-schema.sql      ← Database schema (source of truth)
│   ├── types.ts           ← Shared TypeScript types
│   └── component-props.ts ← Frontend/backend interface contracts
│
├── src/
│   ├── app/               ← [Next.js app router / your framework structure]
│   ├── components/        ← UI components (Cursor owns)
│   ├── server/            ← Server logic (Factory owns)
│   │   ├── api/           ← Route handlers
│   │   ├── db/            ← Database layer
│   │   └── services/      ← Business logic
│   ├── lib/               ← Shared utilities (any agent, orchestrator reviews)
│   └── types/             ← Local types (must not conflict with /contracts)
│
├── tests/
│   ├── unit/              ← Codex owns
│   ├── integration/       ← Codex owns, Factory seeds
│   └── e2e/               ← Human-approved only
│
└── docs/                  ← Generated docs, not hand-edited
```

---

## 4. Contracts (Sacred Files)

> ⚠️ No agent may modify `/contracts` without explicit orchestrator sign-off.
> If a contract needs to change, create a PR and tag for human review.

### How to consume contracts
```typescript
// ✅ CORRECT - import from contracts
import type { UserResponse } from '@/contracts/types'

// ❌ WRONG - never redefine types that exist in contracts
type User = { id: string; email: string } // don't do this
```

### How to propose contract changes
1. Open a Linear ticket tagged `contract-change`
2. Write the proposed change in the ticket description
3. Claude Code reviews and approves/rejects
4. Only then update the contract file

---

## 5. Tech Stack & Decisions

### Core Stack
| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | [e.g. Next.js] | [14.x] | App router only |
| Language | TypeScript | 5.x | Strict mode enabled |
| Database | [e.g. PostgreSQL] | [16] | Via [Prisma/Drizzle] |
| Auth | [e.g. NextAuth] | [5.x] | [Notes] |
| Styling | [e.g. Tailwind] | [3.x] | [Notes] |
| Testing | [e.g. Vitest] | [1.x] | [Notes] |

### Key Decisions (Non-negotiable)
- [e.g. "Server components by default, client components only when needed"]
- [e.g. "All DB access via repository pattern, never raw queries in route handlers"]
- [e.g. "No any types. If you must escape, use unknown + type guard"]
- [e.g. "Zod for all input validation at API boundaries"]

### Approved Libraries
```
[List the libraries agents are allowed to add to package.json]
e.g.:
- zod (validation)
- date-fns (dates)
- zustand (client state)
```

### 🚫 Do Not Install Without Asking
- Any new database ORM
- Any new auth library
- Any UI component library not already in use
- Any package that adds >50kb to bundle

---

## 6. Development Commands

```bash
# Setup
npm install
cp .env.example .env.local    # then fill in values

# Development
npm run dev                    # starts dev server on :3000
npm run db:migrate             # run pending migrations
npm run db:seed                # seed development data

# Testing
npm run test                   # unit + integration tests
npm run test:e2e               # end-to-end (requires dev server)
npm run test:coverage          # coverage report

# Quality
npm run lint                   # ESLint
npm run typecheck              # TypeScript check (no emit)
npm run build                  # production build

# Database
npm run db:studio              # visual DB browser
npm run db:reset               # ⚠️ destroys and recreates local DB
```

> ✅ All agents must run `typecheck` and `lint` before declaring a ticket done.
> ✅ Tests must pass before any PR is opened.

---

## 7. Environment & Secrets

```bash
# Agents should never hardcode secrets.
# All env vars live in .env.local (gitignored).
# Reference .env.example for required variables.

# If you need a new env var:
# 1. Add it to .env.example with a descriptive comment
# 2. Note it in your WORKLOG.md entry
# 3. Tell the human operator to set it
```

**Never log, expose, or commit:**
- API keys
- Database URLs
- Auth secrets
- User PII

---

## 8. Code Conventions

> Full details in CONVENTIONS.md. Key rules summarised here.

### Naming
```typescript
// Files: kebab-case
user-profile.tsx
auth-service.ts

// Components: PascalCase
export function UserProfile() {}

// Functions/variables: camelCase
const getUserById = async (id: string) => {}

// Constants: SCREAMING_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3

// Types/Interfaces: PascalCase
type UserResponse = {}
interface AuthConfig {}
```

### Error Handling
```typescript
// ✅ Always handle errors explicitly
const result = await db.user.findUnique({ where: { id } })
if (!result) throw new NotFoundError(`User ${id} not found`)

// ❌ Never swallow errors
try { ... } catch (e) {} // forbidden
```

### Comments
- Code should be self-documenting
- Comment the WHY not the WHAT
- All public functions need JSDoc
- TODOs must include a Linear ticket ID: `// TODO: [ENG-123] fix edge case`

---

## 9. Git & PR Protocol

### Branch Naming
```
feature/ENG-123-short-description
fix/ENG-456-bug-description
chore/ENG-789-task-description
```

### Commit Format
```
type(scope): short description [ENG-123]

Types: feat | fix | chore | refactor | test | docs
Scope: auth | dashboard | api | db | ui | infra

Examples:
feat(auth): add JWT refresh token rotation [ENG-101]
fix(api): handle null user in profile endpoint [ENG-202]
```

### PR Rules
- Every PR references a Linear ticket
- PRs must pass CI (lint + typecheck + tests)
- Claude Code reviews all PRs before human merges
- No self-merging (agent opens, human or orchestrator merges)
- PR description must include: what changed, why, how to test

---

## 10. Agent Handoff Protocol

When an agent completes a ticket, it must:

### 1. Update WORKLOG.md
```markdown
## [DATE] [AGENT NAME] — [Ticket ID]
**Completed:** [what was built]
**Decisions made:** [any non-obvious choices and why]
**Contracts changed:** [yes/no — if yes, list changes]
**Dependencies introduced:** [new packages added]
**Next agent needs to know:** [anything downstream agents must be aware of]
**Open questions:** [unresolved issues for human or orchestrator]
**Tests:** [passing/failing — list any known failures]
```

### 2. Check before closing ticket
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes  
- [ ] `npm run test` passes
- [ ] No secrets or hardcoded values
- [ ] WORKLOG.md updated
- [ ] PR opened with correct branch name and ticket reference

### 3. Tag for review
- Backend tickets → Claude Code reviews before Cursor consumes
- Contract changes → Human must approve
- All PRs → Claude Code reviews, human merges

---

## 11. Conflict Resolution

When two agents produce conflicting implementations:

```
Priority order:
1. /contracts files (always win)
2. Decisions in ARCHITECTURE.md
3. Orchestrator (Claude Code) judgment
4. Human decision (escalate via Linear comment)
```

If you're unsure, **stop and ask** rather than making an assumption that creates downstream debt.

---

## 12. What Agents Must Never Do

> These are hard stops. If a ticket seems to require these, flag it first.

- ❌ Modify `/contracts` without orchestrator sign-off
- ❌ Install new packages outside the approved list without asking
- ❌ Write raw SQL outside the database layer
- ❌ Store secrets in code or logs
- ❌ Push directly to `main` or `develop`
- ❌ Delete or rename public API endpoints (breaking change)
- ❌ Modify migrations that have already been run in staging/prod
- ❌ Invent API shapes not defined in contracts
- ❌ Close a ticket without running typecheck + tests

---

## 13. Current Sprint Context

> Update this section at the start of each sprint.

```
Sprint:      [Sprint number / name]
Goal:        [What we're shipping this sprint]
Start:       [Date]
End:         [Date]

Active epics:
- [Epic name] → [Agent responsible] → [Status]
- [Epic name] → [Agent responsible] → [Status]

Blocked:
- [Ticket ID]: [reason] — needs [what]

Done this sprint:
- [Ticket ID]: [brief description]
```

---

## 14. Escalation Guide

| Situation | Action |
|---|---|
| Spec is ambiguous | Check ARCHITECTURE.md first, then ask human via Linear comment |
| Contract needs changing | Stop, open a `contract-change` ticket, do not proceed |
| Two valid approaches exist | List both in WORKLOG.md, flag for orchestrator decision |
| Test is failing and unclear why | Tag ticket `needs-investigation`, document what you tried |
| New dependency needed | Propose in WORKLOG.md, wait for human approval |
| Another agent's code has a bug | Open a fix ticket, do not silently patch their code |

---

## 15. Quick Reference Card

```
READ FIRST:    AGENTS.md (this file) → ARCHITECTURE.md → relevant contract files
BEFORE CODING: Check /contracts for existing types and API shapes
WHILE CODING:  Branch off develop, follow naming conventions, no secrets
AFTER CODING:  typecheck + lint + test → WORKLOG.md → open PR → tag for review
STUCK:         Document the blocker in WORKLOG.md, escalate via Linear
NEVER:         Modify contracts unilaterally, push to main, swallow errors
```

---

*This file is the single source of truth for agent behaviour on this project.
If something in this file conflicts with a ticket description, this file wins.
To propose changes to this file, open a Linear ticket tagged `agent-config`.*
