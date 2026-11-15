// The site settings. The links themselves are src/content/links/*.md, one file each.

export type Section = {
  /** The name of the section, shown on the left of its links. A link's section is one of these. */
  id: string;
  /** The color of the dot next to the name (#rrggbb). */
  color: `#${string}`;
};

export const site = {
  lang: "en",
  /** The title in the browser tab. */
  title: "docs.unlibra.com",
  /** The heading of the page. */
  name: "unlibra docs",
  /** The line below the heading. */
  lead: "Documentation for the open source libraries and tools by unlibra.",
  /** The sections, in this order. */
  sections: [
    { id: "PROJECTS", color: "#2fd6b4" },
    { id: "ELSEWHERE", color: "#ff7d33" },
  ],
} as const satisfies {
  lang: string;
  title: string;
  name: string;
  lead: string;
  sections: readonly Section[];
};
