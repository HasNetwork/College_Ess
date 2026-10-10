"use client";

import { DeviceReminders } from "@/components/reminders/device-reminders";
import { QuietHoursSetting } from "@/components/reminders/quiet-hours-setting";
import { TimeZoneSetting } from "@/components/reminders/time-zone-setting";
import { AppShell } from "@/components/shell/app-shell";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { UnreachableNotice } from "@/components/shell/unreachable-notice";
import { Skeleton } from "@/components/ui/skeleton";
import { authClient } from "@/lib/auth-client";
import { SETTINGS } from "@clg-ess/core";
import { Bell, BookOpen, ChevronRight, Palette } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function SettingsPage() {
  const router = useRouter();
  const session = authClient.useSession();

  useEffect(() => {
    // Signed out for certain; an error means College Ess couldn't be reached (see dashboard).
    if (!session.isPending && !session.error && !session.data?.user) {
      router.push("/sign-in");
    }
  }, [session, router]);

  if (!session.isPending && session.error && !session.data?.user) {
    return (
      <AppShell>
        <UnreachableNotice what="Your settings" />
      </AppShell>
    );
  }

  if (session.isPending || !session.data?.user) {
    return (
      <AppShell>
        <div className="space-y-6 max-w-4xl">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </AppShell>
    );
  }

  const user = session.data.user;

  return (
    <AppShell>
      <div className="max-w-4xl space-y-8">
        <div className="border-b border-[var(--border-subtle)] pb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Settings
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            How College Ess reminds you and how it looks on this device.
          </p>
        </div>

        <section
          aria-labelledby="reminders-heading"
          className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-sm)] space-y-4"
        >
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-[var(--primary)]" />
            <h2 id="reminders-heading" className="text-lg font-semibold text-[var(--text-primary)]">
              Reminders
            </h2>
          </div>
          <DeviceReminders />
          <div className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
            <div className="py-5">
              <QuietHoursSetting
                saved={user.quietHoursEnabled ?? SETTINGS["reminders.quietHours.enabled"].default}
              />
            </div>
            <div className="pt-5">
              <TimeZoneSetting saved={user.timezone ?? SETTINGS["reminders.timeZone"].default} />
            </div>
          </div>
        </section>

        <section
          aria-labelledby="appearance-heading"
          className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-sm)] space-y-4"
        >
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-[var(--primary)]" />
            <h2
              id="appearance-heading"
              className="text-lg font-semibold text-[var(--text-primary)]"
            >
              Appearance
            </h2>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">Theme</p>
              <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                System follows your device's light or dark setting.
              </p>
            </div>
            <ThemeToggle className="shrink-0" />
          </div>
        </section>

        <Link
          href="/guide/settings"
          className="touch-target inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)] hover:text-[var(--primary-hover)] transition-colors"
        >
          <BookOpen className="h-4 w-4" />
          What each setting does
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </AppShell>
  );
}
