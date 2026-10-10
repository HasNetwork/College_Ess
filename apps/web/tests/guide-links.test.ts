import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { loadDefaultDocs } from "@clg-ess/db";
import { describe, expect, it } from "vitest";

// A guide link that leads nowhere strands a student mid-task. The reminders page once sent
// them to /compass/install, which did not exist (0.5-5 §6). Every link in every built-in page
// must reach a page this app has: a route with a page file, or another guide page.

const appDir = resolve(__dirname, "../src/app");
const staticRoutes = readdirSync(appDir, { recursive: true, encoding: "utf8" })
  .map((file) => file.replaceAll("\\", "/"))
  .filter((file) => /(^|\/)page\.tsx$/.test(file) && !file.includes("["))
  .map((file) => `/${file.replace(/(^|\/)page\.tsx$/, "")}`)
  .map((route) => route.replace(/\/\([^)]+\)/g, "").replace(/\/$/, "") || "/");

const docs = loadDefaultDocs();
const guideRoutes = docs.filter((doc) => doc.kind === "guide").map((doc) => `/guide/${doc.slug}`);

describe("links in the guide's built-in pages", () => {
  it("knows the app's routes", () => {
    expect(staticRoutes).toEqual(
      expect.arrayContaining(["/", "/guide", "/guide/faq", "/settings"]),
    );
  });

  it.each(docs.map((doc) => [doc.slug, doc.bodyMd] as const))(
    "%s links only to pages that exist",
    (_slug, body) => {
      const targets = [...body.matchAll(/\]\((\/[^)\s#]*)(?:#[^)\s]*)?\)/g)].map(
        ([, path]) => path ?? "",
      );
      const dead = targets.filter(
        (path) => !staticRoutes.includes(path) && !guideRoutes.includes(path),
      );
      expect(dead).toEqual([]);
    },
  );
});
