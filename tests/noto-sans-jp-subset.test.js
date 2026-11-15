// Noto Sans JP cut down to the site's characters
// (scripts/noto-sans-jp-subset.mjs), checked against dist/.
// `npm test` builds first (pretest).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, globSync, readFileSync, statSync } from "node:fs";import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  FAMILY,
  FONT_DISPLAY,
  METRIC_OVERRIDES,
  STYLE_ATTRIBUTE,
  preloadLink,
  visibleText,
  formatUnicodeRange,
  parseFontsourceCss,
  parseUnicodeRange,
} from "../scripts/noto-sans-jp-subset.mjs";
import { cmapCharacters, nameOf, woff2Tables } from "./helpers/woff2.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const fontsource = join(root, "node_modules/@fontsource-variable/noto-sans-jp");

if (!existsSync(join(dist, "index.html"))) {
  throw new Error("dist/ not found. Run `npm run build` before `npm test`.");
}

const pages = globSync("**/*.html", { cwd: dist });
const readDist = (path) => readFileSync(join(dist, path), "utf8");
const sourceFaces = parseFontsourceCss(
  readFileSync(join(fontsource, "index.css"), "utf8"),
);
const inRanges = (ranges, cp) =>
  ranges.some(([first, last]) => cp >= first && cp <= last);

/** The added rules of a page: [{ url, ranges, rule }]. */
const subsetFaces = (html) => {
  const styles = [
    ...html.matchAll(
      new RegExp(`<style ${STYLE_ATTRIBUTE}>([\\s\\S]*?)</style>`, "g"),
    ),
  ];
  assert.equal(styles.length, 1, "one added <style>");
  return [...styles[0][1].matchAll(/@font-face\{[^}]*\}/g)].map(([rule]) => ({
    rule,
    url: rule.match(/src:url\(([^)]+)\)/)[1],
    ranges: parseUnicodeRange(rule.match(/unicode-range:([^;]+);/)[1]),
  }));
};

test("unicode-range values are parsed and written back with runs joined", () => {
  assert.deepEqual(parseUnicodeRange("U+3042,U+3044-3046"), [
    [0x3042, 0x3042],
    [0x3044, 0x3046],
  ]);
  assert.equal(
    formatUnicodeRange([0x3046, 0x3042, 0x3044, 0x3045, 0x3042]),
    "U+3042,U+3044-3046",
  );
  assert.throws(() => parseUnicodeRange("U+30??"), /wildcards/);
});

test("every page adds the cut files after its stylesheets, at the end of <head>", () => {
  assert.ok(pages.length > 0);
  for (const page of pages) {
    const html = readFileSync(join(dist, page), "utf8");
    const head = html.slice(0, html.indexOf("</head>"));
    const style = head.lastIndexOf(`<style ${STYLE_ATTRIBUTE}>`);
    assert.ok(style >= 0, page);
    assert.ok(head.lastIndexOf('rel="stylesheet"') < style, page);
    assert.match(head.slice(style), /^<style [^>]*>[^<]*<\/style>$/, page);
  }
});

test("each character is in one cut file only, and every page preloads every cut file at the start of <head>", () => {
  for (const page of pages) {
    const html = readDist(page);
    const faces = subsetFaces(html);
    const seen = new Set();
    for (const { url, ranges } of faces) {
      for (const [first, last] of ranges) {
        for (let cp = first; cp <= last; cp++) {
          assert.ok(!seen.has(cp), `${page}: U+${cp.toString(16)} twice (${url})`);
          seen.add(cp);
        }
      }
    }
    const preloads = faces.map(({ url }) => preloadLink(url)).join("");
    assert.ok(html.includes(`<head>${preloads}`), page);
    assert.equal(html.split('rel="preload"').length - 1, faces.length, page);
  }
});

test("dist/ ships no Noto Sans JP Fontsource files or rules and no scripts: only the cut files", () => {
  // DM Mono (the section headings, DESIGN.md 6.1) ships as Fontsource's own files.
  for (const file of globSync("**/*.woff2", { cwd: dist })) {
    assert.match(file, /(-subset\.[0-9a-f]{8}|^_astro[\\/]dm-mono-.+)\.woff2$/, file);
  }
  for (const file of globSync("**/*.css", { cwd: dist })) {
    assert.doesNotMatch(
      readDist(file),
      new RegExp(`@font-face[^}]*font-family:\\s*["']?${FAMILY}`),
      file,
    );
  }
  // The structured data (JSON-LD) is data, not a script: the only <script> a page may have.
  for (const page of pages) {
    assert.doesNotMatch(readDist(page), /<script(?! type="application\/ld\+json">)/, page);
  }
});

test("the shown text is the body's text, without styles, scripts and tags, entities decoded", () => {
  assert.equal(
    visibleText(
      '<html><head><title>T</title></head><body class="b"><style>a{}</style>' +
        '<script>x()</script><a href="/">A &amp; B &#x2013; &#64;</a></body></html>',
    ),
    "A & B – @",
  );
  assert.throws(() => visibleText("<body>&bogus;</body>"), /unknown entity/);
  assert.throws(() => visibleText("<p>no body</p>"), /no <body>/);
});

test("the cut files cover every character every page shows that Noto Sans JP has", () => {
  for (const page of pages) {
    const html = readFileSync(join(dist, page), "utf8");
    const faces = subsetFaces(html);
    for (const char of new Set(visibleText(html).replace(/\s/g, ""))) {
      const cp = char.codePointAt(0);
      if (!sourceFaces.some(({ ranges }) => inRanges(ranges, cp))) continue;
      assert.ok(
        faces.some(({ ranges }) => inRanges(ranges, cp)),
        `${page}: ${char} (U+${cp.toString(16)})`,
      );
    }
  }
});

test("the cut files have the font's descriptors, FONT_DISPLAY and the metric overrides", () => {
  const faces = subsetFaces(readFileSync(join(dist, "index.html"), "utf8"));
  assert.ok(faces.length > 0);
  for (const { rule } of faces) {
    assert.ok(rule.includes(`font-family:'${FAMILY}';`), rule);
    assert.ok(rule.includes("font-weight:100 900;"), rule);
    assert.ok(rule.includes(`font-display:${FONT_DISPLAY};`), rule);
    assert.ok(rule.includes("format('woff2-variations')"), rule);
    for (const [name, value] of Object.entries(METRIC_OVERRIDES)) {
      assert.ok(rule.includes(`${name}:${value};`), rule);
    }
  }
});

test("each cut file is in dist/, smaller than its source, keeps the license and has the glyphs of its range", () => {
  const faces = subsetFaces(readFileSync(join(dist, "index.html"), "utf8"));
  for (const { url, ranges } of faces) {
    const match = url.match(/^\/_astro\/(.+)-subset\.[0-9a-f]{8}\.woff2$/);
    assert.ok(match, url);
    const source = sourceFaces.find(({ file }) => file === `${match[1]}.woff2`);
    assert.ok(source, url);
    const path = join(dist, url);
    const sourcePath = join(fontsource, "files", source.file);
    assert.ok(statSync(path).size < statSync(sourcePath).size, url);

    const tables = woff2Tables(readFileSync(path));
    assert.match(nameOf(tables.name, 1), /^Noto Sans JP/);
    assert.match(nameOf(tables.name, 14), /scripts\.sil\.org\/OFL/);

    // Every character of the range that the source has (Noto Sans JP lacks
    // some, such as ł; the browser falls back for those).
    const has = cmapCharacters(tables.cmap);
    const sourceHas = cmapCharacters(
      woff2Tables(readFileSync(sourcePath)).cmap,
    );
    let checked = 0;
    for (const [first, last] of ranges) {
      for (let cp = first; cp <= last; cp++) {
        assert.ok(inRanges(source.ranges, cp), `${url}: U+${cp.toString(16)}`);
        const char = String.fromCodePoint(cp);
        if (sourceHas.has(char)) {
          assert.ok(has.has(char), `${url}: U+${cp.toString(16)}`);
          checked++;
        }
      }
    }
    assert.ok(
      checked > 0 || url.includes("latin-ext"),
      `${url}: no glyph checked`,
    );
  }
});
