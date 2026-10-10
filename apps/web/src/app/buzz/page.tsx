"use client";

import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { INITIAL_EVENTS, type CampusEvent } from "@/lib/mock-data";
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  MapPin,
  PartyPopper,
  Shirt,
  Sparkles,
  Ticket,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function BuzzPage() {
  const [events, setEvents] = useState<CampusEvent[]>(INITIAL_EVENTS);

  const toggleRegister = (id: string) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, registered: !e.registered } : e)),
    );
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-md bg-[var(--primary)]/10 text-[var(--primary)]">
                <Sparkles className="h-4 w-4" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                Buzz · Campus Events &amp; Fests
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1">
              Cultural fests, hackathons, guest lectures, and campus competitions with outfit planning.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20">
              Wave 2026 Season
            </span>
          </div>
        </div>

        {/* Events Cards */}
        <div className="space-y-4">
          {events.map((event) => (
            <div
              key={event.id}
              className="p-5 rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-sm)] hover:border-[var(--primary)]/30 transition-colors space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-[var(--primary)]/10 text-[var(--primary)]">
                      {event.category}
                    </span>
                    <h2 className="text-lg font-bold text-[var(--text-primary)]">{event.title}</h2>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{event.tagline}</p>
                </div>

                <div className="shrink-0">
                  <Button
                    size="sm"
                    variant={event.registered ? "outline" : "default"}
                    onClick={() => toggleRegister(event.id)}
                    className="text-xs gap-1.5"
                  >
                    {event.registered ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--success)]" /> Registered (Attending)
                      </>
                    ) : (
                      <>
                        <Ticket className="h-3.5 w-3.5" /> Register for Pass
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Event Metadata */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)] pt-1">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-[var(--text-muted)]" />
                  <strong>Dates:</strong> {event.date}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-[var(--text-muted)]" />
                  <strong>Venue:</strong> {event.venue}
                </span>
              </div>

              {/* Cross-Module Link with Drip */}
              {event.recommendedOutfit && (
                <div className="p-3 rounded-[var(--radius-lg)] bg-[var(--surface-raised)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Shirt className="h-4 w-4 text-[var(--primary)]" />
                    <span>
                      <strong className="text-[var(--text-primary)]">Planned Drip: </strong>
                      {event.recommendedOutfit}
                    </span>
                  </div>

                  <Link href="/drip" className="text-[var(--primary)] font-medium hover:underline text-[11px]">
                    Open Wardrobe →
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
