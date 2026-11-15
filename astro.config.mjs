// @ts-check
import { defineConfig } from "astro/config";

import notoSansJpSubset, { FONT_DISPLAY } from "./scripts/noto-sans-jp-subset.mjs";
import thirdPartyLicenses from "./scripts/third-party-licenses.mjs";

/**
 * DM Mono (the section headings and the numbers) ships as Fontsource's own files: its rules
 * show the text as FONT_DISPLAY says, like the cut Noto Sans JP files and
 * unlibra.com, not as the package's swap.
 */
const dmMonoFontDisplay = () => ({
  name: "dm-mono-font-display",
  enforce: /** @type {const} */ ("pre"),
  /** @param {string} code @param {string} id */
  transform(code, id) {
    if (!/@fontsource[\\/]dm-mono[\\/].*\.css/.test(id)) return;
    if (!code.includes("font-display: swap;")) {
      throw new Error(`${id}: no font-display: swap to replace`);
    }
    return code.replaceAll("font-display: swap;", `font-display: ${FONT_DISPLAY};`);
  },
});

// https://astro.build/config
export default defineConfig({
  integrations: [thirdPartyLicenses(), notoSansJpSubset()],
  vite: {
    plugins: [dmMonoFontDisplay()],
    build: {
      // Font files stay files: inlined as base64, they would make the
      // stylesheet that the page waits for heavier.
      assetsInlineLimit: (/** @type {string} */ file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
    },
  },
});
