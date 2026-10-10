import { createHash, timingSafeEqual } from "node:crypto";
import { reapOrphanedAssets } from "@/lib/assets/reaper";
import { processReminderTick } from "@/lib/reminders";
import { createDbClient, requireEnv } from "@clg-ess/db";
import { type NextRequest, NextResponse } from "next/server";

const db = createDbClient();

// Digests are fixed-length, so timingSafeEqual never throws and length does not leak.
function secretMatches(provided: string, expected: string): boolean {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

export async function POST(req: NextRequest) {
  // Validate shared secret (PLAN 0-8 §1). Always runs: no secret configured is a crash,
  // never a skipped check (RULES R18).
  const tickSecret = requireEnv("TICK_SECRET");
  const headerSecret =
    req.headers.get("x-tick-secret") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";

  if (!secretMatches(headerSecret, tickSecret)) {
    return NextResponse.json({ error: "Unauthorized: invalid tick secret" }, { status: 401 });
  }

  try {
    const now = new Date();
    const result = await processReminderTick({ db, now });

    // The orphan reaper keeps abandoned and deleted uploads from filling the bucket (PLAN
    // §2.4). It rides this tick, the only minute-level trigger (R1, R7), once an hour. It
    // runs after the reminders so a storage failure can't hold one back, and nothing catches
    // that failure here: it fails the tick, where the logs show it (0.5-3 §6).
    const reaped = now.getUTCMinutes() === 0 ? await reapOrphanedAssets(db) : null;

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      ...result,
      reaped,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[Tick API] Error executing reminder tick:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error processing tick" },
      { status: 500 },
    );
  }
}
