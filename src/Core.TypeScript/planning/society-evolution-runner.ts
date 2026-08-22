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
import { createDimensionalBnn, dimensionPosterior } from "./error-bnn-bridge";
import type { ErrorDimension } from "../protocol/error-envelope";
// All known error dimensions — defined locally because error-bnn-bridge does not export ALL_DIMENSIONS
const ALL_DIMENSIONS: readonly ErrorDimension[] = [
  "schema", "type", "range", "constraint", "auth",
  "transport", "toolchain", "calibration", "unknown",
] as const;
import type { PriorHint } from "../protocol/batch-teaching-envelope";
import { batchTemperatureBand } from "../protocol/batch-heat-bridge";
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
  // Attach BNN posteriors as PriorHints so receivers can merge them into their own BNNs.
  // This is the PriorHint exchange: the whole society converges toward a shared posterior
  // over time as each evolution event carries the current BNN state.
  const bnn = createDimensionalBnn();
  const priorHints: PriorHint[] = ALL_DIMENSIONS.map(d => {
    const p = dimensionPosterior(bnn, d as ErrorDimension);
    return {
      dimension: d,
      mu: p.mu,
      sigma2: p.sigma2,
      robustnessWeight: p.robustnessWeight,
      obsCount: 0,
      senderZid: "society-runner",
    };
  });
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
    // PriorHint exchange: BNN posteriors for bidirectional EP update
    // Receivers call ZetaTransportCell.mergePriorHints(event.priorHints) to update their BNNs
    priorHints,
  };
  // ── Heat readout: wire transport dimension posterior → TemperatureBand ────────
  // The transport dimension's BNN posterior (mu) is a proxy for transport error rate.
  // We convert it to a TemperatureBand using the same thresholds as Vera's Heat.fs:
  //   cold (0 ppm) → warm (333k ppm) → hot (666k ppm) → critical (1M ppm)
  // This is the bridge between the BNN learning layer and the heat accounting layer.
  const transportPosterior = dimensionPosterior(bnn, "transport");
  // Map mu [0,1] → ppm [0, 1_000_000]: higher mu = more transport errors = more heat
  const transportPpm = Math.round(transportPosterior.mu * 1_000_000);
  // Use a synthetic BatchTeachingEnvelope summary to get the TemperatureBand
  // BatchSummary.unaccountedHeat = number of unaccounted bare erasures (not ppm)
  // We use transportMu as a proxy: mu > 0.5 → 1 unaccounted erasure out of 1 item
  const heatBand = batchTemperatureBand({
    failedItems: transportPosterior.mu > 0.1 ? 1 : 0,
    unaccountedHeat: transportPosterior.mu > 0.5 ? 1 : 0,
  });
  const heatReadout = {
    band: heatBand,
    transportMu: transportPosterior.mu,
    transportPpm,
    robustnessWeight: transportPosterior.robustnessWeight,
    trend: transportPosterior.mu > 0.6 ? "↑ warming"
      : transportPosterior.mu < 0.4 ? "↓ recovering"
      : "→ stable",
  };
  console.log(`[society] heat readout: band=${heatBand} transportMu=${transportPosterior.mu.toFixed(3)} trend=${heatReadout.trend}`);

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
