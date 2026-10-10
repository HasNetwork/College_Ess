import type { UserRole } from "@clg-ess/core";
import { schema, uuidv7 } from "@clg-ess/db";
import { beforeAll, describe, expect, it } from "vitest";
import { type TestUser, api, createUser, seedTwoColleges, testDb } from "./harness";

// The guide's audience rules, through GET /api/compass with real sessions. Before 0.5-2 the
// route read `role` and `collegeId` off an undeclared session field, so every viewer was a
// collegeless student: the co-admin handbook was invisible to everyone, and no college
// ever saw its own override.

async function insertDoc(values: {
  slug: string;
  title: string;
  collegeId?: string | null;
  minRole?: UserRole;
  published?: boolean;
}) {
  await testDb()
    .insert(schema.docs)
    .values({ collegeId: null, bodyMd: `# ${values.title}`, ...values });
}

const titleOf = (docs: Array<{ slug: string; title: string }>, slug: string) =>
  docs.find((doc) => doc.slug === slug)?.title;

describe("GET /api/compass", () => {
  let studentA: TestUser;
  let studentB: TestUser;
  let coAdminA: TestUser;
  let collegeA: schema.College;
  let collegeB: schema.College;

  beforeAll(async () => {
    ({ studentA, studentB, collegeA, collegeB } = await seedTwoColleges());
    coAdminA = await createUser(collegeA.id, "Co-admin A", "co_admin");
  });

  it("shows a co-admin doc to a co-admin and hides it from a student", async () => {
    const slug = `handbook-${uuidv7()}`;
    await insertDoc({ slug, title: "Coordinator handbook", minRole: "co_admin" });

    const asCoAdmin = await api.get("/api/compass", { as: coAdminA });
    const asStudent = await api.get("/api/compass", { as: studentA });

    expect(asCoAdmin.body.viewerRole).toBe("co_admin");
    expect(asCoAdmin.body.collegeId).toBe(collegeA.id);
    expect(titleOf(asCoAdmin.body.docs, slug)).toBe("Coordinator handbook");
    expect(asStudent.body.viewerRole).toBe("student");
    expect(titleOf(asStudent.body.docs, slug)).toBeUndefined();
  });

  it("never shows an unpublished doc, whatever your role", async () => {
    const slug = `draft-${uuidv7()}`;
    await insertDoc({ slug, title: "Draft", published: false });
    const owner = await createUser(collegeA.id, "Platform owner", "platform_admin");

    const res = await api.get("/api/compass", { as: owner });

    expect(res.status).toBe(200);
    expect(titleOf(res.body.docs, slug)).toBeUndefined();
  });

  it("gives each college its own override, and ignores a college id in the query", async () => {
    const slug = `library-${uuidv7()}`;
    await insertDoc({ slug, title: "Platform library hours" });
    await insertDoc({ slug, title: "Alpha library hours", collegeId: collegeA.id });
    await insertDoc({ slug, title: "Beta library hours", collegeId: collegeB.id });

    const asA = await api.get("/api/compass", { as: studentA });
    const asB = await api.get("/api/compass", { as: studentB });
    const asAAskingForB = await api.get(
      `/api/compass?collegeId=${collegeB.id}&college_id=${collegeB.id}`,
      { as: studentA },
    );

    expect(titleOf(asA.body.docs, slug)).toBe("Alpha library hours");
    expect(titleOf(asB.body.docs, slug)).toBe("Beta library hours");
    // The scope comes from the session, never from the request.
    expect(titleOf(asAAskingForB.body.docs, slug)).toBe("Alpha library hours");
  });

  it("gives a signed-out visitor the public guide only", async () => {
    // Public by design: the guide works signed out. That means platform defaults at
    // student level, and nothing a college or a role has restricted.
    const publicSlug = `welcome-${uuidv7()}`;
    const overridden = `rules-${uuidv7()}`;
    const restricted = `handbook-${uuidv7()}`;
    await insertDoc({ slug: publicSlug, title: "Welcome" });
    await insertDoc({ slug: overridden, title: "Platform rules" });
    await insertDoc({ slug: overridden, title: "Alpha rules", collegeId: collegeA.id });
    await insertDoc({ slug: restricted, title: "Coordinator handbook", minRole: "co_admin" });

    const res = await api.get("/api/compass");

    expect(res.status).toBe(200);
    expect(res.body.viewerRole).toBe("student");
    expect(res.body.collegeId).toBeNull();
    expect(titleOf(res.body.docs, publicSlug)).toBe("Welcome");
    expect(titleOf(res.body.docs, overridden)).toBe("Platform rules");
    expect(titleOf(res.body.docs, restricted)).toBeUndefined();
  });
});
