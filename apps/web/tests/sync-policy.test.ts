import { APPEND_ONLY_TABLES } from "@clg-ess/core";
import { getTableName } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { SYNC_TABLES } from "../src/app/api/sync/policy";

// Before 0.5-2 the route wrote every append-only insert into `wear_event`, whatever table
// the entry named: the second append-only table (streaks, attendance and grocery depletion
// are all planned, R2) would have landed its rows there. Each table now has its own policy;
// this holds every policy to the table its name says, so a copied entry that forgets to
// change `table` fails here the day it is added (0.5-4 §6).

describe("the sync policy", () => {
  it("writes each syncable table's rows to that table and no other", () => {
    for (const [name, policy] of Object.entries(SYNC_TABLES)) {
      expect(getTableName(policy.table), `policy "${name}"`).toBe(name);
    }
  });

  it("has a policy, with inserts, for every append-only table", () => {
    // An append-only table without one could never be written through sync at all.
    for (const name of APPEND_ONLY_TABLES) {
      expect(Object.hasOwn(SYNC_TABLES, name), `append-only "${name}"`).toBe(true);
      expect(SYNC_TABLES[name]?.insert, `append-only "${name}"`).not.toBeNull();
    }
  });
});
