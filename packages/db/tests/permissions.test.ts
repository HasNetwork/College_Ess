import { resolve } from "node:path";
import { type Ctx, can } from "@clg-ess/core";
import { PGlite } from "@electric-sql/pglite";
import { eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { uuidv7 } from "uuidv7";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "../src/schema/index";
import { onRoleChange, scopedDb } from "../src/scoped";

describe("Phase 0-4 Permissions & Tenancy Guard Integration Tests", () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let collegeA: schema.College;
  let collegeB: schema.College;
  let userA: schema.User;
  let userB: schema.User;

  beforeAll(async () => {
    const client = new PGlite();
    db = drizzle(client, { schema });

    // Apply migrations from drizzle folder
    const migrationsFolder = resolve(__dirname, "../drizzle");
    await migrate(db, { migrationsFolder });

    // Seed test colleges
    const [c1] = await db
      .insert(schema.colleges)
      .values({ name: "College Alpha", slug: "col-alpha" })
      .returning();
    const [c2] = await db
      .insert(schema.colleges)
      .values({ name: "College Beta", slug: "col-beta" })
      .returning();

    // Seed test users
    const [u1] = await db
      .insert(schema.user)
      .values({
        name: "Student Alpha",
        email: "student@alpha.edu",
        collegeId: c1?.id,
      })
      .returning();
    const [u2] = await db
      .insert(schema.user)
      .values({
        name: "Student Beta",
        email: "student@beta.edu",
        collegeId: c2?.id,
      })
      .returning();

    if (!c1 || !c2 || !u1 || !u2) {
      throw new Error("Failed to seed test colleges and users");
    }
    collegeA = c1;
    collegeB = c2;
    userA = u1;
    userB = u2;
  }, 30000);

  // Success Criterion 1: Migration applies; CHECK constraint rejects both invalid shapes
  describe("1. Grant scope CHECK constraint", () => {
    it("rejects platform grant with a scope_id", async () => {
      await expect(
        db.insert(schema.grants).values({
          userId: userA.id,
          permission: "manage:platform",
          scopeType: "platform",
          scopeId: collegeA.id, // Invalid: platform MUST have null scope_id
        }),
      ).rejects.toThrow();
    });

    it("rejects scoped grant (college) with a null scope_id", async () => {
      await expect(
        db.insert(schema.grants).values({
          userId: userA.id,
          permission: "manage:college",
          scopeType: "college",
          scopeId: null, // Invalid: college MUST have non-null scope_id
        }),
      ).rejects.toThrow();
    });

    it("rejects scoped grant (club) with a null scope_id", async () => {
      await expect(
        db.insert(schema.grants).values({
          userId: userA.id,
          permission: "manage:club",
          scopeType: "club",
          scopeId: null, // Invalid: club MUST have non-null scope_id
        }),
      ).rejects.toThrow();
    });

    it("accepts valid platform grant (scope_id IS NULL)", async () => {
      const [grant] = await db
        .insert(schema.grants)
        .values({
          userId: userA.id,
          permission: "*",
          scopeType: "platform",
          scopeId: null,
        })
        .returning();

      expect(grant?.id).toBeDefined();
      expect(grant?.scopeType).toBe("platform");
      expect(grant?.scopeId).toBeNull();
    });

    it("accepts valid college grant (scope_id IS NOT NULL)", async () => {
      const [grant] = await db
        .insert(schema.grants)
        .values({
          userId: userA.id,
          permission: "manage:college",
          scopeType: "college",
          scopeId: collegeA.id,
        })
        .returning();

      expect(grant?.id).toBeDefined();
      expect(grant?.scopeType).toBe("college");
      expect(grant?.scopeId).toBe(collegeA.id);
    });
  });

  // Success Criterion 2: Student of college A CANNOT read college B's items
  describe("2. Cross-college denial (R4)", () => {
    it("student of college A cannot read college B's items", async () => {
      // Seed item in College A
      const [itemA] = await db
        .insert(schema.items)
        .values({
          collegeId: collegeA.id,
          userId: userA.id,
          kind: "todo",
          title: "College A Todo",
        })
        .returning();

      // Seed item in College B
      const [itemB] = await db
        .insert(schema.items)
        .values({
          collegeId: collegeB.id,
          userId: userB.id,
          kind: "todo",
          title: "College B Todo",
        })
        .returning();

      const ctxA = { collegeId: collegeA.id };
      const itemsForA = await scopedDb(ctxA, db).select().from(schema.items);

      const itemIds = itemsForA.map((i: schema.Item) => i.id);
      expect(itemIds).toContain(itemA?.id);
      expect(itemIds).not.toContain(itemB?.id);
    });
  });

  // Success Criterion 3: Student of college A cannot read college B's items even when passing an explicit college_id for B
  describe("3. Tenancy guard ignores caller-supplied scope", () => {
    it("returns 0 rows when college A student queries explicitly for college B", async () => {
      const ctxA = { collegeId: collegeA.id };

      // Attempt to breach tenancy by explicitly filtering for College B
      const breachAttempt = await scopedDb(ctxA, db)
        .select()
        .from(schema.items)
        .where(eq(schema.items.collegeId, collegeB.id));

      expect(breachAttempt.length).toBe(0);
    });
  });

  // Success Criterion 4: Co-admin scoped to club X cannot manage club Y
  describe("4. Co-admin club scope isolation", () => {
    it("co-admin of club X cannot manage club Y", () => {
      const clubX = uuidv7();
      const clubY = uuidv7();

      const ctx: Ctx = {
        userId: userA.id,
        collegeId: collegeA.id,
        role: "co_admin",
        grants: [
          {
            userId: userA.id,
            permission: "manage:club",
            scopeType: "club",
            scopeId: clubX,
          },
        ],
        userMode: false,
      };

      expect(can(ctx, "manage:club", { type: "club", id: clubX })).toBe(true);
      expect(can(ctx, "manage:club", { type: "club", id: clubY })).toBe(false);
    });
  });

  // Success Criterion 5: Co-admin of college A cannot manage a club belonging to college B
  describe("5. College-scoped grant cannot manage club in another college", () => {
    it("denies college A admin from managing club belonging to college B", () => {
      const clubInA = uuidv7();
      const clubInB = uuidv7();

      const resolver = (clubId: string) => {
        if (clubId === clubInA) return collegeA.id;
        if (clubId === clubInB) return collegeB.id;
        return null;
      };

      const ctx: Ctx = {
        userId: userA.id,
        collegeId: collegeA.id,
        role: "college_admin",
        grants: [
          {
            userId: userA.id,
            permission: "manage:club",
            scopeType: "college",
            scopeId: collegeA.id,
          },
        ],
        userMode: false,
      };

      expect(
        can(ctx, "manage:club", { type: "club", id: clubInA }, { resolveClubCollege: resolver }),
      ).toBe(true);
      expect(
        can(ctx, "manage:club", { type: "club", id: clubInB }, { resolveClubCollege: resolver }),
      ).toBe(false);
    });
  });

  // Success Criterion 6: Expired grant does not authorise
  describe("6. Expired grant denial", () => {
    it("denies access when grant is expired", () => {
      const clubX = uuidv7();
      const ctx: Ctx = {
        userId: userA.id,
        collegeId: collegeA.id,
        role: "co_admin",
        grants: [
          {
            userId: userA.id,
            permission: "manage:club",
            scopeType: "club",
            scopeId: clubX,
            expiresAt: new Date(Date.now() - 1000 * 60), // expired 1m ago
          },
        ],
        userMode: false,
      };

      expect(can(ctx, "manage:club", { type: "club", id: clubX })).toBe(false);
    });
  });

  // Success Criterion 7: Soft-deleted grant does not authorise
  describe("7. Soft-deleted grant denial", () => {
    it("denies access when grant is soft-deleted", () => {
      const clubX = uuidv7();
      const ctx: Ctx = {
        userId: userA.id,
        collegeId: collegeA.id,
        role: "co_admin",
        grants: [
          {
            userId: userA.id,
            permission: "manage:club",
            scopeType: "club",
            scopeId: clubX,
            deletedAt: new Date(),
          },
        ],
        userMode: false,
      };

      expect(can(ctx, "manage:club", { type: "club", id: clubX })).toBe(false);
    });
  });

  // Success Criterion 8: userMode: true denies an action the same user may perform with it off
  describe("8. userMode denial", () => {
    it("denies administrative actions when userMode is active", () => {
      const grant: schema.Grant = {
        id: uuidv7(),
        userId: userA.id,
        permission: "manage:college",
        scopeType: "college",
        scopeId: collegeA.id,
        grantedBy: null,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const ctxNormal: Ctx = {
        userId: userA.id,
        collegeId: collegeA.id,
        role: "college_admin",
        grants: [grant],
        userMode: false,
      };

      const ctxUserMode: Ctx = {
        ...ctxNormal,
        userMode: true,
      };

      expect(can(ctxNormal, "manage:college", { type: "college", id: collegeA.id })).toBe(true);
      expect(can(ctxUserMode, "manage:college", { type: "college", id: collegeA.id })).toBe(false);
    });
  });

  // Success Criterion 9: Platform-default rows (college_id IS NULL) are readable by every college
  describe("9. Platform default visibility", () => {
    it("allows both college A and college B to read platform default rows", async () => {
      // Insert platform-default item (college_id is null)
      const [platformItem] = await db
        .insert(schema.items)
        .values({
          collegeId: null, // Platform default
          userId: userA.id,
          kind: "holiday",
          title: "National Holiday",
        })
        .returning();

      const itemsForA = await scopedDb({ collegeId: collegeA.id }, db).select().from(schema.items);
      const itemsForB = await scopedDb({ collegeId: collegeB.id }, db).select().from(schema.items);

      const idsA = itemsForA.map((i: schema.Item) => i.id);
      const idsB = itemsForB.map((i: schema.Item) => i.id);

      expect(idsA).toContain(platformItem?.id);
      expect(idsB).toContain(platformItem?.id);
    });
  });

  // Success Criterion 10: can() never throws for an unknown permission string; returns false
  describe("10. can() safety with unknown permissions", () => {
    it("returns false and never throws for arbitrary unknown permission strings", () => {
      const ctx: Ctx = {
        userId: userA.id,
        collegeId: collegeA.id,
        role: "student",
        grants: [],
        userMode: false,
      };

      expect(() =>
        can(ctx, "nonexistent:verb", { type: "college", id: collegeA.id }),
      ).not.toThrow();
      expect(can(ctx, "nonexistent:verb", { type: "college", id: collegeA.id })).toBe(false);
    });
  });

  // Success Criterion 11: Auto-grant mechanism onRoleChange
  describe("11. Auto-grant onRoleChange", () => {
    it("issues grant on promotion to co_admin and revokes on demotion to student", async () => {
      const clubId = uuidv7();

      // 1. Promote to co_admin for a club
      await onRoleChange(db, {
        subject: userA.id,
        scopeType: "club",
        scopeId: clubId,
        newRole: "co_admin",
      });

      // Verify grant was inserted
      const activeGrants = await db
        .select()
        .from(schema.grants)
        .where(eq(schema.grants.userId, userA.id));

      const clubGrant = activeGrants.find(
        (g: schema.Grant) =>
          g.permission === "manage:club" &&
          g.scopeType === "club" &&
          g.scopeId === clubId &&
          !g.deletedAt,
      );
      expect(clubGrant).toBeDefined();

      // 2. Demote back to student
      await onRoleChange(db, {
        subject: userA.id,
        scopeType: "club",
        scopeId: clubId,
        newRole: "student",
      });

      // Verify grant was soft-deleted
      const activeGrantsAfterDemote = await db
        .select()
        .from(schema.grants)
        .where(eq(schema.grants.userId, userA.id));

      const activeClubGrant = activeGrantsAfterDemote.find(
        (g: schema.Grant) =>
          g.permission === "manage:club" &&
          g.scopeType === "club" &&
          g.scopeId === clubId &&
          !g.deletedAt,
      );
      expect(activeClubGrant).toBeUndefined();
    });
  });
});
