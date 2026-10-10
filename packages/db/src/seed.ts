import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { type DefaultDoc, loadDefaultDocs } from "./guide-defaults";
import * as schema from "./schema/index";

export interface SeedResult {
  collegeId: string;
  collegeSlug: string;
  docs: DocSyncResult;
}

/**
 * Seeds one college and brings the guide's built-in pages up to date. Safe to run on every
 * deploy. Works against any Drizzle database instance (Neon or PGlite).
 */
export async function seedDatabase(
  // biome-ignore lint/suspicious/noExplicitAny: polymorphic Drizzle database instance (Neon or PGlite)
  db: any,
  options: { docs?: DefaultDoc[] } = {},
): Promise<SeedResult> {
  // 1. Seed exactly one college ("ours") per PLAN.md §1
  // NOTE: This is scaffolding / placeholder seed data.
  // Per PLAN.md §8.2, the admin will enter real data for their own college upon deployment.
  const collegeSlug = "clg-main";
  const [existingCollege] = await db
    .select()
    .from(schema.colleges)
    .where(sql`${schema.colleges.slug} = ${collegeSlug} AND ${schema.colleges.deletedAt} IS NULL`)
    .limit(1);

  let collegeId: string;
  if (existingCollege) {
    collegeId = existingCollege.id;
  } else {
    const [newCollege] = await db
      .insert(schema.colleges)
      .values({
        name: "College of Engineering",
        slug: collegeSlug,
        domain: "clg.edu",
      })
      .returning();
    collegeId = newCollege.id;
  }

  // 2. The guide's built-in pages (seed/docs/*.md).
  const docs = await syncDefaultDocs(db, options.docs ?? loadDefaultDocs());

  return { collegeId, collegeSlug, docs };
}

/** What seeding did to the built-in guide pages, by slug. */
export interface DocSyncResult {
  added: string[];
  updated: string[];
  /** Changed since the seed last wrote it (by an admin), so left as it is. */
  keptEdited: string[];
  removed: string[];
}

/** The note on every revision the seed writes, marking the text as the seed's own. */
export const DEFAULT_REVISION_NOTE = "default";

/**
 * Brings the built-in (platform) pages to `defaults`. A page is the seed's to change only
 * while it still shows text the seed wrote (one of its own revisions, same title and body),
 * or has no revision at all. Once an admin edits it, 0.5-7's editor records a revision with
 * their id and the page keeps their text (PLAN §8.11). A college's own pages are never read.
 *
 * Production has no interactive transactions (RULES R21), so the writes are ordered to be
 * safe if one fails: new text's revision goes in before the page changes, and a page still
 * showing an older text of the seed's is still the seed's, so the next run finishes the job.
 */
// biome-ignore lint/suspicious/noExplicitAny: polymorphic Drizzle database instance (Neon or PGlite)
async function syncDefaultDocs(db: any, defaults: DefaultDoc[]): Promise<DocSyncResult> {
  const result: DocSyncResult = { added: [], updated: [], keptEdited: [], removed: [] };
  const live: schema.Doc[] = await db
    .select()
    .from(schema.docs)
    .where(and(isNull(schema.docs.collegeId), isNull(schema.docs.deletedAt)));
  const revisions: schema.DocRevision[] =
    live.length === 0
      ? []
      : await db
          .select()
          .from(schema.docRevisions)
          .where(
            inArray(
              schema.docRevisions.docId,
              live.map((doc) => doc.id),
            ),
          );
  const revisionsOf = (doc: schema.Doc) => revisions.filter((rev) => rev.docId === doc.id);
  const showsSeedText = (doc: schema.Doc) =>
    revisionsOf(doc).some(
      (rev) =>
        rev.editedBy === null &&
        rev.note === DEFAULT_REVISION_NOTE &&
        rev.title === doc.title &&
        rev.bodyMd === doc.bodyMd,
    );
  const recordDefault = (docId: string, page: DefaultDoc) =>
    db
      .insert(schema.docRevisions)
      .values({ docId, title: page.title, bodyMd: page.bodyMd, note: DEFAULT_REVISION_NOTE });

  for (const page of defaults) {
    const { slug, ...fields } = page;
    const doc = live.find((candidate) => candidate.slug === slug);
    if (!doc) {
      const [created] = await db.insert(schema.docs).values(page).returning();
      await recordDefault(created.id, page);
      result.added.push(slug);
    } else if (!matchesDefault(doc, page)) {
      if (showsSeedText(doc) || revisionsOf(doc).length === 0) {
        await recordDefault(doc.id, page);
        await db.update(schema.docs).set(fields).where(eq(schema.docs.id, doc.id));
        result.updated.push(slug);
      } else {
        result.keptEdited.push(slug);
      }
    }
  }

  // A page the code stopped shipping goes too, unless someone else's text is on it. A page
  // with no revision is left: it was not written by this seed.
  for (const doc of live) {
    if (defaults.some((page) => page.slug === doc.slug)) continue;
    if (showsSeedText(doc)) {
      await db.update(schema.docs).set({ deletedAt: new Date() }).where(eq(schema.docs.id, doc.id));
      result.removed.push(doc.slug);
    } else {
      result.keptEdited.push(doc.slug);
    }
  }
  return result;
}

function matchesDefault(doc: schema.Doc, page: DefaultDoc): boolean {
  return (
    doc.title === page.title &&
    doc.bodyMd === page.bodyMd &&
    doc.kind === page.kind &&
    doc.audience === page.audience &&
    doc.orderIndex === page.orderIndex &&
    doc.minRole === page.minRole &&
    doc.published === page.published
  );
}
