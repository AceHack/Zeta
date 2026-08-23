// git-corpus.ts — read the corpus FROM A GIT REV, never from the working tree.
// 081M0QTXTR3087G0R002R439FH
//
// THIS FILE IS THE FIX FOR THE BUG THAT MOTIVATED THE WHOLE WORK-ITEM.
//
// On 2026-08-22 an agent searched for "landauer" with `grep -r` over the shared
// checkout and reported 0 files. The true answer at origin/main was 52 files,
// one of them a rule mentioning it 32 times. grep was not unreliable: the
// working tree it searched was 336 commits behind origin/main, so grep
// faithfully searched a stale corpus and returned a clean, confident, wrong
// answer with no signal that anything was off.
//
// So the corpus is addressed by REV. `git ls-tree -r <rev>` and `git cat-file`
// read the object store, not the checkout — which means the index is a function
// of the rev and of nothing else: uncommitted edits, a dirty tree, a stale
// checkout and a half-finished rebase all become invisible, which is exactly
// what is wanted. The same builder run on any host at the same rev produces the
// same bytes.

import { spawnSync } from "node:child_process";

export interface GitBlob {
  readonly path: string;
  readonly sha: string;
  readonly size: number;
}

function git(repoRoot: string, args: string[], maxBuffer = 512 * 1024 * 1024): string {
  const r = spawnSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    maxBuffer,
  });
  // NEVER read an exit status through a pipe: `spawnSync` gives the real status
  // of git itself, which is the point of not shelling out to `git ... | head`.
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed with status ${r.status}: ${(r.stderr || "").trim()}`);
  }
  return r.stdout;
}

function gitStatus(repoRoot: string, args: string[]): { status: number; stdout: string; stderr: string } {
  const r = spawnSync("git", ["-C", repoRoot, ...args], { encoding: "utf8" });
  if (r.error) throw r.error;
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** Resolve a revision to a full 40-hex commit sha. Throws if it does not resolve. */
export function resolveRev(repoRoot: string, rev: string): string {
  return git(repoRoot, ["rev-parse", "--verify", `${rev}^{commit}`]).trim();
}

/** The tree object of a commit. Two commits with the same tree index identically. */
export function treeOf(repoRoot: string, rev: string): string {
  return git(repoRoot, ["rev-parse", "--verify", `${rev}^{tree}`]).trim();
}

/** True when `ancestor` is an ancestor of `descendant` (or equal to it). */
export function isAncestor(repoRoot: string, ancestor: string, descendant: string): boolean {
  const r = gitStatus(repoRoot, ["merge-base", "--is-ancestor", ancestor, descendant]);
  if (r.status === 0) return true;
  if (r.status === 1) return false;
  throw new Error(`git merge-base --is-ancestor failed: ${r.stderr.trim()}`);
}

/** True when the object is present in the local store — a shallow clone may not have it. */
export function hasCommit(repoRoot: string, rev: string): boolean {
  return gitStatus(repoRoot, ["cat-file", "-e", `${rev}^{commit}`]).status === 0;
}

export function commitsBetween(repoRoot: string, from: string, to: string): number {
  const out = git(repoRoot, ["rev-list", "--count", `${from}..${to}`]).trim();
  return Number.parseInt(out, 10);
}

/** Paths that changed between two revs. The bounded set a stale answer must verify against. */
export function changedPaths(repoRoot: string, from: string, to: string): string[] {
  const out = git(repoRoot, ["diff", "--name-only", "-z", from, to]);
  return out.split("\0").filter((p) => p.length > 0);
}

/**
 * Every blob reachable at `rev`, with size. `-l` gives the object size without
 * reading the content, so the oversize filter costs no blob reads.
 */
export function listBlobs(repoRoot: string, rev: string): GitBlob[] {
  const out = git(repoRoot, ["ls-tree", "-r", "-l", "-z", `${rev}^{tree}`]);
  const blobs: GitBlob[] = [];
  for (const rec of out.split("\0")) {
    if (rec.length === 0) continue;
    // "<mode> SP <type> SP <sha> SP* <size> TAB <path>"
    const tab = rec.indexOf("\t");
    if (tab < 0) continue;
    const meta = rec.slice(0, tab);
    const path = rec.slice(tab + 1);
    const parts = meta.split(/\s+/);
    if (parts.length < 4) continue;
    if (parts[1] !== "blob") continue;
    const size = Number.parseInt(parts[3]!, 10);
    if (!Number.isFinite(size)) continue;
    blobs.push({ path, sha: parts[2]!, size });
  }
  return blobs;
}

/**
 * Read many blobs in ONE `git cat-file --batch` process.
 *
 * Spawning git per blob costs ~4ms; at ~24,000 blobs that is 90 seconds of pure
 * process churn, and on this host every file open is also scanned by Defender
 * (measured at 464% CPU in `../README.md`). Batch mode reads the object store
 * once and streams, which is why a full rebuild is affordable enough that we
 * never need incremental updates to be correct — only to be fast.
 */
export function readBlobs(
  repoRoot: string,
  shas: readonly string[],
  onBlob: (sha: string, content: Buffer) => void,
): void {
  if (shas.length === 0) return;
  const input = shas.join("\n") + "\n";
  const r = spawnSync("git", ["-C", repoRoot, "cat-file", "--batch"], {
    input,
    maxBuffer: 2 * 1024 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) {
    throw new Error(`git cat-file --batch failed: ${String(r.stderr)}`);
  }
  const buf = r.stdout as unknown as Buffer;
  let off = 0;
  for (let i = 0; i < shas.length; i++) {
    const nl = buf.indexOf(0x0a, off);
    if (nl < 0) break;
    const header = buf.toString("utf8", off, nl);
    const parts = header.split(" ");
    if (parts.length < 3) {
      throw new Error(`unexpected cat-file header: ${header}`);
    }
    const size = Number.parseInt(parts[2]!, 10);
    const start = nl + 1;
    onBlob(parts[0]!, buf.subarray(start, start + size));
    off = start + size + 1; // trailing newline after the object
  }
}

/**
 * Blob sizes at a rev, for the given paths. Used to apply the SAME size cap the
 * builder applies, so the two answer paths agree about what is in the corpus.
 * A path absent from the result was deleted at that rev.
 */
export function blobSizesAt(repoRoot: string, rev: string, paths: readonly string[]): Map<string, number> {
  const out = new Map<string, number>();
  if (paths.length === 0) return out;
  const CHUNK = 400;
  for (let i = 0; i < paths.length; i += CHUNK) {
    const slice = paths.slice(i, i + CHUNK);
    const text = git(repoRoot, ["ls-tree", "-r", "-l", "-z", `${rev}^{tree}`, "--", ...slice]);
    for (const rec of text.split("\0")) {
      if (rec.length === 0) continue;
      const tab = rec.indexOf("\t");
      if (tab < 0) continue;
      const parts = rec.slice(0, tab).split(/\s+/);
      if (parts.length < 4 || parts[1] !== "blob") continue;
      const size = Number.parseInt(parts[3]!, 10);
      if (Number.isFinite(size)) out.set(rec.slice(tab + 1), size);
    }
  }
  return out;
}

/**
 * Heuristic binary detection: a NUL byte in the first 8 KiB.
 *
 * The same rule git itself uses to decide whether to print "Binary files
 * differ". Stated as a heuristic rather than a guarantee: a UTF-16 file with no
 * NUL in its first 8 KiB will be indexed as mojibake. The manifest's extension
 * allowlist is the real filter; this catches the stragglers.
 */
export function looksBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8192);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}
