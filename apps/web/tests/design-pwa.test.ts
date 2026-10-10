import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import tailwind from "@tailwindcss/postcss";
import postcss from "postcss";
import { describe, expect, it } from "vitest";
import {
  isIosDevice,
  isIosSafariNotInstalled,
  isStandalonePwa,
} from "../src/components/shell/ios-install-prompt";
import { NAV_ITEMS } from "../src/components/shell/nav-items";
import { THEME_COLOR } from "../src/lib/theme-color";

const srcDir = resolve(__dirname, "../src");
const srcFiles = readdirSync(srcDir, { recursive: true, encoding: "utf8" }).map((file) =>
  file.replaceAll("\\", "/"),
);
const source = (file: string) => readFileSync(resolve(srcDir, file), "utf-8");

/** A PNG's real dimensions, from its IHDR chunk (bytes 16–23, big-endian). */
function pngSize(path: string): [number, number] {
  const bytes = readFileSync(path);
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe("Phase 0-7 Design System & PWA Tests", () => {
  describe("Design Tokens & Global Styles", () => {
    const globalsCssPath = resolve(__dirname, "../src/app/globals.css");
    const globalsCss = readFileSync(globalsCssPath, "utf-8");

    it("defines semantic tokens for both light and dark themes", () => {
      // Light theme tokens
      expect(globalsCss).toContain("--surface-canvas:");
      expect(globalsCss).toContain("--surface-card:");
      expect(globalsCss).toContain("--surface-raised:");
      expect(globalsCss).toContain("--surface-glass:");
      expect(globalsCss).toContain("--border-subtle:");
      expect(globalsCss).toContain("--text-primary:");
      expect(globalsCss).toContain("--text-secondary:");
      expect(globalsCss).toContain("--primary:");
      expect(globalsCss).toContain("--success:");
      expect(globalsCss).toContain("--warning:");
      expect(globalsCss).toContain("--destructive:");

      // Dark theme tokens
      expect(globalsCss).toContain(".dark {");
      expect(globalsCss).toMatch(/\.dark\s*\{[\s\S]*--surface-canvas:/);
      expect(globalsCss).toMatch(/\.dark\s*\{[\s\S]*--surface-card:/);
      expect(globalsCss).toMatch(/\.dark\s*\{[\s\S]*--text-primary:/);
      // Used by the settings guide's badges and never defined until 0.5-5.
      expect(globalsCss).toMatch(/\.dark\s*\{[\s\S]*--success:/);
      expect(globalsCss).toMatch(/\.dark\s*\{[\s\S]*--warning:/);
    });

    // next-themes switches the theme with a `.dark` class. Tailwind's `dark:` follows the OS
    // unless told otherwise, and then a student who picked Light on a dark phone got light
    // tokens under dark utilities (0.5-5 §2). Compiled as `next build` compiles it.
    it("compiles dark: to follow the .dark class, not the OS setting", async () => {
      const from = resolve(__dirname, "../src/app/globals.css");
      const input = `${globalsCss}\n@source inline("dark:hidden");`;
      // An empty base: only the inline class is compiled, not the whole app.
      const base = mkdtempSync(join(tmpdir(), "tw-"));
      const { css } = await postcss([tailwind({ base })]).process(input, { from });

      expect(css).toMatch(/\.dark\\:hidden:where\(\.dark, \.dark \*\)\s*\{\s*display: none;/);
      expect(css).not.toContain("prefers-color-scheme: dark");
    });

    it("enforces 44px touch targets and safe area insets", () => {
      expect(globalsCss).toContain(".touch-target");
      expect(globalsCss).toContain("min-height: 44px");
      expect(globalsCss).toContain("--sab: env(safe-area-inset-bottom");
      expect(globalsCss).toContain(".pb-safe");
    });

    it("enforces prefers-reduced-motion accessibility overrides", () => {
      expect(globalsCss).toContain("@media (prefers-reduced-motion: reduce)");
      expect(globalsCss).toContain("animation-duration: 0.01ms !important");
    });

    it("enforces glass chrome fallback for browsers lacking backdrop-filter", () => {
      expect(globalsCss).toContain("@supports not (backdrop-filter: blur(1px))");
    });
  });

  // R6.1: glass goes on persistent chrome only, and only through GlassSurface (which renders
  // the .glass-chrome utility). The test that lived here read two files by name and could
  // not see a raw blur anywhere else (R17), so this walks the whole of src/.
  describe("GlassSurface Chrome-Only Rule", () => {
    const files = srcFiles.filter((file) => /\.(tsx?|css)$/.test(file));

    // The one sanctioned implementation: the .glass-chrome rule and its feature query.
    const withoutSanctionedGlass = (file: string, text: string) =>
      file === "app/globals.css"
        ? text
            .replace(/\.glass-chrome\s*\{[^}]*\}/g, "")
            .replace("@supports not (backdrop-filter: blur(1px))", "")
        : text;

    // Known debt: none since 0.5-4 restyled the sync status widget. A ratchet: a new offender
    // fails this test, and so does fixing an entry without deleting it here.
    const KNOWN_RAW_GLASS: string[] = [];

    it("applies no raw backdrop blur anywhere in src outside the glass primitive", () => {
      const offenders = files.filter((file) =>
        /backdrop-(blur|filter)/.test(withoutSanctionedGlass(file, source(file))),
      );
      expect(offenders.sort()).toEqual([...KNOWN_RAW_GLASS].sort());
    });

    it("declares a chrome role on every GlassSurface it renders", () => {
      const unlabelled = files.flatMap((file) =>
        [...source(file).matchAll(/<GlassSurface\b[^>]*>/g)]
          .filter((tag) => !tag[0].includes("chromeRole="))
          .map(() => file),
      );
      expect(files.some((file) => source(file).includes("<GlassSurface"))).toBe(true);
      expect(unlabelled).toEqual([]);
    });
  });

  // R6: colour comes from the tokens, which is what keeps both themes readable. A palette
  // class (`text-red-500`) or a raw value in a component ignores the theme; 0.5-5 found the
  // landing page's heading white on a white canvas. Only `lib/theme-color.ts` may hold
  // literals: the manifest and the theme-color meta tags need real values.
  describe("Colour comes from the tokens", () => {
    const PALETTE =
      /\b(?:bg|text|border|ring|from|to|via|fill|stroke|outline|shadow|divide|placeholder|decoration|accent|caret)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-\d{2,3})?\b/;
    const LITERAL =
      /["'`\s(:]#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})\b|\b(?:rgba?|hsla?|oklch)\(/i;
    const ALLOWED = ["lib/theme-color.ts"];
    // Known debt: none since 0.5-5 redesigned the landing page on the tokens (§3). A ratchet
    // like the glass list: a new offender fails, and so does a fixed one left listed.
    const KNOWN_LITERALS: string[] = [];

    it("uses no palette class or raw colour outside the tokens", () => {
      const offenders = srcFiles
        .filter((file) => /\.tsx?$/.test(file) && !ALLOWED.includes(file))
        .filter((file) => PALETTE.test(source(file)) || LITERAL.test(source(file)));
      expect(offenders.sort()).toEqual([...KNOWN_LITERALS].sort());
    });
  });

  describe("Navigation Structure & Shell", () => {
    // The routes that have a page: `app/(auth)/sign-in/page.tsx` is `/sign-in`.
    const pageRoutes = srcFiles
      .filter((file) => /^app\/(.*\/)?page\.tsx$/.test(file))
      .map((file) => `/${file.replace(/^app\//, "").replace(/(^|\/)page\.tsx$/, "")}`)
      .map((route) => route.replace(/\/\([^)]+\)/g, "").replace(/\/$/, "") || "/");

    // Four tabs opened "page not found" until 0.5-5: a module gets its tab when it ships.
    it("gives a tab only to a page that exists", () => {
      expect(pageRoutes).toContain("/sign-in");
      for (const item of NAV_ITEMS) {
        expect(pageRoutes, `${item.label} → ${item.href}`).toContain(item.href);
        expect(item.icon).toBeDefined();
        expect(item.description).toBeTruthy();
      }
    });

    // `/compass` only redirects, so the tab was never highlighted and every tap paid a
    // redirect (0.5-5 §7).
    it("points the Compass tab at the guide itself", () => {
      expect(NAV_ITEMS.find((item) => item.label === "Compass")?.href).toBe("/guide");
    });
  });

  describe("iOS PWA Install Detection", () => {
    it("identifies iOS user agents", () => {
      const iphoneUA =
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
      const androidUA =
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

      expect(isIosDevice(iphoneUA)).toBe(true);
      expect(isIosDevice(androidUA)).toBe(false);

      expect(isIosSafariNotInstalled(iphoneUA)).toBe(true);
      expect(isIosSafariNotInstalled(androidUA)).toBe(false);
    });
  });

  describe("PWA Manifest", () => {
    const publicDir = resolve(__dirname, "../public");

    it("manifest has standalone display and a signed-in start page", async () => {
      const manifest = (await import("../src/app/manifest")).default();

      expect(manifest.display).toBe("standalone");
      // Signed out, the dashboard sends the student on to the welcome page.
      expect(manifest.start_url).toBe("/dashboard");
    });

    // Chrome offers installation only for icons that decode at their declared size. Until
    // 0.5-5 both files were 1×1, so the app could not be installed (0.5-5 §1).
    it("declares icons that decode at their declared sizes, one of them maskable", async () => {
      const manifest = (await import("../src/app/manifest")).default();
      const icons = manifest.icons ?? [];

      for (const icon of icons) {
        const [width, height] = pngSize(resolve(publicDir, `.${icon.src}`));
        expect(`${width}x${height}`, icon.src).toBe(icon.sizes);
      }
      const sizes = icons.filter((icon) => icon.purpose !== "maskable").map((icon) => icon.sizes);
      expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
      expect(icons.some((icon) => icon.purpose === "maskable")).toBe(true);
    });

    // iOS uses a page screenshot without one. Next serves app/apple-icon.png as the
    // apple-touch-icon link.
    it("has a 180 px apple-touch-icon and a favicon", () => {
      expect(pngSize(resolve(srcDir, "app/apple-icon.png"))).toEqual([180, 180]);
      expect(pngSize(resolve(srcDir, "app/icon.png"))[0]).toBeGreaterThanOrEqual(32);
    });

    // The installed app's chrome and the browser's used to disagree (#2563eb vs #ffffff).
    it("gives the manifest and the page the same light theme colour", async () => {
      const manifest = (await import("../src/app/manifest")).default();

      expect(manifest.theme_color).toBe(THEME_COLOR);
      expect(source("app/layout.tsx")).toMatch(
        /media: "\(prefers-color-scheme: light\)", color: THEME_COLOR/,
      );
    });
  });
});
