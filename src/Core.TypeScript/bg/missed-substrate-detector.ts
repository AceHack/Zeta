// missed-substrate-detector.ts — B-0442 slice 3+4: real branch-vs-squash comparator
//
// Background service that detects branch-vs-merged-PR drift: commits landing
// on a feature branch AFTER its parent PR squash-merged. Slice 4 shipped the
// bus-publish wiring with a stub comparator; slice 3 (this file, 2026-05-13)
// plugs in the real branch-vs-squash compare logic via `realCascadeDetector`.
//
// Detection algorithm (slice 3):
//   1. For each merged PR, fetch `headRefOid` from gh — the branch HEAD SHA
//      *at merge time* (the SHA that was squashed).
//   2. Fetch `origin/<branchName>` to get the branch's current state.
//   3. If branch was deleted post-merge → return null (unrecoverable; the
//      window for detection closed at branch deletion).
//   4. Guard against rebases: if `headRefOid` is not an ancestor of the
//      current branch HEAD, return null (situation too complex to
//      auto-diagnose; would produce false-positive flood).
//   5. Run `git log <headRefOid>..origin/<branchName>` — these are the
//      commits added to the branch AFTER squash. If non-empty, cascade
//      detected; build CascadeFinding with urgency classified by
//      commit-count + merge-age.
//
// Run: bun tools/bg/missed-substrate-detector.ts [--once] [--poll-min N] [--lookback-min N] [--fetch-limit N] [--no-publish] [--agent NAME] [--to NAME]
// Compose with: B-0442 + B-0400 (bus) + B-0440 / B-0441 (companion services).

import { spawnSync } from "node:child_process";
import { publish } from "../bus/bus";
import { AGENT_IDS, SENDER_IDS, type AgentId, type MessageEnvelope, type SenderAgentId } from "../bus/types";
import {
  openRecoveryPR,
  type RecoveryAdapters,
  type RecoveryResult,
} from "./missed-substrate-recovery";

export type DetectorConfig = {
  pollIntervalMin: number;
  lookbackMin: number;
  fetchLimit: number;
  once: boolean;
  noPublish: boolean;
  fromAgent: SenderAgentId;
  toAgent: AgentId;
  /** Slice 5b (B-0504): when true, pollOnce calls openRecoveryPR for each
   *  CascadeFinding after detecting cascades. Default false. */
  autoRecover: boolean;
  /** Slice 5b (B-0504): when true AND autoRecover is true, recovery runs
   *  in dry-run mode (no git mutations; log intent only). Default false. */
  recoveryDryRun: boolean;
};

export const DEFAULT_CONFIG: DetectorConfig = {
  pollIntervalMin: 5,
  lookbackMin: 30,
  fetchLimit: 100,
  once: false,
  noPublish: false,
  fromAgent: "otto",
  toAgent: "*",
  autoRecover: false,
  recoveryDryRun: false,
};

export type MergedPR = {
  number: number;
  headRefName: string;
  mergedAt: string;
};

export type CascadeFinding = {
  prNumber: number;
  branchName: string;
  missingCommits: string[]; // commits on branch but not in squash
  urgency: "low" | "medium" | "high";
};

export type FetchResult =
  | { status: "ok"; prs: MergedPR[]; truncated: boolean }
  | { status: "gh-error"; reason: string };

export type PollResult = {
  pollAt: string;
  candidatesScanned: number;
  cascadesDetected: number;
  fetchStatus: "ok" | "gh-error";
  fetchTruncated: boolean;
  publishedEnvelopeIds: string[];
  /** Slice 5b (B-0504): count of findings for which openRecoveryPR was
   *  attempted. 0 when config.autoRecover=false or adapter missing. */
  recoveryAttempts: number;
  /** Slice 5b (B-0504): count of openRecoveryPR results with status="opened". */
  recoveryOpened: number;
  note: string;
};

/** Adapter abstraction so tests can inject deterministic clock + gh + cascade-detector + bus. */
export type Adapters = {
  now: () => Date;
  fetchRecentMergedPRs: (lookbackMin: number, fetchLimit: number) => FetchResult;
  /**
   * Detect cascades on a single merged PR. Slice 4 keeps this as an
   * injectable adapter for testing the bus-publish path; slice 3 wires
   * REAL_ADAPTERS to `realCascadeDetector` composed with real gh + git
   * sub-adapters (see `REAL_CASCADE_SUB_ADAPTERS`).
   */
  detectCascade: (pr: MergedPR) => CascadeFinding | null;
  publishCascade: (
    from: SenderAgentId,
    to: AgentId,
    finding: CascadeFinding,
  ) => MessageEnvelope;
  /**
   * Slice 5b (B-0504): optional recovery adapter. When provided AND
   * `config.autoRecover === true`, `pollOnce` invokes this for each
   * `CascadeFinding` after detection. Optional (`?`) so existing tests
   * that don't exercise the recovery path don't need to provide it;
   * `pollOnce` treats a missing adapter as `autoRecover=false`
   * regardless of the config flag.
   */
  openRecoveryPR?: (finding: CascadeFinding, dryRun: boolean) => RecoveryResult;
};

/**
 * Slice 3: result of fetching PR refs from gh. `headRefOid` is the branch
 * HEAD SHA at merge time — the SHA that was squashed.
 */
export type PRRefsResult =
  | { status: "ok"; headRefOid: string }
  | { status: "no-merge"; reason: string }
  | { status: "error"; reason: string };

/**
 * Slice 3: result of comparing the branch's current state against its
 * state at merge time. `missingCommits` are commits added to the branch
 * AFTER the squash — exactly the cascade signal.
 */
export type BranchCompareResult =
  | { status: "ok"; missingCommits: string[] }
  | { status: "branch-deleted"; reason: string }
  | { status: "branch-rebased"; reason: string }
  | { status: "error"; reason: string };

/**
 * Slice 3 sub-adapters for the real cascade detector. Decoupled so tests
 * inject deterministic gh + git responses without needing a real repo.
 */
export type CascadeDetectorAdapters = {
  fetchPRRefs: (prNumber: number) => PRRefsResult;
  compareBranchToMerged: (
    branchName: string,
    headRefOid: string,
  ) => BranchCompareResult;
  now: () => Date;
};

/**
 * Classify cascade urgency by commit count + merge-age. The Otto-section-
 * missed-PR-#2980 case was 3 minutes old with 1 missing commit ⇒ "high".
 */
export function classifyCascadeUrgency(
  missingCommitCount: number,
  mergedAtIso: string,
  nowMs: number,
): "low" | "medium" | "high" {
  const mergedAtMs = new Date(mergedAtIso).getTime();
  const ageHours = (nowMs - mergedAtMs) / (1000 * 60 * 60);
  if (missingCommitCount >= 4) return "high"; // multiple-commit drift = serious
  if (ageHours < 1) return "high"; // fresh drift = likely about to be lost
  if (missingCommitCount >= 2) return "medium";
  if (ageHours < 24) return "medium"; // recent single-commit drift
  return "low";
}

/**
 * Slice 3: real branch-vs-squash cascade detector. Pure function composed
 * with sub-adapters for testability. Returns null when no drift detected,
 * when branch was deleted, when branch was rebased (too complex to
 * auto-diagnose), or when gh/git errors prevent diagnosis.
 */
export function realCascadeDetector(
  pr: MergedPR,
  adapters: CascadeDetectorAdapters,
): CascadeFinding | null {
  const refs = adapters.fetchPRRefs(pr.number);
  if (refs.status !== "ok") return null;

  const compare = adapters.compareBranchToMerged(pr.headRefName, refs.headRefOid);
  if (compare.status !== "ok") return null;
  if (compare.missingCommits.length === 0) return null;

  return {
    prNumber: pr.number,
    branchName: pr.headRefName,
    missingCommits: compare.missingCommits,
    urgency: classifyCascadeUrgency(
      compare.missingCommits.length,
      pr.mergedAt,
      adapters.now().getTime(),
    ),
  };
}

/**
 * Slice 3: maximum number of post-squash commits to surface in a single
 * envelope. Caps the false-positive flood case where headRefOid is an
 * ancestor of branchHead but the gap is unexpectedly large (e.g., the
 * branch is being reused for follow-up work — not a cascade).
 */
export const MAX_REPORTED_MISSING_COMMITS = 50;

const REAL_ADAPTERS: Adapters = {
  now: () => new Date(),
  fetchRecentMergedPRs: (lookbackMin: number, fetchLimit: number) => {
    const since = new Date(Date.now() - lookbackMin * 60 * 1000).toISOString();
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- gh invoked as explicit args array; no shell, no injection risk.
    const result = spawnSync(
      "gh",
      [
        "pr", "list",
        "--state", "merged",
        "--search", `merged:>${since}`,
        "--json", "number,headRefName,mergedAt",
        "--limit", String(fetchLimit),
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    if (result.status !== 0) {
      return { status: "gh-error", reason: `gh exited with status ${result.status}; stderr: ${(result.stderr ?? "").toString().slice(0, 200)}` };
    }
    if (!result.stdout) {
      return { status: "gh-error", reason: "gh produced empty stdout" };
    }
    try {
      const parsed = JSON.parse(result.stdout);
      if (!Array.isArray(parsed)) {
        return { status: "gh-error", reason: "gh stdout was not a JSON array" };
      }
      const prs = parsed.filter((p): p is MergedPR =>
        typeof p === "object" &&
        p !== null &&
        typeof p.number === "number" &&
        typeof p.headRefName === "string" &&
        typeof p.mergedAt === "string",
      );
      return { status: "ok", prs, truncated: prs.length >= fetchLimit };
    } catch (e) {
      return { status: "gh-error", reason: `JSON parse failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
  // Slice 3 (2026-05-13): real branch-vs-squash compare via gh + git.
  detectCascade: (pr: MergedPR) =>
    realCascadeDetector(pr, REAL_CASCADE_SUB_ADAPTERS),
  publishCascade: (from, to, finding) =>
    publish(from, to, {
      topic: "missed-substrate-cascade",
      payload: {
        prNumber: finding.prNumber,
        branchName: finding.branchName,
        missingCommits: finding.missingCommits,
        recommendedAction: "open-recovery-PR",
        urgency: finding.urgency,
      },
    }),
  // Slice 5b (B-0504): production recovery adapter. Composes the pure
  // `openRecoveryPR` core function (B-0503) with real spawnSync wrappers
  // for each git/gh sub-operation. See `REAL_RECOVERY_ADAPTERS` below for
  // the sub-adapter implementations + their security validation.
  //
  // WORKING-TREE SAFETY GATE (per Copilot PR #3447 review on line 349):
  // the real recovery adapters mutate whatever git checkout this detector
  // runs in (`git branch -D`, `git checkout -b`, `git cherry-pick`,
  // `git push --force-with-lease`). Running them against a dirty working
  // tree would clobber uncommitted work or leak commits into the wrong
  // tree. We refuse to proceed in non-dry-run mode if the working tree
  // is not clean — operators are expected to run auto-recovery from a
  // dedicated scratch worktree (`git worktree add /tmp/zeta-recovery
  // <branch>` is the canonical shape).
  openRecoveryPR: (finding, dryRun) => {
    if (!dryRun && !isWorkingTreeClean()) {
      return {
        status: "error",
        reason:
          "refusing recovery: working tree is not clean. Run auto-recovery from a dedicated `git worktree add` scratch dir, or pass --recovery-dry-run to skip mutations.",
      };
    }
    return openRecoveryPR(finding, dryRun, REAL_RECOVERY_ADAPTERS);
  },
};

/**
 * Slice 5b (B-0504): pre-mutation safety check. Returns true if `git
 * status --porcelain` reports no modified/untracked/deleted files in
 * the current checkout. Used as the gate before `REAL_ADAPTERS.openRecoveryPR`
 * runs any mutating sub-adapter — see the comment block on that adapter
 * for the failure mode this prevents.
 */
function isWorkingTreeClean(): boolean {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- git invoked as explicit args array.
  const r = spawnSync(
    "git",
    ["status", "--porcelain"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (r.status !== 0) return false; // conservative: assume dirty on git error
  return (r.stdout ?? "").trim().length === 0;
}

/**
 * Slice 5b (B-0504): real production sub-adapters for openRecoveryPR.
 *
 * Each adapter wraps a `spawnSync` call with args-as-array (no shell, no
 * injection). Per the B-0503 security note + the `compareBranchToMerged`
 * pattern, branch names and commit SHAs from `CascadeFinding` are
 * already validated by `realCascadeDetector` (allow-list regex); these
 * adapters trust the validated inputs.
 *
 * `gitCreateBranch` honors the B-0503 retry-safety contract: if the local
 * branch already exists (from a prior partial-failure attempt), it deletes
 * and recreates from `base` so the recovery retry doesn't wedge.
 */
const REAL_RECOVERY_ADAPTERS: RecoveryAdapters = {
  checkRecoveryPRExists: (branchName: string) => {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- gh invoked as explicit args array; no shell, no injection.
    const r = spawnSync(
      "gh",
      ["pr", "list", "--head", branchName, "--state", "open", "--json", "number"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    if (r.status !== 0) return false; // conservative: assume no existing PR on gh failure
    try {
      const parsed = JSON.parse(r.stdout ?? "[]");
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  },
  gitCreateBranch: (branch: string, base: string) => {
    // Retry-safety per the B-0503 RecoveryAdapters.gitCreateBranch contract:
    // if the local branch already exists (prior partial-failure recovery
    // attempt), delete it before recreating from `base`.
    //
    // Per Codex PR #3447 line 344: `git branch -D` CANNOT delete the
    // currently-checked-out branch — if a previous attempt left HEAD on
    // `recovery/<prNumber>`, the delete fails AND the subsequent
    // `checkout -b` fails (branch already exists). Both failures wedge
    // retries permanently. Mitigation: detach HEAD to `base` first
    // (`git checkout --detach <base>`), so the recovery branch is no
    // longer current and `git branch -D` succeeds. Detach is safe
    // because we're about to `checkout -b` onto a fresh branch anyway;
    // the intermediate detached state is transient.
    //
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- git invoked as explicit args array.
    spawnSync(
      "git",
      ["checkout", "--detach", base],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- git invoked as explicit args array.
    spawnSync("git", ["branch", "-D", branch], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- git invoked as explicit args array.
    const r = spawnSync(
      "git",
      ["checkout", "-b", branch, base],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return r.status === 0;
  },
  gitCherryPick: (sha: string) => {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- git invoked as explicit args array.
    const r = spawnSync(
      "git",
      ["cherry-pick", sha],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    if (r.status === 0) return "ok";
    const stderr = (r.stderr ?? "").toString();
    // Per Codex PR #3447 line 377: when cherry-pick fails (conflict or
    // error), the repo is left in CHERRY_PICK_HEAD state with a
    // conflicted index/worktree. Future polls then fail
    // `isWorkingTreeClean()` and refuse all recovery — one conflict
    // wedges the daemon. Abort the in-progress cherry-pick before
    // returning so the working tree returns to a clean state. The
    // caller (openRecoveryPR) returns immediately on conflict/error
    // without pushing, so aborting here doesn't lose intentional state.
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- git invoked as explicit args array.
    spawnSync(
      "git",
      ["cherry-pick", "--abort"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    // git cherry-pick exits 1 with "CONFLICT" in stderr on merge conflict.
    if (stderr.includes("CONFLICT")) return "conflict";
    return "error";
  },
  gitPush: (branch: string) => {
    // --force-with-lease honors the B-0503 retry-safety hint: a prior
    // attempt may have pushed an incomplete branch; --force-with-lease
    // overwrites only if the remote matches what we last fetched (safer
    // than --force).
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- git invoked as explicit args array.
    const r = spawnSync(
      "git",
      ["push", "--force-with-lease", "origin", branch],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    return r.status === 0;
  },
  ghPrCreate: (title: string, body: string, head: string) => {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- gh invoked as explicit args array.
    const r = spawnSync(
      "gh",
      ["pr", "create", "--title", title, "--body", body, "--head", head, "--base", "main"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    if (r.status !== 0) return null;
    const url = (r.stdout ?? "").toString().trim();
    return url.length > 0 ? url : null;
  },
};

/**
 * Slice 3 (2026-05-13): real production sub-adapters for the cascade
 * detector. `fetchPRRefs` calls `gh pr view --json headRefOid`;
 * `compareBranchToMerged` fetches the branch from origin and runs
 * `git log <headRefOid>..origin/<branchName>` to find post-squash drift.
 */
export const REAL_CASCADE_SUB_ADAPTERS: CascadeDetectorAdapters = {
  now: () => new Date(),
  fetchPRRefs: (prNumber: number): PRRefsResult => {
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- gh invoked as explicit args array; no shell, no injection risk.
    const result = spawnSync(
      "gh",
      ["pr", "view", String(prNumber), "--json", "headRefOid,mergeCommit"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    if (result.status !== 0) {
      return {
        status: "error",
        reason: `gh pr view ${prNumber} exited ${result.status}; stderr: ${(result.stderr ?? "").toString().slice(0, 200)}`,
      };
    }
    if (!result.stdout) {
      return { status: "error", reason: "gh pr view produced empty stdout" };
    }
    try {
      const parsed = JSON.parse(result.stdout);
      const headRefOid = parsed?.headRefOid;
      const mergeCommit = parsed?.mergeCommit;
      if (typeof headRefOid !== "string" || headRefOid.length === 0) {
        return { status: "no-merge", reason: "PR has no headRefOid" };
      }
      if (!mergeCommit || typeof mergeCommit.oid !== "string") {
        return { status: "no-merge", reason: "PR has no mergeCommit (closed-not-merged?)" };
      }
      return { status: "ok", headRefOid };
    } catch (e) {
      return { status: "error", reason: `JSON parse failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  },
  compareBranchToMerged: (branchName: string, headRefOid: string): BranchCompareResult => {
    // Validate inputs to prevent shell-injection via crafted refs (gh response
    // is trusted but defensive validation matches our usual posture). Allow-list
    // covers the git-check-ref-format character set: alphanumerics plus
    // `._/+@=-`. These are git-legal AND shell-safe (they cannot break out of
    // the explicit args-array spawnSync call). Characters git itself forbids
    // (space, `~`, `^`, `:`, `?`, `*`, `[`, `\`) and characters that could
    // enable injection are excluded. Codex P1 (2026-05-13): widened from the
    // initial `[A-Za-z0-9._/-]` regex which incorrectly rejected valid refs
    // containing `@`, `+`, or `=`.
    if (!/^[A-Za-z0-9._/+@=\-]+$/.test(branchName)) {
      return { status: "error", reason: `invalid branchName: ${branchName.slice(0, 40)}` };
    }
    if (!/^[0-9a-f]{7,40}$/.test(headRefOid)) {
      return { status: "error", reason: `invalid headRefOid: ${headRefOid.slice(0, 40)}` };
    }

    // Fetch the latest branch state. If the branch was deleted post-merge,
    // git fetch reports "couldn't find remote ref" — surface as branch-deleted.
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- git invoked as explicit args array; refs validated above.
    const fetchResult = spawnSync(
      "git",
      ["fetch", "--quiet", "origin", branchName],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    if (fetchResult.status !== 0) {
      const stderr = (fetchResult.stderr ?? "").toString();
      // Codex P1 (2026-05-13): only the specific "couldn't find remote ref"
      // phrase reliably indicates a deleted-branch. The broader "not found"
      // check matched auth / repository-level failures (e.g.,
      // "repository ... not found") and miscategorised them as branch
      // deletion — silently dropping cascade-detection rather than
      // surfacing the real error.
      if (stderr.includes("couldn't find remote ref")) {
        return { status: "branch-deleted", reason: "branch not on origin (deleted post-merge)" };
      }
      return { status: "error", reason: `git fetch failed: ${stderr.slice(0, 200)}` };
    }

    // Guard against rebases: if headRefOid is NOT an ancestor of the current
    // branch HEAD, the branch was rewritten and we cannot trust a simple
    // log-range. Surface branch-rebased; the situation needs manual review.
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- git invoked as explicit args array.
    const ancestorResult = spawnSync(
      "git",
      ["merge-base", "--is-ancestor", headRefOid, `origin/${branchName}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    if (ancestorResult.status === 1) {
      return { status: "branch-rebased", reason: `${headRefOid.slice(0, 8)} is not ancestor of origin/${branchName} (rebase or force-push detected)` };
    }
    if (ancestorResult.status !== 0) {
      return { status: "error", reason: `git merge-base failed: ${(ancestorResult.stderr ?? "").toString().slice(0, 200)}` };
    }

    // Now list commits on origin/<branch> not reachable from headRefOid —
    // these are the post-squash drift commits (the cascade signal).
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- git invoked as explicit args array.
    const logResult = spawnSync(
      "git",
      ["log", `${headRefOid}..origin/${branchName}`, "--format=%H"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    if (logResult.status !== 0) {
      return { status: "error", reason: `git log failed: ${(logResult.stderr ?? "").toString().slice(0, 200)}` };
    }
    const allMissing = (logResult.stdout ?? "")
      .trim()
      .split("\n")
      .filter(line => line.length > 0);
    const missingCommits = allMissing.slice(0, MAX_REPORTED_MISSING_COMMITS);
    return { status: "ok", missingCommits };
  },
};

/**
 * Single poll iteration. Fetches merged PRs, runs the cascade detector
 * on each, and publishes a missed-substrate-cascade envelope per finding
 * (unless noPublish). Slice 3 (2026-05-13) wired the real detector;
 * REAL_ADAPTERS.detectCascade now calls `realCascadeDetector` with real
 * gh + git sub-adapters.
 */
export function pollOnce(
  config: DetectorConfig,
  adapters: Adapters = REAL_ADAPTERS,
): PollResult {
  const pollAt = adapters.now();
  const fetch = adapters.fetchRecentMergedPRs(config.lookbackMin, config.fetchLimit);

  if (fetch.status === "gh-error") {
    return {
      pollAt: pollAt.toISOString(),
      candidatesScanned: 0,
      cascadesDetected: 0,
      fetchStatus: "gh-error",
      fetchTruncated: false,
      publishedEnvelopeIds: [],
      recoveryAttempts: 0,
      recoveryOpened: 0,
      note: `gh fetch failed; cannot evaluate drift this tick. ${fetch.reason}`,
    };
  }

  const findings: CascadeFinding[] = [];
  for (const pr of fetch.prs) {
    const finding = adapters.detectCascade(pr);
    if (finding !== null) findings.push(finding);
  }

  const publishedEnvelopeIds: string[] = [];
  let publishError: string | null = null;
  if (!config.noPublish && findings.length > 0) {
    for (const finding of findings) {
      try {
        const envelope = adapters.publishCascade(config.fromAgent, config.toAgent, finding);
        publishedEnvelopeIds.push(envelope.id);
      } catch (e) {
        publishError = e instanceof Error ? e.message : String(e);
        break;
      }
    }
  }

  // Slice 5b (B-0504): recovery loop. Runs only when `config.autoRecover`
  // is true AND the optional `openRecoveryPR` adapter is provided. Recovery
  // failures (adapter throws) are logged into recoveryNotes and do NOT
  // throw — the poll cycle completes successfully even when individual
  // recovery attempts error out, so the next poll can re-try.
  let recoveryAttempts = 0;
  let recoveryOpened = 0;
  const recoveryNotes: string[] = [];
  if (config.autoRecover && adapters.openRecoveryPR !== undefined) {
    for (const finding of findings) {
      recoveryAttempts++;
      try {
        const rr = adapters.openRecoveryPR(finding, config.recoveryDryRun);
        if (rr.status === "opened") {
          recoveryOpened++;
          recoveryNotes.push(`recovery PR ${rr.prUrl} for #${finding.prNumber} (${rr.cherryPickedCount} commits)`);
        } else {
          recoveryNotes.push(`recovery ${rr.status} for #${finding.prNumber}`);
        }
      } catch (e) {
        recoveryNotes.push(`recovery error for #${finding.prNumber}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  const truncatedSuffix = fetch.truncated
    ? ` (WARNING: results truncated at fetchLimit=${config.fetchLimit}; raise --fetch-limit or shorten --lookback-min)`
    : "";
  const publishSuffix = publishError
    ? ` (publish failed: ${publishError})`
    : config.noPublish && findings.length > 0
    ? ` (publish skipped per --no-publish)`
    : publishedEnvelopeIds.length > 0
    ? ` (published ${publishedEnvelopeIds.length} cascade envelope(s))`
    : "";
  const recoverySuffix = recoveryNotes.length > 0 ? `; ${recoveryNotes.join("; ")}` : "";

  return {
    pollAt: pollAt.toISOString(),
    candidatesScanned: fetch.prs.length,
    cascadesDetected: findings.length,
    fetchStatus: "ok",
    fetchTruncated: fetch.truncated,
    publishedEnvelopeIds,
    recoveryAttempts,
    recoveryOpened,
    note: findings.length > 0
      ? `${findings.length} cascade(s) detected in ${fetch.prs.length} merged PR(s)${publishSuffix}${truncatedSuffix}${recoverySuffix}`
      : fetch.prs.length === 0
      ? `no merged PRs in last ${config.lookbackMin}min lookback window`
      : `${fetch.prs.length} merged PR(s) in last ${config.lookbackMin}min; no cascades detected${truncatedSuffix}`,
  };
}

export function runOnce(config: DetectorConfig = DEFAULT_CONFIG): PollResult {
  const result = pollOnce(config);
  console.log(JSON.stringify(result));
  return result;
}

export async function runDaemon(config: DetectorConfig = DEFAULT_CONFIG): Promise<never> {
  while (true) {
    runOnce(config);
    await new Promise(resolve => setTimeout(resolve, config.pollIntervalMin * 60 * 1000));
  }
}

export function parsePositiveMinutes(raw: string | undefined, name: string): number {
  if (raw === undefined) throw new Error(`${name} requires a value`);
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`${name} must be a positive finite number; got "${raw}"`);
  }
  return n;
}

function parsePositiveInt(raw: string | undefined, name: string): number {
  if (raw === undefined) throw new Error(`${name} requires a value`);
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    throw new Error(`${name} must be a positive integer; got "${raw}"`);
  }
  return n;
}

function parseSenderId(raw: string | undefined): SenderAgentId {
  if (raw === undefined) throw new Error("--agent requires a value");
  if ((SENDER_IDS as readonly string[]).includes(raw)) return raw as SenderAgentId;
  throw new Error(`--agent must be one of ${SENDER_IDS.join(", ")}; got "${raw}"`);
}

function parseAgentId(raw: string | undefined): AgentId {
  if (raw === undefined) throw new Error("--to requires a value");
  if ((AGENT_IDS as readonly string[]).includes(raw)) return raw as AgentId;
  throw new Error(`--to must be one of ${AGENT_IDS.join(", ")}; got "${raw}"`);
}

const KNOWN_FLAGS = ["--once", "--poll-min", "--lookback-min", "--fetch-limit", "--no-publish", "--agent", "--to", "--auto-recover", "--recovery-dry-run"] as const;

export function parseArgs(argv: string[]): DetectorConfig {
  const config: DetectorConfig = { ...DEFAULT_CONFIG };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--once") {
      config.once = true;
    } else if (arg === "--no-publish") {
      config.noPublish = true;
    } else if (arg === "--poll-min") {
      config.pollIntervalMin = parsePositiveMinutes(argv[++i], "--poll-min");
    } else if (arg === "--lookback-min") {
      config.lookbackMin = parsePositiveMinutes(argv[++i], "--lookback-min");
    } else if (arg === "--fetch-limit") {
      config.fetchLimit = parsePositiveInt(argv[++i], "--fetch-limit");
    } else if (arg === "--agent") {
      config.fromAgent = parseSenderId(argv[++i]);
    } else if (arg === "--to") {
      config.toAgent = parseAgentId(argv[++i]);
    } else if (arg === "--auto-recover") {
      config.autoRecover = true;
    } else if (arg === "--recovery-dry-run") {
      config.recoveryDryRun = true;
    } else {
      throw new Error(`unknown flag: ${arg}; known flags: ${KNOWN_FLAGS.join(", ")}`);
    }
  }

  return config;
}

if (import.meta.main) {
  const config = parseArgs(process.argv.slice(2));
  if (config.once) {
    runOnce(config);
  } else {
    await runDaemon(config);
  }
}
