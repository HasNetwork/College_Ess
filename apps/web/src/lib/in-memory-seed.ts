import { createDbClient, seedDatabase } from "@clg-ess/db";

/**
 * The in-memory PGlite (`DATABASE_URL=pglite://memory`: local development and E2E) starts
 * empty every time, and no other process can reach it, so the server seeds it on start: the
 * placeholder college and the guide's built-in pages. A real database is seeded with
 * `pnpm --filter @clg-ess/db seed` instead (docs/ENV.md). A seed that fails stops the server,
 * as a missing variable does: a guide page that can't be read must not go unnoticed.
 *
 * Called from `instrumentation.ts`, so route tests (which never start a server) keep their
 * own empty database.
 */
export async function seedInMemoryDatabase(): Promise<void> {
  const url = process.env.DATABASE_URL ?? "";
  if (!url.startsWith("pglite://") && url !== "memory") return;
  try {
    const { docs } = await seedDatabase(createDbClient());
    console.log(`[Seed] In-memory database: ${docs.added.length} guide pages.`);
  } catch (err) {
    console.error("[Seed] Could not seed the in-memory database:", err);
    process.exit(1);
  }
}
