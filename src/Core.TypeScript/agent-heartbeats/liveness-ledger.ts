#!/usr/bin/env bun
/**
 * src/Core.TypeScript/agent-heartbeats/liveness-ledger.ts — the PR-free recording channel for
 * liveness observations.
 *
 * THE DEFECT THIS CLOSES.
 *
 * `heartbeat-liveness.yml` produces a verdict about whether the fleet is ticking. Until this
 * module existed that verdict was durable ONLY as a check-run annotation on an Actions run, and
 * an annotation has three properties that make it the wrong sink for this particular observation:
 *
 *   1. It lives inside the substrate being observed. If Actions is degraded — the exact condition
 *      the watchdog exists to report — the report degrades with it.
 *   2. It is written only when the run reaches the step that writes it. A run that dies in
 *      `Checkout` or `Setup bun` produces no annotation, and "no annotation" is indistinguishable
 *      from "nobody looked". An observation channel that cannot distinguish HEALTHY from
 *      NOT OBSERVING is the vacuity class: it looks like coverage and constrains nothing.
 *   3. It is not in git, so no reader with a clone can answer "when was the fleet last observed?"
 *      without an API call to the provider whose health is in question.
 *
 * And the recursion Aaron named: routing the observation to `main` through the flush PR would
 * make the report of a broken pipeline depend on that pipeline. **The observer must not depend on
 * the observed.** Same family as a retry loop probing over the transport it is saturating, and a
 * failure reporter that runs `bun` when the failing step is the one installing `bun`.
 *
 * WHAT THIS IS INSTEAD.
 *
 * An append-only ledger on a dedicated ref, `refs/heads/liveness/observations`, written by direct
 * push. Verified on 2026-08-27 against the live repository rulesets:
 *
 *   - `CI Gate` (required_status_checks) has `conditions.ref_name.include == ["~DEFAULT_BRANCH"]`.
 *     Its ONLY bypass actor is `RepositoryRole 5` with `bypass_mode: pull_request`, so nothing —
 *     admin included — pushes to `main` without a PR today.
 *   - `Branch Safety` (deletion, non_fast_forward) and `Default`: also `~DEFAULT_BRANCH` only.
 *   - `Heartbeat Branch Protection` (deletion) targets `refs/heads/heartbeat/*` only.
 *
 * So a `liveness/*` ref is reachable by direct push with the workflow's own scoped
 * `GITHUB_TOKEN`, requires no bypass actor, no ruleset change, and no credential that could reach
 * `main`. It is the mechanism `heartbeat/*` already uses, pointed at the observation layer.
 *
 * THE ORPHAN-REF CHOICE. The ledger's first commit has no parent and shares no history with
 * `main`. Three consequences, all wanted: a writer never has to fetch `main` to append (so the
 * recording path does not depend on `main` being fetchable), a reader fetches only the ledger's
 * own small history, and the ref can never be mistaken for a branch that is trying to merge.
 *
 * WHAT `main` WOULD HAVE BOUGHT, STATED HONESTLY. Exactly one thing: presence in the default
 * fetch refspec, hence discoverability without a reader instruction. That is recovered the way
 * this repo already recovers it for `heartbeat/*` — a fetch line in `CLAUDE.md`. Everything else
 * people mean by "on main" (durable, in git, no PR, readable from a clone, diffable, replayable)
 * is a property of being a git ref, not of being `main`.
 *
 * WHAT IT STILL DOES NOT BUY, ALSO STATED HONESTLY. This writer runs inside GitHub Actions, so a
 * total Actions outage stops the WRITING as well as the ticking. The ledger does not fix that —
 * nothing inside Actions can. What it fixes is that the gap becomes READABLE: because a record is
 * written on EVERY run including the healthy ones, a reader computes the age of the newest record
 * and gets a straight answer to "is anyone still observing?". `assessObserverContinuity` below is
 * that reader, and it is the whole reason the healthy-case write is mandatory rather than an
 * optimisation.
 */

import { spawnSync } from "node:child_process";

import {
  type FleetLivenessVerdict,
  type FleetTickObservation,
  type HeartbeatRunRecord,
  assessFleetLiveness,
  extractRuns,
  runsToObservations,
} from "./heartbeat-liveness";

/** Ref the ledger lives on. Deliberately NOT under `heartbeat/*` — see the module header. */
export const LEDGER_REF = "refs/heads/liveness/observations";

/** Branch name form of {@link LEDGER_REF}, for `git push origin HEAD:<branch>`. */
export const LEDGER_BRANCH = "liveness/observations";

/** Path in the ledger tree holding the newest observation, for a one-file read. */
export const LATEST_PATH = "latest.json";

/**
 * Schema tag carried by every record.
 *
 * Versioned in the DATA, not only in the code, because the reader of a five-year-old ledger entry
 * is not necessarily running the code that wrote it — and a record whose shape you must infer is
 * a record you are guessing at.
 */
export const OBSERVATION_SCHEMA = "zeta.liveness.observation/1";

/**
 * How the fleet looked at one moment, as recorded by one observer run.
 *
 * `outcome` deliberately has FOUR values, not two. `blind` is the one that carries this file's
 * whole argument: an observer that could not read its inputs must record that fact rather than
 * record nothing, because recording nothing is what an annotation-only channel already did and is
 * exactly what makes "healthy" and "not observing" look the same.
 */
export interface LivenessObservation {
  readonly schema: typeof OBSERVATION_SCHEMA;
  /** ISO-8601 instant the observation was taken. */
  readonly observedAt: string;
  /** Which observer produced it, in the same `Agent-Runtime:` vocabulary the lanes use. */
  readonly observer: string;
  /** Provider run identifier, when there is one. `null` off-Actions — never invented. */
  readonly observerRunId: string | null;
  readonly outcome: LivenessOutcome;
  readonly thresholdMinutes: number;
  /** The verdict sentence, verbatim, so the record stands alone without re-running anything. */
  readonly summary: string;
  readonly sources: readonly ObservedSource[];
  readonly consideredObservations: number;
}

export type LivenessOutcome =
  /** Every known tick source is inside the threshold. */
  | "alive"
  /** At least one source is fresh, at least one is stale. Alive, and still a finding. */
  | "degraded"
  /** No source is inside the threshold. This is the alarm. */
  | "not-alive"
  /** The observer could not read its own inputs. NOT a verdict about the fleet. */
  | "blind";

export interface ObservedSource {
  readonly source: string;
  readonly lastAt: string;
  readonly ageMinutes: number;
  readonly fresh: boolean;
}

/**
 * Map a fleet verdict onto the recorded outcome.
 *
 * `degraded` is split out from `alive` on purpose. `assessFleetLiveness` returns `alive: true`
 * the moment ONE source is fresh, which is correct for the alarm but flattens a real distinction:
 * a fleet running on its last source looks identical, in a boolean, to a fleet running on all of
 * them. Recording the flattened bit would make the ledger unable to show a slow collapse, which
 * is the failure shape a level-triggered record is best placed to catch.
 */
export function classifyOutcome(verdict: FleetLivenessVerdict): Exclude<LivenessOutcome, "blind"> {
  if (!verdict.alive) return "not-alive";
  return verdict.sources.some((s) => !s.fresh) ? "degraded" : "alive";
}

export interface BuildObservationInput {
  readonly now: Date;
  readonly observer: string;
  readonly observerRunId?: string | null;
  readonly thresholdMinutes: number;
  /** The verdict, when one could be computed. */
  readonly verdict?: FleetLivenessVerdict;
  /** Why no verdict could be computed. Required — and only permitted — when `verdict` is absent. */
  readonly blindReason?: string;
}

/**
 * Build the record.
 *
 * Throws when handed neither a verdict nor a reason. There is no third state: a record that says
 * nothing about the fleet AND nothing about why is worse than no record, because it occupies the
 * ledger slot that would otherwise read as a gap.
 */
export function buildObservation(input: BuildObservationInput): LivenessObservation {
  const { now, observer, thresholdMinutes, verdict, blindReason } = input;
  if (verdict === undefined && (blindReason === undefined || blindReason.trim() === "")) {
    throw new Error("buildObservation: needs either a verdict or a non-empty blindReason");
  }
  if (verdict !== undefined && blindReason !== undefined) {
    throw new Error("buildObservation: a verdict and a blindReason are mutually exclusive");
  }
  return {
    schema: OBSERVATION_SCHEMA,
    observedAt: now.toISOString(),
    observer,
    observerRunId: input.observerRunId ?? null,
    outcome: verdict === undefined ? "blind" : classifyOutcome(verdict),
    thresholdMinutes,
    summary:
      verdict === undefined
        ? `OBSERVER BLIND - no verdict could be computed: ${String(blindReason).trim()}`
        : verdict.summary,
    sources: verdict === undefined ? [] : verdict.sources.map(toObservedSource),
    consideredObservations: verdict === undefined ? 0 : verdict.consideredObservations,
  };
}

function toObservedSource(s: ObservedSource): ObservedSource {
  return { source: s.source, lastAt: s.lastAt, ageMinutes: s.ageMinutes, fresh: s.fresh };
}

/**
 * Compute the verdict from the raw inputs the workflow already fetches.
 *
 * The recorder recomputes rather than scraping `liveness.txt`, so the ledger and the alarm can
 * never disagree about what was observed: both are `assessFleetLiveness` over the same arrays.
 * Scraping the printed line would have introduced a second, weaker parser whose drift from the
 * verdict nothing would detect.
 */
export function verdictFromInputs(
  runsPayload: unknown,
  laneEvidence: readonly FleetTickObservation[],
  now: Date,
  thresholdMinutes: number,
): FleetLivenessVerdict {
  const runs: readonly HeartbeatRunRecord[] = extractRuns(runsPayload);
  return assessFleetLiveness([...runsToObservations(runs), ...laneEvidence], now, thresholdMinutes);
}

/** Day file an observation belongs in: `observations/YYYY-MM-DD.jsonl`, UTC. */
export function ledgerDayPath(observedAtIso: string): string {
  const at = new Date(observedAtIso);
  if (Number.isNaN(at.getTime())) throw new Error(`ledgerDayPath: unparseable timestamp ${observedAtIso}`);
  // UTC, always. A local-timezone day boundary would put two runs one minute apart into different
  // files on different runners — local time steering a shared artifact is the leak
  // `local-time-never-enters-the-shared-fold` forbids.
  return `observations/${at.toISOString().slice(0, 10)}.jsonl`;
}

/** Stable single-line JSON. Keys are emitted in a fixed order so a diff shows content, not churn. */
export function renderObservationLine(observation: LivenessObservation): string {
  return JSON.stringify({
    schema: observation.schema,
    observedAt: observation.observedAt,
    observer: observation.observer,
    observerRunId: observation.observerRunId,
    outcome: observation.outcome,
    thresholdMinutes: observation.thresholdMinutes,
    summary: observation.summary,
    consideredObservations: observation.consideredObservations,
    sources: observation.sources,
  });
}

/**
 * Identity of an observation for dedup purposes.
 *
 * A run is the unit: one observer run contributes exactly one record. Re-running the recorder in
 * the same run (a retried step, a re-dispatched job) must UPSERT, never append a second row —
 * discipline #6, idempotency, and the reason `assessObserverContinuity` can trust its own gaps.
 * When there is no run id the timestamp stands in, which is honest: two records a nanosecond
 * apart from an unidentified observer really are two observations.
 */
export function observationKey(observation: LivenessObservation): string {
  return `${observation.observer}${observation.observerRunId ?? observation.observedAt}`;
}

/**
 * Append (or upsert) one record into a day file's text.
 *
 * UNPARSEABLE EXISTING LINES ARE PRESERVED VERBATIM, not dropped. A parser that quietly discards
 * what it cannot read turns a corrupt ledger into a clean-looking one, which is the failure this
 * whole file exists to refuse. They survive the rewrite and stay visible to a human.
 */
export function appendObservation(existing: string | null, observation: LivenessObservation): string {
  const key = observationKey(observation);
  const kept: string[] = [];
  for (const line of (existing ?? "").split("\n")) {
    if (line.trim() === "") continue;
    let parsed: LivenessObservation | undefined;
    try {
      parsed = JSON.parse(line) as LivenessObservation;
    } catch {
      kept.push(line); // corrupt but preserved — see above
      continue;
    }
    if (typeof parsed?.observer === "string" && observationKey(parsed) === key) continue; // upsert
    kept.push(line);
  }
  kept.push(renderObservationLine(observation));
  return `${kept.join("\n")}\n`;
}

/** Records parsed out of a day file, with the unreadable ones COUNTED rather than hidden. */
export interface ParsedLedger {
  readonly observations: readonly LivenessObservation[];
  readonly unreadableLines: number;
}

export function parseLedger(text: string): ParsedLedger {
  const observations: LivenessObservation[] = [];
  let unreadableLines = 0;
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    try {
      const parsed = JSON.parse(line) as LivenessObservation;
      if (typeof parsed?.observedAt !== "string" || typeof parsed?.outcome !== "string") {
        unreadableLines += 1;
        continue;
      }
      observations.push(parsed);
    } catch {
      unreadableLines += 1;
    }
  }
  return { observations, unreadableLines };
}

/**
 * THE QUESTION AN ANNOTATION CHANNEL CANNOT ANSWER: is anyone still observing?
 *
 * Level-triggered, exactly like the watchdog it records for: it asks "how old is the newest
 * record?" rather than "did a record just land?". A dropped slot in the OBSERVER's own cron then
 * still yields the right answer, just later — where an edge check would miss the edge and go
 * quiet, reproducing the bug.
 *
 * Note what this measures and what it does not. It measures the OBSERVER, never the fleet. A
 * ledger that is fresh and full of `not-alive` means observation is working perfectly and the
 * fleet is down; a ledger that is stale means nobody knows anything about the fleet, which is a
 * strictly worse position and must never be reported as calm.
 */
export interface ObserverContinuityVerdict {
  readonly observing: boolean;
  readonly summary: string;
  readonly newestAt?: string;
  readonly ageMinutes?: number;
  readonly recordsConsidered: number;
  /** Newest record's outcome, when there is one — so a reader gets both facts from one call. */
  readonly newestOutcome?: LivenessOutcome;
}

export function assessObserverContinuity(
  records: readonly LivenessObservation[],
  now: Date,
  staleAfterMinutes: number,
): ObserverContinuityVerdict {
  if (records.length === 0) {
    // EMPTY IS AN ALARM, NOT A PASS — the same rule the fleet assessor already holds. A ledger
    // with no records is either a channel that has never worked or one that has stopped, and
    // both need a human.
    return {
      observing: false,
      summary: "the liveness ledger holds NO records at all — nothing has observed the fleet, or the channel is broken",
      recordsConsidered: 0,
    };
  }
  let newestMs = Number.NEGATIVE_INFINITY;
  let newest: LivenessObservation | undefined;
  for (const record of records) {
    const at = new Date(record.observedAt);
    // Unparseable drops the record rather than defaulting to now: a bad timestamp read as the
    // current time makes a dead observer look live, i.e. health nobody measured.
    if (Number.isNaN(at.getTime())) continue;
    if (at.getTime() > newestMs) {
      newestMs = at.getTime();
      newest = record;
    }
  }
  if (newest === undefined) {
    return {
      observing: false,
      summary: `none of the ${records.length} ledger records carries a parseable timestamp — the channel is writing, but unreadably`,
      recordsConsidered: records.length,
    };
  }
  // Clamped at zero: a future-dated record (runner clock skew) would otherwise yield a NEGATIVE
  // age that sails under every threshold and silences this permanently.
  const ageMinutes = Math.max(0, Math.floor((now.getTime() - newestMs) / 60_000));
  const observing = ageMinutes < staleAfterMinutes;
  return {
    observing,
    summary: observing
      ? `fleet last OBSERVED ${ageMinutes}min ago (threshold ${staleAfterMinutes}min); newest observation says: ${newest.outcome}`
      : `NOBODY HAS OBSERVED THE FLEET IN ${ageMinutes} MINUTES — newest ledger record ${newest.observedAt} (${newest.outcome}), threshold ${staleAfterMinutes}min`,
    newestAt: newest.observedAt,
    ageMinutes,
    recordsConsidered: records.length,
    newestOutcome: newest.outcome,
  };
}

/** Commit subject. Carries the outcome so `git log --oneline` alone is a usable read. */
export function renderCommitSubject(observation: LivenessObservation): string {
  return `liveness(${observation.outcome}): observed ${observation.observedAt}`;
}

/* ---------------------------------------------------------------------------------------------
 * GIT SIDE — injectable, so every refusal path is reachable from a test.
 * ------------------------------------------------------------------------------------------- */

export interface GitResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Injected git. Tests substitute a fake; nothing here shells out on its own. */
export type GitRunner = (args: readonly string[]) => GitResult;

/** The real thing, bound to a working directory. */
export const realGitRunner =
  (cwd: string): GitRunner =>
  (args) => {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const r = spawnSync("git", [...args], { cwd, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    return { status: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? r.error?.message ?? "" };
  };

/**
 * Stage and commit the ledger working tree.
 *
 * AN EMPTY STAGE IS A FAILURE HERE, and that is the opposite of the convention `agent-heartbeat.yml`
 * uses ("no new events to commit" + exit 0). The difference is justified: a heartbeat lane can
 * legitimately have nothing to say, but this recorder has just WRITTEN `latest.json` with a fresh
 * `observedAt`, so an empty stage means the write did not land. Succeeding there is precisely the
 * false-green shape — a run concluding `success` having committed nothing — that the module this
 * one supports was built to stop believing.
 */
export function commitLedger(git: GitRunner, messageFile: string): GitResult {
  const add = git(["add", "-A"]);
  if (add.status !== 0) return add;
  const staged = git(["diff", "--cached", "--quiet"]);
  if (staged.status === 0) {
    return { status: 1, stdout: "", stderr: "nothing staged after writing the observation — the record did not land on disk" };
  }
  return git(["commit", "-F", messageFile]);
}

export interface LedgerPushOptions {
  readonly git: GitRunner;
  /** Max attempts when a concurrent writer wins the race. */
  readonly maxAttempts?: number;
  /**
   * Re-sync onto the winner's tip before retrying a lost race.
   *
   * Required for the retry to mean anything: re-pushing an unchanged commit onto a ref that moved
   * fails identically forever, so a retry loop without this is three copies of the same failure
   * wearing the costume of resilience. Returning a non-zero result aborts the retry — a resync
   * that itself failed must surface, not be papered over by another push attempt.
   */
  readonly resync?: () => GitResult;
}

/**
 * Push the staged ledger commit to {@link LEDGER_BRANCH}, retrying only a NON-FAST-FORWARD.
 *
 * Retrying only that class is deliberate. A rejected push has several causes and they must not be
 * treated alike: a lost race is retryable and expected (two observers, one ref), while a denied
 * credential, a missing remote, or a ruleset refusal are conditions a retry cannot fix and that
 * a retry loop would convert into a slow, quiet failure. This is the same defect family as a
 * retry loop probing over the transport it is saturating — measured on this repo the same night.
 *
 * Returns the last result. The CALLER decides what a failure means; this function never swallows
 * one, and never reports success it did not observe.
 */
export function pushLedger(options: LedgerPushOptions): { readonly ok: boolean; readonly attempts: number; readonly last: GitResult } {
  const maxAttempts = options.maxAttempts ?? 3;
  let last: GitResult = { status: -1, stdout: "", stderr: "push never attempted" };
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    last = options.git(["push", "origin", `HEAD:${LEDGER_BRANCH}`]);
    if (last.status === 0) return { ok: true, attempts: attempt, last };
    if (!isNonFastForward(last)) return { ok: false, attempts: attempt, last };
    if (attempt === maxAttempts) break;
    const resynced = options.resync?.();
    if (resynced !== undefined && resynced.status !== 0) return { ok: false, attempts: attempt, last: resynced };
  }
  return { ok: false, attempts: maxAttempts, last };
}

/**
 * Is this rejection a lost race?
 *
 * Matched on git's own wording. Kept narrow on purpose: a broad match would swallow a permission
 * denial into the retry path, and a credential failure retried three times and then reported as
 * "could not push" hides the one fact the operator needs.
 */
export function isNonFastForward(result: GitResult): boolean {
  const text = `${result.stdout}\n${result.stderr}`;
  return (
    text.includes("non-fast-forward") ||
    text.includes("fetch first") ||
    text.includes("Updates were rejected because the remote contains work")
  );
}

/* ---------------------------------------------------------------------------------------------
 * CLI
 * ------------------------------------------------------------------------------------------- */

const USAGE = `usage:
  liveness-ledger.ts record  --dir <ledger-worktree> [--runs runs.json] [--evidence lane-evidence.json]
                             [--threshold 60] [--observer NAME] [--run-id ID] [--subject-out FILE]
  liveness-ledger.ts publish --dir <ledger-worktree> --message-file <file> [--attempts 3]
  liveness-ledger.ts read    --dir <ledger-worktree> [--threshold 60]

\`record\` writes latest.json + observations/<UTC-date>.jsonl into <ledger-worktree> and prints the
recorded outcome. It records a \`blind\` observation — never nothing — when it cannot read its
inputs, and exits non-zero only when it cannot WRITE.

\`publish\` commits that working tree and pushes it to ${LEDGER_BRANCH} — direct, no PR, no gate.
Non-zero on any failure it did not fix; it never reports a push it did not observe succeed.

\`read\` answers "is anyone still observing?" from the ledger alone, with no provider API call.`;

function argValue(argv: readonly string[], flag: string): string | undefined {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}

async function readJsonIfPresent(path: string | undefined): Promise<{ value?: unknown; reason?: string }> {
  if (path === undefined) return { reason: "no path supplied" };
  const file = Bun.file(path);
  if (!(await file.exists())) return { reason: `${path} does not exist` };
  try {
    return { value: JSON.parse(await file.text()) };
  } catch (error) {
    return { reason: `${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function runRecord(argv: readonly string[]): Promise<number> {
  const dir = argValue(argv, "--dir");
  if (dir === undefined) {
    console.error(USAGE);
    return 2;
  }
  const thresholdRaw = argValue(argv, "--threshold");
  const thresholdMinutes = thresholdRaw === undefined ? 60 : Number(thresholdRaw);
  if (!Number.isFinite(thresholdMinutes) || thresholdMinutes <= 0) {
    console.error(`invalid --threshold: ${String(thresholdRaw)}`);
    return 2;
  }
  const observer =
    argValue(argv, "--observer") ?? "github-actions/.github/workflows/heartbeat-liveness.yml";
  const runId = argValue(argv, "--run-id") ?? null;
  const now = new Date();

  // BLINDNESS IS RECORDED, NOT THROWN. If the fetch step failed, the honest ledger entry is "the
  // observer could not see", and writing that is the whole difference between this channel and
  // an annotation. Throwing here would produce the silence this file exists to eliminate.
  const runs = await readJsonIfPresent(argValue(argv, "--runs"));
  const evidence = await readJsonIfPresent(argValue(argv, "--evidence"));

  let observation: LivenessObservation;
  if (runs.value === undefined) {
    observation = buildObservation({
      now,
      observer,
      observerRunId: runId,
      thresholdMinutes,
      blindReason: `could not read agent-heartbeat run history (${runs.reason ?? "unknown"})`,
    });
  } else {
    // Lane evidence being unreadable is NOT blindness — the Actions runs alone still answer the
    // question, less well. Degrading to `[]` here is safe precisely because `assessFleetLiveness`
    // is additive-only: missing evidence can never manufacture an outage, only fail to prevent one.
    const lane: readonly FleetTickObservation[] = Array.isArray(evidence.value)
      ? (evidence.value as readonly FleetTickObservation[])
      : [];
    try {
      observation = buildObservation({
        now,
        observer,
        observerRunId: runId,
        thresholdMinutes,
        verdict: verdictFromInputs(runs.value, lane, now, thresholdMinutes),
      });
    } catch (error) {
      observation = buildObservation({
        now,
        observer,
        observerRunId: runId,
        thresholdMinutes,
        blindReason: `verdict could not be computed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  const dayPath = `${dir}/${ledgerDayPath(observation.observedAt)}`;
  const latestPath = `${dir}/${LATEST_PATH}`;
  const existingFile = Bun.file(dayPath);
  const existing = (await existingFile.exists()) ? await existingFile.text() : null;

  // A WRITE FAILURE IS FATAL AND LOUD. Everything above is about never staying silent; this is
  // the other half — the recorder must never exit 0 having failed to record. `Bun.write` rejects
  // on a read-only path, a missing parent it cannot create, or a full disk, and that rejection
  // is allowed to propagate to `main`'s catch, which exits 1 with the cause named.
  await Bun.write(dayPath, appendObservation(existing, observation));
  await Bun.write(latestPath, `${JSON.stringify(observation, null, 2)}\n`);

  console.log(`[liveness-ledger] recorded ${observation.outcome}: ${observation.summary}`);
  console.log(`[liveness-ledger] ${ledgerDayPath(observation.observedAt)} + ${LATEST_PATH} in ${dir}`);
  console.log(`[liveness-ledger] commit-subject ${renderCommitSubject(observation)}`);

  // Handed to the committer as a FILE rather than scraped back out of this step's stdout, so the
  // commit message and the recorded observation cannot drift apart. Deliberately NOT written to
  // `GITHUB_OUTPUT`: that file is shared and append-only by contract, and a writer that truncates
  // it destroys other steps' outputs — a side effect nobody would look for here.
  const subjectOut = argValue(argv, "--subject-out");
  if (subjectOut !== undefined) await Bun.write(subjectOut, `${renderCommitSubject(observation)}\n`);
  return 0;
}

async function runRead(argv: readonly string[]): Promise<number> {
  const dir = argValue(argv, "--dir");
  if (dir === undefined) {
    console.error(USAGE);
    return 2;
  }
  const thresholdRaw = argValue(argv, "--threshold");
  const staleAfterMinutes = thresholdRaw === undefined ? 60 : Number(thresholdRaw);
  if (!Number.isFinite(staleAfterMinutes) || staleAfterMinutes <= 0) {
    console.error(`invalid --threshold: ${String(thresholdRaw)}`);
    return 2;
  }

  const glob = new Bun.Glob("observations/*.jsonl");
  const all: LivenessObservation[] = [];
  let unreadable = 0;
  for await (const relative of glob.scan({ cwd: dir })) {
    const parsed = parseLedger(await Bun.file(`${dir}/${relative}`).text());
    all.push(...parsed.observations);
    unreadable += parsed.unreadableLines;
  }

  const verdict = assessObserverContinuity(all, new Date(), staleAfterMinutes);
  console.log(`[liveness-ledger] ${verdict.summary}`);
  console.log(`[liveness-ledger] records: ${verdict.recordsConsidered}, unreadable lines: ${unreadable}`);
  if (unreadable > 0) {
    // Loud, and separate from the staleness verdict. Corruption and staleness are different
    // findings and collapsing them would let one mask the other.
    console.log(`::warning::[liveness-ledger] ${unreadable} ledger line(s) could not be parsed`);
  }
  return verdict.observing ? 0 : 1;
}

/**
 * Commit the ledger tree and push it straight to {@link LEDGER_BRANCH}.
 *
 * NOTHING HERE CONSULTS A CHECK, A PR, OR `main`. That is the requirement, and it is satisfied
 * structurally rather than by intent: the only remote ref this command names is the ledger branch,
 * and the pinned test `pushes to the ledger branch, never to main` is what keeps that true.
 */
async function runPublish(argv: readonly string[]): Promise<number> {
  const dir = argValue(argv, "--dir");
  const messageFile = argValue(argv, "--message-file");
  if (dir === undefined || messageFile === undefined) {
    console.error(USAGE);
    return 2;
  }
  const attemptsRaw = argValue(argv, "--attempts");
  const maxAttempts = attemptsRaw === undefined ? 3 : Number(attemptsRaw);
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    console.error(`invalid --attempts: ${String(attemptsRaw)}`);
    return 2;
  }

  const git = realGitRunner(dir);
  const committed = commitLedger(git, messageFile);
  if (committed.status !== 0) {
    console.error(`::error::[liveness-ledger] commit failed: ${committed.stderr || committed.stdout}`);
    return 1;
  }

  const pushed = pushLedger({
    git,
    maxAttempts,
    // Re-apply onto the winner's tip. `--autostash` is unnecessary (the tree is clean after the
    // commit) and `--rebase` keeps the append linear so the ledger reads as one ordered stream.
    resync: () => {
      const fetched = git(["fetch", "--quiet", "origin", LEDGER_BRANCH]);
      if (fetched.status !== 0) return fetched;
      return git(["rebase", "FETCH_HEAD"]);
    },
  });
  if (!pushed.ok) {
    console.error(
      `::error::[liveness-ledger] could not publish the observation to ${LEDGER_BRANCH} after ${pushed.attempts} attempt(s): ${pushed.last.stderr || pushed.last.stdout}`,
    );
    return 1;
  }
  console.log(`[liveness-ledger] published to ${LEDGER_BRANCH} in ${pushed.attempts} attempt(s)`);
  console.log(`[liveness-ledger] tip ${git(["rev-parse", "HEAD"]).stdout.trim()}`);
  return 0;
}

async function main(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv;
  switch (command) {
    case "record":
      return await runRecord(rest);
    case "publish":
      return await runPublish(rest);
    case "read":
      return await runRead(rest);
    default:
      console.error(USAGE);
      return 2;
  }
}

if (import.meta.main) {
  try {
    process.exit(await main(process.argv.slice(2)));
  } catch (error) {
    // Named cause, non-zero exit. A recorder that cannot write must fail here, where the reason
    // is legible — never exit 0 having recorded nothing.
    console.error(`::error::[liveness-ledger] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
