"use client";

import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { getCachedDocs, setCachedDocs } from "@/lib/compass/client";
import { type DocSearchItem, type SearchResult, searchDocs } from "@/lib/compass/search";
import { ArrowLeft, BookOpen, FileText, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

function GuideSearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParam = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(queryParam);
  const [docs, setDocs] = useState<DocSearchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setQuery(queryParam);
  }, [queryParam]);

  useEffect(() => {
    // 1. Read offline cache
    const cached = getCachedDocs();
    if (cached.length > 0) {
      setDocs(cached);
      setLoading(false);
    }

    // 2. Fetch fresh docs
    fetch("/api/compass")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.docs) {
          setDocs(data.docs);
          setCachedDocs(data.docs);
        }
      })
      .catch((err) => {
        console.warn("Offline search using cached bundle:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/guide/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const results: SearchResult[] = useMemo(() => {
    if (!queryParam.trim() || docs.length === 0) return [];
    return searchDocs(docs, queryParam);
  }, [docs, queryParam]);

  return (
    <div className="max-w-4xl space-y-6">
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

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <Input
            type="search"
            placeholder="Search guides, policies, and settings..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button type="submit">Search</Button>
      </form>

      {/* Results Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <h1 className="text-lg font-semibold text-[var(--text-primary)]">
          {queryParam ? `Search results for "${queryParam}"` : "Search Compass Guides"}
        </h1>
        <span className="text-xs text-[var(--text-muted)]">
          {results.length} {results.length === 1 ? "result" : "results"} found
        </span>
      </div>

      {/* Results List */}
      {loading && docs.length === 0 ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-3">
          {results.map(({ doc, snippet }) => (
            <Link
              key={doc.slug}
              href={doc.kind === "faq" ? `/guide/faq#${doc.slug}` : `/guide/${doc.slug}`}
              className="p-4 rounded-[var(--radius-xl)] bg-[var(--surface-card)] border border-[var(--border-subtle)] hover:border-[var(--primary)] shadow-[var(--shadow-sm)] transition-all block group"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[var(--primary)]" />
                  <h2 className="font-semibold text-base text-[var(--text-primary)] group-hover:text-[var(--primary)] transition-colors">
                    {doc.title}
                  </h2>
                </div>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--surface-sunken)] border border-[var(--border-subtle)] text-[var(--text-secondary)] capitalize">
                  {doc.kind}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed font-mono line-clamp-2">
                {snippet}
              </p>
            </Link>
          ))}
        </div>
      ) : queryParam ? (
        <div className="p-8 text-center rounded-[var(--radius-xl)] bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-3">
          <BookOpen className="h-10 w-10 text-[var(--text-muted)] mx-auto opacity-50" />
          <p className="text-sm font-medium text-[var(--text-primary)]">
            No matching guides or policies found
          </p>
          <p className="text-xs text-[var(--text-secondary)]">
            Try searching for broader terms like "sync", "reminders", "attendance", or "offline".
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default function GuideSearchPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="max-w-4xl space-y-4 pt-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        }
      >
        <GuideSearchContent />
      </Suspense>
    </AppShell>
  );
}
