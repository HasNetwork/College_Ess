import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// Through the index: `schema/doc` and `schema/auth` import each other, and only the index's
// order evaluates them safely.
import { docAudienceEnum, docKindEnum, roleEnum } from "./schema/index";

/**
 * A built-in guide page, as its file in `seed/docs/` describes it. The file name is the
 * slug; the frontmatter holds the rest:
 *
 * ```md
 * ---
 * title: Getting Started with College Ess
 * kind: guide            # guide | faq | changelog
 * audience: user         # user | co_admin | admin
 * order: 0
 * minRole: student       # the lowest role that sees it
 * published: true
 * ---
 * # Getting Started
 * ```
 *
 * These are only the defaults a deploy brings: the database is what the app reads, and an
 * admin's edit there outlives any later default (`seedDatabase`, PLAN §8.11).
 */
export interface DefaultDoc {
  slug: string;
  title: string;
  kind: (typeof docKindEnum.enumValues)[number];
  audience: (typeof docAudienceEnum.enumValues)[number];
  orderIndex: number;
  minRole: (typeof roleEnum.enumValues)[number];
  published: boolean;
  bodyMd: string;
}

/**
 * `packages/db/seed/docs/`, from `src/` (tests, the seed CLI) and from `dist/` alike. Joined
 * at run time on purpose: webpack, bundling this package into the Next.js server, tries to
 * resolve `new URL("<literal>", import.meta.url)` as a file of its own and fails the build on
 * a folder. Only the seed reads it, and never on Vercel, where `DATABASE_URL` is Neon.
 */
export const DEFAULT_DOCS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "seed", "docs");

const FIELDS = ["title", "kind", "audience", "order", "minRole", "published"] as const;

/** Every page in `dir`, sorted by file name. An unreadable page throws, naming its file. */
export function loadDefaultDocs(dir = DEFAULT_DOCS_DIR): DefaultDoc[] {
  const files = readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .sort();
  // A deployment that lost its guide folder must not seed an empty guide in silence.
  if (files.length === 0) throw new Error(`No guide pages (*.md) in ${dir}`);
  return files.map((file) =>
    parseDefaultDoc(file.slice(0, -".md".length), readFileSync(join(dir, file), "utf-8")),
  );
}

export function parseDefaultDoc(slug: string, text: string): DefaultDoc {
  const fail = (why: string): never => {
    throw new Error(`Guide page "${slug}.md" ${why}`);
  };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    fail("needs a name of lowercase letters, digits and dashes");
  }

  // A Windows checkout (core.autocrlf) turns LF into CRLF.
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines[0] !== "---") fail("must start with a --- line");
  const end = lines.indexOf("---", 1);
  if (end === -1) fail("has no closing --- line");

  const fields = new Map<string, string>();
  for (const line of lines.slice(1, end)) {
    if (!line.trim()) continue;
    const colon = line.indexOf(":");
    if (colon === -1) fail(`has "${line}", which is not "name: value"`);
    const name = line.slice(0, colon).trim();
    if (!(FIELDS as readonly string[]).includes(name)) fail(`has an unknown field "${name}"`);
    if (fields.has(name)) fail(`sets "${name}" twice`);
    fields.set(name, line.slice(colon + 1).trim());
  }
  const field = (name: (typeof FIELDS)[number]) => fields.get(name) || fail(`is missing "${name}"`);
  const oneOf = <T extends string>(name: (typeof FIELDS)[number], allowed: readonly T[]): T => {
    const value = field(name);
    return (allowed as readonly string[]).includes(value)
      ? (value as T)
      : fail(`sets "${name}" to "${value}"; it must be one of ${allowed.join(", ")}`);
  };

  const order = Number(field("order"));
  if (!Number.isInteger(order) || order < 0 || order > 32767) {
    fail(`sets "order" to "${field("order")}"; it must be a whole number from 0`);
  }
  const published = field("published");
  if (published !== "true" && published !== "false") {
    fail(`sets "published" to "${published}"; it must be true or false`);
  }
  const bodyMd = `${lines
    .slice(end + 1)
    .join("\n")
    .trim()}\n`;
  if (bodyMd.trim() === "") fail("has no text after its frontmatter");

  return {
    slug,
    title: field("title"),
    kind: oneOf("kind", docKindEnum.enumValues),
    audience: oneOf("audience", docAudienceEnum.enumValues),
    orderIndex: order,
    minRole: oneOf("minRole", roleEnum.enumValues),
    published: published === "true",
    bodyMd,
  };
}
