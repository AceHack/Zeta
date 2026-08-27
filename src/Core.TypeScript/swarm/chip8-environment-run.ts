#!/usr/bin/env bun
import { SwarmController } from "./swarm-controller";
import { type World } from "../observe/observe";
import { create as initFrame, loadRom, step, clearCausalMask } from "../chip8/chip8";
import { buildArcPuzzlesRom } from "../chip8/games/arc-puzzles";
import { renderChip8TvDocument } from "../chip8/chip8-tv";
import { createCheatTable, applyCheatTable, injectCode, readRamRange } from "../chip8/cheat-engine";
import { FULL_RAM_TAS_CHANNELS, issueChip8ChannelGrant } from "../chip8/channel-grant";
import { COMMON_SEED } from "../observe/phase-clock";
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
  const grantResult = await issueChip8ChannelGrant(
    "chip8-environment-harness",
    rom,
    FULL_RAM_TAS_CHANNELS,
    COMMON_SEED,
  );
  if (!grantResult.ok) {
    console.error(`[ChannelGrant] Refused run: ${grantResult.feedback.code}: ${grantResult.feedback.detail}`);
    return;
  }
  const channelGrant = grantResult.value;

  let world: World = {
    backlog: [
      {
        id: "chip8-play-1",
        title: "Play CHIP-8 Game",
        ready: true,
        ambiguous: false,
      },
    ],
    history: [],
    cartography: { scopeLevel: 0, timeOffset: 0 },
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
    const freezeResult = applyCheatTable(channelGrant, frame, cheatTable);
    if (!freezeResult.ok) {
      console.error(`[ChannelGrant] Refused run: ${freezeResult.feedback.code}: ${freezeResult.feedback.detail}`);
      return;
    }

    // Run a few steps of the physical simulation
    for (let i = 0; i < STEPS_PER_TICK; i++) {
      // If waiting for key press, we should stop stepping and let the swarm tick
      if (frame.pc > 0 && frame.pc < 4096) {
        const instruction = readRamRange(channelGrant, frame, frame.pc, frame.pc + 1);
        if (!instruction.ok) {
          console.error(`[ChannelGrant] Refused run: ${instruction.feedback.code}: ${instruction.feedback.detail}`);
          return;
        }
        const op = ((instruction.value.bytes[0] ?? 0) << 8) | (instruction.value.bytes[1] ?? 0);
        if ((op & 0xf000) === 0xf000 && (op & 0x00ff) === 0x000a) {
          // Waiting for key press (FX0A)
          break;
        }
      }
      step(frame);
    }

    // Capture Causal Footprint & Visuals
    const memoryResult = readRamRange(channelGrant, frame, 0, 0xfff);
    if (!memoryResult.ok) {
      console.error(`[ChannelGrant] Refused run: ${memoryResult.feedback.code}: ${memoryResult.feedback.detail}`);
      return;
    }
    const memArray = memoryResult.value.bytes;
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
        display: displayArray,
        channelMeter: memoryResult.value.meter,
      },
    };

    // Keep item in backlog so the Swarm keeps playing
    if (!world.backlog.find((i) => i.id === "chip8-play-1")) {
      world = {
        ...world,
        backlog: [
          ...world.backlog,
          {
            id: "chip8-play-1",
            title: "Play CHIP-8 Game",
            ready: true,
            ambiguous: false,
          },
        ],
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
          } else if (
            action.tool === "freezeMemory" &&
            typeof action.args?.address === "number" &&
            typeof action.args?.value === "number"
          ) {
            console.log(`[CheatEngine] Freezing address ${action.args.address} to ${action.args.value}`);
            cheatTable.frozenAddresses.set(action.args.address, action.args.value);
          } else if (action.tool === "unfreezeMemory" && typeof action.args?.address === "number") {
            console.log(`[CheatEngine] Unfreezing address ${action.args.address}`);
            cheatTable.frozenAddresses.delete(action.args.address);
          } else if (
            action.tool === "injectCode" &&
            typeof action.args?.address === "number" &&
            typeof action.args?.hex === "string"
          ) {
            console.log(`[CheatEngine] Injecting hex '${action.args.hex}' at address ${action.args.address}`);
            const injection = injectCode(channelGrant, frame, action.args.address, action.args.hex);
            if (!injection.ok) {
              console.error(`[ChannelGrant] Refused run: ${injection.feedback.code}: ${injection.feedback.detail}`);
              return;
            }
          }
        }
      }
    }

    // Output LLMTV Interface
    if (cycle % 1 === 0) {
      // Render every cycle for live feed
      const html = renderChip8TvDocument({
        display: displayArray,
        cycle,
        causalSignature: world.cartography?.activeOrbitSignature || "unknown",
        hat: "Commander",
        ...(world.cheatEngine?.keyPredictions ? { keyPredictions: world.cheatEngine.keyPredictions } : {}),
      });
      const distDir = path.join(__dirname, "../../../dist");
      if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
      }
      fs.writeFileSync(path.join(distDir, "chip8-tv.html"), html);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
