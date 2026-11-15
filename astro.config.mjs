// @ts-check
import { defineConfig } from "astro/config";

// The fonts are set up as on unlibra.com (DESIGN.md 6.1): Noto Sans JP and DM
// Mono from Fontsource, served from this site, with the same metric overrides
// and font-display.

/**
 * Metric overrides of Noto Sans JP. Its ascent (1.16em) is far larger than its
 * descent (0.288em), so its text sits about 0.07em below the middle of its
 * line, and the icons beside it look too high. These keep the sum (1.448em, so
 * the line heights stay) and put the middle of the capitals at the middle of
 * the line.
 */
const METRIC_OVERRIDES = {
  "ascent-override": "109.4%",
  "descent-override": "35.4%",
};

/**
 * How the fonts show while they load: the text waits for the font for about
 * 100ms, then shows in a fallback font, which the web font replaces only
 * within about 3s.
 */
const FONT_DISPLAY = "fallback";

const notoSansJpMetrics = () => ({
  name: "noto-sans-jp-metrics",
  enforce: /** @type {const} */ ("pre"),
  /** @param {string} code @param {string} id */
  transform(code, id) {
    if (!/@fontsource-variable[\\/]noto-sans-jp[\\/].*\.css/.test(id)) return;
    if (!code.includes("@font-face {")) {
      throw new Error(`${id}: no @font-face to add the metric overrides to`);
    }
    return code.replaceAll(
      "@font-face {",
      "@font-face {\n" +
        Object.entries(METRIC_OVERRIDES)
          .map(([name, value]) => `  ${name}: ${value};`)
          .join("\n"),
    );
  },
});

const fontDisplay = () => ({
  name: "font-display",
  enforce: /** @type {const} */ ("pre"),
  /** @param {string} code @param {string} id */
  transform(code, id) {
    if (!/@fontsource(-variable)?[\\/](noto-sans-jp|dm-mono)[\\/].*\.css/.test(id)) return;
    if (!code.includes("font-display: swap;")) {
      throw new Error(`${id}: no font-display: swap to replace`);
    }
    return code.replaceAll("font-display: swap;", `font-display: ${FONT_DISPLAY};`);
  },
});

export default defineConfig({
  vite: {
    plugins: [notoSansJpMetrics(), fontDisplay()],
    build: {
      // Font files stay files: inlined as base64, they would make the
      // stylesheet that the page waits for heavier.
      assetsInlineLimit: (/** @type {string} */ file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
    },
  },
});
