"use client";

import { AppShell } from "@/components/shell/app-shell";
import { INITIAL_HOLIDAYS, type HolidayItem } from "@/lib/mock-data";
import {
  Calendar,
  Compass,
  MapPin,
  Palmtree,
  Sparkles,
  Sun,
  Train,
} from "lucide-react";
import { useState } from "react";

export default function BreatherPage() {
  const [holidays] = useState<HolidayItem[]>(INITIAL_HOLIDAYS);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)]">
                <Palmtree className="h-4 w-4" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Breather · Holidays &amp; Long Weekends
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              Three-month lookahead for public holidays, semester breaks, and bridge days worth taking off.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20">
              ✈ Next Long Break: Oct 30
            </span>
          </div>
        </div>

        {/* Long Weekend Strategy Card */}
        <div className="p-5 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)] space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[var(--primary)]" />
            <h2 className="text-base font-semibold text-[var(--text-primary)]">
              Long Weekend Hack: Guru Nanak Jayanti
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
            Nov 15 falls on a Friday! Coupled with Saturday and Sunday, you get a clean <strong>3-day weekend</strong> without missing a single lecture or attendance checkpoint.
          </p>

          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
            <div className="p-2.5 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)] block text-[10px]">FRI NOV 15</span>
              <span className="font-semibold text-[var(--primary)]">Official Holiday</span>
            </div>
            <div className="p-2.5 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)] block text-[10px]">SAT NOV 16</span>
              <span className="font-semibold text-[var(--text-primary)]">Weekend Off</span>
            </div>
            <div className="p-2.5 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
              <span className="text-[var(--text-muted)] block text-[10px]">SUN NOV 17</span>
              <span className="font-semibold text-[var(--text-primary)]">Weekend Off</span>
            </div>
          </div>
        </div>

        {/* Holidays List */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-[var(--text-muted)] px-1">
            UPCOMING ACADEMIC CALENDAR BREAKS
          </div>

          {holidays.map((h) => (
            <div
              key={h.id}
              className="p-4 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--primary)]/30 transition-colors shadow-xs space-y-2"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[var(--surface-raised)] text-[var(--primary)]">
                    <Sun className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{h.name}</h3>
                    <div className="text-xs text-[var(--text-secondary)] mt-0.5">{h.dates}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)]">
                    {h.daysCount} Days Off
                  </span>
                </div>
              </div>

              {h.tip && (
                <div className="text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border-subtle)]">
                  💡 {h.tip}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
