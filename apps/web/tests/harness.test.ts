import { schema, uuidv7 } from "@clg-ess/db";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { ROUTE_PATTERNS, type TestUser, api, seedTwoColleges, testDb } from "./harness";

// Self-test for the boundary harness. A denial assertion is only meaningful if the same
// harness can also get an authorised caller through; otherwise a harness that always
// answers 401 would make every denial test pass vacuously. So each check asserts both.
describe("boundary-test harness", () => {
  let studentA: TestUser;
  let studentB: TestUser;
  let collegeA: schema.College;
  let collegeB: schema.College;

  beforeAll(async () => {
    ({ studentA, studentB, collegeA, collegeB } = await seedTwoColleges());
  });

  it("discovers the real route handlers from the filesystem", () => {
    expect(ROUTE_PATTERNS).toEqual(
      expect.arrayContaining([
        "/api/sync",
        "/api/assets/presign",
        "/api/assets/[id]",
        "/api/assets/[id]/complete",
        "/api/auth/[...all]",
        "/api/internal/tick",
      ]),
    );
  });

  it("rejects an anonymous caller, and lets the same call through with a real session", async () => {
    const itemId = uuidv7();
    await testDb().insert(schema.items).values({
      id: itemId,
      collegeId: collegeA.id,
      userId: studentA.id,
      kind: "todo",
      title: "Harness self-test item",
    });

    const anonymous = await api.get("/api/sync?tables=item");
    expect(anonymous.status).toBe(401);

    const authed = await api.get("/api/sync?tables=item", { as: studentA });
    expect(authed.status).toBe(200);
    expect(authed.body.data.item.map((row: { id: string }) => row.id)).toContain(itemId);
  });

  it("seeds two colleges whose users are bound to their own college", async () => {
    expect(collegeA.id).not.toBe(collegeB.id);
    expect(studentA.cookie).not.toBe(studentB.cookie);

    const [rowA] = await testDb().select().from(schema.user).where(eq(schema.user.id, studentA.id));
    const [rowB] = await testDb().select().from(schema.user).where(eq(schema.user.id, studentB.id));
    expect(rowA?.collegeId).toBe(collegeA.id);
    expect(rowB?.collegeId).toBe(collegeB.id);
  });

  it("resolves each session to its own user and passes dynamic route params", async () => {
    const assetId = uuidv7();
    await testDb()
      .insert(schema.assets)
      .values({
        id: assetId,
        ownerId: studentA.id,
        bucketKey: `users/${studentA.id}/garment_photo/${assetId}.webp`,
        mime: "image/webp",
        bytes: 1024,
        scanStatus: "clean",
      });

    const owner = await api.get(`/api/assets/${assetId}`, { as: studentA });
    expect(owner.status).toBe(200);
    expect(owner.body.asset.id).toBe(assetId);

    expect((await api.get(`/api/assets/${assetId}`, { as: studentB })).status).toBe(403);
    expect((await api.get(`/api/assets/${assetId}`)).status).toBe(401);
  });

  it("throws on a path no route handles, instead of passing a typo'd test vacuously", async () => {
    await expect(api.get("/api/does-not-exist")).rejects.toThrow("no route handler");
  });
});
