// lint-clone-at-tag-is-sufficient.test.ts
//
// A guard that cannot fire is not a guard, so the negative cases are the point: the
// suite proves the lint FIRES on a real resolver dependency and STAYS SILENT on the
// uses of `ace` that are legitimate. Both halves matter -- a lint that flagged
// `bun test src/Core.TypeScript/ace/` would be disabled within a week, and a
// disabled guard is the appointed hub arriving on schedule.

import { describe, expect, test } from "bun:test";
import {
  BOOTSTRAP_SURFACES,
  RESOLVER_INVOCATION,
  scanSurfaces,
  scanText,
} from "./lint-clone-at-tag-is-sufficient.ts";

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

describe("`.cursor` is a bootstrap surface", () => {
  // A cloud-agent environment provisions a fresh clone before anything is built, which
  // makes it a bootstrap surface by definition. It is also the NEWEST one -- so it is
  // the single place `ace` could become mandatory while every older surface stays
  // untouched. The roster is therefore asserted, not assumed.
  test("`.cursor` is enumerated", () => {
    expect(BOOTSTRAP_SURFACES).toContain(".cursor");
  });

  test("...and the roster is still NARROW -- `docs`/`src` are not bootstrap surfaces", () => {
    // The paired negative. A lint that scanned the whole tree would flag `ace`'s own
    // suite and be disabled within a week, and a disabled guard is the appointed hub
    // arriving on schedule. Narrowness is a property, not an oversight.
    expect(BOOTSTRAP_SURFACES).not.toContain("docs");
    expect(BOOTSTRAP_SURFACES).not.toContain("src");
  });

  test("a resolver line under `.cursor` FIRES", () => {
    // Same code path as the real scan; only the file CONTENT is injected. That is what
    // proves the surface is genuinely WALKED rather than merely listed.
    const found = scanSurfaces([".cursor"], () => "  ace install --frozen");
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((v) => v.file.startsWith(".cursor"))).toBe(true);
  });

  test("...and a legitimate line under `.cursor` STAYS SILENT", () => {
    expect(scanSurfaces([".cursor"], () => "  run: bun src/Core.TypeScript/ace/ace-cli.ts --help")).toEqual([]);
  });

  test("the real `.cursor` is clean today", () => {
    expect(scanSurfaces([".cursor"])).toEqual([]);
  });
});

describe("a bootstrap surface that does not exist yet degrades to silence", () => {
  // `.cursor/install.sh` and `.cursor/environment.json` are not on `main` at the time of
  // writing -- they arrive with the Cursor cloud-agent PR. Listing the surface early must
  // therefore be free. Both halves are needed: an absent path must contribute nothing,
  // AND a present one must still be read, or "the lint is green" would only mean
  // "nothing was opened".
  test("a missing path reads zero files and finds zero violations", () => {
    let seen = 0;
    const found = scanSurfaces([".cursor/definitely-absent-surface"], () => {
      seen++;
      return "ace pull forge@v1";
    });
    expect(seen).toBe(0);
    expect(found).toEqual([]);
  });

  test("...while a present path reads real files through the same call", () => {
    let seen = 0;
    scanSurfaces([".cursor"], () => { seen++; return ""; });
    expect(seen).toBeGreaterThan(0);
  });
});
