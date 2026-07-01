#!/usr/bin/env bun
// triage-orphan-branches.ts — classify a namespace's orphan branches as
// safe-to-prune / archive-drain / unlanded-content, the preserve-FIRST way.
//
// WHY: the post-reboot (2026-06-30) branch-prune triage proved that "merged-PR"
// alone is NOT a safe prune gate — squash-merges fool ancestry, and bot branches
// (pr-archive) have no PR yet hold real content. A blind prune erased nothing
// only because each branch's *content* was checked against main first. This tool
// productizes that pipeline so each persona/namespace owner runs ONE command.
//
// THE GATE (conservative, errs toward keeping): a branch is SAFE to prune iff it
// introduces NO file whose basename is absent from main (excluding a small
// regenerable-ephemera allowlist). Anything that adds absent content is flagged —
// UNLANDED (durable: memory/docs/src → preserve before prune) or ARCHIVE (only
// docs/history/pr-reviews/** → run consume-pr-archives.ts). Never auto-prunes
// those.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/triage-orphan-branches.ts <namespace> [--prune] [--limit N] [--remote origin]
//     <namespace>  branch prefix to triage (e.g. "lior", "shard/", "feat")
//     (no --prune) REPORT ONLY (dry run) — classify and print, delete nothing
//     --prune      after classification, delete the SAFE branches from the remote
//                  (SHAs printed first; all SAFE content is on main, so reversible)
//     --limit N    classify at most N branches (for testing)
//
// Exit 0 = ran (counts in body are not errors). Exit 1 = fatal invocation error.

import { spawnSync } from "node:child_process";

const REMOTE_DEFAULT = "origin";

// Regenerable / ephemeral paths whose absence from main is NOT lost work.
const EPHEMERAL = [
  "docs/hygiene-history/",
  "docs/pr-discussions/",
];

interface Triage {
  readonly branch: string;
  readonly klass: "SAFE" | "ARCHIVE" | "UNLANDED";
  readonly absent: readonly string[];
  readonly sha: string;
}

function git(args: readonly string[], allowFail = false): string {
  const r = spawnSync("git", [...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.status !== 0 && !allowFail) {
    process.stderr.write(`git ${args.join(" ")} failed:\n${r.stderr}\n`);
    process.exit(1);
  }
  return (r.stdout ?? "").trim();
}

/** Like git() but returns exit status + combined stdout/stderr. Needed for
 *  `git push --delete`, which writes its "[deleted]" progress markers to STDERR,
 *  not stdout — so counting deletions off git()'s stdout-only return always saw 0
 *  even when every ref was deleted. Count off `combined` instead. */
function gitRun(args: readonly string[]): { ok: boolean; combined: string } {
  const r = spawnSync("git", [...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  return { ok: r.status === 0, combined: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function basenamesOnMain(remote: string): Set<string> {
  const out = git(["ls-tree", "-r", "--name-only", `${remote}/main`]);
  const set = new Set<string>();
  for (const line of out.split("\n")) {
    const slash = line.lastIndexOf("/");
    const base = slash === -1 ? line : line.slice(slash + 1);
    if (base.length > 0) set.add(base);
  }
  return set;
}

function isEphemeral(path: string): boolean {
  return EPHEMERAL.some((p) => path.startsWith(p));
}

function classify(
  branch: string,
  remote: string,
  mainBases: Set<string>,
): Triage {
  const sha = git(["rev-parse", `${remote}/${branch}`], true).slice(0, 12);
  // Files this branch ADDS or MODIFIES relative to the merge-base with main.
  const diff = git(
    ["diff", `${remote}/main...${remote}/${branch}`, "--diff-filter=AM", "--name-only"],
    true,
  );
  const added = diff.split("\n").filter((f) => f.length > 0);
  const absent: string[] = [];
  for (const f of added) {
    if (isEphemeral(f)) continue;
    const slash = f.lastIndexOf("/");
    const base = slash === -1 ? f : f.slice(slash + 1);
    if (!mainBases.has(base)) absent.push(f);
  }
  if (absent.length === 0) return { branch, klass: "SAFE", absent: [], sha };
  const allArchive = absent.every((f) => f.startsWith("docs/history/pr-reviews/"));
  return { branch, klass: allArchive ? "ARCHIVE" : "UNLANDED", absent, sha };
}

function main(): number {
  const argv = process.argv.slice(2);
  const namespace = argv.find((a) => !a.startsWith("--"));
  if (namespace === undefined) {
    process.stderr.write(
      "usage: triage-orphan-branches.ts <namespace> [--prune] [--limit N] [--remote origin]\n",
    );
    return 1;
  }
  const doPrune = argv.includes("--prune");
  const remote = argv.includes("--remote")
    ? (argv[argv.indexOf("--remote") + 1] ?? REMOTE_DEFAULT)
    : REMOTE_DEFAULT;
  const limit = argv.includes("--limit")
    ? Number(argv[argv.indexOf("--limit") + 1])
    : Infinity;

  git(["fetch", remote, "--prune", "-q"], true);

  const orphans = git([
    "for-each-ref",
    "--no-merged",
    `${remote}/main`,
    "--format=%(refname:short)",
    `refs/remotes/${remote}/`,
  ])
    .split("\n")
    .map((b) => b.replace(new RegExp(`^${remote}/`), ""))
    .filter((b) => b.startsWith(namespace))
    .sort();
  const targets = Number.isFinite(limit) ? orphans.slice(0, limit) : orphans;

  console.log(`# Orphan-branch triage — namespace "${namespace}" (${remote})`);
  console.log("");
  console.log(`Orphan branches in namespace: ${orphans.length}${targets.length < orphans.length ? ` (classifying ${targets.length})` : ""}`);
  console.log("");

  const mainBases = basenamesOnMain(remote);
  const results = targets.map((b) => classify(b, remote, mainBases));

  const safe = results.filter((r) => r.klass === "SAFE");
  const archive = results.filter((r) => r.klass === "ARCHIVE");
  const unlanded = results.filter((r) => r.klass === "UNLANDED");

  console.log(`## Classification`);
  console.log(`- SAFE (content on main → prunable): ${safe.length}`);
  console.log(`- ARCHIVE (only unlanded pr-review archives → run consume-pr-archives.ts): ${archive.length}`);
  console.log(`- UNLANDED (durable content absent from main → PRESERVE before prune): ${unlanded.length}`);
  console.log("");

  if (unlanded.length > 0) {
    console.log(`## UNLANDED — preserve these first (do NOT prune)`);
    for (const r of unlanded) {
      console.log(`- ${r.branch}`);
      for (const f of r.absent.slice(0, 12)) console.log(`    ${f}`);
      if (r.absent.length > 12) console.log(`    … and ${r.absent.length - 12} more`);
    }
    console.log("");
  }
  if (archive.length > 0) {
    console.log(`## ARCHIVE — run: bun src/Core.TypeScript/forge-host/github/consume-pr-archives.ts --delete`);
    console.log(`  (${archive.length} branches carry unlanded pr-review archives — drain, don't discard)`);
    console.log("");
  }

  if (doPrune) {
    if (safe.length === 0) {
      console.log("## Prune: no SAFE branches to delete.");
    } else {
      console.log(`## Prune — deleting ${safe.length} SAFE branches (SHAs first; all content on main)`);
      for (const r of safe) console.log(`  ${r.sha}  ${r.branch}`);
      // Delete in chunks so one bad ref can't abort the whole push.
      const CHUNK = 40;
      let deleted = 0;
      for (let i = 0; i < safe.length; i += CHUNK) {
        const batch = safe.slice(i, i + CHUNK).map((r) => r.branch);
        const res = gitRun(["push", remote, "--delete", ...batch]);
        // "[deleted]" markers land on stderr → count off combined output, not stdout.
        deleted += (res.combined.match(/\[deleted\]/g) ?? []).length;
        if (!res.ok) {
          process.stderr.write(
            `  warning: batch delete returned non-zero (some refs may already be gone):\n${res.combined}\n`,
          );
        }
      }
      console.log(`  deleted: ${deleted}/${safe.length}`);
    }
  } else {
    console.log(`## Dry run — re-run with --prune to delete the ${safe.length} SAFE branches.`);
  }
  console.log("");
  console.log(`Triage complete. Gate: a branch is SAFE iff it adds no basename absent from main (ephemera excluded). Errs toward keeping.`);
  return 0;
}

if (import.meta.main || (typeof process !== "undefined" && process.argv[1] && (process.argv[1].includes("triage-orphan-branches") || process.argv[1].endsWith("tsx")))) {
  process.exit(main());
}
