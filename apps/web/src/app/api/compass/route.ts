import { getCtx } from "@/lib/ctx";
import { resolveDocFromList } from "@clg-ess/core";
import { createDbClient, schema, scopedDb } from "@clg-ess/db";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const db = createDbClient();

/**
 * The guide, resolved for the caller: a college override wins over the platform default,
 * and each doc needs `published` and a role at or above its `min_role`.
 *
 * Public by design: the guide works signed out. With no session the scope is platform
 * defaults only, read as a student.
 */
export async function GET() {
  const ctx = await getCtx();
  const viewerRole = ctx?.role ?? "student";
  const collegeId = ctx?.collegeId ?? null;

  // scopedDb confines the read to this college's rows and platform defaults, so another
  // college's docs never leave the database.
  const docs = await scopedDb({ collegeId }, db)
    .select()
    .from(schema.docs)
    .where(eq(schema.docs.published, true));

  const slugs = Array.from(new Set(docs.map((doc) => doc.slug)));
  // In the guide's own order, so every screen lists the pages the same way.
  const resolvedDocs = slugs
    .map((slug) => resolveDocFromList(docs, slug, collegeId, viewerRole))
    .filter((doc): doc is NonNullable<typeof doc> => doc !== null)
    .sort((a, b) => a.orderIndex - b.orderIndex || a.title.localeCompare(b.title));

  return NextResponse.json({
    docs: resolvedDocs,
    viewerRole,
    collegeId,
  });
}
