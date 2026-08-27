#!/usr/bin/env bun
/**
 * perf-regression-ledger.ts — how often does a performance assertion actually regress?
 *
 * WHY THIS EXISTS. On 2026-08-27 `gate (required)` went red on PR #15636 because
 * `ColumnLinearOpsTests.ColumnLinear vectorized filter is measurably faster on unpredictable
 * data` measured **0.93x** against a 1.5x gate — 1 failure in 5921 tests, on a
 * TypeScript-only change. A wall-clock ratio asserted inside the required floor can fail for
 * reasons that carry no information about the code: a noisy neighbour, a different CPU model
 * in the runner pool, a thermal event. It can also fail because the vector path genuinely
 * stopped being taken, which is the whole reason the assertion exists.
 *
 * Those two readings are indistinguishable from ONE observation, and that is the actual
 * problem. Deleting the assertion throws away a real detector; leaving it un-instrumented
 * means every red is argued from memory. This file does not decide whether to keep the gate.
 * It makes the question answerable.
 *
 * THE SPLIT THAT MATTERS, and the reason this is not merely a failure counter:
 *
 *   - a **flake** is an isolated miss surrounded by passes — the machine, not the code
 *   - a **regression** is a SUSTAINED miss — consecutive observations below the gate
 *
 * A counter conflates them, and a conflated number is exactly what lets a real regression
 * hide inside a reputation for flakiness. `longestMissStreak` is therefore reported
 * separately from `missRate`, and neither is derived from the other.
 *
 * THE DENOMINATOR IS PART OF THE MEASUREMENT. A run in which the assertion PASSED is an
 * observation, and a ledger that records only failures reports a rate over an unknown
 * denominator — the same defect as counting failures on a `main` where most runs never
 * finished. With zero observations the register is `unknown`, never `clean`: unmeasured is
 * not the same as healthy, and this file refuses to render it as healthy.
 *
 * §13 noninterference: the observation stream enters as an argument, never through an
 * ambient read. The fold is pure and replays deterministically from the same inputs (§7 DST).
 */

/** One perf assertion, one run. `measured` and `gate` are in the assertion's own unit. */
export interface PerfObservation {
  /** Fully-qualified test name. Half of the ledger key. */
  readonly test: string;
  /** What was measured — `speedup`, `allocations`, `ms`. Free text, recorded verbatim. */
  readonly metric: string;
  /** The measured value. */
  readonly measured: number;
  /** The threshold the assertion compared against. */
  readonly gate: number;
  /** `true` when the assertion held. RECORDED, never re-derived from `measured` vs `gate`. */
  readonly pass: boolean;
  /** Build configuration. A Debug gate and a Release gate are different assertions. */
  readonly config: string;
  /** Runner OS/label. A ratio is a claim about hardware, so the hardware is part of the datum. */
  readonly runner: string;
  /** ISO 8601 instant of the observation. */
  readonly at: string;
  /** Commit under test. */
  readonly sha: string;
}

export type PerfRegister = "regression" | "flaky" | "clean" | "unknown";

/** The per-test fold. */
export interface PerfTestRoll {
  readonly test: string;
  readonly config: string;
  /** Total observations — passes AND misses. The denominator, stated. */
  readonly observations: number;
  /** Observations where the assertion did not hold. */
  readonly misses: number;
  /** `misses / observations`, or `null` when there is nothing to divide by. */
  readonly missRate: number | null;
  /** Longest run of CONSECUTIVE misses anywhere in the window. */
  readonly longestMissStreak: number;
  /** Misses at the newest end. A live regression has a current streak; a past flake does not. */
  readonly currentMissStreak: number;
  readonly register: PerfRegister;
  /** Most gate-violating measurement seen, or `null`. */
  readonly worst: PerfObservation | null;
  /** Newest miss, or `null`. */
  readonly lastMiss: PerfObservation | null;
  /** Distinct runners on which a miss was seen — a miss confined to one label is a hardware clue. */
  readonly missRunners: readonly string[];
}

export interface PerfThresholds {
  /** Consecutive misses at which a miss stops being a flake and becomes a regression. */
  readonly sustainedStreak: number;
}

export const DEFAULT_PERF_THRESHOLDS: PerfThresholds = {
  // TWO, not three. One miss is the base rate of a shared runner; two in a row is not, and
  // waiting for three lets a real regression sit green through an extra merge. The cost of
  // calling a regression early is a human reading one report; the cost of calling it late is
  // shipping it.
  sustainedStreak: 2,
};

/**
 * Ordinal (code-unit) order. Deliberately NOT the locale-aware comparison, which sorts
 * differently per machine and would make this fold's tie-breaking non-reproducible across the
 * runner pool — see `.claude/rules/culture-invariant-by-default.md`.
 */
function compareOrdinal(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** Newest first, by `at`. Ties broken by `sha` so the order is total and replay-stable. */
export function orderNewestFirst(observations: readonly PerfObservation[]): PerfObservation[] {
  return [...observations].sort((a, b) => {
    const t = Date.parse(b.at) - Date.parse(a.at);
    return t !== 0 ? t : compareOrdinal(a.sha, b.sha);
  });
}

/**
 * How badly an observation missed, as a fraction of the gate.
 *
 * Deliberately direction-agnostic. This repo holds BOTH lower-bound assertions (a speedup
 * ratio must be >= 1.5) and upper-bound ones (an allocation golden must be <= N), and
 * hard-coding one direction would silently mis-rank the other — the worst allocation
 * regression would sort as the mildest. Distance from the gate is the one quantity that
 * means the same thing for both.
 */
export function missMagnitude(o: PerfObservation): number {
  if (o.gate === 0) return o.pass ? 0 : Number.POSITIVE_INFINITY;
  return Math.abs(o.measured - o.gate) / Math.abs(o.gate);
}

/** The fold for one (test, config). Pure. */
export function foldPerfTest(
  test: string,
  config: string,
  observations: readonly PerfObservation[],
  thresholds: PerfThresholds = DEFAULT_PERF_THRESHOLDS,
): PerfTestRoll {
  const window = orderNewestFirst(observations);

  if (window.length === 0) {
    return {
      test,
      config,
      observations: 0,
      misses: 0,
      missRate: null,
      longestMissStreak: 0,
      currentMissStreak: 0,
      register: "unknown",
      worst: null,
      lastMiss: null,
      missRunners: [],
    };
  }

  const misses = window.filter((o) => !o.pass);

  let longest = 0;
  let run = 0;
  for (const o of window) {
    run = o.pass ? 0 : run + 1;
    longest = Math.max(longest, run);
  }

  let current = 0;
  for (const o of window) {
    if (o.pass) break;
    current += 1;
  }

  const worst =
    misses.length === 0 ? null : misses.reduce((a, b) => (missMagnitude(b) > missMagnitude(a) ? b : a));

  const register: PerfRegister =
    longest >= thresholds.sustainedStreak ? "regression" : misses.length > 0 ? "flaky" : "clean";

  return {
    test,
    config,
    observations: window.length,
    misses: misses.length,
    missRate: misses.length / window.length,
    longestMissStreak: longest,
    currentMissStreak: current,
    register,
    worst,
    lastMiss: misses[0] ?? null,
    missRunners: [...new Set(misses.map((o) => o.runner))].sort(),
  };
}

/**
 * Group by `(test, config)` and fold each.
 *
 * The key is a pair and not just the test name because the same assertion carries a DIFFERENT
 * threshold per build configuration — `ColumnLinearOps` gates at 1.15x in Debug and 1.5x in
 * Release. Folding them together would average two different questions and produce a rate
 * that answers neither.
 */
export function foldPerfLedger(
  observations: readonly PerfObservation[],
  thresholds: PerfThresholds = DEFAULT_PERF_THRESHOLDS,
): PerfTestRoll[] {
  const groups = new Map<string, PerfObservation[]>();
  for (const o of observations) {
    // JSON-encoded PAIR, not a joined string. Any separator character can appear inside a
    // test name, and this file was first written with a literal NUL as the separator -- which
    // put two raw NUL bytes into the source, tripping the repo's own
    // `audit-no-raw-nul-in-source` guard. The escape is what belongs in source; the byte is
    // not. Encoding the pair removes the need for a separator at all.
    const k = JSON.stringify([o.test, o.config]);
    const g = groups.get(k);
    if (g === undefined) groups.set(k, [o]);
    else g.push(o);
  }
  const rolls: PerfTestRoll[] = [];
  for (const [k, os] of groups) {
    const [test = "", config = ""] = JSON.parse(k) as [string, string];
    rolls.push(foldPerfTest(test, config, os, thresholds));
  }
  const rank: Record<PerfRegister, number> = { regression: 0, flaky: 1, unknown: 2, clean: 3 };
  return rolls.sort(
    (a, b) => rank[a.register] - rank[b.register] || b.misses - a.misses || compareOrdinal(a.test, b.test),
  );
}

/**
 * The sentinel a perf assertion prints, on EVERY run — pass or fail.
 *
 * Emitting only on failure would hand the ledger a numerator with no denominator, which is
 * the defect this file exists to avoid. One line, one JSON object, a fixed prefix so it
 * survives interleaved parallel test output.
 */
export const PERF_OBS_PREFIX = "##perf-obs ";

/**
 * Parse observations out of arbitrary captured output.
 *
 * Malformed lines are COUNTED and returned, never silently dropped: a parser that discards
 * its own input reports a smaller denominator than it measured, which understates every rate
 * computed from it. Every field is checked at the boundary rather than cast — a cast checks
 * nothing at runtime, and a `measured` that arrived as a string would flow into the fold and
 * come out as a number-shaped lie.
 */
export function parsePerfObservations(text: string): {
  readonly observations: PerfObservation[];
  readonly malformed: number;
} {
  const observations: PerfObservation[] = [];
  let malformed = 0;
  for (const raw of text.split("\n")) {
    const at = raw.indexOf(PERF_OBS_PREFIX);
    if (at < 0) continue;
    const json = raw.slice(at + PERF_OBS_PREFIX.length).trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      malformed += 1;
      continue;
    }
    const v = parsed as Partial<PerfObservation>;
    if (
      typeof v.test !== "string" ||
      typeof v.metric !== "string" ||
      typeof v.measured !== "number" ||
      typeof v.gate !== "number" ||
      typeof v.pass !== "boolean" ||
      typeof v.config !== "string" ||
      typeof v.runner !== "string" ||
      typeof v.at !== "string" ||
      typeof v.sha !== "string" ||
      !Number.isFinite(v.measured) ||
      !Number.isFinite(v.gate) ||
      Number.isNaN(Date.parse(v.at))
    ) {
      malformed += 1;
      continue;
    }
    observations.push(v as PerfObservation);
  }
  return { observations, malformed };
}

/** Markdown report. `unknown` renders as unknown and never as a green zero. */
export function renderPerfLedger(rolls: readonly PerfTestRoll[], malformed = 0): string {
  const lines: string[] = ["## perf assertion ledger — regression vs flake", ""];
  if (rolls.length === 0) {
    lines.push(
      "**NO OBSERVATIONS.** This is not a clean bill of health — nothing was measured. A perf " +
        "assertion that never emits an observation is invisible here, and an empty ledger and a " +
        "healthy one render identically unless this sentence is printed instead of a table.",
      "",
    );
    if (malformed > 0) {
      lines.push(`**${String(malformed)} malformed observation line(s) were skipped.**`, "");
    }
    return lines.join("\n");
  }
  lines.push(
    "| test | config | register | obs | misses | rate | streak cur/max | worst | runners |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  );
  for (const r of rolls) {
    const rate = r.missRate === null ? "`unknown`" : `${(r.missRate * 100).toFixed(1)}%`;
    const worst =
      r.worst === null ? "—" : `${String(r.worst.measured)} vs gate ${String(r.worst.gate)} (${r.worst.sha.slice(0, 8)})`;
    lines.push(
      `| \`${r.test}\` | ${r.config} | \`${r.register}\` | ${String(r.observations)} | ` +
        `${String(r.misses)} | ${rate} | ${String(r.currentMissStreak)}/${String(r.longestMissStreak)} | ` +
        `${worst} | ${r.missRunners.join(", ") || "—"} |`,
    );
  }
  lines.push("");
  lines.push(
    "`regression` = misses are SUSTAINED (consecutive) — read it as the code. `flaky` = isolated " +
      "misses among passes — read it as the machine, and check the runner pool before the diff. " +
      "`unknown` = no observations; unmeasured is not clean.",
  );
  if (malformed > 0) {
    lines.push("");
    lines.push(
      `**${String(malformed)} malformed observation line(s) were skipped.** Reported rather than ` +
        "dropped: a parser that silently discards input reports a smaller denominator than it " +
        "measured, which understates every rate above.",
    );
  }
  return lines.join("\n");
}

/**
 * CLI — the COLLECTOR. Reads test output on stdin, folds the observations, writes the ledger.
 *
 * WHY THIS EXISTS. The emitter (`PerfObservation.fs`) and the fold (above) both landed and were
 * both tested, and for the whole time since, `##perf-obs` lines have scrolled past in CI logs with
 * nothing reading them. Two green halves and no pipeline: the denominator existed in principle and
 * nowhere in fact, which is the same shape as a check that cannot fail.
 *
 * IT NEVER FAILS THE BUILD. A measurement that can break a test run would be worse than no
 * measurement — the perf assertions themselves already decide pass/fail, and this only reports what
 * they said. Exit is 0 even when nothing was parsed.
 *
 * BUT IT IS NEVER SILENT ABOUT SILENCE. `renderPerfLedger` already refuses to call an empty ledger
 * clean ("NO OBSERVATIONS. This is not a clean bill of health — nothing was measured"), and that
 * refusal is the reason this is safe to run non-fatally: a zero-observation run is loudly a
 * zero-observation run, not a green one. Malformed lines are counted and reported rather than
 * dropped, so a broken emitter shows up as a number instead of as quiet.
 *
 * STDIN, NOT A LOG PATH. The collector reads a stream so it can sit in a pipe next to the test
 * command and never needs the log to be persisted first — one fewer artifact to keep in sync, and
 * no chance of folding yesterday's file.
 */
export function collectPerfLedger(text: string, thresholds: PerfThresholds = DEFAULT_PERF_THRESHOLDS): {
  readonly markdown: string;
  readonly observations: number;
  readonly malformed: number;
  readonly rolls: readonly PerfTestRoll[];
} {
  const { observations, malformed } = parsePerfObservations(text);
  const rolls = foldPerfLedger(observations, thresholds);
  return { markdown: renderPerfLedger(rolls, malformed), observations: observations.length, malformed, rolls };
}

if (import.meta.main) {
  const text = await Bun.stdin.text();
  const r = collectPerfLedger(text);
  const out = process.env["GITHUB_STEP_SUMMARY"];
  if (out !== undefined && out.length > 0) {
    // Appended, not written: other steps in the same job own this file too.
    await Bun.write(out, (await Bun.file(out).text().catch(() => "")) + r.markdown);
  }
  console.log(r.markdown);
  // Deliberately 0. See the header: this reports, it does not judge.
  process.exit(0);
}
