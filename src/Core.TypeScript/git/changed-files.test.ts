/**
 * The falsifier for `changed-files.ts`.
 *
 * Hermetic fixtures, same reasoning as `tracked-files.test.ts`: the properties under
 * test are about what git reports for a given repository state, so a test that read
 * the ambient repo would assert on whatever the author happened to have checked out.
 *
 * The load-bearing property is the second one — a STAGED-but-uncommitted file counts.
 * That is the state an author is in when a pre-push / preflight guard runs, and a
 * changed-set that only looked at committed history would miss it and report "nothing
 * to check": a skipped check wearing a passed check's face.
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { changedFiles, mergeBaseWith } from "./changed-files";

let repo = "";

function git(...args: readonly string[]): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8" });
}

function plant(relative: string, body: string): void {
  const full = join(repo, relative);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, "utf8");
}

function commit(message: string): void {
  git("-c", "user.email=t@example.com", "-c", "user.name=T", "commit", "-q", "-m", message);
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "zeta-changed-files-"));
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  execFileSync("git", ["init", "-q", "-b", "main", repo], { encoding: "utf8" });
  plant("base.txt", "base\n");
  git("add", "base.txt");
  commit("base");
  git("branch", "base-ref");
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe("the changed set is branch commits UNION index/working tree", () => {
  test("a file committed on the branch is in the set", () => {
    plant("src/added.fsproj", "<Project />\n");
    git("add", "src/added.fsproj");
    commit("add a manifest");

    expect(changedFiles(repo, "base-ref")).toEqual(["src/added.fsproj"]);
  });

  test("a STAGED but uncommitted file is in the set — the state a guard runs in", () => {
    plant("src/staged.fsproj", "<Project />\n");
    git("add", "src/staged.fsproj");

    expect(changedFiles(repo, "base-ref")).toContain("src/staged.fsproj");
  });

  test("an UNSTAGED edit to a tracked file is in the set", () => {
    plant("base.txt", "edited\n");

    expect(changedFiles(repo, "base-ref")).toEqual(["base.txt"]);
  });

  test("an UNTRACKED file is NOT — it changes no derived artifact until it is staged", () => {
    plant("scratch/notes.txt", "scratch\n");

    expect(changedFiles(repo, "base-ref")).toEqual([]);
  });

  test("an unresolvable base yields undefined, never an empty set", () => {
    // The distinction the callers depend on: [] means "checked, nothing relevant",
    // undefined means "could not scope" — which must escalate, not pass quietly.
    expect(changedFiles(repo, "origin/does-not-exist")).toBeUndefined();
    expect(mergeBaseWith(repo, "origin/does-not-exist")).toBeUndefined();
    expect(mergeBaseWith(repo, "base-ref")).toBeDefined();
  });

  test("the order is ordinal, so two machines produce the same list", () => {
    plant("Zed.txt", "z\n");
    plant("alpha.txt", "a\n");
    git("add", "Zed.txt", "alpha.txt");

    // Ordinal (UTF-16 code unit) puts `Z` (0x5A) before `a` (0x61); a locale
    // collation orders these the other way round, so this assertion discriminates.
    expect(changedFiles(repo, "base-ref")).toEqual(["Zed.txt", "alpha.txt"]);
  });
});
