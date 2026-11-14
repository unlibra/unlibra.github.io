// Tells IndexNow which pages of docs.unlibra.com a deploy changed. Project
// manuals deploy and notify from their own repositories. Run by
// .github/workflows/deploy.yml in two steps:
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
// make every page look updated. 404.html is never sent.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const SITE = "https://docs.unlibra.com/";
const KEY = "67426e8c4c044cef96ebc2f901da0154";

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
export const pageUrl = (path) =>
  SITE + path.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "");

/** The HTML files of the build, as paths relative to <dist> with "/". */
const pages = (dist) =>
  readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".html"))
    .map((entry) => relative(dist, join(entry.parentPath, entry.name)).replaceAll("\\", "/"))
    .filter((path) => !/(^|\/)404\.html$/.test(path))
    .sort();

/** Saves the live version of every page of the build. */
export async function snapshot(dist, dir) {
  for (const path of pages(dist)) {
    const response = await fetch(pageUrl(path), { redirect: "manual" });
    if (response.status === 404) continue;
    if (response.status !== 200) {
      throw new Error(`${pageUrl(path)} answered ${response.status}`);
    }
    const file = join(dir, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, await response.text());
  }
}

/** The URLs of the pages that are new or changed against the snapshot. */
export function changedPages(dist, dir) {
  return pages(dist)
    .filter((path) => {
      let before;
      try {
        before = readFileSync(join(dir, path), "utf8");
      } catch {
        return true; // not live before the deploy
      }
      return pageContent(before) !== pageContent(readFileSync(join(dist, path), "utf8"));
    })
    .map(pageUrl);
}

/** Sends URLs to IndexNow. Throws unless it answers 200 or 202. */
export async function submit(urls) {
  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(SITE).host,
      key: KEY,
      keyLocation: `${SITE}${KEY}.txt`,
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
    console.log(`IndexNow: ${await submit(urls)}`);
  }
} else if (command !== undefined) {
  throw new Error(`Unknown command: ${command}`);
}
