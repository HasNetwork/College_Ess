"use client";

import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getCachedDocs, setCachedDocs } from "@/lib/compass/client";
import type { DocSearchItem } from "@/lib/compass/search";
import { BookOpen, Compass, FileText, HelpCircle, Search, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function GuideIndexPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<DocSearchItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Load from offline cache immediately
    const cached = getCachedDocs();
    if (cached.length > 0) {
      setDocs(cached);
      setLoading(false);
    }

    // 2. Fetch fresh docs from API
    fetch("/api/compass")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.docs) {
          setDocs(data.docs);
          setCachedDocs(data.docs);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch remote compass docs (using offline cache):", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/guide/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const guides = docs.filter((d) => d.kind === "guide");
  const faqs = docs.filter((d) => d.kind === "faq");

  return (
    <AppShell>
      <div className="max-w-4xl space-y-8">
        {/* Header Banner */}
        <div className="border-b border-[var(--border-subtle)] pb-6 space-y-2">
          <div className="flex items-center gap-2">
            <Compass className="h-6 w-6 text-[var(--primary)]" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              Compass — Campus Survival Guide
            </h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Official college policies, module guides, FAQs, and application settings. Always
            accessible offline.
          </p>
        </div>

        {/* Offline-First Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <Input
              type="search"
              placeholder="Search guides, policies, and settings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button type="submit">Search</Button>
        </form>

        {/* Quick Links Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/guide/faq"
            className="flex items-start gap-3 p-4 rounded-[var(--radius-xl)] bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--primary)] shadow-[var(--shadow-sm)] transition-all group"
          >
            <div className="p-2 rounded-[var(--radius-md)] bg-[var(--primary)]/10 text-[var(--primary)] shrink-0">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-base text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                Frequently Asked Questions
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Answers about working offline, reminders, two devices and these guide pages.
              </p>
            </div>
          </Link>

          <Link
            href="/guide/settings"
            className="flex items-start gap-3 p-4 rounded-[var(--radius-xl)] bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--primary)] shadow-[var(--shadow-sm)] transition-all group"
          >
            <div className="p-2 rounded-[var(--radius-md)] bg-[var(--success)]/10 text-[var(--success)] shrink-0">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-base text-[var(--text-primary)] group-hover:text-[var(--success)] transition-colors">
                Settings Registry & Docs
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Documentation and explanation of every app setting, quiet hours, and forced
                policies.
              </p>
            </div>
          </Link>
        </div>

        {/* Guides List */}
        <section aria-labelledby="guides-heading" className="space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[var(--primary)]" />
            <h2 id="guides-heading" className="text-lg font-semibold text-[var(--text-primary)]">
              Core Guides & Handbooks
            </h2>
          </div>

          {loading && docs.length === 0 ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {guides.map((doc) => (
                <Link
                  key={doc.slug}
                  href={`/guide/${doc.slug}`}
                  className="p-4 rounded-[var(--radius-lg)] bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--primary)] shadow-[var(--shadow-sm)] transition-all group block"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-[var(--text-muted)] group-hover:text-[var(--primary)]" />
                    <h3 className="font-semibold text-sm text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                      {doc.title}
                    </h3>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-2 line-clamp-2">
                    {doc.bodyMd.replace(/[#*`_]/g, "").slice(0, 100)}...
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
