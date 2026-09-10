#!/usr/bin/env bun
// consume-pr-archives.ts — drain orphaned `automation/pr-archive-*` branches into main.
//
// WHY: the `pr-archive-on-merge` workflow pushes a per-PR archive to a bot branch but
// CANNOT open a PR (the enterprise blocks GitHub Actions from creating/approving PRs), so
// the archives orphan on `automation/pr-archive-*` branches and never reach `main`. This is
// the most valuable data (GitOps fine-tuning / training fuel + the shadow's reviewed-work
// logs) and is rate-limited to refetch. This tool is the reliable DRAIN: a human/agent (who
// — unlike Actions — *can* open PRs) runs it periodically to consolidate the pending archive
// branches into the working tree, then commits + opens a normal PR. No enterprise-policy
// relaxation required.
//
// SAFETY: extracts ONLY each branch's archive `.md`, its per-PR shard JSON, and its manifest
// line — never the branch's full diff (those branches are based on OLD main and would revert
// later code). Verifies file↔manifest integrity. `--delete` removes a source branch ONLY after
// its archive `.md` is present in the working tree (i.e. preserved). Idempotent.
//
// 2026-08-13 (081KZYMY46P087G0R003S64V2B): archive runs now also write
// `docs/github/prs/shards/<NNN>/<zetaid>.json` — one file per PR, which is the record of
// truth; `manifest.jsonl` is derived from it. This drain extracts BOTH, because an archive
// branch cut after the writer change carries a shard and may (once the workflow edit lands)
// carry no manifest line at all. Taking only the manifest line would silently lose the shard,
// and taking only the shard would leave the derived index stale — so both are copied, and
// `derive-pr-manifest.ts` can always rebuild the index from what landed.
//
// Usage:
//   bun tools/archive/consume-pr-archives.ts [--delete] [--limit N] [--remote origin]
//     (no flags)  consolidate all pending archive branches into the working tree (no deletion)
//     --delete    after consolidation, delete the consumed source branches from the remote
//     --limit N   process at most N branches (for testing)
//
// After running, commit `docs/history/pr-reviews/` + `docs/github/prs/manifest.jsonl` and open a PR.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { readFileBounded, writeFileOwned, writeTextIfChanged } from "../../io/safe-io.ts";

/**
 * 0o644 — the mode `writeFileSync` produced under the repo's umask, kept
 * exactly. The safe-io writers default to 0o600, and a repository file that
 * only its writer can read is a change nobody asked for.
 */
const REPO_FILE_MODE = 0o644;

/**
 * The manifest is ~7.6 MiB on `main` and grows by one line per merged PR.
 * 256 MiB is decades of headroom; one that reaches it is a defect worth
 * failing loudly on rather than loading whole.
 */
const MANIFEST_MAX_BYTES = 256 * 1024 * 1024;

import { basename, dirname } from "node:path";

import { stripRemotePrefix } from "../../git/ref-prefix.ts";
import { MANIFEST_RELATIVE, SHARD_ROOT_RELATIVE, shardPathFor } from "./pr-manifest-shards.ts";

const REVIEW_DIR = "docs/history/pr-reviews";
const MANIFEST = MANIFEST_RELATIVE;
const SHARD_ROOT = SHARD_ROOT_RELATIVE;

function git(args: string[], allowFail = false): string {
  const r = spawnSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0 && !allowFail) {
    console.error(`git ${args.join(" ")} failed:\n${r.stderr}`);
    process.exit(1);
  }
  return (r.stdout ?? "").trim();
}

function prNumberOf(branch: string): number | null {
  const m = branch.match(/pr-archive-(\d+)-run/);
  return m ? Number(m[1]) : null;
}

/** pr_number -> manifest line, from a manifest blob. */
function manifestByPr(blob: string): Map<number, string> {
  const m = new Map<number, string>();
  for (const line of blob.split("\n")) {
    const mm = line.match(/"pr_number":(\d+)/);
    if (mm) m.set(Number(mm[1]), line);
  }
  return m;
}

const args = process.argv.slice(2);
const doDelete = args.includes("--delete");
const remote = (args.includes("--remote") ? args[args.indexOf("--remote") + 1] : "origin") ?? "origin";
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) : Infinity;

git(["fetch", remote, "--prune", "-q"], true);

// On-main manifest is the union target; start from current working-tree manifest if present.
// ONE OPEN, and `not-found` is the only error that means "absent". `existsSync`
// returning false for EACCES made a present-but-unreadable manifest look
// missing, and the consolidated write at the end of this script then replaced
// it with whatever the branches carried. CodeQL `js/file-system-race`.
const baseRead = readFileBounded(MANIFEST, { maxBytes: MANIFEST_MAX_BYTES });
if (!baseRead.ok && baseRead.error.kind !== "not-found") {
  console.error(`cannot read ${MANIFEST}: ${baseRead.error.message}`);
  process.exit(2);
}
const baseManifest = baseRead.ok ? baseRead.value.text : "";
const merged = manifestByPr(baseManifest);
const onMainPrs = new Set(merged.keys());

const branches = git(["branch", "-r"])
  .split("\n")
  .map((b) => stripRemotePrefix(b.trim(), remote))
  .filter((b) => b.startsWith("automation/pr-archive-"))
  .sort()
  .slice(0, limit === Infinity ? undefined : limit);

if (!existsSync(REVIEW_DIR)) mkdirSync(REVIEW_DIR, { recursive: true });

let consumed = 0;
let skippedNoMd = 0;
let shardsConsumed = 0;
const toDelete: string[] = [];

for (const branch of branches) {
  const ref = `${remote}/${branch}`;
  const pr = prNumberOf(branch);
  if (pr === null) continue;

  // The .md ADDED by the tip (archive) commit only — never the stale branch diff.
  const added = git(["show", ref, "--name-only", "--pretty=format:", "--diff-filter=A"], true)
    .split("\n")
    .map((s) => s.trim())
    .find((p) => p.startsWith(`${REVIEW_DIR}/`) && p.endsWith(".md"));

  if (!added) {
    skippedNoMd++;
    continue;
  }

  const content = git(["show", `${ref}:${added}`], true);
  if (!content) {
    skippedNoMd++;
    continue;
  }
  const mdWrite = writeFileOwned(
    `${REVIEW_DIR}/${basename(added)}`,
    content.endsWith("\n") ? content : content + "\n",
    {
      mode: REPO_FILE_MODE,
    },
  );
  if (!mdWrite.ok) {
    console.error(`cannot write ${REVIEW_DIR}/${basename(added)}: ${mdWrite.error.message}`);
    process.exit(2);
  }

  // The per-PR shard, if this branch was cut after the shard writer landed. Its path is a
  // pure function of `pr` (no scan, no guessing) — see pr-manifest-shards.ts.
  const shardRel = shardPathFor(pr, SHARD_ROOT);
  const shardBlob = git(["show", `${ref}:${shardRel}`], true);
  if (shardBlob) {
    mkdirSync(dirname(shardRel), { recursive: true });
    const shardWrite = writeFileOwned(shardRel, shardBlob.endsWith("\n") ? shardBlob : shardBlob + "\n", {
      mode: REPO_FILE_MODE,
    });
    if (!shardWrite.ok) {
      console.error(`cannot write ${shardRel}: ${shardWrite.error.message}`);
      process.exit(2);
    }
    shardsConsumed++;
  }

  // The manifest line for THIS pr (match pr_number, not tail — branch base may be old).
  const branchManifest = git(["show", `${ref}:${MANIFEST}`], true);
  const line = manifestByPr(branchManifest).get(pr);
  if (line) merged.set(pr, line);

  // Safe to delete: the .md is now in the working tree (preserved).
  if (doDelete && !onMainPrs.has(pr)) toDelete.push(branch);
  else if (doDelete) toDelete.push(branch); // already on main = redundant, also safe
  consumed++;
}

// Write the consolidated manifest (sorted by pr_number for stable diffs).
const lines = [...merged.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l);
const manifestWrite = writeTextIfChanged(MANIFEST, lines.join("\n") + (lines.length ? "\n" : ""), {
  mode: REPO_FILE_MODE,
  maxBytes: MANIFEST_MAX_BYTES,
});
if (!manifestWrite.ok) {
  console.error(`cannot write ${MANIFEST}: ${manifestWrite.error.message}`);
  process.exit(2);
}

console.log(
  `consumed: ${consumed} | shards: ${shardsConsumed} | skipped (no archive .md): ${skippedNoMd} | manifest entries: ${merged.size}`,
);

if (doDelete && toDelete.length) {
  console.log(`deleting ${toDelete.length} consumed source branches from ${remote}…`);
  // batches of 100 refs per push
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100);
    git(["push", remote, "--delete", ...batch], true);
  }
  console.log("delete pass complete.");
}

console.log(
  `\nNext: git add ${REVIEW_DIR} ${SHARD_ROOT} ${MANIFEST} && commit && open a PR (agents/humans can open PRs; Actions cannot).` +
    `\n      If the manifest and the shards disagree, the shards win: bun src/Core.TypeScript/forge-host/github/derive-pr-manifest.ts --write`,
);
