#!/usr/bin/env bun
import { SwarmController } from "./swarm-controller";
import { type World } from "../observe/observe";
import { create as initFrame, loadRom, step, clearCausalMask } from "../chip8/chip8";
import { buildArc3Rom } from "../chip8/games/arc3-puzzle";
import { createCheatTable, applyCheatTable, injectCode } from "../chip8/cheat-engine";
import { createRealtimeClient } from "../observe/realtime-client";

// Connect to local realtime server (default port 9876)
const ZETA_REALTIME_URL = process.env.ZETA_REALTIME_URL || "ws://localhost:9876";

async function main() {
  const agentId = process.argv[2] || "chip8-live-node";
  console.log(`Initializing CHIP-8 Live Node [${agentId}] (connecting to ${ZETA_REALTIME_URL})...`);
  
  const client = createRealtimeClient({ url: ZETA_REALTIME_URL, timeoutMs: 3000, autoReconnect: true });
  await client.connect();

  let activeRom = buildArc3Rom();

  // Listen for Epigenetic Material from the Twitch UI
  client.onEvent((event) => {
    if (event.action && event.action.kind === "INJECT_EPIGENETIC_MATERIAL" && event.action.payload) {
      console.log(`[CHIP8 Node ${agentId}] 🧬 Received Epigenetic Material! Fingerprint: ${event.action.fingerprint}`);
      const payload = event.action.payload as number[];
      activeRom = new Uint8Array(payload);
      // We will hot-load this in the main loop
    }
  });

  console.log(`[${agentId}] Initializing Mux-Duplex Swarm...`);
  const swarm = new SwarmController();
  await swarm.init(0.0);

  console.log(`[${agentId}] Building Initial ROM...`);
  
  console.log(`[${agentId}] Initializing CHIP-8 Emulator Frame...`);

  console.log(`[${agentId}] Initializing Cheat Engine...`);
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
  let running = true;
  
  // Handle clean exit
  process.on('SIGINT', () => { running = false; });

  let cycle = 0;
  let frame = initFrame();
  loadRom(activeRom, frame);
  let currentRomRef = activeRom;

  // Main Event Loop (runs continuously)
  while (running) {
    // Check if we need to hot-swap the ROM
    if (activeRom !== currentRomRef) {
      console.log(`[CHIP8 Node ${agentId}] ⚡ INTEGRATING EPIGENETIC MATERIAL INTO SOFT VALUE REGIME...`);
      frame = initFrame(); // Reset emulator state
      loadRom(activeRom, frame);
      currentRomRef = activeRom;
      cycle = 0; // Reset cycle
      
      // Wipe backlog so Swarm resets context
      world.backlog = [{
        id: "chip8-play-1",
        title: "Play Custom CHIP-8 Game",
        ready: true,
        ambiguous: false
      }];
    }

    if (cycle % 100 === 0) {
      console.log(`\n=== CHIP-8 / Swarm Tick ${cycle + 1} [${agentId}] ===`);
    }
    
    clearCausalMask(frame);
    applyCheatTable(frame, cheatTable);

    // Run physical simulation
    for (let i = 0; i < STEPS_PER_TICK; i++) {
      if (frame.pc > 0 && frame.pc < 4096) {
        const op = ((frame.mem.get(frame.pc) ?? 0) << 8) | (frame.mem.get(frame.pc + 1) ?? 0);
        if ((op & 0xF000) === 0xF000 && (op & 0x00FF) === 0x000A) {
          if (!frame.keys.some(k => k)) {
            break; // Waiting for key press (FX0A) and no keys are pressed yet
          }
        }
      }
      step(frame);
    }

    // Capture state
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

    world = {
      ...world,
      cheatEngine: {
        memorySectors,
        causalMask,
        display: displayArray
      }
    };

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

    world = await swarm.tick(world);
    frame.keys.fill(false);

    // Process actions
    if (world.history && world.history.length > 0) {
      const lastEvent = world.history[world.history.length - 1];
      if (lastEvent?.type === "do_item" && lastEvent.actions) {
        for (const action of lastEvent.actions) {
          if (action.tool === "pressKey" && typeof action.args?.key === "number") {
            const key = action.args.key;
            if (key >= 0 && key <= 15) {
              frame.keys[key] = true;
            }
          }
        }
      }
    }

    // Push to realtime server every cycle
    const event = {
      id: `chip8-frame-${Date.now()}-${cycle}`,
      at: new Date().toISOString(),
      by: agentId,
      action: { 
        kind: "chip8-frame",
        display: displayArray, 
        cycle: cycle,
        keyPredictions: world.cheatEngine?.keyPredictions || {},
        activeConcept: (world.cheatEngine as any)?.activeConcept,
        linguisticToken: (world.cheatEngine as any)?.linguisticToken,
        gameLevel: (world.cheatEngine as any)?.gameLevel,
        gameObjective: (world.cheatEngine as any)?.gameObjective,
        levelUpEvent: (world.cheatEngine as any)?.levelUpEvent
      }
    };
    
    // Fire and forget
    client.push(event).catch(() => {});
    
    cycle++;
    
    // Throttle loop to ~30fps for smooth viewing without destroying the CPU
    await new Promise(r => setTimeout(r, 32)); 
  }

  console.log("Shutting down...");
  client.close();
  process.exit(0);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
