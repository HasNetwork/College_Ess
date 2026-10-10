import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { type DefaultDoc, loadDefaultDocs, parseDefaultDoc } from "../src/guide-defaults";
import * as schema from "../src/schema/index";
import { seedDatabase } from "../src/seed";

// The guide's built-in pages ship as `seed/docs/*.md` (0.5-5). The seed that runs with a
// deploy brings their new text to a site, except to a page an admin has changed: once an
// admin edits a page, their words win (PLAN §8.11). Every write the seed makes records a
// revision, which is how it tells its own text from an admin's.

async function freshDb() {
  const db = drizzle(new PGlite(), { schema });
  await migrate(db, { migrationsFolder: resolve(__dirname, "../drizzle") });
  return db;
}
type Db = Awaited<ReturnType<typeof freshDb>>;

const page = (slug: string, bodyMd: string, extra: Partial<DefaultDoc> = {}): DefaultDoc => ({
  slug,
  title: `About ${slug}`,
  kind: "guide",
  audience: "user",
  orderIndex: 0,
  minRole: "student",
  published: true,
  bodyMd,
  ...extra,
});

async function platformPage(db: Db, slug: string) {
  const [doc] = await db
    .select()
    .from(schema.docs)
    .where(
      and(isNull(schema.docs.collegeId), eq(schema.docs.slug, slug), isNull(schema.docs.deletedAt)),
    );
  return doc;
}

/** What 0.5-7's editor will do: change the page and record who did it. */
async function editAsAdmin(db: Db, slug: string, bodyMd: string, note = "Fixed") {
  const doc = await platformPage(db, slug);
  if (!doc) throw new Error(`no page ${slug}`);
  const [admin] = await db
    .insert(schema.user)
    .values({ name: "Admin", email: `admin-${slug}-${Date.now()}@clg.edu` })
    .returning();
  await db.update(schema.docs).set({ bodyMd }).where(eq(schema.docs.id, doc.id));
  await db
    .insert(schema.docRevisions)
    .values({ docId: doc.id, title: doc.title, bodyMd, editedBy: admin?.id, note });
}

describe("the guide's default pages (seed/docs)", () => {
  it("all parse, with unique slugs, and each FAQ page is one question", () => {
    const docs = loadDefaultDocs();
    expect(docs.length).toBeGreaterThan(5);
    expect(new Set(docs.map((doc) => doc.slug)).size).toBe(docs.length);
    // The FAQ shows a page's title as the question and its body as the answer, so a heading
    // inside an answer is a second question hidden in the first (0.5-5 §6).
    for (const faq of docs.filter((doc) => doc.kind === "faq")) {
      expect(faq.bodyMd, faq.slug).not.toMatch(/^#/m);
    }
    expect(docs.filter((doc) => doc.kind === "faq").length).toBeGreaterThan(1);
  });

  it("refuses a page it can't read, naming the file", () => {
    expect(() => parseDefaultDoc("broken", "# No frontmatter\n")).toThrow(/broken\.md/);
    const missing =
      "---\ntitle: T\nkind: guide\naudience: user\norder: 0\npublished: true\n---\nBody\n";
    expect(() => parseDefaultDoc("x", missing)).toThrow(/minRole/);
    const badKind = missing
      .replace("published", "minRole: student\npublished")
      .replace("guide", "blog");
    expect(() => parseDefaultDoc("x", badKind)).toThrow(/kind/);
    // A Windows checkout (core.autocrlf) turns the file's line endings into CRLF.
    const crlf = badKind.replace("blog", "guide").replaceAll("\n", "\r\n");
    expect(parseDefaultDoc("x", crlf).bodyMd).toBe("Body\n");
  });
});

describe("seeding the guide", () => {
  it("adds every page on a fresh install, each with the revision that marks it as ours", async () => {
    const db = await freshDb();
    const result = await seedDatabase(db, { docs: [page("a", "A1"), page("b", "B1")] });

    expect(result.docs.added.sort()).toEqual(["a", "b"]);
    const a = await platformPage(db, "a");
    const revisions = await db
      .select()
      .from(schema.docRevisions)
      .where(eq(schema.docRevisions.docId, a?.id ?? ""));
    expect(revisions).toMatchObject([{ bodyMd: "A1", editedBy: null }]);
  }, 30000);

  it("changes nothing when nothing changed", async () => {
    const db = await freshDb();
    await seedDatabase(db, { docs: [page("a", "A1")] });
    const again = await seedDatabase(db, { docs: [page("a", "A1")] });

    expect(again.docs).toEqual({ added: [], updated: [], keptEdited: [], removed: [] });
  }, 30000);

  // Before 0.5-5 the seed only ever inserted: a fixed page reached new installs, never a
  // running site, so the FAQ's wrong answer could not be corrected by deploying.
  it("brings a new default to a page no admin has edited", async () => {
    const db = await freshDb();
    await seedDatabase(db, { docs: [page("a", "A1")] });
    const result = await seedDatabase(db, { docs: [page("a", "A2", { title: "New title" })] });

    expect(result.docs.updated).toEqual(["a"]);
    expect(await platformPage(db, "a")).toMatchObject({ bodyMd: "A2", title: "New title" });
  }, 30000);

  it("keeps an admin's edit when the default changes", async () => {
    const db = await freshDb();
    await seedDatabase(db, { docs: [page("a", "A1")] });
    await editAsAdmin(db, "a", "Our college's version");
    const result = await seedDatabase(db, { docs: [page("a", "A2")] });

    expect(result.docs.keptEdited).toEqual(["a"]);
    expect(await platformPage(db, "a")).toMatchObject({ bodyMd: "Our college's version" });
  }, 30000);

  // What marks the seed's own text is who wrote it, not what the note says.
  it("keeps an admin's edit whatever note they left", async () => {
    const db = await freshDb();
    await seedDatabase(db, { docs: [page("a", "A1")] });
    await editAsAdmin(db, "a", "Mine", "default");
    const result = await seedDatabase(db, { docs: [page("a", "A2")] });

    expect(result.docs.keptEdited).toEqual(["a"]);
    expect(await platformPage(db, "a")).toMatchObject({ bodyMd: "Mine" });
  }, 30000);

  // `doc_revision.edited_by` is ON DELETE SET NULL: a co-admin who leaves takes their name off
  // their edits, not their edits off the page.
  it("keeps an admin's edit after their account is gone", async () => {
    const db = await freshDb();
    await seedDatabase(db, { docs: [page("a", "A1")] });
    await editAsAdmin(db, "a", "Written by someone who left");
    await db.delete(schema.user);
    const result = await seedDatabase(db, { docs: [page("a", "A2")] });

    expect(result.docs.keptEdited).toEqual(["a"]);
    expect(await platformPage(db, "a")).toMatchObject({ bodyMd: "Written by someone who left" });
  }, 30000);

  it("removes a page the code no longer ships, unless an admin edited it", async () => {
    const db = await freshDb();
    await seedDatabase(db, { docs: [page("a", "A1"), page("b", "B1"), page("c", "C1")] });
    await editAsAdmin(db, "c", "Edited");
    const result = await seedDatabase(db, { docs: [page("a", "A1")] });

    expect(result.docs.removed).toEqual(["b"]);
    expect(await platformPage(db, "b")).toBeUndefined();
    expect(await platformPage(db, "c")).toMatchObject({ bodyMd: "Edited" });
  }, 30000);

  it("never touches a college's own version of a page", async () => {
    const db = await freshDb();
    await seedDatabase(db, { docs: [page("a", "A1")] });
    const [college] = await db
      .insert(schema.colleges)
      .values({ name: "Other", slug: "other", domain: "other.edu" })
      .returning();
    await db.insert(schema.docs).values({ ...page("a", "Their version"), collegeId: college?.id });
    await seedDatabase(db, { docs: [page("a", "A2")] });

    const [theirs] = await db
      .select()
      .from(schema.docs)
      .where(eq(schema.docs.collegeId, college?.id ?? ""));
    expect(theirs?.bodyMd).toBe("Their version");
  }, 30000);
});
