import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { uuidv7 } from "uuidv7";
import { describe, expect, it } from "vitest";
import * as schema from "../src/schema/index";
import { seedDatabase } from "../src/seed";

describe("Database Schema & Migrations", () => {
  it("every entry in _journal.json has a corresponding .sql file on disk", () => {
    const journalPath = resolve(__dirname, "../drizzle/meta/_journal.json");
    expect(existsSync(journalPath)).toBe(true);

    const journal = JSON.parse(readFileSync(journalPath, "utf-8"));
    expect(journal.entries).toBeDefined();
    expect(journal.entries.length).toBeGreaterThan(0);

    for (const entry of journal.entries) {
      const sqlPath = resolve(__dirname, `../drizzle/${entry.tag}.sql`);
      expect(existsSync(sqlPath), `Migration file ${sqlPath} must exist on disk`).toBe(true);
    }
  });

  it("applies real migrations from drizzle/ cleanly and seeds one college", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema });

    // Apply real migrations from drizzle/ in journal order
    const migrationsFolder = resolve(__dirname, "../drizzle");
    await migrate(db, { migrationsFolder });

    // Verify seed database
    const seedResult = await seedDatabase(db);
    expect(seedResult.collegeSlug).toBe("clg-main");
    expect(seedResult.collegeId).toBeDefined();
    expect(seedResult.docs.added.length).toBeGreaterThanOrEqual(3);

    // Query seeded college
    const college = await db.query.colleges.findFirst({
      where: (colleges, { eq: eqOp }) => eqOp(colleges.slug, "clg-main"),
    });
    expect(college).toBeDefined();
    expect(college?.name).toBe("College of Engineering");
    expect(college?.id).toBe(seedResult.collegeId);
    expect(college?.createdAt).toBeInstanceOf(Date);
    expect(college?.updatedAt).toBeInstanceOf(Date);
    expect(college?.deletedAt).toBeNull();

    if (!college) {
      throw new Error("Expected college to be seeded");
    }

    // Query seeded docs
    const docs = await db.query.docs.findMany();
    expect(docs.length).toBeGreaterThanOrEqual(3);
    const gettingStarted = docs.find((d) => d.slug === "getting-started");
    expect(gettingStarted?.title).toBe("Getting Started with College Ess");
    expect(gettingStarted?.collegeId).toBeNull(); // platform default

    // Verify soft delete behavior
    await db
      .update(schema.colleges)
      .set({ deletedAt: new Date() })
      .where(eq(schema.colleges.id, college.id));

    const activeColleges = await db
      .select()
      .from(schema.colleges)
      .where(isNull(schema.colleges.deletedAt));
    expect(activeColleges.length).toBe(0);

    // --- Defect 1 Verification: User & Domain Relations ---

    // 1. Insert a user with UUID v7
    const [testUser] = await db
      .insert(schema.user)
      .values({
        name: "Test Student",
        email: "test-student@clg.edu",
        collegeId: college.id,
      })
      .returning();
    expect(testUser.id).toBeDefined();
    expect(typeof testUser.id).toBe("string");

    // 2. Insert an item referencing testUser.id
    const [newItem] = await db
      .insert(schema.items)
      .values({
        collegeId: college.id,
        userId: testUser.id,
        kind: "todo",
        title: "Test assignment",
        status: "pending",
        priority: 1,
      })
      .returning();
    expect(newItem.id).toBeDefined();
    expect(newItem.userId).toBe(testUser.id);
    expect(newItem.kind).toBe("todo");

    // 3. Successfully JOIN item to user
    const joinedRows = await db
      .select({
        itemId: schema.items.id,
        itemTitle: schema.items.title,
        userName: schema.user.name,
        userEmail: schema.user.email,
      })
      .from(schema.items)
      .innerJoin(schema.user, eq(schema.items.userId, schema.user.id))
      .where(eq(schema.items.id, newItem.id));

    expect(joinedRows.length).toBe(1);
    expect(joinedRows[0]?.userName).toBe("Test Student");
    expect(joinedRows[0]?.userEmail).toBe("test-student@clg.edu");
    expect(joinedRows[0]?.itemTitle).toBe("Test assignment");

    // 4. Verify foreign key rejection: inserting an item with non-existent user_id MUST fail
    const nonExistentUserId = uuidv7();
    await expect(
      db.insert(schema.items).values({
        collegeId: college.id,
        userId: nonExistentUserId,
        kind: "todo",
        title: "Orphaned item",
      }),
    ).rejects.toThrow();

    // 5. Verify link primitive. Every link has an owner (0.5-2): an ownerless row is what
    // let any student read and rewrite every link in every college.
    const edge = {
      fromType: "item",
      fromId: newItem.id,
      toType: "item",
      toId: newItem.id,
      relation: "prepares_for" as const,
    };
    // @ts-expect-error -- the types forbid an ownerless link; this proves the database does too
    await expect(db.insert(schema.links).values(edge)).rejects.toThrow();
    const [newLink] = await db
      .insert(schema.links)
      .values({ ...edge, userId: testUser.id })
      .returning();
    expect(newLink.relation).toBe("prepares_for");
    expect(newLink.userId).toBe(testUser.id);

    // 6. Verify reminder primitive with real user FK
    const [newReminder] = await db
      .insert(schema.reminders)
      .values({
        userId: testUser.id,
        subjectType: "item",
        subjectId: newItem.id,
        triggerKind: "relative",
        triggerValue: "-15m",
        channel: "push",
      })
      .returning();
    expect(newReminder.channel).toBe("push");
    expect(newReminder.userId).toBe(testUser.id);

    // 7. Verify asset primitive with real user FK
    const [newAsset] = await db
      .insert(schema.assets)
      .values({
        ownerId: testUser.id,
        bucketKey: "avatars/test.png",
        mime: "image/png",
        bytes: 1024,
      })
      .returning();
    expect(newAsset.ownerId).toBe(testUser.id);

    // 8. Verify suggestion primitive with real user FK
    const [newSuggestion] = await db
      .insert(schema.suggestions)
      .values({
        collegeId: college.id,
        targetType: "college_info",
        proposedDiff: { note: "Update library hours" },
        submittedBy: testUser.id,
      })
      .returning();
    expect(newSuggestion.status).toBe("pending");
    expect(newSuggestion.submittedBy).toBe(testUser.id);

    // 9. Verify doc_revision with real user FK
    const seededDoc = docs[0];
    if (seededDoc) {
      const [newRevision] = await db
        .insert(schema.docRevisions)
        .values({
          docId: seededDoc.id,
          title: "Updated Title",
          bodyMd: "# Updated content",
          editedBy: testUser.id,
          note: "Minor correction",
        })
        .returning();
      expect(newRevision.editedBy).toBe(testUser.id);
    }
  }, 30000);
});
