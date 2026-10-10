"use client";

import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { TODAY_SCHEDULE, type ClassBlock } from "@/lib/mock-data";
import {
  BookOpen,
  Calendar,
  CalendarClock,
  Clock,
  GraduationCap,
  Layers,
  MapPin,
  Plus,
  User,
} from "lucide-react";
import { useState } from "react";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export default function RhythmPage() {
  const [selectedDay, setSelectedDay] = useState<(typeof DAYS)[number]>("Wednesday");
  const [dayType, setDayType] = useState<"Class Day" | "Lab Intensive" | "Exam Prep">("Class Day");
  const [schedule, setSchedule] = useState<ClassBlock[]>(TODAY_SCHEDULE);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)]">
                <CalendarClock className="h-4 w-4" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Rhythm · Routine Manager
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              Smart recurring schedules that switch shapes automatically based on day type.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
              Active: {dayType}
            </span>
          </div>
        </div>

        {/* Day Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {DAYS.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-3 py-2 rounded-[var(--radius-md)] cursor-pointer font-medium transition-colors shrink-0 ${
                selectedDay === day
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs"
                  : "bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] border border-[var(--border-subtle)]"
              }`}
            >
              {day}
            </button>
          ))}
        </div>

        {/* Day Status & Configuration Card */}
        <div className="p-4 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[var(--text-muted)] font-medium">Schedule Mode:</span>
            {(["Class Day", "Lab Intensive", "Exam Prep"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setDayType(mode)}
                className={`px-2.5 py-1 rounded cursor-pointer border transition-colors ${
                  dayType === mode
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-transparent font-medium"
                    : "bg-[var(--surface-raised)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <span className="text-[var(--text-muted)]">
            Auto-linked with Loop tasks & Drip outfits
          </span>
        </div>

        {/* Schedule Timeline */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--text-muted)] px-1">
            <span>TODAY&apos;S TIMELINE ({selectedDay.toUpperCase()})</span>
            <span>4 SESSIONS PLANNED</span>
          </div>

          <div className="space-y-3">
            {schedule.map((block, idx) => (
              <div
                key={block.id}
                className={`p-4 rounded-[var(--radius-xl)] border transition-all ${
                  block.status === "in-progress"
                    ? "bg-[var(--primary)]/5 border-[var(--primary)] shadow-sm"
                    : "bg-[var(--surface-card)] border-[var(--border-subtle)]"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-[var(--surface-raised)] border border-[var(--border-subtle)] text-center shrink-0">
                      <div className="font-mono text-xs font-bold text-[var(--text-primary)]">
                        {block.startTime}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">
                        {block.endTime}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold px-1.5 py-0.2 rounded bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                          {block.courseCode}
                        </span>
                        <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                          {block.courseName}
                        </h2>
                        {block.status === "in-progress" && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-[var(--primary)] text-[var(--primary-foreground)]">
                            LIVE NOW
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-[var(--text-secondary)]">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                          <strong>Venue:</strong> {block.hall}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                          {block.instructor}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-center">
                    <span
                      className={`text-xs px-2.5 py-1 rounded font-medium ${
                        block.type === "Lab"
                          ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                          : block.type === "Club"
                          ? "bg-[var(--warning)]/10 text-[var(--warning)]"
                          : "bg-[var(--surface-raised)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {block.type}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
