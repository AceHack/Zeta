#!/usr/bin/env bun
/**
 * required-check-started.ts — "all present checks are green" is not healthy
 * when the required check never started (081M010H4KE / 081M005FXAB).
 *
 * Heartbeat PRs used to sit blocked with every *present* check green because
 * `gate (required)` was never allowed to start (`action_required` on a
 * github-actions[bot] pull_request run). This classifier names that absence.
 *
 * The honest signal is: does the rollup contain the required name at all?
 * Status/conclusion are a different question (failed vs pending).
 *
 * ---------------------------------------------------------------------------
 * ABSENT FROM THE ROLLUP IS NOT THE SAME AS NEVER GOING TO RUN (2026-08-17).
 *
 * The rollup-only test above is necessary but not sufficient, and on its own it
 * inverted this file's own thesis. A gate run that has STARTED but has not yet
 * published a check-run named `gate (required)` is absent from the rollup, so a
 * healthy-but-queued PR was reported with the words "never started". Measured on
 * four heartbeat PRs the same morning:
 *
 *   #11387  gate run present at 28.0 min after PR creation  -> merged
 *   #11389  gate run present, failed transiently, passed on rerun -> merged
 *   #11401  gate run present at 28.4 min after PR creation  -> merged
 *   #11369  ZERO gate runs for its head, ever                -> genuinely stuck
 *   #11426  ZERO gate runs for its head, ever                -> genuinely stuck
 *
 * Raising `--min-age-min` past 28 would have silenced the three false positives
 * and also delayed the two real ones — trading a loud wrong answer for a quiet
 * late one. The discriminator that separates them is not TIME, it is EXISTENCE:
 * ask the forge whether a run of the required workflow exists for that head SHA.
 * A run that exists will report; a run that does not exist never will.
 *
 * So `stalled` (no run) fails the job, and `queued` (run exists, name not yet
 * published) is reported and tolerated. This is strictly SHARPER than the age
 * threshold, not weaker: it still fails every genuine hang, on the first check
 * past `--min-age-min`, with no waiting.
 */
export const REQUIRED_GATE_NAME = "gate (required)";

/** The workflow whose existence-for-a-SHA decides stalled vs merely queued. */
export const REQUIRED_WORKFLOW_FILE = "gate.yml";

export interface NamedCheck {
  readonly name?: string | null;
}

export function requiredCheckStarted(rollup: readonly NamedCheck[], requiredName = REQUIRED_GATE_NAME): boolean {
  return rollup.some((c) => c.name === requiredName);
}

export interface HeartbeatPrSnapshot {
  readonly number: number;
  readonly createdAt: string;
  readonly headRef: string;
  readonly headSha: string;
  readonly rollup: readonly NamedCheck[];
}

/**
 * How many runs of the required workflow exist for a candidate's head SHA.
 * Zero is the only value that proves the check will never report.
 */
export interface RequiredWorkflowPresence {
  readonly number: number;
  readonly runCount: number;
}

export interface MissingCheckClassification {
  /** No run exists for the head SHA — the required check can never report. */
  readonly stalled: readonly number[];
  /** A run exists but has not published the check name yet — merely slow. */
  readonly queued: readonly number[];
}

/**
 * Split rollup-absent candidates by whether the forge actually has a run.
 * Deliberately total and boring: the judgement lives in what the caller does
 * with each list, and a miscount must not be able to hide in a clever filter.
 */
export function classifyMissingRequiredCheck(
  presence: readonly RequiredWorkflowPresence[],
): MissingCheckClassification {
  return {
    stalled: presence.filter((p) => p.runCount === 0).map((p) => p.number),
    queued: presence.filter((p) => p.runCount > 0).map((p) => p.number),
  };
}

export interface GhListResult {
  readonly status: number;
  readonly stdout: string;
  readonly stderr: string;
}

export type GhListRunner = () => GhListResult | Promise<GhListResult>;
export type RetryDelay = (milliseconds: number) => Promise<void>;

/** Host failures that say nothing about whether a required check exists. */
export function isTransientHostFailure(message: string): boolean {
  return /\bHTTP (?:429|502|503|504)\b|timed? out|ECONNRESET|connection reset/i.test(message);
}

/**
 * Retry transient forge-host reads without weakening a real negative result.
 * A completed command, including a permanent 401/403, returns immediately.
 */
export async function listWithTransientRetry(
  run: GhListRunner,
  delay: RetryDelay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  attempts = 3,
): Promise<GhListResult> {
  const boundedAttempts = Math.max(1, attempts);
  let result = await run();
  for (let attempt = 1; attempt < boundedAttempts; attempt++) {
    const message = result.stderr || result.stdout;
    if (result.status === 0 || !isTransientHostFailure(message)) return result;
    await delay(attempt * 1_000);
    result = await run();
  }
  return result;
}

/** Heartbeat PRs old enough that gate should have started, but did not. */
export function heartbeatPrsMissingRequiredCheck(
  prs: readonly HeartbeatPrSnapshot[],
  nowMs: number,
  minAgeMs: number,
  requiredName = REQUIRED_GATE_NAME,
): readonly number[] {
  return prs
    .filter((pr) => pr.headRef.startsWith("heartbeat/"))
    .filter((pr) => nowMs - Date.parse(pr.createdAt) >= minAgeMs)
    .filter((pr) => !requiredCheckStarted(pr.rollup, requiredName))
    .map((pr) => pr.number);
}

async function main(argv: readonly string[]): Promise<number> {
  const minIdx = argv.indexOf("--min-age-min");
  const minAgeMin = minIdx >= 0 ? Number(argv[minIdx + 1]) : 10;
  if (!Number.isFinite(minAgeMin) || minAgeMin < 0) {
    process.stderr.write("required-check-started: --min-age-min must be a non-negative number\n");
    return 2;
  }
  const { spawnSync } = await import("node:child_process");
  const listed = await listWithTransientRetry(() => {
    const result = spawnSync(
      "gh",
      [
        "pr",
        "list",
        "--state",
        "open",
        "--json",
        "number,createdAt,headRefName,headRefOid,statusCheckRollup",
        "--limit",
        "50",
      ],
      { encoding: "utf8" },
    );
    return {
      status: result.status ?? -1,
      stdout: result.stdout,
      stderr: result.error?.message ?? result.stderr,
    };
  });
  if (listed.status !== 0) {
    process.stderr.write(listed.stderr || "required-check-started: gh pr list failed\n");
    return 2;
  }
  const raw = JSON.parse(listed.stdout) as readonly {
    number: number;
    createdAt: string;
    headRefName: string;
    headRefOid?: string;
    statusCheckRollup?: readonly NamedCheck[];
  }[];
  const snapshots = raw.map((p) => ({
    number: p.number,
    createdAt: p.createdAt,
    headRef: p.headRefName,
    headSha: p.headRefOid ?? "",
    rollup: p.statusCheckRollup ?? [],
  }));
  const missing = heartbeatPrsMissingRequiredCheck(snapshots, Date.now(), minAgeMin * 60_000);
  if (missing.length === 0) {
    process.stdout.write(
      `required-check-started: all heartbeat PRs older than ${minAgeMin}m have ${REQUIRED_GATE_NAME}\n`,
    );
    return 0;
  }

  // Rollup-absent is only a CANDIDATE. Ask the forge whether a run exists for
  // the head SHA before calling it "never started" — see the header note.
  const workflowIdx = argv.indexOf("--required-workflow");
  const workflowFile = workflowIdx >= 0 ? argv[workflowIdx + 1] : REQUIRED_WORKFLOW_FILE;
  const presence: RequiredWorkflowPresence[] = [];
  for (const number of missing) {
    const sha = snapshots.find((s) => s.number === number)?.headSha ?? "";
    if (sha === "") {
      // No head SHA means we cannot ask the existence question at all. Refusing
      // to guess is the whole point of this file.
      process.stderr.write(`required-check-started: #${number} has no head SHA — existence unmeasured\n`);
      return 2;
    }
    const counted = await listWithTransientRetry(() => {
      const result = spawnSync(
        "gh",
        ["api", `repos/{owner}/{repo}/actions/workflows/${workflowFile}/runs?head_sha=${sha}`, "--jq", ".total_count"],
        { encoding: "utf8" },
      );
      return {
        status: result.status ?? -1,
        stdout: result.stdout,
        stderr: result.error?.message ?? result.stderr,
      };
    });
    if (counted.status !== 0) {
      // A failed measurement is not a measured failure. Exit 2 so the caller
      // reports "unmeasured" rather than converting host trouble into a verdict.
      process.stderr.write(
        counted.stderr || `required-check-started: could not count ${workflowFile} runs for #${number}\n`,
      );
      return 2;
    }
    const runCount = Number(counted.stdout.trim());
    if (!Number.isFinite(runCount)) {
      process.stderr.write(`required-check-started: unparseable run count for #${number}: ${counted.stdout}\n`);
      return 2;
    }
    presence.push({ number, runCount });
  }

  const { stalled, queued } = classifyMissingRequiredCheck(presence);
  if (queued.length > 0) {
    process.stdout.write(
      `required-check-started: ${workflowFile} run EXISTS but has not published ` +
        `${REQUIRED_GATE_NAME} yet on ${queued.map((n) => `#${n}`).join(", ")} — queued, not stuck\n`,
    );
  }
  if (stalled.length === 0) return 0;
  process.stderr.write(
    `required-check-started: no ${workflowFile} run exists for heartbeat PR(s): ` +
      `${stalled.map((n) => `#${n}`).join(", ")} — ${REQUIRED_GATE_NAME} can never report\n`,
  );
  return 1;
}

if (import.meta.main) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
      process.exit(2);
    },
  );
}
