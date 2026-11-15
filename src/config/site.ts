// What this site puts in the shared page (DESIGN.md 0). docs.unlibra.com and
// yorucha.link have the same page, styles, scripts and tests; only this file,
// src/content/projects/*.md and public/ differ.

/** The logos of src/assets/logos/<logo>.svg. */
export type Logo = "github" | "unlibra" | "x" | "booth" | "youtube";

/** The colors a section can take: Japanese traditional colors (DESIGN.md 7.2). */
export type SectionColor = "shinbashi" | "ouni" | "fujimurasaki";

/** A row to another site: the logo, the name and ↗ (DESIGN.md 9.3). */
export type LinkRow = {
  name: string;
  href: `https://${string}`;
  logo: Logo;
};

/**
 * A section: its heading and color, and its rows. A "projects" section shows
 * src/content/projects/*.md (pages on this site: number, name, description, >);
 * a "links" section shows its own links (other sites: logo, name, ↗).
 */
export type Section =
  | { kind: "projects"; label: string; color: SectionColor }
  | { kind: "links"; label: string; color: SectionColor; links: readonly LinkRow[] };

export type Site = {
  lang: "en" | "ja";
  /** The locale for Open Graph. */
  ogLocale: "en_US" | "ja_JP";
  /** The address of the page: the canonical link, Open Graph and the structured data. */
  url: `https://${string}/`;
  /** The heading, and the title in the browser tab, in search results and on share cards. */
  name: string;
  /** The line below the heading. Left out, the page has none. */
  lead?: string;
  /**
   * For search results, share cards and the structured data. It names every
   * project, or every link on a page without projects (tests/seo.spec.js).
   */
  description: string;
  /** The owner: the author of the page and, on a profile page, its subject. */
  author: { name: string; url: `https://${string}`; sameAs: readonly `https://${string}`[] };
  /** What the page is, for the structured data and og:type (website or profile). */
  page: "CollectionPage" | "ProfilePage";
  /** The icons in public/. The SVG one is required. */
  icons: { svg: `/${string}.svg`; ico?: `/${string}.ico`; appleTouch?: `/${string}.png` };
  /** The share image, on the small card (twitter:card summary). */
  ogImage: { url: `https://${string}`; type: "image/png"; width: number; height: number; alt: string };
  /**
   * The robots tag. With "noindex", public/robots.txt must keep every crawler
   * but Twitterbot out; without it, robots.txt must let them in and name the
   * sitemap (tests/seo.spec.js). These two are all that differ between a page
   * in search and one out of it (DESIGN.md 10).
   */
  robots: string;
  /**
   * The IndexNow key, when the site uses IndexNow: public/<key>.txt holds it
   * (tests/seo.spec.js). Left out, the site has no key file.
   */
  indexNowKey?: string;
  /** The sections, in this order. */
  sections: readonly Section[];
};

export const site: Site = {
  lang: "en",
  ogLocale: "en_US",
  url: "https://docs.unlibra.com/",
  name: "unlibra Docs",
  lead: "Guides and references for the libraries and tools by unlibra.",
  description:
    "Guides and references for the libraries and tools by unlibra: tkinter-unblur, i18n-tiny and Mururu Blink & LipSync.",
  author: {
    name: "unlibra",
    url: "https://unlibra.com",
    sameAs: ["https://github.com/unlibra", "https://unlibra.booth.pm/"],
  },
  page: "CollectionPage",
  // The same icons as unlibra.com (the files are copies of its own).
  icons: { svg: "/favicon.svg", ico: "/favicon.ico", appleTouch: "/apple-touch-icon.png" },
  // unlibra.com's image: the symbol is in the middle, so the small card's square crop keeps it whole.
  ogImage: {
    url: "https://unlibra.com/ogp.png",
    type: "image/png",
    width: 1200,
    height: 630,
    alt: "The unlibra symbol",
  },
  robots: "index, follow, max-snippet:-1, max-image-preview:large",
  // .github/scripts/indexnow.mjs sends the top page with it. The project manuals
  // (i18n-tiny, tkinter-unblur, mururu-blink-lipsync) send their own pages from
  // their repositories with the same key, so the file must stay.
  indexNowKey: "67426e8c4c044cef96ebc2f901da0154",
  sections: [
    { kind: "projects", label: "PROJECTS", color: "shinbashi" },
    {
      kind: "links",
      label: "SEE ALSO",
      color: "ouni",
      links: [
        { name: "Portfolio", href: "https://unlibra.com/", logo: "unlibra" },
        { name: "GitHub", href: "https://github.com/unlibra", logo: "github" },
      ],
    },
  ],
};
