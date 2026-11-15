// The site settings. The projects themselves are src/content/projects/*.md, one file each.

/** The logos a link to another site can carry. index.astro draws each one. */
export type Logo = "github" | "unlibra";

export type SeeAlsoLink = {
  name: string;
  /** An https:// URL on another site. */
  href: `https://${string}`;
  logo: Logo;
};

export const site = {
  lang: "en",
  /** The locale for Open Graph. */
  ogLocale: "en_US",
  /** The address of the page, for the canonical link, Open Graph and the structured data. */
  url: "https://docs.unlibra.com/",
  /** The title in the browser tab, in search results and on share cards. */
  title: "unlibra Docs",
  /** The heading of the page. */
  name: "unlibra Docs",
  /** The line below the heading. The page's description adds the names of the projects to it. */
  lead: "Guides and references for the libraries and tools by unlibra.",
  /** The maker, as unlibra.com describes it in its structured data. */
  author: {
    name: "unlibra",
    url: "https://unlibra.com",
    sameAs: ["https://github.com/unlibra", "https://unlibra.booth.pm/"],
  },
  /**
   * The share image: unlibra.com's (the unlibra symbol in the middle), so the
   * small card ("summary"), which crops it to a square, still shows the whole symbol.
   */
  ogImage: {
    url: "https://unlibra.com/ogp.png",
    type: "image/png",
    width: 1200,
    height: 630,
    alt: "The unlibra symbol",
  },
  /** The color of the browser's bar: the page's background (DESIGN.md 7.1). */
  themeColor: "#ffffff",
  /** The heading of the list of projects. */
  projectsLabel: "PROJECTS",
  /** Links to other sites, after the projects: a logo and a name only. */
  seeAlso: {
    label: "SEE ALSO",
    links: [
      { name: "GitHub", href: "https://github.com/unlibra", logo: "github" },
      { name: "Portfolio", href: "https://unlibra.com/", logo: "unlibra" },
    ],
  },
} as const satisfies {
  lang: string;
  ogLocale: string;
  url: `https://${string}/`;
  title: string;
  name: string;
  lead: string;
  author: { name: string; url: `https://${string}`; sameAs: readonly `https://${string}`[] };
  ogImage: { url: `https://${string}`; type: string; width: number; height: number; alt: string };
  themeColor: `#${string}`;
  projectsLabel: string;
  seeAlso: { label: string; links: readonly SeeAlsoLink[] };
};
