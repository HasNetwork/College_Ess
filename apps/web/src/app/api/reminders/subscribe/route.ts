import { getCtx } from "@/lib/ctx";
import { getVapidPublicKey } from "@/lib/reminders";
import { createDbClient, schema } from "@clg-ess/db";
import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";

const db = createDbClient();

// Public by design: the browser needs the VAPID *public* key before it can subscribe.
export async function GET() {
  return NextResponse.json({
    vapidPublicKey: getVapidPublicKey(),
  });
}

export async function POST(request: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
    userAgent?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { endpoint, keys, userAgent } = body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json(
      { error: "Missing required subscription parameters (endpoint, keys.p256dh, keys.auth)" },
      { status: 400 },
    );
  }

  // One statement, so nothing runs between "whose endpoint is this?" and the write. An
  // endpoint registered to another account is never re-parented: knowing someone's endpoint
  // must not move their device, and their reminders, to you. RETURNING is empty then.
  const [saved] = await db
    .insert(schema.pushSubscriptions)
    .values({
      userId: ctx.userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent || null,
    })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: {
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent || null,
        deletedAt: null,
        updatedAt: new Date(),
      },
      setWhere: eq(schema.pushSubscriptions.userId, ctx.userId),
    })
    .returning();

  if (!saved) {
    // A browser that changed accounts should unsubscribe and subscribe again (0.5-3),
    // which gives it a fresh endpoint.
    return NextResponse.json(
      { error: "This device is subscribed under another account" },
      { status: 409 },
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const ctx = await getCtx();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.endpoint) {
    return NextResponse.json({ error: "endpoint is required" }, { status: 400 });
  }

  await db
    .delete(schema.pushSubscriptions)
    .where(
      and(
        eq(schema.pushSubscriptions.endpoint, body.endpoint),
        eq(schema.pushSubscriptions.userId, ctx.userId),
      ),
    );

  return NextResponse.json({ success: true });
}
