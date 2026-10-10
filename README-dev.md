# College Ess: developer guide

> **For:** developers working on the code.
> **Update it when** a sub-phase changes the status, the stack, the repository layout, a
> script, a convention, or how tests run (RULES R22). Facts that have their own doc are
> linked, not copied.
> **Last checked against the code:** `166536f`, 2026-10-10.

College Ess is a student-life PWA for one college: routine, tasks, wardrobe, exams, events,
clubs, grocery, holidays and an in-app guide, installable and usable offline. This file is
the developer's entry point. For what the product is and why, see [`docs/THEME.md`](docs/THEME.md);
for the showcase page, [`README.md`](README.md).

---

## Status: pre-alpha, Phase 0.5 (remediation)

**Don't deploy it for real users yet.** Phase 0 (foundation) shipped scaffolded rather than
wired; Phase 0.5 is connecting it. Phase 1 opens only after 0.5-7.

| Sub-phase | State (2026-10-10) |
|---|---|
| 0.5-1 Fail closed, boundary-test harness | done |
| 0.5-2 Wire authorization | done |
| 0.5-3 Connect the unwired | code-complete; owed on hardware: push on an iPhone, the iOS install guidance, a photo reaching the real bucket |
| 0.5-4 Correctness | done |
| 0.5-5 Frontend contract | done; owed on the user's phones: installing on Android and iOS |
| 0.5-6 College assignment (verified college email via Brevo, or a request to the admin) | planned, next after 0.5-7 |
| 0.5-7 First admin, working uploads, deploy docs | in progress: §1 admin command and §3b guide editor are being built on other branches; §2 uploads waits on a diagnosis; this docs set is §3 |

### What works today

- Sign up, sign in, sign out, two-factor (TOTP with backup codes), with email and password.
- A dashboard with your account, a profile photo (compressed on the device, then uploaded),
  and two-factor setup.
- Settings: reminders on this device (Web Push), quiet hours, your time zone, theme.
- Compass, the guide: 12 built-in pages, client-side search, offline copy, a settings page
  generated from the settings registry.
- The machinery under every future module: the six primitives, scoped permissions, tenancy,
  the sync pull and outbox, the reminder engine, the upload pipeline, the hourly upload
  reaper, the scheduler Worker.

### What doesn't, and who fixes it

| Gap | Owner |
|---|---|
| **Uploads fail on a real B2 bucket** (`content-length` listed in signed headers but not present) | 0.5-7 §2 |
| **Nobody can become an admin**, and `migrate` can't reach a real database | 0.5-7 §1 |
| Nothing places a student in a college; no email is sent | 0.5-6 |
| No module screen exists (Loop, Rhythm, Drip, …), so no screen writes through sync yet | Phase 1 onwards |
| The first sync pull is unpaginated | Phase 1-1 |
| A student can switch off a forced exam reminder through sync | Phase 3 (Crunch) |
| Admin "user mode" has no storage | Phase 4 |
| The guide's offline copy records no owner | Phase 4, before any role-restricted page |
| Push has never reached an iPhone; installing has never been tried on a phone | the user's phones |

Module by module, built versus planned: [`docs/APP-DETAILS.md`](docs/APP-DETAILS.md).

---

## Stack

| Layer | Choice | Version in the lockfile | Why |
|---|---|---|---|
| Frontend + API | Next.js App Router (React 19), on Vercel Hobby | Next 15.5 | one deploy for pages and API |
| Language | TypeScript, strict, `noUncheckedIndexedAccess` | 5.9 | end to end |
| Database | Neon Postgres via Drizzle ORM (`neon-http` driver) | drizzle-orm 0.39.3, drizzle-kit 0.30.6 | free tier with no idle pause |
| Local / test DB | PGlite (in-process Postgres) | 0.5.8 | real Postgres, no Docker |
| Auth | Better Auth, self-hosted, with the `twoFactor` plugin | 1.7.5 | unlimited users, TOTP built in |
| File storage | Backblaze B2 through the S3 API (`@aws-sdk/client-s3`) | — | 10 GB free, no card |
| Scheduler | Cloudflare Worker, cron every minute | wrangler 3.114 | Vercel Hobby cron is once a day |
| Push | Web Push with VAPID (`web-push`) | 3.6.7 | no FCM dependency |
| Client data | TanStack Query (persisted to IndexedDB through Dexie) + a Dexie outbox | Query 5.103, Dexie 4.4 | server-authoritative sync with offline reads |
| UI | Tailwind CSS 4.3, shadcn/ui (style `radix-vega`, `radix-ui`), `tw-animate-css`, lucide icons | — | accessible primitives on the app's tokens |
| PWA | Serwist | 9.5.12 | `next-pwa` is unmaintained |
| Markdown | react-markdown + remark-gfm + rehype-sanitize | — | the guide is DB content; sanitising is mandatory |
| Tests | Vitest, next-test-api-route-handler, Playwright | Vitest 3.2, Playwright 1.63 | [`docs/TESTING.md`](docs/TESTING.md) |
| Lint / format | Biome | 1.9.4 | one tool |
| Monorepo | pnpm workspace + Turborepo | pnpm 11.9.0, Turbo 2.11 | |

**Framer Motion is in the plan's stack but not installed**: motion today is CSS transitions
and `tw-animate-css`. Add it (and say so here) when a screen needs it.

The whole stack runs at $0 to roughly 800 users. Why each provider:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md#where-it-runs).

---

## Repository layout

```
apps/
  web/                         Next.js app: pages, API routes, service worker
    src/app/                   routes: / (welcome), (auth)/sign-in|sign-up|two-factor,
                               dashboard, settings, guide/…, compass (redirect), ~offline
    src/app/api/               the API: auth/[...all], sync, assets/presign,
                               assets/[id], assets/[id]/complete, reminders/subscribe,
                               compass, internal/tick
    src/components/            ui/ (shadcn), shell/, reminders/, profile/, compass/
    src/lib/                   auth, ctx (getCtx), env (startup check), sync/, assets/,
                               reminders/, compass/, theme-color
    src/instrumentation.ts     startup: env check, in-memory seed
    src/sw.ts                  the service worker (Serwist)
    tests/                     Vitest: route tests through tests/harness/
    e2e/                       Playwright specs
  scheduler/                   Cloudflare Worker: pings /api/internal/tick each minute
    wrangler.jsonc             name, cron trigger
packages/
  core/                        domain types, can(), settings registry, sync types, docs
                               resolution. Bundled into the browser: no process.env,
                               no node: imports, no DB
  db/                          server-only: Drizzle schema, createDbClient, scopedDb,
                               onRoleChange, requireEnv/assertEnv, seed
    src/schema/                one file per table group
    drizzle/                   migrations (append-only, R19) and meta/_journal.json
    seed/docs/                 the guide's built-in pages, one markdown file each
    src/bin/seed.ts            the seed CLI (never re-exported: runs on import)
docs/                          this documentation set (index: docs/README.md)
.github/workflows/ci.yml       CI: lint, typecheck, test, build, E2E
```

`packages/core` is separate from `packages/db` because the browser and the Worker need the
domain types without a Postgres driver.

---

## Getting started

**Prerequisites:** Node 24 (`.nvmrc`), pnpm 11.9.0. On Windows, Git for Windows' bash.

```bash
pnpm install --frozen-lockfile
cp .env.example apps/web/.env.local   # Next.js reads env files from the app's folder
pnpm --filter @clg-ess/web dev        # http://localhost:3000
```

`.env.example` uses `DATABASE_URL=pglite://memory`: an in-process PGlite that the server
migrates and seeds when it starts (a placeholder college and the guide), and that is empty
again after every restart. Every other variable must be present too, or the server
refuses to start and names each missing one; placeholders are enough to run everything
except real uploads and push. Details: [`docs/ENV.md`](docs/ENV.md#local-development).

`pnpm dev` (the root script) starts every app in watch mode through Turbo: the web app and
the scheduler's `wrangler dev`. Usually you only want the web app, as above.

`next dev` builds no service worker, so push, install and offline behaviour need a
production build: `pnpm --filter @clg-ess/web build` then `start` (with the three build
variables below in your shell). To try it on a phone, put a tunnel in front, e.g.
`cloudflared tunnel --url http://localhost:3000`, and set `BETTER_AUTH_URL` to the tunnel's
`https://` URL.

---

## Scripts

From the repository root:

| Command | What it does |
|---|---|
| `pnpm dev` | `turbo dev`: every app's `dev` script, persistent |
| `pnpm build` | `turbo build`: core → db → web and scheduler. Needs the three build variables |
| `pnpm lint` | `biome check .` (lint and format check) |
| `pnpm lint:fix` | `biome check --write .` |
| `pnpm format` | `biome format --write .` |
| `pnpm typecheck` | `turbo typecheck` |
| `pnpm test` | `turbo test`: every package's Vitest suite, never cached |
| `pnpm verify` | the full gate: `biome check .`, then `turbo run build --force`, then `turbo run typecheck test --force`. Nothing is a cache replay |

Per package (`pnpm --filter <name> <script>`):

| Package | Scripts |
|---|---|
| `@clg-ess/web` | `dev`, `build`, `start`, `typecheck` (non-incremental on purpose, R21), `test` (Vitest over `tests/`), `test:e2e` (Playwright) |
| `@clg-ess/db` | `build`, `typecheck`, `test`, `generate` (new migration from the schema), `migrate` (broken until 0.5-7 §1), `seed`; `admin` lands with 0.5-7 §1 |
| `@clg-ess/scheduler` | `dev` (`wrangler dev`), `build` (`wrangler deploy --dry-run --outdir dist`: bundles, contacts nothing), `deploy`, `typecheck`, `test` |
| `@clg-ess/core` | `build`, `typecheck`, `test` |

**The three build variables.** `next build` imports the auth module, so `pnpm build` and
`pnpm verify` need these in the shell; they are CI's, and none is a secret:

```bash
export DATABASE_URL=pglite://memory \
  BETTER_AUTH_SECRET=ci-only-value-not-a-secret-0123456789abcdef \
  BETTER_AUTH_URL=http://localhost:3000
```

Without them the build stops on `DATABASE_URL`. That is fail-closed working (R18).

---

## Tests

Unit and route tests are Vitest; route tests run the real route modules over HTTP through
`apps/web/tests/harness/`, with real Better Auth sessions and PGlite on the shipping
migrations. E2E is Playwright against a production build. At `166536f`: core 23, db 37,
scheduler 3 and web 218 tests; 18 E2E tests.

```bash
pnpm test                                 # all Vitest suites
pnpm --filter @clg-ess/web test:e2e       # builds, starts and tests a production server
```

How the harness works, how to write a route test, the mutation ("teeth") practice and
what CI runs: [`docs/TESTING.md`](docs/TESTING.md).

---

## Conventions

These are load-bearing; most were learned by breaking them. The full rule list lives in
`.agents/RULES.md` (local to the maintainer, see below).

1. **Never break the primitives.** A new module is an `item.kind` plus a detail table.
   Cross-module references go through `link`, reminders through `reminder`, uploads through
   `asset`, college data edits through `suggestion`, help text through `doc` (R1).
   [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
2. **Anything that accumulates is append-only** (wear counts, streaks): store events, derive
   totals. Sync is last-write-wins, which cannot merge counters (R2).
3. **Every table has `id` (UUID v7), `created_at`, `updated_at`, `deleted_at`; deletes are
   soft.** Only Better Auth's `session`, `account`, `verification` and `two_factor` are
   exempt (R3).
4. **Who is calling comes from `getCtx()`, never the request.** Never take an owner,
   college, role or timestamp from a payload; route college-scoped reads through
   `scopedDb` (R4). Authority is a scoped `grant` row, never a boolean column (R5).
5. **Fail closed, never at import time.** `requireEnv("X")`, never `process.env.X ||
   "default"`; no module does work when imported (R18).
6. **Migrations are append-only.** Change `packages/db/src/schema/`, run
   `pnpm --filter @clg-ess/db generate`, commit the SQL and `meta/_journal.json`. Never edit
   or hand-write a migration (R19).
7. **Test at the boundary.** Every route has a test that calls it as an unauthorised caller
   and asserts the refusal; prove a new test can fail by breaking what it covers (R17).
8. **Code with no caller is not done.** Grep for a production call site (R16).
9. **Design:** shadcn/ui first; colours only from the tokens; glass only on persistent
   chrome via `<GlassSurface>`; 44 px touch targets (R6). [`docs/THEME.md`](docs/THEME.md).
10. **Markdown is always sanitised**; never enable `rehype-raw` (R13).
11. **Help text is guide content**, in `packages/db/seed/docs/<slug>.md`, never a paragraph
    in a component (R1, R12).
12. **Package boundaries:** `packages/core` reaches the browser (no `process.env`, `node:`
    or DB); export every public symbol from the package's `src/index.ts`; consumers import
    from `dist/`, so build a dependency before running another package's tests directly
    (R20).
13. **Docs ship with the change** (R22): this file, [`docs/ENV.md`](docs/ENV.md) and
    [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) are updated in the same commit as what they
    describe. Each doc's header says when.

### Traps in this environment

- The working tree is LF but `core.autocrlf=true`: `git checkout -- <file>` writes CRLF and
  Biome then fails. Undo from a copy you made first.
- Biome's formatter is not always idempotent: if `biome check` flags a file you just
  formatted, run `biome format --write` again.
- pnpm 11 `allowBuilds`: adding a dependency with an install script writes a placeholder
  into `pnpm-workspace.yaml`, and `pnpm install --frozen-lockfile` fails until you decide it.
- A file the build writes (`apps/web/public/sw.js`) is a declared Turbo output, never a
  tracked file.
- Production has no interactive transactions (`neon-http`): make a check-then-write one
  statement, or use `db.batch`. PGlite does support transactions, so a test there proves
  nothing about Neon.
- Time zone names differ by runtime ("Asia/Kolkata" vs "Asia/Calcutta"): compare with
  `sameTimeZone`.
- After sign-in, sign-up or two-factor, enter the app with `enterApp()` (a full page load),
  never `router.push`.
- Import the schema through `schema/index` (`schema/doc` and `schema/auth` import each
  other).
- If `tsc` disagrees with the code, delete `apps/web/tsconfig.tsbuildinfo`.

---

## Documentation

| Doc | For |
|---|---|
| [`docs/README.md`](docs/README.md) | the index of this set |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | deploying and redeploying, step by step |
| [`docs/ENV.md`](docs/ENV.md) | every environment variable |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | the primitives, tenancy, permissions, sync, reminders, uploads |
| [`docs/APP-DETAILS.md`](docs/APP-DETAILS.md) | every module: built, partly built or planned |
| [`docs/THEME.md`](docs/THEME.md) | what College Ess is for, and its design system |
| [`docs/TESTING.md`](docs/TESTING.md) | how the tests work and how to write one |
| [`docs/SAGE-API.md`](docs/SAGE-API.md) | the planned personal Sage API (Phase 6, not built) |

Compass, the in-app guide, is the **student** documentation; its pages are
`packages/db/seed/docs/*.md`.

The plan, the rules, the live state and the implementation history live in `.agents/`
(`PLAN.md`, `RULES.md`, `task.md`, `HISTORY.md`). It is **gitignored and local to the
maintainer**, so it isn't in your clone; ask for it if you need the full reasoning. The
docs above are written to stand without it.

---

## License

Not yet specified.
