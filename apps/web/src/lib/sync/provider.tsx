"use client";

import { authClient } from "@/lib/auth-client";
import type { OutboxEntry } from "@clg-ess/core";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  clearDeadLetter,
  discardUnsent,
  getDeadLetters,
  getPendingCount,
  getUnsentCount,
  retryDeadLetter,
} from "./outbox";
import { PERSIST_OPTIONS, createDexiePersister } from "./persister";
import { type SyncOwner, dropSyncCache, syncQueryOptions } from "./pull";
import { AppUnreachableError } from "./reach";
import { drainOutbox } from "./replay";
import { type SyncRunner, type SyncStatus, createSyncRunner } from "./runner";

interface SyncContextValue {
  /** College Ess answered the last request (0.5-4 §5): not the browser's guess. */
  isOnline: boolean;
  /** Queued changes wait for this account to sign in again. */
  needsSignIn: boolean;
  pendingCount: number;
  deadLetterCount: number;
  isSyncing: boolean;
  triggerSync: () => Promise<void>;
  /** The signed-in account's failed changes. */
  listFailed: () => Promise<OutboxEntry[]>;
  retryFailed: (id: string) => Promise<void>;
  dismissFailed: (id: string) => Promise<void>;
  refreshCounts: () => Promise<void>;
  /** The signed-in account's changes not yet on the server, pending or failed. */
  countUnsent: () => Promise<number>;
  /** Deletes them: signing out anyway, after the warning (0.5-4 §0, decision 3). */
  discardUnsent: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
}

/** The signed-in account, as the sync layer needs it; null when signed out or unknown. */
function useSyncOwner(): { owner: SyncOwner | null; signedOut: boolean } {
  const session = authClient.useSession();
  const userId = session.data?.user.id;
  const collegeId = session.data?.user.collegeId ?? null;
  const owner = useMemo(() => (userId ? { userId, collegeId } : null), [userId, collegeId]);
  // Signed out for certain: not still loading, and not offline (which reports an error and
  // must keep the cache readable). A shared device then keeps no one's rows.
  const signedOut = !session.isPending && !session.error && !session.data;
  return { owner, signedOut };
}

/**
 * Keeps this device's copy of the signed-in account's rows current (0.5-3 §2) and tells the
 * runner whose changes to send. The pull runs on load, on refocus, on reconnect, and after
 * every drain (the runner's `refresh`).
 */
function SyncEngine({
  runner,
  ownerRef,
}: {
  runner: SyncRunner;
  ownerRef: React.MutableRefObject<SyncOwner | null>;
}) {
  const queryClient = useQueryClient();
  const { owner, signedOut } = useSyncOwner();
  ownerRef.current = owner;

  const pull = useQuery(syncQueryOptions(owner));

  useEffect(() => {
    void runner.setOwner(owner?.userId ?? null);
  }, [owner, runner]);

  // A pull on refocus or reconnect is evidence too, once a fetch has finished: an answer
  // means online. Data restored from disk is not an answer from anyone.
  const wasFetching = useRef(false);
  useEffect(() => {
    if (pull.fetchStatus === "fetching") {
      wasFetching.current = true;
      return;
    }
    if (!wasFetching.current || pull.fetchStatus === "paused") return;
    wasFetching.current = false;
    void runner.observe(!(pull.error instanceof AppUnreachableError));
  }, [pull.fetchStatus, pull.error, runner]);

  useEffect(() => {
    if (signedOut) dropSyncCache(queryClient);
  }, [signedOut, queryClient]);

  return null;
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: 1000 * 60 * 60 * 24, // 24 hours
            staleTime: 1000 * 60 * 5, // 5 minutes
            networkMode: "offlineFirst",
          },
          mutations: {
            networkMode: "offlineFirst",
          },
        },
      }),
  );

  const persister = useMemo(
    () => (typeof window !== "undefined" ? createDexiePersister() : null),
    [],
  );

  const ownerRef = useRef<SyncOwner | null>(null);
  const [status, setStatus] = useState<SyncStatus>({
    reachable: typeof navigator !== "undefined" ? navigator.onLine : true,
    needsSignIn: false,
    syncing: false,
  });
  const [runner] = useState(() =>
    createSyncRunner({
      drain: (ownerId) => drainOutbox(ownerId),
      refresh: async () => {
        const owner = ownerRef.current;
        if (!owner) return true;
        try {
          await queryClient.fetchQuery({ ...syncQueryOptions(owner), retry: false });
          return true;
        } catch (err) {
          return !(err instanceof AppUnreachableError);
        }
      },
      schedule: (run, delayMs) => {
        const timer = setTimeout(() => void run(), delayMs);
        return () => clearTimeout(timer);
      },
      onStatus: setStatus,
      initiallyReachable: typeof navigator !== "undefined" ? navigator.onLine : true,
    }),
  );

  const [pendingCount, setPendingCount] = useState(0);
  const [deadLetterCount, setDeadLetterCount] = useState(0);

  const refreshCounts = useCallback(async () => {
    if (typeof window === "undefined") return;
    const ownerId = ownerRef.current?.userId;
    if (!ownerId) {
      setPendingCount(0);
      setDeadLetterCount(0);
      return;
    }
    try {
      setPendingCount(await getPendingCount(ownerId));
      setDeadLetterCount((await getDeadLetters(ownerId)).length);
    } catch {
      // Ignore errors if DB is not yet available
    }
  }, []);

  const triggerSync = useCallback(async () => {
    await runner.sync();
    await refreshCounts();
  }, [runner, refreshCounts]);

  const listFailed = useCallback(async () => {
    const ownerId = ownerRef.current?.userId;
    return ownerId ? await getDeadLetters(ownerId) : [];
  }, []);

  const retryFailed = useCallback(
    async (id: string) => {
      await retryDeadLetter(id);
      await triggerSync();
    },
    [triggerSync],
  );

  const dismissFailed = useCallback(
    async (id: string) => {
      await clearDeadLetter(id);
      await refreshCounts();
    },
    [refreshCounts],
  );

  const countUnsent = useCallback(async () => {
    const ownerId = ownerRef.current?.userId;
    return ownerId ? await getUnsentCount(ownerId) : 0;
  }, []);

  const discardOwnUnsent = useCallback(async () => {
    const ownerId = ownerRef.current?.userId;
    if (ownerId) await discardUnsent(ownerId);
    await refreshCounts();
  }, [refreshCounts]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => void runner.hint(true);
    const handleOffline = () => void runner.hint(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    // An offline event between the first render and this effect was missed, and nothing
    // would say so until the next request (found in 0.5-5, a heavier /guide made the gap
    // wider). Take the browser's word as it stands now.
    if (!navigator.onLine) void runner.hint(false);

    void refreshCounts();
    const interval = setInterval(() => {
      void refreshCounts();
    }, 2000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
      runner.stop();
    };
  }, [refreshCounts, runner]);

  const value = useMemo(
    () => ({
      isOnline: status.reachable,
      needsSignIn: status.needsSignIn,
      pendingCount,
      deadLetterCount,
      isSyncing: status.syncing,
      triggerSync,
      listFailed,
      retryFailed,
      dismissFailed,
      refreshCounts,
      countUnsent,
      discardUnsent: discardOwnUnsent,
    }),
    [
      status,
      pendingCount,
      deadLetterCount,
      triggerSync,
      listFailed,
      retryFailed,
      dismissFailed,
      refreshCounts,
      countUnsent,
      discardOwnUnsent,
    ],
  );

  const engine = <SyncEngine runner={runner} ownerRef={ownerRef} />;

  if (!persister) {
    return (
      <QueryClientProvider client={queryClient}>
        {engine}
        <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
      </QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, ...PERSIST_OPTIONS }}
    >
      {engine}
      <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
    </PersistQueryClientProvider>
  );
}
