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
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { evolve, createAgent, createSociety, type SocietyAgent, type Society } from "./society-evolution";
import { createDimensionalBnn } from "./error-bnn-bridge";
import { evidenceBackedPriorHints, transportHeatReadout } from "./society-heat-readout";
import { founderGenome } from "./agent-genome";
import type { CalibrationPosterior } from "./calibration-ledger";
import { writeSocietyEventEvidence } from "./society-event-index";

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
 * Each unique `by` field in the event log is an agent.
 * Calibration is estimated from the agent's event frequency.
 */
function loadAgentsFromEventLog(eventDir: string): SocietyAgent[] {
  const agentMap = new Map<string, { events: number; lastAt: string }>();
  try {
    const files = readdirSync(eventDir).filter(f => f.endsWith(".json")).sort();
    for (const f of files.slice(-200)) { // scan last 200 events
      try {
        const raw = JSON.parse(readFileSync(join(eventDir, f), "utf-8"));
        if (raw.by && raw.at) {
          const existing = agentMap.get(raw.by) ?? { events: 0, lastAt: "" };
          agentMap.set(raw.by, {
            events: existing.events + 1,
            lastAt: raw.at > existing.lastAt ? raw.at : existing.lastAt,
          });
        }
      } catch { /* skip malformed */ }
    }
  } catch { /* no events yet */ }

  // Convert to SocietyAgent — fitness proxy: log(events + 1) / log(200)
  const agents: SocietyAgent[] = [];
  for (const [id, stats] of agentMap) {
    const fitness = Math.log(stats.events + 1) / Math.log(200);
    const calibration: CalibrationPosterior = {
      zid: id, hatId: "default",
      mu: Math.min(0.95, fitness),
      sigma: 0.1 + (1 - fitness) * 0.2,
      settledCount: stats.events,
    };
    const genome = founderGenome(
      Math.floor(fitness * 255),
      Math.floor((1 - fitness) * 128),
      64,
    );
    agents.push(createAgent(id, genome, calibration));
  }

  if (agents.length > 0) return agents;
  // Bootstrap with 3 agents if the event log is empty
  const bootstrap: SocietyAgent[] = ["alexa", "otto", "soraya"].map(id =>
    createAgent(id, founderGenome(128, 64, 32), {
      zid: id, hatId: "default", mu: 0.5, sigma: 0.2, settledCount: 0,
    })
  );
  return bootstrap;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`[society] loading agents from ${args.eventDir}...`);

  const agents = loadAgentsFromEventLog(args.eventDir);
  console.log(`[society] ${agents.length} agents loaded`);

  let society: Society = createSociety(agents, 0);
  for (let g = 0; g < args.generations; g++) {
    society = evolve(society);
    console.log(`[society] generation ${society.generation}: mean fitness = ${society.meanFitness.toFixed(4)}, diversity = ${society.geneticDiversity.toFixed(4)}`);
  }

  // Write the evolution result as a G-set event
  const eventId = `society-${Date.now().toString(36)}`;
  // ── PriorHint exchange: publish only what OBSERVATIONS support ────────────────
  // This BNN is constructed fresh on every 30-minute tick and nothing in this process
  // absorbs into it, so it has no posterior to publish. `evidenceBackedPriorHints`
  // withholds every dimension with `obsCount === 0` — today all nine, so the list is
  // empty, and empty is the truthful output.
  //
  // Publishing the constructor's prior instead is what put `mu = 0, sigma2 = 1,
  // obsCount = 0` into all 567 hint slots across the 82 evolution events already on
  // `main`, and a receiver's `mergePriorHint` credited each one with real precision
  // (sigma 1.0 → 0.154303 over those 82, from zero observations). Both halves are now
  // refused: the producer withholds, and the merge ignores a hint with no obsCount.
  //
  // What would make the list non-empty: wiring `bayesian/bnn-persistence.ts`, whose
  // header names `docs/observe-events/bnn-state.json` as living in the same G-set as
  // these events and whose `saveBnnState` / `loadBnnState` have zero callers on either
  // side. That is a separate slice — the path was drawn and never soldered at BOTH
  // ends, so loading alone would restore a prior from a file nothing writes.
  // Workitem: 081M005CGB7087G0R0031328CY.
  const bnn = createDimensionalBnn();
  const priorHints = evidenceBackedPriorHints(bnn, "society-runner");
  if (priorHints.length === 0) {
    console.log(`[society] priorHints: none — the BNN absorbed nothing; a prior is not evidence`);
  }
  const event = {
    id: eventId,
    at: new Date().toISOString(),
    by: "society",
    kind: "evolution",
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
  const heatReadout = transportHeatReadout(bnn);
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
