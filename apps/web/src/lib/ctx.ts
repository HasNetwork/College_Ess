import { auth } from "@/lib/auth";
import type { Ctx } from "@clg-ess/core";
import { createDbClient, schema } from "@clg-ess/db";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { headers } from "next/headers";

const db = createDbClient();

/**
 * The request context (PLAN 0-4 §2), resolved once per request from the session. Every
 * route authorises from this, never from anything the caller sent: the college, role and
 * grants all come from the server's own rows. `null` means an anonymous caller.
 */
export async function getCtx(): Promise<Ctx | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const now = new Date();
  const grants = await db
    .select()
    .from(schema.grants)
    .where(
      and(
        eq(schema.grants.userId, session.user.id),
        isNull(schema.grants.deletedAt),
        or(isNull(schema.grants.expiresAt), gt(schema.grants.expiresAt, now)),
      ),
    );

  return {
    userId: session.user.id,
    collegeId: session.user.collegeId ?? null,
    role: session.user.role,
    grants,
    // "View as student" is a Phase 4 admin-panel toggle; nothing stores it yet. When it
    // lands, it must also collapse `role` to student (0-4 §3 rule 4).
    userMode: false,
  };
}
