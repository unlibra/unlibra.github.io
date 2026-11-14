// The site settings. The links themselves are src/content/links/*.md, one file each.

/** Building types, in the order of ARCHS in public/kenney-buildings.js. */
export const ARCHS = ["tower", "chamfer", "slab", "shop", "house", "cottage", "hall", "step", "ell"] as const;

export type Section = {
  /** The name of the section: the legend of the diorama and the heading of the plain list. A link's section is one of these. */
  id: string;
  /** The color of the section (#rrggbb). With more than one section, the diorama colors the sections apart. */
  color: `#${string}`;
};

export const site = {
  lang: "en",
  /** The title in the browser tab. */
  title: "docs.unlibra.com",
  /** The short label at the top left of the diorama. */
  mark: "DOCS",
  /** The name of the site: at the top left of the diorama, and below it when nothing is selected. */
  name: "unlibra docs",
  /** The line below the heading of the plain list. */
  lead: "Documentation for the open source libraries and tools by unlibra.",
  /** The words the diorama shows. {name} in opening becomes the name of the link. */
  ui: {
    open: "Open →",
    idle: "Pick a building or a label to see what it is.",
    opening: "Opening {name}",
    demo: " (a sample link with no address)",
    hintPointer: "Click to open · Drag to turn · Tab or arrow keys to move",
    hintTouch: "Tap to open · Drag sideways to turn",
    buildingsFailed: "The buildings could not be loaded. The links still work.",
    loading: "Loading…",
    sectionsLabel: "Sections",
    linksLabel: "Links",
  },
  /** The sections, in this order. Three at most. */
  sections: [
    { id: "PROJECTS", color: "#2fd6b4" },
    { id: "ELSEWHERE", color: "#ff7d33" },
  ],
} as const satisfies {
  lang: string;
  title: string;
  mark: string;
  name: string;
  lead: string;
  ui: Record<
    | "open"
    | "idle"
    | "opening"
    | "demo"
    | "hintPointer"
    | "hintTouch"
    | "buildingsFailed"
    | "loading"
    | "sectionsLabel"
    | "linksLabel",
    string
  >;
  sections: readonly Section[];
};

/** How many links and sections the diorama can lay out. */
export const LIMITS = { minLinks: 4, maxLinks: 10, maxSections: 3 } as const;
