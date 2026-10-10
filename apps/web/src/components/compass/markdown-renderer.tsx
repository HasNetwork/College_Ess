"use client";

import React, { type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getTextFromChildren(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) {
    return children.map(getTextFromChildren).join("");
  }
  if (children && typeof children === "object" && "props" in children) {
    // biome-ignore lint/suspicious/noExplicitAny: React element children inspection
    return getTextFromChildren((children as any).props?.children);
  }
  return "";
}

export interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * MarkdownRenderer
 *
 * CRITICAL SECURITY REQUIREMENT (PLAN 0-9 §7):
 * Sanitisation is mandatory. Uses react-markdown + remark-gfm + rehype-sanitize.
 * Raw HTML is strictly OFF (rehype-raw is never enabled).
 * All heading tags receive slugified anchor IDs to support deep-linking.
 */
export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`prose-compass space-y-4 text-sm leading-relaxed ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: ({ children }) => {
            const id = slugify(getTextFromChildren(children));
            return (
              <h1
                id={id}
                className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-8 mb-4 border-b border-[var(--border-subtle)] pb-2 scroll-mt-20"
              >
                {children}
              </h1>
            );
          },
          h2: ({ children }) => {
            const id = slugify(getTextFromChildren(children));
            return (
              <h2
                id={id}
                className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--text-primary)] mt-6 mb-3 scroll-mt-20"
              >
                {children}
              </h2>
            );
          },
          h3: ({ children }) => {
            const id = slugify(getTextFromChildren(children));
            return (
              <h3
                id={id}
                className="text-base sm:text-lg font-semibold text-[var(--text-primary)] mt-5 mb-2 scroll-mt-20"
              >
                {children}
              </h3>
            );
          },
          p: ({ children }) => (
            <p className="text-[var(--text-secondary)] leading-relaxed mb-3">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1.5 text-[var(--text-secondary)] mb-4">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1.5 text-[var(--text-secondary)] mb-4">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-[var(--primary)] font-medium hover:underline focus-visible:outline-[var(--primary)]"
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[var(--primary)] pl-4 py-1 italic bg-[var(--surface-raised)] rounded-r-[var(--radius-sm)] text-[var(--text-secondary)] my-4">
              {children}
            </blockquote>
          ),
          code: ({ className, children }) => {
            const isInline = !className;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-[var(--surface-sunken)] font-mono text-xs text-[var(--text-primary)] border border-[var(--border-subtle)]">
                  {children}
                </code>
              );
            }
            return (
              <pre className="p-4 rounded-[var(--radius-md)] bg-[var(--surface-sunken)] font-mono text-xs overflow-x-auto text-[var(--text-primary)] border border-[var(--border-subtle)] my-4">
                <code>{children}</code>
              </pre>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
              <table className="w-full text-left text-sm divide-y divide-[var(--border-subtle)]">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2.5 font-semibold text-[var(--text-primary)] bg-[var(--surface-raised)]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2.5 text-[var(--text-secondary)] border-t border-[var(--border-subtle)]">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
