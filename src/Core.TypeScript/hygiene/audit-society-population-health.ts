#!/usr/bin/env bun
/**
 * audit-society-population-health.ts — make the next society collapse LOUD.
 *
 * ## Why this exists
 *
 * On 2026-08-16 the society evolution loop's population went 4 → 3 → 2 → 1 inside
 * one hour and stayed at 1 for four days. At n=1 `evolve()` is the identity
 * function: one survivor, zero offspring, no crossover, no mutation, no
 * replacement. `meanFitness` froze at exactly 0.6505648066545648,
 * `geneticDiversity` was 0, and every tick still committed a well-formed,
 * correctly hash-chained event announcing "score → select → crossover → mutate →
 * replace".
 *
 * **Nothing noticed, and the audit that found it named exactly why:** *"No hygiene
 * audit references `geneticDiversity`, `meanFitness`, or population size. A society
 * of one and a society of forty produce identically well-formed events."* The
 * apparatus was guarded (`society-index.json`'s hash chain is enforced in
 * `gate.yml`; `heartbeat-liveness.yml` watches the heartbeat lane) and the CONTENT
 * was not. This file is the missing half.
 *
 * Full audit:
 * `docs/research/2026-08-20-the-society-has-a-population-of-one-and-that-one-is-the-loop-itself-*.md`.
 * The fix it prompted: `planning/society-population.ts`.
 *
 * ## Three checks, deliberately at different points in the pipeline
 *
 * **A — SCAN (what the NEXT tick will see).** Runs the real loader against the real
 * corpus and refuses a population below {@link MIN_POPULATION} or a genetic
 * diversity of zero. Forward-looking: it goes red the moment the population
 * collapses, *before* a single degenerate event is written.
 *
 * **B — EMITTED (what the loop actually PUBLISHED).** A green scan proves the input
 * is healthy, not that the runner used it. So policy-carrying society events are read
 * back and judged on their own `agents` and `geneticDiversity` fields. This is the
 * check that would have caught the original defect at its source.
 *
 * **C — GENERATION MOVES.** `generation` read `1` in all 400 events ever written,
 * because the runner rebuilt from 0 every tick — a field shaped like a lineage
 * counter that counted nothing. Two or more policy-carrying events at distinct
 * timestamps must not all carry the same generation.
 *
 * ## The scope marker, and why it is not an escape hatch
 *
 * B and C judge only events carrying `populationPolicy === POPULATION_POLICY_ID`.
 * The 400 events written under the collapsed loader are real recorded history and
 * are preserved rather than deleted or rewritten (manifesto §5, Memory
 * Preservation) — but they came from a loader that no longer exists, and judging
 * them would leave this audit permanently red for a defect already fixed.
 *
 * A **date** cutover was the obvious alternative and is worse: the loop writes
 * every 30 minutes, so every tick between "the audit was written" and "the fix
 * reached `main`" lands inside a date window and turns the gate red for no live
 * defect. The marker is a property of the producing code, so the scope is exactly
 * "events a fixed runner wrote."
 *
 * **A scoped check that inspects nothing is the vacuity class**, so the scope
 * carries two floors of its own:
 *
 *   - **{@link POLICY_REQUIRED_AFTER}** — once the corpus's newest event is later
 *     than this, at least one policy-carrying event MUST exist. Generous (days, not
 *     minutes) so PR timing cannot trip it, and it is what stops "the fix never
 *     actually reached the loop" from reading as a pass.
 *   - **Regression guard** — once ANY policy-carrying event exists, the NEWEST
 *     society event must carry it too. A runner reverted to the old loader stops
 *     stamping the marker; that goes red at once instead of quietly shrinking the
 *     judged set back to history.
 *
 * Both comparisons use the corpus's own maximum `at`, never `Date.now()`
 * (`.claude/rules/local-time-never-enters-the-shared-fold.md`), so this audit
 * returns the same verdict on any machine and replays deterministically.
 *
 * Check A is never scoped and never vacuous: it runs the live loader on the live
 * corpus every time.
 *
 * Usage: bun src/Core.TypeScript/hygiene/audit-society-population-health.ts [--dir <path>]
 * Exit 0 = healthy; exit 1 = collapsed population, zero diversity, a frozen lineage
 * counter, a dead loop, or a scan floor breach.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  POPULATION_POLICY_ID,
  SOCIETY_RUNNER_BY,
  agentsFromScan,
  scanPopulation,
} from "../planning/society-population";
import { createSociety } from "../planning/society-evolution";

export const EVENT_DIR = "docs/observe-events";

/**
 * Two is the smallest population at which evolution is not the identity function.
 *
 * At n=1: `k = max(1, ceil(1 × 0.5)) = 1` survivor and `needed = 0`, so crossover,
 * mutation and replacement are all structurally unreachable. At n=2 there are two
 * survivors and the machinery runs. This is a floor on the *mechanism working at
 * all*, not an opinion about how big a society should be — the intended population
 * is around four (Aaron, 2026-08-20: *"we were supposed to have like 4 agents i
 * think, also we can have more than one schedule per agent if we want"*), and
 * flooring at 4 would turn one agent's outage into a red gate.
 */
export const MIN_POPULATION = 2;

/**
 * Scan floor. An audit that inspects an empty directory passes trivially. The live
 * corpus held 3,515 files when this was written; the floor sits well below that so
 * ordinary pruning does not trip it, and any breach means the path is wrong or the
 * corpus vanished — either way not a pass.
 */
export const SCAN_FLOOR = 500;

/**
 * The deadline by which the fixed runner must have written at least one event.
 *
 * `society-population.ts` was written 2026-08-21; the loop ticks every 30 minutes,
 * so a working merge produces a policy-carrying event within the hour. Four days of
 * slack is for PR timing, review, and a CI outage — not for the fix quietly never
 * arriving. Once the corpus's newest event passes this and no policy-carrying event
 * exists, checks B and C have inspected nothing, and an audit that inspected
 * nothing must not report a pass.
 *
 * Move this ONLY with a stated reason in the same commit. Moving it forward to
 * silence a red audit is the one use it must never have.
 */
export const POLICY_REQUIRED_AFTER = "2026-08-25T00:00:00.000Z";

interface SocietyEvent {
  readonly file: string;
  readonly at: string;
  readonly policy: string | undefined;
  readonly agentCount: number;
  readonly geneticDiversity: number;
  readonly generation: number;
}

export interface AuditResult {
  readonly failures: readonly string[];
  readonly notes: readonly string[];
  readonly scannedFiles: number;
  readonly population: number;
  readonly diversity: number;
  readonly policyEventCount: number;
}

export interface AuditOptions {
  /**
   * Override the scan floor. The floor exists to stop THIS audit from reporting a
   * pass on an empty or misdirected production corpus; a fixture that builds 600
   * files per case just to clear it makes the suite slow without testing anything.
   * The CLI never passes this, and a test pins that the default is {@link SCAN_FLOOR}
   * and that a breach fails — so the override cannot quietly disable the floor in
   * the gate.
   */
  readonly scanFloor?: number;
}

function readSocietyEvents(eventDir: string): { events: SocietyEvent[]; newestAt: string } {
  const events: SocietyEvent[] = [];
  let newestAt = "";
  let files: string[];
  try {
    files = readdirSync(eventDir).filter((f) => f.endsWith(".json"));
  } catch {
    return { events, newestAt };
  }
  for (const f of files) {
    try {
      const raw: unknown = JSON.parse(readFileSync(join(eventDir, f), "utf-8"));
      if (raw === null || typeof raw !== "object") continue;
      const rec = raw as Record<string, unknown>;
      const at = rec["at"];
      if (typeof at !== "string" || at.length === 0) continue;
      if (at > newestAt) newestAt = at;
      if (rec["by"] !== SOCIETY_RUNNER_BY || rec["kind"] !== "evolution") continue;
      const agents = rec["agents"];
      events.push({
        file: f,
        at,
        policy: typeof rec["populationPolicy"] === "string" ? rec["populationPolicy"] : undefined,
        agentCount: Array.isArray(agents) ? agents.length : -1,
        geneticDiversity:
          typeof rec["geneticDiversity"] === "number" ? rec["geneticDiversity"] : Number.NaN,
        generation: typeof rec["generation"] === "number" ? rec["generation"] : Number.NaN,
      });
    } catch {
      /* malformed: other audits own filename and parse hygiene */
    }
  }
  return { events, newestAt };
}

export function auditSocietyPopulation(eventDir: string, options: AuditOptions = {}): AuditResult {
  const failures: string[] = [];
  const notes: string[] = [];

  // ── A: what the next tick will see ───────────────────────────────────────────
  const scan = scanPopulation(eventDir);
  const society = createSociety(agentsFromScan(scan), 0);
  const population = scan.agents.length;
  const diversity = society.geneticDiversity;

  const scanFloor = options.scanFloor ?? SCAN_FLOOR;
  if (scan.scanned < scanFloor) {
    failures.push(
      `SCAN FLOOR BREACH: inspected ${scan.scanned} files in ${eventDir}, floor is ${scanFloor}. ` +
        "A check that inspects almost nothing is not a passing check.",
    );
  }

  if (population < MIN_POPULATION) {
    failures.push(
      `POPULATION COLLAPSE: the loader finds ${population} agent(s) in ${eventDir}; ` +
        `minimum is ${MIN_POPULATION}. Below 2, evolve() is the identity function — ` +
        "one survivor, zero offspring, no crossover, no mutation, no replacement. " +
        `Window ${scan.horizonStart || "-"} .. ${scan.horizonEnd || "-"}; ` +
        `excluded lanes ${JSON.stringify(scan.excludedByLane)}; aged out [${scan.agedOut.join(", ")}].`,
    );
  }

  if (!(diversity > 0)) {
    failures.push(
      `ZERO GENETIC DIVERSITY: the population the loader builds has geneticDiversity=${diversity}. ` +
        "Identical genomes mean crossover and selection cannot distinguish anyone; the loop " +
        "runs and changes nothing.",
    );
  }

  // ── B and C: what the loop actually published ────────────────────────────────
  const { events, newestAt } = readSocietyEvents(eventDir);
  const byAt = (a: SocietyEvent, b: SocietyEvent): number =>
    a.at < b.at ? -1 : a.at > b.at ? 1 : 0;
  const post = events.filter((e) => e.policy === POPULATION_POLICY_ID).sort(byAt);

  if (post.length === 0) {
    if (newestAt > POLICY_REQUIRED_AFTER) {
      failures.push(
        `NO POLICY-CARRYING EVOLUTION EVENTS. The corpus's newest event is ${newestAt}, past the ` +
          `deadline ${POLICY_REQUIRED_AFTER}, and not one society event declares ` +
          `populationPolicy="${POPULATION_POLICY_ID}". The loop writes every 30 minutes, so either ` +
          "it is dead, it is still running the collapsed loader, or the deadline was pushed to " +
          "silence this audit. Checks B and C have inspected nothing; that is not a pass.",
      );
    } else {
      notes.push(
        `no society event declares populationPolicy="${POPULATION_POLICY_ID}" yet — checks B and C ` +
          `are honestly empty until the fixed runner ticks, and become a FAILURE once the corpus ` +
          `passes ${POLICY_REQUIRED_AFTER}.`,
      );
    }
  } else {
    // Regression guard: once the marker exists, the newest tick must still carry it.
    const newestSociety = [...events].sort(byAt).at(-1);
    if (newestSociety !== undefined && newestSociety.policy !== POPULATION_POLICY_ID) {
      failures.push(
        `POLICY REGRESSION: ${post.length} event(s) declare populationPolicy=` +
          `"${POPULATION_POLICY_ID}", but the newest society event ${newestSociety.file} ` +
          `(${newestSociety.at}) declares ${JSON.stringify(newestSociety.policy)}. The runner has ` +
          "reverted to a loader this audit cannot judge — which would silently shrink the judged " +
          "set back to history and let a second collapse run unwatched.",
      );
    }
  }

  for (const e of post) {
    if (e.agentCount < MIN_POPULATION) {
      failures.push(
        `${e.file}: published agents=${e.agentCount} (< ${MIN_POPULATION}) at ${e.at}. ` +
          "The loop emitted a degenerate generation.",
      );
    }
    if (!(e.geneticDiversity > 0)) {
      failures.push(
        `${e.file}: published geneticDiversity=${e.geneticDiversity} at ${e.at}. ` +
          "A generation in which every genome is identical.",
      );
    }
  }

  // C — a lineage counter has to count.
  if (post.length >= 2) {
    const distinctAt = new Set(post.map((e) => e.at)).size;
    const distinctGen = new Set(post.map((e) => e.generation)).size;
    if (distinctAt >= 2 && distinctGen === 1) {
      failures.push(
        `FROZEN LINEAGE COUNTER: ${post.length} policy-carrying events across ${distinctAt} distinct ` +
          `timestamps all carry generation=${post[0]!.generation}. That is the original defect — ` +
          "the runner rebuilding from 0 each tick, emitting a field shaped like a lineage counter " +
          "that counts nothing. Either it persists or it should not be emitted.",
      );
    }
  }

  return {
    failures,
    notes,
    scannedFiles: scan.scanned,
    population,
    diversity,
    policyEventCount: post.length,
  };
}

function main(): void {
  const argv = process.argv.slice(2);
  const dirIdx = argv.indexOf("--dir");
  const eventDir = dirIdx >= 0 && argv[dirIdx + 1] !== undefined ? argv[dirIdx + 1]! : EVENT_DIR;

  const r = auditSocietyPopulation(eventDir);
  for (const n of r.notes) console.log(`[society-population] note: ${n}`);

  if (r.failures.length > 0) {
    for (const f of r.failures) console.error(`[society-population] ${f}`);
    console.error(
      `\n[society-population] FAIL — ${r.failures.length} finding(s). ` +
        `population=${r.population} diversity=${r.diversity} ` +
        `policyEventCount=${r.policyEventCount} scanned=${r.scannedFiles}`,
    );
    process.exit(1);
  }

  console.log(
    `[society-population] OK — population=${r.population} (min ${MIN_POPULATION}), ` +
      `diversity=${r.diversity.toFixed(4)}, ${r.policyEventCount} policy-carrying event(s), ` +
      `${r.scannedFiles} files scanned.`,
  );
}

if (import.meta.main) main();
