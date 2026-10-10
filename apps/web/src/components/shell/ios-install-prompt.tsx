"use client";

import { Button } from "@/components/ui/button";
import { Share, X } from "lucide-react";
import { useEffect, useState } from "react";

export function isIosDevice(customUserAgent?: string): boolean {
  if (customUserAgent) {
    return /iphone|ipad|ipod/.test(customUserAgent.toLowerCase());
  }
  const nav =
    typeof window !== "undefined"
      ? window.navigator
      : typeof navigator !== "undefined"
        ? navigator
        : null;
  if (!nav) return false;
  const userAgent = nav.userAgent.toLowerCase();
  return (
    /iphone|ipad|ipod/.test(userAgent) ||
    (nav.platform === "MacIntel" && (nav.maxTouchPoints || 0) > 1)
  );
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator;
  return (
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches) ||
    // biome-ignore lint/suspicious/noExplicitAny: iOS legacy standalone check
    Boolean((nav as any)?.standalone)
  );
}

export function isIosSafariNotInstalled(customUserAgent?: string): boolean {
  const nav =
    typeof window !== "undefined"
      ? window.navigator
      : typeof navigator !== "undefined"
        ? navigator
        : null;
  const userAgent = (customUserAgent || nav?.userAgent || "").toLowerCase();
  const isSafari = /safari/.test(userAgent) && !/crios|fxios|edgios/.test(userAgent);
  return isIosDevice(customUserAgent) && isSafari && !isStandalonePwa();
}

const DISMISS_STORAGE_KEY = "clg_ess_ios_prompt_dismissed";

export function IosInstallPrompt() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const isDismissed = localStorage.getItem(DISMISS_STORAGE_KEY) === "true";
    if (isIosSafariNotInstalled() && !isDismissed) {
      setShouldShow(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_STORAGE_KEY, "true");
    setShouldShow(false);
  };

  if (!shouldShow) {
    return null;
  }

  return (
    <aside
      aria-label="Install College Ess on iOS"
      className="mx-4 my-2 p-3.5 rounded-[var(--radius-lg)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] shadow-[var(--shadow-sm)] flex items-start justify-between gap-3 text-sm animate-in fade-in duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-[var(--radius-md)] bg-[var(--primary)] text-[var(--primary-foreground)] shrink-0">
          <Share className="h-4 w-4" />
        </div>
        <div>
          {/* Not a heading: the banner comes before the page's own h1. */}
          <p className="font-semibold text-[var(--text-primary)] text-sm mb-0.5">
            Install College Ess
          </p>
          <p className="text-[var(--text-secondary)] text-xs leading-relaxed">
            To receive reminders and use offline features on iOS, tap{" "}
            <strong className="text-[var(--text-primary)]">Share</strong> in Safari and select{" "}
            <strong className="text-[var(--text-primary)]">Add to Home Screen</strong>.
          </p>
        </div>
      </div>
      {/* 44 px to tap (R6); the negative margin keeps the X in the banner's corner. */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleDismiss}
        aria-label="Dismiss install banner"
        className="-mt-2 -mr-2 text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
      >
        <X />
      </Button>
    </aside>
  );
}
