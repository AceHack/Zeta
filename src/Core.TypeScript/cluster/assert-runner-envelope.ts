// Does the runner we are ON actually have the capacity the catalogue RECORDS?
//
// WHY THIS IS A SEPARATE FILE AND NOT AN INLINE `bun -e`
// ------------------------------------------------------
// `storage-profiles.json` is explicit that the capacity half of
// `runnerEnvelope` is GitHub's PUBLISHED spec for a hosted `ubuntu-24.04`
// runner — "a vendor number, not one we measured". Every lane budget in
// `lane-partition.ts` is computed from it. A budget derived from a spec the
// machine does not meet is a check that did not run, so it has to be convicted
// against the machine.
//
// It lives in a file rather than inside a workflow `run:` block for two
// reasons, and both are why the first version of this was rejected: shellcheck
// reads `${...}` inside a single-quoted `bun -e '...'` as a shell expansion it
// cannot see through (SC2016), and — the reason that would still hold if
// shellcheck were silent — a check that only exists inside a YAML string
// cannot be run locally and cannot be tested.
//
// UNDER-report, never over-report: it convicts when the machine is SMALLER
// than recorded and stays quiet when it is bigger. A bigger runner does not
// invalidate a budget computed for a smaller one.
//
// USAGE
//   bun src/Core.TypeScript/cluster/assert-runner-envelope.ts \
//     --cpu-millis 4000 --memory-mib 15360 --free-disk-gib 14

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const CATALOGUE_PATH = "full-ai-cluster/k8s/storage-profiles.json";

export interface MeasuredRunner {
  readonly cpuMillis: number;
  readonly memoryMib: number;
  readonly freeDiskGib: number;
}

export interface RecordedEnvelope {
  readonly runner: string;
  readonly cpuMillis: number;
  readonly memoryMib: number;
  readonly freeDiskGib: number;
}

/**
 * Every axis on which the recorded envelope claims more than the machine has.
 *
 * Empty means the record is honest about THIS machine. Each entry names both
 * numbers, because "the runner is too small" without them sends the reader to
 * three files to find out by how much.
 */
export function envelopeOverstatements(
  recorded: RecordedEnvelope,
  measured: MeasuredRunner,
): readonly string[] {
  const bad: string[] = [];
  if (measured.cpuMillis < recorded.cpuMillis) {
    bad.push(`cpu ${String(measured.cpuMillis)}m < recorded ${String(recorded.cpuMillis)}m`);
  }
  if (measured.memoryMib < recorded.memoryMib) {
    bad.push(`memory ${String(measured.memoryMib)}Mi < recorded ${String(recorded.memoryMib)}Mi`);
  }
  if (measured.freeDiskGib < recorded.freeDiskGib) {
    bad.push(`free disk ${String(measured.freeDiskGib)}Gi < recorded ${String(recorded.freeDiskGib)}Gi`);
  }
  return bad;
}

export function loadRecordedEnvelope(repoRoot = REPO_ROOT): RecordedEnvelope {
  const raw = JSON.parse(readFileSync(resolve(repoRoot, CATALOGUE_PATH), "utf8")) as {
    runnerEnvelope: RecordedEnvelope;
  };
  return raw.runnerEnvelope;
}

function numberArg(flag: string): number {
  const i = process.argv.indexOf(flag);
  const raw = i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : undefined;
  const value = Number(raw ?? Number.NaN);
  // An unparseable measurement is a REFUSAL. Defaulting it to 0 would convict
  // every runner; defaulting it to Infinity would acquit every runner. Both are
  // worse than saying the measurement did not arrive.
  if (!Number.isFinite(value)) {
    console.error(`${flag} is required and must be a number (got ${String(raw)})`);
    process.exit(2);
  }
  return value;
}

if (import.meta.main) {
  const recorded = loadRecordedEnvelope();
  const measured: MeasuredRunner = {
    cpuMillis: numberArg("--cpu-millis"),
    memoryMib: numberArg("--memory-mib"),
    freeDiskGib: numberArg("--free-disk-gib"),
  };
  const bad = envelopeOverstatements(recorded, measured);
  if (bad.length > 0) {
    console.error(`runnerEnvelope ("${recorded.runner}") OVERSTATES this runner: ${bad.join("; ")}`);
    process.exit(1);
  }
  console.log(`runnerEnvelope ("${recorded.runner}") is met or exceeded by this runner`);
}
