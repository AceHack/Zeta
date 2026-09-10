#!/usr/bin/env bun
// triage-orphan-branches.ts — classify a namespace's orphan branches as
// safe-to-prune / archive-drain / unlanded-content, the preserve-FIRST way, and
// sweep the safe ones as ONE preserve-then-delete transaction.
//
// WHY: the post-reboot (2026-06-30) branch-prune triage proved that "merged-PR"
// alone is NOT a safe prune gate — squash-merges fool ancestry, and bot branches
// (pr-archive) have no PR yet hold real content.
//
// FOUR DEFECTS MEASURED 2026-09-09, AND WHAT REPLACED EACH
// ═══════════════════════════════════════════════════════════════════════════
//
// (1) IT NEVER ASKED WHETHER A PR WAS OPEN. The gate was content-only, so a
//     branch that is the head of a LIVE pull request classified SAFE and
//     `--prune` would have deleted the PR's head ref out from under it. At
//     measurement time the SAFE set held `agent/face-lattice-flake-…` (PR
//     #17184) and `agent/unrun-flake-eval-checks-…` (PR #17187), both OPEN at
//     that instant. Both have since merged, so this was a near-miss and not
//     damage — but nothing in the tool stopped it happening again.
//     NOW: `OPEN_PR` is the FIRST bucket and it is terminal. PR state is read
//     over REST (`gh api repos/{owner}/{repo}/pulls?state=open`), never over
//     `gh pr list` — see the transport note below. The query FAILING is not
//     "no open PRs"; it refuses the whole run (fail closed).
//
// (2) COMPARING BASENAMES IS NOT COMPARING CONTENT. The old gate asked "does
//     main contain a file with this basename?", so any branch whose new files
//     collided on a common generated name read as landed.
//     `claim/task-compiled-capture-five-publication-20260907` classified SAFE
//     while carrying 2,566 files and 23,286 insertions absent from main,
//     because its generated custody logs shared basenames with unrelated files.
//     NOW: containment is decided on the git BLOB OID — the content hash — so
//     two files match only when their bytes match. Basename comparison is gone
//     and a guard test refuses its return.
//
// (3) ANCESTRY CANNOT BE THE CONTAINMENT TEST IN A SQUASH-MERGE REPO, and the
//     2026-09-09 sweep worked around that by hand-running four positive tests,
//     one per row, instead of having a predicate at all. `git merge-base
//     --is-ancestor origin/<branch> origin/main` is FALSE for essentially every
//     landed branch here: a squash merge writes a NEW commit onto main whose
//     parent is main, so the branch's own commits never become ancestors of it.
//     Measured 2026-08-24: `git branch -r --merged origin/main` reported 6 of
//     3,627. That number is an artifact of the merge strategy, not a backlog.
//     NOW: two SOUND containment proofs, either of which suffices —
//       * PATCH-ID EQUIVALENCE (`git cherry origin/main origin/<branch>`): git
//         compares patch ids, not commit ids, so a commit that landed by
//         cherry-pick or rebase is recognised. Prefix `-` = already in main.
//         It is sound but INCOMPLETE for squashes: N commits collapsed into one
//         produce one new patch id that matches none of the N. Incompleteness
//         here costs a false UNLANDED, which errs toward keeping.
//       * BLOB PRESENCE: every non-ephemeral file the branch adds or modifies
//         has its exact content (blob OID) present somewhere in main's tree.
//         This is what survives a squash, because a squash preserves the bytes
//         even though it destroys the commits.
//     Either proof ⇒ contained. Neither ⇒ not contained. A probe that ERRORS ⇒
//     `UNCHECKABLE`, never SAFE.
//
// (4) PRESERVATION RAN AND DELETION DID NOT, AND NOTHING REPORTED THE GAP. The
//     2026-09-03 sweep pushed archive tags for its branches and then never
//     deleted the branches. Two halves, one ran, and the run reported success —
//     this repository's canonical failure class, a check that did not run
//     looking like one that passed.
//     NOW: preservation and deletion are ONE transaction per branch with an
//     explicit furthest-step-reached record. A branch that was tagged and not
//     deleted is a PARTIAL, partials are printed under their own loud heading,
//     and the process exits 3. Sweeping "successfully" while leaving a partial
//     behind is no longer expressible. Additionally `--audit-archive-tags`
//     reports every archive tag whose branch still exists on the remote, which
//     is exactly the residue the 2026-09-03 sweep left; it also exits 3.
//
// TRANSPORT: REST, NEVER `gh pr list`. `gh pr list` / `gh pr view` are GraphQL,
// and GraphQL is the one of the two 5000/hour budgets this fleet actually
// exhausts (measured: REST 33/5000 while GraphQL hit 0/5000 twice in one hour).
// A committed, repeated, unattended call belongs on REST.
// See .claude/rules/rest-is-the-default-transport-graphql-is-the-contested-budget.md
//
// Usage:
//   bun src/Core.TypeScript/hygiene/triage-orphan-branches.ts <namespace> [--prune] [--limit N] [--remote origin] [--repo owner/name]
//     <namespace>  branch prefix to triage (e.g. "lior", "shard/", "feat")
//     (no --prune) REPORT ONLY (dry run) — classify and print, delete nothing
//     --prune      sweep the SAFE branches: tag, VERIFY the tag on the remote,
//                  then delete. Any branch that stops between those steps is a
//                  PARTIAL and the run exits 3.
//     --limit N    classify at most N branches (for testing)
//   bun ... triage-orphan-branches.ts --audit-archive-tags [--remote origin]
//     Report archive tags whose branch still exists — the defect-4 residue.
//
// Exit 0 = ran clean. Exit 1 = fatal invocation/environment error.
// Exit 3 = FINDING: a partial sweep, or an archive tag whose branch still lives.

import { spawnSync } from "node:child_process";

import { stripRemotePrefix } from "../git/ref-prefix.ts";

const REMOTE_DEFAULT = "origin";
const REPO_DEFAULT = "Lucent-Financial-Group/Zeta";

/** Refs no sweep may ever touch, whatever the content gate says. Preservation
 *  namespaces and telemetry lanes live here; deleting one destroys the only
 *  copy of a record or the liveness trail that would report the destruction. */
export const NEVER_SWEEP_PREFIXES: readonly string[] = [
  "heartbeat/",
  "liveness/",
  "archive/",
  "preserve/",
];

/** Regenerable / ephemeral paths whose absence from main is NOT lost work. */
export const EPHEMERAL: readonly string[] = [
  "docs/hygiene-history/",
  "docs/pr-discussions/",
];

export type Klass =
  | "OPEN_PR"      // head or base of an open PR — NEVER prunable
  | "PROTECTED"    // a never-sweep namespace — NEVER prunable
  | "SAFE"         // content proven contained in main — prunable
  | "ARCHIVE"      // only unlanded pr-review archives — drain, don't discard
  | "UNLANDED"     // durable content absent from main — preserve before prune
  | "UNCHECKABLE"; // a containment probe could not RUN — fail closed

export interface Triage {
  readonly branch: string;
  readonly klass: Klass;
  readonly absent: readonly string[];
  readonly sha: string;
  /** Which proof established containment, for the report. */
  readonly proof: "patch-id" | "blob-presence" | "none";
  /** Set when klass is OPEN_PR, so the report names the PR that saved the ref. */
  readonly openPr: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFECT 1 — open-PR state, over REST
// ─────────────────────────────────────────────────────────────────────────────

export interface OpenPr {
  readonly number: number;
  readonly head: string;
  readonly base: string;
}

export interface OpenPrIndex {
  /** Branch name → PR number, for branches that are an open PR's HEAD. */
  readonly heads: ReadonlyMap<string, number>;
  /** Branch names that are an open PR's BASE — deleting one breaks the PR. */
  readonly bases: ReadonlyMap<string, number>;
}

/**
 * Index open pull requests by head and by base.
 *
 * BOTH SIDES MATTER. A stacked PR's base is somebody else's feature branch, and
 * deleting it retargets or breaks the PR just as surely as deleting its head.
 * The lowest PR number wins a collision only for reporting; membership is what
 * the gate reads, so the choice cannot change a verdict.
 *
 * Pure: no clock, no network. The same pull list replays to the same index.
 */
export function indexOpenPrs(pulls: readonly OpenPr[]): OpenPrIndex {
  const heads = new Map<string, number>();
  const bases = new Map<string, number>();
  for (const pr of pulls) {
    const prior = heads.get(pr.head);
    if (prior === undefined || pr.number < prior) heads.set(pr.head, pr.number);
    const priorBase = bases.get(pr.base);
    if (priorBase === undefined || pr.number < priorBase) bases.set(pr.base, pr.number);
  }
  return { heads, bases };
}

/** The PR number holding this branch open, or null. Head first, then base. */
export function openPrFor(branch: string, index: OpenPrIndex): number | null {
  return index.heads.get(branch) ?? index.bases.get(branch) ?? null;
}

/**
 * Parse the TSV the REST query is asked for: `number \t head.ref \t base.ref`.
 *
 * A malformed row is REFUSED rather than skipped. Skipping would mean a branch
 * silently loses its open-PR protection because a line did not parse — the
 * exact shape of failure this whole file exists to remove.
 */
export function parseOpenPrTsv(
  stdout: string,
): { readonly ok: readonly OpenPr[] } | { readonly error: string } {
  const out: OpenPr[] = [];
  for (const line of stdout.split("\n")) {
    if (line.trim().length === 0) continue;
    const parts = line.split("\t");
    if (parts.length !== 3) {
      return { error: `open-PR row has ${String(parts.length)} field(s), expected 3: ${JSON.stringify(line)}` };
    }
    const [numRaw, head, base] = parts as [string, string, string];
    const number = Number.parseInt(numRaw, 10);
    if (!Number.isSafeInteger(number) || number <= 0) {
      return { error: `open-PR row has an unreadable PR number: ${JSON.stringify(line)}` };
    }
    out.push({ number, head, base });
  }
  return { ok: out };
}

/**
 * Every open PR's head and base, over REST.
 *
 * ONE paginated REST call for the whole repository, not one call per branch:
 * `--paginate` walks the Link headers at 100 rows a page, which is the
 * rate-limit-friendly shape. `gh pr list` would answer the same question over
 * GraphQL, which is the contested budget — so it is refused here and by a guard
 * test, not merely discouraged in a comment.
 */
export function fetchOpenPrs(repo: string): { readonly ok: readonly OpenPr[] } | { readonly error: string } {
  const r = spawnSync(
    "gh",
    [
      "api",
      "--paginate",
      `repos/${repo}/pulls?state=open&per_page=100`,
      "--jq",
      ".[] | [.number, .head.ref, .base.ref] | @tsv",
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (r.error) return { error: `gh api failed to launch: ${r.error.message}` };
  if ((r.status ?? 1) !== 0) return { error: `gh api repos/${repo}/pulls failed: ${(r.stderr ?? "").trim()}` };
  return parseOpenPrTsv(r.stdout ?? "");
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFECTS 2 + 3 — containment by CONTENT, never by name, never by ancestry
// ─────────────────────────────────────────────────────────────────────────────

export interface BlobEntry {
  readonly path: string;
  /** The git blob OID: a hash of the file's exact bytes. */
  readonly oid: string;
}

/** Parse `git ls-tree -r <ref>` (`<mode> <type> <oid>\t<path>`). Non-blobs are skipped. */
export function parseLsTree(stdout: string): readonly BlobEntry[] {
  const out: BlobEntry[] = [];
  for (const line of stdout.split("\n")) {
    const tab = line.indexOf("\t");
    if (tab === -1) continue;
    const meta = line.slice(0, tab).split(/\s+/);
    const [, type, oid] = meta;
    if (type !== "blob" || oid === undefined || oid.length === 0) continue;
    out.push({ path: line.slice(tab + 1), oid });
  }
  return out;
}

export function isEphemeral(path: string): boolean {
  return EPHEMERAL.some((p) => path.startsWith(p));
}

/**
 * The set of blob OIDs present anywhere in main's tree.
 *
 * OID, NOT BASENAME — this is defect 2's fix and the reason the index is a set
 * of content hashes. Membership means "main holds a file with exactly these
 * bytes", which is the only claim that licenses deleting the branch that
 * introduced them. Same content at a different path still counts: a landed file
 * that was subsequently moved has not become unlanded.
 */
export function mainContentIndex(entries: readonly BlobEntry[]): ReadonlySet<string> {
  return new Set(entries.map((e) => e.oid));
}

/**
 * Files the branch introduces whose exact content is NOT in main.
 *
 * Empty ⇒ blob-presence containment holds.
 */
export function absentByContent(
  branchAdds: readonly BlobEntry[],
  mainOids: ReadonlySet<string>,
): readonly string[] {
  const absent: string[] = [];
  for (const e of branchAdds) {
    if (isEphemeral(e.path)) continue;
    if (!mainOids.has(e.oid)) absent.push(e.path);
  }
  return absent;
}

export interface CherryVerdict {
  /** Commits whose patch id is ALREADY in main (git prints these with `-`). */
  readonly landed: number;
  /** Commits whose patch id is not in main (`+`). Empty ⇒ patch-id containment. */
  readonly unlanded: readonly string[];
}

/**
 * Parse `git cherry <upstream> <head>`: `- <sha>` landed, `+ <sha>` not.
 *
 * WHY THIS AND NOT `git merge-base --is-ancestor`. Ancestry asks whether the
 * branch's COMMITS are reachable from main, and a squash merge guarantees they
 * are not — it writes one new commit whose parent is main and whose content is
 * the branch's. `git cherry` compares PATCH IDS instead of commit ids, so it
 * still recognises work that landed by cherry-pick or rebase. It does not
 * recognise a squash of more than one commit, which is why it is one of two
 * proofs rather than the only one.
 */
export function parseCherry(stdout: string): CherryVerdict {
  let landed = 0;
  const unlanded: string[] = [];
  for (const line of stdout.split("\n")) {
    const t = line.trim();
    if (t.startsWith("- ")) landed += 1;
    else if (t.startsWith("+ ")) unlanded.push(t.slice(2).trim());
  }
  return { landed, unlanded };
}

/** A containment probe's result: it either ran and answered, or it could not run. */
export type Probe<T> = { readonly ran: true; readonly value: T } | { readonly ran: false; readonly why: string };

export interface ContainmentInput {
  readonly branch: string;
  readonly sha: string;
  /** `git cherry` result, or the reason it could not run. */
  readonly cherry: Probe<CherryVerdict>;
  /** Blobs the branch adds/modifies vs main, or the reason the diff could not run. */
  readonly branchAdds: Probe<readonly BlobEntry[]>;
  readonly mainOids: ReadonlySet<string>;
  readonly openPr: number | null;
  readonly protectedRef: boolean;
}

/**
 * The containment predicate, and the ONLY place a branch may be called SAFE.
 *
 * Order is load-bearing: the two never-prune buckets come first and are
 * terminal, so no amount of content evidence can talk the gate into deleting a
 * live PR's head ref or a preservation namespace.
 *
 * FAIL CLOSED. If BOTH probes failed to run the answer is `UNCHECKABLE`, never
 * SAFE. A gate that cannot run must refuse: an errored diff that returns an
 * empty absent-list reads exactly like a branch with nothing absent, and that
 * substitution deleted nothing here only by luck on 2026-08-24, when a shallow
 * clone made every one of 3,629 branches read as safe.
 *
 * Pure: every input is passed in, so a verdict replays deterministically.
 */
export function classifyContainment(input: ContainmentInput): Triage {
  const base = { branch: input.branch, sha: input.sha } as const;
  if (input.protectedRef) {
    return { ...base, klass: "PROTECTED", absent: [], proof: "none", openPr: null };
  }
  if (input.openPr !== null) {
    return { ...base, klass: "OPEN_PR", absent: [], proof: "none", openPr: input.openPr };
  }

  // Proof A — patch-id equivalence. Sound; incomplete for multi-commit squashes.
  if (input.cherry.ran && input.cherry.value.unlanded.length === 0 && input.cherry.value.landed > 0) {
    return { ...base, klass: "SAFE", absent: [], proof: "patch-id", openPr: null };
  }

  // Proof B — blob presence. Survives a squash, because a squash keeps the bytes.
  if (input.branchAdds.ran) {
    const absent = absentByContent(input.branchAdds.value, input.mainOids);
    if (absent.length === 0) {
      return { ...base, klass: "SAFE", absent: [], proof: "blob-presence", openPr: null };
    }
    const allArchive = absent.every((f) => f.startsWith("docs/history/pr-reviews/"));
    return {
      ...base,
      klass: allArchive ? "ARCHIVE" : "UNLANDED",
      absent,
      proof: "none",
      openPr: null,
    };
  }

  // Neither proof could run.
  const why = input.cherry.ran ? "" : `${input.cherry.why}; `;
  return {
    ...base,
    klass: "UNCHECKABLE",
    absent: [`${why}${input.branchAdds.ran ? "" : input.branchAdds.why}`],
    proof: "none",
    openPr: null,
  };
}

export function isProtectedRef(branch: string): boolean {
  return branch === "main" || NEVER_SWEEP_PREFIXES.some((p) => branch.startsWith(p));
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFECT 4 — preserve and delete are ONE transaction, and a partial is loud
// ─────────────────────────────────────────────────────────────────────────────

/** The furthest step a branch's sweep reached. Ordered; each implies the prior. */
export type SweepStep = "none" | "tagged" | "tag-verified" | "deleted";

export interface SweepOutcome {
  readonly branch: string;
  readonly sha: string;
  readonly tag: string;
  readonly reached: SweepStep;
  readonly error: string | null;
}

export interface SweepSummary {
  /** Tagged, tag verified on the remote, branch deleted. */
  readonly complete: readonly SweepOutcome[];
  /**
   * PRESERVED BUT NOT DELETED — the 2026-09-03 residue. A tag exists and the
   * branch it names is still there, which is the state that accumulated 49 tags
   * nobody reconciled and that no check reported.
   */
  readonly partial: readonly SweepOutcome[];
  /** Never got as far as a tag. Nothing was changed for these. */
  readonly untouched: readonly SweepOutcome[];
  /** 3 when any partial exists — a finding, not a clean run. */
  readonly exitCode: 0 | 3;
}

/**
 * Fold per-branch outcomes into the sweep's verdict.
 *
 * THE ONLY WAY TO REPORT A CLEAN SWEEP IS FOR EVERY BRANCH TO HAVE REACHED
 * `deleted` OR NOT HAVE BEEN TOUCHED AT ALL. "Tagged" is not a success state —
 * it is half of one, and calling it success is precisely what happened on
 * 2026-09-03. The exit code, not the prose, is what a workflow reads, so the
 * partial set drives it directly.
 *
 * Pure: a fold over outcomes, so the verdict is testable without a remote.
 */
export function summarizeSweep(outcomes: readonly SweepOutcome[]): SweepSummary {
  const complete = outcomes.filter((o) => o.reached === "deleted");
  const partial = outcomes.filter((o) => o.reached === "tagged" || o.reached === "tag-verified");
  const untouched = outcomes.filter((o) => o.reached === "none");
  return { complete, partial, untouched, exitCode: partial.length > 0 ? 3 : 0 };
}

/** Render the partial set loudly. Empty string when there is nothing to say. */
export function renderPartials(summary: SweepSummary): string {
  if (summary.partial.length === 0) return "";
  const lines = [
    "## PARTIAL SWEEP — PRESERVED BUT NOT DELETED",
    "",
    `${String(summary.partial.length)} branch(es) were tagged and then NOT deleted. This is the`,
    "2026-09-03 failure exactly: preservation ran, deletion did not, and the run",
    "would otherwise have reported success. Each tag below names a branch that is",
    "still on the remote. Re-run the sweep, or delete these refs by hand:",
    "",
  ];
  for (const o of summary.partial) {
    lines.push(`  ${o.sha.slice(0, 12)}  ${o.branch}`);
    lines.push(`      tag reached: ${o.reached}${o.error === null ? "" : ` — ${o.error}`}`);
  }
  return lines.join("\n");
}

export interface OrphanedTag {
  readonly tag: string;
  readonly branch: string;
}

/**
 * Archive tags whose branch STILL EXISTS on the remote.
 *
 * This is the check that was missing on 2026-09-03 and that would have named
 * the residue the same day. A tag under `archive/<date>-<event>/<branch>` is a
 * claim that `<branch>` was preserved *because it was about to go*; the branch
 * still being there means the second half never ran.
 *
 * Pure, and both inputs are plain ref-name lists, so it is testable with no
 * remote and replays deterministically.
 */
export function orphanedArchiveTags(
  tags: readonly string[],
  heads: readonly string[],
): readonly OrphanedTag[] {
  const live = new Set(heads);
  const out: OrphanedTag[] = [];
  for (const tag of tags) {
    const branch = archiveTagBranch(tag);
    if (branch === null) continue;
    if (live.has(branch)) out.push({ tag, branch });
  }
  return out;
}

/**
 * The branch name an `archive/<date>-<event>/<branch>` tag preserves, or null.
 *
 * The branch name itself contains slashes (`claim/task-…`), so only the first
 * TWO components are the tag's own namespace and everything after is the ref.
 */
export function archiveTagBranch(tag: string): string | null {
  const parts = tag.split("/");
  if (parts.length < 3) return null;
  if (parts[0] !== "archive") return null;
  const event = parts[1] ?? "";
  if (!/^\d{4}-\d{2}-\d{2}/.test(event)) return null;
  return parts.slice(2).join("/");
}

/** Tag name a sweep gives a branch. Matches the namespace already in use. */
export function sweepTagFor(branch: string, isoDate: string): string {
  return `archive/${isoDate}-branch-sweep/${branch}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// IO shell
// ─────────────────────────────────────────────────────────────────────────────

interface Run {
  readonly status: number;
  readonly stdout: string;
  readonly combined: string;
}

function run(cmd: string, args: readonly string[]): Run {
  const r = spawnSync(cmd, [...args], { encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
  return {
    status: r.status ?? -1,
    stdout: r.stdout ?? "",
    combined: `${r.stdout ?? ""}${r.stderr ?? ""}`,
  };
}

function git(args: readonly string[]): Run {
  return run("git", args);
}

function gitOrDie(args: readonly string[]): string {
  const r = git(args);
  if (r.status !== 0) {
    process.stderr.write(`git ${args.join(" ")} failed:\n${r.combined}\n`);
    process.exit(1);
  }
  return r.stdout.trim();
}

function probeCherry(remote: string, branch: string): Probe<CherryVerdict> {
  const r = git(["cherry", `${remote}/main`, `${remote}/${branch}`]);
  if (r.status !== 0) return { ran: false, why: `git cherry failed: ${r.combined.trim().split("\n")[0] ?? ""}` };
  return { ran: true, value: parseCherry(r.stdout) };
}

/**
 * The blobs a branch adds or modifies relative to its merge base with main.
 *
 * `--raw` is what carries the OIDs; `--name-only` (the old spelling) carries
 * only paths, which is how the basename gate came to exist in the first place.
 */
function probeBranchAdds(remote: string, branch: string): Probe<readonly BlobEntry[]> {
  const r = git(["diff", "--raw", "--diff-filter=AM", `${remote}/main...${remote}/${branch}`]);
  if (r.status !== 0) return { ran: false, why: `git diff failed: ${r.combined.trim().split("\n")[0] ?? ""}` };
  const out: BlobEntry[] = [];
  for (const line of r.stdout.split("\n")) {
    // `:<srcmode> <dstmode> <srcoid> <dstoid> <status>\t<path>`
    const tab = line.indexOf("\t");
    if (tab === -1 || !line.startsWith(":")) continue;
    const fields = line.slice(1, tab).split(/\s+/);
    const dstOid = fields[3];
    if (dstOid === undefined || /^0+$/.test(dstOid)) continue;
    out.push({ path: line.slice(tab + 1), oid: dstOid });
  }
  return { ran: true, value: out };
}

/** Push the tag, then CHECK IT IS THERE, then delete. One branch, one transaction. */
function sweepOne(remote: string, t: Triage, isoDate: string): SweepOutcome {
  const tag = sweepTagFor(t.branch, isoDate);
  const base = { branch: t.branch, sha: t.sha, tag } as const;

  const tagged = git(["push", remote, `${t.sha}:refs/tags/${tag}`]);
  if (tagged.status !== 0 && !/already exists/i.test(tagged.combined)) {
    return { ...base, reached: "none", error: `tag push failed: ${tagged.combined.trim().split("\n")[0] ?? ""}` };
  }

  // VERIFY, do not assume. `git push` reporting zero is not the tag existing —
  // that is the same substitution of a proxy for the fact that this file's four
  // defects are all instances of.
  const check = git(["ls-remote", "--tags", remote, `refs/tags/${tag}`]);
  if (check.status !== 0 || check.stdout.trim().length === 0) {
    return { ...base, reached: "tagged", error: "tag not present on the remote after push" };
  }

  const deleted = git(["push", remote, "--delete", t.branch]);
  if (deleted.status !== 0) {
    return {
      ...base,
      reached: "tag-verified",
      error: `branch delete failed: ${deleted.combined.trim().split("\n")[0] ?? ""}`,
    };
  }
  return { ...base, reached: "deleted", error: null };
}

function auditArchiveTags(remote: string): number {
  const tagsOut = git(["ls-remote", "--tags", remote, "refs/tags/archive/*"]);
  if (tagsOut.status !== 0) {
    process.stderr.write(`git ls-remote --tags failed:\n${tagsOut.combined}\n`);
    return 1;
  }
  const headsOut = git(["ls-remote", "--heads", remote]);
  if (headsOut.status !== 0) {
    process.stderr.write(`git ls-remote --heads failed:\n${headsOut.combined}\n`);
    return 1;
  }
  const tags = tagsOut.stdout
    .split("\n")
    .map((l) => l.split("\t")[1] ?? "")
    .filter((r) => r.startsWith("refs/tags/") && !r.endsWith("^{}"))
    .map((r) => r.slice("refs/tags/".length));
  const heads = headsOut.stdout
    .split("\n")
    .map((l) => l.split("\t")[1] ?? "")
    .filter((r) => r.startsWith("refs/heads/"))
    .map((r) => r.slice("refs/heads/".length));

  // LIVENESS: zero tags means the lookup is broken, not that the lane is clean.
  if (tags.length === 0) {
    process.stderr.write(
      "audit-archive-tags: the remote reports NO archive tags at all. That is a broken " +
        "lookup, not a clean lane — refusing to report a verdict.\n",
    );
    return 1;
  }

  const orphans = orphanedArchiveTags(tags, heads);
  console.log(`# Archive-tag reconciliation — ${remote}`);
  console.log("");
  console.log(`archive tags: ${String(tags.length)}   live branches: ${String(heads.length)}`);
  console.log("");
  if (orphans.length === 0) {
    console.log("OK — every archive tag's branch is gone, so preservation and deletion both ran.");
    return 0;
  }
  console.log(`## FINDING — ${String(orphans.length)} archive tag(s) whose branch STILL EXISTS`);
  console.log("");
  console.log("Preservation ran and deletion did not. This is the 2026-09-03 residue class.");
  console.log("");
  for (const o of orphans) console.log(`  ${o.branch}\n      tagged as ${o.tag}`);
  return 3;
}

/** Flags that consume the NEXT argv entry as their value. */
const VALUED_FLAGS: readonly string[] = ["--remote", "--repo", "--limit"];

/**
 * The first non-flag argument, skipping any entry consumed as a flag's value.
 *
 * Written as a scan rather than `argv.find(...)` with an `indexOf` lookback:
 * `indexOf` returns the FIRST occurrence, so `--remote origin origin` would
 * have found no namespace at all while `foo --limit foo` would have taken the
 * limit's value as the namespace. A scan knows where it is.
 */
export function positionalArg(argv: readonly string[]): string | undefined {
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? "";
    if (VALUED_FLAGS.includes(a)) {
      i += 1;
      continue;
    }
    if (a.startsWith("--")) continue;
    return a;
  }
  return undefined;
}

function main(): number {
  const argv = process.argv.slice(2);
  const flagValue = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i === -1 ? undefined : argv[i + 1];
  };
  const remote = flagValue("--remote") ?? REMOTE_DEFAULT;

  if (argv.includes("--audit-archive-tags")) return auditArchiveTags(remote);

  const namespace = positionalArg(argv);
  if (namespace === undefined) {
    process.stderr.write(
      "usage: triage-orphan-branches.ts <namespace> [--prune] [--limit N] [--remote origin] [--repo owner/name]\n" +
        "       triage-orphan-branches.ts --audit-archive-tags [--remote origin]\n",
    );
    return 1;
  }
  const doPrune = argv.includes("--prune");
  const repo = flagValue("--repo") ?? process.env["ZETA_AGENT_REPO"] ?? REPO_DEFAULT;
  const limitRaw = flagValue("--limit");
  const limit = limitRaw === undefined ? Infinity : Number(limitRaw);

  git(["fetch", remote, "--prune", "-q"]);

  // A shallow clone has no merge base, so every containment probe errors and
  // every branch would read UNCHECKABLE. Refuse rather than emit a report whose
  // safety column is fiction.
  if (gitOrDie(["rev-parse", "--is-shallow-repository"]) === "true") {
    process.stderr.write(
      "FATAL: shallow clone. `git diff main...branch` has no merge base here, so the\n" +
        "containment gate cannot run. Run: git fetch --unshallow origin\n",
    );
    return 1;
  }

  // DEFECT 1 — PR state before anything else, and fail closed if it cannot be read.
  const pulls = fetchOpenPrs(repo);
  if ("error" in pulls) {
    process.stderr.write(
      `FATAL: could not read open pull requests: ${pulls.error}\n` +
        "Refusing to triage without knowing which branches are live PR heads. A failed\n" +
        "probe is `unknown`, never a negative result.\n",
    );
    return 1;
  }
  const prIndex = indexOpenPrs(pulls.ok);

  const branches = gitOrDie([
    "for-each-ref",
    "--format=%(refname:short)",
    `refs/remotes/${remote}/`,
  ])
    .split("\n")
    .map((b) => stripRemotePrefix(b, remote))
    .filter((b) => b.length > 0 && b !== "HEAD" && b.startsWith(namespace))
    .sort();
  const targets = Number.isFinite(limit) ? branches.slice(0, limit) : branches;

  const mainOids = mainContentIndex(parseLsTree(gitOrDie(["ls-tree", "-r", `${remote}/main`])));

  const results: Triage[] = targets.map((branch) => {
    const sha = git(["rev-parse", `${remote}/${branch}`]).stdout.trim().slice(0, 12);
    return classifyContainment({
      branch,
      sha,
      cherry: probeCherry(remote, branch),
      branchAdds: probeBranchAdds(remote, branch),
      mainOids,
      openPr: openPrFor(branch, prIndex),
      protectedRef: isProtectedRef(branch),
    });
  });

  const by = (k: Klass): Triage[] => results.filter((r) => r.klass === k);
  const safe = by("SAFE");

  console.log(`# Orphan-branch triage — namespace "${namespace}" (${remote})`);
  console.log("");
  console.log(`Branches in namespace: ${String(branches.length)}${targets.length < branches.length ? ` (classifying ${String(targets.length)})` : ""}`);
  console.log(`Open PRs read over REST: ${String(pulls.ok.length)}`);
  console.log("");
  console.log("## Classification");
  console.log(`- OPEN_PR (head or base of a live PR → NEVER prune): ${String(by("OPEN_PR").length)}`);
  console.log(`- PROTECTED (preservation/telemetry namespace → NEVER prune): ${String(by("PROTECTED").length)}`);
  console.log(`- SAFE (content proven contained in main → prunable): ${String(safe.length)}`);
  console.log(`- ARCHIVE (only unlanded pr-review archives → run consume-pr-archives.ts): ${String(by("ARCHIVE").length)}`);
  console.log(`- UNLANDED (durable content absent from main → PRESERVE before prune): ${String(by("UNLANDED").length)}`);
  console.log(`- UNCHECKABLE (a containment probe could not run → fail closed): ${String(by("UNCHECKABLE").length)}`);
  console.log("");

  for (const r of by("OPEN_PR")) console.log(`  OPEN_PR  ${r.branch}  (PR #${String(r.openPr ?? 0)})`);
  if (by("OPEN_PR").length > 0) console.log("");

  if (by("UNLANDED").length > 0) {
    console.log("## UNLANDED — preserve these first (do NOT prune)");
    for (const r of by("UNLANDED")) {
      console.log(`- ${r.branch}`);
      for (const f of r.absent.slice(0, 12)) console.log(`    ${f}`);
      if (r.absent.length > 12) console.log(`    … and ${String(r.absent.length - 12)} more`);
    }
    console.log("");
  }
  if (by("UNCHECKABLE").length > 0) {
    console.log("## UNCHECKABLE — the gate could not run; these are NOT safe");
    for (const r of by("UNCHECKABLE")) console.log(`- ${r.branch}: ${r.absent.join(" ")}`);
    console.log("");
  }
  if (by("ARCHIVE").length > 0) {
    console.log("## ARCHIVE — run: bun src/Core.TypeScript/forge-host/github/consume-pr-archives.ts --delete");
    console.log(`  (${String(by("ARCHIVE").length)} branches carry unlanded pr-review archives — drain, don't discard)`);
    console.log("");
  }

  // VACUITY CONTROL. SAFE == everything is what a broken gate looks like, so say
  // whether the gate ever discriminated instead of quietly implying safety.
  const discriminated = results.length - safe.length;
  console.log(
    `Gate discrimination: ${String(discriminated)} of ${String(results.length)} withheld` +
      (results.length > 0 && discriminated === 0 ? "  <-- WARNING: gate never fired; treat as unproven" : ""),
  );
  console.log("");

  if (!doPrune) {
    console.log(`## Dry run — re-run with --prune to sweep the ${String(safe.length)} SAFE branches.`);
    return 0;
  }
  if (safe.length === 0) {
    console.log("## Sweep: no SAFE branches.");
    return 0;
  }

  const isoDate = new Date().toISOString().slice(0, 10);
  console.log(`## Sweep — preserve-then-delete, ${String(safe.length)} branch(es)`);
  const outcomes = safe.map((t) => {
    const o = sweepOne(remote, t, isoDate);
    console.log(`  ${o.reached === "deleted" ? "swept " : "PARTIAL"} ${o.sha.slice(0, 12)}  ${o.branch}`);
    return o;
  });
  const summary = summarizeSweep(outcomes);
  console.log("");
  console.log(`complete: ${String(summary.complete.length)}   partial: ${String(summary.partial.length)}   untouched: ${String(summary.untouched.length)}`);
  const partials = renderPartials(summary);
  if (partials !== "") {
    console.log("");
    console.log(partials);
  }
  return summary.exitCode;
}

if (import.meta.main) {
  process.exit(main());
}
