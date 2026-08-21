#!/usr/bin/env bun
/**
 * society-evolution-runner.ts — CLI entry point for the society evolution loop.
 *
 * Called by .github/workflows/society-heartbeat.yml every 30 minutes.
 * Reads the event log, scores agents by calibration, runs one generation
 * of evolution, and writes the result as a G-set event.
 *
 * Usage:
 *   bun src/Core.TypeScript/planning/society-evolution-runner.ts \
 *     --event-dir docs/observe-events \
 *     --generations 1
 *
 * Transport: Git commits (the gitSalonTransport from gossip-mesh-transport.ts).
 * Each generation is a durable G-set event: foldable, composable, verifiable.
 *
 * ## 2026-08-20 — who is in the society, and what generation it is
 *
 * This runner spent four days with a population of ONE, and that one was itself:
 * its loader treated every distinct `by` as an agent, and every event it writes
 * carries `by: "society"`. At n=1 `evolve()` is the identity function — one
 * survivor, zero offspring, no crossover, no mutation — while the tick log kept
 * advertising "score → select → crossover → mutate → replace".
 *
 * Both halves are now decided rather than emergent, in `society-population.ts`:
 *
 *   - **Population** comes from the event log minus the runner's own lane, over a
 *     per-agent window anchored to the corpus's own latest timestamp.
 *   - **Generation** is folded from the runner's own lane, which is exactly what
 *     that lane is for. It used to be hardcoded `0` every tick, so the emitted
 *     field read `1` in all 400 events ever written.
 *
 * The loud half is `hygiene/audit-society-population-health.ts`, which fails the
 * gate when the population drops below two or diversity reaches zero. Nothing
 * anywhere referenced either number before, which is why nobody noticed.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { evolve, createSociety, type SocietyAgent, type Society } from "./society-evolution";
import { evidenceBackedPriorHints, transportHeatReadout } from "./society-heat-readout";
import { absorbGeneration, loadSocietyBnn, saveSocietyBnn } from "./society-bnn";
import { writeSocietyEventEvidence } from "./society-event-index";
import {
  DEFAULT_HORIZON_MS,
  POPULATION_POLICY_ID,
  SOCIETY_RUNNER_BY,
  loadPopulation,
  scanPopulation,
  agentsFromScan,
  type PopulationScan,
} from "./society-population";

interface CliArgs {
  eventDir: string;
  generations: number;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { eventDir: "docs/observe-events", generations: 1 };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--event-dir" && argv[i + 1]) args.eventDir = argv[++i]!;
    else if (arg === "--generations" && argv[i + 1]) args.generations = parseInt(argv[++i]!, 10);
  }
  return args;
}

/**
 * Load agents from the event log.
 *
 * The body of this moved to `society-population.ts` on 2026-08-20 after it was
 * measured collapsing the population to ONE — the runner reading its own output.
 * The wrapper stays because it is the exported name other call sites and tests
 * know. The two decisions that fix it live in that module and are documented
 * there; the one-line versions are:
 *
 *   - the `society` lane is the loop's LINEAGE, never its POPULATION
 *   - the window is per-agent and anchored to the corpus's own latest timestamp,
 *     never to `Date.now()` and never to a global file count
 */
function loadAgentsFromEventLog(eventDir: string): SocietyAgent[] {
  return agentsFromScan(scanPopulation(eventDir));
}

/**
 * Print what the population scan actually decided.
 *
 * The collapse went unnoticed for four days partly because the tick logged
 * `N agents loaded` and nothing else — a number with no provenance. Every input
 * to that number is now on the line beside it, so a future collapse is readable
 * in the run log before any audit has to catch it.
 */
function logScan(scan: PopulationScan): void {
  const ids = scan.agents.map((a) => `${a.id}(${a.events})`).join(" ");
  console.log(
    `[society] population ${scan.agents.length}: ${ids || "(none — bootstrap)"}`,
  );
  console.log(
    `[society] window ${scan.horizonStart || "-"} .. ${scan.horizonEnd || "-"} ` +
      `(${(DEFAULT_HORIZON_MS / 86_400_000).toFixed(0)}d, anchored to the corpus, not the clock); ` +
      `scanned=${scan.scanned} eligible=${scan.eligible}`,
  );
  const excluded = Object.entries(scan.excludedByLane)
    .map(([k, v]) => `${k}=${v}`)
    .join(" ");
  if (excluded.length > 0) console.log(`[society] excluded lanes (lineage, not population): ${excluded}`);
  if (scan.agedOut.length > 0) console.log(`[society] aged out of the window: ${scan.agedOut.join(" ")}`);
  if (scan.rejectedIds.length > 0) {
    console.log(`[society] rejected ids (bad shape): ${scan.rejectedIds.join(" ")}`);
  }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`[society] loading agents from ${args.eventDir}...`);

  // `generation` used to be hardcoded 0 here, so the field read `1` in all 400
  // events ever written — a lineage counter that counted nothing. It is now
  // folded from the runner's own `society` lane, which is the one thing that
  // lane is legitimately for.
  const { scan, agents, generation: priorGeneration } = loadPopulation(args.eventDir);
  logScan(scan);
  console.log(`[society] ${agents.length} agents loaded; resuming at generation ${priorGeneration}`);

  let society: Society = createSociety(agents, priorGeneration);
  for (let g = 0; g < args.generations; g++) {
    society = evolve(society);
    console.log(`[society] generation ${society.generation}: mean fitness = ${society.meanFitness.toFixed(4)}, diversity = ${society.geneticDiversity.toFixed(4)}`);
  }

  // Write the evolution result as a G-set event
  const eventId = `society-${Date.now().toString(36)}`;
  // ── PriorHint exchange: publish only what OBSERVATIONS support ────────────────
  // The BNN now survives the tick (081M005CGB7087G0R0031328CY): load the file in
  // this event dir, absorb THIS generation as one calibration observation, save
  // only if something has been absorbed. Re-folding the event log would double-
  // count — the persist format does not carry the envelope guard — so the feed
  // is the generation just produced, keyed by event id.
  //
  // `evolve()` above does not read the BNN. Restored belief is not a fold input.
  const eventAt = new Date().toISOString();
  const loaded = await loadSocietyBnn(args.eventDir);
  const bnn = loaded.bnn;
  const absorbed = absorbGeneration(bnn, society, eventId, eventAt);
  if (absorbed) {
    const saved = await saveSocietyBnn(bnn, args.eventDir);
    console.log(`[society] BNN ${loaded.loaded ? "restored" : "started"}; generation absorbed; saved=${saved}`);
  } else {
    console.log(`[society] BNN ${loaded.loaded ? "restored" : "started"}; generation was a duplicate, not re-counted`);
  }
  const priorHints = evidenceBackedPriorHints(bnn, "society-runner");
  if (priorHints.length === 0) {
    console.log(`[society] priorHints: none — the BNN absorbed nothing; a prior is not evidence`);
  } else {
    console.log(`[society] priorHints: ${priorHints.length} evidence-backed dimension(s)`);
  }
  const event = {
    id: eventId,
    at: eventAt,
    // The SAME symbol `society-population.ts` excludes from the population. One
    // constant, an emitter and a filter — they cannot drift, which is what
    // re-opened the self-consumption hole the first time.
    by: SOCIETY_RUNNER_BY,
    kind: "evolution",
    // Which loader decided this event's population. `audit-society-population-health.ts`
    // judges published events by THIS marker rather than by a date, so the 400
    // events written under the collapsed loader stay preserved-but-unjudged
    // (manifesto §5) without the audit's scope depending on when a PR merged.
    populationPolicy: POPULATION_POLICY_ID,
    generation: society.generation,
    agents: society.agents.map(a => ({ id: a.id, fitness: a.fitness, generation: a.genome.generation })),
    meanFitness: society.meanFitness,
    fitnessSpread: society.fitnessSpread,
    geneticDiversity: society.geneticDiversity,
    // PriorHint exchange: EVIDENCE-BACKED posteriors only, never the prior.
    // A receiver merges these with `mergePriorHint`, which refuses a hint whose
    // `obsCount` is 0 — so an empty list here and a guarded merge there are the
    // same refusal stated at both ends of the channel.
    priorHints,
  };
  // ── Heat readout: the transport belief, WITH its error bar ───────────────────
  // Three defects replaced here, all measured (see society-heat-readout.ts header):
  //   1. `mu * 1e6` is not a ppm — `mu` is a severity z-score on the SEVERITY_Z
  //      alphabet, not a rate. A steady stream of ordinary `error`s converges to
  //      mu ≈ 1.94, so the old line published 1,940,259 ppm against a 1e6 maximum.
  //   2. the `mu > 0.1` cut was inert — swept over mu ∈ [0,4] at 1e-3, forcing
  //      `failedItems` to 1 or to 0 changed the band at no value of mu.
  //   3. `warm` and `hot` were structurally unreachable — the reachable set was
  //      {cold: mu ≤ 0.5, critical: mu > 0.5}, so a warn-only stream and a
  //      fatal-only stream both read `critical`. The four-band ladder the old
  //      comment advertised was a two-valued step function.
  // And the band is now REFUSED when ±1σ straddles an edge: at the prior σ = 1.0
  // the four old cut-points 0.1/0.4/0.5/0.6 sat 0.100σ apart, 0.265σ at the σ ≈
  // 0.378 a six-observation stream publishes. The point estimate is still reported,
  // under a name that does not promise a decision.
  const heatReadout = transportHeatReadout(bnn, loaded.previousTransport);
  const bandLine = `band=${heatReadout.band} (point ${heatReadout.pointBand})`;
  const beliefLine = `transportMu=${heatReadout.transportMu.toFixed(3)}±${heatReadout.transportSigma.toFixed(3)}`;
  console.log(`[society] heat readout: ${bandLine} ${beliefLine} trend=${heatReadout.trend} evidence=${heatReadout.evidence}`);

  try {
    mkdirSync(args.eventDir, { recursive: true });
    const eventFile = `${eventId}.json`;
    const eventText = `${JSON.stringify({ ...event, heatReadout }, null, 2)}\n`;
    writeFileSync(join(args.eventDir, eventFile), eventText);
    const index = writeSocietyEventEvidence(args.eventDir, {
      id: eventId,
      at: event.at,
      file: eventFile,
      eventText,
      ...(process.env.GITHUB_SHA ? { sourceRevision: process.env.GITHUB_SHA } : {}),
    });
    console.log(`[society] indexed ${eventId}: ${index.eventCount} committed evidence entries`);
    console.log(`[society] wrote evolution event ${eventId}`);
  } catch (err) {
    console.warn(`[society] could not write event: ${err instanceof Error ? err.message : String(err)}`);
  }

  return 0;
}

if (import.meta.main) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(`[society] fatal: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(2);
    },
  );
}

export { main, parseArgs, loadAgentsFromEventLog };
export type { SocietyAgent };
