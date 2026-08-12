/**
 * The findings ledger — every mutation OBSERVATION, not just the ones somebody acted on.
 *
 * WHY THIS EXISTS. `mutation-false-alarm-rate.ts` could compute false/RESOLVED but not SLAM's
 * false/REPORTED, because nothing recorded the reports. Resolution is voluntary, so resolutions
 * alone are a biased sample: whoever bothers to run `--choose` is not a random draw from findings.
 * The measured consequence was stark — the first readout showed 2 resolutions, BOTH false alarms
 * and ZERO real gaps, in a session where four real gaps had been found and fixed by PR.
 *
 * This ledger supplies the denominator. Every tick appends what the runner actually saw, whatever
 * the outcome, so the population is recorded independently of whether anyone got round to it.
 *
 * IDEMPOTENCY (§12), and it is load-bearing rather than decorative. A tick can be re-run: a manual
 * `workflow_dispatch` over the same commit, a retried job, a resumed run. Selection is already
 * deterministic in (agent, tick), so a re-run observes the IDENTICAL finding — and appending it
 * twice would inflate the denominator and silently deflate every rate computed from it. The record
 * is therefore keyed by its content address and an append that matches an existing address is a
 * no-op. Apply-N-times == apply-once, on the file.
 *
 * JSONL, append-only, one file per agent: same reasoning as the transcript. Agents write
 * concurrently in CI, and per-agent files mean two ticks never contend for the same path.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

export const FINDINGS_DIR = "db/mutation-findings";

/** The three outcomes the runner can honestly report. Mirrors `Distinguishability`. */
export type FindingOutcome = "indistinguishable" | "distinguished" | "unresolved";

export interface FindingRecord {
  readonly source: string;
  readonly test: string;
  readonly mutation: string;
  readonly agent: string;
  readonly tick: number;
  readonly outcome: FindingOutcome;
  /** Content address of the fields above. The natural key that makes appending idempotent. */
  readonly address: string;
}

function findingsPath(root: string, agent: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(agent)) {
    throw new Error(`mutation-findings: refusing unsafe agent name ${JSON.stringify(agent)}`);
  }
  return join(root, FINDINGS_DIR, `${agent}.jsonl`);
}

/**
 * Address the observation, NOT the moment of observing.
 *
 * Deliberately excludes any clock: two runs of the same tick are the same observation and must
 * collapse. Including a timestamp would make every re-run "new" and defeat the whole guard.
 *
 * `JSON.stringify` rather than a joined string, so the encoding is UNAMBIGUOUS by construction: a
 * separator-joined key has to argue that the separator cannot appear in any field, and a wrong
 * separator silently merges neighbours (source "ab" + test "c" colliding with "a" + "bc"). Here the
 * field boundaries are in the encoding itself, so no such argument is needed. Field ORDER is the
 * contract: reorder this array and every previously recorded address changes meaning.
 */
export function findingAddress(f: Omit<FindingRecord, "address">): string {
  const canonical = JSON.stringify([f.source, f.test, f.mutation, f.agent, f.tick, f.outcome]);
  return createHash("sha256").update(canonical).digest("hex");
}

export function makeFinding(f: Omit<FindingRecord, "address">): FindingRecord {
  return { ...f, address: findingAddress(f) };
}

/** Read one agent's findings. Missing file = nothing observed yet, never an error. */
export function readFindings(root: string, agent: string): readonly FindingRecord[] {
  const p = findingsPath(root, agent);
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as FindingRecord);
}

/**
 * Append one observation, or do nothing if that exact observation is already recorded.
 *
 * Returns whether a line was written, so a caller can say "already recorded" rather than implying
 * it wrote. Re-reads the file per append: O(n) in a file that grows by ~3 lines a tick, and paying
 * it keeps the dedup honest rather than cached.
 */
export function appendFinding(root: string, finding: FindingRecord): boolean {
  if (readFindings(root, finding.agent).some((f) => f.address === finding.address)) return false;
  mkdirSync(join(root, FINDINGS_DIR), { recursive: true });
  appendFileSync(findingsPath(root, finding.agent), `${JSON.stringify(finding)}\n`);
  return true;
}

/** Every agent with a findings file. Missing directory is empty, never an error. */
export function findingAgents(root: string): readonly string[] {
  try {
    return readdirSync(join(root, FINDINGS_DIR))
      .filter((f) => f.endsWith(".jsonl"))
      .map((f) => f.slice(0, -".jsonl".length))
      .sort();
  } catch {
    return [];
  }
}

/** Every recorded observation, across agents. */
export function readAllFindings(root: string): readonly FindingRecord[] {
  return findingAgents(root).flatMap((a) => readFindings(root, a));
}

/**
 * The ALARMS: distinct dimensions ever reported indistinguishable.
 *
 * Distinct by (source, test, mutation) and NOT by tick — the same dimension re-reported on a later
 * tick is the same alarm, and counting it again would make an unfixed finding look like a growing
 * population of correct reports. `distinguished` is not an alarm at all: the suite did its job.
 */
export function alarmKeys(findings: readonly FindingRecord[]): ReadonlySet<string> {
  return new Set(
    findings
      .filter((f) => f.outcome === "indistinguishable")
      .map((f) => `${f.source}::${f.test}::${f.mutation}`),
  );
}
