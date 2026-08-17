/**
 * rebuild-legacy-b-id-aliases.args.test.ts — the argv guard on a REWRITING tool.
 *
 * The property under test is **no writes occurred**, not "exited non-zero". A test
 * that only checks the exit code would pass against a tool that rewrote the repo
 * and *then* complained, which is precisely the failure this guard exists to stop.
 * So every case snapshots the fixture tree (content + mtimeMs of every file) before
 * and after, and asserts on the tree.
 *
 * Origin: PR #10832's agent probed this tool with `--help`, which it did not have.
 * Because `DRY_RUN` was `argv.includes("--dry-run")`, everything that was not that
 * exact string meant "go", and a ~1,700-file rewrite of the repo began. It was
 * killed before any file changed. Two properties are pinned here:
 *
 *   1. an unrecognised flag aborts before any write (fail closed);
 *   2. writing requires `--write` — a BARE invocation writes nothing.
 *
 * (2) is the load-bearing one: (1) alone still leaves a tool that rewrites the repo
 * when you forget a flag.
 *
 * The tool is never run in write mode against this repository. `--write` is
 * exercised only inside a throwaway fixture under `mkdtemp`, and that case is
 * required — without it the guard could be satisfied by a tool that never writes at
 * all, which is the vacuity class this repo keeps re-finding.
 */

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const TOOL = join(import.meta.dir, "rebuild-legacy-b-id-aliases.ts");

const LEGACY_ID = "B-0001";
const MAPPED_ZETAID = "081KSE6WT0008QG0R002YBWBB1";

/** A minimal repo-shaped fixture: one authored row naming a mapped legacy id. */
function makeFixture(): string {
  const root = mkdtempSync(join(tmpdir(), "b-alias-argv-"));
  mkdirSync(join(root, "src", "Core.TypeScript", "backlog"), { recursive: true });
  mkdirSync(join(root, "docs", "backlog", "P2"), { recursive: true });

  writeFileSync(
    join(root, "src", "Core.TypeScript", "backlog", "b-to-zetaid-map.json"),
    `${JSON.stringify({ [LEGACY_ID]: MAPPED_ZETAID }, null, 2)}\n`,
  );
  writeFileSync(
    join(root, "docs", "backlog", "P2", "sample-row.md"),
    `# a row\n\nSupersedes ${LEGACY_ID} from the closed series.\n`,
  );
  // `git` calls degrade to "" outside a repo; init anyway so the history-mining
  // sources run their real code path rather than a permanently-failing one.
  spawnSync("git", ["init", "-q"], { cwd: root });
  return root;
}

type Snapshot = ReadonlyMap<string, string>;

/** Content + mtime of every file in the tree, keyed by repo-relative path. */
function snapshot(root: string): Snapshot {
  const out = new Map<string, string>();
  function walk(dir: string): void {
    for (const dirent of readdirSync(dir, { withFileTypes: true })) {
      if (dirent.name === ".git") continue;
      const full = join(dir, dirent.name);
      if (dirent.isDirectory()) walk(full);
      else if (dirent.isFile()) {
        out.set(
          relative(root, full),
          `${statSync(full).mtimeMs}\u0000${readFileSync(full, "utf8")}`,
        );
      }
    }
  }
  walk(root);
  return out;
}

function run(root: string, args: readonly string[]) {
  return spawnSync("bun", [TOOL, ...args], { cwd: root, encoding: "utf8" });
}

function withFixture<T>(fn: (root: string) => T): T {
  const root = makeFixture();
  try {
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("rebuild-legacy-b-id-aliases argv guard", () => {
  test("an unrecognised flag exits non-zero AND writes nothing", () => {
    withFixture((root) => {
      const before = snapshot(root);
      const r = run(root, ["--help-me-rhonda"]);
      const after = snapshot(root);

      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain("unknown arg");
      // The property. Content AND mtime, so a rewrite-to-identical-bytes still fails.
      expect(after).toEqual(before);
    });
  });

  test("--help is recognised, exits 0, and writes nothing", () => {
    withFixture((root) => {
      const before = snapshot(root);
      const r = run(root, ["--help"]);
      expect(r.status).toBe(0);
      expect(snapshot(root)).toEqual(before);
    });
  });

  test("a BARE invocation writes nothing — destructive mode is not the default", () => {
    withFixture((root) => {
      const before = snapshot(root);
      const r = run(root, []);
      const after = snapshot(root);

      expect(r.status).toBe(0);
      expect(r.stdout).toContain("[DRY RUN]");
      expect(after).toEqual(before);
      // Stated positively: the row still names the legacy id it named going in.
      expect(readFileSync(join(root, "docs/backlog/P2/sample-row.md"), "utf8")).toContain(LEGACY_ID);
    });
  });

  test("--dry-run stays accepted and still writes nothing", () => {
    withFixture((root) => {
      const before = snapshot(root);
      const r = run(root, ["--dry-run"]);
      expect(r.status).toBe(0);
      expect(snapshot(root)).toEqual(before);
    });
  });

  test("--write with --dry-run is contradictory: exits non-zero, writes nothing", () => {
    withFixture((root) => {
      const before = snapshot(root);
      const r = run(root, ["--write", "--dry-run"]);
      expect(r.status).not.toBe(0);
      expect(snapshot(root)).toEqual(before);
    });
  });

  test("--write DOES rewrite — without this the guard could be vacuously satisfied", () => {
    withFixture((root) => {
      const rowPath = join(root, "docs/backlog/P2/sample-row.md");
      expect(readFileSync(rowPath, "utf8")).toContain(LEGACY_ID);

      const r = run(root, ["--write"]);

      expect(r.status).toBe(0);
      const rewritten = readFileSync(rowPath, "utf8");
      expect(rewritten).toContain(MAPPED_ZETAID);
      expect(rewritten).not.toContain(LEGACY_ID);
    });
  });
});
