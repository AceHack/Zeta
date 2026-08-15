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

export function requiredCheckStarted(
  rollup: readonly NamedCheck[],
  requiredName = REQUIRED_GATE_NAME,
): boolean {
  return rollup.some((c) => c.name === requiredName);
}

export interface HeartbeatPrSnapshot {
  readonly number: number;
  readonly createdAt: string;
  readonly headRef: string;
  readonly rollup: readonly NamedCheck[];
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
  const listed = spawnSync(
    "gh",
    [
      "pr",
      "list",
      "--state",
      "open",
      "--json",
      "number,createdAt,headRefName,statusCheckRollup",
      "--limit",
      "50",
    ],
    { encoding: "utf8" },
  );
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
    process.stdout.write(`required-check-started: all heartbeat PRs older than ${minAgeMin}m have ${REQUIRED_GATE_NAME}\n`);
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
