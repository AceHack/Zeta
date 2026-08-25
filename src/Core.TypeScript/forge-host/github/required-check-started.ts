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
 *
 * ---------------------------------------------------------------------------
 * THE CLASS IS NOT HEARTBEAT-SHAPED (2026-08-24, 081M0TK8DE8087G0R0001HSKHF).
 *
 * Everything above was derived from heartbeat lanes and then SCOPED to them:
 * `heartbeatPrsMissingRequiredCheck` filtered `headRef.startsWith("heartbeat/")`,
 * so the one detector this repo has for "the required check will never report"
 * was blind to every ordinary pull request. MEASURED on 2026-08-24 across all 42
 * open PRs: FOUR carried zero `gate (required)` — #12058, #12066, #12321, #14858 —
 * and none of them is a heartbeat lane. #14858 had ZERO `gate.yml` runs for its
 * branch, ever.
 *
 * What that costs is exact, and it is the vacuity class at the rollup-of-rollups
 * level. On #14858, MEASURED the same day, exit codes captured directly:
 *
 *     gh pr checks 14858              -> rc=0, 6 pass / 0 fail / 0 pending
 *     gh pr checks 14858 --required   -> rc=1, "no required checks reported"
 *
 * The bare form is what a reader reaches for and it answers a DIFFERENT QUESTION
 * than the one being asked: "did everything that reported, pass" rather than "did
 * everything that must report, pass". With zero required checks reported the two
 * answers diverge completely, and the wrong one is green.
 *
 * So the ref-prefix is now a PARAMETER with `heartbeat/` as its default — the
 * heartbeat lane's verdict is byte-for-byte unchanged — and `--ref-prefix ''`
 * asks the same question of every open PR.
 *
 * AND THE LISTING IS NOW ITS OWN FALSIFIER. `gh pr list --limit 50` against 42
 * open PRs was eight PRs from silently measuring a subset and reporting a clean
 * sheet: a truncated listing is a check that did not run, wearing the face of one
 * that passed, in the detector built to name exactly that. A full page now exits 2
 * (unmeasured) rather than 0 (clean).
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
  /**
   * Runs whose `status` is not yet `completed`. A run that FINISHED without
   * publishing the required check will never publish it, however many runs
   * exist -- so `runCount > 0` alone cannot mean "merely slow". Optional so
   * existing callers keep compiling; absent reads as "unmeasured, assume live",
   * preserving the old, more forgiving verdict rather than inventing a red.
   */
  readonly liveRunCount?: number;
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
  // Reaching here means the required check is ABSENT from the rollup, so the only
  // thing that can still rescue this PR is a run that has not finished yet. Zero
  // runs and "every run already finished" are therefore the SAME verdict -- the
  // check can never report. Splitting on `runCount` alone conflated them: an
  // `action_required` run (terminal, 0 jobs) counted as progress and read as
  // "merely slow" on #15327 for fourteen hours.
  const canStillReport = (p: RequiredWorkflowPresence): boolean =>
    p.liveRunCount === undefined ? p.runCount > 0 : p.liveRunCount > 0;
  return {
    stalled: presence.filter((p) => !canStillReport(p)).map((p) => p.number),
    queued: presence.filter(canStillReport).map((p) => p.number),
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

/** The lane this detector was built for. Kept as a named constant, not a literal. */
export const HEARTBEAT_REF_PREFIX = "heartbeat/";

/**
 * Open PRs, on branches matching `refPrefix`, old enough that the required check
 * should have started, whose rollup does not carry it.
 *
 * `refPrefix === ""` matches every branch — that is the repo-wide question, and
 * `String.prototype.startsWith("")` is true for every string, so the empty prefix
 * needs no special case.
 */
export function prsMissingRequiredCheck(
  prs: readonly HeartbeatPrSnapshot[],
  nowMs: number,
  minAgeMs: number,
  refPrefix: string = HEARTBEAT_REF_PREFIX,
  requiredName = REQUIRED_GATE_NAME,
): readonly number[] {
  return prs
    .filter((pr) => pr.headRef.startsWith(refPrefix))
    .filter((pr) => nowMs - Date.parse(pr.createdAt) >= minAgeMs)
    .filter((pr) => !requiredCheckStarted(pr.rollup, requiredName))
    .map((pr) => pr.number);
}

/**
 * Heartbeat PRs old enough that gate should have started, but did not.
 *
 * Retained as the heartbeat lane's entry point so widening the general function
 * above cannot change that lane's verdict by accident.
 */
export function heartbeatPrsMissingRequiredCheck(
  prs: readonly HeartbeatPrSnapshot[],
  nowMs: number,
  minAgeMs: number,
  requiredName = REQUIRED_GATE_NAME,
): readonly number[] {
  return prsMissingRequiredCheck(prs, nowMs, minAgeMs, HEARTBEAT_REF_PREFIX, requiredName);
}

/** Default page size for the open-PR listing. See `listingWasTruncated`. */
export const DEFAULT_PR_LIST_LIMIT = 200;

/**
 * A listing that filled its page measured a SUBSET and cannot report a clean sheet.
 *
 * `gh pr list --limit N` returns at most N and says nothing about how many it
 * dropped, so `returned === limit` is the only signal available. Treating it as a
 * complete answer is the exact defect this file exists to name, committed by this
 * file, so it is an error rather than a warning.
 */
export function listingWasTruncated(returned: number, limit: number): boolean {
  return returned >= limit;
}

async function main(argv: readonly string[]): Promise<number> {
  const minIdx = argv.indexOf("--min-age-min");
  const minAgeMin = minIdx >= 0 ? Number(argv[minIdx + 1]) : 10;
  if (!Number.isFinite(minAgeMin) || minAgeMin < 0) {
    process.stderr.write("required-check-started: --min-age-min must be a non-negative number\n");
    return 2;
  }
  // `--ref-prefix ''` is the repo-wide scope. Absent flag keeps the heartbeat default,
  // so every existing invocation's verdict is unchanged.
  const prefixIdx = argv.indexOf("--ref-prefix");
  const refPrefix = prefixIdx >= 0 ? (argv[prefixIdx + 1] ?? "") : HEARTBEAT_REF_PREFIX;
  if (prefixIdx >= 0 && argv[prefixIdx + 1] === undefined) {
    process.stderr.write("required-check-started: --ref-prefix needs a value (use '' for every branch)\n");
    return 2;
  }
  const scope = refPrefix === "" ? "every open PR" : `PRs on ${refPrefix}*`;
  const limitIdx = argv.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(argv[limitIdx + 1]) : DEFAULT_PR_LIST_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) {
    process.stderr.write("required-check-started: --limit must be a positive integer\n");
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
        String(limit),
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
  if (listingWasTruncated(raw.length, limit)) {
    // A full page is an UNMEASURED result, not a clean one. Exiting 0 here would be
    // this detector committing the defect it was written to name.
    process.stderr.write(
      `required-check-started: gh pr list returned ${raw.length} of --limit ${limit} — ` +
        `the listing is truncated and the scope is unmeasured. Raise --limit.\n`,
    );
    return 2;
  }
  const snapshots = raw.map((p) => ({
    number: p.number,
    createdAt: p.createdAt,
    headRef: p.headRefName,
    headSha: p.headRefOid ?? "",
    rollup: p.statusCheckRollup ?? [],
  }));
  const missing = prsMissingRequiredCheck(snapshots, Date.now(), minAgeMin * 60_000, refPrefix);
  if (missing.length === 0) {
    process.stdout.write(
      `required-check-started: all ${scope} older than ${minAgeMin}m have ${REQUIRED_GATE_NAME} ` +
        `(scanned ${raw.length} open PR(s))\n`,
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
        [
          "api",
          `repos/{owner}/{repo}/actions/workflows/${workflowFile}/runs?head_sha=${sha}&per_page=100`,
          "--jq",
          // Two numbers, one call: how many runs exist, and how many can STILL
          // publish the check. `status != "completed"` is the live set.
          // `@tsv` rather than jq string interpolation: `\(` inside a JS string
          // literal is silently eaten by JS escaping, which produced a jq parse
          // error that every unit test missed because they exercise the pure
          // classifier, never this shell boundary.
          '[.total_count, ([.workflow_runs[] | select(.status != "completed")] | length)] | @tsv',
        ],
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
    const [totalRaw, liveRaw] = counted.stdout.trim().split(/\s+/);
    const runCount = Number(totalRaw);
    const liveRunCount = Number(liveRaw);
    if (!Number.isFinite(runCount) || !Number.isFinite(liveRunCount)) {
      process.stderr.write(`required-check-started: unparseable run count for #${number}: ${counted.stdout}\n`);
      return 2;
    }
    presence.push({ number, runCount, liveRunCount });
  }

  const { stalled, queued } = classifyMissingRequiredCheck(presence);
  if (queued.length > 0) {
    process.stdout.write(
      `required-check-started: ${workflowFile} run EXISTS but has not published ` +
        `${REQUIRED_GATE_NAME} yet on ${queued.map((n) => `#${n}`).join(", ")} — queued, not stuck\n`,
    );
  }
  if (stalled.length === 0) return 0;
  const list = stalled.map((n) => `#${n}`).join(", ");
  // ::error:: so the absence is LOUD in the run itself, per the drift-loud discipline —
  // this lane blocks nothing, so an unannotated line in a log is the same as silence.
  process.stderr.write(
    `::error::required-check-started: no LIVE ${workflowFile} run for ${list} ` +
      `(either none was created, or every run finished without publishing it) — ` +
      `${REQUIRED_GATE_NAME} can never report on ${stalled.length === 1 ? "it" : "them"}. ` +
      `Note that a bare \`gh pr checks\` reads this as green; \`--required\` does not.\n`,
  );
  process.stderr.write(
    `required-check-started: no LIVE ${workflowFile} run for ${scope}: ${list} — ` +
      `${REQUIRED_GATE_NAME} can never report\n`,
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
