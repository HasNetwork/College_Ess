import { createPresignedUploadUrl } from "@/lib/assets/storage";
import {
  USER_STORAGE_QUOTA_BYTES,
  deriveBucketKey,
  getMaxBytesForPurpose,
  isAllowedMimeType,
} from "@/lib/assets/validation";
import { getCtx } from "@/lib/ctx";
import { createDbClient, schema } from "@clg-ess/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { uuidv7 } from "uuidv7";

const db = createDbClient();

export async function POST(request: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { mime?: string; bytes?: number; purpose?: string; bucketKey?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { mime, bytes, purpose } = body;

  if (!mime || typeof mime !== "string") {
    return NextResponse.json({ error: "MIME type is required" }, { status: 400 });
  }

  if (!isAllowedMimeType(mime)) {
    return NextResponse.json({ error: `MIME type '${mime}' is not allowed` }, { status: 400 });
  }

  if (!bytes || typeof bytes !== "number" || bytes <= 0) {
    return NextResponse.json({ error: "Valid file size in bytes is required" }, { status: 400 });
  }

  const maxAllowedBytes = getMaxBytesForPurpose(purpose);
  if (bytes > maxAllowedBytes) {
    return NextResponse.json(
      {
        error: `File size ${bytes} bytes exceeds maximum allowed ${maxAllowedBytes} bytes for purpose '${purpose || "default"}'`,
      },
      { status: 400 },
    );
  }

  // Check user storage quota
  const [quotaResult] = await db
    .select({
      totalBytes: sql<number>`coalesce(sum(${schema.assets.bytes}), 0)::bigint`,
    })
    .from(schema.assets)
    .where(and(eq(schema.assets.ownerId, ctx.userId), isNull(schema.assets.deletedAt)));

  const currentTotal = Number(quotaResult?.totalBytes ?? 0);
  if (currentTotal + bytes > USER_STORAGE_QUOTA_BYTES) {
    return NextResponse.json(
      {
        error: `Upload of ${bytes} bytes would exceed total storage quota of ${USER_STORAGE_QUOTA_BYTES} bytes (current: ${currentTotal} bytes)`,
      },
      { status: 403 },
    );
  }

  // Derive server-controlled bucket_key (ignores any client-supplied bucketKey)
  const bucketKey = deriveBucketKey(ctx.userId, mime, purpose);
  const assetId = uuidv7();

  const [asset] = await db
    .insert(schema.assets)
    .values({
      id: assetId,
      ownerId: ctx.userId,
      bucketKey,
      mime,
      bytes,
      scanStatus: "pending",
    })
    .returning();

  if (!asset) {
    return NextResponse.json({ error: "Failed to create asset record" }, { status: 500 });
  }

  const uploadUrl = await createPresignedUploadUrl(bucketKey, mime, bytes);

  return NextResponse.json({
    assetId: asset.id,
    bucketKey: asset.bucketKey,
    uploadUrl,
  });
}
