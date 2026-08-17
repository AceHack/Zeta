#!/usr/bin/env bun
/**
 * verify-rs-blocks.ts — continuously validate RS block recoverability.
 *
 * Reads `data/rs-blocks.jsonl`, simulates random erasures on each block,
 * recovers via Lagrange interpolation, and asserts the recovery matches.
 *
 * This closes the ECC loop: blocks aren't just "theoretically recoverable" —
 * they're continuously validated against the actual codec.
 *
 * Usage:
 *   bun src/Core.TypeScript/observe/verify-rs-blocks.ts [--path data/rs-blocks.jsonl]
 *   bun src/Core.TypeScript/observe/verify-rs-blocks.ts --erasures 3
 *
 * Exit codes:
 *   0 — all blocks verified (or no blocks to verify)
 *   1 — at least one block failed recovery
 */

import { readFileSync } from "node:fs";
import { recoverPhaseBlock, N } from "./rs-phase-codec";
import { isValidCodeword } from "./rs-syndrome";

interface BlockRecord {
  agent: string;
  seq: number;
  startPhase: number;
  endPhase: number;
  coded: number[];
  emittedAt: string;
}

function parseArgs(): { path: string; erasures: number } {
  const args = process.argv.slice(2);
  let path = "data/rs-blocks.jsonl";
  let erasures = 4; // default: maximum recoverable

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--path" && args[i + 1]) path = args[++i]!;
    if (args[i] === "--erasures" && args[i + 1]) erasures = parseInt(args[++i]!, 10);
  }

  return { path, erasures: Math.min(erasures, 4) };
}

/**
 * Generate `count` distinct random indices in [0, max).
 * Deterministic from a seed for reproducibility.
 */
function randomIndices(count: number, max: number, seed: number): number[] {
  const indices = new Set<number>();
  let s = seed >>> 0;
  while (indices.size < count) {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    s = s >>> 0;
    indices.add(s % max);
  }
  return [...indices];
}

function main(): void {
  const { path, erasures } = parseArgs();

  let content: string;
  try {
    content = readFileSync(path, "utf-8");
  } catch {
    console.log(`[verify-rs] No blocks file at ${path} — nothing to verify`);
    process.exit(0);
  }

  const lines = content.trim().split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) {
    console.log("[verify-rs] Empty blocks file — nothing to verify");
    process.exit(0);
  }

  let verified = 0;
  let failed = 0;

  for (let i = 0; i < lines.length; i++) {
    let block: BlockRecord;
    try {
      block = JSON.parse(lines[i]!) as BlockRecord;
    } catch {
      console.warn(`[verify-rs] line ${i + 1}: malformed JSON, skipping`);
      continue;
    }

    if (!Array.isArray(block.coded) || block.coded.length !== N) {
      console.warn(`[verify-rs] line ${i + 1}: invalid coded array (expected ${N} symbols), skipping`);
      continue;
    }

    // INTEGRITY CHECK (syndrome): detect silent corruption BEFORE attempting recovery.
    // A non-zero syndrome means at least one symbol is wrong — the block cannot be trusted.
    if (!isValidCodeword(block.coded)) {
      console.error(
        `[verify-rs] CORRUPT block seq=${block.seq} agent=${block.agent}: syndrome non-zero (silent corruption detected)`,
      );
      failed++;
      continue;
    }

    // Simulate erasures — seeded from block data + current time for coverage rotation.
    // HARDENED (adversarial review 2026-08-16): the old seed was purely deterministic from
    // (seq, line index), creating blind spots an adversary could target. Adding Date.now()
    // rotates which positions are tested across runs, eliminating static blind spots while
    // keeping reproducibility within a single run (all blocks in one invocation use the
    // same time component).
    const timeSalt = Math.floor(Date.now() / 60000); // changes every minute
    const erasePositions = randomIndices(erasures, N, block.seq * 1000 + i + timeSalt);
    const observation = block.coded.map((v, idx) =>
      erasePositions.includes(idx) ? null : { value: v },
    );

    const result = recoverPhaseBlock(observation);
    if (!result.ok) {
      console.error(
        `[verify-rs] FAILED block seq=${block.seq} agent=${block.agent} phases=${block.startPhase}–${block.endPhase}: ${result.reason}`,
      );
      failed++;
      continue;
    }

    // Verify recovery matches original
    const matches = result.block.every((v, idx) => v === block.coded[idx]);
    if (!matches) {
      console.error(
        `[verify-rs] MISMATCH block seq=${block.seq} agent=${block.agent}: recovered differs from original`,
      );
      failed++;
      continue;
    }

    verified++;
  }

  console.log(
    `[verify-rs] ${verified} blocks verified (${erasures} erasures each), ${failed} failed, ${lines.length} total`,
  );

  process.exit(failed > 0 ? 1 : 0);
}

main();
