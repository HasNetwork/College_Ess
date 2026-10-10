import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { uuidv7 } from "uuidv7";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "../src/schema/index";
import { onRoleChange } from "../src/scoped";

// Postgres treats NULLs as distinct in a unique index, so an index over
// (college_id, slug) or (…, scope_id) enforces nothing for exactly the rows whose scope
// is NULL: platform-default docs and platform grants (0.5-2 §2). These run the shipping
// migrations, because the index is the artifact under test (R10.1). Nothing reaches these
// tables over HTTP: the seed CLI writes platform docs and onRoleChange writes grants.
describe("uniqueness holds when the scope is NULL", () => {
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let college: schema.College;
  let admin: schema.User;

  beforeAll(async () => {
    db = drizzle(new PGlite(), { schema });
    await migrate(db, { migrationsFolder: resolve(__dirname, "../drizzle") });
    const [c] = await db.insert(schema.colleges).values({ name: "C", slug: "c" }).returning();
    const [u] = await db
      .insert(schema.user)
      .values({ name: "Admin", email: "admin@c.test", collegeId: c?.id })
      .returning();
    if (!c || !u) throw new Error("failed to seed");
    college = c;
    admin = u;
  }, 30000);

  const platformDoc = (slug: string) => ({
    collegeId: null,
    slug,
    title: slug,
    bodyMd: `# ${slug}`,
  });

  it("rejects a second live platform doc with the same slug", async () => {
    // Two defaults for one slug would make resolution depend on row order.
    await db.insert(schema.docs).values(platformDoc("getting-started"));
    await expect(db.insert(schema.docs).values(platformDoc("getting-started"))).rejects.toThrow();
  });

  it("still allows a college override, and a replacement once the old default is deleted", async () => {
    await db.insert(schema.docs).values(platformDoc("faq"));
    // The override shares the slug by design: it is what resolution prefers.
    await db.insert(schema.docs).values({ ...platformDoc("faq"), collegeId: college.id });
    await db
      .update(schema.docs)
      .set({ deletedAt: new Date() })
      .where(and(eq(schema.docs.slug, "faq"), isNull(schema.docs.collegeId)));
    await db.insert(schema.docs).values(platformDoc("faq"));

    const live = await db
      .select()
      .from(schema.docs)
      .where(and(eq(schema.docs.slug, "faq"), isNull(schema.docs.deletedAt)));
    expect(live).toHaveLength(2);
  });

  it("rejects a second identical platform grant", async () => {
    const grant = {
      userId: admin.id,
      permission: "manage:college",
      scopeType: "platform" as const,
      scopeId: null,
    };
    await db.insert(schema.grants).values(grant);
    await expect(db.insert(schema.grants).values(grant)).rejects.toThrow();
  });

  it("keeps onRoleChange idempotent for a platform admin", async () => {
    // onRoleChange relies on onConflictDoNothing. Without a conflict to hit, promoting the
    // same user twice stacked a second "*" grant, and every promotion added another.
    const subject = (
      await db
        .insert(schema.user)
        .values({ name: "Owner", email: `${uuidv7()}@c.test` })
        .returning()
    )[0];
    if (!subject) throw new Error("failed to seed");
    const promote = () =>
      onRoleChange(db, {
        subject: subject.id,
        scopeType: "platform",
        scopeId: null,
        newRole: "platform_admin",
      });

    await promote();
    await promote();

    const active = await db
      .select()
      .from(schema.grants)
      .where(and(eq(schema.grants.userId, subject.id), isNull(schema.grants.deletedAt)));
    expect(active.map((g) => g.permission)).toEqual(["*"]);
  });
});
