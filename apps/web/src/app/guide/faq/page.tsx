"use client";

import { MarkdownRenderer } from "@/components/compass/markdown-renderer";
import { AppShell } from "@/components/shell/app-shell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import { getCachedDocs, setCachedDocs } from "@/lib/compass/client";
import type { DocSearchItem } from "@/lib/compass/search";
import { ArrowLeft, HelpCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

// Each FAQ is a guide page of kind "faq": its title is the question, its body the answer.
// They live in the database with the rest of the guide (R1); nothing is written here.
function faqsOf(docs: DocSearchItem[]): DocSearchItem[] {
  return docs
    .filter((doc) => doc.kind === "faq")
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
}

export default function GuideFaqPage() {
  // null until either this device's copy or the server has answered.
  const [faqs, setFaqs] = useState<DocSearchItem[] | null>(null);

  useEffect(() => {
    const cached = getCachedDocs();
    if (cached.length > 0) setFaqs(faqsOf(cached));

    fetch("/api/compass")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.docs) {
          setCachedDocs(data.docs);
          setFaqs(faqsOf(data.docs));
        } else {
          setFaqs((current) => current ?? []);
        }
      })
      .catch(() => {
        // Offline: keep this device's copy, or show that there is none yet.
        setFaqs((current) => current ?? []);
      });
  }, []);

  return (
    <AppShell>
      <div className="max-w-4xl space-y-8">
        <div>
          <Link
            href="/guide"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Compass
          </Link>
        </div>

        <div className="border-b border-[var(--border-subtle)] pb-6 space-y-2">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-[var(--primary)]" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              Frequently Asked Questions
            </h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Answers to common questions about reminders, working offline and the guide itself.
          </p>
        </div>

        {faqs === null ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : faqs.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">
            The questions aren't on this device yet. They load the first time you open the guide
            while College Ess can be reached.
          </p>
        ) : (
          <Accordion
            type="single"
            collapsible
            // A search result links to /guide/faq#<slug>: open that answer, else the first.
            defaultValue={
              faqs.find((faq) => `#${faq.slug}` === window.location.hash)?.slug ?? faqs[0]?.slug
            }
            className="gap-3"
          >
            {faqs.map((faq) => (
              <AccordionItem
                key={faq.slug}
                value={faq.slug}
                id={faq.slug}
                className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-card)]"
              >
                <AccordionTrigger className="px-4 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-raised)] sm:text-base">
                  {faq.title}
                </AccordionTrigger>
                <AccordionContent className="border-t border-[var(--border-subtle)] px-4 pt-3">
                  <MarkdownRenderer content={faq.bodyMd} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </div>
    </AppShell>
  );
}
