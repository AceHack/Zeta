// audit-tech-radar-claims.test.ts
//
// A check that cannot fail is not a check, so the FIRING cases are the point and the
// two real 2026-08-22 findings are reproduced here as fixtures: the dead
// `tools/alloy/alloy.jar` citation and the unringed `fast-check`. Each has a silent
// twin, because a lint that flagged a prose mention of `docs/GLOSSARY.md` or demanded
// a radar row for `pg` would be disabled within a week — and a disabled guard is worse
// than none.
//
// ── A RULE THIS FILE MUST FOLLOW, LEARNED THE HARD WAY ────────────────────────
// THIS FILE IS INSIDE THE CORPUS THE AUDIT SCANS. It is a tracked `*.test.ts`, so
// every import specifier written here as a FIXTURE STRING is indistinguishable to
// check B from a real dependency. The first version of this suite used
// `import { chromium } from "playwright"` as a parser fixture; `playwright` is a
// real devDependency, so the audit dutifully reported it as an unringed in-use tool
// and went red in CI (job 97201065831) while passing locally against the earlier,
// line-anchored regex. The finding was true of the fixture and false of the repo.
//
// So: **fixtures must name packages that cannot be devDependencies.** The parser
// tests below use `example-not-a-real-dep` for exactly this reason. The alternative
// — exempting this file from the scan — would be an allowlist of one, and an audit
// that skips a file is an audit that can be silenced by moving code into it.

import { describe, expect, test } from "bun:test";
import {
  MIN_TEST_FILES,
  checkPaths,
  checkUnringedDevDeps,
  citedPaths,
  importedPackages,
  namedInRadar,
  packageOf,
  stripComments,
} from "./audit-tech-radar-claims.ts";

const nothingExists = (): boolean => false;
const everythingExists = (): boolean => true;

describe("check A — path claims", () => {
  test("FIRES on the real 2026-08-22 finding: a jar citation that had moved", () => {
    const found = checkPaths("| Alloy | Trial | 10 | `tools/alloy/alloy.jar` |", nothingExists);
    expect(found).toHaveLength(1);
    expect(found[0]?.subject).toBe("tools/alloy/alloy.jar");
    expect(found[0]?.check).toBe("path");
  });

  test("FIRES on the second real finding: tally.ts cited at its old home", () => {
    const found = checkPaths("First in-tree artefact: `tools/invariant-substrates/tally.ts`.", nothingExists);
    expect(found).toHaveLength(1);
  });

  test("reports the LINE, so the fix is one jump away", () => {
    const found = checkPaths(["a", "b", "see `docs/gone.md`"].join("\n"), nothingExists);
    expect(found[0]?.line).toBe(3);
  });

  test("SILENT when the path resolves", () => {
    expect(checkPaths("see `docs/TECH-RADAR.md`", everythingExists)).toHaveLength(0);
  });

  test("SILENT on `(planned)` — a row may PROPOSE an artifact", () => {
    expect(checkPaths("produce `docs/research/scratch-zeta-parity.md` (planned)", nothingExists)).toHaveLength(0);
  });

  test("`(planned)` is permissive, not an assertion — a planned path that EXISTS is fine", () => {
    expect(checkPaths("`docs/x.md` (planned)", everythingExists)).toHaveLength(0);
  });

  test("SILENT on bare filenames — `Merkle.fs` is shorthand, not a path claim", () => {
    expect(checkPaths("| Merkle | Trial | 13 | `Merkle.fs` |", nothingExists)).toHaveLength(0);
  });

  test("SILENT on URLs, globs, and prose in backticks", () => {
    const text = [
      "`https://github.com/leanprover/lean4/releases`",
      "`src/**/*.fs`",
      "`dotnet test Zeta.sln -c Release`",
      "`rollForward: latestPatch`",
    ].join("\n");
    expect(checkPaths(text, nothingExists)).toHaveLength(0);
  });

  test("citedPaths finds every candidate on a line, not just the first", () => {
    const c = citedPaths("`a/b.ts` and `c/d.ts`");
    expect(c.map((x) => x.path)).toEqual(["a/b.ts", "c/d.ts"]);
  });
});

describe("check B — a devDependency used to verify must carry a ring", () => {
  const radarWithoutFastCheck = "| FsCheck 3 property tests | Adopt | 1 | In CI |";
  const testFile = "src/Core.TypeScript/observe/schema-aware-join.test.ts";
  // `fast-check` is safe to name here even under the header's rule: it now HAS a radar
  // row, so a self-report is impossible — check B fires on unringed tools only.
  const read = (): string => `import { describe } from "bun:test";\nimport fc from "fast-check";\n`;

  test("FIRES on the real 2026-08-22 finding: fast-check in use, no ring", () => {
    const found = checkUnringedDevDeps(radarWithoutFastCheck, ["fast-check"], [testFile], read);
    expect(found).toHaveLength(1);
    expect(found[0]?.subject).toBe("fast-check");
    expect(found[0]?.check).toBe("unringed-devdep");
    expect(found[0]?.detail).toContain(testFile);
  });

  test("SILENT once the row exists — this is what the fix looks like", () => {
    const withRow = `${radarWithoutFastCheck}\n| fast-check (TypeScript property tests) | Trial | — | ... |`;
    expect(checkUnringedDevDeps(withRow, ["fast-check"], [testFile], read)).toHaveLength(0);
  });

  test("SILENT on a runtime dependency — the radar is not an SBOM", () => {
    // `pg` is a `dependencies` entry, so it is never in the devDeps set handed in.
    const pgTest = (): string => `import pg from "pg";\n`;
    expect(checkUnringedDevDeps("", ["fast-check"], ["x.test.ts"], pgTest)).toHaveLength(0);
  });

  test("SILENT on a devDependency that no TEST imports — pinned is not verified-with", () => {
    const noImports = (): string => `import { x } from "./local.ts";\n`;
    expect(checkUnringedDevDeps("", ["prettier"], ["x.test.ts"], noImports)).toHaveLength(0);
  });

  test("an unreadable test file is skipped, not counted as a finding", () => {
    const boom = (): string => {
      throw new Error("EACCES");
    };
    expect(checkUnringedDevDeps("", ["fast-check"], ["x.test.ts"], boom)).toHaveLength(0);
  });
});

describe("import parsing", () => {
  test("packageOf resolves scoped, deep, and bare specifiers", () => {
    expect(packageOf("@noble/curves/secp256k1")).toBe("@noble/curves");
    expect(packageOf("z3-solver/build/node.js")).toBe("z3-solver");
    expect(packageOf("fast-check")).toBe("fast-check");
  });

  test("packageOf rejects relative paths and builtins", () => {
    expect(packageOf("./x.ts")).toBeNull();
    expect(packageOf("../y.ts")).toBeNull();
    expect(packageOf("node:fs")).toBeNull();
    expect(packageOf("bun:test")).toBeNull();
  });

  test("importedPackages handles default, named, and side-effect imports", () => {
    // Every specifier here is deliberately NOT a real devDependency — see the file
    // header. A fixture naming a real one makes this suite report itself.
    const src = [
      `import a from "example-not-a-real-dep";`,
      `import { b } from "example-also-not-real";`,
      `import "example-side-effect-only";`,
      `import type { C } from "./local.ts";`,
    ].join("\n");
    expect([...importedPackages(src)].sort()).toEqual([
      "example-also-not-real",
      "example-not-a-real-dep",
      "example-side-effect-only",
    ]);
  });

  test("also sees `export … from` and multi-line specifiers (the simplified regex)", () => {
    const src = `export { x } from "example-reexported-dep";\nimport {\n  y,\n} from "example-multiline-dep";`;
    expect([...importedPackages(src)].sort()).toEqual(["example-multiline-dep", "example-reexported-dep"]);
  });

  test("STATED LIMIT, pinned as a test: a require() inside a spawned process is invisible", () => {
    // src/Core.TypeScript/ace/solver.z3.test.ts really does this. The audit
    // under-reports rather than inventing; if that ever changes, this test tells you.
    const src = `const script = "const { init } = require('z3-solver/build/node.js');";`;
    expect(importedPackages(src)).toHaveLength(0);
  });
});

describe("comments are not imports — the self-report class", () => {
  test("REPRODUCES the CI failure: a specifier quoted in a LINE COMMENT", () => {
    // The shape that took cross-verify red on job 97201065831. Note the fixture names
    // a package that is deliberately not a real devDependency — see the file header;
    // a string literal holding a real one would re-create the failure a third time,
    // because stripComments handles comments and cannot handle strings.
    const src = ['// the first version used  import x from "example-in-a-comment";', "const y = 1;"].join("\n");
    expect(importedPackages(src)).toHaveLength(0);
  });

  test("block comments too", () => {
    expect(importedPackages(`/*\n * import x from "example-in-a-block";\n */\n`)).toHaveLength(0);
  });

  test("a REAL import beside a commented one still counts", () => {
    const src = ['// import old from "example-retired-dep";', 'import x from "example-live-dep";'].join("\n");
    expect(importedPackages(src)).toEqual(["example-live-dep"]);
  });

  test("`//` inside a string is NOT a comment — the reason this is a scanner, not a regex", () => {
    const src = ['const u = "https://example.com/x";', 'import x from "example-live-dep";'].join("\n");
    expect(importedPackages(src)).toEqual(["example-live-dep"]);
    expect(stripComments(src)).toContain("https://example.com/x");
  });

  test("stripComments preserves length, so offsets stay true", () => {
    const src = "a // b\nc /* d */ e";
    expect(stripComments(src)).toHaveLength(src.length);
  });

  test("an unterminated block comment swallows the rest — under-report, never invent", () => {
    expect(importedPackages('/* oops\nimport x from "example-live-dep";')).toHaveLength(0);
  });
});

describe("namedInRadar matches whole tokens", () => {
  test("matches the package name in prose and in a table cell", () => {
    expect(namedInRadar("| fast-check (TypeScript) | Trial |", "fast-check")).toBe(true);
    expect(namedInRadar("we use semver as an oracle", "semver")).toBe(true);
  });

  test("does not match a substring of a longer word", () => {
    expect(namedInRadar("semverish", "semver")).toBe(false);
    expect(namedInRadar("pgrep is unrelated", "pg")).toBe(false);
  });

  test("scoped names match despite their punctuation", () => {
    expect(namedInRadar("pinned `@types/bun 1.3.12`", "@types/bun")).toBe(true);
  });
});

describe("scan floor", () => {
  test("MIN_TEST_FILES is a real floor — an audit that inspected nothing must not pass", () => {
    expect(MIN_TEST_FILES).toBeGreaterThan(0);
  });
});
