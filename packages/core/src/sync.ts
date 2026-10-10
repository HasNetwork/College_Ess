import { z } from "zod";

/**
 * OutboxEntry represents a mutation queued locally on the client while offline
 * or waiting to be synchronized with the server.
 */
export interface OutboxEntry {
  id: string; // UUID v7
  createdAt: number; // ms timestamp for ordering
  /** The account that made the change. It is only ever sent while that account is signed in. */
  ownerId: string;
  table: string;
  op: "insert" | "update" | "delete";
  rowId: string; // UUID v7 of the entity
  payload: Record<string, unknown>;
  /** Failed sends the server answered with a fault of its own; capped (0.5-4 §4). */
  attempts: number;
  lastError?: string;
  status: "pending" | "dead_letter";
}

export const OutboxEntrySchema = z.object({
  id: z.string().min(1),
  createdAt: z.number(),
  ownerId: z.string().uuid(),
  table: z.string().min(1),
  op: z.enum(["insert", "update", "delete"]),
  rowId: z.string().min(1),
  payload: z.record(z.unknown()),
  attempts: z.number().int().nonnegative(),
  lastError: z.string().optional(),
  status: z.enum(["pending", "dead_letter"]),
});

export interface SyncPullRequest {
  since?: string; // ISO 8601 string
  tables?: string[];
}

export interface SyncTombstone {
  id: string;
  deletedAt: string; // ISO 8601 string
}

export interface SyncPullResponse {
  serverTime: string; // ISO 8601 string
  data: Record<string, unknown[]>; // table -> rows
  tombstones: Record<string, SyncTombstone[]>; // table -> tombstones
  /**
   * Every readable row, not just changes: the device's watermark was older than the server
   * keeps tombstones for, so rows deleted since may have left none. The device replaces
   * its copy instead of merging (0.5-4).
   */
  full: boolean;
}

export interface SyncPushRequest {
  entries: OutboxEntry[];
}

/**
 * The server's answer to a replayed outbox. An entry in neither list was not attempted: the
 * server stops at the first entry that fails for a reason of its own (a 5xx `code`), so a
 * later change never lands before an earlier one. The client sends those again, in order.
 */
export interface SyncPushResult {
  applied: string[]; // outbox entry IDs applied
  /** 4xx: refused for good. 409: queued by another account. 5xx: a server fault; retry. */
  rejected: Array<{ id: string; error: string; code: number }>;
}

/**
 * Tables that have append-only semantics (e.g., wear logs, streaks).
 * Writes to these tables are NEVER overwritten by LWW; every event row survives.
 */
export const APPEND_ONLY_TABLES: readonly string[] = ["wear_event"];

/**
 * Check if a table is treated as append-only.
 */
export function isAppendOnlyTable(table: string): boolean {
  return APPEND_ONLY_TABLES.includes(table);
}

/**
 * Sort outbox entries by createdAt ascending (FIFO).
 */
export function sortOutboxEntries(entries: OutboxEntry[]): OutboxEntry[] {
  return [...entries].sort((a, b) => a.createdAt - b.createdAt);
}
