#!/usr/bin/env bun
// drift-proposer.ts — the evolution loop's LAST organ (081KZSRBBAM):
// selection that persists becomes a PROPOSAL, never a change. The shadow
// generation (drift-evolution.ts) ranks mutants every tick; this module
// watches those rankings across ticks and, when the current genome has
// been strictly dominated for K consecutive ticks, drafts the consent
// artifact — a letter to the roster carrying the winning phenotype, the
// evidence, and the registry/drift-slo.yaml diff it implies. Evolution
// proposes; the society disposes. This module NEVER writes the registry.
//
// No new state files are needed for persistence-of-victory: past
// populations RECONSTRUCT purely from the ledger, because each tick's
// generation is seeded lcg(tick+1) over events≤tick (DST — the seed is
// the phase, drift-evolution.ts's own contract). So the proposer is a
// pure fold over the one event source that already exists.
//
// Decision rule (conservative by construction):
//   - For each of the last K recorded ticks, rebuild that tick's
//     population; the tick "loses" iff some mutant beats the current
//     genome's shadow fitness by ≥ margin (default: ALARM_WEIGHT — one
//     filing's worth of cost).
//   - Fire only when ALL K consecutive ticks lose (hysteresis: one good
//     tick resets the streak).
//   - The proposed phenotype = the tick-winners' argmax when re-scored
//     on the FULL history (deterministic tie-break by genome hex).
//   - At-most-once per phenotype: the letter is keyed by the CANONICAL
//     genome hex — toHex(encode(decode(genome))), the gen(gen)==gen
//     fixed point — so two raw genomes decoding to the same lawful
//     phenotype share one key (decode clamps; raw hexes can differ).
//     Written with the "wx" flag: a declined proposal is never nagged;
//     a DIFFERENT phenotype may propose later.
//
// Wired into drift-sweep.yml after the shadow generation; the letter and
// data/drift-proposal.json ride the tick's bookkeeping commit.

import { writeFileSync } from "node:fs";

import { generation, lcg, shadowCost, type Candidate } from "./drift-evolution.ts";
import { encodeDriftGenome, toHex, type DriftPhenotype } from "./drift-genome.ts";
import { readLedger, type SweepEvent } from "./drift-ledger.ts";

export const DEFAULT_STREAK_TICKS = 6; // K: consecutive losing ticks before a proposal
export const DEFAULT_MARGIN = 3; // one ALARM_WEIGHT of shadow cost

export interface TickVerdict {
  readonly tick: number;
  readonly currentFitness: number;
  readonly bestFitness: number;
  readonly bestHex: string;
  readonly loses: boolean;
}

export interface ProposalEvaluation {
  readonly latestTick: number;
  readonly streak: number; // trailing consecutive losing ticks
  readonly fires: boolean;
  readonly winner: Candidate | null; // present iff fires
  readonly perTick: readonly TickVerdict[];
}

/** Rebuild tick t's population exactly as drift-evolution's CLI did:
 * events≤t, population 16, seed t+1. Pure (DST). */
function populationAt(events: readonly SweepEvent[], t: number): readonly Candidate[] {
  const upTo = events.filter((e) => e.tick <= t);
  return generation(upTo, 16, lcg(t + 1));
}

/** The pure decision fold. Deterministic over (events, streakTicks, margin). */
export function evaluateProposal(
  events: readonly SweepEvent[],
  streakTicks: number = DEFAULT_STREAK_TICKS,
  margin: number = DEFAULT_MARGIN,
): ProposalEvaluation {
  const ticks = [...new Set(events.map((e) => e.tick))].sort((a, b) => a - b);
  const latestTick = ticks.length > 0 ? ticks[ticks.length - 1]! : 0;
  const window = ticks.slice(-streakTicks);
  const perTick: TickVerdict[] = window.map((t) => {
    const pop = populationAt(events, t);
    const current = pop.find((c) => c.parent === "current")!;
    const best = pop[0]!;
    return {
      tick: t,
      currentFitness: current.shadowFitness,
      bestFitness: best.shadowFitness,
      bestHex: best.genomeHex,
      loses: best.shadowFitness - current.shadowFitness >= margin,
    };
  });
  let streak = 0;
  for (let i = perTick.length - 1; i >= 0; i -= 1) {
    if (perTick[i]!.loses) streak += 1;
    else break;
  }
  const fires = window.length >= streakTicks && streak >= streakTicks;
  let winner: Candidate | null = null;
  if (fires) {
    // Re-score each tick's winner on the FULL history; argmax, hex tie-break.
    const seen = new Map<string, Candidate>();
    for (const v of perTick) {
      const pop = populationAt(events, v.tick);
      const b = pop[0]!;
      if (!seen.has(b.genomeHex)) seen.set(b.genomeHex, b);
    }
    const rescored = [...seen.values()].map((c) => ({
      candidate: c,
      fullFitness: -shadowCost(events, c.phenotype),
    }));
    rescored.sort(
      (a, b) =>
        b.fullFitness - a.fullFitness ||
        (a.candidate.genomeHex < b.candidate.genomeHex ? -1 : 1),
    );
    // The published winner carries its FULL-history fitness (what the letter claims).
    winner = { ...rescored[0]!.candidate, shadowFitness: rescored[0]!.fullFitness };
  }
  return { latestTick, streak, fires, winner, perTick };
}

/** The registry diff the phenotype implies — rendered as the exact YAML the
 * roster would apply to registry/drift-slo.yaml on assent. Text only; this
 * module never touches the registry. */
/** The at-most-once letter key: canonical hex of the phenotype (encode of
 * the decode — clamped channels collapse to one representative). */
export function canonicalHexOf(p: DriftPhenotype): string {
  return toHex(encodeDriftGenome(p));
}

export function renderRegistryPatch(p: DriftPhenotype): string {
  return [
    "defaults:",
    `  max_open_age_ticks: ${String(p.defaultBudgetTicks)}`,
    "adaptive:",
    `  multiplier: ${String(p.adaptiveMultiplier)}`,
    `  min_heals: ${String(p.adaptiveMinHeals)}`,
    `  floor_ticks: ${String(p.adaptiveFloorTicks)}`,
    "per_rule:",
    "  BD001:",
    `    max_open_age_ticks: ${String(p.bd001BudgetTicks)}`,
  ].join("\n");
}

export function renderProposalLetter(ev: ProposalEvaluation): string {
  const w = ev.winner!;
  const rows = ev.perTick
    .map(
      (v) =>
        `| ${String(v.tick)} | ${String(v.currentFitness)} | ${String(v.bestFitness)} | ${v.bestHex} | ${v.loses ? "loses" : "holds"} |`,
    )
    .join("\n");
  return `# To the roster: the drift genome proposes its own successor (tick ${String(ev.latestTick)})

Status: PROPOSAL — nothing changes without assent. Evolution proposes; the
society disposes (drift-and-heal ADR; registry changes follow the registry
consent discipline).

The shadow selection loop (\`drift-evolution.ts\`, adaptive-rule replay) has
strictly dominated the current genome for ${String(ev.streak)} consecutive
ticks. Per the proposer's rule (streak ≥ ${String(DEFAULT_STREAK_TICKS)},
margin ≥ ${String(DEFAULT_MARGIN)} shadow-fitness), this letter is the
at-most-once consent artifact for the winning phenotype.

## Proposed phenotype ${w.genomeHex} (full-history shadow fitness ${String(w.shadowFitness)})

\`\`\`yaml
${renderRegistryPatch(w.phenotype)}
\`\`\`

## Evidence (last ${String(ev.perTick.length)} ticks, reconstructed deterministically from the ledger)

| tick | current fitness | best fitness | best hex | verdict |
| --- | --- | --- | --- | --- |
${rows}

## Consent path

Assent = apply the YAML above to \`registry/drift-slo.yaml\` in a commit
citing this letter. Decline = leave the registry as is; this phenotype will
not be re-proposed (letters are keyed by genome hex). A different winner may
propose later. The proposer never writes the registry itself.
`;
}

const invokedDirectly =
  typeof process.argv[1] === "string" && /drift-proposer\.(?:ts|js)$/.test(process.argv[1]);
if (invokedDirectly) {
  const events = readLedger("docs/drift-events");
  const ev = evaluateProposal(events);
  writeFileSync(
    "data/drift-proposal.json",
    `${JSON.stringify(
      {
        latestTick: ev.latestTick,
        streak: ev.streak,
        fires: ev.fires,
        winnerHex: ev.winner?.genomeHex ?? null,
        perTick: ev.perTick,
      },
      null,
      2,
    )}\n`,
  );
  console.log(
    `drift-proposer: tick ${String(ev.latestTick)} — losing streak ${String(ev.streak)}/${String(DEFAULT_STREAK_TICKS)}${ev.fires ? " → PROPOSAL FIRES" : ""}`,
  );
  if (ev.fires && ev.winner !== null) {
    const path = `docs/letters/to-roster-drift-genome-proposal-${canonicalHexOf(ev.winner.phenotype).replace("#", "")}.md`;
    try {
      writeFileSync(path, renderProposalLetter(ev), { flag: "wx" });
      console.log(`drift-proposer: wrote ${path}`);
    } catch {
      console.log(`drift-proposer: ${path} already exists — at-most-once holds, nothing written`);
    }
  }
  process.exit(0);
}
