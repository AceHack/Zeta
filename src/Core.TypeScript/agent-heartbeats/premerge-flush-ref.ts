#!/usr/bin/env bun
// src/Core.TypeScript/agent-heartbeats/premerge-flush-ref.ts
//
// Pre-merge `main` INTO a heartbeat lane's parked tip, locally, so the repository's
// `.gitattributes` merge drivers are honoured before GitHub ever sees the head.
//
// WHY THIS IS ITS OWN FILE AND NOT FOUR LINES OF INLINE SHELL.
// ------------------------------------------------------------
// It WAS four lines of inline shell, and those four lines silently stopped every agent
// heartbeat from reaching `main` for sixteen hours while all three lanes reported green.
// The shell read:
//
//     git fetch origin main --quiet
//     git merge --no-edit origin/main || PREMERGE_RC=$?
//     MERGED_SHA=$(git rev-parse HEAD)
//     git push --force-with-lease=... origin "HEAD:refs/heads/$SNAPSHOT_REF"
//
// The flush job checks out `main` (`ref: main`) and never leaves it. So `git merge
// origin/main` merged main into main — a fast-forward to `origin/main`, nothing else —
// and the push then wrote **`main` itself** over `heartbeat/<lane>-flush`, discarding the
// parked lane payload from that ref. `merge-heartbeats-to-main.ts` compared the two, found
// them identical, and returned rc=4 "main already contains this branch", which the step
// treats as an ordinary no-op and exits 0 on.
//
// Every part of the pipeline then reported success while landing nothing:
//
//     [flush] soraya: 4 heartbeat commits to flush
//     + e0daddeaf...dc15f463d HEAD -> heartbeat/soraya-flush (forced update)
//     [flush] soraya: pre-merged origin/main into heartbeat/soraya-flush
//     up-to-date: main already contains immutable heartbeat/soraya-flush
//     [flush] soraya: already on main — nothing to land (no-op)
//
// `dc15f463d` is a single-parent ordinary `main` commit, not a merge — which is the whole
// proof: a real pre-merge cannot produce a commit that does not have the lane as a parent.
// Measured on `origin` while writing this: `heartbeat/soraya-flush` and
// `heartbeat/alexa-flush` both pointed at exactly `origin/main`.
//
// The step was fatal on the codes it checked and simply never reached a failing one. That
// is the vacuity class: the step CREATED the condition that made its own no-op branch true.
//
// So the logic moves here, where a scratch-git test can run it against a working tree
// checked out on `main` — the exact condition the workflow supplies — and assert that the
// result still contains the lane. See `premerge-flush-ref.test.ts`; the old behaviour is
// reproduced there as an explicit control so the assertion is provably not vacuous.
//
// WHAT IT DELIBERATELY DOES NOT DO.
//   - It does not push. The snapshot ref is written by the workflow, which holds the
//     credential; this tool only computes the commit and leaves HEAD on it.
//   - It registers NO custom merge driver. `union` is built into git and is what the
//     wedging files (`docs/github/prs/manifest.jsonl`, `data/ci-runs.jsonl`,
//     `data/rs-blocks.jsonl`, `db/mutation-findings/*.jsonl`) declare. `merge=theirs` is
//     NOT built in, and registering it here would be actively wrong: in THIS direction
//     "theirs" is `main`, so the driver would resolve the lane's freshly written shards and
//     archive bodies to main's older copies — destroying the payload the flush exists to
//     carry (§5 memory preservation). An unregistered driver degrades to an ordinary
//     conflict, which is reported as a conflict and is honest.
//   - It never resolves a real content conflict. That is typed backpressure: the parked SHA
//     stays parked, the lane keeps accumulating, nothing is lost.

import { spawnSync } from "node:child_process";

/** What the pre-merge concluded. Every kind except `conflict` leaves HEAD on `mergedSha`. */
export type PremergeOutcome =
  /** The lane tip is already an ancestor of the base — there is nothing to flush at all. */
  | { readonly kind: "already-in-base"; readonly mergedSha: string }
  /** The lane already contained the base; no merge commit was needed. */
  | { readonly kind: "base-already-merged"; readonly mergedSha: string }
  /** A merge commit was created on top of the lane. */
  | { readonly kind: "premerged"; readonly mergedSha: string }
  /** A genuine content conflict the repository's own drivers could not resolve. */
  | { readonly kind: "conflict"; readonly detail: string };

export type PremergeResult =
  | { readonly ok: true; readonly value: PremergeOutcome }
  | { readonly ok: false; readonly error: string };

interface GitResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

const COMMIT_SHA_RE = /^[0-9a-f]{40}$/;
const REF_NAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9_-]|\.(?=[A-Za-z0-9_-])){0,62}$/;

function git(cwd: string, args: readonly string[]): GitResult {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", [...args], { cwd, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (result.error) {
    return { status: -1, stdout: "", stderr: result.error.message };
  }
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

function failed(operation: string, result: GitResult): PremergeResult {
  const detail = (result.stderr || result.stdout).trim();
  const suffix = detail === "" ? "" : `: ${detail}`;
  return { ok: false, error: `${operation} failed${suffix}` };
}

/**
 * `git merge-base --is-ancestor` as a three-valued answer.
 *
 * Exit 0 is "yes", exit 1 is "no", and ANYTHING ELSE is "the question was not answered" —
 * a bad revision, a corrupt object, git missing from PATH. Collapsing that third case into
 * "no" would turn an unanswerable question into a confident verdict, and collapsing it into
 * "yes" would let the containment assertion below pass without measuring anything. Both are
 * the failure this file exists to remove, so it is returned as `undefined` and the caller
 * refuses.
 */
function isAncestor(cwd: string, ancestor: string, descendant: string): boolean | undefined {
  const result = git(cwd, ["merge-base", "--is-ancestor", ancestor, descendant]);
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  return undefined;
}

/**
 * Reject anything that would let a caller-supplied string reach `git` as a revision or a ref.
 *
 * The lane SHA is required to be an explicit 40-hex commit id rather than a revision
 * expression: the whole point of the parked snapshot is that the flush operates on ONE exact
 * commit, and accepting `heartbeat/soraya` here would silently re-resolve to whatever the lane
 * has since advanced to.
 */
function validateInputs(laneSha: string, base: string, remote: string): PremergeResult | undefined {
  if (!COMMIT_SHA_RE.test(laneSha)) {
    return { ok: false, error: `lane SHA must be 40 lowercase hex characters; got ${laneSha}` };
  }
  if (!REF_NAME_RE.test(base) || base.endsWith(".lock")) {
    return { ok: false, error: `base must be one safe branch component; got ${base}` };
  }
  if (!REF_NAME_RE.test(remote) || remote.endsWith(".lock")) {
    return { ok: false, error: `remote must be one safe name; got ${remote}` };
  }
  return undefined;
}

export interface PremergeOptions {
  /** The exact lane tip that was parked on the snapshot ref. 40 lowercase hex. */
  readonly laneSha: string;
  /** Base branch name, e.g. `main`. */
  readonly base?: string;
  /** Remote name, e.g. `origin`. */
  readonly remote?: string;
  readonly cwd?: string;
}

/**
 * Merge `<remote>/<base>` into `laneSha` and leave HEAD detached on the result.
 *
 * The FIRST operation is `checkout --detach <laneSha>`, and it is the entire fix: without it
 * the merge runs on whatever the job happened to check out, which in the flush job is `main`.
 * The containment assertion at the end is what makes the fix self-checking rather than
 * merely correct-today — it fails loudly on any future edit that reintroduces a merge
 * performed somewhere other than on the lane.
 */
export function premergeFlushRef(options: PremergeOptions): PremergeResult {
  const cwd = options.cwd ?? process.cwd();
  const base = options.base ?? "main";
  const remote = options.remote ?? "origin";
  const { laneSha } = options;

  const invalid = validateInputs(laneSha, base, remote);
  if (invalid !== undefined) return invalid;

  const laneObject = git(cwd, ["rev-parse", "--verify", "--quiet", `${laneSha}^{commit}`]);
  if (laneObject.status !== 0) return failed(`resolve lane commit ${laneSha}`, laneObject);

  const baseRef = `refs/remotes/${remote}/${base}`;
  const fetch = git(cwd, ["fetch", remote, `+refs/heads/${base}:${baseRef}`]);
  if (fetch.status !== 0) return failed(`fetch ${remote}/${base}`, fetch);

  const baseRev = git(cwd, ["rev-parse", "--verify", "--quiet", `${baseRef}^{commit}`]);
  if (baseRev.status !== 0) return failed(`resolve ${baseRef}`, baseRev);
  const baseSha = baseRev.stdout.trim();

  // Nothing to flush: the parked tip is already on the base. Returning BEFORE the checkout
  // matters — merging here would fast-forward HEAD to the base and the caller would then
  // push the base over the snapshot ref, which is precisely the defect being repaired.
  const laneLanded = isAncestor(cwd, laneSha, baseSha);
  if (laneLanded === undefined) return { ok: false, error: `could not compare ${laneSha} against ${baseRef}` };
  if (laneLanded) return { ok: true, value: { kind: "already-in-base", mergedSha: laneSha } };

  const checkout = git(cwd, ["checkout", "--quiet", "--detach", laneSha]);
  if (checkout.status !== 0) return failed(`check out lane tip ${laneSha}`, checkout);

  const baseLanded = isAncestor(cwd, baseSha, laneSha);
  if (baseLanded === undefined) return { ok: false, error: `could not compare ${baseRef} against ${laneSha}` };
  if (baseLanded) return { ok: true, value: { kind: "base-already-merged", mergedSha: laneSha } };

  const merge = git(cwd, ["merge", "--no-edit", baseSha]);
  if (merge.status !== 0) {
    const detail = (merge.stdout || merge.stderr).trim();
    git(cwd, ["merge", "--abort"]);
    // Restore the detached tip: `merge --abort` returns the tree, and this makes the
    // post-condition of a conflicting call identical to its pre-condition.
    git(cwd, ["checkout", "--quiet", "--detach", laneSha]);
    return { ok: true, value: { kind: "conflict", detail } };
  }

  const head = git(cwd, ["rev-parse", "HEAD"]);
  if (head.status !== 0) return failed("read merged HEAD", head);
  const mergedSha = head.stdout.trim();

  // THE FALSIFIER, AND THE REASON THIS FUNCTION EXISTS.
  //
  // A pre-merge result that does not CONTAIN the parked lane tip is not a pre-merge — it is
  // the base wearing the lane's ref name, and pushing it deletes the payload from the flush
  // ref while every downstream step reports success. The previous implementation produced
  // exactly that on every tick for sixteen hours. Assert containment of BOTH sides: the
  // lane, because that is the payload, and the base, because a head that does not contain
  // main is what GitHub refuses to fast-forward.
  const keepsLane = isAncestor(cwd, laneSha, mergedSha);
  const keepsBase = isAncestor(cwd, baseSha, mergedSha);
  if (keepsLane === undefined || keepsBase === undefined) {
    return { ok: false, error: `could not verify what ${mergedSha} contains` };
  }
  if (!keepsLane) {
    return {
      ok: false,
      error:
        `pre-merge produced ${mergedSha}, which does NOT contain the parked lane tip ${laneSha}. ` +
        `The merge did not happen on the lane. Pushing this would erase the lane's payload from the snapshot ref.`,
    };
  }
  if (!keepsBase) {
    return {
      ok: false,
      error: `pre-merge produced ${mergedSha}, which does NOT contain ${baseRef} (${baseSha}); GitHub could not fast-forward it.`,
    };
  }

  return { ok: true, value: { kind: "premerged", mergedSha } };
}

interface Args {
  readonly laneSha: string;
  readonly base: string;
  readonly remote: string;
}

export function parseArgs(argv: readonly string[]): { readonly ok: true; readonly args: Args } | { readonly ok: false } {
  let laneSha: string | undefined;
  let base = "main";
  let remote = "origin";
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (value === undefined) return { ok: false };
    if (flag === "--lane-sha") laneSha = value;
    else if (flag === "--base") base = value;
    else if (flag === "--remote") remote = value;
    else return { ok: false };
  }
  return laneSha === undefined ? { ok: false } : { ok: true, args: { laneSha, base, remote } };
}

/**
 * Exit codes, consumed by `.github/workflows/agent-heartbeat.yml`:
 *   0  pre-merge settled; `merged-sha=<sha>` is on stdout and HEAD is on it
 *   3  a genuine content conflict — NOT fatal to the flush; the parked SHA stays parked
 *   2  usage
 *   1  anything else, including the containment refusal above
 */
if (import.meta.main) {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error("usage: premerge-flush-ref.ts --lane-sha <40-hex> [--base main] [--remote origin]");
    process.exit(2);
  }
  const result = premergeFlushRef(parsed.args);
  if (!result.ok) {
    console.error(`premerge-flush-ref: ${result.error}`);
    process.exit(1);
  }
  console.log(`premerge-outcome=${result.value.kind}`);
  if (result.value.kind === "conflict") {
    console.log(result.value.detail);
    process.exit(3);
  }
  console.log(`merged-sha=${result.value.mergedSha}`);
}
