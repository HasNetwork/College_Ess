// CLI entry point for `pnpm --filter @clg-ess/db seed`.
// Never re-export this file from the package index: it runs on import (RULES R18).
import { createDbClient } from "../client";
import { seedDatabase } from "../seed";

seedDatabase(createDbClient())
  .then(({ collegeSlug, collegeId, docs }) => {
    console.log(`[Seed] College '${collegeSlug}' (${collegeId}).`);
    console.log(
      `[Seed] Guide: ${docs.added.length} added, ${docs.updated.length} updated, ${docs.removed.length} removed.`,
    );
    // Not an error: an admin's text wins over a newer default (PLAN §8.11). Said so the
    // operator knows those pages did not get the new text.
    if (docs.keptEdited.length > 0) {
      console.log(`[Seed] Kept as an admin left them: ${docs.keptEdited.join(", ")}.`);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error("[Seed] Error seeding database:", err);
    process.exit(1);
  });
