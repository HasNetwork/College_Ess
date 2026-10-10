import { deleteObjectFromStorage, storedObjectSize } from "@/lib/assets/storage";
import { getCtx } from "@/lib/ctx";
import { createDbClient, schema } from "@clg-ess/db";
import { and, eq, isNull } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

const db = createDbClient();

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = await getCtx();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const [asset] = await db
    .select()
    .from(schema.assets)
    .where(and(eq(schema.assets.id, id), isNull(schema.assets.deletedAt)))
    .limit(1);

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  if (asset.ownerId !== ctx.userId) {
    return NextResponse.json(
      { error: "Forbidden: cannot complete upload for another user's asset" },
      { status: 403 },
    );
  }

  // What storage holds decides, not what the client said (0.5-3 §3).
  const storedBytes = await storedObjectSize(asset.bucketKey);
  if (storedBytes === null) {
    return NextResponse.json(
      { error: "Uploaded object was not found in storage bucket" },
      { status: 400 },
    );
  }

  // The declared size is what presign checked against the per-purpose cap and the quota.
  // A bigger object skipped both, so it is removed rather than recorded.
  if (storedBytes > asset.bytes) {
    await deleteObjectFromStorage(asset.bucketKey);
    const now = new Date();
    await db
      .update(schema.assets)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(schema.assets.id, id));
    return NextResponse.json(
      {
        error: `Uploaded file is ${storedBytes} bytes, larger than the ${asset.bytes} bytes declared`,
      },
      { status: 400 },
    );
  }

  // `variants` is not read: thumbnails wait for their first screen, Drip's grid (0.5-3 §3).
  // A client-supplied one is an unchecked storage key, possibly another user's.
  let body: { width?: number; height?: number } = {};
  try {
    body = await request.json();
  } catch {
    // Optional body
  }

  const [updated] = await db
    .update(schema.assets)
    .set({
      scanStatus: "clean",
      bytes: storedBytes,
      width: body.width ?? null,
      height: body.height ?? null,
      updatedAt: new Date(),
    })
    .where(eq(schema.assets.id, id))
    .returning();

  return NextResponse.json({
    success: true,
    asset: updated,
  });
}
