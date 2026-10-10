# Environment variables

> **For:** developers and operators.
> **Update it when** any variable is added, removed, renamed, or changes meaning, in the
> **same commit**, together with `.env.example` (RULES R8, R22). A new required server
> variable also goes into `REQUIRED_SERVER_ENV` (`apps/web/src/lib/env.ts`), and onto
> Turbo's `build` task in `turbo.json` if `next build` needs it (R18).
> **Last checked against the code:** `166536f`, 2026-10-10.

This is the **reference**: what each variable is, who reads it, and what breaks without it.
The **steps** for setting production values (creating the Neon database, the B2 bucket, the
Vercel project, the Worker's secrets) live in [`DEPLOYMENT.md`](DEPLOYMENT.md).

## Keeping this current

Coder agents: when you add, remove or rename a variable, update this file and
`.env.example` in the same commit. A test enforces half of that:
`apps/web/tests/startup-env.test.ts` fails if `.env.example` lacks any name in
`REQUIRED_SERVER_ENV`. Nothing checks this file, so check it yourself:

```bash
# every variable the code reads by name
git grep -nE "requireEnv\(\"|process\.env\.[A-Z_]+|env\.[A-Z_]{3,}" -- apps packages
```

## Fail-closed configuration (RULES R18)

There are no fallback values. "Required" means required in **every** environment,
development and CI included.

- A required variable that is missing, or blank, is never replaced by a default. Code reads
  it with `requireEnv("X")` (`packages/db/src/env.ts`), which throws naming it.
- `process.env.X || "<default>"` is forbidden.
- **To unset a variable in a test**, use `vi.stubEnv(name, undefined)`. Assigning
  `undefined` to `process.env` stores the string `"undefined"`, which `requireEnv` accepts
  (R20).

## When each variable is read

| Moment | What checks | What happens without a required variable |
|---|---|---|
| **Server start** (`next dev`, `next start`, a Vercel function's cold start) | `instrumentation.ts` → `enforceServerEnv()` asserts all twelve names in `REQUIRED_SERVER_ENV` at once | The process logs `[startup] Refusing to start: missing required environment variables: <every missing name>` and exits 1. It exits because Next.js only logs an error thrown from `register()` and would otherwise serve 500s |
| **Build** (`next build`) | Building imports `lib/auth.ts` and route modules, which call `createDbClient()` and `requireEnv` at module level | `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` must be set at build time. They are declared on Turbo's `build` task (`turbo.json`), because Turbo's strict env mode passes no undeclared variable to a task |
| **First use** | `requireEnv` inside the S3 client, the VAPID setup and the tick route | Unreachable in a running server (the start check came first); in a script or test it throws naming the variable |
| **Unit and route tests** | `apps/web/tests/harness/setup.ts` assigns its own values unconditionally | Your shell's values are overwritten, so a test can never reach a real database or bucket |
| **E2E** | `apps/web/playwright.config.ts` passes its own values to the server it starts | Same: none of your values reach that server |

## Web app variables

Read by `apps/web` (Next.js, on Vercel in production). The twelve marked **required** are
`REQUIRED_SERVER_ENV`.

### `DATABASE_URL`

| | |
|---|---|
| Read by | `createDbClient()` in `packages/db/src/client.ts` (every route, Better Auth, the tick); `lib/in-memory-seed.ts` (decides whether to seed on start). Also every `packages/db` CLI command ([below](#database-package-cli)) |
| Required | **Yes**, at start **and at build** |
| Example | `postgresql://app:…@ep-quiet-sun-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` · locally `pglite://memory` |
| Get it | Neon console → Connect. Vercel gets the **pooled** string (`-pooler` in the host); migrations get the **direct** one ([DEPLOYMENT step 3](DEPLOYMENT.md#3-neon-create-migrate-seed)) |
| Without it | No start, no build. `createDbClient` throws instead of silently booting a throwaway database |

- A value starting `pglite://` (or exactly `memory`) gives an **in-memory PGlite** inside the
  server process: migrated from the shipping SQL on first use, seeded on start, and empty
  again on every restart. For local development and E2E only.
- Any other value goes to Neon's **HTTP driver** (`drizzle-orm/neon-http`). It speaks HTTPS
  to Neon, not the Postgres wire protocol, so a plain local Postgres
  (`postgresql://…@localhost:5432/…`) does **not** work. It also has no interactive
  transactions (R21).

### `BETTER_AUTH_SECRET`

| | |
|---|---|
| Read by | `lib/auth.ts` (`betterAuth({ secret })`) |
| Required | **Yes**, at start **and at build** |
| Example | 44 base64 characters, e.g. the output of `openssl rand -base64 32` |
| Generate | `openssl rand -base64 32`, once per environment |
| Without it | No start, no build |

It signs sessions, and Better Auth 1.7.5 encrypts each account's TOTP (two-factor) secret
with it. **Never rotate it casually**: a new value signs everyone out and locks every
two-factor account out. Production's value is never reused anywhere else.

### `BETTER_AUTH_URL`

| | |
|---|---|
| Read by | `lib/auth.ts` (`baseURL`); the test harness uses it as the request origin |
| Required | **Yes**, at start **and at build** |
| Example | `https://clg-ess.qd.je` · locally `http://localhost:3000` |
| Without it | No start, no build |

The public origin, with no trailing slash. Better Auth trusts requests from this origin;
requests from any other origin are refused, so a wrong value breaks sign-in and sign-up
from the real site. The browser client calls the origin it was served from, so no
`NEXT_PUBLIC_` copy exists (removed in 0.5-1: its fallback pointed builds at localhost).

### `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`

| | |
|---|---|
| Read by | `lib/assets/storage.ts` (`getStorageClient()`, `storageBucket()`): presigning uploads and views, HEAD on `/complete`, deletes by the reaper |
| Required | **Yes**, at start (not at build) |
| Example | `https://s3.us-west-004.backblazeb2.com` · `us-west-004` · `004a1b2c3d4e5f60000000001` · (40 characters) · `college-ess-assets` |
| Get them | The B2 bucket's Endpoint and a bucket-scoped Read and Write application key ([DEPLOYMENT step 4](DEPLOYMENT.md#4-backblaze-b2-bucket-key-cors-lifecycle-caps--alerts)) |
| Without them | No start |

- `S3_ENDPOINT` includes `https://`. `S3_REGION` is the region inside the endpoint; a
  mismatch makes every signature invalid.
- `S3_ACCESS_KEY_ID` is B2's `keyID`; `S3_SECRET_ACCESS_KEY` is its `applicationKey`, shown
  once. Never the master key.
- **Placeholder values let a local server start.** Then a presign still succeeds (URLs are
  signed locally, without the network), and the upload itself fails loudly. Nothing fakes
  success.
- Vendor-neutral names: any S3-compatible store works by configuration alone. They replaced
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` and the
  unused `R2_PUBLIC_URL` on 2026-09-25, when storage moved from Cloudflare R2 to Backblaze
  B2.

### `TICK_SECRET`

| | |
|---|---|
| Read by | `app/api/internal/tick/route.ts`, on every request, compared in constant time (SHA-256 digests, `timingSafeEqual`). Accepted as the `x-tick-secret` header or `Authorization: Bearer …` |
| Required | **Yes**, at start. The check always runs |
| Example | `openssl rand -base64 32` output |
| Generate | `openssl rand -base64 32`; the **same value** goes to the scheduler Worker |
| Without it | No start. A wrong value: every tick is 401, so no reminder is sent and no upload is reaped |

### `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

| | |
|---|---|
| Read by | `lib/reminders/vapid.ts`: `webpush.setVapidDetails` before sending; `GET /api/reminders/subscribe` returns the **public** key to the browser |
| Required | **Yes**, at start |
| Example | public: 87 base64url characters · private: 43 · subject `mailto:admin@clg-ess.qd.je` |
| Generate | `pnpm --filter @clg-ess/web exec web-push generate-vapid-keys` (add `--json` for JSON) |
| Without them | No start |

- **Never rotate the key pair** once students have turned reminders on: every device's
  subscription is bound to the public key, and new keys break push on every device until
  each student turns reminders off and on again.
- The private key never leaves the server; a route test asserts the subscribe route's
  answer doesn't contain it.
- `VAPID_SUBJECT` is a `mailto:` (or `https:`) contact that push services can use to reach
  you. In production it is a real, routed mailbox ([DEPLOYMENT step 2](DEPLOYMENT.md#2-domain-and-dns)).

### Variables the app reads but never sets

| Variable | Set by | Read by | Effect |
|---|---|---|---|
| `NODE_ENV` | Next.js and Vercel. Don't set it in Vercel | `next.config.ts`; `components/pwa-register.tsx` | In `development` the service worker is neither built (Serwist `disable`) nor registered, so `next dev` has no offline support and no push. Better Auth's sign-in rate limit is on in production mode only (PLAN §9.4) |
| `NEXT_RUNTIME` | Next.js | `instrumentation.ts` | The startup check and the in-memory seed run in the `nodejs` runtime only |
| `PORT` | you, optionally | Next.js itself (`next dev` / `next start`), not the app's code | Defaults to 3000. If you change it locally, change `BETTER_AUTH_URL` to match. E2E always uses 3000 |
| `CI` | GitHub Actions | `apps/web/playwright.config.ts` | Set: 1 worker, 2 retries, a test that passes only on a retry fails the run, `test.only` fails, and the E2E server is `pnpm start` on an existing build. Unset: `pnpm build && pnpm start`, and an already-running server on 3000 is reused |

### Vercel build setting (not read by the app)

| Variable | Value | Why |
|---|---|---|
| `ENABLE_EXPERIMENTAL_COREPACK` | `1` | Makes Vercel install with `pnpm@11.9.0`, from the root `package.json`'s `packageManager` ([DEPLOYMENT step 6](DEPLOYMENT.md#6-vercel)). |

## Scheduler Worker variables

Read by `apps/scheduler/src/index.ts`. Set in production with `wrangler secret put <NAME>`;
locally in `apps/scheduler/.dev.vars` for `wrangler dev`. **`.dev.vars` is not in
`.gitignore` at `166536f`**: never put a real secret in it, and check `git status` before
committing.

| Variable | Required | Example | Without it |
|---|---|---|---|
| `APP_URL` | **Yes** | `https://clg-ess.qd.je` (no trailing slash; the Worker appends `/api/internal/tick`) | Every scheduled run throws `[Scheduler] Refusing to tick: missing APP_URL` and is marked failed. It never ticks a localhost default |
| `TICK_SECRET` | **Yes** | the web app's `TICK_SECRET`, exactly | Same, naming `TICK_SECRET`. A different value: the app answers 401 and the Worker logs `Tick failed with HTTP status 401` |

`ENVIRONMENT` is declared in the Worker's `Env` type but **never read**. Don't set it.

## Database package CLI

`packages/db`'s commands read only `DATABASE_URL`:

| Command | Needs `DATABASE_URL`? | Notes |
|---|---|---|
| `pnpm --filter @clg-ess/db generate` | No | Writes a new migration from the schema; works offline |
| `pnpm --filter @clg-ess/db migrate` | Yes, but **ignored at `166536f`** | `drizzle.config.ts` has no `dbCredentials`, so it fails even with `DATABASE_URL` set. Fixed by 0.5-7 §1 |
| `pnpm --filter @clg-ess/db seed` | Yes | `src/bin/seed.ts`. With `pglite://memory` it seeds a database that disappears when the command exits |
| `pnpm --filter @clg-ess/db admin …` | Yes | **Lands with 0.5-7 §1**; doesn't exist at `166536f` ([DEPLOYMENT step 8](DEPLOYMENT.md#8-the-first-admin)) |

Run them from your machine with Neon's **direct** connection string in that one shell.

## Local development

Next.js reads env files from the app's own folder, so the file is `apps/web/.env.local`
(gitignored), not the repository root:

```bash
cp .env.example apps/web/.env.local
```

`.env.example` is set up for this: `DATABASE_URL=pglite://memory` and placeholder values
for everything else. That is enough to run the app, sign up, use the guide and Settings.
Uploads and push fail until you put real B2 and VAPID values in; generate VAPID keys with
the command above. Never put production values in a local file.

`pnpm build` and `pnpm verify` run outside Next's env files, so they need CI's three build
values in the shell (from `.github/workflows/ci.yml`):

```bash
export DATABASE_URL=pglite://memory \
  BETTER_AUTH_SECRET=ci-only-value-not-a-secret-0123456789abcdef \
  BETTER_AUTH_URL=http://localhost:3000
```

## Production

All values live in the hosting dashboards; there is no production `.env` file, and no real
value is ever committed (R8).

- **Vercel** → Project → Settings → Environment Variables, scoped to **Production**. Give
  **Preview** its own values or none; never Production's.
- **Cloudflare Worker** → `wrangler secret put <NAME>`.

Which value comes from where, and in what order, is [`DEPLOYMENT.md`](DEPLOYMENT.md).
