// Astro integration: writes the licenses of the npm packages that the site
// ships to dist/third-party-licenses.txt, in the same format as unlibra.com.
//
// The only shipped packages are the fonts. The site has no client JavaScript
// from packages, so the build fails when dist/ gets a .js file: a package
// that starts to ship then has to be added to SHIPPED.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Path of the list in dist/ (and on the site). */
export const LICENSES_FILE = "third-party-licenses.txt";

/** The packages whose files reach dist/. */
export const SHIPPED = ["@fontsource-variable/noto-sans-jp", "@fontsource/dm-mono"];

const RULE = "=".repeat(78);
const THIN = "-".repeat(78);

const listFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));

export default function thirdPartyLicenses() {
  let projectRoot;

  return {
    name: "third-party-licenses",
    hooks: {
      "astro:config:setup": ({ config }) => {
        projectRoot = fileURLToPath(config.root);
      },
      "astro:build:done": ({ dir, logger }) => {
        const distDir = fileURLToPath(dir);
        const scripts = listFiles(distDir).filter((file) => file.endsWith(".js"));
        if (scripts.length > 0) {
          throw new Error(
            `dist/ has JavaScript files, which may ship packages not in SHIPPED: ${scripts.join(", ")}`,
          );
        }

        const require = createRequire(join(projectRoot, "package.json"));
        const packages = SHIPPED.map((name) => {
          const dir = dirname(require.resolve(`${name}/package.json`));
          const { version, license } = JSON.parse(
            readFileSync(join(dir, "package.json"), "utf8"),
          );
          if (!license) throw new Error(`${name}: no license in package.json`);
          const text = readFileSync(join(dir, "LICENSE"), "utf8").trim();
          return { name, version, license, text };
        });

        const out = [
          "Third-party software in this website",
          "",
          "The font files of this website include the npm packages below. Each",
          "package is licensed under its own license, whose full text and",
          "copyright notices follow.",
          "",
          ...packages.map((p) => `  - ${p.name} ${p.version} (${p.license})`),
          "",
          ...packages.flatMap((p) => [
            RULE,
            `${p.name} ${p.version}`,
            `License: ${p.license}`,
            THIN,
            p.text,
            "",
          ]),
        ].join("\n");
        writeFileSync(join(distDir, LICENSES_FILE), out);
        logger.info(`${packages.length} package licenses written to ${LICENSES_FILE}`);
      },
    },
  };
}
