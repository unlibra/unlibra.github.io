// dist/third-party-licenses.txt (scripts/third-party-licenses.mjs).
// `npm test` builds first (pretest).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { LICENSES_FILE, SHIPPED } from "../scripts/third-party-licenses.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = join(root, "dist", LICENSES_FILE);

test("the license list names every shipped package with its full license text", () => {
  assert.ok(existsSync(file), `${LICENSES_FILE} not in dist/`);
  const text = readFileSync(file, "utf8");
  for (const name of SHIPPED) {
    const { version } = JSON.parse(
      readFileSync(join(root, "node_modules", name, "package.json"), "utf8"),
    );
    assert.ok(text.includes(`\n${name} ${version}\n`), name);
  }
  // Noto Sans JP and DM Mono: the copyright notices and the whole OFL.
  assert.ok(text.includes("Google Inc."));
  assert.ok(text.includes("The DM Mono Project Authors"));
  assert.ok(text.includes("SIL OPEN FONT LICENSE Version 1.1"));
  assert.ok(text.includes("THE FONT SOFTWARE IS PROVIDED \"AS IS\""));
});
