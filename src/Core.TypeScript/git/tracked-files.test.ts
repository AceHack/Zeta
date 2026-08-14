/**
 * The falsifier for `tracked-files.ts`.
 *
 * The property under test is one sentence - "untracked files are not in the set" - and it
 * is worth a hermetic fixture rather than an assertion against this repository, because
 * the defect it guards (081KZYXRYR8087G0R003E6JZA4) was precisely a derivation that gave
 * different answers on different checkouts. A test that reads the ambient repo would
 * inherit that same machine-dependence and could not distinguish the two implementations.
 *
 * So each test builds a throwaway git repository, plants one tracked file and one
 * untracked file, and asserts on the difference. A working-tree walk passes neither.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { normalizeTrackedPath, trackedFiles } from "./tracked-files";

let repo = "";

/** Run git inside the throwaway fixture repository. */
function git(...args: readonly string[]): void {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" });
}

/** Write a file (creating parents) inside the fixture repo. */
function plant(relative: string, body: string): void {
  const full = join(repo, relative);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, "utf8");
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "zeta-tracked-files-"));
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  execFileSync("git", ["init", "-q", repo], { encoding: "utf8" });
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("the tracked set is what a fresh checkout has, not what this machine has", () => {
  test("a tracked file is in the set and an untracked one is NOT", () => {
    plant("src/kept.test.ts", "// tracked\n");
    git("add", "src/kept.test.ts");
    plant("dist/build-output.test.ts", "// never added\n");

    const files = trackedFiles(repo);

    expect(files).toContain("src/kept.test.ts");
    expect(files).not.toContain("dist/build-output.test.ts");
  });

  test("a GITIGNORED build directory is invisible however full it is", () => {
    plant(".gitignore", "dist/\n");
    plant("src/kept.test.ts", "// tracked\n");
    git("add", ".gitignore", "src/kept.test.ts");
    plant("dist/docs/copy-a.test.ts", "// copied by a build\n");
    plant("dist/docs/deep/copy-b.test.ts", "// copied by a build\n");

    const files = trackedFiles(repo);

    expect(files.filter((f) => f.startsWith("dist/"))).toEqual([]);
    expect(files).toContain("src/kept.test.ts");
  });

  test("a file deleted locally but still tracked REMAINS - CI will have it", () => {
    plant("src/kept.test.ts", "// tracked\n");
    git("add", "src/kept.test.ts");
    rmSync(join(repo, "src", "kept.test.ts"));

    expect(trackedFiles(repo)).toContain("src/kept.test.ts");
  });

  test("the order is ordinal, so two machines produce the same list", () => {
    // Not a case PAIR: macOS is case-insensitive, so `A.test.ts` and `a.test.ts` would be
    // one file and the assertion would measure the filesystem, not the comparator.
    plant("alpha.test.ts", "");
    plant("Zed.test.ts", "");
    git("add", "alpha.test.ts", "Zed.test.ts");

    // Ordinal (UTF-16 code unit) puts `Z` (0x5A) before `a` (0x61).
    expect(trackedFiles(repo)).toEqual(["Zed.test.ts", "alpha.test.ts"]);
    // And the discriminator: a locale collation orders these the other way round, so this
    // assertion actually distinguishes the two implementations.
    const localeOrder = ["Zed.test.ts", "alpha.test.ts"].sort((a, b) => a.localeCompare(b));
    expect(localeOrder).toEqual(["alpha.test.ts", "Zed.test.ts"]);
  });

  test("a failure THROWS instead of reading as an empty repository", () => {
    const notARepo = mkdtempSync(join(tmpdir(), "zeta-not-a-repo-"));
    try {
      expect(() => trackedFiles(join(notARepo, "does-not-exist"))).toThrow();
    } finally {
      rmSync(notARepo, { recursive: true, force: true });
    }
  });
});

describe("path normalization", () => {
  test("a leading ./ is stripped and separators are made POSIX", () => {
    expect(normalizeTrackedPath("./src/a.ts")).toBe("src/a.ts");
    expect(normalizeTrackedPath("src\\win\\a.ts")).toBe("src/win/a.ts");
    expect(normalizeTrackedPath("src/a.ts")).toBe("src/a.ts");
  });
});
