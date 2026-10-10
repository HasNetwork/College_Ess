// The only colour literals outside globals.css: the manifest and the theme-color meta tags
// need real values, which CSS variables cannot reach. `design-pwa.test.ts` allows them here
// and nowhere else.

/** Browser chrome in the light scheme; also the manifest's `theme_color`, so the two agree. */
export const THEME_COLOR = "#ffffff";

/** Browser chrome in the dark scheme: the dark canvas (`--surface-canvas` in `.dark`). */
export const THEME_COLOR_DARK = "#09090b";

/** The launch screen: the logo's own blue, so it shows the white "C" on blue in either theme. */
export const SPLASH_COLOR = "#1a60db";
