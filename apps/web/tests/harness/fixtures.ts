import type { UserRole } from "@clg-ess/core";
import { createDbClient, onRoleChange, schema, uuidv7 } from "@clg-ess/db";
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { vi } from "vitest";
import { auth } from "../../src/lib/auth";
import type { AuthenticatedAs } from "./client";

export interface TestUser extends AuthenticatedAs {
  id: string;
  email: string;
  collegeId: string | null;
  role: UserRole;
}

/** The same in-memory PGlite the route handlers use (one singleton per test process). */
export function testDb() {
  return createDbClient();
}

export async function createCollege(label: string): Promise<schema.College> {
  const [college] = await testDb()
    .insert(schema.colleges)
    .values({
      name: `${label} College`,
      // Unique per call, so tests sharing one database never collide on the slug.
      slug: `${label}-${uuidv7()}`,
      domain: `${label}.test`,
    })
    .returning();
  if (!college) throw new Error(`harness: failed to create college ${label}`);
  return college;
}

/**
 * Signs a user up through the real Better Auth API, so the cookie is a genuinely signed
 * session that routes validate for real. `college_id` and `role` are then set directly:
 * both are server-owned, so sign-up refuses them (`input: false` in lib/auth.ts).
 */
export async function createUser(
  collegeId: string | null,
  name = "Test Student",
  role: UserRole = "student",
): Promise<TestUser> {
  const email = `${uuidv7()}@users.test`;
  const { headers, response } = await auth.api.signUpEmail({
    body: { email, password: `pw-${uuidv7()}`, name },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((setCookie) => setCookie.split(";")[0])
    .join("; ");
  if (!cookie.includes("session_token")) {
    throw new Error("harness: sign-up returned no session cookie");
  }

  await testDb()
    .update(schema.user)
    .set({ collegeId, role })
    .where(eq(schema.user.id, response.user.id));
  return { id: response.user.id, email, collegeId, role, cookie };
}

/**
 * A college admin made the way production makes one: the role on the user row plus the
 * grant onRoleChange issues. The role alone authorises nothing; can() needs the grant.
 */
export async function createCollegeAdmin(college: schema.College): Promise<TestUser> {
  const admin = await createUser(college.id, "College Admin", "college_admin");
  await onRoleChange(testDb(), {
    subject: admin.id,
    scopeType: "college",
    scopeId: college.id,
    newRole: "college_admin",
  });
  return admin;
}

/**
 * Makes the route's own database fail every statement whose parameters contain `marker`,
 * the way a dropped connection does (SQLSTATE 57P01), while every other statement runs.
 * Undone after the test (`restoreMocks`). The route code itself runs unchanged.
 */
export function failStatementsContaining(marker: string): void {
  const pglite = (globalThis as { __clg_ess_pglite__?: PGlite }).__clg_ess_pglite__;
  if (!pglite) throw new Error("harness: the route's PGlite is not running yet");
  const query = pglite.query.bind(pglite);
  vi.spyOn(pglite, "query").mockImplementation(async (sql, params, options) => {
    if (JSON.stringify(params ?? []).includes(marker)) {
      throw Object.assign(new Error("terminating connection"), { code: "57P01" });
    }
    return query(sql, params, options);
  });
}

/** Two colleges with one student each: the fixture for every cross-tenant assertion. */
export async function seedTwoColleges() {
  const collegeA = await createCollege("alpha");
  const collegeB = await createCollege("beta");
  return {
    collegeA,
    collegeB,
    studentA: await createUser(collegeA.id, "Student A"),
    studentB: await createUser(collegeB.id, "Student B"),
  };
}
