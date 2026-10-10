"use client";

import { Button } from "@/components/ui/button";
import { GlassSurface } from "@/components/ui/glass-surface";
import type { OutboxEntry } from "@clg-ess/core";
import { ChevronDown, CloudOff, CloudUpload, KeyRound, Loader2, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useId, useState } from "react";
import { useSync } from "./provider";

/** "1 change", "3 changes". */
const changes = (count: number) => `${count} ${count === 1 ? "change" : "changes"}`;

const OPERATION = { insert: "New", update: "Edit to", delete: "Deleted" } as const;

// A background pull that finishes sooner than this isn't worth a toast.
const SYNCING_NOTICE_DELAY_MS = 400;

function StatusRow({
  icon,
  action,
  children,
}: {
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-2">
      <span aria-hidden="true" className="shrink-0">
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/**
 * What the sync layer is doing, when there's something to say (0.5-4 §4, §5): College Ess
 * can't be reached, changes are sending or waiting, the account must sign in again, or
 * changes failed. Nothing while online and idle with nothing waiting.
 */
export function SyncStatusWidget() {
  const [mounted, setMounted] = useState(false);
  const {
    isOnline,
    needsSignIn,
    pendingCount,
    deadLetterCount,
    isSyncing,
    triggerSync,
    listFailed,
    retryFailed,
    dismissFailed,
  } = useSync();
  const [deadLetters, setDeadLetters] = useState<OutboxEntry[]>([]);
  const [showDeadLetters, setShowDeadLetters] = useState(false);
  const [slowSync, setSlowSync] = useState(false);
  const listId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (deadLetterCount > 0) {
      void listFailed().then(setDeadLetters);
    } else {
      setDeadLetters([]);
      setShowDeadLetters(false);
    }
  }, [deadLetterCount, listFailed]);

  useEffect(() => {
    if (!isSyncing) {
      setSlowSync(false);
      return;
    }
    const timer = setTimeout(() => setSlowSync(true), SYNCING_NOTICE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isSyncing]);

  if (!mounted) {
    return null;
  }

  const handleDismiss = async (id: string) => {
    await dismissFailed(id);
    setDeadLetters(await listFailed());
  };

  const handleRetry = async (id: string) => {
    await retryFailed(id);
    setDeadLetters(await listFailed());
  };

  const waiting = pendingCount > 0 && (
    <p className="text-xs text-[var(--text-secondary)]">{changes(pendingCount)} waiting to send</p>
  );

  let status: ReactNode = null;
  if (!isOnline) {
    status = (
      <StatusRow icon={<CloudOff className="h-4 w-4 text-[var(--text-secondary)]" />}>
        <p data-testid="sync-offline-badge" className="font-medium text-[var(--text-primary)]">
          Can't reach College Ess
        </p>
        {waiting}
      </StatusRow>
    );
  } else if (needsSignIn) {
    status = (
      <StatusRow
        icon={<KeyRound className="h-4 w-4 text-[var(--text-secondary)]" />}
        action={
          // A full page load, so the sign-in page reads the session afresh.
          <a
            href="/sign-in"
            className="touch-target inline-flex items-center rounded-[var(--radius-md)] px-2 font-medium text-[var(--primary)] transition-colors hover:text-[var(--primary-hover)]"
          >
            Sign in again
          </a>
        }
      >
        <p className="font-medium text-[var(--text-primary)]">You're signed out</p>
        {waiting}
      </StatusRow>
    );
  } else if (isSyncing && (pendingCount > 0 || slowSync)) {
    status = (
      <StatusRow icon={<Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" />}>
        <p className="font-medium text-[var(--text-primary)]">
          {pendingCount > 0 ? `Sending ${changes(pendingCount)}…` : "Syncing…"}
        </p>
      </StatusRow>
    );
  } else if (pendingCount > 0) {
    status = (
      <StatusRow
        icon={<CloudUpload className="h-4 w-4 text-[var(--primary)]" />}
        action={
          <Button variant="secondary" onClick={() => void triggerSync()}>
            Sync now
          </Button>
        }
      >
        <p className="font-medium text-[var(--text-primary)]">
          {changes(pendingCount)} not sent yet
        </p>
      </StatusRow>
    );
  }

  if (!status && deadLetterCount === 0) {
    return null;
  }

  return (
    <GlassSurface
      chromeRole="toast"
      className="pointer-events-auto divide-y divide-[var(--border-subtle)] overflow-hidden rounded-[var(--radius-lg)] text-sm transition-[opacity,translate] duration-300 starting:translate-y-2 starting:opacity-0"
    >
      {status}

      {deadLetterCount > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={showDeadLetters}
            aria-controls={listId}
            onClick={() => setShowDeadLetters((shown) => !shown)}
            className="flex min-h-14 w-full cursor-pointer items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-[var(--surface-raised)] focus-visible:outline-offset-[-2px]"
          >
            <TriangleAlert
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-[var(--destructive)]"
            />
            <span className="flex-1 font-medium text-[var(--text-primary)]">
              {changes(deadLetterCount)} failed
            </span>
            <ChevronDown
              aria-hidden="true"
              className={`h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform duration-200 ${
                showDeadLetters ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Not announced: the student opened it. */}
          <ul
            id={listId}
            hidden={!showDeadLetters}
            aria-live="off"
            className="max-h-64 divide-y divide-[var(--border-subtle)] overflow-y-auto border-t border-[var(--border-subtle)]"
          >
            {deadLetters.map((entry) => (
              <li key={entry.id} className="space-y-2 px-4 py-3">
                <p id={`${listId}-${entry.id}`}>
                  <span className="block font-medium text-[var(--text-primary)]">
                    {OPERATION[entry.op]} {entry.table}
                  </span>
                  <span className="block break-words text-xs text-[var(--text-secondary)]">
                    {entry.lastError || "College Ess refused this change."}
                  </span>
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    aria-describedby={`${listId}-${entry.id}`}
                    onClick={() => void handleRetry(entry.id)}
                  >
                    Retry
                  </Button>
                  <Button
                    variant="ghost"
                    aria-describedby={`${listId}-${entry.id}`}
                    onClick={() => void handleDismiss(entry.id)}
                  >
                    Dismiss
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassSurface>
  );
}
