import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

import { site } from "./config/site";

// One file per page on this site that a "projects" section lists (DESIGN.md 9.2).
// Every field is required, so a missing field fails the build. Links to other
// sites are not projects: they are the "links" sections of src/config/site.ts.
// A site without projects keeps the folder empty: an empty loader then, as the
// glob loader warns on an empty folder.
const hasProjects = Object.keys(import.meta.glob("./content/projects/**/*.md")).length > 0;

const projects = defineCollection({
  loader: hasProjects ? glob({ pattern: "**/*.md", base: "./src/content/projects" }) : () => [],
  schema: z.object({
    /** The name. */
    name: z.string().min(1),
    /** One line about it that says what kind of thing it is: a library, a Unity tool. */
    description: z.string().min(1),
    /** Where it is: a page on this site, as the row's > says. */
    href: z.string().startsWith(site.url, `href must be a page on ${site.url}`),
    /** The order in the list, smallest first. Two projects cannot share one. */
    order: z.number().int(),
  }),
});

export const collections = { projects };
