/**
 * WHICH JOBS CAN BLOCK A MERGE — derived from `gate.yml`, never from a list of names.
 *
 * WHY THIS EXISTS. `toolchain-install-stall.ts` refuses to re-run a run that holds BOTH an
 * apt-budget install stall and some other red, because re-running a real failure is how a
 * real failure becomes a flake. That guard was right about failures that BLOCK and wrong
 * about failures that CANNOT.
 *
 * Measured live: gate run 32886176743 (PR #15410) carried an install stall in
 * `build-and-test (ubuntu-24.04)`, the derived `gate (required)` roll-up, and a red
 * `drift (loud)`. `drift (loud)` is deliberately non-blocking — gate.yml says so in its own
 * comment ("It blocks nothing. `gate (required)` is the sole required status check ... its
 * `needs:` list above does not contain this job") — yet the policy read it as an unexplained
 * red and declined. The run stranded for ~11 hours. `drift (loud)` goes red often, so this
 * stranded PRs at whatever rate drift is detected, which is the opposite of the intent: a
 * check designed to be loud and harmless became a merge blocker by proxy.
 *
 * THE RULE, and its narrowness. A job whose failure cannot block anything is not a "real
 * red" for the rerun decision. Everything else is unchanged — a red in the floor still
 * declines the rerun, and that is what `toolchain-install-stall.test.ts`'s mutation
 * falsifier pins.
 *
 * WHY THIS IS NOT A NAME ALLOW-LIST. A hand-written roster of "harmless" job names drifts
 * from the workflow the moment someone renames a job or moves one into the floor, and the
 * drift is silent and permissive — the worst direction. So the blocking set is DERIVED from
 * the same declaration GitHub itself obeys: the roll-up job's `needs:` list in `gate.yml`,
 * closed transitively, mapped through each job's declared `name:`. Add a job to the floor and
 * this parser reports it as blocking with no edit here; rename one and its old name stops
 * matching. There is exactly one hand-written string in this file — the roll-up job's id
 * (`gate-required`) — and `gate-blocking-floor.test.ts` fails if `gate.yml` stops declaring
 * it, which is the check that catches that one drift.
 *
 * FAIL CLOSED, EVERYWHERE. A missing file, an unparseable workflow, an unfindable roll-up, a
 * job name `gate.yml` does not declare at all: every one of them yields "not provably
 * non-blocking", so the caller keeps declining. Missing evidence must never read as
 * absolving evidence.
 *
 * HONEST LIMITS, stated because they bound the claim:
 *   * `continue-on-error` is NOT read. `build-and-test (windows-2025)` is inside the floor's
 *     `needs:` and carries `continue-on-error`, so it reaches the roll-up as success and in
 *     truth blocks nothing — this parser still calls it blocking. That errs toward declining
 *     the rerun, which is the safe direction, and it keeps this file free of the expression
 *     evaluation (`${{ startsWith(matrix.os, 'windows-') }}`) that a real answer would need.
 *   * BRANCH PROTECTION IS NOT READ EITHER. That `gate (required)` is the sole required check
 *     is a repository setting, not a fact in the tree. What this file derives is "inside the
 *     roll-up's dependency closure", which is a NECESSARY condition for blocking under that
 *     setting, not a sufficient one — again the conservative direction.
 *   * The workflow text must come from a trusted checkout (the default branch), never from a
 *     pull request head. A PR that edited its own `gate.yml` could otherwise declare its own
 *     failing job non-blocking. The sweeper reads the scheduled run's checkout, which is the
 *     default branch by construction.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gateYmlJobNames } from "./gate-scope-summary.ts";

/**
 * The blocking picture for ONE workflow file, as declared in that file.
 *
 * `blocking` and `declared` hold DECLARED names (a `name:` value, `${{ ... }}` tail intact),
 * not Actions-API job names; `declaredNameMatchesJob` is what bridges the two.
 */
export interface BlockingFloor {
  /** The workflow's top-level `name:` — must equal a run's `name` for this floor to apply. */
  readonly workflow: string;
  /** Declared name of the roll-up job whose `needs:` defines the floor. */
  readonly rollupJobName: string;
  /** Declared names in the roll-up's transitive `needs:` closure, plus the roll-up itself. */
  readonly blocking: readonly string[];
  /** Declared names of EVERY job in the workflow — the "do I even know this job?" set. */
  readonly declared: readonly string[];
}

/** The one hand-written string in this file. Pinned by `gate-blocking-floor.test.ts`. */
export const ROLLUP_JOB_ID = "gate-required";

/**
 * Does an Actions-API job name belong to a declared job name?
 *
 * Same rule `gate-scope-summary.ts` uses, and pinned equal to it by a parity test: a declared
 * name containing `${{ ... }}` is a matrix job whose literal head is a prefix
 * (`build-and-test (` matches `build-and-test (windows-2025)`); anything else must match
 * exactly, which keeps `lint (semgrep)` from swallowing `lint (semgrep drift)`.
 */
export function declaredNameMatchesJob(declaredName: string, jobName: string): boolean {
  const exprAt = declaredName.indexOf("${{");
  if (exprAt < 0) return jobName === declaredName;
  return jobName.startsWith(declaredName.slice(0, exprAt));
}

const ID_CHARS = new Set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-");

function isJobId(id: string): boolean {
  if (id.length === 0) return false;
  for (const ch of id) if (!ID_CHARS.has(ch)) return false;
  return true;
}

/** `  <job-id>:` at exactly two-space indent, or null. */
function jobIdOf(line: string): string | null {
  if (!line.startsWith("  ") || line.startsWith("   ")) return null;
  const body = line.slice(2).trimEnd();
  if (!body.endsWith(":")) return null;
  const id = body.slice(0, -1);
  return isJobId(id) ? id : null;
}

function stripQuotes(value: string): string {
  const first = value.at(0);
  if ((first === '"' || first === "'") && value.endsWith(first) && value.length > 1) {
    return value.slice(1, -1);
  }
  return value;
}

/**
 * `jobs:` -> job id -> the ids in that job's `needs:`.
 *
 * All three spellings GitHub accepts are read, because all three appear in this repo's
 * workflows: `needs: a`, `needs: [a, b]`, and a block sequence of `- a` lines. A line scanner
 * rather than a YAML dependency, for the same reason `gate-scope-summary.ts` is one: the
 * consumers run on sparse checkouts with no `bun install`, so a dependency would cost more
 * than the whole read.
 */
export function gateYmlJobNeeds(yamlText: string): ReadonlyMap<string, readonly string[]> {
  const needs = new Map<string, string[]>();
  let inJobs = false;
  let current: string | null = null;
  let collecting: string[] | null = null;

  for (const rawLine of yamlText.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.trimEnd() === "jobs:") {
      inJobs = true;
      continue;
    }
    if (!inJobs) continue;
    if (/^\S/.test(line)) break;

    const jobId = jobIdOf(line);
    if (jobId !== null) {
      current = jobId;
      collecting = null;
      continue;
    }
    if (current === null) continue;

    // A block-sequence entry belonging to the `needs:` we are collecting: `      - <id>`.
    if (collecting !== null) {
      const item = line.trim();
      if (item.startsWith("- ")) {
        const id = stripQuotes(item.slice(2).trim());
        if (isJobId(id)) collecting.push(id);
        continue;
      }
      // Anything that is not a sequence item ends the list.
      collecting = null;
    }

    const prefix = "    needs:";
    // Exactly four-space indent — a deeper `needs:` belongs to something else (a step, a
    // reusable-workflow `with:` block), and must not be read as this job's.
    if (!line.startsWith(prefix) || line.startsWith("     ")) continue;
    const tail = line.slice(prefix.length).trim();
    const list: string[] = [];
    needs.set(current, list);
    if (tail.length === 0) {
      collecting = list; // block sequence follows
    } else if (tail.startsWith("[")) {
      for (const part of tail.replace(/^\[/, "").replace(/\]$/, "").split(",")) {
        const id = stripQuotes(part.trim());
        if (isJobId(id)) list.push(id);
      }
    } else {
      const id = stripQuotes(tail);
      if (isJobId(id)) list.push(id);
    }
  }
  return needs;
}

/** The workflow's top-level `name:` (column 0), or null. */
export function workflowName(yamlText: string): string | null {
  for (const rawLine of yamlText.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line.startsWith("name:")) continue;
    const value = stripQuotes(line.slice("name:".length).trim());
    return value.length > 0 ? value : null;
  }
  return null;
}

/**
 * Derive the blocking floor from a workflow file, or `null` when it cannot be derived.
 *
 * `null` is the fail-closed answer and every caller must treat it as "prove nothing".
 */
export function parseBlockingFloor(yamlText: string, rollupJobId: string = ROLLUP_JOB_ID): BlockingFloor | null {
  const workflow = workflowName(yamlText);
  if (workflow === null) return null;

  const names = gateYmlJobNames(yamlText);
  const needs = gateYmlJobNeeds(yamlText);
  // The roll-up must exist AND declare a `needs:` list. A roll-up with no needs would derive
  // an EMPTY floor, i.e. "nothing blocks", which is the permissive failure this file exists
  // to avoid — so it is refused rather than trusted.
  const rollupNeeds = needs.get(rollupJobId);
  if (rollupNeeds === undefined || rollupNeeds.length === 0) return null;

  // Transitive: a job the floor depends on is inside the floor's reach. Non-transitive would
  // call `matrix-setup` non-blocking even though every floor job needs it.
  const seen = new Set<string>([rollupJobId]);
  const queue = [...rollupNeeds];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const next of needs.get(id) ?? []) queue.push(next);
  }

  // A job with no `name:` is displayed by GitHub under its id, so the id IS the declared name.
  const declaredOf = (id: string): string => names.get(id) ?? id;
  const allIds = new Set<string>([...names.keys(), ...needs.keys()]);
  return {
    workflow,
    rollupJobName: declaredOf(rollupJobId),
    blocking: [...seen].map(declaredOf).sort(),
    declared: [...allIds].map(declaredOf).sort(),
  };
}

/** `.github/workflows/gate.yml`, relative to this file. */
export const GATE_YML_PATH = join(import.meta.dir, "..", "..", "..", ".github", "workflows", "gate.yml");

/**
 * The outcome of trying to read a floor off disk. Three states, and TWO of them are the
 * fail-closed one — an unreadable file and an unparseable file both yield no floor, i.e. the
 * pre-amendment behaviour where every mixed run is refused. They are distinguished only so
 * the caller can SAY which happened; a silently disabled policy is the vacuity class.
 */
export type FloorLoad =
  | { readonly status: "ok"; readonly path: string; readonly floor: BlockingFloor }
  | { readonly status: "unreadable" | "unparseable"; readonly path: string; readonly floor: undefined };

/**
 * Read the blocking floor from a workflow file on disk.
 *
 * THE PATH MUST BE A TRUSTED CHECKOUT. The sweeper's is the default branch, by construction
 * of its `on: schedule` trigger; fetching this file at a run's head SHA instead would let a
 * pull request declare its own failing job non-blocking.
 */
export function loadBlockingFloor(path: string = GATE_YML_PATH): FloorLoad {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return { status: "unreadable", path, floor: undefined };
  }
  const floor = parseBlockingFloor(text);
  return floor === null ? { status: "unparseable", path, floor: undefined } : { status: "ok", path, floor };
}

/**
 * Is this Actions-API job name PROVABLY unable to block?
 *
 * True only when the workflow declares the job and the job is outside the roll-up's `needs:`
 * closure. An unknown name (a job this workflow file does not declare — a rename, a job added
 * on the pull request's own branch, a job from a different workflow) answers false.
 */
export function isNonBlockingJob(jobName: string, floor: BlockingFloor | undefined): boolean {
  if (floor === undefined) return false;
  const known = floor.declared.some((d) => declaredNameMatchesJob(d, jobName));
  if (!known) return false;
  return !floor.blocking.some((d) => declaredNameMatchesJob(d, jobName));
}
