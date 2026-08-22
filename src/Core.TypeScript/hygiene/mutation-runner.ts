#!/usr/bin/env bun
/**
 * mutation-runner.ts — the society's standing job: find tests that cannot fail.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (2026-08-01)
 *
 * A passing test proves nothing until you know it can fail. On 2026-08-01 that gap produced, in
 * one day: six unfalsifiable "discharges" promoted into the frozen core, and a cache whose test
 * was named "reclaims unreachable cache entries" while its only assertion was
 * `expect(remaining).toBeGreaterThanOrEqual(0)` — a count, non-negative by construction, true for
 * every possible value. Disabling the retraction entirely left it 3 pass / 0 fail.
 *
 * Every one of those was caught by hand. Hand-catching does not scale and is the most expensive
 * tier there is. This mechanises it.
 *
 * WHY THE FREE-TIER FLEET IS THE RIGHT RUNNER — and it is not about capability:
 *   - ZERO JUDGEMENT. Flip `>=` to `>`, run the suite. Survived ⇒ finding. No model has to be
 *     *right* about anything; it only has to run a command and compare exit codes.
 *   - EMBARRASSINGLY PARALLEL. One mutant per agent per tick. No consensus, no shared state, no
 *     ordering. Adding members adds throughput at zero coordination cost (#1 scale-free).
 *   - SELF-VERIFYING. The output is a fact ("this suite passed with this mutation applied"), not
 *     an opinion. It survives the question every agent-produced claim must survive: could this
 *     agent have been wrong? Here, no — the exit code is the finding.
 *
 * It is a DRIFT REPORT, NOT A GATE. Trunk-based development at thousands of pushes a day does not
 * want another blocker; it wants detection latency near zero. A surviving mutant is reported and
 * healed, never prevented — retraction over prevention, applied to test quality.
 *
 * TWO SEPARATE LEVERS, do not confuse them: bounding BLAST RADIUS limits how much one bad push
 * can touch (see run-tier0.ts `--max-files`). This bounds DETECTION LATENCY — how long something
 * broken can sit on main looking green. The vacuous sweep test had a tiny blast radius and
 * unbounded detection latency, and scored perfectly on every check we had.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * Exit codes:
 *   0 — ran; no surviving mutants (or nothing eligible to mutate)
 *   1 — usage / fatal error, INCLUDING an unrecognised argument (refused before any write)
 *   3 — SURVIVING MUTANT: a test suite passed with the code deliberately broken. A finding.
 *
 * Usage:
 *   bun mutation-runner.ts --agent otto --tick 42 [--since 6h] [--dry-run]
 *   bun mutation-runner.ts --agent otto --tick 42 --choose 0 --reason "why"   (act on the menu)
 *   bun mutation-runner.ts --agent otto --room "src/a.ts::src/a.test.ts::false-to-true" \
 *       --choose 0 --reason "why"                                            (act on a dimension you did not roll)
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  appendTranscript,
  declareFreedom,
  loadAllLedgers,
  supersedeFreedom,
  viewOf,
} from "./mutation-freedoms";
import { ESCAPE_INDEX, execute, observeFinding, roomOf } from "./mutation-readout";
import { appendFinding, makeFinding, type FindingOutcome } from "./mutation-findings";

/** A single mechanical edit. `find` must be a literal so application is exact and reversible. */
export interface Mutation {
  readonly name: string;
  readonly find: string;
  readonly replace: string;
}

/**
 * The mutation catalogue. Deliberately small and mechanical — each one changes behaviour in a way
 * ANY honest test of that line must notice. Nothing here requires understanding the code.
 */
export const MUTATIONS: readonly Mutation[] = [
  { name: "gte-to-gt", find: " >= ", replace: " > " },
  { name: "lte-to-lt", find: " <= ", replace: " < " },
  { name: "eq-to-neq", find: " === ", replace: " !== " },
  { name: "and-to-or", find: " && ", replace: " || " },
  { name: "plus-to-minus", find: " + ", replace: " - " },
  { name: "true-to-false", find: "return true;", replace: "return false;" },
  { name: "false-to-true", find: "return false;", replace: "return true;" },
  { name: "zero-to-one", find: "=== 0", replace: "=== 1" },
];

/**
 * DETERMINISTIC selection — no RNG, no clock.
 *
 * Ambient randomness would make a finding unreproducible and break DST (#7) and noninterference
 * (#13): entropy must enter only through declared channels, and here the declared channel is the
 * (agent, tick) pair the caller passes in. Same inputs ⇒ same mutant, on every machine, forever.
 * It is also what removes the need for coordination: two agents with different ids pick different
 * work without ever exchanging a message.
 */
export function selectTarget<T>(items: readonly T[], agent: string, tick: number): T | null {
  if (items.length === 0) return null;
  let h = 2166136261 >>> 0; // FNV-1a over the agent name, then folded with the tick
  for (let i = 0; i < agent.length; i++) {
    h ^= agent.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h = (h ^ (tick >>> 0)) >>> 0;
  h = Math.imul(h, 16777619) >>> 0;
  return items[h % items.length]!;
}

/** The first mutation in the catalogue that actually appears in `source`, chosen deterministically. */
export function pickMutation(source: string, agent: string, tick: number): Mutation | null {
  const applicable = MUTATIONS.filter((m) => isApplicable(source, m));
  return selectTarget(applicable, agent, tick);
}

/**
 * Is this line a comment (and therefore behaviourally inert)?
 *
 * Mutating a comment ALWAYS "survives" — nothing changed, so no test can notice. That is a false
 * positive, and false positives are how a drift report becomes noise nobody reads. Found by
 * validating this runner against real code: the first ` >= ` in ephemeral-task-hierarchy.ts is on
 * line 8, inside the docstring, and the runner duly reported a surviving mutant on a file whose
 * invariants are in fact well covered.
 */
export function isCommentLine(line: string): boolean {
  const t = line.trimStart();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

/**
 * Apply a mutation to the first occurrence ON A NON-COMMENT LINE — one behavioural change per
 * run, never a sweep. Returns the source unchanged if every occurrence is inert.
 */
export function applyMutation(source: string, m: Mutation): string {
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (isCommentLine(line) || !line.includes(m.find)) continue;
    // Also skip an occurrence that sits after a trailing `//` on an otherwise-live line.
    const idx = line.indexOf(m.find);
    const comment = line.indexOf("//");
    if (comment >= 0 && comment < idx) continue;
    lines[i] = line.replace(m.find, m.replace);
    return lines.join("\n");
  }
  return source;
}

/** Does this mutation have any BEHAVIOURAL site in the source? (comments do not count.) */
export function isApplicable(source: string, m: Mutation): boolean {
  return applyMutation(source, m) !== source;
}

/** A source file paired with the test file that is supposed to cover it. */
export interface Target {
  readonly source: string;
  readonly test: string;
}

/** Pair `foo.ts` with `foo.test.ts`, keeping only pairs where both exist. */
export function pairWithTests(files: readonly string[], root: string): readonly Target[] {
  const out: Target[] = [];
  for (const f of files) {
    if (!f.endsWith(".ts") || f.endsWith(".test.ts") || f.endsWith(".d.ts")) continue;
    const test = f.replace(/\.ts$/, ".test.ts");
    if (existsSync(join(root, f)) && existsSync(join(root, test))) out.push({ source: f, test });
  }
  return out;
}

/**
 * The NEUTRAL FACT the runner observes. Deliberately NOT `survived: boolean`.
 *
 * A boolean collapses a dual-use observation into one bit and picks the adversarial reading in the
 * name. What the runner actually establishes is whether the suite could TELL THE VARIANTS APART —
 * and whether that indistinguishability is a gap or a declared freedom is UNDECIDABLE in general
 * (Budd & Angluin 1982). The runner is therefore not entitled to a verdict; it reports the fact and
 * a declarer attaches the reading (`mutation-freedoms.ts`).
 */
export type Distinguishability =
  /** The suite separated the variant from the baseline — it constrains this behaviour. */
  | { readonly kind: "distinguished-by-suite" }
  /** The suite could NOT separate them. Gap or freedom is the caller's oracle to decide. */
  | { readonly kind: "indistinguishable-under-suite" }
  /**
   * The run established NOTHING, and says so instead of guessing.
   *
   * SLAM's rule, applied (research §2a): when the procedure runs out of what it needs, the honest
   * output is "unresolved", never a verdict wearing a verdict's name. Two ways to get here, both
   * found by running this against real code on 2026-08-11:
   *
   * - the baseline suite was ALREADY failing, so a non-zero exit under mutation proves nothing —
   *   reporting `distinguished` there credits the tests for a difference they never detected;
   * - the suite EXITED 0 WITHOUT RUNNING (or ran fewer tests than baseline). `drift-genome.ts`
   *   guards its CLI with `typeof process.argv[1] === "string" && /drift-genome\.ts$/.test(...)`;
   *   flipping that to `||` makes the guard true under the test runner, so importing the module
   *   executed the CLI and called `process.exit(0)` — zero tests ran, exit code 0, and the old
   *   oracle read that as "indistinguishable". A suite that never ran is not a suite that agreed.
   */
  | { readonly kind: "unresolved"; readonly why: string };

/** Bun reports `Ran N tests across M files.` — absent means the suite never got that far. */
export function testsExecuted(output: string): number | null {
  const m = /^Ran (\d+) tests?/m.exec(output);
  return m ? Number(m[1]) : null;
}

export interface Finding {
  readonly source: string;
  readonly test: string;
  readonly mutation: string;
  readonly distinguishability: Distinguishability;
}

/** Convenience predicate. Reads as the fact, not as a body count. */
export function isIndistinguishable(f: Finding): boolean {
  return f.distinguishability.kind === "indistinguishable-under-suite";
}

/**
 * Mutate, run the suite, ALWAYS restore.
 *
 * The restore is in a `finally` and is not optional: this writes to the working tree of a live
 * repository. A crash between mutate and restore would leave deliberately-broken code on disk,
 * and in a trunk-based repo that is one careless `git add -A` away from being pushed. The healer
 * shipped an unused import the same day; assume the same class of accident here.
 */
export function runMutant(root: string, target: Target, m: Mutation): Finding {
  const srcPath = join(root, target.source);
  const original = readFileSync(srcPath, "utf8");
  const fact = (distinguishability: Distinguishability): Finding => ({
    source: target.source,
    test: target.test,
    mutation: m.name,
    distinguishability,
  });

  const runSuite = () => {
    const r = spawnSync("bun", ["test", target.test], { cwd: root, encoding: "utf8", timeout: 120_000 });
    return { status: r.status, ran: testsExecuted(`${r.stdout ?? ""}\n${r.stderr ?? ""}`) };
  };

  // BASELINE FIRST, on unmutated source. Without it the exit code is ambiguous in both directions:
  // a red baseline makes any non-zero exit look like the suite caught the mutation, and a suite that
  // never runs looks like a suite that passed. Costs one extra run of a single test file per tick.
  const base = runSuite();
  if (base.status !== 0) {
    return fact({
      kind: "unresolved",
      why: `the suite was ALREADY failing before any mutation (exit ${String(base.status)}); a non-zero exit under mutation would prove nothing`,
    });
  }
  if (base.ran === null || base.ran === 0) {
    return fact({
      kind: "unresolved",
      why: "the baseline run reported no executed tests, so there is no signal to compare a mutant against",
    });
  }

  try {
    writeFileSync(srcPath, applyMutation(original, m));
    const mut = runSuite();
    if (mut.status !== 0) return fact({ kind: "distinguished-by-suite" });
    // Exit 0 is necessary but NOT sufficient: it must also be the case that the tests actually ran.
    if (mut.ran === null || mut.ran < base.ran) {
      return fact({
        kind: "unresolved",
        why:
          `the mutant exited 0 but the suite did not run to completion — ${mut.ran === null ? "none" : String(mut.ran)} ` +
          `of ${String(base.ran)} baseline tests executed. An early exit is not agreement`,
      });
    }
    // Exit 0 with the full baseline complement run: the suite genuinely could not tell them apart.
    // That is the FACT. Whether it is a gap or a freedom is not decided here.
    return fact({ kind: "indistinguishable-under-suite" });
  } finally {
    writeFileSync(srcPath, original);
  }
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Flags that consume the following token as their value. */
const VALUE_FLAGS: ReadonlySet<string> = new Set([
  "--repo-root",
  "--agent",
  "--tick",
  "--since",
  "--room",
  "--choose",
  "--reason",
]);
/** Flags that stand alone. */
const BOOLEAN_FLAGS: ReadonlySet<string> = new Set(["--dry-run"]);

/**
 * FAIL CLOSED ON AN UNRECOGNISED ARGUMENT — 081M03HRHBS087G0R001HRAFQ0.
 *
 * This runner writes a mutant INTO a source file and restores it in a `finally`. A crash between
 * those two points leaves the mutant in the tree, and it appends to `db/mutation-findings/`. Under
 * `argv.includes("--dry-run")` every string that is not exactly `--dry-run` — `--dry-runn`,
 * `--dryrun`, `--help` — authorised all of that. PR #10832 probed a sibling tool with `--help`
 * and started a ~1,700-file rewrite; the shape was identical.
 *
 * Exit 1 (the documented usage/fatal code), never 3/4/5 — those are FINDINGS the heartbeat renders
 * into the run summary, and a mistyped flag must not be able to publish itself as a measurement.
 *
 * Called as the FIRST statement of `main()`, above every write path. The phrase `unknown arg` is
 * also what `hygiene/audit-workflow-cli-flags.ts` looks for to decide a parser has a closed flag
 * set; without it this tool was *skipped* by the lint that checks `agent-heartbeat.yml`'s
 * invocation of it. Reword the phrase and the tool silently leaves that lint's scope.
 */
function rejectUnknownArgs(argv: readonly string[]): void {
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (VALUE_FLAGS.has(arg)) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        console.error(`[mutation] FATAL: ${arg} requires a value.`);
        process.exit(1);
      }
      i++; // consume the value; it is not a stray positional
      continue;
    }
    if (BOOLEAN_FLAGS.has(arg)) continue;
    console.error(
      `unknown arg: ${arg}\n` +
        `[mutation] REFUSED — no mutant was written. Accepted: ` +
        `${[...VALUE_FLAGS, ...BOOLEAN_FLAGS].sort().join(" ")}`,
    );
    process.exit(1);
  }
}

function main(): void {
  rejectUnknownArgs(process.argv.slice(2));

  const root = argValue("--repo-root") ?? process.cwd();
  const agent = argValue("--agent") ?? "unknown";
  const tick = Number(argValue("--tick") ?? "0");
  const since = argValue("--since") ?? "24 hours ago";
  const dryRun = process.argv.includes("--dry-run");

  if (!Number.isFinite(tick)) {
    console.error("[mutation] FATAL: --tick must be a number (it seeds deterministic selection).");
    process.exit(1);
  }

  // `--room source::test::mutation` — act on a dimension you did NOT personally roll.
  //
  // Selection is deterministic from (agent, tick), which is what makes the fleet cover different
  // files with zero coordination. But it also meant a declarer could only ever respond to its OWN
  // roll: a finding learned from another agent, a review, or a previous tick was unreachable, and
  // the only ways to record a judgement about it were to write another agent's ledger (putting
  // words in their view) or to hand-edit JSON (bypassing the menu entirely). Both are worse than
  // the flag this design replaced.
  //
  // This does NOT reintroduce the unbounded write path: the readout is still built the same way,
  // the choice is still a CELL, the reason is still required, and the entry is still appended.
  // Only the target becomes explicit instead of tick-derived.
  const roomArg = argValue("--room");
  if (roomArg !== undefined) {
    const parts = roomArg.split("::");
    if (parts.length !== 3 || parts.some((p) => p.trim() === "")) {
      console.error(`[mutation] FATAL: --room must be "source::test::mutation" (got ${JSON.stringify(roomArg)})`);
      process.exit(1);
    }
    const [source, test, mutationName] = parts as [string, string, string];
    const ledgersNow = loadAllLedgers(root);
    const readoutNow = observeFinding({ source, test, mutation: mutationName }, agent, ledgersNow);

    const chooseNow = argValue("--choose");
    if (chooseNow === undefined) {
      console.error(`[mutation] ${agent}: ${source} :: ${test} :: ${mutationName}`);
      for (const cell of readoutNow.grid) {
        if (cell) console.error(`    [${String(cell.index).padStart(2)}] ${cell.label}`);
      }
      console.error(`    rules: ${readoutNow.rulesApplied.join(" ")}`);
      process.exit(0);
    }

    const entry = execute(readoutNow, agent, Number(chooseNow), argValue("--reason") ?? "", {
      declare: (f) => declareFreedom(root, agent, f),
      supersede: (r, why) => supersedeFreedom(root, agent, r, why),
      append: (e) => appendTranscript(root, agent, e),
      now: () => new Date().toISOString(),
    });
    console.error(
      `[mutation] ${agent} chose [${chooseNow}] ${entry.action.kind} on ${source} — appended ${entry.address.slice(0, 16)}…`,
    );
    process.exit(0);
  }

  // Recently-changed files only: mutation-test what just landed, where detection latency matters
  // most. Scanning the whole repo every tick would be slower and would re-report old findings.
  const changed = spawnSync("git", ["log", `--since=${since}`, "--name-only", "--pretty=format:"], {
    cwd: root,
    encoding: "utf8",
  });
  const files = [...new Set((changed.stdout ?? "").split("\n").map((s) => s.trim()).filter(Boolean))];

  // DISTINGUISH "nothing happened" FROM "I CANNOT SEE" — the defect this tool exists to find, which
  // it shipped with. `--since=24h` is NOT valid git approxidate: git does not error on it, it
  // silently matches zero commits. Verified: --since="24h" -> 0 commits, --since="24 hours ago" ->
  // 175, on the same repo at the same moment. The runner would have reported "nothing to do" on
  // every tick forever while looking perfectly healthy.
  //
  // Zero commits in the window is almost always a BAD DATE SPEC, not a quiet repo, so it is a
  // ::warning:: and a non-zero exit — never a cheerful no-op. Zero *pairs* among real commits is a
  // legitimate quiet result and stays informational.
  if (files.length === 0) {
    console.error(
      `::warning::[mutation] ${agent}: git log --since="${since}" returned NO FILES AT ALL.\n` +
        `  That is usually an unparseable date, not a quiet repo — git approxidate silently matches\n` +
        `  nothing rather than erroring (e.g. "24h" is invalid; "24 hours ago" is not).\n` +
        `  Refusing to report "nothing to do" over a window that may not exist.`,
    );
    process.exit(1);
  }

  const targets = pairWithTests(files, root);

  if (targets.length === 0) {
    console.log(
      `[mutation] ${agent}: ${files.length} file(s) changed in the last ${since}, but no source+test` +
        ` pairs among them — nothing to mutate.`,
    );
    return;
  }

  const target = selectTarget(targets, agent, tick)!;
  const source = readFileSync(join(root, target.source), "utf8");
  const mutation = pickMutation(source, agent, tick);

  if (!mutation) {
    console.log(`[mutation] ${agent}: no applicable mutation for ${target.source} — nothing to do.`);
    return;
  }

  console.log(`[mutation] ${agent} tick=${tick}: ${mutation.name} -> ${target.source} (suite: ${target.test})`);

  if (dryRun) {
    console.log(`[mutation] DRY RUN — no file written, no suite run.`);
    return;
  }

  const finding = runMutant(root, target, mutation);

  // RECORD THE OBSERVATION, whatever it was. This is the DENOMINATOR: without it the false-alarm
  // rate can only be false/RESOLVED, and resolution is voluntary — a biased sample by construction.
  // Recorded for all three outcomes, including `distinguished`, because "the suite did its job" is
  // exactly the population an alarm rate is a fraction OF. Idempotent by content address, so a
  // re-run of the same tick collapses instead of inflating the denominator.
  const outcome: FindingOutcome =
    finding.distinguishability.kind === "unresolved"
      ? "unresolved"
      : finding.distinguishability.kind === "indistinguishable-under-suite"
        ? "indistinguishable"
        : "distinguished";
  appendFinding(
    root,
    makeFinding({
      source: finding.source,
      test: finding.test,
      mutation: finding.mutation,
      agent,
      tick,
      outcome,
    }),
  );

  // The declarer's OWN view decides what is reportable — two agents may legitimately disagree
  // about whether a dimension is a gap or a freedom, and that disagreement is preserved rather
  // than averaged away (`mutation-freedoms.ts`).
  // UNRESOLVED short-circuits everything below: with no signal, there is no fact to report, no
  // freedom to check it against, and no cell that would be an honest response. Surfacing it as its
  // own outcome is the whole point — the alternative is a verdict the run did not earn.
  if (finding.distinguishability.kind === "unresolved") {
    console.error(
      `::warning file=${finding.source}::[mutation] UNRESOLVED — ${finding.distinguishability.why}`,
    );
    console.error(
      `\n[mutation] ? UNRESOLVED — the run established nothing.\n` +
        `  file:     ${finding.source}\n` +
        `  suite:    ${finding.test}\n` +
        `  mutation: ${finding.mutation}\n` +
        `  why:      ${finding.distinguishability.why}\n\n` +
        `  This is NOT a finding and NOT a clean bill of health. Fix the suite (or the reason it\n` +
        `  cannot run) and the next tick will produce a real answer.\n`,
    );
    process.exit(5);
  }

  const ledgers = loadAllLedgers(root);
  const view = viewOf(ledgers, agent, {
    source: finding.source,
    test: finding.test,
    mutation: finding.mutation,
  });

  if (isIndistinguishable(finding)) {
    if (view.mine) {
      // Coexisting: a dimension this declarer has already called free. Silent by design — the
      // per-tick drift correction is that KNOWN freedoms stop costing attention, so what remains
      // in the report is only what is genuinely unexplained.
      console.log(
        `[mutation] ~ indistinguishable, and DECLARED FREE by ${agent} — coexisting, not a finding.\n` +
          `  ${finding.source} :: ${finding.test} :: ${finding.mutation}\n` +
          `  reason: ${view.mine.reason}` +
          (view.contested
            ? `\n  NOTE: contested — other declarers do not all agree this is free.`
            : ""),
      );
      return;
    }

    console.error(
      `\n[mutation] ✗ INDISTINGUISHABLE UNDER SUITE — and not declared free by ${agent}.\n` +
        `  file:     ${finding.source}\n` +
        `  suite:    ${finding.test}\n` +
        `  mutation: ${finding.mutation}\n\n` +
        `  This is a FACT, not a verdict: ${finding.test} cannot separate the real implementation\n` +
        `  from this variant. Deciding whether that is a TEST GAP or a genuine DEGREE OF FREEDOM is\n` +
        `  undecidable in general (Budd & Angluin 1982), so the runner does not decide it.\n\n` +
        `  Two honest responses:\n` +
        `    - under-specified   -> write the test, re-run, confirm it goes red;\n` +
        `    - free by design    -> declare it in db/mutation-freedoms/${agent}.json with a REASON.\n` +
        (view.othersDeclaring.length > 0
          ? `\n  DISAGREEMENT: ${view.othersDeclaring.join(", ")} already declare this dimension free.\n` +
            `  That is not an error — it means the specification is genuinely ambiguous here, which\n` +
            `  is worth knowing. Read their reason before writing a test that contradicts it.\n`
          : ""),
    );

    // The bounded action grammar for this finding. The response is a CELL, not a flag: an agent
    // cannot invent a response, and the menu it was shown is reconstructible from `rules` so the
    // choice replays.
    const readout = observeFinding(roomOf(finding), agent, ledgers);

    // `--choose N [--reason "..."]` executes one cell. This is NOT the free-text `--declare` the
    // design rejected: the index must name a cell on a menu that was deterministically built, so
    // the action is bounded even though the judgement behind it is not.
    const chooseArg = argValue("--choose");
    if (chooseArg !== undefined) {
      const idx = Number(chooseArg);
      const entry = execute(readout, agent, idx, argValue("--reason") ?? "", {
        declare: (f) => declareFreedom(root, agent, f),
        supersede: (r, why) => supersedeFreedom(root, agent, r, why),
        append: (e) => appendTranscript(root, agent, e),
        now: () => new Date().toISOString(),
      });
      console.error(
        `\n[mutation] chose [${idx}] ${entry.action.kind} — appended ${entry.address.slice(0, 16)}…\n` +
          `  The FORK is recorded, not just the destination: ${entry.offered.filter(Boolean).length} cells were offered.\n`,
      );
      // Still a finding this tick — choosing does not make it green. The next run sees the ledger.
      process.exit(3);
    }

    // ::warning:: on the FINDING itself. Until 2026-08-11 the only annotation in this file was on
    // the "no files matched" edge case, so the workflow's comment claiming "the ::warning:: keeps
    // the finding loud" was false for the case it cared about — the finding was buried in log
    // output while the edge case was loud. Annotations are single-line; the detail stays below.
    console.error(
      `::warning file=${finding.source}::[mutation] indistinguishable under ${finding.test} ` +
        `(${finding.mutation}) — not declared free by ${agent}. Choose a cell or declare it.`,
    );

    console.error(`  ── what you may do (4x4 controller grammar, ${ESCAPE_INDEX + 1} cells) ──`);
    for (const cell of readout.grid) {
      if (cell) console.error(`    [${String(cell.index).padStart(2)}] ${cell.label}`);
    }
    console.error(
      `    (empty slots are UNDEFINED, not forbidden — choosing one is how the grammar grows)\n` +
        `    rules: ${readout.rulesApplied.join(" ")}\n`,
    );
    process.exit(3);
  }

  // Distinguished. Normally unremarkable — EXCEPT where someone declared this dimension free, in
  // which case the specification just got TIGHTER and that is a finding today invisible.
  if (view.mine || view.othersDeclaring.length > 0) {
    const holders = [...(view.mine ? [agent] : []), ...view.othersDeclaring].join(", ");
    console.error(
      `\n[mutation] ! SPECIFICATION TIGHTENED — a dimension declared FREE is now constrained.\n` +
        `  file:     ${finding.source}\n` +
        `  suite:    ${finding.test}\n` +
        `  mutation: ${finding.mutation}\n` +
        `  declared free by: ${holders}\n\n` +
        `  The suite now separates a variant that was previously believed unconstrained. Either a\n` +
        `  test was added deliberately — retract the freedom, giving a reason — or a test began\n` +
        `  constraining something by accident, which is drift in the other direction.\n`,
    );
    console.error(
      `::warning file=${finding.source}::[mutation] SPECIFICATION TIGHTENED — ${finding.mutation} ` +
        `is now caught by ${finding.test}, but ${holders} declared it free. Retract or investigate.`,
    );
    process.exit(4);
  }

  console.log(
    `[mutation] ✓ distinguished — ${target.test} separates ${mutation.name}. The suite constrains this.`,
  );
}

if (import.meta.main) main();
