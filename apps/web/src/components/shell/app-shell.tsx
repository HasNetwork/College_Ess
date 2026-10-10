"use client";

import { TimeZonePrompt } from "@/components/reminders/time-zone-prompt";
import { GlassSurface } from "@/components/ui/glass-surface";
import { SyncStatusWidget } from "@/lib/sync";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { AppMark } from "./app-mark";
import { IosInstallPrompt } from "./ios-install-prompt";
import { NAV_ITEMS } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // The page leaves room below its end for whatever toasts are showing, so a toast never
  // hides the last of a page (0.5-4's finding: the time-zone prompt covered Settings' last
  // row on a phone). The region is empty, 0 px tall, when nothing is showing.
  const toastsRef = useRef<HTMLDivElement>(null);
  const [toastSpace, setToastSpace] = useState(0);
  useEffect(() => {
    const region = toastsRef.current;
    if (!region) return;
    const observer = new ResizeObserver(() => setToastSpace(region.offsetHeight));
    observer.observe(region);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-canvas)] text-[var(--text-primary)] overflow-x-hidden">
      {/* Top Persistent Header */}
      <GlassSurface
        as="header"
        chromeRole="header"
        className="sticky top-0 z-30 flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-subtle)]"
      >
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            // On a phone the name beside the mark is hidden, so the link carries it.
            aria-label="College Ess"
            className="flex items-center gap-2 font-bold tracking-tight text-lg focus-visible:outline-[var(--primary)]"
          >
            <AppMark />
            <span className="hidden sm:inline font-semibold">College Ess</span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
        </div>
      </GlassSurface>

      {/* iOS Install Prompt (Non-intrusive, dismissible) */}
      <IosInstallPrompt />

      <div className="flex-1 flex w-full max-w-7xl mx-auto">
        {/* Desktop Sidebar (>= 768px) */}
        <nav
          aria-label="Desktop primary navigation"
          className="hidden md:flex flex-col w-60 shrink-0 border-r border-[var(--border-subtle)] p-4 gap-1 select-none"
        >
          <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider px-3 py-2">
            Modules
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors touch-target ${
                  isActive
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--shadow-sm)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Main Content Area */}
        <main
          style={{ "--toast-space": `${toastSpace}px` } as CSSProperties}
          className="flex-1 min-w-0 p-4 sm:p-6 pb-[calc(6rem+var(--toast-space))] md:pb-[calc(2rem+var(--toast-space))] w-full max-w-full overflow-x-hidden"
        >
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (< 768px) */}
      <GlassSurface
        as="nav"
        chromeRole="tabbar"
        aria-label="Mobile primary navigation"
        className="flex md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--border-subtle)] px-2 pt-1 pb-safe items-center justify-around select-none"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-[var(--radius-sm)] touch-target min-w-[44px] transition-colors ${
                isActive
                  ? "text-[var(--primary)] font-semibold"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] tracking-tight mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </GlassSurface>

      {/* Toasts: above the tab bar on phones, bottom right from md. Outside the header: its
          glass makes the header, not the viewport, the box a fixed child is placed in. */}
      <div
        ref={toastsRef}
        aria-live="polite"
        data-slot="toast-region"
        className="pointer-events-none fixed right-4 bottom-[calc(max(0.75rem,var(--sab))_+_4rem)] left-4 z-50 flex flex-col gap-2 md:right-6 md:bottom-6 md:left-auto md:w-96"
      >
        <TimeZonePrompt />
        <SyncStatusWidget />
      </div>
    </div>
  );
}
