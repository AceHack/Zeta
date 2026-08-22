#!/usr/bin/env bun
/**
 * src/Core.TypeScript/arc-solver/arc-harness.ts
 * 
 * Minimal viable harness to feed an ARC puzzle to the Swarm.
 * We parse the JSON, stringify it to avoid building a complex grid parser right away,
 * and present it as a BacklogItem for the Swarm to observe and manipulate.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SwarmController } from "../swarm/swarm-controller";
import type { World, BacklogItem } from "../observe/observe";

async function main() {
  console.log("Initializing ARC-AGI Swarm Harness...");
  
  // 1. Pick a puzzle from CLI or fallback
  const filename = process.argv[2] || "007bbfb7.json";
  const puzzlePath = resolve(process.cwd(), "data/ARC-AGI/data/training", filename.endsWith(".json") ? filename : `${filename}.json`);
  let puzzleRaw: any;
  try {
    const raw = readFileSync(puzzlePath, "utf8");
    puzzleRaw = JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to load puzzle at ${puzzlePath}. Ensure 'data/ARC-AGI' is cloned.`);
    process.exit(1);
  }

  // 2. Wrap each train example in a BacklogItem
  const backlog: BacklogItem[] = [];
  if (puzzleRaw.train && Array.isArray(puzzleRaw.train)) {
    puzzleRaw.train.forEach((example: any, idx: number) => {
      backlog.push({
        id: `ARC-${filename}-train-${idx}`,
        title: `Solve ARC Puzzle ${filename} (Train Example ${idx + 1})`,
        ready: false, // Not ready initially, needs decomposition
        ambiguous: true, // We flag as ambiguous to encourage the Composer to break it down
        needsNewAction: true,
        gridData: {
          input: example.input,
          output: example.output
        }
      });
    });
  }

  // 3. Initialize Swarm
  const swarm = new SwarmController();
  await swarm.init(0.0); // 0% drop rate for local test

  // 4. Construct World
  let world: World = {
    mode: "work", // Start in work mode to engage the backlog
    backlog: backlog,
    cartography: { scopeLevel: 0, timeOffset: 0 },
    operator: { pendingMessage: false, pendingFerry: false },
    history: []
  };

  console.log(`\n=== PUZZLE INGESTED: ${filename} ===`);
  console.log(`Loaded ${backlog.length} training examples into the backlog.`);
  
  // 5. Run the Swarm Tick Loop until backlog is empty
  console.log("Feeding to Swarm...\n");
  
  // Safety valve to prevent infinite loops during testing
  let maxTicks = 20; 
  while (world.backlog.length > 0 && maxTicks > 0) {
    world = await swarm.tick(world);
    maxTicks--;
  }
  
  console.log("\n=== SWARM RUN COMPLETE ===");
  if (world.backlog.length > 0) {
    console.log("WARN: Backlog not empty. Max ticks reached.");
  }

  // 6. Aggregate KPI
  // flatMap, not filter+map: `World.history` is a discriminated union now
  // (was `any[]`), and `filter` does not narrow — the narrowing has to happen
  // where the value is produced.
  const evaluations = (world.history ?? []).flatMap((h) =>
    h.type === "do_item" && h.evaluation ? [h.evaluation] : [],
  );
  
  if (evaluations.length > 0) {
    const avgAccuracy = evaluations.reduce((sum, ev) => sum + ev.accuracy, 0) / evaluations.length;
    console.log(`\n[AGGREGATE KPI] Final Pixel Accuracy across ${evaluations.length} evaluations: ${avgAccuracy.toFixed(2)}%`);
  } else {
    console.log("\n[AGGREGATE KPI] No evaluations recorded.");
  }
  
  return 0;
}

if (import.meta.main) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
