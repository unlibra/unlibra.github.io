// The tags for search engines, share cards and AI answers on the built top page:
// what they say, and that they agree with each other and with the page.
import { expect, test } from "@playwright/test";

const SITE_URL = "https://docs.unlibra.com/";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

/** The content of `<meta name|property=key>`. */
const meta = (page, key) =>
  page.locator(`meta[name="${key}"], meta[property="${key}"]`).getAttribute("content");

test("the title, the description and the canonical URL", async ({ page }) => {
  await expect(page).toHaveTitle("unlibra Docs");
  expect(await page.locator("h1").innerText()).toBe(await page.title());
  const description = await meta(page, "description");
  expect(description.length).toBeGreaterThanOrEqual(50);
  expect(description.length).toBeLessThanOrEqual(160);
  // The description names every project on the page.
  for (const name of await page.locator(".projects b").allInnerTexts()) expect(description).toContain(name);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", SITE_URL);
  expect(await meta(page, "robots")).toMatch(/^index, follow\b/);
  expect(await meta(page, "author")).toBe("unlibra");
});

test("the share cards: Open Graph and the small X card with unlibra.com's image", async ({ page }) => {
  const description = await meta(page, "description");
  expect(await meta(page, "og:type")).toBe("website");
  expect(await meta(page, "og:site_name")).toBe("unlibra Docs");
  expect(await meta(page, "og:title")).toBe("unlibra Docs");
  expect(await meta(page, "og:description")).toBe(description);
  expect(await meta(page, "og:url")).toBe(SITE_URL);
  expect(await meta(page, "og:locale")).toBe("en_US");
  expect(await meta(page, "og:image")).toBe("https://unlibra.com/ogp.png");
  expect(await meta(page, "og:image:type")).toBe("image/png");
  expect(await meta(page, "og:image:width")).toBe("1200");
  expect(await meta(page, "og:image:height")).toBe("630");
  expect(await meta(page, "og:image:alt")).toBeTruthy();
  expect(await meta(page, "twitter:card")).toBe("summary");
  expect(await meta(page, "twitter:title")).toBe("unlibra Docs");
  expect(await meta(page, "twitter:description")).toBe(description);
  expect(await meta(page, "twitter:image")).toBe("https://unlibra.com/ogp.png");
  expect(await meta(page, "twitter:image:alt")).toBe(await meta(page, "og:image:alt"));
});

test("the icons are served", async ({ page, request }) => {
  for (const selector of ['link[rel="icon"][sizes="32x32"]', 'link[rel="icon"][type="image/svg+xml"]', 'link[rel="apple-touch-icon"]']) {
    const href = await page.locator(selector).getAttribute("href");
    expect((await request.get(href)).status(), href).toBe(200);
  }
});

test("theme-color is the page's background (DESIGN.md 7.1)", async ({ page }) => {
  const [theme, background] = await page.evaluate(() => {
    const probe = document.createElement("i");
    document.body.append(probe);
    const color = (value) => {
      probe.style.color = value;
      return getComputedStyle(probe).color;
    };
    const result = [
      color(document.querySelector('meta[name="theme-color"]').content),
      getComputedStyle(document.documentElement).backgroundColor,
    ];
    probe.remove();
    return result;
  });
  // color-mix() resolves to color(srgb ...): compare as 0-255 channels.
  const channels = (value) => {
    const srgb = value.match(/^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)\)$/);
    if (srgb) return srgb.slice(1).map((v) => Math.round(Number(v) * 255));
    return value.match(/\d+/g).slice(0, 3).map(Number);
  };
  const [a, b] = [channels(theme), channels(background)];
  for (let i = 0; i < 3; i++) expect(Math.abs(a[i] - b[i])).toBeLessThanOrEqual(1);
});

test("the structured data lists the projects on the page", async ({ page }) => {
  const scripts = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(scripts).toHaveLength(1);
  const data = JSON.parse(scripts[0]);
  const site = data["@graph"].find((node) => node["@type"] === "WebSite");
  const collection = data["@graph"].find((node) => node["@type"] === "CollectionPage");
  expect(site.url).toBe(SITE_URL);
  expect(site.name).toBe("unlibra Docs");
  expect(site.description).toBe(await meta(page, "description"));
  expect(site.publisher).toMatchObject({ "@type": "Person", name: "unlibra", url: "https://unlibra.com" });
  expect(collection.isPartOf["@id"]).toBe(site["@id"]);
  const rows = await page
    .locator(".projects a")
    .evaluateAll((links) => links.map((a) => ({ url: a.href, name: a.querySelector("b").textContent })));
  const items = collection.mainEntity.itemListElement.map(({ url, name }) => ({ url, name }));
  expect(items).toEqual(rows);
});

test("the sitemaps reach the top page; llms.txt says what the page says", async ({ page, request }) => {
  const index = await (await request.get("/sitemap.xml")).text();
  expect(index).toContain("<loc>https://docs.unlibra.com/sitemap-portal.xml</loc>");
  const portal = await request.get("/sitemap-portal.xml");
  expect(portal.status()).toBe(200);
  expect(await portal.text()).toContain(`<loc>${SITE_URL}</loc>`);
  const lead = (await page.locator("header p").innerText()).replace(/\.$/, "");
  expect(await (await request.get("/llms.txt")).text()).toContain(`> ${lead} (https://unlibra.com).`);
});
