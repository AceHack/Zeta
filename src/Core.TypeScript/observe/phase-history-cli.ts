#!/usr/bin/env bun
/**
 * phase-history-cli.ts — human-readable phase timeline with gap detection + ECC recovery.
 *
 * Usage:
 *   bun src/Core.TypeScript/observe/phase-history-cli.ts --agent alexa
 *   bun src/Core.TypeScript/observe/phase-history-cli.ts --agent otto --from 50 --to 100
 *   bun src/Core.TypeScript/observe/phase-history-cli.ts --summary
 *   bun src/Core.TypeScript/observe/phase-history-cli.ts --agent alexa --phase 75
 *
 * Modes:
 *   --summary          Overview of all agents' phase coverage
 *   --agent <id>       Show timeline for one agent (with gap detection)
 *   --phase <n>        Look up a specific phase value
 *   --from/--to        Restrict the range displayed
 *   --path <file>      Path to rs-blocks.jsonl (default: data/rs-blocks.jsonl)
 *
 * Output:
 *   Human-readable timeline showing block coverage, gaps (missed phases),
 *   and whether gaps are recoverable (≤ 4 per block) or permanent (> 4).
 */

import { loadBlockIndex, queryPhase, phaseCoverage, latestBlocks, summarize } from "./rs-block-reader";
import type { BlockIndex, BlockRecord } from "./rs-block-reader";
import { K } from "./rs-phase-codec";

// ═══ CLI Parsing ══════════════════════════════════════════════════════════════

interface CliArgs {
  path: string;
  agent: string | null;
  from: number | null;
  to: number | null;
  phase: number | null;
  summary: boolean;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const args: CliArgs = {
    path: "data/rs-blocks.jsonl",
    agent: null,
    from: null,
    to: null,
    phase: null,
    summary: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--path" && argv[i + 1]) args.path = argv[++i]!;
    else if (a === "--agent" && argv[i + 1]) args.agent = argv[++i]!;
    else if (a === "--from" && argv[i + 1]) args.from = parseInt(argv[++i]!, 10);
    else if (a === "--to" && argv[i + 1]) args.to = parseInt(argv[++i]!, 10);
    else if (a === "--phase" && argv[i + 1]) args.phase = parseInt(argv[++i]!, 10);
    else if (a === "--summary") args.summary = true;
  }

  return args;
}

// ═══ Display Functions ════════════════════════════════════════════════════════

function displaySummary(index: BlockIndex): void {
  console.log(summarize(index));
  console.log();

  const latest = latestBlocks(index);
  if (latest.size > 0) {
    console.log("Latest blocks:");
    for (const [agent, block] of latest) {
      console.log(`  ${agent}: seq #${block.seq}, phases ${block.startPhase}–${block.endPhase} (emitted ${block.emittedAt})`);
    }
  }
}

function displayPhaseQuery(index: BlockIndex, agent: string, phase: number): void {
  const result = queryPhase(index, { agent, phase });
  if (result.found) {
    console.log(`Phase ${phase} for ${agent}:`);
    console.log(`  Block: seq #${result.block.seq} (phases ${result.block.startPhase}–${result.block.endPhase})`);
    console.log(`  Position in block: ${result.positionInBlock} of ${K}`);
    console.log(`  Info value (mod 17): ${result.infoValue}`);
    console.log(`  Emitted: ${result.block.emittedAt}`);
    console.log(`  Status: ✓ covered by ECC (4 erasures recoverable in this block)`);
  } else {
    console.log(`Phase ${phase} for ${agent}: NOT FOUND`);
    console.log(`  ${result.reason}`);
    console.log(`  This phase is outside recorded block coverage.`);
  }
}

interface GapInfo {
  from: number;
  to: number;
  size: number;
  recoverable: boolean;
}

function detectGaps(blocks: readonly BlockRecord[]): GapInfo[] {
  const gaps: GapInfo[] = [];
  for (let i = 1; i < blocks.length; i++) {
    const prev = blocks[i - 1]!;
    const curr = blocks[i]!;
    if (curr.startPhase > prev.endPhase + 1) {
      const from = prev.endPhase + 1;
      const to = curr.startPhase - 1;
      const size = to - from + 1;
      // A gap within a single block's parity window (≤ 4 symbols) is recoverable
      // A gap spanning multiple blocks is NOT recoverable from blocks alone
      // (but may be recoverable via peer observation / HLC merge)
      gaps.push({ from, to, size, recoverable: size <= 4 });
    }
  }
  return gaps;
}

function displayTimeline(index: BlockIndex, agent: string, from: number | null, to: number | null): void {
  const agentBlocks = index.byAgent.get(agent);
  if (!agentBlocks || agentBlocks.length === 0) {
    console.log(`No phase blocks recorded for agent "${agent}".`);
    return;
  }

  const coverage = phaseCoverage(index, agent);
  if (!coverage) return;

  // Filter to range
  const rangeFrom = from ?? coverage.min;
  const rangeTo = to ?? coverage.max;
  const filtered = agentBlocks.filter((b) => b.endPhase >= rangeFrom && b.startPhase <= rangeTo);

  console.log(`Phase history for ${agent} (phases ${rangeFrom}–${rangeTo}):`);
  console.log(`  Total blocks: ${filtered.length} of ${agentBlocks.length}`);
  console.log(`  Full coverage: ${coverage.min}–${coverage.max}`);
  console.log();

  // Detect gaps
  const gaps = detectGaps(filtered);

  // Display timeline
  console.log("  Timeline:");
  for (let i = 0; i < filtered.length; i++) {
    const block = filtered[i]!;
    const age = block.emittedAt ? ` (${block.emittedAt.split("T")[0]})` : "";
    console.log(`  ┌─ Block #${block.seq}: phases ${block.startPhase}–${block.endPhase}${age}`);
    console.log(`  │  ${K} info symbols → ${block.coded.length} coded (4 erasures recoverable)`);
    console.log(`  └─`);

    // Check for gap after this block
    if (i < filtered.length - 1) {
      const gap = gaps.find((g) => g.from === block.endPhase + 1);
      if (gap) {
        const icon = gap.recoverable ? "⚠" : "✗";
        const status = gap.recoverable
          ? "recoverable (within ECC window)"
          : "NOT recoverable from blocks (need peer/HLC)";
        console.log(`  ${icon} GAP: phases ${gap.from}–${gap.to} (${gap.size} missed) — ${status}`);
        console.log();
      }
    }
  }

  // Summary
  console.log();
  if (gaps.length === 0) {
    console.log("  ✓ No gaps — continuous coverage in this range.");
  } else {
    const recoverable = gaps.filter((g) => g.recoverable).length;
    const permanent = gaps.length - recoverable;
    console.log(`  Gaps: ${gaps.length} total (${recoverable} recoverable, ${permanent} need peer data)`);
  }

  // Recovery paths reminder
  if (gaps.length > 0) {
    console.log();
    console.log("  Recovery paths for missed phases:");
    console.log("    1. RS ECC — up to 4 per block (automatic, no peers needed)");
    console.log("    2. Peer observation — HLC merge from any peer who was ahead");
    console.log("    3. Own anchor resume — pick up from last known phase");
  }
}

// ═══ Main ═════════════════════════════════════════════════════════════════════

function main(): void {
  const args = parseArgs();
  const index = loadBlockIndex(args.path);

  if (index.count === 0) {
    console.log("No RS blocks recorded yet.");
    console.log(`Looked in: ${args.path}`);
    console.log("Blocks are emitted every 12 heartbeat ticks by the RS accumulator.");
    return;
  }

  if (args.summary || (!args.agent && args.phase === null)) {
    displaySummary(index);
    return;
  }

  if (args.agent && args.phase !== null) {
    displayPhaseQuery(index, args.agent, args.phase);
    return;
  }

  if (args.agent) {
    displayTimeline(index, args.agent, args.from, args.to);
    return;
  }

  // Fallback
  displaySummary(index);
}

main();
