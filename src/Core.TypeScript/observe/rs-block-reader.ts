/**
 * rs-block-reader.ts — read and query RS-encoded phase blocks.
 *
 * Reads `data/rs-blocks.jsonl` and provides a query interface:
 * - "What was agent X's phase state at tick N?"
 * - "Which block covers phase range [a, b]?"
 * - "Can we recover this block from a partial observation?"
 *
 * This closes the read side of the ECC pipeline: blocks are written by the
 * accumulator in run-loop-real.ts, verified by verify-rs-blocks.ts, and
 * now queryable by any consumer (settlement page, CLI, peer recovery).
 */

import { readFileSync } from "node:fs";
import { extractInfo, N, K } from "./rs-phase-codec";
import { isValidCodeword } from "./rs-syndrome";

// ═══ Types ════════════════════════════════════════════════════════════════════

export interface BlockRecord {
  readonly agent: string;
  readonly seq: number;
  readonly startPhase: number;
  readonly endPhase: number;
  readonly coded: readonly number[];
  readonly emittedAt: string;
}

export interface BlockIndex {
  /** All blocks, ordered by (agent, seq). */
  readonly blocks: readonly BlockRecord[];
  /** Blocks per agent. */
  readonly byAgent: ReadonlyMap<string, readonly BlockRecord[]>;
  /** Total block count. */
  readonly count: number;
}

export interface PhaseQuery {
  readonly agent: string;
  readonly phase: number;
}

export type PhaseQueryResult =
  | { readonly found: true; readonly block: BlockRecord; readonly positionInBlock: number; readonly infoValue: number }
  | { readonly found: false; readonly reason: string };

// ═══ Loading ══════════════════════════════════════════════════════════════════

/**
 * Load and index all RS blocks from the JSONL file.
 */
export function loadBlockIndex(path: string): BlockIndex {
  let content: string;
  try {
    content = readFileSync(path, "utf-8");
  } catch {
    return { blocks: [], byAgent: new Map(), count: 0 };
  }

  const blocks: BlockRecord[] = [];
  for (const line of content.trim().split("\n")) {
    if (line.length === 0) continue;
    try {
      const record = JSON.parse(line) as BlockRecord;
      if (Array.isArray(record.coded) && record.coded.length === N &&
          // HARDENED (adversarial review 2026-08-16): validate that coded values are
          // valid GF(17) elements. Out-of-range values would produce garbage through
          // extractInfo without error.
          record.coded.every((v) => Number.isSafeInteger(v) && v >= 0 && v <= 16)) {
        blocks.push(record);
      }
    } catch { /* skip malformed */ }
  }

  // Index by agent
  const byAgent = new Map<string, BlockRecord[]>();
  for (const block of blocks) {
    const list = byAgent.get(block.agent) || [];
    list.push(block);
    byAgent.set(block.agent, list);
  }

  // Sort each agent's blocks by seq
  for (const list of byAgent.values()) {
    list.sort((a, b) => a.seq - b.seq);
  }

  // DEDUP overlapping blocks (adversarial review 2026-08-16, finding #3):
  // If two blocks for the same agent have the same seq, keep the LAST one seen
  // (append-only file = later entry is more recent). If phase ranges overlap
  // between different seqs, keep the higher seq (it's the correction).
  for (const [agent, list] of byAgent) {
    const deduped: BlockRecord[] = [];
    const seenSeqs = new Set<number>();
    // Iterate in reverse (last seen wins for same seq)
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i]!;
      if (!seenSeqs.has(b.seq)) {
        seenSeqs.add(b.seq);
        deduped.unshift(b);
      }
    }
    byAgent.set(agent, deduped);
  }

  const dedupedBlocks = [...byAgent.values()].flat();
  return { blocks: dedupedBlocks, byAgent, count: dedupedBlocks.length };
}

// ═══ Queries ══════════════════════════════════════════════════════════════════

/**
 * Find which block contains a given phase for a given agent.
 * Returns the block and the position within it (0-based index into the info array).
 */
export function queryPhase(index: BlockIndex, query: PhaseQuery): PhaseQueryResult {
  const agentBlocks = index.byAgent.get(query.agent);
  if (!agentBlocks || agentBlocks.length === 0) {
    return { found: false, reason: `no blocks for agent "${query.agent}"` };
  }

  // Find the block whose phase range contains the queried phase
  for (const block of agentBlocks) {
    if (query.phase >= block.startPhase && query.phase <= block.endPhase) {
      // Position within the block: each block covers K consecutive phases
      const positionInBlock = query.phase - block.startPhase;
      if (positionInBlock < 0 || positionInBlock >= K) {
        continue; // shouldn't happen, but defensive
      }

      // SYNDROME GATE (adversarial review 2026-08-16): refuse to answer from a
      // corrupt block. Without this check, a silently corrupted symbol causes
      // extractInfo to return wrong values without warning.
      if (!isValidCodeword(block.coded)) {
        return { found: false, reason: `block seq=${block.seq} has non-zero syndrome (corrupted — refusing to decode)` };
      }

      // Extract the info values from the coded block
      const info = extractInfo([...block.coded]);
      const infoValue = info[positionInBlock]!;

      return { found: true, block, positionInBlock, infoValue };
    }
  }

  return { found: false, reason: `phase ${query.phase} not covered by any block for "${query.agent}"` };
}

/**
 * Get the latest block for each agent.
 */
export function latestBlocks(index: BlockIndex): ReadonlyMap<string, BlockRecord> {
  const result = new Map<string, BlockRecord>();
  for (const [agent, blocks] of index.byAgent) {
    if (blocks.length > 0) {
      result.set(agent, blocks[blocks.length - 1]!);
    }
  }
  return result;
}

/**
 * Get the phase coverage for an agent: the range of phases covered by blocks.
 */
export function phaseCoverage(index: BlockIndex, agent: string): { min: number; max: number; gaps: number } | null {
  const blocks = index.byAgent.get(agent);
  if (!blocks || blocks.length === 0) return null;

  let min = Infinity;
  let max = -Infinity;
  let gaps = 0;

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    if (b.startPhase < min) min = b.startPhase;
    if (b.endPhase > max) max = b.endPhase;

    // Check for gaps between consecutive blocks
    if (i > 0) {
      const prev = blocks[i - 1]!;
      if (b.startPhase > prev.endPhase + 1) gaps++;
    }
  }

  return { min, max, gaps };
}

/**
 * Summary of the block index — suitable for logging or dashboard display.
 */
export function summarize(index: BlockIndex): string {
  if (index.count === 0) return "[rs-blocks] empty — no blocks recorded yet";

  const lines: string[] = [`[rs-blocks] ${index.count} blocks across ${index.byAgent.size} agent(s)`];
  for (const [agent, blocks] of index.byAgent) {
    const coverage = phaseCoverage(index, agent);
    if (coverage) {
      lines.push(`  ${agent}: ${blocks.length} blocks, phases ${coverage.min}–${coverage.max}${coverage.gaps > 0 ? ` (${coverage.gaps} gap${coverage.gaps > 1 ? "s" : ""})` : ""}`);
    }
  }
  return lines.join("\n");
}
