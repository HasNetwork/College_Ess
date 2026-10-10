"use client";

import { MarkdownRenderer } from "@/components/compass/markdown-renderer";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCachedDocs, setCachedDocs } from "@/lib/compass/client";
import type { DocSearchItem } from "@/lib/compass/search";
import { ArrowLeft, BookOpen, Clock, Tag } from "lucide-react";
import Link from "next/link";
import { use, useEffect, useState } from "react";

interface GuideSlugPageProps {
  params: Promise<{ slug: string }>;
}

export default function GuideSlugPage({ params }: GuideSlugPageProps) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [doc, setDoc] = useState<DocSearchItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Try to read from offline cache immediately
    const cached = getCachedDocs();
    const foundCached = cached.find((d) => d.slug === slug);
    if (foundCached) {
      setDoc(foundCached);
      setLoading(false);
    }

    // 2. Fetch fresh from API
    fetch("/api/compass")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.docs) {
          setCachedDocs(data.docs);
          const found = (data.docs as DocSearchItem[]).find((d) => d.slug === slug);
          if (found) {
            setDoc(found);
            setError(null);
          } else if (!foundCached) {
            setError("Document not found or you do not have permission to view it.");
          }
        }
      })
      .catch((err) => {
        console.warn("Could not refresh compass docs:", err);
        if (!foundCached) {
          setError("Document not found in offline storage. Please reconnect to sync.");
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  return (
    <AppShell>
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

        {loading && !doc ? (
          <div className="space-y-4 pt-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
            <div className="space-y-2 pt-6">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        ) : error || !doc ? (
          <div className="p-8 text-center rounded-[var(--radius-xl)] bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-4">
            <BookOpen className="h-12 w-12 text-[var(--text-muted)] mx-auto opacity-50" />
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">
                Document Unavailable
              </h2>
              <p className="text-sm text-[var(--text-secondary)]">
                {error || "This guide could not be located."}
              </p>
            </div>
            <Link href="/guide">
              <Button variant="secondary" size="sm">
                Return to Guide Index
              </Button>
            </Link>
          </div>
        ) : (
          <article className="space-y-6">
            {/* Header */}
            <header className="border-b border-[var(--border-subtle)] pb-6 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--primary)]/10 text-[var(--primary)] capitalize">
                  <Tag className="h-3 w-3" />
                  {doc.kind}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--surface-sunken)] text-[var(--text-secondary)] border border-[var(--border-subtle)] capitalize">
                  Audience: {doc.audience}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
                {doc.title}
              </h1>
            </header>

            {/* Content with strict sanitization and slugified headings */}
            <div className="pt-2">
              <MarkdownRenderer content={doc.bodyMd} />
            </div>
          </article>
        )}
      </div>
    </AppShell>
  );
}
