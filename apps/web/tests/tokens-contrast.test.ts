import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Readable in both themes (0.5-5 §4): every text colour reaches WCAG AA (4.5:1) on the
// surfaces text sits on, and every label reaches it on the fill it is written on. The tokens
// are read from the stylesheet that ships, so changing one to a colour students can't read
// fails here.

const css = readFileSync(resolve(__dirname, "../src/app/globals.css"), "utf-8");

type Rgba = [number, number, number, number];

/** The literal colour declarations in one rule block (aliases such as `var(--x)` skipped). */
function tokensOf(selector: ":root" | ".dark"): Map<string, Rgba> {
  const block = css.match(new RegExp(`\\n\\s*${selector.replace(".", "\\.")}\\s*\\{([^}]*)\\}`));
  if (!block?.[1]) throw new Error(`No ${selector} block in globals.css`);
  const tokens = new Map<string, Rgba>();
  for (const [, name, value] of block[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    if (!name || !value) continue;
    const colour = parseColour(value.trim());
    if (colour) tokens.set(name, colour);
  }
  return tokens;
}

function parseColour(value: string): Rgba | null {
  const hex = value.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (hex) {
    return [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255).concat(1) as Rgba;
  }
  const rgba = value.match(/^rgba?\(([^)]+)\)$/)?.[1];
  if (rgba) {
    const [r = 0, g = 0, b = 0, a = 1] = rgba.split(",").map((part) => Number(part.trim()));
    return [r / 255, g / 255, b / 255, a];
  }
  return null;
}

/** A translucent colour painted over an opaque one. */
function over([r, g, b, a]: Rgba, [br, bg, bb]: Rgba): Rgba {
  return [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1];
}

function withAlpha([r, g, b]: Rgba, a: number): Rgba {
  return [r, g, b, a];
}

function luminance([r, g, b]: Rgba): number {
  const channel = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const light = tokensOf(":root");
const dark = new Map([...light, ...tokensOf(".dark")]);

describe.each([
  ["light", light],
  ["dark", dark],
] as const)("%s theme contrast (WCAG AA, 4.5:1)", (_theme, tokens) => {
  const token = (name: string): Rgba => {
    const value = tokens.get(name);
    if (!value) throw new Error(`${name} is not a colour in this theme`);
    return value;
  };
  const canvas = token("--surface-canvas");
  const surfaces: Record<string, Rgba> = {
    canvas,
    card: token("--surface-card"),
    raised: token("--surface-raised"),
    // The tab bar's labels sit on glass over the page.
    "glass chrome": over(token("--surface-glass-chrome"), canvas),
  };

  const textTokens = [
    "--text-primary",
    "--text-secondary",
    "--text-muted",
    "--primary",
    "--success",
    "--warning",
    "--destructive",
  ];

  it.each(textTokens)("%s is readable on every surface text sits on", (name) => {
    const shortfalls = Object.entries(surfaces)
      .map(([surface, background]) => [surface, contrast(token(name), background)] as const)
      .filter(([, ratio]) => ratio < 4.5)
      .map(([surface, ratio]) => `${surface} ${ratio.toFixed(2)}`);
    expect(shortfalls).toEqual([]);
  });

  // A status message is written in its colour on a 10% tint of it (`bg-[var(--x)]/10`).
  it.each(["--primary", "--success", "--warning", "--destructive"])(
    "%s is readable on its own 10%% tint",
    (name) => {
      const tint = over(withAlpha(token(name), 0.1), token("--surface-card"));
      expect(contrast(token(name), tint)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each([
    ["--primary-foreground", "--primary"],
    ["--success-foreground", "--success"],
    ["--warning-foreground", "--warning"],
    ["--destructive-foreground", "--destructive"],
  ])("%s is readable on %s", (label, fill) => {
    expect(contrast(token(label), token(fill))).toBeGreaterThanOrEqual(4.5);
  });
});
