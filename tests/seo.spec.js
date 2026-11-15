// The tags for search engines, share cards and AI answers on the built page,
// checked against src/config/site.ts, and the crawl files (robots.txt,
// sitemap.xml, llms.txt). The same file in docs.unlibra.com and yorucha.link.
import { readdirSync, readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { site } from "../src/config/site.ts";

const indexed = !/\bnoindex\b/.test(site.robots);

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

/** The content of `<meta name|property=key>`. */
const meta = (page, key) =>
  page.locator(`meta[name="${key}"], meta[property="${key}"]`).getAttribute("content");

/** The names and addresses of every row on the page. */
const rows = (page) =>
  page.locator("section a").evaluateAll((links) => links.map((a) => ({ name: a.querySelector("b").textContent, url: a.href })));

test("the title, the description and the canonical URL", async ({ page }) => {
  await expect(page).toHaveTitle(site.name);
  expect(await page.locator("h1").innerText()).toBe(site.name);
  expect(await meta(page, "description")).toBe(site.description);
  expect(site.description.length).toBeLessThanOrEqual(160);
  // The description names the projects, or every link on a page without projects.
  const projects = await page.locator(".projects b").allInnerTexts();
  const names = projects.length > 0 ? projects : (await rows(page)).map((r) => r.name);
  for (const name of names) expect(site.description).toContain(name);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", site.url);
  expect(await meta(page, "robots")).toBe(site.robots);
  expect(await meta(page, "author")).toBe(site.author.name);
});

test("robots.txt agrees with the robots tag (DESIGN.md 10)", async ({ request }) => {
  const lines = (await (await request.get("/robots.txt")).text())
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  if (indexed) {
    // In search: every crawler in, and the sitemap named.
    expect(lines).toEqual(["User-agent: *", "Allow: /", `Sitemap: ${site.url}sitemap.xml`]);
  } else {
    // Out of search: only Twitterbot, for the X card.
    expect(lines).toEqual(["User-agent: Twitterbot", "Allow: /", "User-agent: *", "Disallow: /"]);
  }
});

test("the share cards: Open Graph and the small X card", async ({ page }) => {
  expect(await meta(page, "og:type")).toBe(site.page === "ProfilePage" ? "profile" : "website");
  expect(await meta(page, "og:site_name")).toBe(site.name);
  expect(await meta(page, "og:title")).toBe(site.name);
  expect(await meta(page, "og:description")).toBe(site.description);
  expect(await meta(page, "og:url")).toBe(site.url);
  expect(await meta(page, "og:locale")).toBe(site.ogLocale);
  expect(await meta(page, "og:image")).toBe(site.ogImage.url);
  expect(await meta(page, "og:image:type")).toBe(site.ogImage.type);
  expect(await meta(page, "og:image:width")).toBe(String(site.ogImage.width));
  expect(await meta(page, "og:image:height")).toBe(String(site.ogImage.height));
  expect(await meta(page, "og:image:alt")).toBe(site.ogImage.alt);
  expect(await meta(page, "twitter:card")).toBe("summary");
  expect(await meta(page, "twitter:title")).toBe(site.name);
  expect(await meta(page, "twitter:description")).toBe(site.description);
  expect(await meta(page, "twitter:image")).toBe(site.ogImage.url);
  expect(await meta(page, "twitter:image:alt")).toBe(site.ogImage.alt);
});

test("the icons are served", async ({ page, request }) => {
  const hrefs = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"]').evaluateAll((links) =>
    links.map((l) => l.getAttribute("href")),
  );
  expect(hrefs).toContain(site.icons.svg);
  for (const href of hrefs) expect((await request.get(href)).status(), href).toBe(200);
  // A share image on this site is served too.
  if (site.ogImage.url.startsWith(site.url)) {
    expect((await request.get(new URL(site.ogImage.url).pathname)).status()).toBe(200);
  }
});

test("the structured data says what the page is and lists its rows", async ({ page }) => {
  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(scripts).toHaveLength(1);
  const graph = JSON.parse(scripts[0])["@graph"];
  const website = graph.find((node) => node["@type"] === "WebSite");
  const thisPage = graph.find((node) => node["@type"] === site.page);
  expect(website).toMatchObject({ url: site.url, name: site.name, description: site.description });
  expect(website.publisher).toMatchObject({ "@type": "Person", name: site.author.name, url: site.author.url });
  expect(thisPage).toMatchObject({ url: site.url, isPartOf: { "@id": website["@id"] } });
  const shown = await rows(page);
  if (site.page === "ProfilePage") {
    expect(thisPage.mainEntity).toMatchObject({ "@type": "Person", name: site.author.name });
    for (const { url } of shown) expect(thisPage.mainEntity.sameAs).toContain(url);
  } else {
    expect(thisPage.mainEntity.itemListElement.map(({ name, url }) => ({ name, url }))).toEqual(shown);
  }
});

test("the crawl files: the sitemap reaches the page, llms.txt and the IndexNow key", async ({ request }) => {
  // sitemap.xml lists the page, directly or in a sitemap of this build.
  const index = await (await request.get("/sitemap.xml")).text();
  const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const pages = [...locs(index)];
  if (index.includes("<sitemapindex")) {
    for (const loc of locs(index)) {
      const child = await request.get(new URL(loc).pathname);
      if (child.ok()) pages.push(...locs(await child.text()));
    }
  }
  expect(pages).toContain(site.url);
  const llms = await request.get("/llms.txt");
  expect(llms.status()).toBe(200);
  expect(await llms.text()).toMatch(/^# .+\n\n> .+/);
  // The IndexNow key: site.indexNowKey's file, holding the key and served; no
  // key file on a site without IndexNow.
  const keys = readdirSync("dist").filter((name) => /^[0-9a-f]{32}\.txt$/.test(name));
  if (site.indexNowKey) {
    expect(keys).toEqual([`${site.indexNowKey}.txt`]);
    expect(readFileSync(`dist/${keys[0]}`, "utf8").trim()).toBe(site.indexNowKey);
    expect((await request.get(`/${keys[0]}`)).status()).toBe(200);
  } else {
    expect(keys).toEqual([]);
  }
});
