console.log("[SwarmWorker] Worker script evaluating...");

if (typeof self !== 'undefined' && typeof (self as any).process === 'undefined') {
  (self as any).process = { env: {} };
}
if (typeof self !== 'undefined' && typeof (self as any).Buffer === 'undefined') {
  (self as any).Buffer = { from: (str: string) => new TextEncoder().encode(str) };
}

import { SwarmController } from "../../../Core.TypeScript/swarm/swarm-controller";
import type { World } from "../../../Core.TypeScript/observe/observe";
import { create as initFrame, loadRom, step, clearCausalMask, compositeInto } from "../../../Core.TypeScript/chip8/chip8";

import { buildMutualSimRom } from "../../../Core.TypeScript/chip8/games/mutual-sim";
import { createCheatTable, applyCheatTable } from "../../../Core.TypeScript/chip8/cheat-engine";
import {
  buildPriorsRegistry,
  priorsForRom,
  romFingerprint,
} from "../../../Core.TypeScript/chip8/game-priors";
import { mutualSimPriors } from "../../../Core.TypeScript/chip8/priors/mutual-sim.priors";
import { singleMoverPriors } from "../../../Core.TypeScript/chip8/priors/single-mover.priors";
import { modeFlipPriors } from "../../../Core.TypeScript/chip8/priors/mode-flip.priors";

console.log("[SwarmWorker] Imports resolved successfully. Building ROM...");

// Committed priors: fingerprint → learned society state. A known cart boots
// already knowing which keys move it; an unknown cart starts from the fresh
// prior while the structural perception layers transfer for free.
const PRIORS_REGISTRY = buildPriorsRegistry([mutualSimPriors, singleMoverPriors, modeFlipPriors]);

let activeRom: Uint8Array = buildMutualSimRom();
let swarm: SwarmController | null = null;
let world: World;
let frame: ReturnType<typeof initFrame>;
let cheatTable: ReturnType<typeof createCheatTable>;
let currentRomRef: Uint8Array;
let cycle = 0;
let isRunning = false;

const STEPS_PER_TICK = 10;
const agentId = "browser-node";
const manualKeys: boolean[] = new Array(16).fill(false);

self.onmessage = async (e: MessageEvent) => {
  try {
    const { type, payload } = e.data;

    if (type === "INIT") {
      console.log(`[SwarmWorker] Initializing swarm (LLM host/model come from persona-registry).`);

      console.log(`[SwarmWorker] About to instantiate SwarmController`);
      swarm = new SwarmController();
      if (payload?.apiKey || payload?.baseUrl || payload?.model) {
        console.warn(
          `[SwarmWorker] Ignoring the LLM settings in this INIT payload — SwarmController ` +
            `resolves host and model from persona-registry and exposes no override.`,
        );
      }
      console.log(`[SwarmWorker] About to call swarm.init()`);
      await swarm.init();
      console.log(`[SwarmWorker] swarm.init() finished`);

      cheatTable = createCheatTable();
      world = {
        backlog: [{ id: "chip8-play-1", title: "Play CHIP-8 Game", ready: true, ambiguous: false }],
        history: [],
        cartography: { scopeLevel: 0, timeOffset: 0 },
      };

      console.log(`[SwarmWorker] About to call initFrame() and loadRom()`);
      frame = initFrame();
      loadRom(activeRom, frame);
      currentRomRef = activeRom;

      const bootPriors = priorsForRom(PRIORS_REGISTRY, activeRom);
      swarm.setGamePriors(bootPriors?.snapshot ?? null);
      console.log(
        bootPriors
          ? `[SwarmWorker] 🧠 Priors loaded for cart "${bootPriors.cart}" (${bootPriors.trainedTicks} trained ticks) — not starting from zero.`
          : `[SwarmWorker] No committed priors for this cart — starting from the fresh prior.`,
      );

      isRunning = true;
      console.log(`[SwarmWorker] About to start loop()`);
      loop(); // Kick off the loop
    } else if (type === "INJECT_EPIGENETIC_MATERIAL") {
      const uploadedRom = new Uint8Array(payload.buffer);
      const fingerprint = romFingerprint(uploadedRom);
      console.log(`[SwarmWorker] 🧬 Received Epigenetic Material. Spectral Fingerprint: ${fingerprint}`);
      console.log(`[SwarmWorker] Integrating Epigenetic Material into the Soft Value Regime...`);

      // Game switching stays inside the soft regime: a known fingerprint
      // restores its committed priors; an unknown one starts from the fresh
      // prior — while the structural perception layers transfer regardless.
      activeRom = uploadedRom;
      if (swarm) {
        const switchPriors = priorsForRom(PRIORS_REGISTRY, uploadedRom);
        swarm.setGamePriors(switchPriors?.snapshot ?? null);
        console.log(
          switchPriors
            ? `[SwarmWorker] 🧠 Priors restored for cart "${switchPriors.cart}".`
            : `[SwarmWorker] Unknown cart ${fingerprint} — fresh prior, structural layers carried over.`,
        );
      }
    } else if (type === "KEY_DOWN") {
      manualKeys[payload.key] = true;
    } else if (type === "KEY_UP") {
      manualKeys[payload.key] = false;
    }
  } catch (err) {
    console.error(`[SwarmWorker] Fatal error in onmessage:`, err);
  }
};

// Game semantic variables stripped for ARC-AGI-3

async function loop() {
  console.log(`[SwarmWorker] loop() cycle=${cycle}`);
  if (!isRunning || !swarm) return;

  if (activeRom !== currentRomRef) {
    console.log(`[CHIP8 Node ${agentId}] ⚡ SPECTRAL SHIFT DETECTED. Rebooting structural bounds...`);
    frame = initFrame();
    loadRom(activeRom, frame);
    currentRomRef = activeRom;
    cycle = 0;
    world = {
      ...world,
      backlog: [{ id: "chip8-play-1", title: "Play Custom CHIP-8 Game", ready: true, ambiguous: false }],
    };
  }

  clearCausalMask(frame);
  applyCheatTable(frame, cheatTable);

  // Run physical simulation, compositing lit pixels across the whole tick
  // (persistence of vision). A raw end-of-tick snapshot phase-locks onto the
  // XOR-erase window of game loops whose length divides STEPS_PER_TICK, and
  // sprites "vanish" for many consecutive frames — the perception layer (and
  // the viewer) should see what a CRT would show instead.
  const displayArray: number[] = new Array(64 * 32).fill(0);
  for (let i = 0; i < STEPS_PER_TICK; i++) {
    step(frame);
    if (frame.fault) {
      console.error("[SwarmWorker] CHIP8 FAULT:", frame.fault);
      break;
    }
    compositeInto(displayArray, frame);
  }
  if (cycle % 30 === 0) {
    console.log(`[SwarmWorker] cycle=${cycle}, PC=${frame.pc}, I=${frame.i}, display_pixels=${frame.display.size}`);
  }

  const memArray = new Uint8Array(4096);
  for (const [addr, val] of frame.mem.entries()) {
    if (addr < 4096) memArray[addr] = val;
  }
  const memorySectors = [memArray];
  const causalMask = Array.from(frame.causalMask);

  world = {
    ...world,
    cheatEngine: { memorySectors, causalMask, display: displayArray },
  };

  if (!world.backlog.find((i) => i.id === "chip8-play-1")) {
    world = {
      ...world,
      backlog: [...world.backlog, { id: "chip8-play-1", title: "Play CHIP-8 Game", ready: true, ambiguous: false }],
    };
  }

  world = await swarm.tick(world);
  frame.keys.fill(false);
  for (let k = 0; k < 16; k++) {
    if (manualKeys[k]) frame.keys[k] = true;
  }

  // Tag detection, scoring, respawn, and win/lose all live IN THE CART now
  // (games/mutual-sim.ts): the previous out-of-cart hack here used
  // Math.random teleports — ambient entropy the cart's seeded RND replaces.

  if (world.history && world.history.length > 0) {
    const lastEvent = world.history[world.history.length - 1];
    if (lastEvent?.type === "do_item" && lastEvent.actions) {
      for (const action of lastEvent.actions) {
        if (action.tool === "pressKey" && typeof action.args?.key === "number") {
          const key = action.args.key;
          if (key >= 0 && key <= 15) frame.keys[key] = true;
        }
      }
    }
  }

  // Level up events removed for ARC-AGI-3

  // Pass data directly to the frontend player component over postMessage
  const eventAction = {
    kind: "chip8-frame",
    display: displayArray,
    cycle: cycle,
    keys: Array.from(frame.keys),
    keyPredictions: world.cheatEngine?.keyPredictions || {},
    // The snap (CMYK half) and the forced-perception readout for the overlay.
    chosenKey: world.cheatEngine?.chosenKey ?? -1,
    arena: world.cheatEngine?.arena ?? null
  };

  self.postMessage({ type: "FRAME", payload: eventAction });

  cycle++;

  // Throttle to ~30 fps
  setTimeout(loop, 32);
}
