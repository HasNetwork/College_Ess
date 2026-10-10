import { type Ctx, can } from "@clg-ess/core";
import { schema } from "@clg-ess/db";
import { type SQL, eq, isNull, or } from "drizzle-orm";

// The per-table sync policy, next to the route that enforces it (a route module may export
// only its handlers). Server-only: never import it from client code.

export type Row = Record<string, unknown>;

/**
 * What a caller may do with one syncable table (PLAN 0.5-2 §5). Declared per table, never
 * guessed from column names: the old route read ownership from `userId ?? ownerId`, and for
 * the tables with neither the guess came out "allow".
 *
 * A write stores only the columns listed here. Everything else in the payload is
 * server-owned and ignored: ids, owners, college, timestamps, and any column added later.
 */
export interface SyncTable {
  // biome-ignore lint/suspicious/noExplicitAny: one policy shape over several Drizzle tables
  table: any;
  /** Rows the caller may read, on top of scopedDb's college and soft-delete guard. */
  readable(ctx: Ctx): SQL | undefined;
  /** Inserting: the client's columns and the server's stamp. `null` refuses inserts here. */
  insert: { columns: readonly string[]; stamp(ctx: Ctx): Row | null } | null;
  /** Changing a readable row: the columns the caller may write, or `null` for none (403). */
  writable(ctx: Ctx, row: Row): readonly string[] | null;
  /** Server-owned values that accompany an update. */
  onUpdate?(ctx: Ctx, changes: Row): Row;
}

const ITEM = ["kind", "title", "startsAt", "endsAt", "rrule", "allDay", "status", "priority"];
const REMINDER = ["subjectType", "subjectId", "triggerKind", "triggerValue", "channel"];
const LINK = ["fromType", "fromId", "toType", "toId", "relation"];
const SUGGESTION = ["targetType", "targetId", "proposedDiff"];
const MODERATION = ["status", "reviewNote"];

/** Authority over one college's shared rows (R1). A row with no college is platform-wide. */
function managesCollege(ctx: Ctx, collegeId: unknown): boolean {
  return can(
    ctx,
    "manage:college",
    typeof collegeId === "string" ? { type: "college", id: collegeId } : { type: "platform" },
  );
}

// `doc` is not here: /api/compass is its only read path, and an edit must write a revision
// (PLAN §2.6), which sync cannot. `grant` never syncs: authority is not cached (0-5 §6).
export const SYNC_TABLES: Record<string, SyncTable> = {
  item: {
    table: schema.items,
    // Your items, plus your college's shared calendar (user_id NULL).
    readable: (ctx) => or(eq(schema.items.userId, ctx.userId), isNull(schema.items.userId)),
    insert: { columns: ITEM, stamp: (ctx) => ({ userId: ctx.userId, collegeId: ctx.collegeId }) },
    writable: (ctx, row) =>
      row.userId === ctx.userId || (row.userId === null && managesCollege(ctx, row.collegeId))
        ? ITEM
        : null,
  },
  wear_event: {
    table: schema.wearEvents,
    readable: (ctx) => eq(schema.wearEvents.userId, ctx.userId),
    insert: {
      columns: ["garmentId", "wornOn", "loggedAt"],
      stamp: (ctx) => ({ userId: ctx.userId }),
    },
    writable: () => null,
  },
  reminder: {
    table: schema.reminders,
    readable: (ctx) => eq(schema.reminders.userId, ctx.userId),
    // `forced` is left out: exam reminders are not opt-in (PLAN §2.3).
    insert: {
      columns: [...REMINDER, "enabled", "nextFireAt"],
      stamp: (ctx) => ({ userId: ctx.userId }),
    },
    writable: (ctx, row) =>
      row.userId === ctx.userId ? [...REMINDER, "enabled", "nextFireAt"] : null,
  },
  link: {
    table: schema.links,
    readable: (ctx) => eq(schema.links.userId, ctx.userId),
    insert: { columns: LINK, stamp: (ctx) => ({ userId: ctx.userId }) },
    writable: (ctx, row) => (row.userId === ctx.userId ? LINK : null),
  },
  asset: {
    table: schema.assets,
    readable: (ctx) => eq(schema.assets.ownerId, ctx.userId),
    // Only /api/assets/presign creates assets, because it derives the storage key (PLAN
    // §2.4). A row inserted here could point at another user's object.
    insert: null,
    // Every column is server-owned: you may delete your asset here, not edit it.
    writable: (ctx, row) => (row.ownerId === ctx.userId ? [] : null),
  },
  suggestion: {
    table: schema.suggestions,
    // Your own suggestions; the whole queue only for someone who moderates it.
    readable: (ctx) =>
      managesCollege(ctx, ctx.collegeId)
        ? undefined
        : eq(schema.suggestions.submittedBy, ctx.userId),
    insert: {
      columns: SUGGESTION,
      stamp: (ctx) =>
        ctx.collegeId
          ? { submittedBy: ctx.userId, collegeId: ctx.collegeId, status: "pending" }
          : null,
    },
    // A submitter may edit or withdraw it while pending: editing after review would change
    // what was approved. Moderating needs authority over its college.
    writable: (ctx, row) => {
      const columns = [
        ...(row.submittedBy === ctx.userId && row.status === "pending" ? SUGGESTION : []),
        ...(managesCollege(ctx, row.collegeId) ? MODERATION : []),
      ];
      return columns.length > 0 ? columns : null;
    },
    onUpdate: (ctx, changes) =>
      "status" in changes || "reviewNote" in changes ? { reviewedBy: ctx.userId } : {},
  },
};

// Own keys only: `"constructor" in SYNC_TABLES` is true, and used to reach Object itself.
export const syncTable = (name: string): SyncTable | undefined =>
  Object.hasOwn(SYNC_TABLES, name) ? SYNC_TABLES[name] : undefined;
