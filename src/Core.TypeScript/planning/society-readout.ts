/**
 * society-readout -- render the society evolution loop as ONE LINE a human already reads.
 *
 * ## Why this exists
 *
 * On 2026-08-16 the society's population went 4 -> 3 -> 2 -> 1 inside one hour, and
 * evolve() became the identity function (k = max(1, ceil(1 * 0.5)) = 1 survivor,
 * needed = 0 offspring: no crossover, no mutation, no replacement). It stayed that way
 * for 202 ticks / 106 hours and NOTHING NOTICED -- because a society of one and a
 * society of forty emit identically well-formed, correctly hash-chained events, and the
 * commit each tick lands on main reads "society: evolution tick <ISO8601>", which is a
 * clock, not a measurement.
 *
 * The failure was never a missing dashboard. It was that the highest-traffic surface in
 * the repo -- the commit subject, scrolled past dozens of times a day -- carried zero
 * bits about the thing it was announcing. renderReadoutLine is the string that surface
 * was missing.
 *
 * ## The property this module must have, or it IS the bug it is fixing
 *
 * A readout that renders identically whether the society is healthy or collapsed is
 * exactly the vacuity class it exists to catch. So every field here is a function of the
 * observed vitals and nothing else, and society-readout.test.ts pins the discrimination
 * directly: healthy input and collapsed input MUST produce different bytes, and the
 * collapsed one MUST carry a grep-able alarm token.
 *
 * Two consequences of that requirement, both deliberate:
 *
 * 1. flatlineTicks counts UP. A committed readout whose content stops changing during a
 *    collapse produces an empty diff -- silence that looks like calm. The flatline
 *    counter makes the diff strictly non-empty and monotonically louder for as long as
 *    the loop is stuck: flat=1t ... flat=202t/106.0h.
 * 2. now is an INJECTED parameter, never Date.now(). Staleness is a local-clock
 *    judgement (.claude/rules/local-time-never-enters-the-shared-fold.md: local time
 *    steers local actions only) and an ambient clock would make this renderer
 *    non-replayable, which is the same defect one level down.
 *
 * ## Register
 *
 * metered as a renderer: the falsifiers in the sibling test file fail when the
 * discrimination, the monotone counter, the ASCII guarantee, or the real-corpus
 * detection breaks. It makes NO claim about whether any particular alarm threshold is
 * the right one -- thresholds are caller-supplied and defaulted, not derived.
 *
 * This module RENDERS. It does not gate, and it does not fix the population loader.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// -- Types ---------------------------------------------------------------------------

/** The vitals of one evolution tick, projected out of a society event file. */
export interface SocietyTickSample {
  /** ISO8601 instant the tick was recorded (the event's own `at`). */
  readonly at: string;
  /** Number of agents the loop actually loaded. The number that went to 1. */
  readonly population: number;
  /** Mean pairwise genetic distance. 0 at population 1 by construction. */
  readonly geneticDiversity: number;
  readonly meanFitness: number;
  readonly generation: number;
}

/** A stable, grep-able alarm token. Never prose -- these are matched, not read. */
export type SocietyAlarm =
  | "POPULATION-COLLAPSE"
  | "DIVERSITY-ZERO"
  | "GENERATION-PINNED"
  | "FLATLINE"
  | "STALE"
  | "NO-EVENTS";

export interface SocietyReadout {
  readonly sampleCount: number;
  readonly latest: SocietyTickSample | null;
  /** Consecutive TRAILING ticks whose vitals are byte-identical to the latest. */
  readonly flatlineTicks: number;
  /** Wall span of that trailing flatline, in hours. 0 when not flatlined. */
  readonly flatlineHours: number;
  readonly minPopulation: number;
  readonly maxPopulation: number;
  readonly alarms: readonly SocietyAlarm[];
  readonly populationSpark: string;
  readonly diversitySpark: string;
}

export interface ReadoutThresholds {
  /** Population strictly below this raises POPULATION-COLLAPSE. Default 2. */
  readonly minPopulation: number;
  /** Trailing identical ticks at or above this raise FLATLINE. Default 4. */
  readonly flatlineTicks: number;
  /** Age of the newest sample, in ms, at or above which STALE fires. Default 2h. */
  readonly staleAfterMs: number;
}

export const DEFAULT_THRESHOLDS: ReadoutThresholds = {
  // 2 is not a tuning choice: below it, evolve() is provably the identity function --
  // one survivor, zero offspring, so crossover/mutate/replace are unreachable.
  minPopulation: 2,
  // 4 ticks at a 30-minute cadence is ~2 hours of a loop that cannot differ.
  flatlineTicks: 4,
  // 2 hours is 4 missed ticks at the */30 cron in society-heartbeat.yml.
  staleAfterMs: 2 * 60 * 60 * 1000,
};

/**
 * ASCII sparkline ramp, low to high. ASCII on purpose: this string is designed to land
 * in a commit subject and a terminal log, where block glyphs are a font bet.
 */
export const SPARK_RAMP = "_.-=+*#@";

// -- Core (pure) ---------------------------------------------------------------------

/**
 * Render a numeric series as an ASCII sparkline.
 *
 * A CONSTANT series renders as all-lowest, never as a mid-ramp band. That is the whole
 * point: a flat line must LOOK flat and low, not comfortably average. A sparkline that
 * normalised a constant series to mid-ramp would be the exact vacuity this file refuses.
 */
export function renderSpark(values: readonly number[], width = 32): string {
  const tail = values.slice(-width);
  if (tail.length === 0) return "";
  const finite = tail.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return SPARK_RAMP[0]!.repeat(tail.length);
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  const span = hi - lo;
  const top = SPARK_RAMP.length - 1;
  function cell(v: number): string {
    if (span === 0) return SPARK_RAMP[0]!;
    if (!Number.isFinite(v)) return SPARK_RAMP[0]!;
    const idx = Math.round(((v - lo) / span) * top);
    return SPARK_RAMP[Math.max(0, Math.min(top, idx))]!;
  }
  return tail.map(cell).join("");
}

/** The vitals tuple that decides whether two ticks are the same tick again. */
function vitalsKey(s: SocietyTickSample): string {
  const parts = [s.population, s.geneticDiversity, s.meanFitness, s.generation];
  return parts.join("_");
}

/**
 * Fold a chronological sample series into a readout.
 *
 * nowMs is INJECTED, never Date.now(). Staleness is a local-clock judgement, and an
 * ambient clock would make this renderer non-replayable -- the same defect one layer
 * down. See .claude/rules/local-time-never-enters-the-shared-fold.md.
 */
export function computeReadout(
  samples: readonly SocietyTickSample[],
  nowMs: number,
  thresholds: ReadoutThresholds = DEFAULT_THRESHOLDS,
): SocietyReadout {
  if (samples.length === 0) {
    return {
      sampleCount: 0,
      latest: null,
      flatlineTicks: 0,
      flatlineHours: 0,
      minPopulation: 0,
      maxPopulation: 0,
      alarms: ["NO-EVENTS"],
      populationSpark: "",
      diversitySpark: "",
    };
  }

  const latest = samples[samples.length - 1]!;
  const key = vitalsKey(latest);
  let flatlineTicks = 1;
  for (let i = samples.length - 2; i >= 0; i--) {
    if (vitalsKey(samples[i]!) !== key) break;
    flatlineTicks++;
  }
  const oldestFlat = samples[samples.length - flatlineTicks]!;
  const flatSpanMs = Date.parse(latest.at) - Date.parse(oldestFlat.at);
  let flatlineHours = 0;
  if (flatlineTicks !== 1) flatlineHours = flatSpanMs / 3600000;

  const pops = samples.map((s) => s.population);
  const gens = new Set(samples.map((s) => s.generation));
  const alarms: SocietyAlarm[] = [];
  if (thresholds.minPopulation > latest.population) alarms.push("POPULATION-COLLAPSE");
  if (latest.geneticDiversity === 0) alarms.push("DIVERSITY-ZERO");
  if (samples.length !== 1 && gens.size === 1) alarms.push("GENERATION-PINNED");
  if (flatlineTicks >= thresholds.flatlineTicks) alarms.push("FLATLINE");
  if (nowMs - Date.parse(latest.at) >= thresholds.staleAfterMs) alarms.push("STALE");

  return {
    sampleCount: samples.length,
    latest,
    flatlineTicks,
    flatlineHours,
    minPopulation: Math.min(...pops),
    maxPopulation: Math.max(...pops),
    alarms,
    populationSpark: renderSpark(pops),
    diversitySpark: renderSpark(samples.map((s) => s.geneticDiversity)),
  };
}

/**
 * THE ONE LINE. Short enough to append to a commit subject, dense enough that the
 * 2026-08-16 collapse would have changed it on the very next tick:
 *
 *   before: pop=4 div=165.452 fit=0.162 gen=1 flat=1t OK
 *   after:  pop=1 div=0.000 fit=0.649 gen=1 flat=1t [POPULATION-COLLAPSE DIVERSITY-ZERO]
 */
export function renderReadoutLine(r: SocietyReadout): string {
  if (r.latest === null) return "society: NO-EVENTS";
  let flat = "flat=" + String(r.flatlineTicks) + "t";
  if (r.flatlineHours !== 0) flat = flat + "/" + r.flatlineHours.toFixed(1) + "h";
  let status = "OK";
  if (r.alarms.length !== 0) status = "[" + r.alarms.join(" ") + "]";
  const parts = [
    "pop=" + String(r.latest.population),
    "div=" + r.latest.geneticDiversity.toFixed(3),
    "fit=" + r.latest.meanFitness.toFixed(3),
    "gen=" + String(r.latest.generation),
    flat,
    status,
  ];
  return parts.join(" ");
}

/**
 * The committed readout. Pure ASCII -- checked by a falsifier, not by intent.
 *
 * The flatline row is the load-bearing one: during a collapse it counts UP every tick,
 * so this file's diff is never empty and never quiet.
 */
export function renderReadoutMarkdown(r: SocietyReadout, generatedAtIso: string): string {
  const L: string[] = [];
  L.push("# Society loop readout");
  L.push("");
  L.push("GENERATED by src/Core.TypeScript/planning/society-readout.ts -- do not edit.");
  L.push("");
  L.push("A pure function of docs/observe-events/society-*.json. While the loop is");
  L.push("stuck, the flatline row counts UP every tick, so this diff is never empty");
  L.push("and never quiet. An unchanged diff means the readout itself stopped running.");
  L.push("");
  L.push("- generated: " + generatedAtIso);
  L.push("- one-line: " + renderReadoutLine(r));
  L.push("");
  if (r.latest === null) {
    L.push("## Status: NO-EVENTS");
    L.push("");
    L.push("No society events were found. That is itself the finding.");
    L.push("");
    return L.join("\n");
  }
  let heading = "## Status: OK";
  if (r.alarms.length !== 0) heading = "## Status: " + r.alarms.join(" ");
  L.push(heading);
  L.push("");
  L.push("| field | value |");
  L.push("|---|---|");
  L.push("| latest tick | " + r.latest.at + " |");
  L.push("| population | " + String(r.latest.population) + " |");
  L.push("| genetic diversity | " + String(r.latest.geneticDiversity) + " |");
  L.push("| mean fitness | " + String(r.latest.meanFitness) + " |");
  L.push("| generation | " + String(r.latest.generation) + " |");
  L.push("| ticks in window | " + String(r.sampleCount) + " |");
  const range = String(r.minPopulation) + ".." + String(r.maxPopulation);
  L.push("| population range in window | " + range + " |");
  const flat = String(r.flatlineTicks) + " ticks, " + r.flatlineHours.toFixed(1) + "h";
  L.push("| flatline (identical trailing ticks) | " + flat + " |");
  L.push("");
  L.push("## Sparklines (oldest to newest, ASCII ramp " + SPARK_RAMP + ")");
  L.push("");
  L.push("```");
  L.push("population  " + r.populationSpark);
  L.push("diversity   " + r.diversitySpark);
  L.push("```");
  L.push("");
  L.push("A constant series renders as all-underscore. Flat looks flat, by construction.");
  L.push("");
  L.push("## What each alarm means");
  L.push("");
  L.push("- POPULATION-COLLAPSE -- below 2 agents evolve() is the identity function:");
  L.push("  one survivor, zero offspring, so crossover/mutate/replace never execute.");
  L.push("- DIVERSITY-ZERO -- mean pairwise genetic distance is 0. Automatic at pop 1.");
  L.push("- GENERATION-PINNED -- generation never advanced across the whole window.");
  L.push("- FLATLINE -- N consecutive ticks whose vitals are byte-identical.");
  L.push("- STALE -- the newest event is older than the tick cadence allows.");
  L.push("");
  return L.join("\n");
}

// -- Loading (impure edge) -----------------------------------------------------------

/** Project a parsed society event onto the vitals. Tolerates missing fields. */
export function sampleFromEvent(raw: unknown): SocietyTickSample | null {
  if (typeof raw !== "object") return null;
  if (raw === null) return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.at !== "string") return null;
  let population = 0;
  if (Array.isArray(e.agents)) population = e.agents.length;
  let geneticDiversity = 0;
  if (typeof e.geneticDiversity === "number") geneticDiversity = e.geneticDiversity;
  let meanFitness = 0;
  if (typeof e.meanFitness === "number") meanFitness = e.meanFitness;
  let generation = 0;
  if (typeof e.generation === "number") generation = e.generation;
  return { at: e.at, population, geneticDiversity, meanFitness, generation };
}

/**
 * Read the society event files out of an event directory, OLDEST FIRST.
 *
 * Sorted by the event's own `at`, not by filename. Filename order is base36-of-ms and
 * happens to agree today; the readout must not silently depend on that.
 */
export function loadSocietySamples(eventDir: string, limit = 48): SocietyTickSample[] {
  let names: string[] = [];
  try {
    names = readdirSync(eventDir);
  } catch {
    return [];
  }
  const out: SocietyTickSample[] = [];
  for (const n of names) {
    if (!n.startsWith("society-")) continue;
    if (!n.endsWith(".json")) continue;
    if (n === "society-index.json") continue;
    try {
      const text = readFileSync(join(eventDir, n), "utf8");
      const s = sampleFromEvent(JSON.parse(text));
      if (s !== null) out.push(s);
    } catch {
      // A malformed event is one missing sample, not a reason to render nothing.
    }
  }
  out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (limit >= 1) return out.slice(-limit);
  return out;
}

/** Build the whole readout from disk. Exported so the CLI stays a one-liner. */
export function readoutFromDir(
  eventDir: string,
  nowMs: number,
  limit = 48,
  thresholds: ReadoutThresholds = DEFAULT_THRESHOLDS,
): SocietyReadout {
  return computeReadout(loadSocietySamples(eventDir, limit), nowMs, thresholds);
}

// -- CLI -----------------------------------------------------------------------------

if (import.meta.main) {
  const argv = process.argv.slice(2);
  function arg(flag: string, dflt: string): string {
    const i = argv.indexOf(flag);
    if (i === -1) return dflt;
    if (argv.length === i + 1) return dflt;
    return argv[i + 1]!;
  }
  const dir = arg("--event-dir", "docs/observe-events");
  const limit = Number.parseInt(arg("--limit", "48"), 10);
  const now = Date.now();
  const r = readoutFromDir(dir, now, limit);
  let text = renderReadoutLine(r);
  if (argv.includes("--json")) text = JSON.stringify(r, null, 2);
  const stamp = new Date(now).toISOString();
  if (argv.includes("--markdown")) text = renderReadoutMarkdown(r, stamp);
  process.stdout.write(text + "\n");
}
