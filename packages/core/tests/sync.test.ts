import { describe, expect, it } from "vitest";
import {
  APPEND_ONLY_TABLES,
  type OutboxEntry,
  OutboxEntrySchema,
  isAppendOnlyTable,
  sortOutboxEntries,
} from "../src/index.js";

const OWNER = "018e3d64-2661-7000-8000-0000000000aa";

describe("Core Sync Logic", () => {
  describe("OutboxEntrySchema", () => {
    it("validates a valid outbox entry", () => {
      const entry: OutboxEntry = {
        id: "018e3d64-2661-7000-8000-000000000001",
        createdAt: 1711000000000,
        ownerId: OWNER,
        table: "item",
        op: "insert",
        rowId: "018e3d64-2661-7000-8000-000000000002",
        payload: { title: "Buy notebook", kind: "todo" },
        attempts: 0,
        status: "pending",
      };

      const parsed = OutboxEntrySchema.parse(entry);
      expect(parsed.id).toBe(entry.id);
      expect(parsed.status).toBe("pending");
    });

    it("rejects invalid status", () => {
      const invalid = {
        id: "018e3d64-2661-7000-8000-000000000001",
        createdAt: 1711000000000,
        ownerId: OWNER,
        table: "item",
        op: "insert",
        rowId: "018e3d64-2661-7000-8000-000000000002",
        payload: {},
        attempts: 0,
        status: "invalid_status",
      };

      expect(OutboxEntrySchema.safeParse(invalid).success).toBe(false);
    });

    it("rejects an entry that does not say whose change it is (0.5-4)", () => {
      // Without an owner, a shared device cannot tell one student's queued change from
      // the next student's.
      const unowned = {
        id: "018e3d64-2661-7000-8000-000000000001",
        createdAt: 1711000000000,
        table: "item",
        op: "insert",
        rowId: "018e3d64-2661-7000-8000-000000000002",
        payload: {},
        attempts: 0,
        status: "pending",
      };

      expect(OutboxEntrySchema.safeParse(unowned).success).toBe(false);
    });
  });

  describe("isAppendOnlyTable", () => {
    it("recognizes wear_event as append-only", () => {
      expect(isAppendOnlyTable("wear_event")).toBe(true);
      expect(APPEND_ONLY_TABLES).toContain("wear_event");
    });

    it("identifies mutable tables as not append-only", () => {
      expect(isAppendOnlyTable("item")).toBe(false);
      expect(isAppendOnlyTable("reminder")).toBe(false);
      expect(isAppendOnlyTable("suggestion")).toBe(false);
    });
  });

  describe("sortOutboxEntries", () => {
    it("orders entries by createdAt ascending (FIFO)", () => {
      const e1: OutboxEntry = {
        id: "1",
        createdAt: 200,
        ownerId: OWNER,
        table: "item",
        op: "insert",
        rowId: "r1",
        payload: {},
        attempts: 0,
        status: "pending",
      };
      const e2: OutboxEntry = {
        id: "2",
        createdAt: 100,
        ownerId: OWNER,
        table: "item",
        op: "update",
        rowId: "r1",
        payload: {},
        attempts: 0,
        status: "pending",
      };
      const e3: OutboxEntry = {
        id: "3",
        createdAt: 300,
        ownerId: OWNER,
        table: "item",
        op: "delete",
        rowId: "r1",
        payload: {},
        attempts: 0,
        status: "pending",
      };

      const sorted = sortOutboxEntries([e1, e3, e2]);
      expect(sorted.map((e) => e.id)).toEqual(["2", "1", "3"]);
    });
  });
});
