"use client";

import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { INITIAL_CLUBS, type ClubItem } from "@/lib/mock-data";
import {
  Calendar,
  CheckSquare,
  Shield,
  Sparkles,
  Users,
} from "lucide-react";
import { useState } from "react";

export default function CirclesPage() {
  const [clubs] = useState<ClubItem[]>(INITIAL_CLUBS);

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)]">
                <Users className="h-4 w-4" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Circles · Clubs &amp; Societies
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              Your collegiate clubs, executive roles, society meetings, and task handoffs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
              3 Active Memberships
            </span>
          </div>
        </div>

        {/* Clubs Grid */}
        <div className="space-y-4">
          {clubs.map((club) => (
            <div
              key={club.id}
              className="p-5 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)] hover:border-[var(--primary)]/30 transition-colors space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">{club.name}</h2>
                    <span className="text-xs px-2 py-0.5 rounded bg-[var(--surface-raised)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                      {club.category}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{club.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${
                      club.role === "Coordinator"
                        ? "bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30"
                        : "bg-[var(--surface-raised)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
                    }`}
                  >
                    👑 {club.role}
                  </span>
                </div>
              </div>

              {/* Club Info Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                  <span className="text-[var(--text-muted)] block font-medium">Next Assembly</span>
                  <span className="font-semibold text-[var(--text-primary)] mt-0.5 block">
                    {club.nextMeeting}
                  </span>
                </div>

                <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                  <span className="text-[var(--text-muted)] block font-medium">Roster Size</span>
                  <span className="font-semibold text-[var(--text-primary)] mt-0.5 block">
                    {club.memberCount} active students
                  </span>
                </div>

                <div className="p-3 rounded-[var(--radius-md)] bg-[var(--surface-raised)] border border-[var(--border-subtle)]">
                  <span className="text-[var(--text-muted)] block font-medium">Pending Tasks</span>
                  <span className="font-semibold text-[var(--text-primary)] mt-0.5 block">
                    {club.openTasks} tasks assigned in Loop
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
