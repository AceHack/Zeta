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
 */
export const REQUIRED_GATE_NAME = "gate (required)";

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
  readonly rollup: readonly NamedCheck[];
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
      ["pr", "list", "--state", "open", "--json", "number,createdAt,headRefName,statusCheckRollup", "--limit", "50"],
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
    statusCheckRollup?: readonly NamedCheck[];
  }[];
  const missing = heartbeatPrsMissingRequiredCheck(
    raw.map((p) => ({
      number: p.number,
      createdAt: p.createdAt,
      headRef: p.headRefName,
      rollup: p.statusCheckRollup ?? [],
    })),
    Date.now(),
    minAgeMin * 60_000,
  );
  if (missing.length === 0) {
    process.stdout.write(
      `required-check-started: all heartbeat PRs older than ${minAgeMin}m have ${REQUIRED_GATE_NAME}\n`,
    );
    return 0;
  }
  process.stderr.write(
    `required-check-started: ${REQUIRED_GATE_NAME} never started on heartbeat PR(s): ${missing.map((n) => `#${n}`).join(", ")}\n`,
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
