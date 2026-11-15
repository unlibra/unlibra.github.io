import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// One file per project whose documentation this site hosts. Every field is
// required, so a missing field fails the build. Links to other sites (GitHub,
// the portfolio) are not projects: they are site.seeAlso in src/config/site.ts.
const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: z.object({
    /** The name. */
    name: z.string().min(1),
    /** One line about it that says what kind of thing it is: a library, a Unity tool. */
    description: z.string().min(1),
    /** Where its documentation is: an https:// URL only. */
    href: z.string().regex(/^https:\/\/\S+$/, "href must be an https:// URL"),
    /** The order in the list, smallest first. Two projects cannot share one. */
    order: z.number().int(),
  }),
});

export const collections = { projects };
