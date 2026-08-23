/**
 * curriculum.test.ts — each cart teaches one layer; each test grades that
 * layer against the RUNNING emulator, not synthetic arrays. A regression in a
 * layer fails the cart that teaches it, by name.
 */
import { describe, expect, test } from "bun:test";
import { colorAt, compositeInto, create, loadRom, step, type Frame } from "../chip8";
import { createPerceptionState, perceive, type PerceptionState } from "../perception";
import { readScreen } from "../ocr";
import { BnnSocietyPredictor, EXPLORE_TICKS, type AgentMode } from "../../bayesian/bnn-key-predictor";
import {
  buildGlyphBoardRom,
  buildModeFlipRom,
  buildMoverAndWallRom,
  buildSingleMoverRom,
} from "./curriculum";
import { buildMutualSimRom } from "./mutual-sim";

const STEPS_PER_TICK = 10; // mirrors the worker loop

function snapshotDisplay(frame: Frame): number[] {
  const d = new Array(64 * 32).fill(0);
  for (let i = 0; i < d.length; i++) d[i] = colorAt(i % 64, Math.floor(i / 64), frame);
  return d;
}

function boot(rom: Uint8Array): Frame {
  const frame = create();
  loadRom(rom, frame);
  return frame;
}

function tick(frame: Frame): number[] {
  // Persistence-of-vision composite: see compositeInto — a raw end-of-tick
  // snapshot phase-locks onto XOR-erase windows when the game loop length is
  // close to STEPS_PER_TICK.
  const composite = new Array(64 * 32).fill(0);
  for (let i = 0; i < STEPS_PER_TICK; i++) {
    step(frame);
    if (frame.fault) throw new Error(`cart fault: ${frame.fault}`);
    compositeInto(composite, frame);
  }
  return composite;
}

describe("cart 1 — single-mover teaches object detection + velocity", () => {
  test("one tracked object, genuinely moving", () => {
    const frame = boot(buildSingleMoverRom());
    let s: PerceptionState = createPerceptionState();
    let earlyX: number | null = null;
    let lateX: number | null = null;
    for (let t = 0; t < 60; t++) {
      s = perceive(s, tick(frame));
      const seen = s.tracks.filter((tr) => tr.coastTicks === 0);
      if (t === 20 && seen[0]) earlyX = seen[0].cx;
      if (t === 50 && seen[0]) lateX = seen[0].cx;
    }
    // Exactly one identity in play (coasting keeps it stable through flicker).
    expect(s.tracks.length).toBe(1);
    const mover = s.tracks[0]!;
    expect(mover.everMoved).toBe(true);
    expect(mover.isStatic).toBe(false);
    expect(earlyX).not.toBeNull();
    expect(lateX).not.toBeNull();
    expect(Math.abs(lateX! - earlyX!)).toBeGreaterThan(3); // it went somewhere
  });
});

describe("cart 2 — mover-and-wall teaches static/moving separation", () => {
  test("the wall latches static-since-birth; the mover is everMoved", () => {
    const frame = boot(buildMoverAndWallRom());
    let s = createPerceptionState();
    for (let t = 0; t < 80; t++) s = perceive(s, tick(frame));
    const wall = s.tracks.find((tr) => tr.area >= 12);
    const mover = s.tracks.find((tr) => tr.area <= 6);
    expect(wall).toBeDefined();
    expect(mover).toBeDefined();
    // Both are color 1 — the exact confusion that broke the centroid heuristic.
    expect(wall!.color).toBe(1);
    expect(mover!.color).toBe(1);
    expect(wall!.isStatic).toBe(true);
    expect(wall!.everMoved).toBe(false);
    expect(mover!.everMoved).toBe(true);
  });
});

describe("cart 3 — glyph-board teaches the OCR grid", () => {
  test("reads the board as a structured grid, including the number 42", () => {
    const frame = boot(buildGlyphBoardRom());
    // Run to the halt loop, then read the final screen.
    for (let i = 0; i < 400; i++) step(frame);
    const { grid, numbers } = readScreen(snapshotDisplay(frame));
    expect(grid.rowCount).toBe(3);
    const rowChars = (r: number) =>
      grid.cells
        .filter((c) => c.row === r)
        .sort((a, b) => a.col - b.col)
        .map((c) => c.char)
        .join("");
    expect(rowChars(0)).toBe("012");
    expect(rowChars(1)).toBe("345");
    expect(rowChars(2)).toBe("42");
    expect(numbers.some((n) => n.value === 42 && n.digits === 2)).toBe(true);
  });
});

describe("cart 4 — mode-flip teaches the hunt/flee latch", () => {
  test("mode follows the adversary's shape, with hysteresis (no chatter)", () => {
    const frame = boot(buildModeFlipRom());
    const p = new BnnSocietyPredictor(3, 4);
    p.importSnapshot({ ...p.exportSnapshot(), exploreTicksDone: EXPLORE_TICKS });

    const modes: AgentMode[] = [];
    for (let t = 0; t < 500; t++) {
      p.predict(tick(frame));
      modes.push(p.lastMode);
    }
    const seen = new Set(modes.slice(50)); // after warmup
    expect(seen.has("flee")).toBe(true); // the hunter shape periods
    expect(seen.has("hunt")).toBe(true); // the prey shape periods
    // Hysteresis: transitions stay in the order of shape flips (~5 over the
    // run), nowhere near per-tick chatter.
    let transitions = 0;
    for (let i = 1; i < modes.length; i++) if (modes[i] !== modes[i - 1]) transitions += 1;
    expect(transitions).toBeLessThanOrEqual(10);
  });
});

describe("the default cart — mutual-sim carries its win conditions in-ROM", () => {
  test("assembles, boots, draws both scoreboards, and OCR reads them", () => {
    const frame = boot(buildMutualSimRom());
    let d: number[] = [];
    for (let t = 0; t < 40; t++) d = tick(frame);
    const { numbers } = readScreen(d);
    // Two zeros on screen: player score (color 2, left) and AI score (color 1, right).
    const zeros = numbers.filter((n) => n.value === 0);
    expect(zeros.length).toBe(2);
    const colors = zeros.map((z) => z.color).sort();
    expect(colors).toEqual([1, 2]);
  });

  test("the win path floods the board when the player reaches 5 tags", () => {
    // Drive the cart to a win synthetically: set the score to 4, force the
    // flee phase, and teleport the AI onto the player so the next frame tags.
    const frame = boot(buildMutualSimRom());
    for (let t = 0; t < 20; t++) tick(frame);
    frame.v[9] = 4; // player score one short of the win
    frame.v[8] = 1; // AI fleeing → a tag scores for the PLAYER
    frame.v[3] = frame.v[0]!; // AI position = player position
    frame.v[4] = frame.v[1]!;
    let flooded = false;
    for (let t = 0; t < 200 && !flooded; t++) {
      const d = tick(frame);
      let litPlane2 = 0;
      for (const c of d) if (c & 2) litPlane2 += 1;
      flooded = litPlane2 > 64 * 32 * 0.9; // the orange win flood
    }
    expect(flooded).toBe(true);
    expect(frame.v[9]).toBe(5);
  });
});
