"use client";

import { ReminderToggle } from "@/components/reminders/reminder-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import {
  devicePushIsOn,
  devicePushSupport,
  disableDevicePush,
  enableDevicePush,
  fetchVapidPublicKey,
} from "@/lib/reminders/push-client";
import { AlertCircle, BellOff, ChevronRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

// `serviceWorker.ready` never settles when no worker is registered (as under `next dev`).
const SERVICE_WORKER_WAIT_MS = 5000;

type DeviceState =
  | { status: "loading" | "ios-not-installed" | "unsupported" | "blocked" | "unavailable" }
  | {
      status: "ready";
      registration: ServiceWorkerRegistration;
      key: Uint8Array<ArrayBuffer>;
      isOn: boolean;
    };

const NOTICES = {
  unsupported: { icon: BellOff, text: "This browser can't show reminders." },
  blocked: {
    icon: BellOff,
    text: "Notifications are blocked for this site. Allow them in your browser's settings, then come back here.",
  },
  unavailable: {
    icon: RefreshCw,
    text: "Reminders aren't available right now. Reload the page and try again.",
  },
};

function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), SERVICE_WORKER_WAIT_MS);
  });
  return Promise.race([navigator.serviceWorker.ready, timeout]).finally(() => clearTimeout(timer));
}

/** Turns Web Push on or off for this browser, for the signed-in account. */
export function DeviceReminders() {
  const [state, setState] = useState<DeviceState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const support = devicePushSupport();
    if (support !== "available") {
      setState({ status: support });
      return;
    }
    let cancelled = false;
    (async () => {
      const registration = await serviceWorkerRegistration();
      if (cancelled) return;
      if (!registration) {
        setState({ status: "unavailable" });
        return;
      }
      try {
        // Loaded before any tap: Safari lets a page subscribe only while it handles the tap,
        // so nothing can be fetched between the tap and `subscribe()`.
        const [key, isOn] = await Promise.all([
          fetchVapidPublicKey(),
          devicePushIsOn(registration),
        ]);
        if (!cancelled) setState({ status: "ready", registration, key, isOn });
      } catch {
        if (!cancelled) setState({ status: "unavailable" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <Skeleton className="h-12 w-full" />;
  }

  if (state.status === "ios-not-installed") {
    return <ReminderToggle />;
  }

  if (state.status !== "ready") {
    const { icon: Icon, text } = NOTICES[state.status];
    return (
      <div className="flex items-start gap-2.5 p-3.5 rounded-[var(--radius-lg)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-sm text-[var(--text-secondary)]">
        <Icon className="h-4 w-4 shrink-0 mt-0.5" />
        <p>{text}</p>
      </div>
    );
  }

  const handleChange = async (next: boolean) => {
    // First, before any other await: this call is still inside the user's tap.
    const change = next
      ? enableDevicePush(state.registration, state.key)
      : disableDevicePush(state.registration);
    setBusy(true);
    setError(null);
    try {
      await change;
      setState({ ...state, isOn: next });
    } catch {
      if (Notification.permission === "denied") {
        setState({ status: "blocked" });
      } else {
        setError("Couldn't change reminders. Try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <ReminderToggle
        label="Reminders on this device"
        enabled={state.isOn}
        disabled={busy}
        onChange={handleChange}
      />
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-[var(--destructive)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      <div>
        <p className="text-sm text-[var(--text-secondary)]">
          Reminders go to each phone or computer you turn them on for.
        </p>
        <Link
          href="/guide/reminders"
          className="touch-target inline-flex items-center gap-1 text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
        >
          How reminders work
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
