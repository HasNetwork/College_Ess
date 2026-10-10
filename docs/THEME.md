# Theme: what College Ess is, and how it looks

> **For:** anyone joining the project (part 1) and anyone building a screen (part 2).
> **Update it when** the product's audience or principles change (part 1), or when a
> token, a theme value, the type scale, the glass rule, a shared component's look, or a
> design guard test changes (part 2) (RULES R22).
> **Last checked against the code:** `166536f`, 2026-10-10.

"Theme" here has both meanings: the project's theme (what it is for, and the principles
that decide trade-offs) and its design theme (the visual system and the tests that hold
it).

---

# Part 1: The project

## What College Ess is

A student-life app for one college, in one place: to-dos, the weekly routine, wardrobe,
habits, exams, holidays, groceries, clubs, events, a social feed and AI guidance, plus an
in-app guide (Compass) that admins edit without a deploy. It is a **progressive web app**:
opened in a browser, installed to the home screen, usable offline.

Each module has a name: Loop (to-dos), Rhythm (routine), Drip (wardrobe), Groove (habits),
Crunch (exams), Breather (holidays), Pantry (groceries), Circles (clubs), Buzz (events),
Quad (social), Sage (AI), Compass (guide). Most are planned, not built:
[`APP-DETAILS.md`](APP-DETAILS.md) has each one's status.

## Who it is for

**Students of one college, on their phones**, typically a mid-range Android phone on
campus Wi-Fi or a patchy mobile connection; iPhones too, which receive notifications only
once the app is installed to the Home Screen. Secondary users: **college admins**, who
enter the college's shared data (holidays, events) and moderate students' suggestions, and
later **co-admins** such as club coordinators, with authority scoped to their club.

## The problem

A student's week is spread across a timetable photo, a notes app, a group chat, an exam
notice board and memory. The pieces that matter most are connected (an exam changes the
routine, an event decides the outfit, a holiday suspends the habits) and no single app
connects them. College Ess keeps them in one model, so "what's happening next week" is one
question and a to-do that turns out to be an exam moves to the exams module by itself.

## Principles

These decide trade-offs. Each is a rule in the project's rule book; the reasoning lives in
the plan.

- **Free-tier first.** The whole stack runs at $0 until there are real users: Vercel Hobby,
  Neon, Backblaze B2, Cloudflare. No service with a cost is added without flagging it
  first. That shapes the design: images are compressed on the phone before upload; the
  scheduler is a Cloudflare Worker because Vercel's free cron runs once a day; a free limit
  on B2 is an outage for the whole college, so its alerts must reach a person.
- **Sync, with an offline backup.** The server is the source of truth. The phone keeps a
  copy for reading offline and queues changes until College Ess answers again; "online"
  means College Ess answered, not that the browser says so. Conflicts resolve to the last
  write that reached the server, which is safe because almost everything belongs to one
  student. Anything that accumulates (wear counts, streaks) is an append-only log, so two
  offline phones never lose each other's entries.
- **Privacy: no training on students' data.** No model tier that trains on its inputs, or
  allows human review, ever receives real student data: not for Sage, not for classifying
  a to-do. First-party inference uses Cloudflare Workers AI, which does not train on
  inputs; Sage uses each student's own Gemini key. Drip's garment photos are cut out on the
  phone, so the original (with a face or a room in it) never leaves it. Hall tickets were
  dropped as too sensitive to store.
- **One college first.** The schema is multi-tenant from day one (`college_id` on every
  shared row), but exactly one college is seeded and run until the product is proven.
  Launching nationally would drop students into an empty app.
- **Single-player value first.** Phases front-load modules that are useful to one student
  on day one (Loop, Rhythm, Drip); social features wait for a user base.
- **Fail closed, and say what isn't built.** A missing secret stops the server; a feature
  that can't work (reminders on an uninstalled iPhone) says so instead of offering a switch
  that silently does nothing.
- **Never build chat.** Messaging belongs to an existing end-to-end-encrypted app;
  College Ess shares by reference only.

---

# Part 2: The design system

## Philosophy: Apple's restraint

The look follows Apple's design language: minimal, generous whitespace, a clear type
scale, content first, motion that explains rather than decorates, and translucent
"liquid glass" only where it helps you understand depth. Three skills govern the work, each
with its own job (R6):

| Skill | Governs |
|---|---|
| `design-principals` | **which components**: shadcn/ui first, then Aceternity, Magic UI, Motion Primitives. Never hand-roll what the library has |
| `apple-design` | **the aesthetic**: minimalism, whitespace, type, restraint, motion character |
| `liquid-glass` | **the glass technique**: translucency, blur, frosted surfaces |

Baseline for every screen: works at 375 px and at desktop width, touch targets of at least
44 px, automatic light and dark, and `prefers-reduced-motion` honoured.

## Liquid glass: where it is allowed (R6.1)

`design-principals` says to minimise `backdrop-filter`; `liquid-glass` is built on it. The
project picks one line instead of averaging:

- **Glass goes on persistent chrome only:** nav bar, tab bar, sheets, modals, sticky
  headers, toasts.
- **Never on repeated content:** no glass on list rows, grid cells, or cards in a scrolling
  collection. Drip's grid will hold 60+ garments; sixty blur layers compositing on every
  scroll frame stutter on a mid-range Android. Repeated surfaces use a solid or lightly
  tinted fill.

Glass is applied **only** through `<GlassSurface chromeRole="…">`
(`apps/web/src/components/ui/glass-surface.tsx`), which adds the `.glass-chrome` utility:
`--surface-glass-chrome` with `backdrop-filter: blur(20px) saturate(180%)`, a glass border
and shadow, and a solid `--surface-raised` fallback where `backdrop-filter` is unsupported.
`chromeRole` is one of `navbar`, `tabbar`, `header`, `modal`, `sheet`, `toast`. In use today:
the app header and tab bar (`app-shell.tsx`), the alert dialog, the sync status toast and
the time-zone prompt.

## Tokens and the two themes

Every colour comes from a semantic token in `apps/web/src/app/globals.css`. Light values
are on `:root`; dark values on `.dark`, which next-themes puts on `<html>`
(`components/theme-provider.tsx`: `attribute="class"`, default `system`). Tailwind's
`dark:` variant is redefined to follow that class
(`@custom-variant dark (&:where(.dark, .dark *))`), so a student who picks Light on a phone
set to dark gets light everything.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--surface-canvas` | `#f8f9fa` | `#09090b` | the page |
| `--surface-card` | `#ffffff` | `#121215` | cards |
| `--surface-raised` | `#f1f3f5` | `#18181b` | raised areas, glass fallback |
| `--surface-sunken` | `#e9ecef` | `#050507` | wells |
| `--surface-glass-chrome` | white 82% | `#121215` 82% | glass chrome |
| `--text-primary` | `#111827` | `#f9fafb` | body text |
| `--text-secondary` | `#4b5563` | `#9ca3af` | secondary text |
| `--text-muted` | `#646b78` | `#7f8795` | hints |
| `--primary` | `#1a60db` (the logo's blue) | `#60a5fa` | actions, links, current tab |
| `--primary-foreground` | `#ffffff` | `#09090b` | label on a primary fill |
| `--success` | `#047857` | `#10b981` | success |
| `--warning` | `#9a4a06` | `#fbbf24` | warnings |
| `--destructive` | `#c81e1e` | `#f87171` | destructive actions, errors |

Also: borders (`--border-subtle`, `--border-strong`, `--border-glass`), `--scrim` behind a
modal, `--ring`, radii (`--radius-sm` 6 px to `--radius-xl` 24 px, `--radius-full`),
shadows (`--shadow-sm/md/lg/glass`), and safe-area insets (`--sab`, `--sat`, `--sal`,
`--sar`, with `.pb-safe` and `.pt-safe`). In dark mode a filled colour is light and its
label is the dark canvas, because no blue light enough to read as text on black also takes a
white label at 4.5:1.

**shadcn/ui's colour names are aliases.** `@theme inline` exposes `bg-primary`,
`text-muted-foreground`, `bg-card` and the rest, each pointing at a token above. Change
the token, never the alias.

**The only colour literals outside the stylesheet** are in `apps/web/src/lib/theme-color.ts`,
because the web manifest and the `theme-color` meta tags need real values:
`THEME_COLOR` `#ffffff` (light browser chrome, and the manifest's `theme_color`),
`THEME_COLOR_DARK` `#09090b`, and `SPLASH_COLOR` `#1a60db` (the launch screen, the logo's
blue).

**Icons** come from the logo (`docs/logo.png`): 192 and 512 px (the 512 also maskable),
a 180 px Apple touch icon and a 48 px favicon. UI icons are lucide.

## Typography

Loaded with `next/font/google` in `app/layout.tsx`:

- **Outfit** (`--font-display`): every heading, with `letter-spacing: -0.02em`.
- **Inter** (`--font-sans`): body text and controls.

Both fall back to the system UI fonts. Inputs use 16 px text on phones, so iOS doesn't zoom
into a field when it's focused.

## Touch targets: 44 px

Everything you can tap is at least 44 × 44 px. shadcn's Button keeps that at every size:
`default` is `min-h-11` (44 px), `icon` is `size-11`, and `sm` draws 36 px but extends its
tap area to 44 px with an `::after`. The shared Switch does the same. A `.touch-target`
utility exists for anything else. Focus is a solid 2 px outline in `--primary`, not
shadcn's faint ring.

## Components: shadcn/ui, adopted for real

`apps/web/components.json` (style `radix-vega`), primitives from the unified `radix-ui`
package, `cn` from `@/lib/utils`. Today's set in `components/ui/`: Accordion, AlertDialog,
Button, Input, Skeleton, Switch, Toggle, ToggleGroup, plus the app's own GlassSurface and
NativeSelect. **To add one**, take its source from the registry
(`https://ui.shadcn.com/r/styles/radix-vega/<name>.json`) and adapt it as `button.tsx` is:
44 px to tap, the solid focus outline, tokens only, `type="button"` by default. The state
variants those components use (`data-open:`, `data-checked:`, …) are inlined in
`globals.css` rather than imported from the shadcn CLI package; `tw-animate-css` provides the
accordion's animation.

## Motion

CSS transitions and `tw-animate-css`. **Framer Motion is in the plan's stack but not
installed yet.** Under `prefers-reduced-motion: reduce`, `globals.css` cuts every
animation and transition to effectively zero.

## The guarantees, and the tests that hold them

| Guarantee | Test |
|---|---|
| Every text colour (`--text-primary`, `-secondary`, `-muted`, `--primary`, `--success`, `--warning`, `--destructive`) reaches **4.5:1** (WCAG AA) on the canvas, card, raised and glass-chrome surfaces, in **both** themes; each status colour also on its own 10% tint; each filled colour's label on its fill | `apps/web/tests/tokens-contrast.test.ts`, which parses the **shipped** `globals.css` |
| No Tailwind palette class (`bg-zinc-900`) and no raw colour (`#…`, `rgb(`, `oklch(`) anywhere in `src/` outside `lib/theme-color.ts` | `apps/web/tests/design-pwa.test.ts`, "Colour comes from the tokens" (a ratchet list, empty) |
| No raw `backdrop-blur` / `backdrop-filter` outside `.glass-chrome`; every `<GlassSurface>` declares a `chromeRole` | `design-pwa.test.ts`, "GlassSurface Chrome-Only Rule" (`KNOWN_RAW_GLASS`, empty, may only shrink) |
| `dark:` follows the chosen theme, not the OS | `design-pwa.test.ts` compiles a `dark:` class through Tailwind |
| 44 px targets, safe areas, reduced motion, glass fallback present in the stylesheet | `design-pwa.test.ts`, "Design Tokens & Global Styles" |
| Tabs only for pages that exist; Compass points at `/guide` | `design-pwa.test.ts`, "Navigation Structure & Shell" |
| Icons decode at their declared sizes, one maskable; the manifest's and the page's theme colour agree | `design-pwa.test.ts`, "PWA Manifest" |
| In a real browser: the theme both ways, 44 px on a phone, the FAQ, the toast's room at 375 px | `apps/web/e2e/frontend-contract.spec.ts` |

To add a colour: add the token in both themes, add it to `tokens-contrast.test.ts` if text
sits on it, and pick its values there first.
