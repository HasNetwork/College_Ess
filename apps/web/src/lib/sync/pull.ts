import type { SyncPullResponse } from "@clg-ess/core";
import { type QueryClient, queryOptions, skipToken } from "@tanstack/react-query";
import { AppUnreachableError, readAppAnswer } from "./reach";

type Row = { id: string } & Record<string, unknown>;

/** Whose rows a cache holds. A new college is a new owner too: its shared calendar differs. */
export interface SyncOwner {
  userId: string;
  collegeId: string | null;
}

/** This device's copy of the rows the server lets its owner read (PLAN §5). */
export interface SyncCache {
  owner: SyncOwner;
  /** `serverTime` of the last pull applied, never this device's clock (0-5 §4). */
  watermark: string;
  /** table -> row id -> row, as the server last sent it. */
  tables: Record<string, Record<string, Row>>;
}

/**
 * One key for every account, so the cache can be read offline, when the session cannot be
 * fetched. Whose rows it holds is recorded inside it instead (`owner`).
 */
export const SYNC_QUERY_KEY = ["sync"] as const;

const sameOwner = (a: SyncOwner, b: SyncOwner) =>
  a.userId === b.userId && a.collegeId === b.collegeId;

/**
 * Merges one pull: the server's row replaces this device's (PLAN §5); a tombstone removes it.
 * A full pull replaces the device's copy outright: it can follow a hard delete that left no
 * tombstone, and a merge would keep that row forever.
 */
export function applyPull(
  cache: SyncCache | undefined,
  owner: SyncOwner,
  pull: SyncPullResponse,
): SyncCache {
  const tables = pull.full ? {} : { ...cache?.tables };
  for (const [name, rows] of Object.entries(pull.data)) {
    const table = { ...tables[name] };
    for (const row of rows as Row[]) table[row.id] = row;
    tables[name] = table;
  }
  for (const [name, tombstones] of Object.entries(pull.tombstones)) {
    const table = { ...tables[name] };
    for (const { id } of tombstones) delete table[id];
    tables[name] = table;
  }
  return { owner, watermark: pull.serverTime, tables };
}

/**
 * The pull, as a query. Each run asks the server for what changed since the cache's
 * watermark and merges it in. The persister writes the result to IndexedDB with the rows
 * and the watermark in one value, so after a reload they still agree.
 */
export function syncQueryOptions(owner: SyncOwner | null, fetcher: typeof fetch = fetch) {
  return queryOptions({
    queryKey: SYNC_QUERY_KEY,
    // No account known (signed out, the session still loading, or offline): nothing to
    // pull, and the cache stays readable as it is.
    queryFn: owner
      ? async ({ client, signal }): Promise<SyncCache> => {
          const held = client.getQueryData<SyncCache>(SYNC_QUERY_KEY);
          // Another account's rows (a shared device) or another college's: start again.
          const cache = held && sameOwner(held.owner, owner) ? held : undefined;
          const url = cache
            ? `/api/sync?since=${encodeURIComponent(cache.watermark)}`
            : "/api/sync";
          let res: Response;
          try {
            res = await fetcher(url, { signal });
          } catch (err) {
            if (signal.aborted) throw err;
            throw new AppUnreachableError(err instanceof Error ? err.message : String(err));
          }
          const answer = await readAppAnswer(res);
          if (answer === undefined) {
            throw new AppUnreachableError(`No answer from College Ess (${res.status})`);
          }
          if (!res.ok) throw new Error(`Sync pull failed with ${res.status}`);
          return applyPull(cache, owner, answer as SyncPullResponse);
        }
      : skipToken,
    // Every mount, refocus and reconnect pulls; a pull carries only what changed.
    staleTime: 0,
    // Never dropped from memory while the app runs: it is the offline copy (0.5-4).
    gcTime: Number.POSITIVE_INFINITY,
  });
}

/** Signed out: this device keeps no one's rows. */
export function dropSyncCache(client: QueryClient): void {
  client.removeQueries({ queryKey: SYNC_QUERY_KEY });
}
