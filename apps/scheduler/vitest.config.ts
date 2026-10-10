import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // No spy survives into the next test, so "called once" means once in this test.
    restoreMocks: true,
  },
});
