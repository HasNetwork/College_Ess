import { DELETED_ASSET_GRACE_MS } from "@/lib/assets/validation";
import { getCtx } from "@/lib/ctx";
import {
  type Ctx,
  type OutboxEntry,
  OutboxEntrySchema,
  type SyncPullResponse,
  type SyncPushResult,
  isAppendOnlyTable,
  sortOutboxEntries,
} from "@clg-ess/core";
import { createDbClient, scopedDb } from "@clg-ess/db";
import { and, eq, gt, is, isNotNull } from "drizzle-orm";
import { PgTimestamp } from "drizzle-orm/pg-core";
import { type NextRequest, NextResponse } from "next/server";
import { type Row, SYNC_TABLES, type SyncTable, syncTable } from "./policy";

const db = createDbClient();

/** A change the server can never apply as sent: retrying it cannot help (a 400). */
class EntryError extends Error {}

/** The payload's values for `columns` only. JSON carries timestamps as strings. */
// biome-ignore lint/suspicious/noExplicitAny: one policy shape over several Drizzle tables
function pick(table: any, payload: Row, columns: readonly string[]): Row {
  const values: Row = {};
  for (const column of columns) {
    if (!Object.hasOwn(payload, column)) continue;
    const value = payload[column];
    if (is(table[column], PgTimestamp) && value != null) {
      const date = new Date(value as string);
      if (Number.isNaN(date.getTime())) throw new EntryError(`${column} is not a date`);
      values[column] = date;
    } else {
      values[column] = value;
    }
  }
  return values;
}

/**
 * Whether a failed write was the entry's own fault, which no retry can fix: bad data
 * (SQLSTATE class 22) or a broken constraint (23). Anything else, a lost connection
 * included, is the server's, and the client retries it (0.5-4 §4).
 */
function causedByEntry(err: unknown): boolean {
  if (err instanceof EntryError) return true;
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^2[23]/.test(code);
}

type Outcome = "applied" | { error: string; code: number };

const forbidden = (error: string): Outcome => ({ error: `Forbidden: ${error}`, code: 403 });

async function insertRow(ctx: Ctx, policy: SyncTable, entry: OutboxEntry): Promise<Outcome> {
  if (!policy.insert) return forbidden(`${entry.table} rows are not created through sync`);
  const stamp = policy.insert.stamp(ctx);
  if (!stamp) return forbidden(`you cannot create ${entry.table} rows`);
  // Server time, never the client's: a client clock must not decide LWW (PLAN §5).
  const now = new Date();
  await db
    .insert(policy.table)
    .values({
      ...pick(policy.table, entry.payload, policy.insert.columns),
      ...stamp,
      id: entry.rowId,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();
  return "applied";
}

async function applyEntry(ctx: Ctx, entry: OutboxEntry): Promise<Outcome> {
  if (entry.table === "grant") return forbidden("grants are server-managed");
  if (entry.table === "doc") return forbidden("the guide is edited with revision history");
  const policy = syncTable(entry.table);
  if (!policy) {
    return { error: `Invalid table: ${entry.table} is not a syncable table`, code: 400 };
  }

  // Append-only: every event row survives (R2). A replay of the same id changes nothing.
  if (isAppendOnlyTable(entry.table)) {
    if (entry.op !== "insert") {
      return {
        error: `Table ${entry.table} is append-only; update and delete operations are not permitted`,
        code: 400,
      };
    }
    return insertRow(ctx, policy, entry);
  }

  const { table } = policy;
  const [row] = await scopedDb(ctx, db)
    .select()
    .from(table)
    .where(and(eq(table.id, entry.rowId), policy.readable(ctx)))
    .limit(1);

  if (!row) {
    // Never yours to see, or already gone: nothing to change either way.
    return entry.op === "insert" ? insertRow(ctx, policy, entry) : "applied";
  }

  const columns = policy.writable(ctx, row);
  if (!columns) return forbidden(`you cannot change this ${entry.table} row`);

  // Last write wins, in the order the server receives writes (PLAN §5).
  const now = new Date();
  if (entry.op === "delete") {
    await db.update(table).set({ deletedAt: now, updatedAt: now }).where(eq(table.id, row.id));
    return "applied";
  }

  const changes = pick(table, entry.payload, columns);
  if (Object.keys(changes).length === 0) return "applied";
  await db
    .update(table)
    .set({ ...changes, ...policy.onUpdate?.(ctx, changes), updatedAt: now })
    .where(eq(table.id, row.id));
  return "applied";
}

/**
 * How far before `since` a pull reaches back. A write takes its timestamp, then commits; a
 * pull on another server instance can read in between and hand out a `serverTime` later
 * than that stamp, so the write would never be pulled. The client merges by id, so a row
 * sent twice changes nothing.
 */
const PULL_OVERLAP_MS = 60_000;

/**
 * GET /api/sync — pull server changes since `since`, with tombstones for soft-deleted rows.
 * Every read goes through scopedDb plus the table's own read rule.
 */
export async function GET(request: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sinceParam = searchParams.get("since");
  const parsedSince = sinceParam ? new Date(sinceParam) : null;
  const tablesParam = searchParams.get("tables");
  const requested = tablesParam
    ? tablesParam.split(",").map((t) => t.trim())
    : Object.keys(SYNC_TABLES);

  const now = new Date();
  // A watermark older than the reaper's grace period may have missed a hard delete, which
  // leaves no tombstone: that device gets everything, and replaces its copy.
  const since =
    parsedSince &&
    !Number.isNaN(parsedSince.getTime()) &&
    now.getTime() - parsedSince.getTime() < DELETED_ASSET_GRACE_MS
      ? parsedSince
      : null;

  const response: SyncPullResponse = {
    serverTime: now.toISOString(),
    data: {},
    tombstones: {},
    full: since === null,
  };

  for (const name of requested) {
    const policy = syncTable(name);
    if (!policy) continue;
    const { table, readable } = policy;
    const changed = since
      ? gt(table.updatedAt, new Date(since.getTime() - PULL_OVERLAP_MS))
      : undefined;

    response.data[name] = await scopedDb(ctx, db)
      .select()
      .from(table)
      .where(and(readable(ctx), changed));

    const deleted = await scopedDb(ctx, db, { includeDeleted: true })
      .select({ id: table.id, deletedAt: table.deletedAt })
      .from(table)
      .where(and(readable(ctx), changed, isNotNull(table.deletedAt)));
    response.tombstones[name] = deleted.map((r: { id: string; deletedAt: Date }) => ({
      id: r.id,
      deletedAt: r.deletedAt.toISOString(),
    }));
  }

  return NextResponse.json(response);
}

/**
 * POST /api/sync — replay a client outbox, in order. Each entry is applied or rejected on
 * its own: 403 for a row you can see but may not change, 400 for a malformed entry, 409 for
 * an entry another account queued. A server fault (500) stops the replay there: the entries
 * after it are not attempted, so a later change never lands before an earlier one.
 */
export async function POST(request: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let entries: unknown;
  try {
    entries = ((await request.json()) as { entries?: unknown } | null)?.entries;
  } catch {
    return NextResponse.json({ error: "Malformed JSON payload" }, { status: 400 });
  }
  if (!Array.isArray(entries)) {
    return NextResponse.json({ error: "Invalid request: entries array required" }, { status: 400 });
  }

  const result: SyncPushResult = { applied: [], rejected: [] };
  const valid: OutboxEntry[] = [];
  for (const raw of entries) {
    const parsed = OutboxEntrySchema.safeParse(raw);
    if (parsed.success) valid.push(parsed.data);
    else {
      const id = (raw as { id?: unknown } | null)?.id;
      result.rejected.push({ id: String(id ?? ""), error: "Invalid outbox entry", code: 400 });
    }
  }

  for (const entry of sortOutboxEntries(valid)) {
    let outcome: Outcome;
    if (entry.ownerId !== ctx.userId) {
      // Another student's change, replayed under this session (a shared device): never
      // applied as this account's. The client keeps it for its owner (0.5-4 §6).
      outcome = { error: "Conflict: this change was queued by another account", code: 409 };
    } else {
      try {
        outcome = await applyEntry(ctx, entry);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Database error processing mutation";
        outcome = { error: message, code: causedByEntry(err) ? 400 : 500 };
      }
    }
    if (outcome === "applied") result.applied.push(entry.id);
    else result.rejected.push({ id: entry.id, ...outcome });
    if (outcome !== "applied" && outcome.code >= 500) break;
  }

  return NextResponse.json(result);
}
