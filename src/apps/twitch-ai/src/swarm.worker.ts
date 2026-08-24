console.log("[SwarmWorker] Worker script evaluating...");

// Some Core.TypeScript imports probe `process`/`Buffer`; give the worker
// global minimal stand-ins so those probes see defined objects.
const workerGlobal = self as unknown as {
  process?: { env: Record<string, string> };
  Buffer?: { from(str: string): Uint8Array };
};
if (typeof workerGlobal.process === "undefined") {
  workerGlobal.process = { env: {} };
}
if (typeof workerGlobal.Buffer === "undefined") {
  workerGlobal.Buffer = { from: (str: string) => new TextEncoder().encode(str) };
}

import { SwarmController } from "../../../Core.TypeScript/swarm/swarm-controller";
import type { World } from "../../../Core.TypeScript/observe/observe";
import {
  create as initFrame,
  loadRom,
  step,
  clearCausalMask,
  compositeInto,
} from "../../../Core.TypeScript/chip8/chip8";

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
import type { FramePayload, MainToWorkerMessage, WorkerToMainMessage } from "./protocol";

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
/** D6: a paused loop stops SCHEDULING ticks; RESUME restarts the chain. */
let paused = false;

const STEPS_PER_TICK = 10;
const agentId = "browser-node";
const manualKeys: boolean[] = new Array(16).fill(false) as boolean[];

// In a dedicated worker `self.postMessage(message, transfer)` is the
// two-arg worker-scope form; the app tsconfig types `self` as Window
// (no webworker lib), so the worker-scope shape is asserted locally.
const workerScope = self as unknown as {
  postMessage(message: unknown, transfer: ArrayBuffer[]): void;
};
const postToMain = (message: WorkerToMainMessage, transfer: ArrayBuffer[] = []): void => {
  workerScope.postMessage(message, transfer);
};

async function handleMessage(message: MainToWorkerMessage): Promise<void> {
  switch (message.type) {
    case "INIT": {
      console.log(
        "[SwarmWorker] Initializing swarm (LLM host/model come from persona-registry).",
      );

      console.log("[SwarmWorker] About to instantiate SwarmController");
      swarm = new SwarmController();
      if (message.payload.apiKey !== null || message.payload.baseUrl !== null) {
        console.warn(
          "[SwarmWorker] Ignoring the LLM settings in this INIT payload — SwarmController " +
            "resolves host and model from persona-registry and exposes no override.",
        );
      }
      console.log("[SwarmWorker] About to call swarm.init()");
      await swarm.init();
      console.log("[SwarmWorker] swarm.init() finished");

      cheatTable = createCheatTable();
      world = {
        backlog: [{ id: "chip8-play-1", title: "Play CHIP-8 Game", ready: true, ambiguous: false }],
        history: [],
        cartography: { scopeLevel: 0, timeOffset: 0 },
      };

      console.log("[SwarmWorker] About to call initFrame() and loadRom()");
      frame = initFrame();
      loadRom(activeRom, frame);
      currentRomRef = activeRom;

      const bootPriors = priorsForRom(PRIORS_REGISTRY, activeRom);
      swarm.setGamePriors(bootPriors?.snapshot ?? null);
      console.log(
        bootPriors
          ? `[SwarmWorker] 🧠 Priors loaded for cart "${bootPriors.cart}" (${String(bootPriors.trainedTicks)} trained ticks) — not starting from zero.`
          : "[SwarmWorker] No committed priors for this cart — starting from the fresh prior.",
      );

      isRunning = true;
      console.log("[SwarmWorker] About to start loop()");
      void loop(); // Kick off the loop
      break;
    }
    case "INJECT_EPIGENETIC_MATERIAL": {
      const uploadedRom = new Uint8Array(message.payload.buffer);
      const fingerprint = romFingerprint(uploadedRom);
      console.log(
        `[SwarmWorker] 🧬 Received Epigenetic Material. Spectral Fingerprint: ${fingerprint}`,
      );
      console.log("[SwarmWorker] Integrating Epigenetic Material into the Soft Value Regime...");

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
      break;
    }
    case "KEY_DOWN": {
      setManualKey(message.payload.key, true);
      break;
    }
    case "KEY_UP": {
      setManualKey(message.payload.key, false);
      break;
    }
    case "PAUSE": {
      paused = true;
      break;
    }
    case "RESUME": {
      // Only a paused loop restarts — a spurious RESUME must not fork a
      // second setTimeout chain next to the one already running.
      if (paused) {
        paused = false;
        void loop();
      }
      break;
    }
  }
}

/**
 * The CHIP-8 keypad has exactly 16 keys; anything else is not a key. The
 * written index is the LOOP variable, never the message value — the message
 * only selects which of the sixteen fixed slots matches, so no
 * message-derived value ever becomes a property name.
 */
function setManualKey(requested: number, down: boolean): void {
  for (let k = 0; k < 16; k++) {
    if (k === requested) manualKeys[k] = down;
  }
}

const KNOWN_MESSAGE_TYPES: ReadonlySet<string> = new Set([
  "INIT",
  "INJECT_EPIGENETIC_MATERIAL",
  "KEY_DOWN",
  "KEY_UP",
  "PAUSE",
  "RESUME",
]);

/**
 * Structural gate on everything entering the worker. A dedicated worker has
 * no `origin` to verify (only the creating page holds its handle), so the
 * available hardening is shape validation: unknown or malformed messages
 * are dropped before any handler runs.
 */
function isMainToWorkerMessage(data: unknown): data is MainToWorkerMessage {
  if (typeof data !== "object" || data === null) return false;
  const candidate = data as { type?: unknown; payload?: unknown };
  return (
    typeof candidate.type === "string" &&
    KNOWN_MESSAGE_TYPES.has(candidate.type) &&
    typeof candidate.payload === "object" &&
    candidate.payload !== null
  );
}

self.onmessage = (e: MessageEvent<unknown>) => {
  // Origin check, stated exactly: a DEDICATED worker's messages come only
  // from the page that constructed it, and their MessageEvent.origin is
  // always the empty string. A non-empty origin therefore cannot occur on
  // this channel, and rejecting it asserts that invariant rather than
  // decorating it.
  if (e.origin !== "") {
    console.warn("[SwarmWorker] Dropped message with unexpected origin");
    return;
  }
  if (!isMainToWorkerMessage(e.data)) {
    console.warn("[SwarmWorker] Dropped malformed message");
    return;
  }
  handleMessage(e.data).catch((err: unknown) => {
    console.error("[SwarmWorker] Fatal error in onmessage:", err);
  });
};

// Game semantic variables stripped for ARC-AGI-3

/** Reboot the emulator when a new cart was injected between ticks. */
function rebootIfCartSwitched(): void {
  if (activeRom === currentRomRef) return;
  console.log(`[CHIP8 Node ${agentId}] ⚡ SPECTRAL SHIFT DETECTED. Rebooting structural bounds...`);
  frame = initFrame();
  loadRom(activeRom, frame);
  currentRomRef = activeRom;
  cycle = 0;
  world = {
    ...world,
    backlog: [
      { id: "chip8-play-1", title: "Play Custom CHIP-8 Game", ready: true, ambiguous: false },
    ],
  };
}

/**
 * Run the physical simulation for one tick, compositing lit pixels across
 * the whole tick (persistence of vision). A raw end-of-tick snapshot
 * phase-locks onto the XOR-erase window of game loops whose length divides
 * STEPS_PER_TICK, and sprites "vanish" for many consecutive frames — the
 * perception layer (and the viewer) should see what a CRT would show.
 */
function simulateTick(): number[] {
  const displayArray: number[] = new Array(64 * 32).fill(0) as number[];
  for (let i = 0; i < STEPS_PER_TICK; i++) {
    step(frame);
    if (frame.fault) {
      console.error("[SwarmWorker] CHIP8 FAULT:", frame.fault);
      break;
    }
    compositeInto(displayArray, frame);
  }
  if (cycle % 30 === 0) {
    console.log(
      `[SwarmWorker] cycle=${String(cycle)}, PC=${String(frame.pc)}, I=${String(frame.i)}, display_pixels=${String(frame.display.size)}`,
    );
  }
  return displayArray;
}

/** Press the keys the society's last do_item action named (worm-fusion). */
function applySwarmKeyActions(): void {
  if (!world.history || world.history.length === 0) return;
  const lastEvent = world.history[world.history.length - 1];
  if (lastEvent?.type !== "do_item" || !lastEvent.actions) return;
  for (const action of lastEvent.actions) {
    const rawKey = action.args?.key;
    if (action.tool === "pressKey" && typeof rawKey === "number" && rawKey >= 0 && rawKey <= 15) {
      frame.keys[rawKey] = true;
    }
  }
}

async function loop(): Promise<void> {
  console.log(`[SwarmWorker] loop() cycle=${String(cycle)}`);
  // A pending setTimeout may still fire once after PAUSE lands; it exits
  // here without simulating or rescheduling, and RESUME restarts the chain.
  if (!isRunning || !swarm || paused) return;

  rebootIfCartSwitched();

  clearCausalMask(frame);
  applyCheatTable(frame, cheatTable);

  const displayArray = simulateTick();

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
      backlog: [
        ...world.backlog,
        { id: "chip8-play-1", title: "Play CHIP-8 Game", ready: true, ambiguous: false },
      ],
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
  applySwarmKeyActions();

  // Level up events removed for ARC-AGI-3

  // D1 (#14503): the attention field crosses on the SAME message as the
  // frame it labels, its tile arrays as transferables (moved, not copied).
  const att = world.cheatEngine?.attention;
  const attention = att
    ? {
        cols: att.cols,
        rows: att.rows,
        variance: Float32Array.from(att.variance),
        mean: Float32Array.from(att.mean),
        attended: att.attended,
        fixation: att.fixation,
        usefulWork: att.usefulWork,
        rho: att.rho,
        topK: att.topK,
      }
    : null;

  // Pass data directly to the frontend player component over postMessage
  const eventAction: FramePayload = {
    kind: "chip8-frame",
    display: displayArray,
    cycle,
    keys: Array.from(frame.keys),
    keyPredictions: world.cheatEngine?.keyPredictions ?? {},
    // The snap (CMYK half) and the forced-perception readout for the overlay.
    chosenKey: world.cheatEngine?.chosenKey ?? -1,
    arena: world.cheatEngine?.arena ?? null,
    attention,
    // D5: the deciding state rides the same message as the frame it explains.
    why: world.cheatEngine?.why ?? null,
  };

  const transfer: ArrayBuffer[] = attention
    ? [attention.variance.buffer, attention.mean.buffer]
    : [];
  postToMain({ type: "FRAME", payload: eventAction }, transfer);

  cycle++;

  // Throttle to ~30 fps
  setTimeout(() => {
    void loop();
  }, 32);
}
