import type { SyncPushRequest, SyncPushResult } from "@clg-ess/core";
import { getPendingWrites, markDeadLetter, recordFailure, removeOutboxEntry } from "./outbox";
import { readAppAnswer } from "./reach";

/** What a drain ended with, and so what the runner does next (0.5-4 §4). */
export type DrainOutcome =
  /** Nothing to send. */
  | "idle"
  /** Every entry was answered: applied, or refused for good. */
  | "sent"
  /** College Ess was not reached. Nothing counts against the entries. */
  | "unreachable"
  /** The app answered with a fault of its own. The first unsent entry used an attempt. */
  | "server_error"
  /** The server wants this account signed in (401), or another account is (409). Kept. */
  | "signed_out";

export interface DrainResult {
  outcome: DrainOutcome;
  appliedCount: number;
  rejectedCount: number;
  error?: string;
}

/** Entries per request: a long offline spell must not become one oversized body. */
export const DRAIN_BATCH_SIZE = 50;

/**
 * Replays `ownerId`'s pending writes to the server, oldest first, in batches. Only that
 * account's writes are sent, so a change queued by one student on a shared device is never
 * applied as another's.
 *
 * - Applied: removed from the outbox.
 * - Refused for good (a 4xx for that entry): dead-lettered, visible and retryable. The rest
 *   of the batch still goes through.
 * - A server fault (5xx for an entry, or for the whole batch): the first unsent entry uses
 *   an attempt (capped, see MAX_ATTEMPTS), and the drain stops, because the server stopped
 *   there too and a later change must not land before an earlier one.
 * - 401: nothing is lost or counted; the account has to sign in again.
 * - No answer from the app: nothing is counted; the device is offline, whatever
 *   `navigator.onLine` says.
 */
export async function drainOutbox(
  ownerId: string,
  fetcher: typeof fetch = fetch,
  endpoint = "/api/sync",
): Promise<DrainResult> {
  const result: DrainResult = { outcome: "idle", appliedCount: 0, rejectedCount: 0 };

  for (;;) {
    const batch = (await getPendingWrites(ownerId)).slice(0, DRAIN_BATCH_SIZE);
    const first = batch[0];
    if (!first) return result;

    const payload: SyncPushRequest = { entries: batch };
    let response: Response;
    try {
      response = await fetcher(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err: unknown) {
      return {
        ...result,
        outcome: "unreachable",
        error: err instanceof Error ? err.message : String(err),
      };
    }

    const answer = await readAppAnswer(response);
    if (answer === undefined) {
      return {
        ...result,
        outcome: "unreachable",
        error: `No answer from College Ess (${response.status})`,
      };
    }
    if (response.status === 401) {
      return { ...result, outcome: "signed_out", error: "Sign in again to send your changes" };
    }
    if (!response.ok) {
      const error = `Server error ${response.status}`;
      await recordFailure(first.id, error);
      return { ...result, outcome: "server_error", error };
    }

    const { applied, rejected } = answer as SyncPushResult;
    for (const id of applied) {
      await removeOutboxEntry(id);
    }
    result.appliedCount += applied.length;

    let stop: DrainOutcome | null = null;
    for (const refusal of rejected) {
      if (refusal.code >= 500) {
        await recordFailure(refusal.id, `Server error ${refusal.code}: ${refusal.error}`);
        stop = "server_error";
      } else if (refusal.code === 409) {
        // Queued by an account that is no longer the one signed in: keep it for them.
        stop ??= "signed_out";
      } else {
        await markDeadLetter(refusal.id, `Rejected with ${refusal.code}: ${refusal.error}`);
        result.rejectedCount++;
      }
    }
    if (stop) return { ...result, outcome: stop };
    // An answer that settled nothing in this batch would send the same batch forever.
    const sent = new Set(batch.map((entry) => entry.id));
    if (![...applied, ...rejected.map((refusal) => refusal.id)].some((id) => sent.has(id))) {
      const error = "The server answered without settling any change";
      await recordFailure(first.id, error);
      return { ...result, outcome: "server_error", error };
    }
    result.outcome = "sent";
  }
}
