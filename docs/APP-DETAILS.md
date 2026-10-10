# App details: every module

> **For:** developers and operators who need to know what each part of College Ess does,
> and how much of it exists.
> **Update it when** a sub-phase builds, changes or re-plans a module, an integration or a
> setting (RULES R22). A module's status changes here in the same commit as its code.
> **Last checked against the code:** `166536f`, 2026-10-10.

Status words mean what the **code** at `166536f` does, not what the plan says:

- **Built**: a student can use it today.
- **Partly built**: some of it works; what doesn't is listed.
- **Planned**: nothing a student can use. Shared machinery it will sit on (an `item.kind`, a
  `link` relation, a settings entry) may already exist, and is listed as such.

For how the shared pieces work (`item`, `link`, `reminder`, `asset`, `suggestion`, `doc`,
grants, sync), see [`ARCHITECTURE.md`](ARCHITECTURE.md). Student-facing explanations live
in Compass, the in-app guide, not here.

## At a glance

| Module | For a student | Phase | Status |
|---|---|---|---|
| Account and Settings | sign-in, two-factor, profile photo, reminders, time zone, theme | 0 / 0.5 | **Built** (photo upload fails on a real bucket, 0.5-7 §2) |
| **Compass** | the in-app guide | 0 (infra), content every phase | **Partly built** |
| **Loop** | to-do list | 1 | Planned |
| **Rhythm** | routine and timetable | 1 | Planned |
| **Drip** | wardrobe | 2 | Planned |
| **Groove** | habit tracker and builder | 3, first | Planned |
| **Crunch** | exams | 3 | Planned |
| **Breather** | holidays | 3 | Planned |
| **Pantry** | groceries | 3 | Planned |
| **Circles** | clubs | 4 | Planned |
| **Buzz** | college events | 4 | Planned |
| Support helpdesk | tickets to college staff | 4 | Planned |
| Google integration | calendar link, Google sign-in, Drive backup, Calendar sync | 3, 4.5, 6 | Planned |
| **Quad** | social feed | 5, gated | Planned (behind a go/no-go decision) |
| **Sage** | AI guidance, your own key | 6, gated | Planned; its API: [`SAGE-API.md`](SAGE-API.md) |
| Chat | messaging | — | **Not built here, ever**: an external end-to-end-encrypted app |

The tab bar shows only what exists: Dashboard, Compass, Settings
(`apps/web/src/components/shell/nav-items.ts`; a test fails on a tab to a missing page).

## Shared machinery, and how far it is wired

| Primitive | Declared | Used by a screen today |
|---|---|---|
| `item.kind` | `todo`, `event`, `exam`, `holiday`, `class_block`, `club_meeting`, `outfit_plan`, `restock` (`packages/db/src/schema/item.ts`) | none: no screen creates an item. `rrule` is a column; nothing expands it yet (1-2) |
| `link.relation` | `prepares_for`, `wears_at`, `belongs_to`, `blocks`, `derived_from`, `attended` | none |
| `reminder` | trigger `relative`, `absolute`, `geofence`, `recurring`; channel `push`, `inapp`, `email`; `forced` | the engine runs every minute and sends **push** only, whatever the channel. A recurring reminder understands `daily@HH:MM` and a millisecond interval. No screen creates one |
| `asset` purposes | `profile_photo` (1 MB), `garment_photo` (2 MB), `attachment` and default (5 MB); 50 MB per student | the profile photo |
| `suggestion` | one queue; a college admin moderates through `/api/sync` | none |
| `doc` | the guide | Compass |
| `wear_event` | append-only wear log for Drip | none |

---

## Account and Settings (foundation)

**Built.** Not a named module, but what a student meets first.

- **Welcome page** (`/`), **sign up / sign in** with email and password, **two-factor**
  (TOTP plus backup codes, set up from the dashboard; `/two-factor` at sign-in). No email
  verification yet: 0.5-6 adds it, with Brevo.
- **Dashboard** (`/dashboard`): your account, a **profile photo** (compressed on the device to
  WebP, then uploaded straight to the bucket; `user.image` holds its asset id), two-factor.
- **Settings** (`/settings`): *Reminders on this device* (subscribes this browser to Web
  Push; on an iPhone it explains that the app must be added to the Home Screen first),
  *Quiet hours*, *Time zone* (taken from the device at sign-up; the app asks when a device
  reports a different zone), and the theme (System, Light, Dark).
- **Offline:** an offline fallback page, the sync status, a notice when College Ess can't be
  reached (a campus Wi-Fi login page counts as offline).

**Primitives:** `asset` (profile photo), `reminder` and `push_subscription`. **Settings**
(registry, `packages/core/src/settings.ts`): `reminders.quietHours.enabled`,
`reminders.timeZone`, `theme.mode`.

**Not built:** joining a college (0.5-6); everyone is collegeless and sees only
platform-wide rows. The photo upload fails on a real B2 bucket (0.5-7 §2).

## Compass: the in-app guide

**Partly built.** Phase 0 (infrastructure); every phase adds its pages.

**For a student:** how College Ess works, each feature and setting, and FAQs, readable
offline and searchable.

**Built:**
- 12 built-in pages, shipped as `packages/db/seed/docs/<slug>.md` and loaded by the seed;
  `/api/compass` serves them (public: the guide works signed out).
- A college's own version of a page replaces the platform default for its students; pages
  have a `min_role` floor and an audience (`user`, `co_admin`, `admin`).
- Client-side search over the cached copy; the whole guide is cached on the device
  (`localStorage`) and works offline.
- `/guide/settings` is **generated** from the settings registry, so a setting cannot ship
  undocumented.
- The FAQ (`/guide/faq`) as an accordion, one page per question.
- Sanitised rendering (`react-markdown` + `rehype-sanitize`, raw HTML off).
- The seed records a revision for every page it writes, and keeps a page an admin edited.

**Not built:**
- **Editing in the app** lands with 0.5-7 §3b (being built in parallel; not on this
  branch): an admin sees *Edit* on a page, with a preview and *Save*, live on save, a
  revision kept. A platform admin edits the built-in pages; a college admin edits their
  college's version. Reconciled at merge.
- Revision history and rollback screens, publish/unpublish, new pages, the "suggest a
  correction" queue: Phase 4.
- Server-side search: Phase 4. The offline copy records no owner yet, which must change
  before any page is restricted by role (Phase 4's co-admin handbook).

**Primitives:** `doc`, `doc_revision`; `suggestion` (`target_type='doc'`) when corrections
land. **Integrations:** every module owes it a page (R12).

## Loop: to-do list

**Planned, Phase 1.**

**For a student:** capture a to-do in a line ("Physics exam 15th"), see it in the day and
week timeline, get reminded.

**Plan:** a to-do is an `item` with `kind='todo'`. **Classification is rules first**: date
parsing, keywords, and what you picked last time turn "Physics exam 15th" into an exam,
offline and instantly; a model (Cloudflare Workers AI, which does not train on inputs) only
refines the ambiguous remainder afterwards, and never blocks the save. Reclassifying is one
`kind` change: the item moves to Crunch.

**Primitives:** `item` (`todo`), `reminder` (opt-in), `link` (`blocks`, `prepares_for`).
**Integrations:** Groove's due habits show in the list as rows derived from the habit;
Crunch receives classified exams. **Settings:** the classifier's provider, model and on/off
switch go in the registry (R14).

**Today:** `kind='todo'` exists in the schema; there is no screen, and no screen writes
through sync yet.

## Rhythm: routine

**Planned, Phase 1.**

**For a student:** your weekly class timetable and routines per kind of day (class, exam,
holiday, study). Switching a day to holiday hides its classes without deleting them.

**Primitives:** `item` (`class_block`) with an RFC 5545 `rrule`; recurrence is Phase 1-2,
the hardest piece before the MVP (DST, "every 2nd Tuesday", cancelled occurrences, "this
occurrence or the whole series"). `reminder` (opt-in). **Integrations:** Groove habits can
be blocks in, or follow, a routine block (`link`); Breather's holidays suppress classes.

**Today:** `kind='class_block'` and the `rrule` column exist; nothing expands a rule.

## Drip: wardrobe

**Planned, Phase 2.** The differentiator, and the one module with its own model.

**For a student:** photograph each garment, record what goes with what, save outfits, log
wears, track laundry, and plan outfits for days and events.

**Plan:**
- Own tables (`garment`, `garment_pairing`, `outfit`, `outfit_garment`, `laundry_batch`, …),
  because a wardrobe is an inventory, not a timeline.
- **Pairing** ("these go together", which lets the app suggest outfits) is different from an
  **outfit** (a set you saved). The guide must say so.
- **Wear counts are derived** from an append-only `wear_event` log, never stored as a
  counter: two offline phones each logging a wear must both count (R2).
- **The garment is cut out on the phone.** A model in the browser proposes the outline; you
  fix it with taps and a brush; only the compressed cutout is uploaded. The original photo,
  with any face or room, never leaves the device. Candidates: SlimSAM or MediaPipe
  MagicTouch, after a phone test. If the model can't load, you crop by hand.

**Primitives:** `asset` (`garment_photo`, 2 MB cap; thumbnails are made for Drip's grid),
`item` (`outfit_plan`) to put an outfit on a day, `link` (`wears_at`: an outfit for an
event), `reminder` (laundry; the tick must then learn to skip a deleted garment's
reminder). **Settings:** the cutout model and an on/off switch.

**Today:** only `wear_event` (append-only; `garment_id` has no foreign key until Drip),
`kind='outfit_plan'`, `wears_at`, and the `garment_photo` purpose exist.

## Groove: habits

**Planned, Phase 3, first** (added 2026-09-28).

**For a student:** build a habit ("gym 3 times a week", "20 minutes of reading a day"),
tick it off, see streaks and a heatmap; start small and grow the target.

**Plan:** a habit is an `item` (`kind='habit'`, added by a migration then) with a recurrence
and a `habit_detail` row (target, whether holidays and exam days count, an optional
anchor). Check-ins are append-only; streaks and rates are derived. A planned skip (holiday,
exam day from Rhythm, a sick day) is not a miss. Works fully without Sage.

**Integrations:** Loop shows today's due habits; Rhythm (a habit as a block, or "after the
9 AM lecture" through a `link`); `reminder`; Sage suggests adjustments (Phase 6).

**Today:** nothing; `habit` is not an `item.kind` yet.

## Crunch: exams

**Planned, Phase 3.**

**For a student:** your exams with seat number, hall and course code, and reminders you
can't switch off.

**Primitives:** `item` (`exam`) plus an `exam_detail` table (seat, hall, course code; **no
hall ticket storage**, dropped as too sensitive). `reminder` with `forced=true`: forced
reminders ignore quiet hours. **Settings:** `reminders.exams.forced` (registry, shown as
not editable). **Integrations:** Loop classifies exams in; Groove counts exam days as
planned skips; Rhythm's exam-day routine.

**Today:** `kind='exam'`, the `forced` column and the registry entry exist, and the engine
already sends forced reminders through quiet hours. **Known gap:** sync lets a student
switch a forced reminder's `enabled` off, so "not opt-in" isn't enforced on the server yet.

## Breather: holidays

**Planned, Phase 3.**

**For a student:** college holidays for the next three months, with long weekends spotted
for you.

**Primitives:** `item` (`holiday`, usually college-wide: `user_id` empty, `college_id`
set), entered by the college admin; students propose changes through `suggestion`.
**Integrations:** Rhythm suppresses class blocks; Groove treats holidays as planned skips;
the calendar link.

## Pantry: groceries

**Planned, Phase 3.**

**For a student:** what's in your room's pantry, quantities, expiry dates, and a restock
nudge.

**Primitives:** `item` (`restock`), `reminder` (expiry); quantities that go down are
append-only events (R2).

## Circles: clubs

**Planned, Phase 4.**

**For a student:** your clubs, their meetings, and club chats (in the external chat app).

**Primitives:** `item` (`club_meeting`), `link` (`belongs_to`: a meeting belongs to a
club; such college-wide links will make `link.user_id` nullable and add `college_id`).
**Permissions:** when a member becomes a club's coordinator, they get `manage:club`
scoped to that club automatically (the `co_admin` role and the `club` scope already exist;
`can()` already lets a college-scoped grant cover that college's clubs, once clubs can be
looked up). **Integrations:** Buzz events; the chat app, shared by reference only.

## Buzz: events

**Planned, Phase 4.**

**For a student:** college events: venue, registration, capacity, and what to wear.

**Primitives:** `item` (`event`) plus `event_detail` (venue, registration URL, capacity);
`link` (`attended`; `wears_at` from a Drip outfit; `prepares_for`). **Integrations:** Drip
picks an outfit; Circles hosts events; event posters through `asset`; discussion in the
chat app.

## Support helpdesk

**Planned, Phase 4**, with the admin panel. A student opens a ticket with their college's
staff (college admins, and co-admins holding `handle:support`). Tickets are asynchronous,
have a category, status and assignee, an append-only reply thread, and are readable by
staff by design. It is the one exception to "never build chat", because it is not chat.

## Google integration

**Planned.**
1. **Calendar link** (Phase 3): a private, revocable subscription link (ICS) for Google,
   Apple or Outlook calendars. Google refreshes it only every 12–24 hours.
2. **Sign in with Google** (Phase 4.5): name, email and profile only.
3. **Back up to my Google Drive** (Phase 4.5): scheduled and "back up now", into the app's
   hidden folder (`drive.appdata`), photos copied incrementally.
4. **Direct Google Calendar sync** (Phase 4.5), after Google's app review, which can take
   months: start it early.

Never Gmail or full Drive (restricted scopes need a paid assessment). The reminder engine
stays the only thing that notifies.

## Quad: social feed

**Planned, Phase 5, gated.** Feed, posts, stories, follows and moderation. It starts only
after a go/no-go decision with active users in one college, a written moderation policy
with a staffed grievance process, and a legal review (India's IT Rules 2021). Its own
bounded context, not built on `item`. Storage and egress must be priced before the
decision.

## Sage: AI guidance

**Planned, Phase 6, gated on the other modules.**

**For a student:** an assistant that knows your schedule, exams, wardrobe and tasks, and
can act through the other modules' APIs.

- **Bring your own key.** Each student supplies their own Google Gemini key, encrypted at
  rest. Gemini's free tier trains on its inputs, so it never receives real student data
  through a shared key.
- **Runs on the server, in the background:** closing the app never loses an answer; a
  finished run can send a push.
- **A personal Sage API** follows: [`SAGE-API.md`](SAGE-API.md) (a design spec; nothing
  built).

## Chat

**Not built by College Ess, in any phase.** All messaging goes to an existing external
end-to-end-encrypted app. College Ess shares by reference (an id the receiving app fetches
with its own permissions), never by content, and can never read, search, moderate or post
into a conversation.

---

## The settings registry today

`packages/core/src/settings.ts` declares every setting once; `/guide/settings` renders from
it.

| Key | Audience | Default | Editable | Stored and used? |
|---|---|---|---|---|
| `reminders.quietHours.enabled` | user | `true` | yes | **yes**: `user.quiet_hours_enabled`, read by every tick |
| `reminders.timeZone` | user | `UTC` | yes | **yes**: `user.timezone`, set from the device at sign-up |
| `theme.mode` | user | `system` | yes | **yes**, on the device (next-themes) |
| `reminders.exams.forced` | user | `true` | no | declared; not enforced on the server (Crunch) |
| `sync.offlineMode` | user | `true` | no | declared only. **Its description promises an offline "daily routine" and "wardrobe inventory", neither of which exists**; the generated settings page shows that text |
| `admin.userMode` | admin | `false` | yes | declared only: no storage; `getCtx()` always sets it `false` (Phase 4) |
