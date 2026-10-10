import { createPresignedViewUrl } from "@/lib/assets/storage";
import { getCtx } from "@/lib/ctx";
import { createDbClient, schema } from "@clg-ess/db";
import { and, eq, isNull } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

const db = createDbClient();

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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

  // Strict ownership check — private by default, a user cannot fetch another user's asset
  if (asset.ownerId !== ctx.userId) {
    return NextResponse.json(
      { error: "Forbidden: cannot view another user's private asset" },
      { status: 403 },
    );
  }

  const viewUrl = await createPresignedViewUrl(asset.bucketKey, 3600);

  return NextResponse.json({
    asset,
    viewUrl,
  });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
      { error: "Forbidden: cannot delete another user's asset" },
      { status: 403 },
    );
  }

  // Soft delete per Rule 3 / sync triple
  await db
    .update(schema.assets)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.assets.id, id));

  return NextResponse.json({ success: true });
}
