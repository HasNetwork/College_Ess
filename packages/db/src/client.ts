import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { requireEnv } from "./env";
import * as schema from "./schema/index";

declare global {
  // eslint-disable-next-line no-var
  var __clg_ess_pglite__: PGlite | undefined;
  // eslint-disable-next-line no-var
  var __clg_ess_pglite_proxy__: PGlite | undefined;
  // eslint-disable-next-line no-var
  var __clg_ess_pglite_migration__: Promise<void> | undefined;
}

function findMigrationsFolder(): string {
  const candidates = [
    resolve(dirname(fileURLToPath(import.meta.url)), "../drizzle"),
    resolve(dirname(fileURLToPath(import.meta.url)), "../../drizzle"),
    resolve(process.cwd(), "packages/db/drizzle"),
    resolve(process.cwd(), "../../packages/db/drizzle"),
    resolve(process.cwd(), "../packages/db/drizzle"),
  ];
  for (const c of candidates) {
    if (existsSync(c)) {
      return c;
    }
  }
  throw new Error(`Could not find drizzle migrations folder in any of:\n${candidates.join("\n")}`);
}

/**
 * Creates a Drizzle database client backed by Neon serverless HTTP driver.
 * An embedded in-memory PGlite (migrations pre-applied) is used only when explicitly
 * requested with `pglite://…` or `memory` — a missing DATABASE_URL throws (RULES R18)
 * instead of silently booting a throwaway database.
 */
export function createDbClient(connectionString?: string) {
  const url = connectionString ?? requireEnv("DATABASE_URL");
  if (!url.startsWith("pglite://") && url !== "memory") {
    const sql = neon(url);
    return drizzleNeon(sql, { schema });
  }

  if (!globalThis.__clg_ess_pglite__) {
    const pglite = new PGlite();

    const migrationPromise = (async () => {
      try {
        await pglite.waitReady;
        const migrationsFolder = findMigrationsFolder();
        console.log(`[DB] Applying embedded PGlite migrations from ${migrationsFolder}...`);
        const rawDb = drizzlePglite(pglite);
        await migrate(rawDb, { migrationsFolder });
        console.log("[DB] Embedded PGlite migrations applied successfully.");
      } catch (err) {
        console.error("[DB ERROR] Failed to apply migrations to embedded PGlite:", err);
        throw err;
      }
    })();

    globalThis.__clg_ess_pglite_migration__ = migrationPromise;

    const proxyClient = new Proxy(pglite, {
      get(target, prop, receiver) {
        if (prop === "query") {
          return async (...args: Parameters<PGlite["query"]>) => {
            await migrationPromise;
            return target.query(...args);
          };
        }
        if (prop === "exec") {
          return async (...args: Parameters<PGlite["exec"]>) => {
            await migrationPromise;
            return target.exec(...args);
          };
        }
        if (prop === "transaction") {
          return async (...args: Parameters<PGlite["transaction"]>) => {
            await migrationPromise;
            return target.transaction(...args);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    globalThis.__clg_ess_pglite__ = pglite;
    globalThis.__clg_ess_pglite_proxy__ = proxyClient;
  }

  return drizzlePglite(globalThis.__clg_ess_pglite_proxy__ ?? globalThis.__clg_ess_pglite__, {
    schema,
  });
}

export type DbClient = ReturnType<typeof createDbClient>;
