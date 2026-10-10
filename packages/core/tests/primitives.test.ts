import { describe, expect, it } from "vitest";
import { ItemKindSchema, SyncTripleSchema, isRecordActive } from "../src/index.js";

describe("Core domain primitives", () => {
  it("validates sync triple with active status", () => {
    const now = new Date();
    const valid = SyncTripleSchema.parse({
      id: "018e3d64-2661-7000-8000-000000000000",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    expect(valid.id).toBe("018e3d64-2661-7000-8000-000000000000");
    expect(isRecordActive(valid)).toBe(true);
  });

  it("identifies soft-deleted record correctly", () => {
    const now = new Date();
    const deletedRecord = {
      id: "test-id",
      createdAt: now,
      updatedAt: now,
      deletedAt: new Date(now.getTime() + 1000),
    };

    expect(isRecordActive(deletedRecord)).toBe(false);
  });

  it("validates unified item kinds per PLAN.md", () => {
    expect(ItemKindSchema.safeParse("todo").success).toBe(true);
    expect(ItemKindSchema.safeParse("exam").success).toBe(true);
    expect(ItemKindSchema.safeParse("invalid_kind").success).toBe(false);
  });
});
