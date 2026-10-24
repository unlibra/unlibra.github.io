// Tells IndexNow which pages of docs.unlibra.com a commit changed: the top
// page and the manuals pushed here as built HTML (Mururu Blink & LipSync).
// Run by .github/workflows/indexnow.yml after GitHub Pages has published
// the commit:
//
//   node .github/scripts/indexnow.mjs <commit>
//
// An HTML file the commit added or deleted is sent. One it changed is sent
// only when what a reader gets changed: the title, the description, and the
// text, links and images of <main>. A VitePress build rewrites every page
// when its theme changes (the file names of the scripts), so the files alone
// would make every page look updated. 404.html is never sent.
import { execFileSync } from "node:child_process";

const SITE = "https://docs.unlibra.com/";
const KEY = "67426e8c4c044cef96ebc2f901da0154";

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 26 });

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

/** The URL of a page file, as cleanUrls serves it. */
export const pageUrl = (path) =>
  SITE + path.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "");

/** The URLs of the pages that the commit changed. */
export function changedPages(commit) {
  const urls = [];
  const lines = git(
    "diff",
    "--name-status",
    "--no-renames",
    `${commit}^`,
    commit,
    "--",
    "*.html",
  )
    .split("\n")
    .filter(Boolean);
  for (const line of lines) {
    const [status, path] = line.split("\t");
    if (/(^|\/)404\.html$/.test(path)) continue;
    if (
      status !== "M" ||
      pageContent(git("show", `${commit}^:${path}`)) !==
        pageContent(git("show", `${commit}:${path}`))
    ) {
      urls.push(pageUrl(path));
    }
  }
  return urls.sort();
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

const [commit, flag] = process.argv.slice(2);
if (commit) {
  const urls = changedPages(commit);
  console.log(urls.join("\n") || "No page changed.");
  if (urls.length > 0 && flag !== "--dry-run") {
    console.log(`IndexNow: ${await submit(urls)}`);
  }
}
