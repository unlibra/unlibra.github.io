// Serves Noto Sans JP cut down to the characters the site uses. The cutting
// is the same as unlibra.com's.
//
// @fontsource-variable/noto-sans-jp splits the font into 124 files by
// unicode-range, and a page loads every file that holds one of its
// characters. After the build, this integration:
//
// 1. collects every character the HTML files in dist/ show (their text, not
//    their markup), so the files are as small as they can be and arrive
//    within font-display's 100ms wait more often,
// 2. cuts each Fontsource file down to the collected characters the browser
//    would take from it (the last defined file that has a character), and
//    writes it to dist/_astro/ with a content hash (immutable cache,
//    public/_headers),
// 3. adds @font-face rules for these files to the end of each page's <head>,
//    with a unicode-range of exactly the characters each file holds, and
//    preloads of the files to its start.
//
// Unlike unlibra.com, the built site does not load the Fontsource
// stylesheet (only the dev server does, as the cut files need a build): a
// visitor types nothing, so every character the pages show is known at
// build time and the cut files hold all of them. The Fontsource files are
// only the source of the cut. The build fails when a stylesheet in dist/
// defines the family, so the full files are not shipped by mistake.
//
// The cut files keep the font's name table, copyright and license URL (SIL
// Open Font License 1.1). dist/third-party-licenses.txt has the full text.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import subsetFont from "subset-font";

/** The family of the cut files. */
export const FAMILY = "Noto Sans JP Variable";

/**
 * Noto Sans JP's ascent (1.16em) is far larger than its descent (0.288em),
 * so its text sits about 0.07em below the middle of its line, and the icons
 * beside it look too high. These overrides keep the sum (1.448em, so the
 * line heights stay) and put the middle of the capitals and the kanji
 * (0.37em above the baseline) in the middle of the line. Same as unlibra.com.
 */
export const METRIC_OVERRIDES = {
  "ascent-override": "109.4%",
  "descent-override": "35.4%",
};

/**
 * How the font shows while it loads: text waits for the font for about
 * 100ms (a page opened from the cache usually has it by then, so the text
 * does not flash from a fallback font to the web font), then shows in a
 * fallback font, which the web font replaces only within about 3s. With
 * swap, every page showed the fallback font first, even from the cache.
 * Same as unlibra.com.
 */
export const FONT_DISPLAY = "fallback";

/** Marks the added rules in each page (tests/noto-sans-jp-subset.test.js). */
export const STYLE_ATTRIBUTE = "data-noto-sans-jp-subset";

/** An @font-face rule of the family in a built stylesheet. */
const FAMILY_RULE = new RegExp(
  `@font-face\\s*\\{[^}]*font-family:\\s*["']?${FAMILY}["']?[;}]`,
);

/** Parses `U+3042,U+3044-3046` into [first, last] code point pairs. */
export const parseUnicodeRange = (value) =>
  value.split(",").map((part) => {
    const [first, last = first] = part.trim().replace(/^U\+/i, "").split("-");
    if (first.includes("?")) {
      throw new Error(`unicode-range wildcards are not supported: ${part}`);
    }
    return [parseInt(first, 16), parseInt(last, 16)];
  });

/** Writes sorted code points as a unicode-range value, joining runs. */
export const formatUnicodeRange = (codePoints) => {
  const sorted = [...new Set(codePoints)].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    const hex = (cp) => cp.toString(16);
    parts.push(
      i === j ? `U+${hex(sorted[i])}` : `U+${hex(sorted[i])}-${hex(sorted[j])}`,
    );
    i = j;
  }
  return parts.join(",");
};

/** The @font-face rules of a Fontsource stylesheet: file and code points. */
export const parseFontsourceCss = (css) => {
  const faces = [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map((match) => {
    const body = match[1];
    const descriptor = (name) =>
      body.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1].trim();
    const file = descriptor("src")?.match(/url\(\.\/files\/([^)]+)\)/)?.[1];
    const range = descriptor("unicode-range");
    if (
      descriptor("font-family") !== `'${FAMILY}'` ||
      descriptor("font-style") !== "normal" ||
      descriptor("font-weight") !== "100 900" ||
      !file ||
      !range
    ) {
      throw new Error(`unexpected Fontsource rule: ${body.trim()}`);
    }
    return { file, ranges: parseUnicodeRange(range) };
  });
  if (faces.length === 0) throw new Error("no Fontsource rules found");
  return faces;
};

const listFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/**
 * The text a page shows: its <body> without <style> and <script>, without
 * tags, with entities decoded. Only this text is set in the font (the
 * <title> is shown by the browser in its own font). An unknown named entity
 * stops the build, so no shown character is missed.
 */
export const visibleText = (html) => {
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1];
  if (body === undefined) throw new Error("no <body>");
  return body
    .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, name) => {
      if (name[0] === "#") {
        return String.fromCodePoint(
          name[1].toLowerCase() === "x"
            ? parseInt(name.slice(2), 16)
            : parseInt(name.slice(1), 10),
        );
      }
      const char = ENTITIES[name.toLowerCase()];
      if (char === undefined) throw new Error(`unknown entity: ${entity}`);
      return char;
    });
};

/** The characters the pages show (whitespace aside). */
export const collectCodePoints = (files) => {
  const codePoints = new Set();
  for (const file of files) {
    for (const char of visibleText(readFileSync(file, "utf8"))) {
      if (/\s/.test(char)) continue;
      codePoints.add(char.codePointAt(0));
    }
  }
  return codePoints;
};

/**
 * A preload of one cut file, at the start of <head>: the browser fetches it
 * with the HTML instead of after the styles and the layout, so the text
 * mostly has the font within font-display's 100ms wait. Each character is in
 * one cut file only, the one the browser uses, and only shown characters
 * are cut, so no file is fetched for nothing. Fonts are always
 * fetched in CORS mode, so the preload needs `crossorigin` to be reused.
 */
export const preloadLink = (url) =>
  `<link rel="preload" href="${url}" as="font" type="font/woff2" crossorigin>`;

/** The @font-face rule of one cut file. */
const fontFaceRule = (url, codePoints) =>
  [
    "@font-face{",
    `font-family:'${FAMILY}';`,
    "font-style:normal;",
    `font-display:${FONT_DISPLAY};`,
    "font-weight:100 900;",
    ...Object.entries(METRIC_OVERRIDES).map(
      ([name, value]) => `${name}:${value};`,
    ),
    `src:url(${url}) format('woff2-variations');`,
    `unicode-range:${formatUnicodeRange(codePoints)};`,
    "}",
  ].join("");

/**
 * For the dev server only: the Fontsource rules with the same metric
 * overrides and font-display as the cut files, so `npm run dev` shows the
 * page as the build does (the cut files exist only after a build).
 */
const devFontsourceRules = () => ({
  name: "noto-sans-jp-dev-rules",
  enforce: /** @type {const} */ ("pre"),
  /** @param {string} code @param {string} id */
  transform(code, id) {
    if (!/@fontsource-variable[\\/]noto-sans-jp[\\/].*\.css/.test(id)) return;
    if (!code.includes("@font-face {") || !code.includes("font-display: swap;")) {
      throw new Error(`${id}: not the Fontsource rules this plugin expects`);
    }
    const overrides = Object.entries(METRIC_OVERRIDES)
      .map(([name, value]) => `  ${name}: ${value};`)
      .join("\n");
    return code
      .replaceAll("@font-face {", `@font-face {\n${overrides}`)
      .replaceAll("font-display: swap;", `font-display: ${FONT_DISPLAY};`);
  },
});

export default function notoSansJpSubset() {
  let projectRoot;

  return {
    name: "noto-sans-jp-subset",
    hooks: {
      "astro:config:setup": ({ config, command, injectScript, updateConfig }) => {
        projectRoot = fileURLToPath(config.root);
        if (command === "dev") {
          injectScript("page-ssr", 'import "@fontsource-variable/noto-sans-jp";');
          updateConfig({ vite: { plugins: [devFontsourceRules()] } });
        }
      },
      "astro:build:done": async ({ dir, logger }) => {
        const distDir = fileURLToPath(dir);
        const require = createRequire(join(projectRoot, "package.json"));
        const packageDir = dirname(
          require.resolve("@fontsource-variable/noto-sans-jp/package.json"),
        );
        const faces = parseFontsourceCss(
          readFileSync(join(packageDir, "index.css"), "utf8"),
        );

        const files = listFiles(distDir);
        for (const file of files.filter((f) => f.endsWith(".css"))) {
          if (FAMILY_RULE.test(readFileSync(file, "utf8"))) {
            throw new Error(
              `${relative(distDir, file)} defines ${FAMILY}: do not import the Fontsource stylesheet, the cut files replace it`,
            );
          }
        }
        const pages = files.filter((file) => file.endsWith(".html"));
        const codePoints = collectCodePoints(pages);

        mkdirSync(join(distDir, "_astro"), { recursive: true });
        const rules = [];
        const urls = [];
        let before = 0;
        let after = 0;
        // Some ranges overlap (the Japanese files hold ASCII too). For a
        // character, the browser uses the last defined face that has it, so
        // each character goes only to that face: no cut file is then made,
        // or preloaded, for characters the browser takes from another one.
        const remaining = new Set(codePoints);
        const assigned = new Map();
        for (const face of [...faces].reverse()) {
          const held = [...remaining].filter((cp) =>
            face.ranges.some(([first, last]) => cp >= first && cp <= last),
          );
          for (const cp of held) remaining.delete(cp);
          assigned.set(face, held);
        }
        for (const face of faces) {
          const { file } = face;
          const held = assigned.get(face);
          if (held.length === 0) continue;
          const source = readFileSync(join(packageDir, "files", file));
          const cut = await subsetFont(source, String.fromCodePoint(...held), {
            targetFormat: "woff2",
            // The license description and URL (OFL condition 2), besides
            // the default names (IDs 0-6: copyright, family and so on).
            preserveNameIds: [13, 14],
          });
          const hash = createHash("sha256")
            .update(cut)
            .digest("hex")
            .slice(0, 8);
          const name = `${file.replace(/\.woff2$/, "")}-subset.${hash}.woff2`;
          writeFileSync(join(distDir, "_astro", name), cut);
          urls.push(`/_astro/${name}`);
          rules.push(fontFaceRule(`/_astro/${name}`, held));
          before += source.length;
          after += cut.length;
        }

        const style = `<style ${STYLE_ATTRIBUTE}>${rules.join("")}</style>`;
        const preloads = urls.map(preloadLink).join("");
        for (const page of pages) {
          const html = readFileSync(page, "utf8");
          if (!html.includes("<head>") || !html.includes("</head>")) {
            throw new Error(`${relative(distDir, page)}: no <head> or </head>`);
          }
          writeFileSync(
            page,
            html
              .replace("<head>", `<head>${preloads}`)
              .replace("</head>", `${style}</head>`),
          );
        }
        logger.info(
          `${rules.length} Noto Sans JP files cut to ${codePoints.size} characters: ` +
            `${Math.round(before / 1024)} KB -> ${Math.round(after / 1024)} KB`,
        );
      },
    },
  };
}
