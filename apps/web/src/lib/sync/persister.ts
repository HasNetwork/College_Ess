import type {
  PersistQueryClientOptions,
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client";
import { getDb } from "./db";
import { SYNC_QUERY_KEY } from "./pull";

/**
 * What is written to disk, and for how long (0.5-4 §6).
 *
 * - **Only the sync pull.** It records whose rows it holds and is dropped at sign-out. Any
 *   other query would sit in IndexedDB for whoever uses the device next, and the first one
 *   to fetch grants would put authority on disk (0-5 §6).
 * - **No expiry.** TanStack's default drops a cache a day old, so a device offline for
 *   longer showed nothing. Staleness is the pull's job: it asks for what changed, and a
 *   device away past the tombstone horizon gets a full pull.
 */
export const PERSIST_OPTIONS = {
  maxAge: Number.POSITIVE_INFINITY,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.queryKey[0] === SYNC_QUERY_KEY[0] && query.state.status === "success",
  },
} satisfies Omit<PersistQueryClientOptions, "persister" | "queryClient">;

export interface DexiePersisterOptions {
  key?: string;
  throttleTime?: number;
}

/**
 * Creates a TanStack Query persister backed by Dexie IndexedDB.
 * Throttles writes to avoid thrashing IndexedDB during frequent query updates.
 */
export function createDexiePersister(options?: DexiePersisterOptions): Persister {
  const cacheKey = options?.key ?? "REACT_QUERY_OFFLINE_CACHE";
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastClient: PersistedClient | null = null;

  const save = async (client: PersistedClient) => {
    try {
      const db = getDb();
      await db.keyValue.put({
        key: cacheKey,
        value: client,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error("[SyncPersister] Failed to persist client to Dexie:", err);
    }
  };

  return {
    persistClient: async (persistClient: PersistedClient) => {
      lastClient = persistClient;
      if (timeout) return;
      timeout = setTimeout(async () => {
        timeout = null;
        if (lastClient) {
          await save(lastClient);
        }
      }, options?.throttleTime ?? 1000);
    },
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      try {
        const db = getDb();
        const record = await db.keyValue.get(cacheKey);
        return record?.value as PersistedClient | undefined;
      } catch (err) {
        console.error("[SyncPersister] Failed to restore client from Dexie:", err);
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        const db = getDb();
        await db.keyValue.delete(cacheKey);
      } catch (err) {
        console.error("[SyncPersister] Failed to remove client from Dexie:", err);
      }
    },
  };
}
