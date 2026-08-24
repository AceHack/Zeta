#!/usr/bin/env bun
// branch-reaper.ts — census and reversible reaping of stale remote branches.
//
// WHY THIS EXISTS (and why `git branch --merged` is not it):
// every PR in this repo lands via SQUASH merge, which writes a NEW commit onto
// main whose parent is main. The branch tip is therefore NEVER an ancestor of
// main, so `git branch -r --merged origin/main` reports 6 of 3,627 branches as
// merged. That number is an artifact of the merge strategy, not a backlog of
// unmerged work. Measured 2026-08-24. Anyone reaching for `--merged` here will
// either delete nothing or, on inverting the test, delete live work.
//
// THE CORRECT CRITERION IS PR STATE, read from the GitHub API. A branch is a
// reap candidate iff its PR is MERGED. Open PRs are never touched; closed-
// unmerged and PR-less branches are reported, never deleted, because either may
// hold work somebody abandoned but wants.
//
// REVERSIBILITY IS THE PRECONDITION, not a nicety. Deleting thousands of refs is
// destructive at a scale that would otherwise need a fresh authorization. It
// stops being that when every deletion is recoverable, so the manifest carrying
// (branch, sha) for every planned deletion is COMMITTED TO MAIN BEFORE any
// deletion runs. A manifest written after a crash-interrupted delete is
// worthless. Restore is then:
//     git push origin <sha>:refs/heads/<branch>
//
// The manifest is JSONL — text, diffable, mergeable, replayable — per
// .claude/rules/no-binary-in-proof-lineage.md.
//
// PREFER `branch-reaper.ts restore <branch>` OVER PASTING THE REFSPEC. It spawns
// git directly with no shell, which sidesteps a zsh trap that cost a live branch
// during the 2026-08-24 restore proof: zsh applies its `:r` history modifier to
// an UNBRACED parameter expansion, so
//     git push origin "$SHA:refs/heads/$BRANCH"     # zsh
// silently becomes `<sha>efs/heads/<branch>` — the `:r` is eaten, the push fails
// with "src refspec ... does not match any", and the branch stays deleted. The
// literal string stored in the manifest is safe to paste (no expansion happens);
// `"${SHA}:refs/heads/${BRANCH}"` is safe; the unbraced form is not.
//
// COMPOSES, does not replace, triage-orphan-branches.ts: that tool's content
// gate (does this branch add a file whose basename is absent from main?) runs as
// the LAST gate here, after the PR-state and protection gates it lacks.
//
// Usage:
//   bun src/Core.TypeScript/hygiene/branch-reaper.ts census [--window-days N]
//   bun src/Core.TypeScript/hygiene/branch-reaper.ts reap --batch N [--yes]
//   bun src/Core.TypeScript/hygiene/branch-reaper.ts restore <branch>
//   bun src/Core.TypeScript/hygiene/branch-reaper.ts verify
//
// Exit 0 = ran. Exit 1 = fatal invocation/environment error.

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const REPO = process.env.ZETA_REAPER_REPO ?? "Lucent-Financial-Group/Zeta";
const REMOTE = process.env.ZETA_REAPER_REMOTE ?? "origin";

/** Committed, restorable record of every branch this tool plans to delete. */
const MANIFEST = "docs/branch-reaper/planned-deletions.jsonl";
/** Append-only log of deletions actually executed. Resumability reads this. */
const EXECUTED = "docs/branch-reaper/executed-deletions.jsonl";
/** Local scratch (NOT committed) — the PR map is large and re-derivable. */
const CACHE_DIR = ".reaper-cache";

/** Default safety window. A branch whose tip is younger than this is skipped
 *  even when its PR is merged: the cost of waiting a week is zero, and the cost
 *  of racing an agent that is still pushing to a just-merged branch is not. */
const DEFAULT_WINDOW_DAYS = 7;

type Bucket =
  | "PROTECTED"      // a deletion ruleset forbids it — never delete
  | "OPEN_PR"        // head or base of an open PR — never delete
  | "RECENT"         // inside the safety window — skip this pass
  | "MERGED_PR"      // PR merged, content on main — REAP CANDIDATE
  | "CONTENT_HELD"   // PR merged but branch adds content absent from main
  | "CLOSED_PR"      // PR closed unmerged — report, do not delete
  | "NO_PR"          // no PR at all — report, do not delete
  | "UNCHECKABLE";   // the content gate could not RUN — fail closed, never delete

interface Pr {
  readonly number: number;
  readonly state: string;
  readonly headRefName: string;
  readonly baseRefName: string;
}

interface Row {
  readonly branch: string;
  readonly sha: string;
  readonly tip_iso: string;
  readonly age_days: number;
  readonly pr_number: number | null;
  readonly pr_state: string | null;
  readonly bucket: Bucket;
  readonly absent?: readonly string[];
}

function git(args: readonly string[], allowFail = false): string {
  const r = spawnSync("git", [...args], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
  if (r.status !== 0 && !allowFail) {
    process.stderr.write(`git ${args.join(" ")} failed (status ${r.status}):\n${r.stderr}\n`);
    process.exit(1);
  }
  return (r.stdout ?? "").trim();
}

/** git push --delete writes its "[deleted]" markers to STDERR, so a caller that
 *  counts off stdout alone always sees 0 even when every ref went. Return both. */
function gitRun(args: readonly string[]): { status: number; combined: string } {
  const r = spawnSync("git", [...args], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
  return { status: r.status ?? -1, combined: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

function gh(args: readonly string[]): { status: number; out: string; err: string } {
  const r = spawnSync("gh", [...args], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
  return { status: r.status ?? -1, out: r.stdout ?? "", err: r.stderr ?? "" };
}

/** Convert a GitHub ruleset ref-name pattern to a predicate.
 *  CHECKED, NOT TRUSTED: the protected set is read from the live rulesets API on
 *  every run rather than hardcoded, so a ruleset added tomorrow protects its
 *  branches today without a code change. */
function protectionPredicates(defaultBranch: string): { patterns: string[]; test: (b: string) => boolean } {
  const r = gh(["api", `/repos/${REPO}/rulesets`, "--jq", ".[].id"]);
  if (r.status !== 0) {
    process.stderr.write(`FATAL: cannot read rulesets (${r.err.trim()}).\n` +
      `Refusing to reap without knowing what is protected.\n`);
    process.exit(1);
  }
  const ids = r.out.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
  const patterns: string[] = [];
  for (const id of ids) {
    const d = gh(["api", `/repos/${REPO}/rulesets/${id}`]);
    if (d.status !== 0) continue;
    const rs = JSON.parse(d.out) as {
      enforcement: string;
      rules?: { type: string }[];
      conditions?: { ref_name?: { include?: string[] } };
    };
    if (rs.enforcement !== "active") continue;
    // Only a `deletion` rule makes a branch un-reapable. A required-status-check
    // ruleset constrains pushes, not deletions, and must not be read as protection.
    if (!(rs.rules ?? []).some((x) => x.type === "deletion")) continue;
    for (const inc of rs.conditions?.ref_name?.include ?? []) patterns.push(inc);
  }
  const test = (branch: string): boolean => {
    const full = `refs/heads/${branch}`;
    for (const p of patterns) {
      if (p === "~DEFAULT_BRANCH") { if (branch === defaultBranch) return true; continue; }
      if (p === "~ALL") return true;
      if (p.endsWith("/*")) { if (full.startsWith(p.slice(0, -1))) return true; continue; }
      if (p === full) return true;
    }
    return false;
  };
  return { patterns, test };
}

function loadPrMap(): Map<string, Pr> {
  const path = `${CACHE_DIR}/all-prs.json`;
  // One syscall, one answer. An `existsSync` gate here would return an answer that is
  // already stale by the time the read runs, and would read as defensive while
  // preventing nothing -- the vacuity class in file-system form.
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    process.stderr.write(`FATAL: ${path} missing. Run:\n` +
      `  gh pr list --repo ${REPO} --state all --limit 30000 ` +
      `--json number,state,headRefName,baseRefName,mergedAt,closedAt,updatedAt > ${path}\n`);
    process.exit(1);
  }
  const prs = JSON.parse(raw) as Pr[];
  // Highest PR number wins when a branch was reused across several PRs: the most
  // recent PR is the one whose state describes the branch as it stands now. An
  // older MERGED PR on a reused branch must never mask a newer OPEN one.
  const map = new Map<string, Pr>();
  for (const pr of prs) {
    const cur = map.get(pr.headRefName);
    if (cur === undefined || pr.number > cur.number) map.set(pr.headRefName, pr);
  }
  return map;
}

function openBases(prs: Pr[]): Set<string> {
  const s = new Set<string>();
  for (const pr of prs) if (pr.state === "OPEN") s.add(pr.baseRefName);
  return s;
}

function basenamesOnMain(): Set<string> {
  const out = git(["ls-tree", "-r", "--name-only", `${REMOTE}/main`]);
  const set = new Set<string>();
  for (const line of out.split("\n")) {
    const i = line.lastIndexOf("/");
    const base = i === -1 ? line : line.slice(i + 1);
    if (base.length > 0) set.add(base);
  }
  return set;
}

const EPHEMERAL = ["docs/hygiene-history/", "docs/pr-discussions/"];

/** The triage-orphan-branches.ts content gate, reused as the final guard: does
 *  this branch introduce a file whose basename is absent from main? If so its
 *  content never landed and the branch is NOT safe, whatever its PR says. */
function absentContent(
  branch: string,
  mainBases: Set<string>,
): { ran: true; absent: string[] } | { ran: false; why: string } {
  // FAIL CLOSED. `git diff A...B` needs a merge base; on a shallow clone there
  // is none and the command exits non-zero. The inherited helper swallowed that
  // with allowFail and returned "", so an ERRORED diff produced an EMPTY absent
  // list and the branch read as SAFE TO DELETE. That is a check that did not run
  // looking like one that passed — measured on this repo 2026-08-24, where a
  // shallow clone made the gate return "safe" for all 3,629 branches.
  // A gate that cannot run must refuse, never pass.
  const r = spawnSync(
    "git",
    ["diff", `${REMOTE}/main...${REMOTE}/${branch}`, "--diff-filter=AM", "--name-only"],
    { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 },
  );
  if (r.status !== 0) return { ran: false, why: (r.stderr ?? "").trim().split("\n")[0] ?? "git diff failed" };
  const diff = (r.stdout ?? "").trim();
  const absent: string[] = [];
  for (const f of diff.split("\n").filter((x) => x.length > 0)) {
    if (EPHEMERAL.some((p) => f.startsWith(p))) continue;
    const i = f.lastIndexOf("/");
    const base = i === -1 ? f : f.slice(i + 1);
    if (!mainBases.has(base)) absent.push(f);
  }
  return { ran: true, absent };
}

function writeLines(path: string, lines: readonly string[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, lines.length > 0 ? `${lines.join("\n")}\n` : "");
}

function readJsonl<T>(path: string): T[] {
  // Absent file == empty list, decided by the read itself rather than by a prior
  // existence check whose answer is stale before it is used.
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  return text
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as T);
}

function census(windowDays: number): number {
  const defaultBranch = git(["symbolic-ref", "--short", `refs/remotes/${REMOTE}/HEAD`], true)
    .replace(`${REMOTE}/`, "") || "main";
  // A shallow clone silently disables the content gate (no merge base => every
  // diff errors). Refuse rather than emit a census whose safety column is fiction.
  if (git(["rev-parse", "--is-shallow-repository"], true) === "true") {
    process.stderr.write(
      "FATAL: shallow clone. `git diff main...branch` has no merge base here, so the\n" +
      "content gate cannot run and every branch would read as safe. Run:\n" +
      "  git fetch --unshallow origin\n",
    );
    process.exit(1);
  }
  const prot = protectionPredicates(defaultBranch);
  const prMap = loadPrMap();
  const allPrs = JSON.parse(readFileSync(`${CACHE_DIR}/all-prs.json`, "utf8")) as Pr[];
  const bases = openBases(allPrs);
  const mainBases = basenamesOnMain();
  const nowMs = Date.now();
  const cutoffMs = windowDays * 86400 * 1000;

  const refs = git([
    "for-each-ref", `refs/remotes/${REMOTE}/`,
    "--format=%(refname:short)%09%(objectname)%09%(committerdate:iso-strict)",
  ]).split("\n").filter((l) => l.length > 0);

  const rows: Row[] = [];
  for (const line of refs) {
    // `--format` above asks for exactly three tab-separated fields. If git ever returns
    // fewer, the assumption behind every downstream field is broken -- so this REFUSES
    // rather than coercing with `!`. A malformed ref line that silently became a row
    // would be a census entry nobody could trace back to a real ref: the vacuity class,
    // wearing a plausible branch name.
    const parts = line.split("\t");
    if (parts.length !== 3) {
      throw new Error(
        `for-each-ref returned ${parts.length} field(s), expected 3: ${JSON.stringify(line)}`,
      );
    }
    const [refShort, sha, tipIso] = parts as [string, string, string];
    const branch = refShort.replace(new RegExp(`^${REMOTE}/`), "");
    if (branch === "HEAD" || branch === defaultBranch) continue;
    const ageDays = (nowMs - new Date(tipIso).getTime()) / 86400000;
    const pr = prMap.get(branch);
    const prNumber = pr?.number ?? null;
    const prState = pr?.state ?? null;

    let bucket: Bucket;
    let absent: string[] | undefined;
    if (prot.test(branch)) bucket = "PROTECTED";
    else if (pr?.state === "OPEN" || bases.has(branch)) bucket = "OPEN_PR";
    else if (pr === undefined) bucket = "NO_PR";
    else if (pr.state === "CLOSED") bucket = "CLOSED_PR";
    else if (nowMs - new Date(tipIso).getTime() < cutoffMs) bucket = "RECENT";
    else {
      const gate = absentContent(branch, mainBases);
      if (!gate.ran) { bucket = "UNCHECKABLE"; absent = [gate.why]; }
      else { absent = gate.absent; bucket = gate.absent.length === 0 ? "MERGED_PR" : "CONTENT_HELD"; }
    }
    rows.push({
      branch, sha, tip_iso: tipIso, age_days: Math.round(ageDays * 10) / 10,
      pr_number: prNumber, pr_state: prState, bucket,
      ...(absent !== undefined && absent.length > 0 ? { absent: absent.slice(0, 20) } : {}),
    });
  }

  const by = (b: Bucket): Row[] => rows.filter((r) => r.bucket === b);
  const candidates = by("MERGED_PR");

  // THE MANIFEST LANDS BEFORE ANY DELETION. Every candidate's (branch, sha) is
  // written here so a crash mid-reap leaves a complete restore path on main.
  writeLines(MANIFEST, candidates
    .slice()
    .sort((a, b) => (a.branch < b.branch ? -1 : a.branch > b.branch ? 1 : 0))
    .map((r) => JSON.stringify({
      branch: r.branch, sha: r.sha, pr_number: r.pr_number, pr_state: r.pr_state,
      tip_iso: r.tip_iso, restore: `git push ${REMOTE} ${r.sha}:refs/heads/${r.branch}`,
    })));

  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(`${CACHE_DIR}/census.json`, `${JSON.stringify(rows, null, 2)}\n`);

  const order: Bucket[] = ["PROTECTED", "OPEN_PR", "RECENT", "MERGED_PR", "CONTENT_HELD", "UNCHECKABLE", "CLOSED_PR", "NO_PR"];
  console.log(`# Branch census — ${REPO} @ ${new Date().toISOString()}`);
  console.log("");
  console.log(`Total remote branches: ${rows.length + 1} (incl. ${defaultBranch})`);
  console.log(`Safety window: ${windowDays} days`);
  console.log(`Deletion-protected ruleset patterns: ${prot.patterns.join(", ") || "(none)"}`);
  console.log("");
  console.log("| bucket | count | disposition |");
  console.log("| --- | --- | --- |");
  const disp: Record<Bucket, string> = {
    PROTECTED: "NEVER — ruleset forbids deletion",
    OPEN_PR: "NEVER — open PR head or base",
    RECENT: "skip this pass — inside safety window",
    MERGED_PR: "REAP — merged PR, content on main",
    CONTENT_HELD: "report — merged PR but adds content absent from main",
    CLOSED_PR: "report — closed unmerged, may hold wanted work",
    NO_PR: "report — no PR, may be live work",
    UNCHECKABLE: "NEVER — content gate could not run (fail closed)",
  };
  for (const b of order) console.log(`| ${b} | ${by(b).length} | ${disp[b]} |`);
  console.log("");
  // VACUITY CONTROL. CONTENT_HELD == 0 across thousands of branches is exactly
  // what a broken gate looks like, so state whether the gate ever discriminated.
  // If it never fired, the census says so instead of quietly implying safety.
  const gateFired = by("CONTENT_HELD").length + by("UNCHECKABLE").length;
  console.log(`Content-gate discrimination: ${by("CONTENT_HELD").length} held, ` +
    `${by("UNCHECKABLE").length} uncheckable, ${by("MERGED_PR").length} passed` +
    (gateFired === 0 ? "  <-- WARNING: gate never fired; treat as unproven" : ""));
  console.log("");
  console.log(`Manifest (restore path for every reap candidate): ${MANIFEST} — ${candidates.length} entries`);
  console.log("");
  console.log(`## Namespace shape of reap candidates`);
  const ns = new Map<string, number>();
  for (const r of candidates) {
    const k = r.branch.includes("/") ? `${r.branch.split("/")[0]}/` : "(top-level)";
    ns.set(k, (ns.get(k) ?? 0) + 1);
  }
  for (const [k, v] of [...ns.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`- ${k} ${v}`);
  }
  return 0;
}

function reap(batch: number, confirmed: boolean): number {
  const planned = readJsonl<{ branch: string; sha: string; pr_number: number | null }>(MANIFEST);
  if (planned.length === 0) {
    process.stderr.write(`FATAL: ${MANIFEST} is empty or missing. Run census first, and land it on main.\n`);
    return 1;
  }
  // RESUMABILITY: the executed log is the resume cursor. A run killed by a kernel
  // panic mid-batch restarts here and skips what it already did, rather than
  // re-deleting (harmless) or restarting the whole sweep (slow, rate-limited).
  const done = new Set(readJsonl<{ branch: string }>(EXECUTED).map((r) => r.branch));
  const todo = planned.filter((r) => !done.has(r.branch)).slice(0, batch);
  console.log(`planned=${planned.length} already-deleted=${done.size} this-batch=${todo.length}`);
  if (todo.length === 0) return 0;
  if (!confirmed) {
    console.log("dry run — re-run with --yes to delete. First 10:");
    for (const r of todo.slice(0, 10)) console.log(`  ${r.sha.slice(0, 12)}  ${r.branch}`);
    return 0;
  }

  // Small chunks with a pause between them: GitHub applies SECONDARY rate limits
  // to mutations, and a 3,000-ref sweep pushed flat out will trip them. Chunking
  // also bounds the blast radius of one bad ref aborting a push.
  const CHUNK = 25;
  const nowIso = new Date().toISOString();
  let deleted = 0;
  const appended: string[] = [];
  for (let i = 0; i < todo.length; i += CHUNK) {
    const slice = todo.slice(i, i + CHUNK);
    const res = gitRun(["push", REMOTE, "--delete", ...slice.map((r) => r.branch)]);
    const markers = (res.combined.match(/\[deleted\]/g) ?? []).length;
    deleted += markers;
    if (res.status !== 0) {
      process.stderr.write(`chunk ${i / CHUNK} returned ${res.status}:\n${res.combined}\n`);
    }
    for (const r of slice) {
      appended.push(JSON.stringify({ ...r, deleted_at: nowIso, restore: `git push ${REMOTE} ${r.sha}:refs/heads/${r.branch}` }));
    }
    // Flush the executed log after EVERY chunk, not at the end: a crash between
    // chunks must not lose the cursor. This machine kernel-panicked four times
    // on 2026-08-24, which is why this is a per-chunk write and not a final one.
    mkdirSync(dirname(EXECUTED), { recursive: true });
    let prior: string;
    try {
      prior = readFileSync(EXECUTED, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      prior = "";
    }
    writeFileSync(EXECUTED, `${prior}${appended.slice(-slice.length).join("\n")}\n`);
    if (i + CHUNK < todo.length) Bun.sleepSync(2000);
  }
  console.log(`deleted ${deleted}/${todo.length} refs; cursor at ${EXECUTED}`);
  return 0;
}

function restore(branch: string): number {
  const all = [...readJsonl<{ branch: string; sha: string }>(EXECUTED), ...readJsonl<{ branch: string; sha: string }>(MANIFEST)];
  const row = all.find((r) => r.branch === branch);
  if (row === undefined) {
    process.stderr.write(`no manifest entry for ${branch}\n`);
    return 1;
  }
  const res = gitRun(["push", REMOTE, `${row.sha}:refs/heads/${row.branch}`]);
  console.log(res.combined.trim());
  if (res.status !== 0) return 1;
  console.log(`restored ${branch} -> ${row.sha}`);
  return 0;
}

/** A recovery procedure nobody has executed is not a recovery procedure. This
 *  checks that every manifest SHA is still a resolvable object locally, i.e.
 *  that the restore command would actually have something to push. */
function verify(): number {
  const rows = readJsonl<{ branch: string; sha: string }>(MANIFEST);
  let bad = 0;
  for (const r of rows) {
    const ok = spawnSync("git", ["cat-file", "-e", `${r.sha}^{commit}`], { encoding: "utf8" }).status === 0;
    if (!ok) { console.log(`UNRESOLVABLE ${r.sha} ${r.branch}`); bad += 1; }
  }
  console.log(`verify: ${rows.length - bad}/${rows.length} manifest SHAs resolvable locally`);
  return bad === 0 ? 0 : 1;
}

function main(): number {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  const num = (flag: string, dflt: number): number => {
    const i = argv.indexOf(flag);
    return i === -1 ? dflt : Number(argv[i + 1]);
  };
  switch (cmd) {
    case "census": return census(num("--window-days", DEFAULT_WINDOW_DAYS));
    case "reap": return reap(num("--batch", 50), argv.includes("--yes"));
    case "restore": return argv[1] === undefined ? 1 : restore(argv[1]);
    case "verify": return verify();
    default:
      process.stderr.write("usage: branch-reaper.ts census|reap|restore <branch>|verify\n");
      return 1;
  }
}

if (import.meta.main) process.exit(main());
