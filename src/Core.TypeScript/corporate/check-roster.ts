/**
 * corporate/check-roster.ts — a gate may be answered by running checks, and a check is data.
 *
 * ── WHAT THIS IS FOR ─────────────────────────────────────────────────────────
 * The repository's own CI already refuses a large class of defects that agents produce: a check
 * that cannot fail, a test whose verdict depends on wall-clock sleep, a sink with no source, a
 * "DISCHARGED" row whose evidence is absent, a property claimed at higher arity than it is tested
 * at. Those refusals run on a COMMIT, once it exists. The organization gates a WORK ITEM, and until
 * now its gates were answered by a review port with an opinion.
 *
 * This is the seam that lets a gate be answered by the same checks instead — not by copying them,
 * which would be a second roster to drift, but by RUNNING the roster the caller hands it.
 *
 * ── A CHECK IS DATA, AND THE ROSTER IS SOMEBODY ELSE'S ───────────────────────
 * Nothing here names an audit. A `CheckSpec` is an id, a command, and optionally the command that
 * proves that check can fail. Where the list comes from is the caller's business — the repo's CI
 * roster, an organization's own configuration, a single command somebody typed. That is what keeps
 * this generic: an organization pointed at another repository runs that repository's checks, and
 * this module never learns either one's vocabulary.
 *
 * ── KEYED BY THE TREE, NOT THE COMMIT ────────────────────────────────────────
 * A result is recorded against the git TREE the check ran on. Two commits with different messages,
 * authors or parents over identical content share a tree, so a check already run against that
 * content is not run again; keyed by commit it would rerun on every rebase, amend and cherry-pick,
 * which is most of what a working branch does. Keyed by neither — the shape a gate has today — a
 * verdict says nothing about WHICH code it judged, and "the artifact you edited is not the one that
 * ran" is a failure this register has already paid for more than once.
 *
 * ── AND A CHECK THAT CANNOT FAIL IS NOT EVIDENCE ─────────────────────────────
 * `gate.yml` pairs every audit with its own mutation suite in the same job — *"Observability chain
 * — mutation suite (proves it goes red)"*. That pairing is the reason those audits are trustworthy,
 * and it is carried here: a spec may name a `falsifier`, and a passing check whose falsifier did
 * not pass is reported as `Unproven` rather than as evidence. Otherwise the organization would have
 * imported the vacuity class into the one place it is most expensive — a gate that always says yes.
 */

import { spawnSync } from "node:child_process";

/** How much of a check's output to keep. Enough to act on, not enough to fill the log. */
export const MAX_CHECK_OUTPUT = 8_000;

export interface CheckSpec {
  /** Stable identity. It is half the cache key, so renaming one re-runs it — which is correct. */
  readonly id: string;
  /** One line for a person reading a verdict. */
  readonly title: string;
  /**
   * The command, as a shell line.
   *
   * A STRING RATHER THAN AN ARGV, because that is what a roster carries and what CI runs; see
   * `runCheck` for how it is executed and why that is not the same as `shell: true`.
   */
  readonly command: string;
  /** Relative to the workdir the check runs in. */
  readonly cwd?: string;
  /**
   * The command that proves THIS check can fail — its mutation suite, its own tests.
   *
   * Optional, and its absence is reported rather than assumed away: a check with no falsifier is
   * `Unproven`, which is a different verdict from `Passed` and must not be read as one.
   */
  readonly falsifier?: string;
}

export const CheckOutcome = {
  /** Ran, exited zero, and its falsifier passed — or it declared none and none was required. */
  Passed: "passed",
  /** Ran and exited non-zero. The finding is real. */
  Failed: "failed",
  /**
   * Exited zero, and nothing established that it COULD fail.
   *
   * Deliberately not `Passed`. A check whose falsifier is missing or itself failing has told you
   * nothing, and the whole reason this distinction exists is that "told you nothing" reads exactly
   * like "told you it is fine" once it is a green tick in a list.
   */
  Unproven: "unproven",
  /** The check could not be run at all — missing binary, bad cwd. Not a finding about the code. */
  Errored: "errored",
} as const;

export type CheckOutcome = (typeof CheckOutcome)[keyof typeof CheckOutcome];

export interface CheckResult {
  readonly checkId: string;
  readonly outcome: CheckOutcome;
  /** The git tree this ran against. The other half of the cache key. */
  readonly tree: string;
  readonly exitCode: number | undefined;
  /** Trimmed output — the part an operator or the next agent needs in order to act. */
  readonly detail: string;
  readonly durationMs: number;
  /** Whether a falsifier ran and passed. `undefined` means none was declared. */
  readonly falsifierPassed?: boolean;
}

/** Only these two count as evidence a gate may pass on. */
export function isEvidence(result: CheckResult): boolean {
  return result.outcome === CheckOutcome.Passed;
}

function trim(text: string): string {
  const clean = text.trim();
  return clean.length <= MAX_CHECK_OUTPUT ? clean : `${clean.slice(0, MAX_CHECK_OUTPUT)}\n…(truncated)`;
}

export interface RunOptions {
  /** Where the check runs — the change's own checkout. */
  readonly workdir: string;
  readonly timeoutMs?: number;
  /** Injected so a test can run checks without spawning anything. */
  readonly exec?: (command: string, cwd: string, timeoutMs: number) => {
    readonly status: number | null;
    readonly stdout: string;
    readonly stderr: string;
    readonly error?: Error;
  };
}

/**
 * Run one shell line and report how it went.
 *
 * ── `bash -c` IS NOT `shell: true` ───────────────────────────────────────────
 * Every other `spawnSync` in this register passes `shell: false`, because letting the platform
 * shell parse a command line is how an argument becomes an injection. That rule is kept here: the
 * command is handed to `bash` as a SINGLE ARGUMENT in an explicit argv, so nothing this process
 * builds is ever parsed as shell syntax by Node. Bash then interprets that one string, which is
 * exactly what the roster means by a command and exactly what CI does with the same line.
 *
 * `-euo pipefail` for the same reason CI uses it: without `pipefail` a failing command inside a
 * pipe reports the exit code of the LAST stage, so a check that failed reads as one that passed.
 */
function exec(
  command: string,
  cwd: string,
  timeoutMs: number,
): { status: number | null; stdout: string; stderr: string; error?: Error } {
  const run = spawnSync("bash", ["-euo", "pipefail", "-c", command], {
    cwd,
    encoding: "utf-8",
    timeout: timeoutMs,
    shell: false,
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    status: run.status,
    stdout: String(run.stdout ?? ""),
    stderr: String(run.stderr ?? ""),
    ...(run.error === undefined ? {} : { error: run.error }),
  };
}

export function runCheck(spec: CheckSpec, tree: string, options: RunOptions): CheckResult {
  const run = options.exec ?? exec;
  const timeoutMs = options.timeoutMs ?? 300_000;
  const cwd = spec.cwd === undefined ? options.workdir : `${options.workdir}/${spec.cwd}`;

  const began = Date.now();
  const out = run(spec.command, cwd, timeoutMs);
  const durationMs = Date.now() - began;

  if (out.error !== undefined) {
    // THE RUNNER BROKE, which is not the same as the check failing. Reporting this as `Failed`
    // would blame the change for a missing binary, and the change would be reworked to fix it.
    return {
      checkId: spec.id,
      outcome: CheckOutcome.Errored,
      tree,
      exitCode: undefined,
      detail: trim(`could not run: ${out.error.message}`),
      durationMs,
    };
  }

  if (out.status !== 0) {
    return {
      checkId: spec.id,
      outcome: CheckOutcome.Failed,
      tree,
      exitCode: out.status ?? undefined,
      // STDERR FIRST. A failing check says why there, and an operator reading a verdict needs the
      // reason before the transcript that led to it.
      detail: trim(`${out.stderr}\n${out.stdout}`),
      durationMs,
    };
  }

  // ── IT PASSED. NOW: COULD IT HAVE FAILED? ─────────────────────────────────
  if (spec.falsifier === undefined) {
    return {
      checkId: spec.id,
      outcome: CheckOutcome.Unproven,
      tree,
      exitCode: 0,
      detail: trim(`${out.stdout}\n(no falsifier declared: nothing establishes that this check can fail)`),
      durationMs,
    };
  }

  const proof = run(spec.falsifier, cwd, timeoutMs);
  const falsifierPassed = proof.error === undefined && proof.status === 0;
  return {
    checkId: spec.id,
    outcome: falsifierPassed ? CheckOutcome.Passed : CheckOutcome.Unproven,
    tree,
    exitCode: 0,
    detail: trim(
      falsifierPassed
        ? out.stdout
        : `${out.stdout}\n(the falsifier for this check did not pass, so its green is not evidence)\n${proof.stderr}`,
    ),
    durationMs,
    falsifierPassed,
  };
}

/** The shape a CI roster entry has, reduced to what a check needs. */
export interface RosterEntry {
  readonly id: string;
  readonly title: string;
  readonly command: string;
  readonly cwd?: string;
}

/**
 * Turn roster entries into checks, pairing each with its own falsifier where the roster names one.
 *
 * ── THE CONVENTION IS THE ROSTER'S, NOT THIS MODULE'S ────────────────────────
 * CI already pairs an audit with the suite that proves it can fail — `gate.yml` runs them in the
 * same job, one step apart, and the roster spells the second `<id>-tests`. Deriving the pairing
 * from that convention means the organization inherits every pairing CI already has, and inherits
 * the next one for free, without a mapping table here to drift.
 *
 * ── AND WHAT IT CANNOT PAIR, IT SAYS ─────────────────────────────────────────
 * MEASURED against this repository's own roster: 36 audits, 6 `-tests` entries, and only 4 of those
 * match their base by the exact rule — `heartbeat-lane-audit-tests` belongs to
 * `heartbeat-lane-attestations` and `tech-radar-audit-tests` to `tech-radar-claims`, neither of
 * which the suffix rule can see. GUESSING at those would be worse than missing them: a wrong
 * pairing reports a check as proven on the strength of a suite that tests something else.
 *
 * So the unpaired are RETURNED, not silently dropped. A check with no falsifier still runs and
 * still reports — as `Unproven`, which is the honest verdict for a green nothing can falsify.
 */
export function checksFromRoster(entries: readonly RosterEntry[]): {
  readonly specs: readonly CheckSpec[];
  /** Ids with no falsifier the rule could find. Their green will be reported as unproven. */
  readonly unpaired: readonly string[];
} {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const specs: CheckSpec[] = [];
  const unpaired: string[] = [];
  for (const entry of entries) {
    // A `-tests` entry is somebody's falsifier, not a check in its own right — including it would
    // run every suite twice and report each one as an unproven check of its own.
    if (entry.id.endsWith("-tests") && byId.has(entry.id.slice(0, -"-tests".length))) continue;
    const falsifier = byId.get(`${entry.id}-tests`);
    if (falsifier === undefined) unpaired.push(entry.id);
    specs.push({
      id: entry.id,
      title: entry.title,
      command: entry.command,
      ...(entry.cwd === undefined ? {} : { cwd: entry.cwd }),
      ...(falsifier === undefined ? {} : { falsifier: falsifier.command }),
    });
  }
  return { specs, unpaired };
}

/**
 * Which checks answer which gate.
 *
 * ── DATA, THE SAME WAY A SKILL BINDING IS DATA ───────────────────────────────
 * The alternative was a table in code mapping `implementation_review` to a list of audit ids, which
 * is the questionnaire mistake in another costume: it works for the gates and the checks its author
 * knew about, and every organization that wants a different pipeline has to change this file.
 *
 * EMPTY IS THE NORMAL CASE. An organization with no bindings runs its gates the way it always has —
 * the review port answers them. Binding is an override somebody chose, per gate, and a gate with no
 * binding is not "verified by nothing", it is "verified the way it was before".
 */
export interface CheckBinding {
  readonly gate: string;
  /** Roster ids. An id nothing matches is reported by `selectChecks`, never silently dropped. */
  readonly checkIds: readonly string[];
  /**
   * Restrict this binding to one work item and everything under it.
   *
   * Absent means organization-wide — the same scoping rule skill bindings use, so an operator who
   * has learned one has learned both.
   */
  readonly scopeWorkId?: string;
}

/** The check ids bound to a gate, narrowest scope first. */
export function checkIdsFor(
  bindings: readonly CheckBinding[],
  gate: string,
  workIds: readonly string[] = [],
): readonly string[] {
  const forGate = bindings.filter((b) => b.gate === gate);
  // A SCOPED BINDING WINS OVER A GLOBAL ONE, because that is what scoping it was for. Without this
  // a project-specific pipeline would be unioned with the organization's default and quietly run
  // both, which is the opposite of what "this project follows a different pipeline" means.
  const scoped = forGate.filter((b) => b.scopeWorkId !== undefined && workIds.includes(b.scopeWorkId));
  const chosen = scoped.length > 0 ? scoped : forGate.filter((b) => b.scopeWorkId === undefined);
  return [...new Set(chosen.flatMap((b) => b.checkIds))];
}

/** Only the checks a binding names, in the roster's order. Unknown ids are REPORTED, never ignored. */
export function selectChecks(
  specs: readonly CheckSpec[],
  ids: readonly string[],
): { readonly selected: readonly CheckSpec[]; readonly unknown: readonly string[] } {
  const byId = new Map(specs.map((s) => [s.id, s]));
  // An id nobody recognises is a typo in a binding, and a binding that silently matches nothing is
  // a gate that silently verifies nothing — the vacuity class, entered through configuration.
  return {
    selected: specs.filter((s) => ids.includes(s.id)),
    unknown: ids.filter((id) => !byId.has(id)),
  };
}

/**
 * The cache key. Both halves matter: the same check on new content, or a new check on old content.
 *
 * LENGTH-PREFIXED, the same shape `externalRefOf` uses and for the same reason. A plain
 * `${tree}:${checkId}` makes tree `a` + check `b:c` and tree `a:b` + check `c` into one key, so two
 * unrelated verdicts become one and the loser is served as if it were the winner. A tree is always
 * 40 hex today and cannot contain a colon — which is exactly the argument that lets a key like that
 * survive until the day something else is keyed the same way.
 */
export function checkKey(tree: string, checkId: string): string {
  return `${String(tree.length)}:${tree}|${String(checkId.length)}:${checkId}`;
}

export interface RosterRun {
  readonly results: readonly CheckResult[];
  /** Checks answered from the record rather than re-run. */
  readonly reused: readonly string[];
  /** Every check passed AND proved it could fail. */
  readonly clean: boolean;
  /** Checks whose green established nothing — reported separately from failures on purpose. */
  readonly unproven: readonly string[];
}

/**
 * Run a roster against one tree, reusing anything already recorded for that exact tree.
 *
 * `known` is folded from the organization's own log by the caller — which is what makes the reuse
 * survive a restart, and what ties this to the indexed history rather than to a cache in memory
 * that a second process cannot see.
 */
export function runRoster(
  specs: readonly CheckSpec[],
  tree: string,
  options: RunOptions,
  known: ReadonlyMap<string, CheckResult> = new Map(),
): RosterRun {
  const results: CheckResult[] = [];
  const reused: string[] = [];
  for (const spec of specs) {
    const cached = known.get(checkKey(tree, spec.id));
    if (cached !== undefined) {
      results.push(cached);
      reused.push(spec.id);
      continue;
    }
    results.push(runCheck(spec, tree, options));
  }
  return {
    results,
    reused,
    // AN EMPTY ROSTER IS NOT CLEAN. `[].every()` is vacuously true, so a gate bound to no checks
    // would pass having run nothing — approval by having nothing to satisfy, which is the exact
    // shape `change-control` already refuses when a work item owes no gates.
    clean: specs.length > 0 && results.every(isEvidence),
    unproven: results.filter((r) => r.outcome === CheckOutcome.Unproven).map((r) => r.checkId),
  };
}

/** One line per check, for a verdict a person reads. */
export function summarize(run: RosterRun): string {
  if (run.results.length === 0) return "no checks were bound to this gate, so nothing was verified";
  const failed = run.results.filter((r) => r.outcome === CheckOutcome.Failed);
  const errored = run.results.filter((r) => r.outcome === CheckOutcome.Errored);
  const parts = [`${String(run.results.length)} check(s)`];
  if (failed.length > 0) parts.push(`${String(failed.length)} FAILED: ${failed.map((r) => r.checkId).join(", ")}`);
  if (errored.length > 0) parts.push(`${String(errored.length)} could not run: ${errored.map((r) => r.checkId).join(", ")}`);
  if (run.unproven.length > 0) parts.push(`${String(run.unproven.length)} UNPROVEN (green, but nothing shows it can fail): ${run.unproven.join(", ")}`);
  if (run.reused.length > 0) parts.push(`${String(run.reused.length)} reused for this tree`);
  return parts.join("; ");
}
