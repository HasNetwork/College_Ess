import type { DrainOutcome, DrainResult } from "./replay";

/** What the sync status widget shows (0.5-4 §4, §5). */
export interface SyncStatus {
  /** Whether College Ess answered the last request. `navigator.onLine` is only a hint. */
  reachable: boolean;
  /** The server wants this account signed in before it takes their queued changes. */
  needsSignIn: boolean;
  syncing: boolean;
}

export interface SyncRunnerOptions {
  /** Sends `ownerId`'s queued changes: `drainOutbox` in the app. */
  drain: (ownerId: string) => Promise<DrainResult>;
  /**
   * Pulls the account's rows and says whether the app answered: the sync pull in the app.
   * Runs after every drain, so changes that reached the server come back as the server has
   * them.
   */
  refresh: () => Promise<boolean>;
  /** Calls `run` after `delayMs`; returns a cancel. The app passes `setTimeout`. */
  schedule: (run: () => Promise<void>, delayMs: number) => () => void;
  onStatus: (status: SyncStatus) => void;
  /** The device's own guess at first, before any request has answered. */
  initiallyReachable: boolean;
}

/** Waits between tries: 2 s, doubling, at most a minute. */
export function retryDelay(failures: number): number {
  return Math.min(2_000 * 2 ** failures, 60_000);
}

/** Outcomes after which the queue still holds changes the app should try again. */
const RETRY: ReadonlySet<DrainOutcome> = new Set(["unreachable", "server_error"]);

/**
 * Keeps the signed-in account's queued changes moving and says whether the app can be
 * reached, from what requests actually do (0.5-4 §4, §5). A failed request means offline
 * and a retry with backoff, unattended; a successful one means online. The browser's
 * online event only makes it try sooner, because on a campus Wi-Fi login page the browser
 * is "online" while every request fails.
 */
export function createSyncRunner(options: SyncRunnerOptions) {
  let owner: string | null = null;
  let failures = 0;
  let cancelRetry: (() => void) | null = null;
  let running: Promise<void> | null = null;
  let again = false;
  let status: SyncStatus = {
    reachable: options.initiallyReachable,
    needsSignIn: false,
    syncing: false,
  };

  const update = (patch: Partial<SyncStatus>) => {
    status = { ...status, ...patch };
    options.onStatus(status);
  };

  const retryLater = () => {
    cancelRetry?.();
    cancelRetry = options.schedule(() => {
      cancelRetry = null;
      return sync();
    }, retryDelay(failures));
    failures++;
  };

  async function once(): Promise<void> {
    const ownerId = owner;
    if (!ownerId) return;
    const drained = await options.drain(ownerId);
    // The account changed while that ran: its outcome describes someone else's queue.
    if (owner !== ownerId) return;
    const reachable = drained.outcome === "unreachable" ? false : await options.refresh();
    update({ reachable, needsSignIn: drained.outcome === "signed_out" });
    if (!reachable || RETRY.has(drained.outcome)) {
      retryLater();
    } else {
      failures = 0;
    }
  }

  /** Sends now. A call while one runs makes it go round once more rather than overlap. */
  async function sync(): Promise<void> {
    if (running) {
      again = true;
      return running;
    }
    cancelRetry?.();
    cancelRetry = null;
    update({ syncing: true });
    running = (async () => {
      try {
        do {
          again = false;
          await once();
        } while (again);
      } finally {
        running = null;
        update({ syncing: false });
      }
    })();
    return running;
  }

  // Each call that starts a sync returns it, so a caller can wait for that run.
  const done = Promise.resolve();

  return {
    sync,
    /** The signed-in account, or null. Another account's changes are never sent. */
    setOwner(ownerId: string | null): Promise<void> {
      if (ownerId === owner) return done;
      owner = ownerId;
      failures = 0;
      cancelRetry?.();
      cancelRetry = null;
      update({ needsSignIn: false });
      return ownerId ? sync() : done;
    },
    /** The browser's online and offline events. */
    hint(online: boolean): Promise<void> {
      if (!online) {
        update({ reachable: false });
        return done;
      }
      // Signed out there is nothing to ask the app, so the browser's word is all there is.
      if (!owner) {
        update({ reachable: true });
        return done;
      }
      failures = 0;
      return sync();
    },
    /** A request made elsewhere (the pull on refocus) answered, or found no app. */
    observe(reachable: boolean): Promise<void> {
      if (reachable === status.reachable) return done;
      update({ reachable });
      if (reachable) {
        // Back in reach: whatever waited on the backoff can go now.
        failures = 0;
        if (owner) return sync();
      } else if (owner && !cancelRetry && !running) {
        retryLater();
      }
      return done;
    },
    stop() {
      cancelRetry?.();
      cancelRetry = null;
      owner = null;
    },
  };
}

export type SyncRunner = ReturnType<typeof createSyncRunner>;
