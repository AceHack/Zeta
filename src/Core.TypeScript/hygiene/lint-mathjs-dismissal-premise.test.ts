// lint-mathjs-dismissal-premise.test.ts — the refusals under the dismissal.
//
// MUTATION LOG — each mutant applied to lint-mathjs-dismissal-premise.ts, `bun
// test` run, killer named, controls re-checked.
//
//   N1  checkScope: accept `quantum-circuit` in `dependencies`
//       KILLED BY  "a runtime dependency breaks the premise"
//   N2  checkScope: stop requiring private:true
//       KILLED BY  "a publishable package breaks the premise"
//   N3  checkNoDirectImport: always report no hits
//       KILLED BY  "a direct mathjs import breaks the premise"
//   N4  importsModule: drop stripComments
//       KILLED BY  "a mathjs mention in a comment is not an import"
//       (this is the guard-matches-its-own-prose failure; this very file's
//        header, and the lint's, mention the module repeatedly.)
//   N5  checkUpstreamConfigSurface: report a pass when the package is absent
//       KILLED BY  "an uninstalled package is UNKNOWN, never a pass"
//   N6  checkUpstreamConfigSurface: ignore the config surface regex
//       KILLED BY  "an upstream math.config call breaks the premise"
//   N7  readOrNull: swallow every error, not just ENOENT
//       KILLED BY  "readOrNull rethrows a non-ENOENT error rather than swallowing it"
//   N8  walk: follow symbolic links
//       KILLED BY  "walk does not follow symlinks (the tests/ fixture is a LOOP)"
//       (`tests/cross-verification/experience/fixtures/tree1/subdir1/link_to_parent`
//        is a deliberate symlink loop. The first draft crashed with ELOOP the
//        moment main() walked tests/ — a bug the old existsSync gate had been
//        accidentally hiding, since existsSync returns false on ELOOP.)
//
//   CONTROL (must SURVIVE): "the real tree still satisfies every runnable part".
//   It passes under N4 and N6 — a green happy path proves nothing on its own.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  IMPORT_SCAN_EXEMPT,
  checkNoDirectImport,
  checkScope,
  checkUpstreamConfigSurface,
  importsModule,
  readOrNull,
  runPremise,
  stripComments,
  walk,
} from "./lint-mathjs-dismissal-premise.ts";

const read = (p: string): string => readFileSync(p, "utf-8");

const PKG_OK = JSON.stringify({ private: true, devDependencies: { "quantum-circuit": "0.9.250" } });

describe("checkScope — dev-only, inside a package nobody installs", () => {
  test("CONTROL: dev-scoped and private passes", () => {
    const r = checkScope(PKG_OK);
    expect(r.failures).toEqual([]);
    expect(r.passes).toHaveLength(2);
  });

  // N1. A devDependency cannot reach production; a runtime one can, and the whole
  // dismissal is downstream of that distinction.
  test("a runtime dependency breaks the premise", () => {
    const r = checkScope(JSON.stringify({ private: true, dependencies: { "quantum-circuit": "0.9.250" } }));
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain("RUNTIME dependency");
  });

  // N2. A published package installs its dependency chain into consumers.
  test("a publishable package breaks the premise", () => {
    const r = checkScope(JSON.stringify({ devDependencies: { "quantum-circuit": "0.9.250" } }));
    expect(r.failures.some((f) => f.includes("private:true"))).toBe(true);
  });

  test("the package disappearing entirely is a failure, not a silent pass", () => {
    const r = checkScope(JSON.stringify({ private: true, devDependencies: {} }));
    expect(r.failures.some((f) => f.includes("neither dependencies nor devDependencies"))).toBe(true);
  });
});

describe("importsModule reads code, not prose", () => {
  test("recognises the import, dynamic-import and require forms", () => {
    expect(importsModule('import math from "mathjs";', "mathjs")).toBe(true);
    expect(importsModule("const m = require('mathjs');", "mathjs")).toBe(true);
    expect(importsModule('await import("mathjs");', "mathjs")).toBe(true);
  });

  // N4. Both this file and the lint discuss the module by name in prose. A guard
  // that matches its own documentation is reading the wrong text.
  test("a mathjs mention in a comment is not an import", () => {
    expect(importsModule('// we never import from "mathjs" anywhere\nconst x = 1;', "mathjs")).toBe(false);
    expect(importsModule('/* import x from "mathjs" */\nconst y = 2;', "mathjs")).toBe(false);
    expect(importsModule('const z = 3; // require("mathjs")', "mathjs")).toBe(false);
  });

  test("a different module is not a hit", () => {
    expect(importsModule('import q from "quantum-circuit";', "mathjs")).toBe(false);
  });

  test("stripComments leaves code intact", () => {
    expect(stripComments('const a = 1; // note\nconst b = 2;')).toContain("const b = 2;");
  });
});

describe("checkNoDirectImport", () => {
  const read = (p: string): string => (p === "bad.ts" ? 'import math from "mathjs";' : "const x = 1;");

  test("CONTROL: a tree with no direct import passes", () => {
    expect(checkNoDirectImport(["good.ts"], read).failures).toEqual([]);
  });

  // N3. Reaching the configuration surface from Zeta code is precisely what the
  // dismissal assumes nobody does.
  test("a direct mathjs import breaks the premise", () => {
    const r = checkNoDirectImport(["good.ts", "bad.ts"], read);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toContain("bad.ts");
    expect(r.failures[0]).toContain("Reopen it");
  });

  test("the exemption is exactly one file, and it is this test", () => {
    expect(IMPORT_SCAN_EXEMPT).toEqual(["src/Core.TypeScript/hygiene/lint-mathjs-dismissal-premise.test.ts"]);
    expect(checkNoDirectImport([IMPORT_SCAN_EXEMPT[0] as string], () => 'import m from "mathjs";').failures).toEqual([]);
  });
});

describe("checkUpstreamConfigSurface — and unknown is not a pass", () => {
  // N5. The one part of the premise this repo cannot always answer. Calling it a
  // pass would be a check that cannot fail, reported as a check that passed.
  test("an uninstalled package is UNKNOWN, never a pass", () => {
    const r = checkUpstreamConfigSurface(null);
    expect(r.passes).toEqual([]);
    expect(r.failures).toEqual([]);
    expect(r.unknowns).toHaveLength(1);
    expect(r.unknowns[0]).toContain("UNKNOWN — not a pass");
  });

  // N6. GHSA-x2fc-mxcx-w4mf is reached "upon configuration updates". If upstream
  // starts calling config, the premise is simply false.
  test("an upstream math.config call breaks the premise", () => {
    expect(checkUpstreamConfigSurface("math.config({ number: 'BigNumber' });").failures).toHaveLength(1);
    expect(checkUpstreamConfigSurface("var m = math.create(cfg);").failures).toHaveLength(1);
    expect(checkUpstreamConfigSurface("function deepExtend(a, b) {}").failures).toHaveLength(1);
  });

  test("a config call that only appears in a comment is not a reach", () => {
    expect(checkUpstreamConfigSurface("// math.config is never called here\nvar x = 1;").passes).toHaveLength(1);
  });

  test("no config surface passes", () => {
    expect(checkUpstreamConfigSurface('var math = require("mathjs"); math.multiply(a, b);').passes).toHaveLength(1);
  });
});

describe("the real tree", () => {
  test("CONTROL: the real tree still satisfies every runnable part", () => {
    const files = [...walk("src"), ...walk("tools")];
    expect(files.length).toBeGreaterThan(100);
    const r = runPremise(
      read("package.json"),
      files,
      read,
      readOrNull("node_modules/quantum-circuit/lib/quantum-circuit.js", read),
    );
    expect(r.failures).toEqual([]);
  });

  test("readOrNull returns null for an absent path and never gates on existsSync", () => {
    expect(readOrNull("definitely/not/here.js", read)).toBeNull();
    expect(readOrNull("package.json", read)).toContain("quantum-circuit");
  });

  test("readOrNull rethrows a non-ENOENT error rather than swallowing it", () => {
    expect(() =>
      readOrNull("x", () => {
        throw Object.assign(new Error("EACCES"), { code: "EACCES" });
      }),
    ).toThrow("EACCES");
  });

  test("walk treats an absent root as empty and a file root as one file", () => {
    expect(walk("definitely/not/a/dir")).toEqual([]);
    expect(walk("src/Core.TypeScript/hygiene/lint-mathjs-dismissal-premise.ts")).toEqual([
      "src/Core.TypeScript/hygiene/lint-mathjs-dismissal-premise.ts",
    ]);
  });

  // N8. The repo carries a deliberate symlink LOOP fixture. Following it recurses
  // until ELOOP, which is what the first draft of walk() did the moment main()
  // reached tests/ — the failure the removed existsSync gate had been hiding,
  // because existsSync returns false on ELOOP as well as on ENOENT.
  test("walk does not follow symlinks (the tests/ fixture is a LOOP)", () => {
    const files = walk("tests/cross-verification/experience/fixtures/tree1");
    expect(files.every((f) => !f.includes("link_to_parent"))).toBe(true);
  });

  test("quantum-circuit is still imported — the dismissal never claimed otherwise", () => {
    // The premise offered first was "nothing imports it", and it was FALSE. This
    // pins the correction: the package IS used, and the dismissal rests on
    // reachability of the vulnerable function instead.
    const files = walk("src");
    const importers = files.filter((f) => importsModule(readFileSync(f, "utf-8"), "quantum-circuit"));
    expect(importers.length).toBeGreaterThan(0);
  });
});
