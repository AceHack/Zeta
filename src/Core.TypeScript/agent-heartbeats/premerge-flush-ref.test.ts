import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "bun:test";

import { parseArgs, premergeFlushRef } from "./premerge-flush-ref";

const roots: string[] = [];

function run(cwd: string, args: readonly string[]): { readonly status: number; readonly stdout: string; readonly stderr: string } {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", [...args], { cwd, encoding: "utf8" });
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

function git(cwd: string, ...args: string[]): string {
  const result = run(cwd, args);
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${result.stderr || result.stdout}`);
  return result.stdout.trim();
}

/** `git merge-base --is-ancestor` as a raw exit status: 0 = contains, 1 = does not. */
function containsStatus(cwd: string, ancestor: string, descendant: string): number {
  return run(cwd, ["merge-base", "--is-ancestor", ancestor, descendant]).status;
}

/**
 * The REPOSITORY's own `.gitattributes`, not a hand-written copy.
 *
 * The union semantics that make the pre-merge worth doing at all are declared there, so a
 * fixture that restated them would keep passing after someone deleted the real lines.
 * Same reasoning as `prepare-heartbeat-branch.test.ts`.
 */
const REPO_GITATTRIBUTES = readFileSync(join(import.meta.dir, "..", "..", "..", ".gitattributes"), "utf8");

function commitFile(work: string, path: string, content: string, message: string): void {
  const full = join(work, path);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
  git(work, "add", path);
  git(work, "commit", "-m", message);
}

/**
 * A clone whose working tree is checked out on `main` — the exact state
 * `.github/workflows/agent-heartbeat.yml` supplies (`actions/checkout` with `ref: main`).
 * Every test starts here because that checkout is what made the original defect possible.
 */
function fixture(): { readonly root: string; readonly work: string } {
  const root = mkdtempSync(join(tmpdir(), "zeta-premerge-flush-"));
  roots.push(root);
  git(root, "init", "--bare", "origin.git");
  git(root, "clone", join(root, "origin.git"), "work");
  const work = join(root, "work");
  git(work, "config", "user.name", "test");
  git(work, "config", "user.email", "test@example.invalid");
  git(work, "switch", "-c", "main");
  commitFile(work, ".gitattributes", REPO_GITATTRIBUTES, "attributes");
  commitFile(work, "docs/github/prs/manifest.jsonl", '{"pr":1}\n', "seed manifest");
  git(work, "push", "-u", "origin", "main");
  return { root, work };
}

/** Push a lane ahead of main and return to `main`, leaving the tree as the flush job finds it. */
function laneAheadOfMain(work: string, files: readonly (readonly [string, string])[]): string {
  git(work, "switch", "-c", "heartbeat/soraya");
  for (const [path, content] of files) commitFile(work, path, content, `lane writes ${path}`);
  git(work, "push", "-u", "origin", "heartbeat/soraya");
  const laneSha = git(work, "rev-parse", "HEAD");
  git(work, "switch", "main");
  return laneSha;
}

/** Advance `origin/main` past the point the lane branched from. */
function advanceMain(work: string, path: string, content: string): void {
  git(work, "switch", "main");
  commitFile(work, path, content, `main writes ${path}`);
  git(work, "push", "origin", "main");
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("premergeFlushRef", () => {
  it("merges INTO the lane even though the working tree is checked out on main", () => {
    const { work } = fixture();
    const laneSha = laneAheadOfMain(work, [["docs/observe-events/a.json", '{"tick":1}\n']]);
    advanceMain(work, "unrelated.txt", "main moved\n");
    git(work, "fetch", "origin");

    const result = premergeFlushRef({ laneSha, cwd: work });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe("premerged");
    if (result.value.kind === "conflict") return;

    const merged = result.value.mergedSha;
    // The payload survived...
    expect(containsStatus(work, laneSha, merged)).toBe(0);
    // ...and so did main, which is what lets GitHub fast-forward.
    const mainSha = git(work, "rev-parse", "origin/main");
    expect(containsStatus(work, mainSha, merged)).toBe(0);
  });

  it("CONTROL: the previous implementation — merging while still on main — loses the lane", () => {
    // Not a test of production code. It reproduces the exact four lines this file replaced,
    // so the assertion above is provably discriminating rather than trivially true. Without
    // this control, "the result contains the lane" would read as a tautology; with it, the
    // old behaviour is on record failing the same predicate.
    const { work } = fixture();
    const laneSha = laneAheadOfMain(work, [["docs/observe-events/a.json", '{"tick":1}\n']]);
    advanceMain(work, "unrelated.txt", "main moved\n");
    git(work, "fetch", "origin");
    git(work, "switch", "main");

    git(work, "merge", "--no-edit", "origin/main"); // the old inline shell, verbatim in effect
    const oldMerged = git(work, "rev-parse", "HEAD");

    expect(oldMerged).toBe(git(work, "rev-parse", "origin/main"));
    expect(containsStatus(work, laneSha, oldMerged)).toBe(1);
  });

  it("applies the repository's union driver instead of conflicting on a co-appended index", () => {
    // docs/github/prs/manifest.jsonl is `merge=union` in .gitattributes. This is the file
    // whose staleness is the visible symptom when the flush stops landing.
    const { work } = fixture();
    const laneSha = laneAheadOfMain(work, [["docs/github/prs/manifest.jsonl", '{"pr":1}\n{"pr":2}\n']]);
    advanceMain(work, "docs/github/prs/manifest.jsonl", '{"pr":1}\n{"pr":3}\n');
    git(work, "fetch", "origin");

    const result = premergeFlushRef({ laneSha, cwd: work });
    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind === "conflict") throw new Error("expected a clean union merge");

    const merged = git(work, "show", `${result.value.mergedSha}:docs/github/prs/manifest.jsonl`);
    expect(merged).toContain('{"pr":2}');
    expect(merged).toContain('{"pr":3}');
  });

  it("reports a genuine conflict as backpressure and leaves HEAD back on the parked tip", () => {
    const { work } = fixture();
    const laneSha = laneAheadOfMain(work, [["shared.txt", "lane version\n"]]);
    advanceMain(work, "shared.txt", "main version\n");
    git(work, "fetch", "origin");

    const result = premergeFlushRef({ laneSha, cwd: work });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.kind).toBe("conflict");
    expect(git(work, "rev-parse", "HEAD")).toBe(laneSha);
    // The parked ref is untouched — nothing is lost by a conflicting pre-merge.
    expect(git(work, "rev-parse", "origin/heartbeat/soraya")).toBe(laneSha);
  });

  it("refuses to touch anything when the lane tip is already on the base", () => {
    const { work } = fixture();
    const laneSha = laneAheadOfMain(work, [["docs/observe-events/a.json", '{"tick":1}\n']]);
    git(work, "switch", "main");
    git(work, "merge", "--ff-only", "heartbeat/soraya");
    git(work, "push", "origin", "main");
    git(work, "fetch", "origin");
    const before = git(work, "rev-parse", "HEAD");

    const result = premergeFlushRef({ laneSha, cwd: work });
    expect(result).toEqual({ ok: true, value: { kind: "already-in-base", mergedSha: laneSha } });
    // No checkout happened: a fast-forward here is what wrote main over the snapshot ref.
    expect(git(work, "rev-parse", "HEAD")).toBe(before);
  });

  it("needs no merge commit when the lane already contains the base", () => {
    const { work } = fixture();
    advanceMain(work, "unrelated.txt", "main moved\n");
    const laneSha = laneAheadOfMain(work, [["docs/observe-events/a.json", '{"tick":1}\n']]);
    git(work, "fetch", "origin");

    const result = premergeFlushRef({ laneSha, cwd: work });
    expect(result).toEqual({ ok: true, value: { kind: "base-already-merged", mergedSha: laneSha } });
  });

  it("refuses a lane SHA that is not a 40-hex commit id rather than guessing a revision", () => {
    const { work } = fixture();
    const result = premergeFlushRef({ laneSha: "heartbeat/soraya", cwd: work });
    expect(result.ok).toBe(false);
  });

  it("refuses a lane SHA that is well-formed but absent", () => {
    const { work } = fixture();
    const result = premergeFlushRef({ laneSha: "0".repeat(40), cwd: work });
    expect(result.ok).toBe(false);
  });
});

describe("parseArgs", () => {
  it("requires --lane-sha and defaults base/remote", () => {
    expect(parseArgs(["--lane-sha", "a".repeat(40)])).toEqual({
      ok: true,
      args: { laneSha: "a".repeat(40), base: "main", remote: "origin" },
    });
    expect(parseArgs([])).toEqual({ ok: false });
    expect(parseArgs(["--base", "main"])).toEqual({ ok: false });
    expect(parseArgs(["--lane-sha"])).toEqual({ ok: false });
    expect(parseArgs(["--lane-sha", "a".repeat(40), "--nope", "x"])).toEqual({ ok: false });
  });
});
