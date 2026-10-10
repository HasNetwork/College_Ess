# Sage API: a student's own API (design spec)

> **Status: Planned, Phase 6. Nothing here is built.** Sage itself does not exist yet, and
> no endpoint below answers. Every endpoint, shape, header and code is **proposed, decided
> in Phase 6**; treat none of it as a contract.
> **For:** whoever plans and builds Phase 6, and anyone asking "could my app talk to
> College Ess?".
> **Update it when** a Phase 6 decision is taken (move it from *proposed* to *decided*), and
> when the API is built: from then on whoever builds or changes the API keeps this file
> current in the same commit (RULES R22). Until then, also update it if PLAN §9.1, §9.3,
> §11.1, §12 or RULES R4, R5, R8, R14 or R15 change.
> **Sources:** PLAN §12 and §12.1 (decided 2026-09-28), §9.1, §9.3, §11.1; RULES R4, R5, R8,
> R14, R15. Better Auth's API-key plugin docs, checked 2026-10-10 (context7).

## What it is for

Students call **their own** Sage, and read **their own** College Ess data, from **their
own** apps and scripts: "what's due this week?" from a home-screen widget, a study bot
that knows their exam dates, a script that exports their routine. Answers are grounded in
the student's College Ess data and nothing else, and every call is limited to what that
student could do in the app.

It is not a public API for third-party services acting for many students, and not an API
for admins. Those would be separate decisions.

## Prerequisites (none of them exist yet)

1. **Sage in the app** (Phase 6): a question becomes a **run** on the server, using the
   student's own Gemini key (BYOK), and the answer is saved as it arrives.
2. **BYOK storage**: each student's Gemini key, encrypted at rest, decrypted only on the
   server, never logged, echoed or returned by any API (R8).
3. **Personal API keys** in Settings (below).

The API comes after Sage works in the app (§12.1).

## Authentication: personal API keys

**Proposed — decided in Phase 6**, on the plan's terms:

- A student creates a key in **Settings**. It is **shown once**, then stored **hashed**.
- Every key **expires**. It is **read-only** unless the student ticks "allow changes"
  when creating it. It is **revocable** at once, shows its **last-used time**, and has its
  **own rate limit**.
- A request carries the key in a header (the plugin's default is `x-api-key`).

### Built on Better Auth's API-key plugin

Better Auth provides keys, hashing, expiry, per-key rate limits, per-key permissions, a
last-request time, and **sessions built from keys** (`enableSessionForAPIKeys: true`). With
that option, a request carrying a valid key gets a session for the key's owner, so the
app's existing checks apply **unchanged**:

- `getCtx()` (`apps/web/src/lib/ctx.ts`) resolves the caller from that session: user,
  college, role and active grants from the server's rows (R4). Nothing the caller sends
  sets its scope.
- Tenancy (`scopedDb`, the per-table sync policy) and `can()` grants (R5) apply as they do
  in the browser.

That is why "the rest of College Ess" is reachable with a key: every route the student can
use signed in is reachable with their key, within exactly their permissions, and no
route needs a second authorization model. It is also the main risk (next section).

**What the installed version means for enabling it** (checked 2026-10-10):

| | |
|---|---|
| Installed | `better-auth` **1.7.5** (`apps/web`, `packages/db`) |
| Plugin | Since Better Auth 1.5 the API-key plugin is a **separate package, `@better-auth/api-key`** (it was `better-auth/plugins` before). It is **not installed**: `better-auth/dist/plugins` in 1.7.5 has no api-key plugin |
| Enabling it would | add the dependency (check its install scripts against `allowBuilds`, R21); add `apiKey({ enableSessionForAPIKeys: true, … })` to `lib/auth.ts`; add an `apikey` table by a generated migration (R19) |
| Schema friction | The plugin's `apikey` table has `createdAt`/`updatedAt` but **no `deleted_at`**, and keeps a mutable `requestCount`. R3.1's list of auth tables exempt from the sync triple is "exhaustive", so it must be extended (keys are never synced; a revoked key should really disappear, like a session), or the table adapted. Its ids follow the app's `generateId` (UUID v7, R3.2) |
| Defaults to override | Keys **don't expire by default** (`keyExpiration.defaultExpiresIn` is `null`); clients may pick their own expiry between 1 and 365 days unless `disableCustomExpiresTime`. Set an expiry and a rate limit explicitly; never rely on defaults |

### The gap a session-from-key opens

A key session is, to every route, the student. Three consequences the build must handle
(proposed — decided in Phase 6):

1. **Read-only must be enforced by the app, not the plugin.** `getCtx()` and `can()` don't
   know a request came from a key. Every write path (`POST /api/sync`, uploads, the Sage
   run endpoints that change data) must refuse a key without the "changes" permission:
   for example `getCtx()` reports `via: "apiKey"` and the key's permissions.
2. **Account management stays browser-only.** A key must never change the password, the
   email, two-factor, or create or revoke keys. Better Auth's own `/api/auth/*` endpoints
   need an explicit block for key sessions.
3. **Tests at the boundary** (R17): each refusal above is an HTTP request with a key, shown
   to go red when its check is removed; `tests/anonymous-callers.test.ts` gains the new
   routes.

## The run model

Asynchronous, because Sage runs in the background on the server (§12): closing the app or
dropping the connection never loses an answer.

```mermaid
sequenceDiagram
  participant C as Student's app
  participant A as College Ess API
  participant R as Run executor
  participant G as Gemini (student's key)
  C->>A: POST /api/sage/runs (x-api-key, Idempotency-Key)
  A-->>C: 202 { runId, status: "queued" }
  A->>R: start run
  R->>G: model call(s), tools over the student's data
  R->>A: save answer as it arrives; status done or failed
  alt polling
    C->>A: GET /api/sage/runs/:id
    A-->>C: { status, answer }
  else webhook
    A->>C: POST to the student's URL, signed
  end
  A-->>C: "Sage replied" push (reminder pipeline)
```

- **States:** `queued` → `running` → `done` | `failed`. A run records its status; nothing
  else moves it.
- **A retry never answers twice.** A request repeated with the same `Idempotency-Key`
  returns the original run. On the executor side, starting a run is a compare-and-set on
  its status in one statement (production's `neon-http` has no interactive transactions,
  R21), the same pattern as the reminder claim.
- **In the app**, answers reach the phone through the normal sync pull (a run is a row the
  student can read), live while the app is open.
- **A finished run can send a "Sage replied" push** through the existing reminder pipeline,
  not a second notifier (R1): for example, the run inserts a due `reminder` for its owner,
  and the next minute's tick sends it. Quiet hours apply.

## Where runs execute

**Undecided; decide in Phase 6.** Both options cost $0 (Vercel's and Cloudflare's docs,
checked 2026-09-28, PLAN §12):

| | Vercel (the app's host) | Cloudflare Workflows (the scheduler's account) |
|---|---|---|
| Limit | a function, including work after the response (`after()`), runs at most **300 s** on Hobby | a step may wait on the network without limit, with **10 ms of CPU** per step; 100 runs at once; 100,000 a day, shared with Workers; finished state kept 3 days |
| Fits | one answer | long multi-step runs with tools; retries built in |

Either way the model call happens **on the server**, never in the browser or the
student's client: a call from a page dies with the page and would expose the key.

## Proposed endpoints

**Proposed — decided in Phase 6.** In the style of the existing routes
(`apps/web/src/app/api/`): JSON bodies with camelCase fields, UUID v7 ids, ISO 8601
timestamps, and errors as `{ "error": "<sentence>" }` with an HTTP status.

| Method and path | Key permission | Does |
|---|---|---|
| `POST /api/sage/runs` | changes¹ | Start a run. Body `{ "question": "…" }`; header `Idempotency-Key`. `202 { "runId", "status": "queued" }` |
| `GET /api/sage/runs/:id` | read | `{ "id", "status", "createdAt", "updatedAt", "answer"?, "error"? }` |
| `GET /api/sage/runs?since=<ISO>` | read | Runs changed since a time, newest first |
| `DELETE /api/sage/runs/:id` | changes | Cancel a queued or running run (soft delete, R3) |
| `GET /api/sync?since=<ISO>` | read | **Exists today.** The student's own rows (items, reminders, links, assets, their suggestions), as the app's pull receives them |
| `GET /api/compass` | none | **Exists today**, public: the guide |

¹ Whether asking a question needs "changes" is itself open: a run spends the student's
Gemini quota and may let Sage call write tools.

Proposed error codes, consistent with today's routes:

| Status | When |
|---|---|
| 400 | malformed body or missing `question` |
| 401 | no key, an unknown, expired or revoked key |
| 403 | the key is read-only and the request changes something; or the route is browser-only |
| 404 | no such run **for this student**. Another student's run is also 404, never 403, so a response never confirms that someone else's id exists (as `/api/sync` does) |
| 409 | the same `Idempotency-Key` with a different body; or no Gemini key is set up |
| 429 | this key's rate limit; `Retry-After` says when |
| 503 | the run executor is unavailable; nothing was queued |

### Webhooks

**Proposed — decided in Phase 6.** A key may name one `https://` URL. When a run finishes,
College Ess POSTs `{ "runId", "status" }` (not the answer: the client fetches it with its
key) with a signature header, e.g. `X-CollegeEss-Signature: t=<unix seconds>,v1=<hex
HMAC-SHA256 of "t.body" with the key's webhook secret>`, and retries a few times with
backoff. The URL must be checked against private and internal addresses (SSRF), and
delivery runs from the server's background work, never in a request.

## Costs and abuse

- **Inference is on the student's own Gemini key.** Their usage, their quota.
- **Hosting quotas are shared by the whole college**: Vercel's function time, Neon's
  compute, Cloudflare's daily request allowance. One student's script in a loop could use
  up everyone's day. **Per-key rate limits are mandatory**, not an option, and set
  explicitly (the plugin's defaults are not a plan).
- **A leaked key exposes that student's data.** Hence: shown once, hashed, expiring, a
  last-used time in Settings, instant revocation, read-only by default.
- **Prompt injection.** A question arriving through the API is untrusted input, like any
  prompt. So is data Sage reads that someone else wrote (a club description, an event
  blurb, Phase 4). Sage's tools are read-only unless the key allows changes, and a tool
  never acts outside the caller's own scope, because it runs as the caller.

## What it never does

- **No chat access** (R15). Sage cannot read, search, summarise or post into the external
  chat app's conversations; they are end-to-end encrypted, and College Ess never holds the
  keys.
- **Nothing leaves the student's scope.** Every read and write goes through `getCtx()`,
  `scopedDb` and `can()` as the student (R4, R5). An API key grants no more than the
  student has, and a college admin's key is not a way to export the college.
- **No personal data to a tier that trains on it** (PLAN §9.1, §9.3, R14). A free Gemini key
  trains on its inputs and allows human review; Google's policy also forbids passing
  Calendar or Drive data to such models (§11.1). Sage gets Google data only through a key on
  a paid tier, or not at all. Whether to refuse free-tier keys outright, or to warn and let
  the student choose for their own non-Google data, is a Phase 6 decision; Compass must state
  the trade-off plainly at setup.
- **No secret in a response.** Neither the Gemini key nor an API key's full value is ever
  returned after creation, logged or echoed (R8).
- **Sage is never in another feature's write path** (R14): a to-do saves without it; a
  failed run is a `failed` run, not an error in another screen.

## The MCP option

PLAN §12.1 also suggests an **MCP server**, so a student's own AI tools (a desktop
assistant, an IDE) can read their College Ess data with their permission. It would sit on
the same keys and the same `getCtx()` path, exposing read tools first. **Decide in Phase
6**, after the HTTP API.

## Open decisions

1. Where runs execute: Vercel functions or Cloudflare Workflows (§12).
2. Adopt `@better-auth/api-key` (and amend R3.1 for its table), or build keys in-house.
3. How "read-only" is enforced for key sessions (`getCtx()` reporting the key and its
   permissions is the proposal), and which `/api/auth/*` endpoints a key may never reach.
4. Default and maximum key expiry; the per-key rate limit; whether limits differ for
   reading and for starting runs.
5. Whether starting a run needs the "changes" permission.
6. Webhooks at all, or polling only to start with; the signing scheme; retry policy.
7. What a run row holds and how long it is kept; whether answers are part of the sync pull
   or a separate read.
8. Free-tier Gemini keys: refuse, or warn and allow for non-Google data.
9. Which write tools Sage gets, and whether a write needs the student's confirmation in
   the app.
10. An MCP server, and when.
11. Versioning (`/api/v1/…` or a header) once the first external client exists.
