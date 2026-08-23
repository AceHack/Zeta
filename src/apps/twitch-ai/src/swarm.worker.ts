import { SwarmController } from "../../../Core.TypeScript/swarm/swarm-controller";
import type { World } from "../../../Core.TypeScript/observe/observe";
import { create as initFrame, loadRom, step, clearCausalMask } from "../../../Core.TypeScript/chip8/chip8";

import { buildMutualSimRom } from "../../../Core.TypeScript/chip8/games/mutual-sim";
import { createCheatTable, applyCheatTable } from "../../../Core.TypeScript/chip8/cheat-engine";

function computeSpectralFingerprint(buf: Uint8Array): string {
  let hash = 2166136261;
  for (let i = 0; i < buf.length; i++) {
    hash ^= buf[i]!;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

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

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === "INIT") {
    console.log(`[SwarmWorker] Initializing swarm (LLM host/model come from persona-registry).`);

    swarm = new SwarmController();

    // SwarmController.init takes a UDP drop-rate number, not LLM settings.
    // Every backend it builds is resolved inside init() from persona-registry
    // (`config.harness.host`, `config.preferredModel`) with a hardcoded
    // `apiKey: "dummy"` -- there is no seam through which an apiKey/baseUrl/model
    // arriving on this payload could reach a backend.
    //
    // #14159 restored a call passing `{apiKey, baseUrl, model}` here (a type error,
    // fixed in #14169 by deleting the argument). Deleting the argument left the
    // BRANCH behind: it still logged "Using remote LLM endpoint: <baseUrl>" for a
    // remote endpoint this worker cannot reach, and "local mock LLM fallback" for a
    // backend that is neither local-by-choice nor a mock. Both lines announced a
    // capability that is absent, which is worse than silence.
    //
    // The capability REMAINS ABSENT. Wiring these settings through would mean giving
    // init() a per-node host/model/key override, i.e. changing the contract that
    // persona-registry owns -- a design decision for whoever owns twitch-ai, not a
    // CI-unblock. Until then the honest thing is to say the settings are ignored,
    // because the page still sends them and dropping them silently is its own lie.
    if (payload?.apiKey || payload?.baseUrl || payload?.model) {
      console.warn(
        `[SwarmWorker] Ignoring the LLM settings in this INIT payload — SwarmController ` +
          `resolves host and model from persona-registry and exposes no override.`,
      );
    }
    await swarm.init();

    cheatTable = createCheatTable();
    world = {
      backlog: [{ id: "chip8-play-1", title: "Play CHIP-8 Game", ready: true, ambiguous: false }],
      history: [],
      cartography: { scopeLevel: 0, timeOffset: 0 },
    };

    frame = initFrame();
    loadRom(activeRom, frame);
    currentRomRef = activeRom;

    isRunning = true;
    loop(); // Kick off the loop
  } else if (type === "INJECT_EPIGENETIC_MATERIAL") {
    const uploadedRom = new Uint8Array(payload.buffer);
    const fingerprint = computeSpectralFingerprint(uploadedRom);
    console.log(`[SwarmWorker] 🧬 Received Epigenetic Material. Spectral Fingerprint: ${fingerprint}`);
    console.log(`[SwarmWorker] Integrating Epigenetic Material into the Soft Value Regime...`);

    // As per Zeta research, we avoid Kinetic Offsets (byte-by-byte corruption of brittle machine code).
    // The structural bounds of the game are reset to the new fingerprint,
    // and the Swarm's Bayesian predictors organically adapt to the new causal footprint.
    activeRom = uploadedRom;
  }
};

let gameLevel = 1;
let gameObjective = "Replicate Pattern";

async function loop() {
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

  // Run physical simulation
  for (let i = 0; i < STEPS_PER_TICK; i++) {
    if (frame.pc > 0 && frame.pc < 4096) {
      const op = ((frame.mem.get(frame.pc) ?? 0) << 8) | (frame.mem.get(frame.pc + 1) ?? 0);
      if ((op & 0xf000) === 0xf000 && (op & 0x00ff) === 0x000a) {
        if (!frame.keys.some((k) => k)) break;
      }
    }
    step(frame);
  }

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

  // Sniff Gamification Level Transitions (Mutual Sim logic)
  if (frame.v[8] === 0) {
    gameLevel = 1;
    gameObjective = "Hide & Seek: Simulator is 'It'!";
  } else if (frame.v[8] === 1) {
    gameLevel = 2;
    gameObjective = "Tag! You're 'It'!";
  }

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

  // Pass data directly to the frontend player component over postMessage
  const eventAction = {
    kind: "chip8-frame",
    display: displayArray,
    cycle: cycle,
    keyPredictions: world.cheatEngine?.keyPredictions || {},
    activeConcept: (world.cheatEngine as any)?.activeConcept,
    linguisticToken: (world.cheatEngine as any)?.linguisticToken,
    gameLevel: gameLevel,
    gameObjective: gameObjective,
    levelUpEvent: frame.pc === 0x204 || frame.pc === 0x238 || frame.pc === 0x270 || frame.pc === 0x2a8,
  };

  self.postMessage({ type: "FRAME", payload: eventAction });

  cycle++;

  // Throttle to ~30 fps
  setTimeout(loop, 32);
}
