import type { OutboxEntry } from "@clg-ess/core";
import Dexie, { type EntityTable } from "dexie";

export interface KeyValueEntry {
  key: string;
  value: unknown;
  timestamp?: number;
}

/**
 * AppSyncDatabase — Client-side Dexie IndexedDB instance.
 * Stores the offline mutation outbox and the persisted TanStack Query cache.
 */
export class AppSyncDatabase extends Dexie {
  outbox!: EntityTable<OutboxEntry, "id">;
  keyValue!: EntityTable<KeyValueEntry, "key">;

  constructor() {
    super("clg_ess_sync");
    this.version(1).stores({
      outbox: "id, createdAt, table, status, rowId",
      keyValue: "key",
    });
    // Every entry records whose change it is (0.5-4 §6). No upgrade step: before 0.5-4 no
    // screen queued a write (queueWrite had no caller), so no device holds an unowned entry.
    this.version(2).stores({
      outbox: "id, createdAt, table, status, rowId, ownerId",
    });
  }
}

let _db: AppSyncDatabase | null = null;

export function getDb(): AppSyncDatabase {
  if (!_db) {
    _db = new AppSyncDatabase();
  }
  return _db;
}

export const db = typeof window !== "undefined" ? getDb() : (null as unknown as AppSyncDatabase);
