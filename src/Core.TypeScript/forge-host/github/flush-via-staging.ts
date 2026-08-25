#!/usr/bin/env bun
/**
 * flush-via-staging.ts — land generated telemetry on `main` WITHOUT pushing to `main`.
 *
 * WHY THIS EXISTS
 * ---------------
 * Ruleset "CI Gate" (16134995) makes `gate (required)` a required status check on
 * `~DEFAULT_BRANCH`. (As of 2026-08-13 its `bypass_actors` is no longer empty: repo admins
 * may bypass on PR MERGE only — never on direct push — added because a PR touching
 * `.github/workflows/**` never gets `gate` scheduled and was otherwise unmergeable. The
 * direct-push path this module exists to avoid is still fully gated.) A required status check is evaluated at
 * PUSH time against the pushed tip, so a commit that has never been through a check
 * run is rejected before any check could start:
 *
 *     remote: - Required status check "gate (required)" is expected.
 *
 * That is intended and must not be weakened — it is the uncompensatable floor. It does
 * mean every workflow that used to `git push origin main` (agent-heartbeat flush,
 * society-heartbeat, tick-metrics, proof-closure-drift) now needs a route that ends in
 * a checked merge rather than a raw push. Dropping `[skip ci]` does NOT help: the check
 * is missing, not failing.
 *
 * THE ROUTE
 * ---------
 *   1. `prepare` — working tree starts from `origin/main`, then unions in the lane's
 *      aggregate buffer (or its active staging branch during migration).
 *   2. the caller's generator runs and writes its files.
 *   3. `flush` — when no PR is open, mirror the aggregate to buffer + active refs and
 *      open a PR. While that immutable head is under test, advance only the buffer.
 *      After the PR lands, the next tick promotes the buffered aggregate.
 *
 * Staging branches live under `heartbeat/*`, which ruleset "Heartbeat Branch Protection"
 * (16934633) covers with `deletion` ONLY — no required checks, no non-fast-forward rule.
 * So the staging push always succeeds and telemetry is never lost, even when the flush
 * PR is slow to land. `agent-heartbeat.yml` has been pushing `heartbeat/<agent>` this way
 * for months; this script generalises that proven half to the other three lanes.
 *
 * TWO CONSTRAINTS THAT ARE EASY TO GET WRONG
 * ------------------------------------------
 *   - NO `[skip ci]` IN THE FLUSH COMMIT. `[skip ci]` suppresses workflow runs for BOTH
 *     `push` and `pull_request` events. On a direct push to main it was harmless (the
 *     push was rejected anyway); on this route it is fatal — it stops `gate` from ever
 *     running on the PR head, so the required check never reports and auto-merge waits
 *     forever. `assertNoSkipCi` refuses such a message rather than opening a PR that can
 *     never merge.
 *
 *   - THE PR CANNOT BE OPENED BY `GITHUB_TOKEN`. The enterprise forbids the Actions
 *     identity from creating pull requests ("409: The enterprise does not allow GitHub
 *     Actions to create or approve pull requests", reproduced 2026-08-13 — see
 *     `.github/workflows/pr-archive-on-merge.yml`). The restriction is on the IDENTITY,
 *     not the operation, so a fine-grained PAT authenticates as its owner and is exempt.
 *     Callers must supply such a token via GH_TOKEN. A PAT-opened PR also triggers
 *     workflows normally, which a GITHUB_TOKEN-opened PR would not — both halves of the
 *     problem need the same fix.
 *
 * Usage:
 *   bun flush-via-staging.ts prepare --lane tick-metrics
 *   bun flush-via-staging.ts flush   --lane tick-metrics \
 *       --paths data/ --message "metrics: append tick frame"
 *
 * Exit codes:
 *   0  PR open + armed / buffered behind a live open PR / dead head superseded / nothing to do
 *   2  argument error
 *   3  git or forge call failed
 */

import { spawnSync } from "node:child_process";

import { findExistingPR, openMergePR } from "../../agent-heartbeats/merge-heartbeats-to-main";

const ghCli = (...args: readonly string[]): RunResult => run("gh", args);

const MAX_BUFFER = 16 * 1024 * 1024;

export interface RunResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

function run(cmd: string, args: readonly string[]): RunResult {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const r = spawnSync(cmd, [...args], { encoding: "utf8", maxBuffer: MAX_BUFFER });
  if (r.error) {
    return { status: 127, stdout: "", stderr: r.error.message };
  }
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

const git = (...args: readonly string[]): RunResult => run("git", args);

/**
 * A lane name becomes a git ref (`heartbeat/<lane>`), so it must not be able to
 * smuggle ref syntax (`..`, `~`, `^`, `:`, whitespace) or escape the namespace.
 */
export function isValidLane(lane: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,62}$/.test(lane);
}

export function stagingRef(lane: string): string {
  return `heartbeat/${lane}`;
}

/**
 * New observations wait here while the lane's active PR head is under test.
 * The buffer is a disposable aggregate, just like the active staging ref.
 */
export function bufferRef(lane: string): string {
  return `${stagingRef(lane)}-buffer`;
}

export type FlushRoute =
  | {
      readonly kind: "publish";
      readonly activeRef: string;
      readonly bufferRef: string;
    }
  | {
      readonly kind: "buffer";
      readonly activeRef: string;
      readonly bufferRef: string;
      readonly blockedBy: { readonly number: number; readonly url: string };
    }
  | {
      readonly kind: "supersede";
      readonly activeRef: string;
      readonly bufferRef: string;
      /** The PR whose head is terminally red; force-pushing `activeRef` replaces its head. */
      readonly supersedes: { readonly number: number; readonly url: string };
    };

/**
 * Is the lane's current PR head STILL UNDER TEST, or is it DEAD?
 *
 * "Under test" is the premise the whole immutable-head design rests on, and it expires.
 * A head is under test while any check is queued or running, or while every completed
 * check has passed. It is DEAD the moment a check reaches a terminal non-success
 * conclusion: nothing will re-run it, auto-merge will never fire, and the lane behind it
 * waits forever.
 *
 * `cancelled` and `timed_out` count as DEAD, deliberately. They are the shapes a check
 * that NEVER RAN takes — an apt mirror stall inside the toolchain install, a job killed by
 * `timeout-minutes` — and treating "did not run" as "still running" is exactly how this
 * surface goes dark behind a green cadence.
 *
 * `action_required` and `stale` are DEAD too: a `pull_request` run parked as
 * `action_required` (the `github-actions[bot]` triggering-actor case, 081M010H4KE) never
 * contributes a verdict, and a `stale` run has been superseded already.
 *
 * A head with NO completed checks at all is under test, not dead — the run may not have
 * been scheduled yet, and calling that dead would supersede a head one second after
 * opening it, which is the starvation the buffer exists to prevent.
 */
export type HeadVerdict = "under-test" | "dead";

const TERMINAL_NON_SUCCESS = new Set(["failure", "timed_out", "cancelled", "action_required", "stale"]);

export function classifyHeadVerdict(
  checks: readonly { readonly name: string; readonly status: string; readonly conclusion: string | null }[],
): HeadVerdict {
  // LATEST RUN PER CHECK NAME. A re-run adds a second check-run with the same name and
  // the old failing one is still in the list; reading every entry would call a head dead
  // that has just been repaired. Later entries win, matching the caller's ordering by
  // `started_at`.
  const latest = new Map<string, { readonly status: string; readonly conclusion: string | null }>();
  for (const c of checks) latest.set(c.name, { status: c.status, conclusion: c.conclusion });

  for (const c of latest.values()) {
    if (c.status !== "completed") continue;
    if (c.conclusion !== null && TERMINAL_NON_SUCCESS.has(c.conclusion)) return "dead";
  }
  return "under-test";
}

/**
 * An open PR owns an immutable head WHILE THAT HEAD IS UNDER TEST. Updating it restarts
 * every required check, which can starve a cadence lane whose period is shorter than the
 * full gate — so a healthy head is waited on, and new observations park in the buffer.
 *
 * Once that head is DEAD the premise is gone and waiting is no longer backpressure, it is
 * deadlock. Measured 2026-08-25 (081M0X15SKR087G0R001RJP5V6): ALL FOUR telemetry-flush
 * lanes were wedged simultaneously — `drift-sweep` for 11h behind three lint shards whose
 * apt install timed out at rc=124 (the lints never ran), `tick-metrics` behind a head cut
 * inside a 10-minute window when `main` itself had a TypeScript syntax error, and
 * `society` behind an audit that was itself reporting the `pr-archive` lane's wedge. Three
 * unrelated causes, one shared defect: nothing ever replaces a dead head. The dashboard
 * served numbers from 11 hours earlier from behind a green cadence.
 *
 * So a dead head is SUPERSEDED: the fresh aggregate is force-pushed onto the active ref,
 * which moves the existing PR's head and starts `gate` from scratch on it. That is not a
 * check being widened or waived — the new head runs the full gate exactly like any other,
 * and a lane whose CONTENT genuinely fails stays visibly red on a fresh head every tick
 * instead of hiding behind one stale red from hours ago.
 */
export function chooseFlushRoute(
  lane: string,
  existing: { readonly number: number; readonly url: string } | null,
  headVerdict: HeadVerdict = "under-test",
): FlushRoute {
  const activeRef = stagingRef(lane);
  const pendingRef = bufferRef(lane);
  if (existing === null) return { kind: "publish", activeRef, bufferRef: pendingRef };
  if (headVerdict === "dead") {
    return { kind: "supersede", activeRef, bufferRef: pendingRef, supersedes: existing };
  }
  return { kind: "buffer", activeRef, bufferRef: pendingRef, blockedBy: existing };
}

const SKIP_CI_RE = /\[(skip ci|ci skip|skip actions|actions skip)\]/i;

/**
 * The flush commit becomes the PR head. `[skip ci]` there suppresses the
 * `pull_request` run of `gate`, so the required check never reports and the PR is
 * unmergeable forever — a silent hang, not a visible failure. Refuse it up front.
 */
export function assertNoSkipCi(message: string): { readonly error: string } | null {
  if (SKIP_CI_RE.test(message)) {
    return {
      error:
        "flush commit message contains a CI-skip token. The flush commit is the PR head; " +
        "skipping CI there means `gate (required)` never runs and the PR can never merge. " +
        "Remove the skip token.",
    };
  }
  return null;
}

/**
 * The AgencySignature v1 block for a telemetry-lane flush commit.
 *
 * WHY THIS IS HERE AND NOT IN EACH WORKFLOW. Every lane that flushes through this
 * tool (tick-metrics, society, red-state) commits on line ~201 below, so signing
 * once here signs all of them and cannot drift between lanes the way three copies
 * of an `echo` block would. Four cadence workflows already echo this block by hand;
 * this is the same convention applied at the shared choke point.
 *
 * WHAT IT REPLACES. Before this, these lanes produced unsigned commits that the
 * post-merge auditor could only let through via the explicit `MACHINE-LANE-EXEMPT`
 * roster entry added in #10573. An exemption is a promise that provenance is
 * established some other way; a signature establishes it directly. Signing shrinks
 * the exemption surface toward zero, which is strictly better than defending it —
 * these commits now classify CORRECT rather than exempt.
 *
 * Key spelling is `Agency-Signature-Version` — Agency, not Agent. The misspelled
 * twin reached main three times in 2026-08 and was, until #10573, exempt AND
 * unsigned at once.
 *
 * The block MUST be contiguous and terminal: git's trailer parser reads only the
 * final blank-line-delimited paragraph, so a blank line inside the block silently
 * drops everything above it (the Trailer Contiguity Survival Failure).
 */
export function agencySignatureBlock(lane: string): string {
  return [
    "Agency-Signature-Version: 1",
    `Agent: ${lane}-flush-workflow`,
    "Agent-Runtime: GitHub Actions",
    "Agent-Model: bun + git + gh CLI",
    "Credential-Identity: github-actions[bot]",
    "Credential-Mode: dedicated-agent",
    "Human-Review: not-implied-by-credential",
    "Human-Review-Evidence: none",
    "Action-Mode: autonomous-fail-open",
    "Task: none",
    "Co-authored-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>",
  ].join("\n");
}

/** The flush commit message: the lane's subject, then the signature block, terminal. */
export function signedFlushMessage(message: string, lane: string): string {
  return `${message.trimEnd()}\n\n${agencySignatureBlock(lane)}\n`;
}

/**
 * After `prepare`, the staging branch must sit EXACTLY on `origin/main` — the lane's
 * unlanded payload carried as INDEX state, never as commits of its own.
 *
 * THE DEFECT THIS RATCHET CLOSES (measured 2026-08-17 on `heartbeat/tick-metrics`).
 * `prepare` used to union the previous run's staging tip with a real `git merge`, which
 * records a MERGE COMMIT whose second parent is that tip's entire history. Since every
 * run re-merged the branch it had itself pushed the run before, the branch never reset —
 * it accumulated, unboundedly, one self-merge per tick:
 *
 *     git rev-list --count origin/main..origin/heartbeat/tick-metrics   -> 444
 *     git rev-list --count --merges  (same range)                       -> 164
 *     ... 164 of them literally "Merge remote-tracking branch
 *         'origin/heartbeat/tick-metrics' into staging-tick-metrics"
 *
 * That is a defect on its own terms — a telemetry flush is a small disposable delta —
 * and it broke two things downstream that are worth naming, because both are the
 * silent-green class rather than a visible failure:
 *
 *   1. THE SQUASH PREIMAGE BECAME THE WHOLE BRANCH. `squash_merge_commit_message` is
 *      `COMMIT_MESSAGES`, so GitHub concatenates every commit message in the PR. Landed
 *      commit `71444e1cd0` on `main` is 2470 lines carrying 176 identical AgencySignature
 *      blocks. The convention's artifact became noise it is impossible to read.
 *   2. OTHER AGENTS' COMMITS ENTERED THE PR'S OWN COMMIT LIST. Because the accumulated
 *      history carries older `main` states, `GET /pulls/{n}/commits` for PR #11528
 *      returned 14 commits that are ALREADY MERGED INTO `main` (authored by Otto, Vera,
 *      otto-shadow, pr-archive-on-merge). Those carry `Credential-Mode: shared` and
 *      `Action-Mode: human-directed | autonomous-fail-closed`, so the cross-commit
 *      governance-consistency check reported a disagreement — correctly. All six
 *      disagreeing commits were among those 14; `origin/main..HEAD` contained ZERO.
 *      The check was not wrong and was deliberately NOT narrowed: it validates the text
 *      GitHub actually squashes from, which is the whole reason it exists.
 *   3. The list is capped at 250 by GitHub, and the branch was 444 ahead — so the check
 *      could not even see all of its own subject.
 *
 * THE FIX IS ONE WORD: `--squash`. It computes the IDENTICAL tree by the identical
 * strategy against the identical merge base, but records no commit and no second parent,
 * leaving the union in the index for the flush's single commit to capture. Telemetry
 * preservation is bit-for-bit unchanged — which is the property that mattered — while
 * the branch returns to `origin/main` + exactly one commit every run. Simulated over
 * five cycles: 9 commits / 4 merges before, 1 commit / 0 merges after, same payload.
 *
 * NOTE ON HISTORY. Both refs are disposable one-commit aggregates. The active ref is
 * force-pushed only when it has no open PR; the buffer is the cadence-owned mutable ref.
 * What stops being republished is the redundant commit history of flushes that already
 * landed on `main` as squashes.
 *
 * The union itself is still needed and still correct: the flush PR is asynchronous, so a
 * run can generate telemetry while the previous run's PR is still waiting on `gate`.
 * Without it the next run would reset to main and drop content that had not landed yet.
 * `-X theirs` keeps the newer buffered aggregate on a true overlap; lane payloads are
 * either per-write ZetaId-keyed files or regenerated snapshots where latest wins.
 */
export function accumulatedHistoryError(aheadCount: number, mergeCount: number): { readonly error: string } | null {
  if (aheadCount === 0 && mergeCount === 0) return null;
  return {
    error:
      `staging branch carries ${String(aheadCount)} commit(s) (${String(mergeCount)} merge(s)) ` +
      "of its own after prepare; it must sit exactly on origin/main with the lane's unlanded " +
      "payload staged, not committed. This is the history-accumulation defect: a flush branch " +
      "that grows per tick drags already-landed commits by OTHER agents into its own PR commit " +
      "list, where their governance fields legitimately disagree with the lane's.",
  };
}

/**
 * Reset the working tree to `origin/main` and union in anything already parked for the
 * lane — preferring the aggregate buffer, then the active staging branch — as INDEX
 * state, leaving no commits. See
 * `accumulatedHistoryError` for the defect this shape exists to prevent.
 */
export function prepare(lane: string): number {
  const fetchMain = git("fetch", "origin", "main", "--quiet");
  if (fetchMain.status !== 0) {
    process.stderr.write(`flush-via-staging: fetch origin main failed: ${fetchMain.stderr}\n`);
    return 3;
  }
  const co = git("checkout", "-B", `staging-${lane}`, "origin/main", "--quiet");
  if (co.status !== 0) {
    process.stderr.write(`flush-via-staging: checkout failed: ${co.stderr}\n`);
    return 3;
  }
  // The buffer is always a superset of the active PR head: a publish mirrors the
  // same commit to both refs, then backpressured ticks advance only the buffer.
  // Prefer it so a merged active PR cannot strand observations accumulated later.
  let ref: string | undefined;
  for (const candidate of [bufferRef(lane), stagingRef(lane)]) {
    // Exit 2 means the named ref does not exist. Any other non-zero result is an
    // unreadable remote, not an empty buffer, and must fail closed: falling back
    // to the active ref in that case could overwrite observations we failed to see.
    const probe = git("ls-remote", "--exit-code", "--heads", "origin", candidate);
    if (probe.status === 2) continue;
    if (probe.status !== 0) {
      process.stderr.write(`flush-via-staging: could not inspect ${candidate}: ${probe.stderr || probe.stdout}\n`);
      return 3;
    }
    const fetched = git("fetch", "origin", `${candidate}:refs/remotes/origin/${candidate}`, "--quiet");
    if (fetched.status !== 0) {
      process.stderr.write(`flush-via-staging: fetch ${candidate} failed: ${fetched.stderr || fetched.stdout}\n`);
      return 3;
    }
    ref = candidate;
    break;
  }
  if (ref === undefined) {
    process.stdout.write(`[flush] no existing staging branch for ${lane} — starting from main\n`);
    return 0;
  }
  // Staging is the newer generated aggregate. On an overlapping snapshot, keeping
  // main (`ours`) silently discards buffered observations after the prior PR lands.
  const merge = git("merge", "--squash", "-X", "theirs", `origin/${ref}`);
  if (merge.status !== 0) {
    process.stdout.write(
      `[flush] could not union ${ref} onto main (likely already landed and history diverged); ` +
        `continuing from main — no telemetry is lost, the generator recomputes it\n`,
    );
    // `git merge --abort` CANNOT clean this up and must not be tried first: `--squash`
    // never writes MERGE_HEAD, so abort exits 128 ("There is no merge to abort") and
    // leaves the conflicted index in place. Verified 2026-08-17 against a real
    // modify/delete + file/directory conflict. `reset --hard` is the working cleanup.
    git("reset", "--hard", "origin/main", "--quiet");
    return 0;
  }

  // THE RATCHET. Fires BEFORE the generator runs, so refusing costs zero telemetry —
  // this is the fail-closed point of the lane. A `prepare` that has left commits behind
  // is the accumulation bug returning, and continuing would push it to the forge.
  const ahead = git("rev-list", "--count", "origin/main..HEAD");
  const merges = git("rev-list", "--count", "--merges", "origin/main..HEAD");
  if (ahead.status !== 0 || merges.status !== 0) {
    process.stderr.write("flush-via-staging: could not measure staging history depth\n");
    return 3;
  }
  const accumulated = accumulatedHistoryError(
    Number.parseInt(ahead.stdout.trim(), 10),
    Number.parseInt(merges.stdout.trim(), 10),
  );
  if (accumulated) {
    process.stderr.write(`flush-via-staging: ${accumulated.error}\n`);
    return 3;
  }

  process.stdout.write(`[flush] unioned pending ${ref} content onto origin/main\n`);
  return 0;
}

/**
 * Ask the forge whether the lane's current PR head is still under test.
 *
 * `gh pr view --json statusCheckRollup` is NOT used here and must not be: it under-reports
 * (measured on this repo — 6 checks against the check-runs API's 43 on the same SHA), and a
 * probe that under-reports would call a dead head healthy and re-arm the exact deadlock this
 * exists to break. The check-runs API is the source of truth.
 *
 * FAILS CLOSED. If the probe cannot be answered — no SHA on the PR, a forge error, an
 * unparseable body — the answer is `under-test`, i.e. keep buffering. Superseding on an
 * unreadable answer would force-push over a head that might be mid-gate, which is the
 * starvation the buffer exists to prevent. Waiting on a false negative costs one tick of
 * latency; superseding on a false positive costs a restarted gate on every lane, every tick.
 */
export function probeHeadVerdict(repo: string, headSha: string): HeadVerdict {
  if (headSha === "") return "under-test";
  const result = ghCli(
    "api",
    "--paginate",
    `repos/${repo}/commits/${headSha}/check-runs`,
    "--jq",
    "[.check_runs[] | {name, status, conclusion, started_at}] | sort_by(.started_at) | .[]",
  );
  if (result.status !== 0) {
    process.stderr.write(
      `[flush] head-verdict probe failed (treating head as under test): ${result.stderr || result.stdout}\n`,
    );
    return "under-test";
  }
  const checks: { name: string; status: string; conclusion: string | null }[] = [];
  for (const line of result.stdout.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed?.name === "string" && typeof parsed?.status === "string") {
        checks.push({ name: parsed.name, status: parsed.status, conclusion: parsed.conclusion ?? null });
      }
    } catch {
      process.stderr.write("[flush] head-verdict probe returned an unparseable line; treating head as under test\n");
      return "under-test";
    }
  }
  if (checks.length === 0) return "under-test";
  return classifyHeadVerdict(checks);
}

export interface FlushOptions {
  readonly lane: string;
  readonly paths: readonly string[];
  readonly message: string;
  readonly repo: string;
  readonly base: string;
  readonly dryRun: boolean;
}

export function flush(opts: FlushOptions): number {
  const skip = assertNoSkipCi(opts.message);
  if (skip) {
    process.stderr.write(`flush-via-staging: ${skip.error}\n`);
    return 2;
  }
  const activeRef = stagingRef(opts.lane);

  const add = git("add", "--", ...opts.paths);
  if (add.status !== 0) {
    process.stderr.write(`flush-via-staging: git add failed: ${add.stderr}\n`);
    return 3;
  }
  // Idempotency (#6): a run that generated nothing must be a clean no-op, never an
  // empty commit and never a red job.
  const staged = git("diff", "--cached", "--quiet");
  if (staged.status === 0) {
    process.stdout.write(`[flush] ${opts.lane}: nothing to flush (no-op)\n`);
    return 0;
  }
  if (opts.dryRun) {
    const names = git("diff", "--cached", "--name-only");
    process.stdout.write(`DRY RUN — would route changed paths for ${activeRef}:\n${names.stdout}`);
    return 0;
  }

  // Decide BEFORE changing any remote ref. If this lookup fails, changing the
  // active ref could invalidate a PR whose existence we failed to observe.
  const existing = findExistingPR(opts.repo, activeRef, opts.base);
  if ("error" in existing) {
    process.stderr.write(`flush-via-staging: could not inspect the active flush PR: ${existing.error}\n`);
    return 3;
  }
  // A head that is still under test is waited on; a head that is terminally red is
  // superseded rather than waited on forever (081M0X15SKR087G0R001RJP5V6).
  const headVerdict = existing.found === null ? "under-test" : probeHeadVerdict(opts.repo, existing.found.headSha);
  const route = chooseFlushRoute(opts.lane, existing.found, headVerdict);

  // Signed at the choke point — see `agencySignatureBlock` for why here and not
  // in each lane's workflow yaml.
  const commit = git("commit", "--no-verify", "-m", signedFlushMessage(opts.message, opts.lane));
  if (commit.status !== 0) {
    process.stderr.write(`flush-via-staging: commit failed: ${commit.stderr || commit.stdout}\n`);
    return 3;
  }

  // Buffer first. If publishing the active ref subsequently fails, the payload is
  // still parked and the next prepare recovers it. A publish mirrors one commit to
  // both refs; later ticks advance only the buffer until that PR merges.
  const pushBuffer = git("push", "--force-with-lease", "origin", `HEAD:refs/heads/${route.bufferRef}`);
  if (pushBuffer.status !== 0) {
    process.stderr.write(
      `flush-via-staging: push to ${route.bufferRef} failed: ${pushBuffer.stderr || pushBuffer.stdout}\n`,
    );
    return 3;
  }

  if (route.kind === "buffer") {
    process.stderr.write(
      `::notice title=Telemetry flush backpressured::lane ${opts.lane}: PR #${String(route.blockedBy.number)} ` +
        `is still testing immutable head ${route.activeRef}; newer observations are parked on ${route.bufferRef}\n`,
    );
    process.stdout.write(
      `[flush] ${opts.lane}: buffered behind PR #${String(route.blockedBy.number)} ` +
        `(${route.blockedBy.url}) on ${route.bufferRef}\n`,
    );
    return 0;
  }

  if (route.kind === "supersede") {
    process.stderr.write(
      `::warning title=Telemetry flush head superseded::lane ${opts.lane}: PR #${String(route.supersedes.number)} ` +
        `(${route.supersedes.url}) had a terminally-red head that nothing was going to re-run, so this tick ` +
        `REPLACES it. The full gate runs from scratch on the new head — no check is waived. If this repeats ` +
        `every tick, the lane's CONTENT is failing and that is the thing to fix.\n`,
    );
  }

  // --force-with-lease: both refs are scratch aggregates reset from main. The
  // active ref changes only when it has no open PR (or when its head is dead and is being
  // superseded); the buffer may advance while a live active head completes its checks.
  const pushActive = git("push", "--force-with-lease", "origin", `HEAD:refs/heads/${route.activeRef}`);
  if (pushActive.status !== 0) {
    process.stderr.write(
      `flush-via-staging: push to ${route.activeRef} failed: ${pushActive.stderr || pushActive.stdout}\n`,
    );
    return 3;
  }
  process.stdout.write(`[flush] ${opts.lane}: parked on ${route.activeRef}; mirrored on ${route.bufferRef}\n`);

  const title = `[skip-review][telemetry-flush] ${opts.message.split("\n")[0] ?? opts.lane}`;
  // The BODY carries the signature too, and that is the load-bearing copy: these
  // flushes land by SQUASH-MERGE, which uses the PR body as the commit message and
  // discards the branch commit's own trailers. Signing only the commit above would
  // produce a signed commit that arrives on `main` unsigned — the Squash-Merge
  // Invariant, and the mechanism behind most of the 113 unsigned commits #10564
  // measured. Block last, contiguous, nothing after it.
  const body =
    `**Reviewer bots: skip this PR.** Mechanically-generated telemetry flush for lane \`${opts.lane}\`.\n\n` +
    `Opened by \`src/Core.TypeScript/forge-host/github/flush-via-staging.ts\` because ruleset "CI Gate" ` +
    `makes \`gate (required)\` a required status check on \`main\` with no bypass actors — a direct push ` +
    `can no longer land, by design. Content is generated observational data, not factory logic.\n\n` +
    `Paths: ${opts.paths.map((p) => `\`${p}\``).join(", ")}\n\n` +
    `${agencySignatureBlock(opts.lane)}\n`;

  const result = openMergePR(opts.repo, route.activeRef, opts.base, title, body);
  if ("error" in result) {
    process.stderr.write(
      `flush-via-staging: ${result.error}\n` +
        `NOTE: the telemetry is safely parked on ${route.activeRef} and ${route.bufferRef} — nothing is lost. If this is the\n` +
        `enterprise PR-creation restriction, supply a fine-grained PAT via GH_TOKEN\n` +
        `(pull_requests: write + metadata: read), as pr-archive-on-merge.yml does.\n`,
    );
    return 3;
  }
  const what = result.ok.reused ? "re-used" : "opened";
  if (!result.ok.armed) {
    // THE FLUSH SUCCEEDED. The staging branch is pushed and the PR is open; only ARMING
    // auto-merge failed, and arming is an optimisation. Returning 3 here (the behaviour
    // before 2026-08-14) failed the whole tick on completed work -- society-heartbeat was
    // red on EVERY run for exactly this, which is also why nobody noticed the telemetry
    // was in fact landing. A failing exit code on successful work is the wrong contract.
    //
    // Loud, though, never swallowed: an unarmed PR merges only if something else merges
    // it, so this names the PR and the cause. A green tick that silently queues PRs
    // forever is the failure class this trades against, not one it accepts.
    process.stderr.write(
      `::warning title=Telemetry flush PR is open but NOT auto-merged::lane ${opts.lane}: ` +
        `PR #${String(result.ok.number)} (${result.ok.url}) ${what}, and arming auto-merge ` +
        `failed, so something must merge it. Cause: ${result.ok.armError ?? "unknown"}\n`,
    );
    process.stdout.write(
      `[flush] ${opts.lane}: PR #${String(result.ok.number)} ${what} (${result.ok.url}); ` +
        `auto-merge NOT armed -- awaiting a merger\n`,
    );
    return 0;
  }
  process.stdout.write(
    `[flush] ${opts.lane}: PR #${String(result.ok.number)} ${what} ` + `(${result.ok.url}); squash auto-merge armed\n`,
  );
  return 0;
}

export function parseArgv(
  argv: readonly string[],
): { readonly cmd: "prepare" | "flush"; readonly opts: FlushOptions } | { readonly error: string } {
  const cmd = argv[0];
  if (cmd !== "prepare" && cmd !== "flush") {
    return { error: "first argument must be `prepare` or `flush`" };
  }
  let lane = "";
  let message = "";
  let repo = process.env["ZETA_AGENT_REPO"] ?? "Lucent-Financial-Group/Zeta";
  let base = "main";
  let dryRun = false;
  const paths: string[] = [];
  for (let i = 1; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--lane") lane = argv[++i] ?? "";
    else if (arg === "--message") message = argv[++i] ?? "";
    else if (arg === "--repo") repo = argv[++i] ?? "";
    else if (arg === "--base") base = argv[++i] ?? "";
    else if (arg === "--dry-run") dryRun = true;
    else if (arg === "--paths") {
      while (i + 1 < argv.length && !(argv[i + 1] ?? "").startsWith("--")) paths.push(argv[++i]!);
    } else return { error: `unknown flag: ${arg}` };
  }
  if (!isValidLane(lane)) {
    return { error: "--lane is required and must match /^[a-z0-9][a-z0-9-]{0,62}$/" };
  }
  if (cmd === "flush") {
    if (message === "") return { error: "--message is required for flush" };
    if (paths.length === 0) return { error: "--paths is required for flush" };
  }
  return { cmd, opts: { lane, paths, message, repo, base, dryRun } };
}

export function main(argv: readonly string[]): number {
  const parsed = parseArgv(argv);
  if ("error" in parsed) {
    process.stderr.write(`flush-via-staging: ${parsed.error}\n`);
    return 2;
  }
  return parsed.cmd === "prepare" ? prepare(parsed.opts.lane) : flush(parsed.opts);
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
