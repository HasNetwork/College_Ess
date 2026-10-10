import { QUIET_HOURS } from "@clg-ess/core";
import { schema } from "@clg-ess/db";
import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { type PushPayload, sendPushNotification } from "./vapid";

export interface TickOptions {
  now?: Date;
  // biome-ignore lint/suspicious/noExplicitAny: polymorphic db client
  db: any;
  // Optional custom push sender for mocking in tests
  pushSender?: typeof sendPushNotification;
}

export interface TickResult {
  processedCount: number;
  deliveredCount: number;
  suppressedQuietHoursCount: number;
  suppressedDeletedSubjectCount: number;
  purgedSubscriptionsCount: number;
  /** Due reminders an overlapping tick claimed first, so this tick did not send them. */
  claimedElsewhereCount: number;
  /**
   * Occurrences of recurring reminders that passed while no tick ran (an outage). They are
   * skipped rather than sent in a burst, and each reminder's gap is logged.
   */
  missedOccurrencesCount: number;
}

export interface QuietHoursConfig {
  enabled: boolean;
  startHour: number; // e.g. 22 (10 PM)
  endHour: number; // e.g. 7 (7 AM)
  timezone?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The wall-clock fields of `instant` in `timeZone`. */
function wallClock(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    // Not `hour12: false`, which some engines render as "24" at midnight.
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(instant));
  const field = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: field("year"),
    month: field("month"),
    day: field("day"),
    hour: field("hour"),
    minute: field("minute"),
    second: field("second"),
  };
}

/** How far `timeZone`'s clock is ahead of UTC at `instant`, in milliseconds. */
function utcOffset(instant: number, timeZone: string): number {
  const wall = wallClock(instant, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * The instant at which the clock in `timeZone` reads `year-month-day hour:minute`. `day` may
 * run past the month's end (Date.UTC carries it into the next). Across a DST change, a time
 * that happens twice resolves to the first, and a time the clocks skip resolves to the same
 * wall time an hour later (02:30 on the spring-forward night becomes 03:30).
 */
function wallTimeToInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const before = utcOffset(wall - DAY_MS, timeZone);
  const after = utcOffset(wall + DAY_MS, timeZone);
  const fits = [wall - before, wall - after].filter(
    (instant) => instant + utcOffset(instant, timeZone) === wall,
  );
  return new Date(fits.length > 0 ? Math.min(...fits) : wall - before);
}

/** The first instant strictly after `after` at which the clock in `timeZone` reads hour:minute. */
function nextDailyAfter(after: number, hour: number, minute: number, timeZone: string): Date {
  const today = wallClock(after, timeZone);
  for (let days = 0; ; days++) {
    const at = wallTimeToInstant(today.year, today.month, today.day + days, hour, minute, timeZone);
    if (at.getTime() > after) return at;
  }
}

/** Days since the epoch of `instant`'s calendar date in `timeZone`. */
function localDayNumber(instant: number, timeZone: string): number {
  const wall = wallClock(instant, timeZone);
  return Date.UTC(wall.year, wall.month - 1, wall.day) / DAY_MS;
}

/**
 * Checks whether the current time falls within the user's quiet hours.
 */
export function isWithinQuietHours(now: Date, config: QuietHoursConfig): boolean {
  if (!config.enabled) return false;

  const currentHour = wallClock(now.getTime(), config.timezone || "UTC").hour;

  if (config.startHour > config.endHour) {
    // Overnight window: e.g. 22:00 to 07:00
    return currentHour >= config.startHour || currentHour < config.endHour;
  }
  // Daytime window: e.g. 13:00 to 15:00
  return currentHour >= config.startHour && currentHour < config.endHour;
}

export interface NextFire {
  /** When the reminder fires next; `null` for a one-shot, which is then switched off. */
  at: Date | null;
  /** Occurrences between the one being fired and `now`: skipped, not sent in a burst. */
  missed: number;
}

/**
 * When a recurring reminder fires after the occurrence `firedFor`, fired at `now`.
 *
 * `daily@HH:MM` is a wall-clock time in the student's `timeZone`: 9:00 stays 9:00 local
 * across a DST change, and however late a tick runs, the next one is the first 9:00 after
 * `now` (the anchor is the trigger value, never `now + 24h`). A numeric value is an
 * interval in milliseconds, anchored on `firedFor`.
 */
export function calculateNextFireAt(
  firedFor: Date,
  triggerKind: string,
  triggerValue: string,
  now: Date,
  timeZone: string,
): NextFire {
  if (triggerKind !== "recurring") {
    return { at: null, missed: 0 };
  }

  const daily = /^daily@(\d{1,2}):(\d{2})$/.exec(triggerValue);
  if (daily) {
    const hour = Number(daily[1]);
    const minute = Number(daily[2]);
    // Nothing to anchor on; firing once and stopping beats a tick that fails every minute.
    if (hour > 23 || minute > 59) return { at: null, missed: 0 };
    const at = nextDailyAfter(now.getTime(), hour, minute, timeZone);
    const firstAfterFired = nextDailyAfter(firedFor.getTime(), hour, minute, timeZone);
    const missed =
      localDayNumber(at.getTime(), timeZone) - localDayNumber(firstAfterFired.getTime(), timeZone);
    return { at, missed };
  }

  const intervalMs = Number.parseInt(triggerValue, 10);
  if (Number.isFinite(intervalMs) && intervalMs > 0) {
    const missed = Math.max(0, Math.floor((now.getTime() - firedFor.getTime()) / intervalMs));
    return { at: new Date(firedFor.getTime() + (missed + 1) * intervalMs), missed };
  }

  return { at: null, missed: 0 };
}

/**
 * Executes a single tick of the reminder engine: quiet hours, exam forcing and subscription
 * pruning, each in the student's own time zone. Overlapping ticks are safe: each reminder
 * is claimed before it is sent, and only one tick's claim can succeed.
 */
export async function processReminderTick(options: TickOptions): Promise<TickResult> {
  const { db, pushSender = sendPushNotification } = options;
  const now = options.now || new Date();

  const result: TickResult = {
    processedCount: 0,
    deliveredCount: 0,
    suppressedQuietHoursCount: 0,
    suppressedDeletedSubjectCount: 0,
    purgedSubscriptionsCount: 0,
    claimedElsewhereCount: 0,
    missedOccurrencesCount: 0,
  };

  // An overlapping tick (a big due set runs past the next cron minute) reads the same rows.
  // What stops a double send is the claim below, not this read.
  const dueReminders = await db
    .select({
      reminder: schema.reminders,
      timezone: schema.user.timezone,
      quietHoursEnabled: schema.user.quietHoursEnabled,
    })
    .from(schema.reminders)
    .innerJoin(schema.user, eq(schema.user.id, schema.reminders.userId))
    .where(
      and(
        lte(schema.reminders.nextFireAt, now),
        eq(schema.reminders.enabled, true),
        isNull(schema.reminders.deletedAt),
      ),
    );

  if (!dueReminders.length) {
    return result;
  }

  result.processedCount = dueReminders.length;

  for (const { reminder, timezone, quietHoursEnabled } of dueReminders) {
    // Check if the reminder's subject still exists and is not soft-deleted
    if (reminder.subjectType === "item") {
      const [subjectItem] = await db
        .select()
        .from(schema.items)
        .where(and(eq(schema.items.id, reminder.subjectId), isNull(schema.items.deletedAt)))
        .limit(1);

      if (!subjectItem) {
        // Subject deleted: disable reminder and do not fire
        await db
          .update(schema.reminders)
          .set({ enabled: false, updatedAt: now })
          .where(eq(schema.reminders.id, reminder.id));

        result.suppressedDeletedSubjectCount++;
        continue;
      }
    }

    // Quiet hours are the student's own night, in their own zone (0.5-4 §2). A held
    // reminder is not advanced, so it stays due and fires on the first tick after they end.
    const isQuiet = isWithinQuietHours(now, {
      enabled: quietHoursEnabled,
      ...QUIET_HOURS,
      timezone,
    });
    // PLAN 0-8 §4: Forced reminders (exams) IGNORE quiet hours!
    if (isQuiet && !reminder.forced) {
      result.suppressedQuietHoursCount++;
      continue;
    }

    const next = calculateNextFireAt(
      reminder.nextFireAt,
      reminder.triggerKind,
      reminder.triggerValue,
      now,
      timezone,
    );

    // Claim before send: advance the reminder only if it still holds the time this tick
    // read. One statement, because the production driver (neon-http) cannot hold a lock
    // across two; when two ticks race, Postgres re-checks the WHERE against the winner's
    // row and the loser updates nothing (0.5-4 §0). Compared at millisecond precision, the
    // precision a JS Date read back has: an exact match on a microsecond value would never
    // succeed, and the reminder would be re-read every tick and never sent.
    const claimed = await db
      .update(schema.reminders)
      .set({
        lastFiredAt: now,
        nextFireAt: next.at,
        enabled: next.at !== null,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.reminders.id, reminder.id),
          sql`date_trunc('milliseconds', ${schema.reminders.nextFireAt}) = ${reminder.nextFireAt.toISOString()}::timestamptz`,
          eq(schema.reminders.enabled, true),
          isNull(schema.reminders.deletedAt),
        ),
      )
      .returning({ id: schema.reminders.id });
    if (claimed.length === 0) {
      result.claimedElsewhereCount++;
      continue;
    }

    if (next.missed > 0) {
      result.missedOccurrencesCount += next.missed;
      console.warn(
        `[Tick] Reminder ${reminder.id} missed ${next.missed} occurrence(s) after ${reminder.nextFireAt.toISOString()} (no tick ran); sending once now, next at ${next.at?.toISOString()}`,
      );
    }

    // Fetch user's active push subscriptions
    const userSubscriptions = await db
      .select()
      .from(schema.pushSubscriptions)
      .where(
        and(
          eq(schema.pushSubscriptions.userId, reminder.userId),
          isNull(schema.pushSubscriptions.deletedAt),
        ),
      );

    const payload: PushPayload = {
      title: reminder.forced ? "⚠️ Mandatory Exam Reminder" : "College Ess Reminder",
      body: `Reminder for ${reminder.subjectType}: time to check in.`,
      data: {
        reminderId: reminder.id,
        subjectType: reminder.subjectType,
        subjectId: reminder.subjectId,
        url: "/dashboard",
      },
    };

    // Dispatch pushes to all user devices
    for (const sub of userSubscriptions) {
      const pushRes = await pushSender(
        {
          endpoint: sub.endpoint,
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
        payload,
      );

      if (pushRes.success) {
        result.deliveredCount++;
      } else if (pushRes.isGone) {
        // PLAN 0-8 §3: 410 response means subscription is dead; purge it immediately!
        await db
          .delete(schema.pushSubscriptions)
          .where(eq(schema.pushSubscriptions.endpoint, sub.endpoint));
        result.purgedSubscriptionsCount++;
      }
    }
  }

  return result;
}
