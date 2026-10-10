import { resolve } from "node:path";
import { SETTINGS, defineSettings, resolveDocFromList } from "@clg-ess/core";
import { schema, seedDatabase } from "@clg-ess/db";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import React from "react";
import { renderToString } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { MarkdownRenderer } from "../src/components/compass/markdown-renderer";
import { searchDocs } from "../src/lib/compass/search";

describe("Phase 0-9 Compass Guide System & Settings Registry", () => {
  // biome-ignore lint/suspicious/noExplicitAny: polymorphic db instance
  let db: any;
  let college: schema.College;

  beforeAll(async () => {
    const client = new PGlite();
    db = drizzle(client, { schema });
    const migrationsFolder = resolve(__dirname, "../../../packages/db/drizzle");
    await migrate(db, { migrationsFolder });

    // Seed college
    const [c] = await db
      .insert(schema.colleges)
      .values({
        name: "Test University",
        slug: "test-univ",
        domain: "test.edu",
      })
      .returning();
    if (!c) throw new Error("Failed to seed college");
    college = c;
  }, 30000);

  describe("1. Seed Loader Idempotency & Override Protection", () => {
    it("seeds default docs on initial run", async () => {
      const res = await seedDatabase(db);
      expect(res.docs.added.length).toBeGreaterThan(0);

      const allDocs = await db.select().from(schema.docs);
      expect(allDocs.length).toBeGreaterThanOrEqual(res.docs.added.length);
    });

    it("is idempotent — running twice changes nothing", async () => {
      const res2 = await seedDatabase(db);
      expect(res2.docs).toEqual({ added: [], updated: [], keptEdited: [], removed: [] });
    });

    it("does not overwrite a college-specific override", async () => {
      // Create a college override for 'getting-started'
      const customTitle = "Test University Custom Getting Started";
      const customBody = "# Custom Guide\nWelcome to Test University.";

      await db.insert(schema.docs).values({
        collegeId: college.id,
        slug: "getting-started",
        title: customTitle,
        bodyMd: customBody,
        audience: "user",
        kind: "guide",
        orderIndex: 0,
        minRole: "student",
        published: true,
      });

      // Run seed again
      const res = await seedDatabase(db);
      expect(res.docs.added).toEqual([]);

      // Verify college override still has custom content
      const [collegeDoc] = await db
        .select()
        .from(schema.docs)
        .where(eq(schema.docs.collegeId, college.id));

      expect(collegeDoc).toBeDefined();
      expect(collegeDoc.title).toBe(customTitle);
      expect(collegeDoc.bodyMd).toBe(customBody);
    });
  });

  describe("2. Doc Resolution Hierarchy & Role Filtering", () => {
    const mockDocs = [
      {
        slug: "getting-started",
        title: "Platform Getting Started",
        bodyMd: "Default getting started guide.",
        collegeId: null,
        minRole: "student" as const,
        published: true,
        audience: "user" as const,
        kind: "guide" as const,
        orderIndex: 0,
      },
      {
        slug: "getting-started",
        title: "College A Getting Started",
        bodyMd: "College A custom guide.",
        collegeId: "college-a",
        minRole: "student" as const,
        published: true,
        audience: "user" as const,
        kind: "guide" as const,
        orderIndex: 0,
      },
      {
        slug: "co-admin-handbook",
        title: "Club Coordinator Handbook",
        bodyMd: "Confidential guidance for co-admins.",
        collegeId: null,
        minRole: "co_admin" as const,
        published: true,
        audience: "co_admin" as const,
        kind: "guide" as const,
        orderIndex: 1,
      },
      {
        slug: "draft-policy",
        title: "Unpublished Policy",
        bodyMd: "Work in progress draft.",
        collegeId: null,
        minRole: "student" as const,
        published: false,
        audience: "user" as const,
        kind: "guide" as const,
        orderIndex: 2,
      },
    ];

    it("college-specific override wins over platform default", () => {
      const resolved = resolveDocFromList(mockDocs, "getting-started", "college-a", "student");
      expect(resolved).not.toBeNull();
      expect(resolved?.title).toBe("College A Getting Started");
      expect(resolved?.collegeId).toBe("college-a");
    });

    it("falls back to platform default when no college override exists", () => {
      const resolved = resolveDocFromList(mockDocs, "getting-started", "college-b", "student");
      expect(resolved).not.toBeNull();
      expect(resolved?.title).toBe("Platform Getting Started");
      expect(resolved?.collegeId).toBeNull();
    });

    it("denies access to a student for co_admin min_role doc", () => {
      const resolved = resolveDocFromList(mockDocs, "co-admin-handbook", "college-a", "student");
      expect(resolved).toBeNull();
    });

    it("grants access to co_admin and higher for co_admin min_role doc", () => {
      const coAdminRes = resolveDocFromList(mockDocs, "co-admin-handbook", "college-a", "co_admin");
      expect(coAdminRes).not.toBeNull();
      expect(coAdminRes?.title).toBe("Club Coordinator Handbook");

      const collegeAdminRes = resolveDocFromList(
        mockDocs,
        "co-admin-handbook",
        "college-a",
        "college_admin",
      );
      expect(collegeAdminRes).not.toBeNull();

      const platformAdminRes = resolveDocFromList(
        mockDocs,
        "co-admin-handbook",
        "college-a",
        "platform_admin",
      );
      expect(platformAdminRes).not.toBeNull();
    });

    it("returns null for unpublished docs", () => {
      const resolved = resolveDocFromList(mockDocs, "draft-policy", null, "platform_admin");
      expect(resolved).toBeNull();
    });
  });

  describe("3. Settings Registry & Required Descriptions", () => {
    it("every setting in SETTINGS has a non-empty description", () => {
      for (const [key, setting] of Object.entries(SETTINGS)) {
        expect(setting.description, `Setting '${key}' must have description`).toBeDefined();
        expect(setting.description.trim().length).toBeGreaterThan(10);
      }
    });

    it("throws an error when a setting is defined with an empty description", () => {
      expect(() =>
        defineSettings({
          "invalid.setting": {
            key: "invalid.setting",
            type: "boolean",
            default: false,
            group: "Test",
            label: "Invalid",
            description: "   ",
            audience: "user",
            editable: true,
          },
        }),
      ).toThrow(/must have a non-empty description/);
    });

    it("forced settings (editable: false) explain why they cannot be edited", () => {
      const examSetting = SETTINGS["reminders.exams.forced"];
      expect(examSetting).toBeDefined();
      expect(examSetting.editable).toBe(false);
      expect(examSetting.description.toLowerCase()).toContain("mandatory");
    });
  });

  describe("4. Client-Side Offline Search", () => {
    const searchDocsBundle = [
      {
        slug: "getting-started",
        title: "Getting Started with College Ess",
        kind: "guide",
        bodyMd: "Welcome to College Ess. Learn how to manage your timetable, tasks, and wardrobe.",
      },
      {
        slug: "offline-sync",
        title: "Offline Support & Outbox",
        kind: "guide",
        bodyMd:
          "All mutations are queued in IndexedDB outbox and synced automatically on reconnect.",
      },
      {
        slug: "reminders-faq",
        title: "Why can't I disable exam reminders?",
        kind: "faq",
        bodyMd: "Exam notifications are mandatory across all registered institutions.",
      },
    ];

    it("matches title and ranks it higher than body matches", () => {
      const results = searchDocs(searchDocsBundle, "getting started");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.doc.slug).toBe("getting-started");
      expect(results[0]?.score).toBeGreaterThanOrEqual(10);
    });

    it("matches body content and extracts surrounding snippet", () => {
      const results = searchDocs(searchDocsBundle, "outbox");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.doc.slug).toBe("offline-sync");
      expect(results[0]?.snippet.toLowerCase()).toContain("outbox");
    });

    it("returns empty array for whitespace or empty query", () => {
      expect(searchDocs(searchDocsBundle, "")).toEqual([]);
      expect(searchDocs(searchDocsBundle, "   ")).toEqual([]);
    });
  });

  describe("5. Security & Markdown Sanitization (PLAN 0-9 §7)", () => {
    it("strips <script> tags completely", () => {
      const malicious = "# Welcome\n<script>alert('pwned')</script>\nSafe text.";
      const html = renderToString(React.createElement(MarkdownRenderer, { content: malicious }));

      expect(html).not.toContain("<script>");
      expect(html).not.toContain("alert('pwned')");
      expect(html).toContain("Safe text.");
    });

    it("strips onerror and javascript: handlers", () => {
      const malicious = 'Image test: <img src="invalid" onerror="alert(document.cookie)" />';
      const html = renderToString(React.createElement(MarkdownRenderer, { content: malicious }));

      expect(html).not.toContain("onerror");
      expect(html).not.toContain("alert(document.cookie)");
    });

    it("generates slugified anchor IDs on headings for deep linking", () => {
      const content = "## Quiet Hours Policy\n\nExplanation of quiet hours.";
      const html = renderToString(React.createElement(MarkdownRenderer, { content }));

      expect(html).toContain('id="quiet-hours-policy"');
    });
  });
});
