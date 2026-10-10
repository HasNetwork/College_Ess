"use client";

import { MarkdownRenderer } from "@/components/compass/markdown-renderer";
import { AppShell } from "@/components/shell/app-shell";
import { getCachedDocs, setCachedDocs } from "@/lib/compass/client";
import type { DocSearchItem } from "@/lib/compass/search";
import { SETTINGS, type SettingDefinition } from "@clg-ess/core";
import { AlertCircle, ArrowLeft, CheckCircle2, Lock, Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function slugifySettingKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/\./g, "-")
    .toLowerCase();
}

export default function GuideSettingsPage() {
  const [collegeNote, setCollegeNote] = useState<string | null>(null);

  useEffect(() => {
    // 1. Look for 'settings-note' in offline cache
    const cached = getCachedDocs();
    const note = cached.find((d) => d.slug === "settings-note");
    if (note) {
      setCollegeNote(note.bodyMd);
    }

    // 2. Refresh from API
    fetch("/api/compass")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.docs) {
          setCachedDocs(data.docs);
          const remoteNote = (data.docs as DocSearchItem[]).find((d) => d.slug === "settings-note");
          if (remoteNote) {
            setCollegeNote(remoteNote.bodyMd);
          }
        }
      })
      .catch((err) => {
        console.warn("Could not fetch settings note:", err);
      });
  }, []);

  // Group settings by their group property
  const groupedSettings = useMemo(() => {
    const groups: Record<string, SettingDefinition[]> = {};
    for (const def of Object.values(SETTINGS)) {
      const groupList = groups[def.group] ?? [];
      groupList.push(def);
      groups[def.group] = groupList;
    }
    return groups;
  }, []);

  return (
    <AppShell>
      <div className="max-w-4xl space-y-8">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/guide"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Compass
          </Link>
        </div>

        {/* Header */}
        <div className="border-b border-[var(--border-subtle)] pb-6 space-y-2">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-[var(--primary)]" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              Application Settings Guide
            </h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Detailed documentation for all configurable options, defaults, and mandatory college
            policies.
          </p>
        </div>

        {/* Grouped Settings Documentation */}
        <div className="space-y-8">
          {Object.entries(groupedSettings).map(([groupName, defs]) => (
            <section key={groupName} aria-labelledby={`group-${groupName}`} className="space-y-4">
              <h2
                id={`group-${groupName}`}
                className="text-lg font-semibold tracking-tight text-[var(--text-primary)] border-b border-[var(--border-subtle)] pb-2"
              >
                {groupName}
              </h2>

              <div className="grid gap-4">
                {defs.map((setting) => {
                  const slugId = slugifySettingKey(setting.key);

                  return (
                    <div
                      key={setting.key}
                      id={slugId}
                      className="relative p-5 rounded-[var(--radius-xl)] bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-[var(--shadow-sm)] space-y-3 scroll-mt-24 transition-all hover:border-[var(--border-strong)]"
                    >
                      {/* Secondary anchor for raw dot-key matching */}
                      <span id={setting.key} className="sr-only" />

                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-base text-[var(--text-primary)]">
                              {setting.label}
                            </h3>
                            {setting.editable ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--success)] bg-[var(--success)]/10 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="h-3 w-3" />
                                Configurable
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--warning)] bg-[var(--warning)]/10 px-2 py-0.5 rounded-full">
                                <Lock className="h-3 w-3" />
                                Mandatory Policy
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-mono text-[var(--text-muted)]">
                            {setting.key}
                          </p>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-mono px-2 py-1 rounded bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                            Default: {String(setting.default)}
                          </span>
                        </div>
                      </div>

                      {/* Setting Description (Required by Core Type) */}
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                        {setting.description}
                      </p>

                      {!setting.editable && (
                        <div className="flex items-start gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
                          <AlertCircle className="h-4 w-4 text-[var(--warning)] shrink-0 mt-0.5" />
                          <span>
                            This setting is locked across all devices. Campus rules require this
                            feature to remain active for student safety and compliance.
                          </span>
                        </div>
                      )}

                      {setting.options && setting.options.length > 0 && (
                        <div className="pt-1 flex items-center gap-2 text-xs text-[var(--text-muted)]">
                          <span>Available values:</span>
                          <div className="flex flex-wrap gap-1">
                            {setting.options.map((opt) => (
                              <code
                                key={opt}
                                className="px-1.5 py-0.5 rounded bg-[var(--surface-sunken)] font-mono text-[11px] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                              >
                                {opt}
                              </code>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* College Specific Note (Rendered below generated settings per PLAN 0-9 §4) */}
        {collegeNote && (
          <section
            aria-labelledby="college-note-heading"
            className="mt-10 pt-6 border-t border-[var(--border-subtle)] space-y-3"
          >
            <h2
              id="college-note-heading"
              className="text-lg font-semibold text-[var(--text-primary)]"
            >
              College-Specific Policy Note
            </h2>
            <div className="p-4 rounded-[var(--radius-xl)] bg-[var(--surface-card)] border border-[var(--border-subtle)]">
              <MarkdownRenderer content={collegeNote} />
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}
