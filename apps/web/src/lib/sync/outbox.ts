import type { OutboxEntry } from "@clg-ess/core";
import { uuidv7 } from "uuidv7";
import { getDb } from "./db";

/**
 * How many times an entry may meet a server fault before it is given up on and shown to
 * the student as failed, with a retry (0.5-4 §4). Being offline or signed out never counts.
 */
export const MAX_ATTEMPTS = 10;

/**
 * Queue a mutation into the local outbox, as `ownerId`'s change. It is only ever sent
 * while that account is signed in.
 * Client generates UUID v7 IDs so records can be referenced immediately while offline.
 */
export async function queueWrite<T extends Record<string, unknown>>(
  ownerId: string,
  table: string,
  op: "insert" | "update" | "delete",
  payload: T,
  rowId?: string,
): Promise<OutboxEntry> {
  const finalRowId = rowId || ((payload as Record<string, unknown>).id as string) || uuidv7();
  const finalPayload: Record<string, unknown> = { ...payload };

  if (op === "insert" && !finalPayload.id) {
    finalPayload.id = finalRowId;
  }

  const entry: OutboxEntry = {
    id: uuidv7(),
    createdAt: Date.now(),
    ownerId,
    table,
    op,
    rowId: finalRowId,
    payload: finalPayload,
    attempts: 0,
    status: "pending",
  };

  const db = getDb();
  await db.outbox.add(entry);
  return entry;
}

const ownedBy = (ownerId: string) => getDb().outbox.where("ownerId").equals(ownerId);

/**
 * `ownerId`'s pending writes, oldest first (FIFO). Ties keep their queue order: ids are
 * UUID v7, so the index returns them in creation order and the sort is stable.
 */
export async function getPendingWrites(ownerId: string): Promise<OutboxEntry[]> {
  const entries = await ownedBy(ownerId)
    .filter((entry) => entry.status === "pending")
    .toArray();
  return entries.sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Count of `ownerId`'s pending outbox writes.
 */
export async function getPendingCount(ownerId: string): Promise<number> {
  return await ownedBy(ownerId)
    .filter((entry) => entry.status === "pending")
    .count();
}

/**
 * `ownerId`'s writes that failed for good, or were given up on after MAX_ATTEMPTS.
 */
export async function getDeadLetters(ownerId: string): Promise<OutboxEntry[]> {
  return await ownedBy(ownerId)
    .filter((entry) => entry.status === "dead_letter")
    .toArray();
}

/**
 * Mark an entry as dead-lettered (e.g. 4xx rejection).
 * It will not be retried automatically.
 */
export async function markDeadLetter(id: string, error: string): Promise<void> {
  const db = getDb();
  await db.outbox.update(id, {
    status: "dead_letter",
    lastError: error,
  });
}

/**
 * Sends a failed write again: back in the queue with a fresh allowance of attempts, in its
 * original place (queue order is by `createdAt`).
 */
export async function retryDeadLetter(id: string): Promise<void> {
  const db = getDb();
  await db.outbox.update(id, { status: "pending", attempts: 0, lastError: undefined });
}

/**
 * Dismiss or clear a dead-letter entry.
 */
export async function clearDeadLetter(id: string): Promise<void> {
  const db = getDb();
  await db.outbox.delete(id);
}

/**
 * Remove an entry after successful sync.
 */
export async function removeOutboxEntry(id: string): Promise<void> {
  const db = getDb();
  await db.outbox.delete(id);
}

/**
 * Records a server fault against an entry. At MAX_ATTEMPTS it stops being retried and
 * becomes visible as failed, with the last error.
 */
export async function recordFailure(id: string, error: string): Promise<void> {
  const db = getDb();
  const entry = await db.outbox.get(id);
  if (!entry) return;
  const attempts = entry.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await db.outbox.update(id, {
      attempts,
      status: "dead_letter",
      lastError: `Gave up after ${attempts} tries. Last error: ${error}`,
    });
  } else {
    await db.outbox.update(id, { attempts, lastError: error });
  }
}

/** Everything of `ownerId`'s not yet on the server: pending and failed. */
export async function getUnsentCount(ownerId: string): Promise<number> {
  return await ownedBy(ownerId).count();
}

/**
 * Deletes every change `ownerId` has not sent, pending or failed. Signing out anyway after
 * the warning calls this (0.5-4 §0, decision 3): nothing of theirs stays on the device.
 */
export async function discardUnsent(ownerId: string): Promise<void> {
  await ownedBy(ownerId).delete();
}
