#!/usr/bin/env bun
// src/Core.TypeScript/agent-heartbeats/merge-heartbeats-to-main.ts — 081KSKBP80008QG0R001KK9WV6.4: periodic
// merge of agent-heartbeats branch back into main.
//
// Composes:
//   - src/Core.TypeScript/agent-heartbeats/write-heartbeat.ts (081KSKBP80008QG0R001KK9WV6.3; the per-tick writer)
//   - GitHub REST /repos/{owner}/{repo}/compare/{base}...{head} (up-to-date check)
//   - GitHub REST /repos/{owner}/{repo}/pulls (create PR)
//   - `gh pr merge --auto --squash` (arm auto-merge with squash strategy;
//     uses gh CLI which wraps the enablePullRequestAutoMerge GraphQL mutation)
//
// Per operator 2026-05-27: "we can merge it back to main every now and
// then too there will be no conflicts" — heartbeats live ONLY at
// docs/agent-heartbeats/<persona>/YYYY/MM/DD/<zetaid-hex>.md paths;
// other repo work touches different paths; ZetaID-unique filenames
// prevent internal conflicts; the merge is conflict-free by design.
//
// Main is PR-gated (Review Policy ruleset requires pull_request +
// required_status_checks), so direct REST /merges returns 409. This
// tool instead opens a PR from agent-heartbeats → main with auto-merge
// armed (squash). The PR exists during CI then squash-merges; PR queue
// cost is one entry per merge cycle, not per heartbeat.
//
// Usage:
//   ./tools/agent-heartbeats/merge-heartbeats-to-main.ts
//
//   bun src/Core.TypeScript/agent-heartbeats/merge-heartbeats-to-main.ts [--repo owner/name]
//     [--head agent-heartbeats] [--base main] [--dry-run]
//
// Exit codes:
//   0 success (PR opened + armed OR up-to-date)
//   2 arg-parse error
//   3 PR-create call failed (arm-auto-merge failure is NOT fatal — see openMergePR)
//   4 up-to-date (no heartbeats since last merge)

import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";

interface Args {
  readonly repo: string;
  readonly head: string;
  readonly base: string;
  readonly sourceSha: string | undefined;
  readonly dryRun: boolean;
}

export interface HeartbeatSnapshot {
  readonly sourceHead: string;
  readonly sourceSha: string;
  readonly snapshotRef: string;
}

const HEAD_NAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9_-]|\.(?=[A-Za-z0-9_-])){0,62}$/;
const COMMIT_SHA_RE = /^[0-9a-f]{40}$/;

/**
 * Derive the PR head for one exact mutable heartbeat tip: ONE FIXED REF PER LANE.
 *
 * WHY THIS IS NO LONGER `-flush-<sha>` (2026-08-25).
 * ---------------------------------------------------
 * The ref used to embed the source SHA, so "a later tick necessarily derives a different
 * one" — which is exactly what the old docstring promised, and it is an unbounded ref
 * generator. Measured on `origin`: 1,631 `heartbeat/*` refs, of which 1,610 are
 * `-flush-<sha>` snapshots (alexa 564, otto 532, soraya 514). The mutable lanes and their
 * buffers account for the other 21.
 *
 * NOTHING COULD EVER HAVE REAPED THEM, and that is the part worth stating precisely,
 * because the obvious fix does not work here. Ruleset "Heartbeat Branch Protection"
 * (16934633) targets `refs/heads/heartbeat/*` with a `deletion` rule, `bypass_actors: []`
 * and `current_user_can_bypass: "never"`. So:
 *
 *   - no agent, admin or workflow can delete one of these refs;
 *   - `delete_branch_on_merge` (which IS enabled on the repo) cannot fire on them either.
 *
 * Verified rather than assumed: the merged flush PRs #15267 and #15255 still have their
 * `heartbeat/soraya-flush-<sha>` heads on the remote, while `automation/*` archive branches
 * — same repo, same setting, no deletion ruleset — ARE removed on merge. So this leak is
 * not the "closed unmerged PR" case it was reported as: EVERY flush leaked its ref, merged
 * or not, and deleting them was never an available remedy.
 *
 * That rules out "delete the branch when the PR reaches a terminal state" and leaves the
 * only fix that works under the ruleset as written: STOP MINTING NEW NAMES. The ref is now
 * `heartbeat/<lane>-flush`, one per lane, force-updated in place — so the lane's ref
 * population is constant (lane + buffer + flush) no matter how many times it flushes.
 *
 * This is not a new invention; it is the shape `flush-via-staging.ts` has been running in
 * production on `tick-metrics`, `society` and `drift-sweep` for months, and those lanes
 * leak nothing. The immutability the old snapshot bought is preserved by the CALLER, which
 * must not move this ref while a PR is open on it — the same active/buffer discipline
 * `chooseFlushRoute` implements. See `.github/workflows/agent-heartbeat.yml`.
 *
 * `sourceSha` stays in the returned value: it is what `verifySnapshotRef` checks the ref
 * against, so the PR-only credential can still confirm it is looking at the exact commit
 * the contents-write credential published, without being able to move it.
 */
export function heartbeatSnapshot(
  sourceHead: string,
  sourceSha: string,
): { readonly ok: HeartbeatSnapshot } | { readonly error: string } {
  const prefix = "heartbeat/";
  const lane = sourceHead.startsWith(prefix) ? sourceHead.slice(prefix.length) : "";
  if (!HEAD_NAME_RE.test(lane) || lane.endsWith(".lock")) {
    return { error: `heartbeat head must be heartbeat/<safe-lane>; got ${sourceHead}` };
  }
  if (!COMMIT_SHA_RE.test(sourceSha)) {
    return { error: `heartbeat source SHA must be 40 lowercase hex characters; got ${sourceSha}` };
  }
  return {
    ok: {
      sourceHead,
      sourceSha,
      snapshotRef: `heartbeat/${lane}-flush`,
    },
  };
}

/** Machine-readable outputs consumed by the later workflow steps. */
export function heartbeatSnapshotOutput(snapshot: HeartbeatSnapshot, prNumber: number): string {
  return [
    "skip=false",
    `source_head=${snapshot.sourceHead}`,
    `source_sha=${snapshot.sourceSha}`,
    `snapshot_ref=${snapshot.snapshotRef}`,
    `pr_number=${String(prNumber)}`,
    "",
  ].join("\n");
}

export function heartbeatMergePrTitle(base: string, ts: string): string {
  return `[heartbeat-batch-merge] merge(agent-heartbeats): periodic sync to ${base} (${ts})`;
}

function emitWorkflowOutput(text: string, env: NodeJS.ProcessEnv = process.env): { readonly error: string } | null {
  const path = env.GITHUB_OUTPUT;
  if (!path) return null;
  try {
    appendFileSync(path, text, "utf8");
    return null;
  } catch (err) {
    return { error: `could not write GITHUB_OUTPUT: ${err instanceof Error ? err.message : String(err)}` };
  }
}

export function parseArgs(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): Args | { readonly error: string } {
  let repo = env.ZETA_AGENT_REPO ?? "Lucent-Financial-Group/Zeta";
  let head = env.ZETA_AGENT_BRANCH ?? "heartbeat/alexa";
  let base = "main";
  let sourceSha = env.ZETA_AGENT_SOURCE_SHA;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    const next = (): string => {
      if (i + 1 >= argv.length) throw new Error(`${arg} requires a value`);
      return argv[++i]!;
    };
    try {
      if (arg === "--repo") repo = next();
      else if (arg === "--head") head = next();
      else if (arg === "--base") base = next();
      else if (arg === "--source-sha") sourceSha = next();
      else if (arg === "--dry-run") dryRun = true;
      else return { error: `unknown flag: ${arg}` };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) return { error: "--repo must match owner/name" };
  if (sourceSha !== undefined && !COMMIT_SHA_RE.test(sourceSha)) {
    return { error: "--source-sha must be 40 lowercase hex characters" };
  }
  return { repo, head, base, sourceSha, dryRun };
}

function gh(args: string[], input?: string): { status: number; stdout: string; stderr: string } {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("gh", args, {
    input,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  // Surface spawnSync launch failures (e.g., `gh` not on PATH → result.error
  // set; status null; stdout/stderr empty). Without this branch the caller
  // sees a confusing empty-stderr message.
  if (result.error) {
    return {
      status: -1,
      stdout: "",
      stderr: `gh CLI launch failed: ${result.error.message} (is gh installed + on PATH?)`,
    };
  }
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

// ---------------------------------------------------------------------------
// This lane SIGNS ITS OWN PRs. (2026-08-15)
// ---------------------------------------------------------------------------
//
// GitHub squash-merge takes the PR BODY as the commit message, so the body is
// where the AgencySignature block has to be for it to reach `main` at all — and
// this lane's body carried none. Measured on the open PR set 2026-08-15, PRs
// #10709/#10710/#10711 are this generator's output and every one of them is
// unsigned; they pass today only because they were opened before the
// FAIL_CLOSED_CUTOVER and are grandfathered. The next one would have gone red.
//
// This is the OUR-OWN-AUTOMATION class, and its remedy is the honest one: a
// workflow we run can make a real self-attestation, so it does. (The third-party
// class — dependabot — cannot, and is handled the opposite way; see the
// externalActors note in hygiene/agency-signature-identity-roster.json.) The
// survey that found this: `grep -rl 'pr create|create-pull-request|pulls.create'
// .github/workflows/` → pr-archive-on-merge.yml (fixed in #10764, deliberately
// untouched here) and agent-heartbeat.yml, whose PR call is this file.

/** The lane's own credential, MEASURED not asserted — `unknown` when it cannot be read. */
function credentialLogin(): string {
  const result = gh(["api", "user", "--jq", ".login"]);
  if (result.status !== 0) return "unknown";
  const login = result.stdout.trim();
  return login === "" ? "unknown" : login;
}

/**
 * The PR body for a heartbeat flush, with its AgencySignature v1 block as the
 * final contiguous paragraph.
 *
 * Pure, and exported, so the block has falsifiers: the test feeds this exact
 * string to the real validator. A generator whose output nothing checks is how
 * the unsigned bodies got there in the first place.
 *
 * On the values, since asserting a convenient one would defeat the convention:
 *   Agent-Model  — there is no model. This is a deterministic script, and saying
 *                  so is the honest reading of a field that exists to record
 *                  which model acted.
 *   Credential-* — the workflow's token expression is
 *                  `ZETA_TELEMETRY_FLUSH_TOKEN || ZETA_PR_ARCHIVE_TOKEN ||
 *                  GITHUB_TOKEN`, so which credential is in play is decided at
 *                  runtime and cannot be hardcoded truthfully. It is read from
 *                  `gh api user` instead. The mode is INFERRED from the login
 *                  shape (`*[bot]` ⇒ dedicated-agent, otherwise a human account
 *                  lent to automation ⇒ shared) and degrades to `unknown`.
 *   Human-Review — `not-implied-by-credential`, which is spec Mechanics rule #3
 *                  ("never use actor/author/committer as proof of human action")
 *                  stated in the field rather than left to the reader. Nobody
 *                  reviews 300 machine-written event files and the block must
 *                  not imply otherwise.
 */
export function heartbeatMergePrBody(base: string, ts: string, credential: string): string {
  const mode = credential === "unknown" ? "unknown" : credential.endsWith("[bot]") ? "dedicated-agent" : "shared";
  // `***` rather than `---` for the rule. Not required any more — the validator
  // passes `--no-divider` as of this change, and `git log %(trailers)` never
  // applied the divider rule to a stored commit message — but this lane's
  // liveness should not depend on a parser flag staying set.
  return [
    "Mechanically-opened agent-tick batch merge per 081KSKBP80008QG0R001KK9WV6.4.",
    "Apply normal review policy: a tick may carry generated events, archives, repairs, or source changes.",
    "",
    "***",
    "",
    `Conflict-free merge cycle into \`${base}\`. Heartbeats live at`,
    "`docs/observe-events/<zetaid>.json` paths; no overlap with",
    "other repo work; ZetaID-unique filenames prevent internal conflicts. Auto-merge armed with",
    "squash to keep main history linear (one merge commit per cycle, not per heartbeat).",
    "",
    `Generated by \`src/Core.TypeScript/agent-heartbeats/merge-heartbeats-to-main.ts\` at ${ts}.`,
    "",
    "Agency-Signature-Version: 1",
    "Agent: agent-heartbeat-flush",
    "Agent-Runtime: bun src/Core.TypeScript/agent-heartbeats/merge-heartbeats-to-main.ts",
    "Agent-Model: none-deterministic-script",
    `Credential-Identity: ${credential}`,
    `Credential-Mode: ${mode}`,
    "Human-Review: not-implied-by-credential",
    "Human-Review-Evidence: none",
    "Action-Mode: autonomous-fail-open",
    "Task: 081KSKBP80008QG0R001KK9WV6",
  ].join("\n");
}

/**
 * Compare base..head — if base already contains head's tip, no merge needed.
 * Uses /repos/{owner}/{repo}/compare/{base}...{head} which returns
 * { status: "identical"|"ahead"|"behind"|"diverged", ahead_by, behind_by }.
 */
export function isUpToDate(repo: string, base: string, head: string): boolean | { readonly error: string } {
  const result = gh(["api", `repos/${repo}/compare/${base}...${head}`]);
  if (result.status !== 0) return { error: `compare failed: ${result.stderr || result.stdout}` };
  try {
    const parsed = JSON.parse(result.stdout);
    // If head is "behind" or "identical" to base, base already contains head
    return parsed.status === "identical" || parsed.status === "behind";
  } catch (err) {
    return { error: `compare parse failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Resolve a branch ref to the exact commit that the immutable snapshot must retain. */
export function resolveHeadSha(repo: string, head: string): { readonly ok: string } | { readonly error: string } {
  const result = gh(["api", `repos/${repo}/git/ref/heads/${head}`]);
  if (result.status !== 0) return { error: `head lookup failed: ${result.stderr || result.stdout}` };
  try {
    const parsed = JSON.parse(result.stdout) as { readonly object?: { readonly sha?: unknown } };
    const sha = parsed.object?.sha;
    if (typeof sha !== "string" || !COMMIT_SHA_RE.test(sha)) {
      return { error: "head lookup returned no canonical commit SHA" };
    }
    return { ok: sha };
  } catch (err) {
    return { error: `head lookup parse failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Verify the immutable branch created by the workflow's contents-write credential.
 * This PR-only process must never create or move repository refs.
 */
export function verifySnapshotRef(
  repo: string,
  snapshot: HeartbeatSnapshot,
): { readonly ok: true } | { readonly error: string } {
  const existing = gh(["api", `repos/${repo}/git/ref/heads/${snapshot.snapshotRef}`]);
  if (existing.status !== 0) {
    return { error: `snapshot lookup failed: ${existing.stderr || existing.stdout}` };
  }
  try {
    const parsed = JSON.parse(existing.stdout) as { readonly object?: { readonly sha?: unknown } };
    if (parsed.object?.sha !== snapshot.sourceSha) {
      return { error: `snapshot ref collision: ${snapshot.snapshotRef} does not point to ${snapshot.sourceSha}` };
    }
    return { ok: true };
  } catch (err) {
    return { error: `snapshot lookup parse failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Find existing open PR from head → base if any, so periodic re-runs are
 * idempotent (GitHub returns 422 "A pull request already exists" on dup
 * create; we'd rather re-use the existing PR + re-arm auto-merge).
 */
export interface ExistingPR {
  readonly number: number;
  readonly url: string;
  /**
   * The PR's current head SHA. Carried because a caller deciding whether to WAIT on this
   * PR needs to ask whether its head is still under test, and the check-runs API is keyed
   * by commit — see `classifyHeadVerdict` in `flush-via-staging.ts`.
   */
  readonly headSha: string;
}

export function findExistingPR(
  repo: string,
  head: string,
  base: string,
): { readonly found: ExistingPR | null } | { readonly error: string } {
  const owner = repo.split("/")[0]!;
  const result = gh(["api", `repos/${repo}/pulls?state=open&head=${owner}:${head}&base=${base}`]);
  if (result.status !== 0) return { error: `list pulls failed: ${result.stderr || result.stdout}` };
  try {
    const parsed = JSON.parse(result.stdout);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]) {
      return {
        found: {
          number: parsed[0].number,
          url: parsed[0].html_url,
          headSha: typeof parsed[0].head?.sha === "string" ? parsed[0].head.sha : "",
        },
      };
    }
    return { found: null };
  } catch (err) {
    return { error: `pulls response parse failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * The outcome of opening (or re-using) the flush PR.
 *
 * `armed` is deliberately part of the SUCCESS shape: the PR exists either way, and whether
 * auto-merge could be armed on it is a separate fact the caller needs in order to say
 * something useful. See the arming block below for why it is not an error.
 */
export interface OpenedPR {
  readonly number: number;
  readonly url: string;
  readonly reused: boolean;
  /** Whether squash auto-merge was armed. False means the PR is open and waiting on a merger. */
  readonly armed: boolean;
  /** Why arming failed, when `armed` is false. */
  readonly armError?: string;
}

export const ARMING_DISABLED =
  "auto-merge arming is opt-in and this step did not opt in (set ZETA_FLUSH_ARM_AUTOMERGE=1 on the step env); enablePullRequestAutoMerge is GraphQL-only, so the default stays off and something else must merge this PR";

/**
 * Whether to attempt `gh pr merge --auto` at all. OPT-IN, and off unless a step opts in.
 *
 * THE DEFAULT IS STILL OFF; WHAT CHANGED IS WHO OPTS IN. As of 2026-08-26 the twelve
 * automated flush lanes set `ZETA_FLUSH_ARM_AUTOMERGE: "1"` on the flush step's own `env:`
 * (budget-snapshot, context-cost-trend, drift-dashboard, drift-sweep, lockfile-healer,
 * manifesto-citation-snapshot, pr-archive-on-merge, proof-closure-drift, search-index,
 * society-heartbeat, tick-metrics, zetadb-scheduled-node). `agent-heartbeat.yml`
 * deliberately does NOT: it arms in its own "Arm heartbeat PR auto-merge" step, which
 * carries a PAT -> GITHUB_TOKEN degradation ladder this module has no equivalent for, and
 * opting in there would spend a second GraphQL call to re-arm what is already armed.
 *
 * THE DECISION. Authorized by Aaron (human maintainer) 2026-08-26 -- *"yes this should be
 * okay, it resets once an hour anyways"* -- on this evidence: he rotated
 * `ZETA_PR_ARCHIVE_TOKEN` at 2026-08-26T19:54Z with permissions derived from a measured
 * audit of all 15 lanes that use it, and roughly 60 lane PRs a day were sitting unarmed,
 * each waiting on a human to arm it by hand.
 *
 * Three reasons stood against arming. Reason 1 is retired; 2 and 3 are ACCEPTED COSTS, not
 * deletions -- they are still true, and they are why the default remains off:
 *  1. RETIRED (2026-08-26). "The scoped flush PAT cannot call the mutation --
 *     `GraphQL: Resource not accessible by personal access token (enablePullRequestAutoMerge)`
 *     on every society-heartbeat run." The rotation above was the credential change this
 *     asked for. NOTE THE HONEST LIMIT: retired on the rotation, not yet on a green arm --
 *     nobody had observed the new token complete the mutation when the flag was flipped. If
 *     that exact GraphQL error reappears in a lane log, the token still lacks the scope and
 *     this reason is live again.
 *  2. ACCEPTED. IT IS THE EXPENSIVE API. `enablePullRequestAutoMerge` is GraphQL-ONLY --
 *     there is no REST equivalent -- and GraphQL is the budget that actually rate-limits
 *     this repo (measured 2026-08-14: GraphQL 1147/5000 points vs REST 33/5000 requests).
 *     Accepted on two grounds: the quota resets hourly, and budget spent on a call that
 *     SUCCEEDS buys a merge, where budget spent on one that has never succeeded bought
 *     nothing. If GraphQL exhaustion starts costing lanes, this is the first knob to turn
 *     back off, and turning it off is per-step.
 *  3. ACCEPTED. IT IS NOT THE JOB. The flush has already fully succeeded by the time arming
 *     is attempted; see armOutcome, whose contract is unchanged -- a failed arm never
 *     destroys a successful PR, and the caller still decides whether unarmed is a warning.
 *     Tidiness, weighed against ~60 hand-arms a day, and outweighed.
 */
export function armingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ZETA_FLUSH_ARM_AUTOMERGE === "1";
}

/**
 * Decide the outcome of the arming attempt. Pure, so the contract has a falsifier.
 *
 * THE CONTRACT: a failed arm NEVER destroys a successful PR. Before 2026-08-14 this branch
 * returned { error, code: 3 } and dropped `prNumber` on the floor, so a completed flush --
 * branch pushed, PR open -- was reported as a total failure. Both telemetry lanes were red on
 * every run because of it (society-heartbeat: `arm auto-merge failed (PR #10397 reused):
 * GraphQL: Resource not accessible by personal access token (enablePullRequestAutoMerge)`,
 * exit 3). The scoped PAT does not carry that mutation; granting it is a gated credential
 * change, and a successful flush should not have been reporting failure regardless.
 *
 * The returned value is the NEUTRAL FACT (`armed`), not a verdict: callers decide whether an
 * unarmed PR is a warning or an error. That split is the same discipline as
 * .claude/rules/dual-use-detection-is-neutral-oracle-decides.md.
 */
export function armOutcome(
  pr: { readonly number: number; readonly url: string; readonly reused: boolean },
  armStatus: number,
  armMessage: string,
): OpenedPR {
  if (armStatus === 0) return { ...pr, armed: true };
  return { ...pr, armed: false, armError: armMessage.trim() };
}

/**
 * The refusal that replaced the `||` chains in `.github/workflows/`.
 *
 * Every telemetry lane used to hand this function
 * `${{ secrets.ZETA_TELEMETRY_FLUSH_TOKEN || secrets.ZETA_PR_ARCHIVE_TOKEN || secrets.GITHUB_TOKEN }}`.
 * That expression selects on a secret being EMPTY, so an absent PR-create credential was
 * silently replaced by one carrying DIFFERENT authority — and the lane then failed further
 * downstream under an error naming the wrong subject. Worse, the GITHUB_TOKEN rung trips
 * GitHub's recursion guard (actions taken with it do not trigger other workflows), so a
 * degraded lane also stopped producing the events downstream jobs wait on, silently.
 *
 * PR creation is the one role with no substitute here: the enterprise forbids the Actions
 * identity from creating pull requests at all. So an empty credential is refused BY NAME,
 * once, at the one place all eleven flush lanes funnel through. The payload is already
 * parked on the staging branch by the time this runs — nothing is lost by refusing.
 */
export const PR_CREATE_CREDENTIAL_ABSENT =
  "PR-create credential absent: GH_TOKEN is empty. This is the PR-CREATE role and it has no " +
  "substitute — the enterprise forbids the Actions identity from creating pull requests, and " +
  "the branch-push credential (ZETA_TELEMETRY_FLUSH_TOKEN) carries different authority. " +
  "FIX: set repository secret ZETA_PR_ARCHIVE_TOKEN on Lucent-Financial-Group/Zeta to a " +
  "fine-grained PAT with 'Pull requests: read and write' + 'Contents: read and write' + " +
  "'Metadata: read', and pass it as GH_TOKEN on the step. Role table: " +
  "docs/security/2026-08-17-society-heartbeat-token-boundary-and-gate-start-failure.md";

/** True when the process holds SOME forge credential for `gh`. Pure, so it has a falsifier. */
export function hasPrCreateCredential(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env["GH_TOKEN"] ?? env["GITHUB_TOKEN"] ?? "").trim() !== "";
}

export function openMergePR(
  repo: string,
  head: string,
  base: string,
  title: string,
  body: string,
  env: NodeJS.ProcessEnv = process.env,
): { readonly ok: OpenedPR } | { readonly error: string; readonly code: 3 } {
  if (!hasPrCreateCredential(env)) {
    return { error: PR_CREATE_CREDENTIAL_ABSENT, code: 3 };
  }
  // Idempotency: re-use existing open PR if one is already open head→base
  const existing = findExistingPR(repo, head, base);
  if ("error" in existing) {
    return { error: existing.error, code: 3 };
  }
  let prNumber: number;
  let prUrl: string;
  let reused = false;
  if (existing.found) {
    prNumber = existing.found.number;
    prUrl = existing.found.url;
    reused = true;
  } else {
    const createResult = gh(
      ["api", "-X", "POST", `repos/${repo}/pulls`, "--input", "-"],
      JSON.stringify({ title, body, head, base }),
    );
    if (createResult.status !== 0) {
      return { error: `PR create failed: ${createResult.stderr || createResult.stdout}`, code: 3 };
    }
    try {
      const parsed = JSON.parse(createResult.stdout);
      prNumber = parsed.number;
      prUrl = parsed.html_url;
    } catch (err) {
      return { error: `PR-create response parse failed: ${err instanceof Error ? err.message : String(err)}`, code: 3 };
    }
  }
  // Arm auto-merge with squash via gh CLI (GraphQL under the hood).
  // Safe to re-arm on already-armed PRs (idempotent).
  //
  // ARMING IS AN OPTIMISATION, NOT THE JOB, so its failure is REPORTED and never collapses
  // the successful PR into an error (2026-08-14). Before this, a failed arm returned
  // { error, code: 3 } and threw away `prNumber` -- the branch was pushed, the PR was open,
  // and the caller still exited non-zero with the PR number nowhere in the result. Live for
  // both telemetry lanes:
  //   society-heartbeat, every run:  flush-via-staging: arm auto-merge failed (PR #10397
  //     reused): GraphQL: Resource not accessible by personal access token
  //     (enablePullRequestAutoMerge)   -> exit 3
  // The scoped PAT (ZETA_TELEMETRY_FLUSH_TOKEN) simply does not carry that GraphQL mutation.
  // Granting it is a credential change and therefore gated on the human maintainer; making a
  // successful flush report success is not.
  //
  // The result stays TRUTHFUL rather than forgiving: `armed` is the neutral fact, and the
  // caller decides the policy (a warning here, a hard failure elsewhere if some lane ever
  // needs one). Swallowing it silently would be the other failure -- an unarmed PR merges
  // only if something else merges it, so a green tick that quietly queues PRs forever is
  // exactly the class this repo keeps rediscovering.
  if (!armingEnabled(env)) {
    return {
      ok: {
        number: prNumber,
        url: prUrl,
        reused,
        armed: false,
        armError: ARMING_DISABLED,
      },
    };
  }
  const armResult = gh(["pr", "merge", String(prNumber), "--auto", "--squash", "--repo", repo]);
  return {
    ok: armOutcome({ number: prNumber, url: prUrl, reused }, armResult.status, armResult.stderr || armResult.stdout),
  };
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const parsed = parseArgs(argv);
  if ("error" in parsed) {
    console.error(`merge-heartbeats-to-main: ${parsed.error}`);
    return 2;
  }
  const ts = new Date().toISOString();
  if (parsed.dryRun) {
    console.log(
      `DRY RUN — would check ${parsed.base}..${parsed.head} on ${parsed.repo}; if behind, open PR + arm squash auto-merge`,
    );
    return 0;
  }
  const upToDate = isUpToDate(parsed.repo, parsed.base, parsed.head);
  if (typeof upToDate === "object" && "error" in upToDate) {
    console.error(`merge-heartbeats-to-main: ${upToDate.error}`);
    return 3;
  }
  if (upToDate === true) {
    const outputError = emitWorkflowOutput("skip=true\n");
    if (outputError) {
      console.error(`merge-heartbeats-to-main: ${outputError.error}`);
      return 3;
    }
    console.log(`up-to-date: ${parsed.base} already contains ${parsed.head}`);
    return 4;
  }
  const sourceSha = parsed.sourceSha ? { ok: parsed.sourceSha } : resolveHeadSha(parsed.repo, parsed.head);
  if ("error" in sourceSha) {
    console.error(`merge-heartbeats-to-main: ${sourceSha.error}`);
    return 3;
  }
  const snapshot = heartbeatSnapshot(parsed.head, sourceSha.ok);
  if ("error" in snapshot) {
    console.error(`merge-heartbeats-to-main: ${snapshot.error}`);
    return 3;
  }
  const verified = verifySnapshotRef(parsed.repo, snapshot.ok);
  if ("error" in verified) {
    console.error(`merge-heartbeats-to-main: ${verified.error}`);
    return 3;
  }
  const snapshotUpToDate = isUpToDate(parsed.repo, parsed.base, snapshot.ok.snapshotRef);
  if (typeof snapshotUpToDate === "object" && "error" in snapshotUpToDate) {
    console.error(`merge-heartbeats-to-main: ${snapshotUpToDate.error}`);
    return 3;
  }
  if (snapshotUpToDate === true) {
    const outputError = emitWorkflowOutput("skip=true\n");
    if (outputError) {
      console.error(`merge-heartbeats-to-main: ${outputError.error}`);
      return 3;
    }
    console.log(`up-to-date: ${parsed.base} already contains immutable ${snapshot.ok.snapshotRef}`);
    return 4;
  }
  // The batch marker identifies the automation lane without bypassing review. Tick branches can
  // carry source and repair commits as well as generated observations, so telemetry-only review
  // exemptions would make a false claim about the PR's contents.
  const title = heartbeatMergePrTitle(parsed.base, ts);
  const body = heartbeatMergePrBody(parsed.base, ts, credentialLogin());
  console.log(`verified immutable snapshot ${snapshot.ok.snapshotRef} at ${snapshot.ok.sourceSha}`);
  console.log(`opening PR ${snapshot.ok.snapshotRef} → ${parsed.base} on ${parsed.repo}...`);
  const result = openMergePR(parsed.repo, snapshot.ok.snapshotRef, parsed.base, title, body);
  if ("error" in result) {
    console.error(`merge-heartbeats-to-main: ${result.error}`);
    return result.code;
  }
  const outputError = emitWorkflowOutput(heartbeatSnapshotOutput(snapshot.ok, result.ok.number));
  if (outputError) {
    console.error(`merge-heartbeats-to-main: ${outputError.error}`);
    return 3;
  }
  const what = result.ok.reused ? "re-used" : "opened";
  if (!result.ok.armed) {
    // Loud on purpose. The flush SUCCEEDED and the PR is open, but nothing will merge it on
    // its own, so a quiet exit-0 here would queue PRs forever -- which is how #10397 sat
    // open while the workflow reported a hard failure for an unrelated-looking reason.
    console.warn(
      `::warning title=Telemetry flush PR is open but NOT auto-merged::PR #${String(result.ok.number)} ` +
        `(${result.ok.url}) ${what}; arming auto-merge failed and something must merge it. ` +
        `Cause: ${result.ok.armError ?? "unknown"}`,
    );
    console.log(`${what}: PR #${String(result.ok.number)} (${result.ok.url}); auto-merge NOT armed`);
    return 0;
  }
  console.log(`${what}: PR #${String(result.ok.number)} (${result.ok.url}); auto-merge re-armed (squash)`);
  return 0;
}

if (import.meta.main) {
  main().then((code) => process.exit(code));
}
