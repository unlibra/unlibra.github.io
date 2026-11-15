// DESIGN.md's rules, checked on the built page at 375px and 1280px wide
// (DESIGN.md 12). Each test names the section of DESIGN.md it checks. The same
// file in docs.unlibra.com and yorucha.link: it reads what the page shows
// from the page itself.
import { expect, test } from "@playwright/test";

import { site } from "../src/config/site.ts";

const WIDTHS = [375, 1280];
/** The system's color scheme: the page follows it (DESIGN.md 7.1). */
const SCHEMES = ["light", "dark"];

/** Opens the top page at `width` and waits for the web fonts. */
const open = async (page, path, width, colorScheme) => {
  await page.emulateMedia({ colorScheme });
  await page.setViewportSize({ width, height: 900 });
  await page.goto(path);
  await page.evaluate(() => document.fonts.ready);
};

/** Functions the checks below run in the page. */
const helpers = () => {
  /** [r, g, b] in 0-1 from a computed color: rgb(), rgba() or color(srgb). */
  const rgb = (value) => {
    const srgb = value.match(/^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)(?: \/ ([\d.]+))?\)$/);
    if (srgb) return { c: srgb.slice(1, 4).map(Number), a: srgb[4] === undefined ? 1 : Number(srgb[4]) };
    const legacy = value.match(/^rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)$/);
    if (legacy) {
      return {
        c: legacy.slice(1, 4).map((n) => Number(n) / 255),
        a: legacy[4] === undefined ? 1 : Number(legacy[4]),
      };
    }
    throw new Error(`Unreadable color: ${value}`);
  };
  const luminance = ([r, g, b]) => {
    const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  /**
   * The background behind `element`: the first opaque background color of it
   * or its ancestors, up to <html> (DESIGN.md 7.1: one color for the page).
   */
  const backgrounds = (element) => {
    for (let e = element; e; e = e.parentElement) {
      const { c, a } = rgb(getComputedStyle(e).backgroundColor);
      if (a === 1) return [c];
    }
    throw new Error("No opaque background up to <html>");
  };
  return { rgb, contrast, backgrounds };
};

/** The text and the icons under `root` (a locator) below the contrast of DESIGN.md 3, as readable lines. */
const contrastErrors = (root) =>
  root.evaluate((root, helpersSource) => {
    const { rgb, contrast, backgrounds } = new Function(`return (${helpersSource})()`)();
    const errors = [];
    let checked = 0;
    for (const element of [root, ...root.querySelectorAll("*")]) {
      if (!element.checkVisibility()) continue;
      const style = getComputedStyle(element);
      const ownText = [...element.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
      const counter = getComputedStyle(element, "::before").content.startsWith("counter(");
      const icon = element.matches("svg.go");
      if (!ownText && !counter && !icon) continue;
      const color = rgb(!ownText && counter ? getComputedStyle(element, "::before").color : style.color).c;
      const min = icon ? 3 : 4.5;
      checked++;
      for (const background of backgrounds(element)) {
        const ratio = contrast(color, background);
        if (ratio < min) {
          errors.push(
            `${element.tagName.toLowerCase()} "${element.textContent.trim().slice(0, 30)}": ${ratio.toFixed(2)}:1, under ${min}:1`,
          );
        }
      }
    }
    if (checked === 0) errors.push("no text or icon was checked");
    return errors;
  }, helpers.toString());

for (const { path } of site.pages)
for (const colorScheme of SCHEMES)
for (const width of WIDTHS) {
  test.describe(`${path}, ${colorScheme}, ${width}px`, () => {
    test.beforeEach(async ({ page }) => open(page, path, width, colorScheme));

    test("7.2: the section dots reach 3:1 on the background", async ({ page }) => {
      const ratios = await page.evaluate((helpersSource) => {
        const { rgb, contrast, backgrounds } = new Function(`return (${helpersSource})()`)();
        return [...document.querySelectorAll("h2")].map((h2) => {
          const dot = rgb(getComputedStyle(h2, "::before").backgroundColor).c;
          return { section: h2.textContent, ratio: Math.min(...backgrounds(h2).map((bg) => contrast(dot, bg))) };
        });
      }, helpers.toString());
      expect(ratios.length).toBeGreaterThan(0);
      for (const { section, ratio } of ratios) expect(ratio, section).toBeGreaterThanOrEqual(3);
    });

    test("2.1, 2.2: the sizes and the line heights of the text", async ({ page }) => {
      const errors = await page.evaluate(() => {
        const minimum = (ratio, size) => Math.ceil((ratio * size) / 4 - 1e-9) * 4;
        const errors = [];
        let checked = 0;
        const check = (label, style, lines, heading) => {
          checked++;
          const size = parseFloat(style.fontSize);
          const lineHeight = parseFloat(style.lineHeight);
          const mono = style.fontFamily.startsWith('"DM Mono"');
          const [role, ratio, exact] =
            heading && size > 14
              ? ["heading", size >= 36 ? 1.4 : 1.5, true]
              : mono
                ? ["mono", 1.5, true]
                : lines > 1
                  ? ["text", 1.7, true]
                  : ["label", 1.3, false];
          const min = minimum(ratio, size);
          const name = `${label} (${role}, ${size}px/${style.lineHeight}, ${lines} lines)`;
          if (size < 14) errors.push(`${name}: smaller than 14px`);
          if (mono && (size < 14 || size > 16)) errors.push(`${name}: monospace outside 14-16px`);
          if (!(lineHeight % 4 === 0)) errors.push(`${name}: not a multiple of 4px`);
          else if (exact ? lineHeight !== min : lineHeight < min) {
            errors.push(`${name}: expected ${exact ? "" : "at least "}${min}px`);
          }
        };
        for (const element of document.querySelectorAll("body *")) {
          if (element.closest("svg, script, style")) continue;
          if (!element.checkVisibility()) continue;
          const style = getComputedStyle(element);
          const texts = [...element.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
          if (texts.length) {
            const size = parseFloat(style.fontSize);
            const tops = [];
            for (const text of texts) {
              const range = document.createRange();
              range.selectNodeContents(text);
              for (const rect of range.getClientRects()) {
                if (rect.width >= 1 && !tops.some((top) => Math.abs(top - rect.top) < size / 2)) tops.push(rect.top);
              }
            }
            const label = `${element.tagName.toLowerCase()} "${element.textContent.trim().slice(0, 30)}"`;
            check(label, style, tops.length, !!element.closest("h1, h2, h3, h4, h5, h6"));
          }
          // The numbers of the projects are ::before counters: one line each.
          const before = getComputedStyle(element, "::before");
          if (before.content.startsWith("counter(")) {
            check(`${element.tagName.toLowerCase()}::before (the number)`, before, 1, false);
          }
        }
        return { errors, checked };
      });
      // The page's text was read: the heading, the lead, the section headings,
      // the names, and the projects' descriptions and numbers.
      const shown = await page.evaluate(
        () =>
          1 +
          document.querySelectorAll("header p, h2, section a b").length +
          2 * document.querySelectorAll(".projects a").length,
      );
      expect(errors.checked).toBeGreaterThanOrEqual(shown);
      expect(errors.errors).toEqual([]);
    });

    test("6.1: the fonts of unlibra.com, served from this site", async ({ page }) => {
      const fonts = await page.evaluate(() => {
        const faces = [...document.styleSheets]
          .flatMap((sheet) => [...sheet.cssRules])
          .filter((rule) => rule instanceof CSSFontFaceRule);
        const noto = faces.filter((f) => f.style.fontFamily.replace(/"/g, "") === "Noto Sans JP Variable");
        const mono = faces.filter((f) => f.style.fontFamily.replace(/"/g, "") === "DM Mono");
        const families = (elements, pseudo) => [
          ...new Set([...elements].map((e) => getComputedStyle(e, pseudo).fontFamily)),
        ];
        return {
          sans: families(document.querySelectorAll("h1, header p, section a b, .desc")),
          headings: families(document.querySelectorAll("h2")),
          numbers: families(document.querySelectorAll(".projects a"), "::before"),
          noto: noto.length,
          mono: mono.length,
          others: faces.length - noto.length - mono.length,
          overrides: [...new Set(noto.map((f) => `${f.style.ascentOverride} ${f.style.descentOverride}`))],
          display: [...new Set([...noto, ...mono].map((f) => f.style.fontDisplay))],
          loaded: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "")),
          origins: performance
            .getEntriesByType("resource")
            .filter((r) => /\.woff2?$/.test(new URL(r.name).pathname))
            .map((r) => new URL(r.name).origin),
        };
      });
      expect(fonts.sans).toEqual(['"Noto Sans JP Variable", sans-serif']);
      expect(fonts.headings).toEqual(['"DM Mono", monospace']);
      expect(fonts.numbers.every((f) => f === '"DM Mono", monospace')).toBe(true);
      expect(fonts.noto).toBeGreaterThan(0);
      expect(fonts.mono).toBeGreaterThan(0);
      expect(fonts.others).toBe(0);
      expect(fonts.overrides).toEqual(["109.4% 35.4%"]);
      expect(fonts.display).toEqual(["fallback"]);
      expect(fonts.loaded).toContain("Noto Sans JP Variable");
      expect(fonts.loaded).toContain("DM Mono");
      expect(fonts.origins.length).toBeGreaterThan(0);
      for (const origin of fonts.origins) expect(origin).toBe(new URL(page.url()).origin);
    });

    test("3: the contrast of the text and the icons", async ({ page }) => {
      expect(await contrastErrors(page.locator("body"))).toEqual([]);
    });

    test("3: the contrast on the hover ground of every row", async ({ page }) => {
      const rows = await page.locator("section a").all();
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        await row.hover();
        // Wait for the transitions (0.15s and 0.2s) to end.
        await page.waitForTimeout(300);
        expect(await contrastErrors(row), await row.innerText()).toEqual([]);
      }
    });

    test("4: the margins, the paddings and the gaps are multiples of 4px", async ({ page }) => {
      const errors = await page.evaluate(() => {
        const errors = [];
        const properties = [
          "margin-top",
          "margin-right",
          "margin-bottom",
          "margin-left",
          "padding-top",
          "padding-right",
          "padding-bottom",
          "padding-left",
          "row-gap",
          "column-gap",
        ];
        for (const element of document.querySelectorAll("body, body *")) {
          if (element.closest("svg") && element.tagName !== "svg") continue;
          // <main> is centered with margin: auto, which comes from the width.
          const auto = element.tagName === "MAIN";
          const style = getComputedStyle(element);
          for (const property of properties) {
            if (auto && /^margin-(left|right)$/.test(property)) continue;
            const value = style.getPropertyValue(property);
            if (value === "normal") continue;
            const px = parseFloat(value);
            if (Math.abs(px / 4 - Math.round(px / 4)) > 1e-6) {
              errors.push(`${element.tagName.toLowerCase()}.${element.className} ${property}: ${value}`);
            }
          }
        }
        return errors;
      });
      expect(errors).toEqual([]);
    });

    test("5.1: every link shows the focus ring in the primary color", async ({ page }) => {
      const count = await page.locator("a").count();
      expect(count).toBeGreaterThanOrEqual(3);
      const rings = [];
      for (let i = 0; i < count; i++) {
        await page.keyboard.press("Tab");
        rings.push(
          await page.evaluate(() => {
            const element = document.activeElement;
            const style = getComputedStyle(element);
            return {
              link: element.tagName === "A" ? element.textContent.trim().slice(0, 20) : element.tagName,
              ring: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
            };
          }),
        );
      }
      // The primary color of the scheme (DESIGN.md 7.1).
      const primary = await page.evaluate(() => {
        const probe = document.createElement("i");
        probe.style.color = "var(--primary)";
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      });
      for (const { link, ring } of rings) expect(ring, link).toBe(`solid 2px ${primary}`);
    });

    test("5.4: the rows are 44px high or more, the other links 24px square or more", async ({ page }) => {
      const sizes = await page.locator("a").evaluateAll((links) =>
        links.map((a) => {
          const { width, height } = a.getBoundingClientRect();
          return { link: a.textContent.trim().slice(0, 20), row: !!a.closest("section"), width, height };
        }),
      );
      for (const { link, row, width, height } of sizes) {
        expect(height, link).toBeGreaterThanOrEqual(row ? 44 : 24);
        expect(width, link).toBeGreaterThanOrEqual(24);
      }
    });

    test("5.5: one h1 and no skipped heading levels", async ({ page }) => {
      const levels = await page.locator("h1, h2, h3, h4, h5, h6").evaluateAll((hs) => hs.map((h) => Number(h.tagName[1])));
      expect(levels.filter((l) => l === 1)).toHaveLength(1);
      expect(levels[0]).toBe(1);
      for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1]).toBeLessThanOrEqual(1);
    });

    test("5.6: the icons and the logos are out of the accessibility tree", async ({ page }) => {
      for (const svg of await page.locator("svg").all()) await expect(svg).toHaveAttribute("aria-hidden", "true");
      for (const img of await page.locator("img").all()) await expect(img).toHaveAttribute("alt", "");
    });

    test("5.6: no motion with reduced motion", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const durations = await page
        .locator("section a, section a b, .go")
        .evaluateAll((elements) => elements.map((e) => getComputedStyle(e).transitionDuration));
      for (const duration of durations) expect(duration.split(", ").every((d) => d === "0s")).toBe(true);
      const row = page.locator("section a").first();
      await row.hover();
      expect(await row.locator(".go").evaluate((go) => getComputedStyle(go).transform)).toBe("none");
    });

    test("8.1: the heading is in the center", async ({ page }) => {
      const centers = await page.evaluate(() => {
        const center = (e) => {
          const range = document.createRange();
          range.selectNodeContents(e);
          const { left, right } = range.getBoundingClientRect();
          return (left + right) / 2;
        };
        const main = document.querySelector("main").getBoundingClientRect();
        const lead = document.querySelector("header p");
        return {
          main: (main.left + main.right) / 2,
          h1: center(document.querySelector("h1")),
          lead: lead ? center(lead) : null,
        };
      });
      expect(Math.abs(centers.h1 - centers.main)).toBeLessThanOrEqual(1);
      if (centers.lead !== null) expect(Math.abs(centers.lead - centers.main)).toBeLessThanOrEqual(1);
    });

    test("8: no horizontal scroll", async ({ page }) => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}
