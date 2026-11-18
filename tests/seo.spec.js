// The tags for search engines, share cards and AI answers on every built page,
// checked against src/config/site.ts, and each page's crawl files (robots.txt,
// sitemap.xml, llms.txt, at public/ + its path; served at its host's root).
// The same file in docs.unlibra.com and yorucha.link.
import { readdirSync, readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { site } from "../src/config/site.ts";

/** The content of `<meta name|property=key>`. */
const meta = (page, key) =>
  page.locator(`meta[name="${key}"], meta[property="${key}"]`).getAttribute("content");

/** The names and addresses of every row on the page. */
const rows = (page) =>
  page.locator("section a").evaluateAll((links) => links.map((a) => ({ name: a.querySelector("b").textContent, url: a.href })));

for (const p of site.pages) {
  test.describe(`${p.path} (${p.url})`, () => {
    const indexed = !/\bnoindex\b/.test(p.robots);
    /** The build's path of a file at the root of the page's host: site.shared at the root, the others at the page's path. */
    const local = (file) => (site.shared?.includes(file) ? file : `${p.path}${file.replace(/^\//, "")}`);

    test.beforeEach(async ({ page }) => {
      await page.goto(p.path);
    });

    test("the title, the description and the canonical URL", async ({ page }) => {
      await expect(page).toHaveTitle(p.name);
      expect(await page.locator("h1").innerText()).toBe(p.name);
      expect(await meta(page, "description")).toBe(p.description);
      expect(p.description.length).toBeLessThanOrEqual(160);
      // The description names the projects, or every link on a page without projects.
      const projects = await page.locator(".projects b").allInnerTexts();
      const names = projects.length > 0 ? projects : (await rows(page)).map((r) => r.name);
      for (const name of names) expect(p.description).toContain(name);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", p.url);
      expect(await meta(page, "robots")).toBe(p.robots);
      expect(await meta(page, "author")).toBe(p.author.name);
    });

    test("robots.txt agrees with the robots tag (DESIGN.md 10)", async ({ request }) => {
      const lines = (await (await request.get(local("/robots.txt"))).text())
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"));
      if (indexed) {
        // In search: every crawler in, and the sitemap named.
        expect(lines).toEqual(["User-agent: *", "Allow: /", `Sitemap: ${p.url}sitemap.xml`]);
      } else {
        // Out of search: only Twitterbot, for the X card.
        expect(lines).toEqual(["User-agent: Twitterbot", "Allow: /", "User-agent: *", "Disallow: /"]);
      }
    });

    test("the share cards: Open Graph and the small X card", async ({ page }) => {
      expect(await meta(page, "og:type")).toBe(p.page === "ProfilePage" ? "profile" : "website");
      expect(await meta(page, "og:site_name")).toBe(p.name);
      expect(await meta(page, "og:title")).toBe(p.name);
      expect(await meta(page, "og:description")).toBe(p.description);
      expect(await meta(page, "og:url")).toBe(p.url);
      expect(await meta(page, "og:locale")).toBe(p.ogLocale);
      expect(await meta(page, "og:image")).toBe(p.ogImage.url);
      expect(await meta(page, "og:image:type")).toBe(p.ogImage.type);
      expect(await meta(page, "og:image:width")).toBe(String(p.ogImage.width));
      expect(await meta(page, "og:image:height")).toBe(String(p.ogImage.height));
      expect(await meta(page, "og:image:alt")).toBe(p.ogImage.alt);
      expect(await meta(page, "twitter:card")).toBe("summary");
      expect(await meta(page, "twitter:title")).toBe(p.name);
      expect(await meta(page, "twitter:description")).toBe(p.description);
      expect(await meta(page, "twitter:image")).toBe(p.ogImage.url);
      expect(await meta(page, "twitter:image:alt")).toBe(p.ogImage.alt);
    });

    test("the icons and the share image are served", async ({ page, request }) => {
      const hrefs = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll((links) =>
        links.map((l) => l.getAttribute("href")),
      );
      expect(hrefs).toContain(p.icons.svg);
      for (const href of hrefs) expect((await request.get(local(href))).status(), href).toBe(200);
      // favicon.ico has no tag, for browsers without SVG icons to find at the root.
      expect(hrefs.filter((href) => href.endsWith(".ico"))).toEqual([]);
      expect((await request.get(local("/favicon.ico"))).status()).toBe(200);
      if (p.ogImage.url.startsWith(p.url)) {
        expect((await request.get(local(new URL(p.ogImage.url).pathname))).status()).toBe(200);
      }
    });

    test("the structured data says what the page is and lists its rows", async ({ page }) => {
      const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
      expect(scripts).toHaveLength(1);
      const graph = JSON.parse(scripts[0])["@graph"];
      const website = graph.find((node) => node["@type"] === "WebSite");
      const thisPage = graph.find((node) => node["@type"] === p.page);
      expect(website).toMatchObject({ url: p.url, name: p.name, description: p.description });
      expect(website.publisher).toMatchObject({ "@type": "Person", name: p.author.name, url: p.author.url });
      expect(thisPage).toMatchObject({ url: p.url, isPartOf: { "@id": website["@id"] } });
      const shown = await rows(page);
      if (p.page === "ProfilePage") {
        expect(thisPage.mainEntity).toMatchObject({ "@type": "Person", name: p.author.name });
        for (const { url } of shown) expect(thisPage.mainEntity.sameAs).toContain(url);
      } else {
        expect(thisPage.mainEntity.itemListElement.map(({ name, url }) => ({ name, url }))).toEqual(shown);
      }
    });

    test("the crawl files: the sitemap reaches the page, and llms.txt", async ({ request }) => {
      // sitemap.xml lists the page, directly or in a sitemap of this build.
      const index = await (await request.get(local("/sitemap.xml"))).text();
      const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      const pages = [...locs(index)];
      if (index.includes("<sitemapindex")) {
        for (const loc of locs(index)) {
          const child = await request.get(local(new URL(loc).pathname));
          if (child.ok()) pages.push(...locs(await child.text()));
        }
      }
      expect(pages).toContain(p.url);
      const llms = await request.get(local("/llms.txt"));
      expect(llms.status()).toBe(200);
      expect(await llms.text()).toMatch(/^# .+\n\n> .+/);
    });
  });
}

test("the IndexNow key: site.indexNowKey's file, holding the key and served; none without it", async ({ request }) => {
  const keys = readdirSync("dist").filter((name) => /^[0-9a-f]{32}\.txt$/.test(name));
  if (site.indexNowKey) {
    expect(keys).toEqual([`${site.indexNowKey}.txt`]);
    expect(readFileSync(`dist/${keys[0]}`, "utf8").trim()).toBe(site.indexNowKey);
    expect((await request.get(`/${keys[0]}`)).status()).toBe(200);
  } else {
    expect(keys).toEqual([]);
  }
});

test("one page at /, and every page at its own path", () => {
  const paths = site.pages.map((p) => p.path);
  expect(paths).toContain("/");
  expect(new Set(paths).size).toBe(paths.length);
  for (const path of paths) expect(readdirSync(`dist${path}`)).toContain("index.html");
});
