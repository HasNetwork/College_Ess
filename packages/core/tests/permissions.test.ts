import { describe, expect, it } from "vitest";
import {
  type Ctx,
  type GrantRecord,
  can,
  computeGrantsForRole,
  isGrantActive,
} from "../src/permissions";

describe("permissions logic (can)", () => {
  const userId = "user-123";
  const collegeA = "college-a";
  const collegeB = "college-b";
  const clubX = "club-x";
  const clubY = "club-y";

  const mockClubResolver = (clubId: string) => {
    if (clubId === clubX) return collegeA;
    if (clubId === clubY) return collegeB;
    return null;
  };

  it("platform_admin with platform-scoped grant passes everything", () => {
    const ctx: Ctx = {
      userId,
      collegeId: null,
      role: "platform_admin",
      grants: [
        {
          userId,
          permission: "*",
          scopeType: "platform",
          scopeId: null,
        },
      ],
      userMode: false,
    };

    expect(can(ctx, "manage:club", { type: "club", id: clubX })).toBe(true);
    expect(can(ctx, "manage:college", { type: "college", id: collegeA })).toBe(true);
    expect(can(ctx, "any:arbitrary:permission", { type: "platform" })).toBe(true);
  });

  it("platform_admin without platform grant does not pass arbitrary checks", () => {
    const ctx: Ctx = {
      userId,
      collegeId: null,
      role: "platform_admin",
      grants: [], // No grants (Authority is a grant row or it does not exist)
      userMode: false,
    };

    expect(can(ctx, "manage:club", { type: "club", id: clubX })).toBe(false);
  });

  it("userMode: true denies an action the same user may perform with it off", () => {
    const grant: GrantRecord = {
      userId,
      permission: "manage:college",
      scopeType: "college",
      scopeId: collegeA,
    };

    const ctxAdmin: Ctx = {
      userId,
      collegeId: collegeA,
      role: "college_admin",
      grants: [grant],
      userMode: false,
    };

    const ctxUserMode: Ctx = {
      ...ctxAdmin,
      userMode: true, // admin browsing as an ordinary student
    };

    expect(can(ctxAdmin, "manage:college", { type: "college", id: collegeA })).toBe(true);
    expect(can(ctxUserMode, "manage:college", { type: "college", id: collegeA })).toBe(false);
  });

  it("co-admin scoped to club X can manage club X but CANNOT manage club Y", () => {
    const ctx: Ctx = {
      userId,
      collegeId: collegeA,
      role: "co_admin",
      grants: [
        {
          userId,
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

  it("college-scoped grant implies authority over clubs within that college", () => {
    const ctx: Ctx = {
      userId,
      collegeId: collegeA,
      role: "college_admin",
      grants: [
        {
          userId,
          permission: "manage:club",
          scopeType: "college",
          scopeId: collegeA,
        },
      ],
      userMode: false,
    };

    // Club X belongs to College A -> allowed
    expect(
      can(
        ctx,
        "manage:club",
        { type: "club", id: clubX },
        { resolveClubCollege: mockClubResolver },
      ),
    ).toBe(true);

    // Club Y belongs to College B -> DENIED
    expect(
      can(
        ctx,
        "manage:club",
        { type: "club", id: clubY },
        { resolveClubCollege: mockClubResolver },
      ),
    ).toBe(false);
  });

  it("expired grant does not authorise", () => {
    const past = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
    const ctx: Ctx = {
      userId,
      collegeId: collegeA,
      role: "co_admin",
      grants: [
        {
          userId,
          permission: "manage:club",
          scopeType: "club",
          scopeId: clubX,
          expiresAt: past,
        },
      ],
      userMode: false,
    };

    expect(can(ctx, "manage:club", { type: "club", id: clubX })).toBe(false);
  });

  it("soft-deleted grant does not authorise", () => {
    const ctx: Ctx = {
      userId,
      collegeId: collegeA,
      role: "co_admin",
      grants: [
        {
          userId,
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

  it("can() never throws for unknown permission string or malformed input; returns false", () => {
    const ctx: Ctx = {
      userId,
      collegeId: collegeA,
      role: "student",
      grants: [],
      userMode: false,
    };

    expect(() => can(ctx, "unknown:permission", { type: "college", id: collegeA })).not.toThrow();
    expect(can(ctx, "unknown:permission", { type: "college", id: collegeA })).toBe(false);

    // Malformed inputs
    expect(can(null, "manage:club", { type: "club", id: clubX })).toBe(false);
    expect(can(undefined, "manage:club", { type: "club", id: clubX })).toBe(false);
    // @ts-expect-error test invalid permission type
    expect(can(ctx, 123, { type: "club", id: clubX })).toBe(false);
    // @ts-expect-error test invalid scope
    expect(can(ctx, "manage:club", null)).toBe(false);
  });
});

describe("isGrantActive", () => {
  it("returns true for active grant with no expiration or future expiration", () => {
    expect(
      isGrantActive({
        userId: "u1",
        permission: "p",
        scopeType: "club",
        scopeId: "c1",
      }),
    ).toBe(true);

    expect(
      isGrantActive({
        userId: "u1",
        permission: "p",
        scopeType: "club",
        scopeId: "c1",
        expiresAt: new Date(Date.now() + 100000),
      }),
    ).toBe(true);
  });

  it("returns false for expired or soft-deleted grant", () => {
    expect(
      isGrantActive({
        userId: "u1",
        permission: "p",
        scopeType: "club",
        scopeId: "c1",
        expiresAt: new Date(Date.now() - 1000),
      }),
    ).toBe(false);

    expect(
      isGrantActive({
        userId: "u1",
        permission: "p",
        scopeType: "club",
        scopeId: "c1",
        deletedAt: new Date(),
      }),
    ).toBe(false);
  });
});

describe("computeGrantsForRole", () => {
  it("computes default grants based on role", () => {
    expect(
      computeGrantsForRole({
        subject: "u1",
        scopeType: "platform",
        scopeId: null,
        newRole: "platform_admin",
      }),
    ).toEqual([
      {
        userId: "u1",
        permission: "*",
        scopeType: "platform",
        scopeId: null,
        grantedBy: null,
      },
    ]);

    expect(
      computeGrantsForRole({
        subject: "u2",
        scopeType: "college",
        scopeId: "col-1",
        newRole: "college_admin",
      }),
    ).toEqual([
      {
        userId: "u2",
        permission: "manage:college",
        scopeType: "college",
        scopeId: "col-1",
        grantedBy: null,
      },
    ]);

    expect(
      computeGrantsForRole({
        subject: "u3",
        scopeType: "club",
        scopeId: "club-1",
        newRole: "co_admin",
      }),
    ).toEqual([
      {
        userId: "u3",
        permission: "manage:club",
        scopeType: "club",
        scopeId: "club-1",
        grantedBy: null,
      },
    ]);

    expect(
      computeGrantsForRole({
        subject: "u4",
        scopeType: "college",
        scopeId: "col-1",
        newRole: "student",
      }),
    ).toEqual([]);
  });
});
