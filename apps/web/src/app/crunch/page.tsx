"use client";

import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { INITIAL_EXAMS, type ExamItem } from "@/lib/mock-data";
import {
  AlertCircle,
  Calendar,
  Clock,
  GraduationCap,
  MapPin,
  ShieldAlert,
  Sparkles,
  UserCheck,
} from "lucide-react";
import { useState } from "react";

export default function CrunchPage() {
  const [exams, setExams] = useState<ExamItem[]>(INITIAL_EXAMS);

  const nearestExam = exams[0];

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-[var(--destructive)]/10 text-[var(--destructive)]">
                <GraduationCap className="h-4 w-4" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Crunch · Exams &amp; Seating
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              Midsems, endsems, assigned halls, and seating rosters with fail-safe alerts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--destructive)]/10 text-[var(--destructive)] border border-[var(--destructive)]/20">
              Mid-Semester Examinations (Autumn 2026)
            </span>
          </div>
        </div>

        {/* Big Alert Hero Card: Next Exam */}
        {nearestExam && (
          <div className="p-5 rounded-[var(--radius-xl)] border-2 border-[var(--destructive)]/30 bg-[var(--surface-card)] shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-[var(--destructive)] animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--destructive)]">
                  Approaching in {nearestExam.daysRemaining} days
                </span>
              </div>
              <span className="text-xs font-mono font-semibold text-[var(--text-muted)]">
                {nearestExam.credits} Credits Weightage
              </span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                {nearestExam.courseName} ({nearestExam.courseCode})
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
                  {nearestExam.date}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5 font-mono">
                  <Clock className="h-4 w-4 text-[var(--text-muted)]" />
                  {nearestExam.time}
                </span>
              </div>
            </div>

            {/* Hall Ticket & Seating Badge */}
            <div className="p-3.5 rounded-[var(--radius-lg)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)]">
                  <MapPin className="h-5 w-5 text-[var(--primary)]" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-[var(--text-primary)]">
                    Exam Hall: {nearestExam.hall}
                  </div>
                  <div className="text-[var(--text-muted)]">Academic Complex · 2nd Floor</div>
                </div>
              </div>

              <div className="px-3 py-1.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)] font-bold text-center border border-[var(--primary)]/20">
                🪑 Assigned Seat: {nearestExam.seatNo}
              </div>
            </div>
          </div>
        )}

        {/* Full Exam Roster */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-muted)] px-1">
            <span>FULL EXAM SCHEDULE &amp; ROSTER</span>
            <span>{exams.length} EXAMS SCHEDULED</span>
          </div>

          <div className="space-y-3">
            {exams.map((exam) => (
              <div
                key={exam.id}
                className="p-4 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--primary)]/30 transition-colors shadow-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[var(--surface-raised)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                        {exam.courseCode}
                      </span>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                        {exam.courseName}
                      </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[var(--text-secondary)]">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        {exam.date}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                        {exam.time}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-[var(--border-subtle)]">
                    <div className="text-right text-xs">
                      <div className="font-semibold text-[var(--text-primary)]">{exam.hall}</div>
                      <div className="text-[var(--text-muted)]">{exam.seatNo}</div>
                    </div>

                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[var(--surface-raised)] text-[var(--text-secondary)] border border-[var(--border-subtle)] shrink-0">
                      in {exam.daysRemaining}d
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
