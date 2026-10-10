import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";

describe("PGlite Proxy migration synchronization", () => {
  it("allows proxy queries to await migrations and read session table without deadlock", async () => {
    const pglite = new PGlite();

    const migrationPromise = (async () => {
      await pglite.waitReady;
      const migrationsFolder = resolve(__dirname, "../drizzle");
      const rawDb = drizzle(pglite);
      await migrate(rawDb, { migrationsFolder });
    })();

    const proxyClient = new Proxy(pglite, {
      get(target, prop, receiver) {
        if (prop === "query") {
          return async (...args: Parameters<PGlite["query"]>) => {
            await migrationPromise;
            return target.query(...args);
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

    const res = await proxyClient.query<{ count: string }>("SELECT count(*) FROM session");
    expect(res.rows).toBeDefined();
    expect(Number(res.rows[0]?.count)).toBe(0);
  }, 30000);
});
