export interface DocSearchItem {
  slug: string;
  title: string;
  kind: string;
  bodyMd: string;
  minRole?: string;
  audience?: string;
  orderIndex?: number;
}

export interface SearchResult {
  doc: DocSearchItem;
  score: number; // title match = 10, body match = 1
  snippet: string;
}

/**
 * Client-side search over cached guide bundle (PLAN 0-9 §5).
 * Token match in browser, ranks title hits above body hits, extracts surrounding snippet.
 * Works completely offline without server roundtrips.
 */
export function searchDocs(docs: readonly DocSearchItem[], query: string): SearchResult[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const results: SearchResult[] = [];

  for (const doc of docs) {
    const titleLower = doc.title.toLowerCase();
    const bodyLower = doc.bodyMd.toLowerCase();

    let score = 0;
    let matchIndex = -1;

    for (const token of tokens) {
      if (titleLower.includes(token)) {
        score += 10;
      }
      const bodyIdx = bodyLower.indexOf(token);
      if (bodyIdx !== -1) {
        score += 1;
        if (matchIndex === -1) {
          matchIndex = bodyIdx;
        }
      }
    }

    if (score > 0) {
      let snippet = "";
      if (matchIndex !== -1) {
        const start = Math.max(0, matchIndex - 40);
        const end = Math.min(doc.bodyMd.length, matchIndex + 100);
        snippet = `${start > 0 ? "..." : ""}${doc.bodyMd.slice(start, end).replace(/\n/g, " ").trim()}${
          end < doc.bodyMd.length ? "..." : ""
        }`;
      } else {
        snippet = doc.bodyMd.slice(0, 120).replace(/\n/g, " ").trim();
      }

      results.push({ doc, score, snippet });
    }
  }

  // Sort descending by score
  return results.sort((a, b) => b.score - a.score);
}
