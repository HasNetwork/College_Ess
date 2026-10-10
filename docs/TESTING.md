# Testing

> **For:** developers writing or running tests.
> **Update it when** a sub-phase changes the test layers, the harness's API, the E2E
> setup, the CI pipeline, the values tests use, or the verification practice (RULES R22).
> **Last checked against the code:** `166536f`, 2026-10-10.

## The rules behind the suite

Phase 0's suite passed while the app had no authorization: tests checked helpers that no
route called. So:

- **Test at the boundary** (R17). A route is tested by a real HTTP request to that route,
  not by calling the helper it ought to use. Every security rule has its **denial** case at
  the boundary: "a student of college A can't read college B" is a request, not a function
  call.
- **A test must be able to fail** (R9). One that re-implements production logic and
  asserts its own copy is deleted. A concurrency test runs its operations concurrently.
- **Verified means the real artifact** (R10.1): tests apply the shipping migrations in
  `packages/db/drizzle/`, never a copy.
- **Prove a new test has teeth**: break the check it covers and watch it go red (below).

## The layers

| Layer | Where | Runs with | Count at `166536f` |
|---|---|---|---|
| Core unit tests | `packages/core/tests/` | Vitest | 23 |
| Database tests | `packages/db/tests/`: schema on the shipping SQL, seed, guide defaults, uniqueness, import side effects, fail-closed env | Vitest + PGlite | 37 |
| Scheduler tests | `apps/scheduler/tests/scheduled.test.ts`: calls the Worker's `scheduled` export | Vitest | 3 |
| Web route and client tests | `apps/web/tests/*.test.ts`, through `tests/harness/` | Vitest + NTARH + PGlite | 218 |
| End to end | `apps/web/e2e/*.spec.ts` (9 files) | Playwright, Chromium, against a production build | 18 |

```bash
pnpm test                                   # every Vitest suite (Turbo, never cached)
pnpm --filter @clg-ess/web test             # one package
pnpm --filter @clg-ess/web exec vitest run tests/sync-route.test.ts   # one file
pnpm --filter @clg-ess/web test:e2e         # E2E
pnpm verify                                 # the full gate (below)
```

`pnpm test` builds `packages/core` and `packages/db` first (`dependsOn: ["^build"]`),
because consumers import their `dist/`. Running one package's tests directly after changing
a dependency needs `pnpm --filter @clg-ess/db build` first (R20).

## PGlite

Every database test runs real Postgres in process, with no Docker: PGlite, migrated from
`packages/db/drizzle/` by Drizzle's migrator. The app's own `createDbClient()` does this for
`pglite://memory`, once per process, and waits for the migration before the first query.
Each web test file gets a fresh, empty database: the server's seed runs only when a real
server starts (`instrumentation.ts`), never in route tests.

**PGlite is not Neon.** Production uses the `neon-http` driver, which has no interactive
transactions; PGlite has them. A test that passes inside `db.transaction` on PGlite proves
nothing about production (R21).

## The HTTP harness (`apps/web/tests/harness/`)

The harness runs the **real route module** inside Next.js's own route handling, through
`next-test-api-route-handler` (NTARH), with real Better Auth sessions. Import it from
`./harness`.

| Helper | Does |
|---|---|
| `api.get(path, options)`, `api.post(path, body, options)`, `api.delete(path, options)` | Call the route matching `path`; `options.as` signs the request in as a test user, `options.headers` adds headers. Returns `{ status, headers, body }`. An unknown path throws, so a typo can't become a passing denial test |
| `createCollege(label)` | A college row |
| `createUser(collegeId, name?, role?)` | Signs up through Better Auth's real API (a genuinely signed session cookie), then sets `college_id` and `role` directly, since sign-up refuses both |
| `createCollegeAdmin(college)` | A college admin made as production will: the role plus the grant from `onRoleChange` |
| `seedTwoColleges()` | `{ collegeA, collegeB, studentA, studentB }`: the fixture for every cross-tenant test |
| `harnessFetch(user)` | A `fetch` that routes to the real handlers as that user, for client code (the sync outbox and pull) |
| `failStatementsContaining(marker)` | Fails the route's database statements whose parameters contain `marker`, as a dropped connection does (SQLSTATE 57P01); everything else runs |
| `testDb()` | Direct access to the test database, for arranging and asserting |
| `ROUTE_PATTERNS`, `loadRoute(pattern)` | Every route the app has, for sweeps |

```ts
import { describe, expect, it } from "vitest";
import { api, seedTwoColleges } from "./harness";

describe("GET /api/sync", () => {
  it("refuses a caller with no session", async () => {
    const res = await api.get("/api/sync");
    expect(res.status).toBe(401);
  });

  it("never returns another college's shared items", async () => {
    const { studentA } = await seedTwoColleges();
    const res = await api.get("/api/sync", { as: studentA });
    expect(res.status).toBe(200);
    // …arrange an item in college B first, then assert it is absent here
  });
});
```

**The anonymous sweep.** `tests/anonymous-callers.test.ts` calls every route and method
with no session. A new route must refuse it, or be listed there as public with a reason
(`/api/compass` is public: the guide works signed out).

**The network is blocked.** `tests/harness/setup.ts` makes `S3Client.prototype.send` and
`webpush.sendNotification` reject in every test unless the test stubs them, so "runs
offline" is enforced, and a test asserts what was sent through its own stub.
`restoreMocks` and `unstubEnvs` (in `apps/web/vitest.config.ts`) undo spies and env stubs
after each test.

**Time.** Reminders follow each student's time zone, and a harness user's quiet hours are on
in UTC. A test using the real clock with a non-forced reminder passes or fails by time of
day: pin the clock (`tickAt` in `tick-timezone.test.ts`, which also avoids minute 0 and so
the reaper), or use a forced reminder. Reaper tests live in their own file
(`tick-reaper.test.ts`) so a pinned minute-0 clock can't reap another file's rows.

## The values tests use

None is a secret, and none can reach a real service.

| Where | Values |
|---|---|
| Vitest (`apps/web/tests/harness/setup.ts`) | assigned unconditionally, overriding your shell: `DATABASE_URL=pglite://memory`; random `BETTER_AUTH_SECRET`, `S3_SECRET_ACCESS_KEY` and `TICK_SECRET`; `BETTER_AUTH_URL=http://localhost:3000`; `S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com`, `S3_REGION=us-west-004`, `S3_ACCESS_KEY_ID=test-access-key`, `S3_BUCKET=test-bucket`; a fresh VAPID pair; `VAPID_SUBJECT=mailto:tests@example.com` |
| E2E server (`apps/web/playwright.config.ts`) | the same shape, with `e2e-` names, passed to the server Playwright starts |
| `pnpm build` / `pnpm verify` / CI build | CI's three: `DATABASE_URL=pglite://memory`, `BETTER_AUTH_SECRET=ci-only-value-not-a-secret-0123456789abcdef`, `BETTER_AUTH_URL=http://localhost:3000` (from `.github/workflows/ci.yml`; export them locally) |

To unset a variable inside a test, use `vi.stubEnv(name, undefined)`, never
`process.env.X = undefined` (it becomes the string `"undefined"`, R20).

## End to end (Playwright)

- **Against a production build**, not `next dev` (dev compiles each route on first request,
  and parallel workers racing those compiles timed out). Locally Playwright runs
  `pnpm build && pnpm start` on port 3000, or reuses a server already listening there; in
  CI it runs `pnpm start` on the build from the previous step.
- **In-memory database**, seeded when the server starts, so the guide exists.
- **CI settings:** one worker, up to 2 retries for diagnosis, and `failOnFlakyTests`: a test
  that passes only on a retry fails the job. `test.only` fails CI.
- **The bucket is never real.** `profile-photo.spec.ts` routes the presigned PUT to answer
  403 and checks that the photo is kept and the reason shown.
- **A service worker can hide requests** from Playwright's routing once it controls a page;
  specs that need to intercept block service workers (`sync-offline.spec.ts`).
- Before trusting a green run, repeat it: `pnpm --filter @clg-ess/web exec playwright test
  --repeat-each=3 --retries=0`. The 0.5-5 suite passed 54/54 that way.

Specs: `smoke`, `auth-flow`, `sync-offline`, `sync-pull`, `profile-photo`, `settings`,
`time-zone-prompt`, `sign-out-warning`, `frontend-contract`.

## Teeth: proving a test can fail

Each sub-phase since 0.5-1 shows its new tests have teeth by **mutation**: break the
production check a test covers, run the test, watch it go red, restore the code. A
mutation that survives (the suite stays green) means a missing test, or an equivalent
mutation, which the HISTORY log must say. The 0.5-5 log records 25/25 caught.

How to do it safely in this repository:

- **Copy the file before you break it**, and restore from the copy. Never
  `git checkout -- <file>`: `core.autocrlf=true` writes it back as CRLF and Biome fails
  every line (R21).
- **Require a green baseline and a test summary** before trusting a red. A runner that never
  started reports nothing, which reads like a result. When scripting it on Windows, run
  Vitest through `node node_modules/vitest/vitest.mjs run …`: with `shell: true`, cmd.exe
  can't run `./node_modules/.bin/vitest` (R21).
- For E2E teeth, build once with several breaks and check that exactly the matching specs
  fail.

The mutation runners used so far are local tools, kept out of the repository.

## The quality gate and CI

`pnpm verify` is the local gate, and nothing in it is a cache replay:

```
biome check .  →  turbo run build --force  →  turbo run typecheck test --force
```

It needs CI's three build values in the shell. The `test` task is uncached in
`turbo.json` anyway. A sub-phase is done only when `pnpm verify` and
`pnpm --filter @clg-ess/web test:e2e` both pass (R10).

CI (`.github/workflows/ci.yml`) runs on every push and pull request to `main`, on Ubuntu with
Node 24 and pnpm 11.9.0: `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` →
`pnpm test` → `pnpm build` → install Chromium → `pnpm --filter @clg-ess/web test:e2e`, and
uploads the Playwright report on failure. A green local run is not a green CI run: after a
push, watch it (`gh run watch <id> --exit-status`).

## Known limits

- `apps/web`'s `typecheck` is non-incremental on purpose; a bare `tsc --noEmit` uses
  `tsconfig.tsbuildinfo` and can replay a stale verdict. Delete that file if `tsc`
  disagrees with the code (R21).
- No test exercises Neon itself, a real B2 bucket, or a real push service. Those are manual
  checks on real accounts and devices ([`DEPLOYMENT.md`](DEPLOYMENT.md), step 9).
- The sync provider's offline race at hydration has no red-first test (it can't be hit on
  demand); it is covered by repeated E2E runs.
