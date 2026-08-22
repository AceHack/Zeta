#!/usr/bin/env bun
import { SwarmController } from "./swarm-controller";
import { type World } from "../observe/observe";
import { create as initFrame, loadRom, step, clearCausalMask } from "../chip8/chip8";
import { buildArcPuzzlesRom } from "../chip8/games/arc-puzzles";
import { renderChip8TvDocument } from "../chip8/chip8-tv";
import { createCheatTable, applyCheatTable, injectCode } from "../chip8/cheat-engine";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Initializing Mux-Duplex Swarm...");
  const swarm = new SwarmController();
  await swarm.init(0.0);

  console.log("Building ARC Puzzles ROM...");
  const rom = buildArcPuzzlesRom();
  
  console.log("Initializing CHIP-8 Emulator Frame...");
  const frame = initFrame();
  loadRom(rom, frame);

  console.log("Initializing Cheat Engine...");
  const cheatTable = createCheatTable();

  let world: World = {
    backlog: [{
      id: "chip8-play-1",
      title: "Play CHIP-8 Game",
      ready: true,
      ambiguous: false
    }],
    history: [],
    cartography: { scopeLevel: 0, timeOffset: 0 }
  };

  const STEPS_PER_TICK = 10;

  // Main Event Loop
  for (let cycle = 0; cycle < 1000; cycle++) {
    if (cycle % 100 === 0) {
      console.log(`\n=== CHIP-8 / Swarm Tick ${cycle + 1} ===`);
    }
    
    // Clear the causal mask so we only capture this tick's causal footprint
    clearCausalMask(frame);

    // Apply Cheat Engine freezes right before stepping
    applyCheatTable(frame, cheatTable);

    // Run a few steps of the physical simulation
    for (let i = 0; i < STEPS_PER_TICK; i++) {
      // If waiting for key press, we should stop stepping and let the swarm tick
      if (frame.pc > 0 && frame.pc < 4096) {
        const op = ((frame.mem.get(frame.pc) ?? 0) << 8) | (frame.mem.get(frame.pc + 1) ?? 0);
        if ((op & 0xF000) === 0xF000 && (op & 0x00FF) === 0x000A) {
          // Waiting for key press (FX0A)
          break;
        }
      }
      step(frame);
    }

    // Capture Causal Footprint & Visuals
    const memArray = new Uint8Array(4096);
    for (const [addr, val] of frame.mem.entries()) {
      if (addr < 4096) memArray[addr] = val;
    }
    const memorySectors = [memArray];
    const causalMask = Array.from(frame.causalMask);
    const displayArray = new Array(64 * 32).fill(false);
    for (let i = 0; i < displayArray.length; i++) {
      displayArray[i] = frame.display.has(i) && frame.display.get(i)!;
    }

    // Attach CheatEngine to World
    world = {
      ...world,
      cheatEngine: {
        memorySectors,
        causalMask,
        display: displayArray
      }
    };

    // Keep item in backlog so the Swarm keeps playing
    if (!world.backlog.find(i => i.id === "chip8-play-1")) {
      world = {
        ...world,
        backlog: [...world.backlog, {
          id: "chip8-play-1",
          title: "Play CHIP-8 Game",
          ready: true,
          ambiguous: false
        }]
      };
    }

    // Tick the Swarm!
    world = await swarm.tick(world);

    // Release all keys before evaluating new actions
    frame.keys.fill(false);

    // Read actions out of the history log
    if (world.history && world.history.length > 0) {
      const lastEvent = world.history[world.history.length - 1];
      if (lastEvent?.type === "do_item" && lastEvent.actions) {
        // DEBUG
        if (lastEvent.actions.length > 1) {
           console.log("[DEBUG] Executing ferried actions:", JSON.stringify(lastEvent.actions));
        }
        for (const action of lastEvent.actions) {
          if (action.tool === "pressKey" && typeof action.args?.key === "number") {
            const key = action.args.key;
            if (key >= 0 && key <= 15) {
              frame.keys[key] = true;
            }
          } else if (action.tool === "freezeMemory" && typeof action.args?.address === "number" && typeof action.args?.value === "number") {
            console.log(`[CheatEngine] Freezing address ${action.args.address} to ${action.args.value}`);
            cheatTable.frozenAddresses.set(action.args.address, action.args.value);
          } else if (action.tool === "unfreezeMemory" && typeof action.args?.address === "number") {
            console.log(`[CheatEngine] Unfreezing address ${action.args.address}`);
            cheatTable.frozenAddresses.delete(action.args.address);
          } else if (action.tool === "injectCode" && typeof action.args?.address === "number" && typeof action.args?.hex === "string") {
            console.log(`[CheatEngine] Injecting hex '${action.args.hex}' at address ${action.args.address}`);
            try {
              injectCode(frame, action.args.address, action.args.hex);
            } catch (e) {
              console.error(`[CheatEngine] Failed to inject code:`, e);
            }
          }
        }
      }
    }

    // Output LLMTV Interface
    if (cycle % 1 === 0) { // Render every cycle for live feed
      const html = renderChip8TvDocument({
        display: displayArray,
        cycle,
        causalSignature: world.cartography?.activeOrbitSignature || "unknown",
        hat: "Commander",
        ...(world.cheatEngine?.keyPredictions ? { keyPredictions: world.cheatEngine.keyPredictions } : {})
      });
      const distDir = path.join(__dirname, "../../../dist");
      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
      }
      fs.writeFileSync(path.join(distDir, "chip8-tv.html"), html);
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
