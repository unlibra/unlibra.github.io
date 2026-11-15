// Tells IndexNow which pages of the site a deploy changed: the same file in
// docs.unlibra.com and yorucha.link. The site's address is the canonical link
// of the built index.html, and the key is the <32 hex>.txt in the build.
// (On docs.unlibra.com, project manuals deploy and notify from their own
// repositories.) Run in two steps:
//
//   node .github/scripts/indexnow.mjs snapshot <dist> <dir>
//     Before the deploy: saves the page that is live now for every HTML
//     file of the build in <dist>, to <dir>. A page that is not live yet
//     (404) is left out.
//
//   node .github/scripts/indexnow.mjs submit <dist> <dir> [--dry-run]
//     After the deploy: sends every page of the build that is new, or whose
//     content differs from the saved one.
//
// A page counts as changed only when what a reader gets changed: the title,
// the description, and the text, links and images of <main>. A build
// rewrites the file names of scripts and styles, so the files alone would
// make every page look updated. 404.html is never sent, and neither is a
// page whose robots tag says noindex (DESIGN.md 10): while the site is out of
// search, this sends nothing.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/** The site's address and the IndexNow key, read from the build in <dist>. */
const siteOf = (dist) => {
  const html = readFileSync(join(dist, "index.html"), "utf8");
  const site = html.match(/<link rel="canonical" href="(https:\/\/[^"]+\/)"/)?.[1];
  if (!site) throw new Error(`${dist}/index.html: no canonical link to the site's root`);
  const keys = readdirSync(dist).filter((name) => /^[0-9a-f]{32}\.txt$/.test(name));
  if (keys.length !== 1) throw new Error(`${dist}: ${keys.length} IndexNow key files, not 1`);
  const key = keys[0].slice(0, -4);
  if (readFileSync(join(dist, keys[0]), "utf8").trim() !== key) {
    throw new Error(`${keys[0]}: the file must hold the key`);
  }
  return { site, key };
};

/** Whether a page asks to stay out of search. */
export const noindex = (html) =>
  /<meta name="robots" content="[^"]*\bnoindex\b/i.test(html);

/** What a reader gets from a page (see above). */
export const pageContent = (html) => {
  const main = html.match(/<main[\s>][\s\S]*?<\/main>/i)?.[0] ?? "";
  // Read <main> as tokens: a script or style element (skipped whole), a
  // tag, or text. Nothing is rendered: the result is only compared.
  const text = [];
  const tags = [];
  for (const [token, skipped] of main.matchAll(
    /<(script|style)\b[\s\S]*?<\/\1\s*>|<[^>]*>|[^<]+/gi,
  )) {
    if (skipped) continue;
    (token.startsWith("<") ? tags : text).push(token);
  }
  return JSON.stringify({
    title: html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "",
    description:
      html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "",
    text: text.join(" ").replace(/\s+/g, " ").trim(),
    links: tags.flatMap((tag) => tag.match(/\shref="([^"]*)"/)?.[1] ?? []),
    // The file name without its hash, and the alt.
    images: tags
      .filter((tag) => /^<img\s/i.test(tag))
      .map((img) => [
        (img.match(/\ssrc="([^"]*)"/)?.[1] ?? "").replace(
          /\.[\w-]{8}(\.\w+)$/,
          "$1",
        ),
        img.match(/\salt="([^"]*)"/)?.[1] ?? "",
      ]),
  });
};

/** The URL of a page file in the build. */
export const pageUrl = (site, path) =>
  site + path.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "");

/** The HTML files of the build, as paths relative to <dist> with "/". */
const pages = (dist) =>
  readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => relative(dist, join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
    .filter((path) => !/(^|\/)404\.html$/.test(path))
    .sort();

/** Saves the live version of every page of the build. */
export async function snapshot(dist, dir) {
  const { site } = siteOf(dist);
  for (const path of pages(dist)) {
    const response = await fetch(pageUrl(site, path), { redirect: "manual" });
    if (response.status === 404) continue;
    if (response.status !== 200) {
      throw new Error(`${pageUrl(site, path)} answered ${response.status}`);
    }
    const file = join(dir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, await response.text());
  }
}

/** The URLs of the pages that are new or changed against the snapshot. */
export function changedPages(dist, dir) {
  const { site } = siteOf(dist);
  return pages(dist)
    .filter((path) => !noindex(readFileSync(join(dist, path), "utf8")))
    .filter((path) => {
      let before;
      try {
        before = readFileSync(join(dir, path), "utf8");
      } catch {
        return true; // not live before the deploy
      }
      return pageContent(before) !== pageContent(readFileSync(join(dist, path), "utf8"));
    })
    .map((path) => pageUrl(site, path));
}

/** Sends URLs to IndexNow. Throws unless it answers 200 or 202. */
export async function submit(dist, urls) {
  const { site, key } = siteOf(dist);
  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(site).host,
      key,
      keyLocation: `${site}${key}.txt`,
      urlList: urls,
    }),
  });
  if (response.status !== 200 && response.status !== 202) {
    throw new Error(
      `IndexNow answered ${response.status}: ${await response.text()}`,
    );
  }
  return response.status;
}

const [command, dist, dir, flag] = process.argv.slice(2);
if (command === "snapshot") {
  await snapshot(dist, dir);
} else if (command === "submit") {
  const urls = changedPages(dist, dir);
  console.log(urls.join("\n") || "No page changed.");
  if (urls.length > 0 && flag !== "--dry-run") {
    console.log(`IndexNow: ${await submit(dist, urls)}`);
  }
} else if (command !== undefined) {
  throw new Error(`Unknown command: ${command}`);
}
