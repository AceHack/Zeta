// lint-clone-at-tag-is-sufficient.test.ts
//
// A guard that cannot fire is not a guard, so the negative cases are the point: the
// suite proves the lint FIRES on a real resolver dependency and STAYS SILENT on the
// uses of `ace` that are legitimate. Both halves matter -- a lint that flagged
// `bun test src/Core.TypeScript/ace/` would be disabled within a week, and a
// disabled guard is the appointed hub arriving on schedule.

import { describe, expect, test } from "bun:test";
import { RESOLVER_INVOCATION, scanSurfaces, scanText } from "./lint-clone-at-tag-is-sufficient.ts";

describe("fires on ace-as-resolver", () => {
  const cases = [
    "        run: ace pull forge@v1.2.0",
    "  ace install --frozen",
    "ace restore",
    "ace resolve --lockfile",
    "ace fetch zeta@v1",
    "ace sync",
    "ace add forge",
    "ace bootstrap",
    "      cp ace.toml ./build/",
  ];
  for (const line of cases) {
    test(`fires on: ${line.trim()}`, () => {
      expect(scanText("f.yml", line)).toHaveLength(1);
    });
  }

  test("the ADR's own successor sentence would fire", () => {
    // "replaced by `ace pull forge@<version>`" is the exact §1 risk this guards.
    expect(scanText("w.yml", 'run: ace pull forge@${{ env.FORGE_VERSION }}')).toHaveLength(1);
  });
});

describe("stays silent on legitimate uses of ace", () => {
  const quiet = [
    "        run: bun test src/Core.TypeScript/ace/",
    "      - name: Ace package-manager suite",
    "  run: bun src/Core.TypeScript/ace/ace-cli.ts --help",
    "  run: bun src/Core.TypeScript/ace/build-graph.ts derive",
    "        run: bun src/Core.TypeScript/ace/registry-publish.ts",
    "  workspace: /home/runner/workspace",   // contains "ace" as a substring
    "  run: dotnet restore Zeta.sln",        // restore, but not ace's
  ];
  for (const line of quiet) {
    test(`silent on: ${line.trim()}`, () => {
      expect(scanText("f.yml", line)).toHaveLength(0);
    });
  }
});

describe("comments are prose, not dependencies", () => {
  test("a comment describing the forbidden thing does not fire", () => {
    // Otherwise this rule's own documentation would trip it.
    expect(scanText("f.yml", "  # replaced by `ace pull forge@<version>` per the ADR")).toHaveLength(0);
    expect(scanText("f.ts", "// ace pull is forbidden in a bootstrap path")).toHaveLength(0);
  });

  test("but an uncommented line right after a comment still fires", () => {
    expect(scanText("f.yml", "  # note\n  run: ace pull forge@v1")).toHaveLength(1);
  });
});

describe("the regex discriminates verbs, not the bare word", () => {
  test("bare `ace` is not a violation", () => {
    expect(RESOLVER_INVOCATION.test("ace")).toBe(false);
    expect(RESOLVER_INVOCATION.test("the ace suite")).toBe(false);
  });
});

describe("the real repo", () => {
  test("no bootstrap surface requires ace today", () => {
    // If this ever fails, read the lint's header before 'fixing' it: the failure is
    // the finding.
    expect(scanSurfaces()).toEqual([]);
  });

  test("the scan reaches real files -- refuse to pass on an empty surface", () => {
    let seen = 0;
    scanSurfaces(undefined, () => { seen++; return ""; });
    expect(seen).toBeGreaterThan(20);
  });
});
