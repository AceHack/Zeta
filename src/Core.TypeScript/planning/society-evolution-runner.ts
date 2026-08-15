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
import { evidenceBackedPriorHints, transportHeatReadout } from "./society-heat-readout";
import { absorbGeneration, loadSocietyBnn, saveSocietyBnn } from "./society-bnn";
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
