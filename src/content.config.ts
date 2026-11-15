import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

import { site } from "./config/site";

const sectionIds = site.sections.map((s) => s.id) as [string, ...string[]];

// One file per link. Every field is required, so a missing field or an unknown
// section fails the build.
const links = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/links" }),
  schema: z.object({
    /** The name. */
    name: z.string().min(1),
    /** The kind, shown small next to the name. */
    category: z.string().min(1),
    /** One line about it. */
    description: z.string().min(1),
    /** Where it goes: an https:// URL only. */
    href: z.string().regex(/^https:\/\/\S+$/, "href must be an https:// URL"),
    /** One of the ids in site.sections. */
    section: z.enum(sectionIds),
    /** The order in the section, smallest first. */
    order: z.number().int(),
    /** The color the row takes on hover or focus (#rrggbb). */
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "color must be #rrggbb"),
  }),
});

export const collections = { links };
