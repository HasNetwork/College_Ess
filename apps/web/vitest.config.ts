import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Route handlers import through the tsconfig `@/` alias; the harness loads them as-is.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Runs before every test file's imports — see the file for why that ordering matters.
    setupFiles: ["./tests/harness/setup.ts"],
    // No spy or env stub survives into the next test: counts like "sent exactly once"
    // must not include calls made by an earlier test.
    restoreMocks: true,
    unstubEnvs: true,
    // Each file boots its own PGlite, applies the real migrations and signs users up.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
