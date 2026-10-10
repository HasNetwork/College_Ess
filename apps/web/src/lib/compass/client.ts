import type { DocSearchItem } from "./search";

const COMPASS_CACHE_KEY = "clg_ess_compass_docs_cache";

export function getCachedDocs(): DocSearchItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(COMPASS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setCachedDocs(docs: DocSearchItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(COMPASS_CACHE_KEY, JSON.stringify(docs));
  } catch (err) {
    console.warn("Failed to cache compass docs in localStorage:", err);
  }
}
