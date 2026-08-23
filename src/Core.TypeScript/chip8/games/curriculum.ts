/**
 * curriculum.ts — teaching carts: one perception layer per cart.
 *
 * The continual-learning demo needs each layer to be teachable AND gradable
 * in isolation, so every cart here exercises exactly one rung of the ladder,
 * and curriculum.test.ts grades that rung against the running emulator — not
 * against synthetic arrays. If a rung regresses, the failing cart names it.
 *
 *   Cart 1  single-mover      → layer 1-2: one object, detected and tracked
 *                               with a velocity; walls of the screen ignored.
 *   Cart 2  mover-and-wall    → layer 2-3: static/moving separation — the
 *                               exact wall-vs-adversary confusion that broke
 *                               the old centroid heuristic, as a regression
 *                               cart.
 *   Cart 3  glyph-board       → layer 4: OCR — draws "0 1 2 / 3 4 5" plus a
 *                               two-digit number, read back as a grid.
 *   Cart 4  mode-flip         → layer 6: the adversary alternates between the
 *                               big hollow (hunter) and small solid (prey)
 *                               shapes on a timer; the mode latch must follow
 *                               with hysteresis, not chatter.
 *
 * All carts are deterministic (no RND, or seeded RND via the emulator).
 */

import { assemble } from "../assembler";

/** Cart 1 — one 2×2 block (plane 2) bouncing horizontally between x=8 and x=48. */
export function buildSingleMoverRom(): Uint8Array {
  return assemble([
    "init:",
    "LD V0, 8", // x
    "LD V1, 12", // y
    "LD V2, 1", // dx (1 = right, 0 = left)
    "CLS",
    "BYTE 0xF201",
    "LD I, blk",
    "DRW V0, V1, 2",
    "loop:",
    "BYTE 0xF201",
    "LD I, blk",
    "DRW V0, V1, 2", // erase
    "SNE V2, 1",
    "JMP go_right",
    "LD VE, 1",
    "SUB V0, VE",
    "SE V0, 8",
    "JMP moved",
    "LD V2, 1",
    "JMP moved",
    "go_right:",
    "ADD V0, 1",
    "SE V0, 48",
    "JMP moved",
    "LD V2, 0",
    "moved:",
    "DRW V0, V1, 2", // draw at new pos
    "JMP loop",
    "blk:",
    "BYTE 0xC0C0",
  ]);
}

/** Cart 2 — a static wall (plane 1) and a mover (plane 1, same color!) circling it. */
export function buildMoverAndWallRom(): Uint8Array {
  return assemble([
    "init:",
    "LD V0, 10", // mover x
    "LD V1, 8", // mover y
    "CLS",
    "BYTE 0xF101",
    // The wall: 4x4 at center — same color as the mover, the confusion case.
    "LD I, wall",
    "LD VA, 30",
    "LD VB, 14",
    "DRW VA, VB, 4",
    "LD I, blk",
    "DRW V0, V1, 2",
    "loop:",
    "BYTE 0xF101",
    "LD I, blk",
    "DRW V0, V1, 2", // erase mover
    "ADD V0, 1", // march right, wrap via mask
    "SE V0, 56",
    "JMP moved",
    "LD V0, 4",
    "moved:",
    "DRW V0, V1, 2",
    "JMP loop",
    "wall:",
    "BYTE 0xF0F0",
    "BYTE 0xF0F0",
    "blk:",
    "BYTE 0xC0C0",
  ]);
}

/**
 * Cart 3 — the glyph board: row one "0 1 2", row two "3 4 5", and the
 * two-digit number "42" drawn digit-adjacent on row three. Then halt.
 */
export function buildGlyphBoardRom(): Uint8Array {
  return assemble([
    "init:",
    "CLS",
    "BYTE 0xF101",
    // Row 1: 0 1 2 at y=2, x=2,7,12 (5px column pitch)
    "LD V2, 0",
    "LD F, V2",
    "LD VA, 2",
    "LD VB, 2",
    "DRW VA, VB, 5",
    "LD V2, 1",
    "LD F, V2",
    "LD VA, 7",
    "DRW VA, VB, 5",
    "LD V2, 2",
    "LD F, V2",
    "LD VA, 12",
    "DRW VA, VB, 5",
    // Row 2: 3 4 5 at y=9
    "LD V2, 3",
    "LD F, V2",
    "LD VA, 2",
    "LD VB, 9",
    "DRW VA, VB, 5",
    "LD V2, 4",
    "LD F, V2",
    "LD VA, 7",
    "DRW VA, VB, 5",
    "LD V2, 5",
    "LD F, V2",
    "LD VA, 12",
    "DRW VA, VB, 5",
    // Row 3: the number 42 (digits adjacent: x=2 and x=7) at y=16
    "LD V2, 4",
    "LD F, V2",
    "LD VA, 2",
    "LD VB, 16",
    "DRW VA, VB, 5",
    "LD V2, 2",
    "LD F, V2",
    "LD VA, 7",
    "DRW VA, VB, 5",
    "halt:",
    "JMP halt",
  ]);
}

/**
 * Cart 4 — mode flip: an adversary patrolling x∈[34,44] that alternates
 * between the hollow 4×4 hunter shape and the solid 2×2 prey shape every 64
 * loop iterations, next to a still player block (plane 2). Grades the mode
 * latch: it must flip hunt→flee→hunt following the shape, with hysteresis
 * (no chatter at the boundary frames).
 */
export function buildModeFlipRom(): Uint8Array {
  return assemble([
    "init:",
    "LD V2, 1", // patrol direction (1 = right)
    "LD V3, 38", // adversary x
    "LD V4, 13", // adversary y
    "LD V6, 64", // shape-flip timer
    "LD V8, 0", // 0 = hunter shape shown, 1 = prey shape shown
    "CLS",
    "BYTE 0xF201",
    "LD I, blk",
    "LD V0, 10",
    "LD V1, 14",
    "DRW V0, V1, 2", // the "player" (still in this cart; standing is legal)
    "BYTE 0xF101",
    "LD I, hunter",
    "DRW V3, V4, 4",
    "loop:",
    // Erase adversary (current shape).
    "BYTE 0xF101",
    "SNE V8, 1",
    "JMP erase_prey",
    "LD I, hunter",
    "JMP erase_do",
    "erase_prey:",
    "LD I, prey",
    "erase_do:",
    "DRW V3, V4, 4",
    // Patrol one pixel.
    "SNE V2, 1",
    "JMP go_right",
    "LD VE, 1",
    "SUB V3, VE",
    "SE V3, 34",
    "JMP flip_timer",
    "LD V2, 1",
    "JMP flip_timer",
    "go_right:",
    "ADD V3, 1",
    "SE V3, 44",
    "JMP flip_timer",
    "LD V2, 0",
    "flip_timer:",
    "LD VE, 1",
    "SUB V6, VE",
    "SE V6, 0",
    "JMP draw_adv",
    "LD V6, 64",
    "XOR V8, VE", // toggle the shape
    "draw_adv:",
    "SNE V8, 1",
    "JMP draw_prey",
    "LD I, hunter",
    "JMP draw_do",
    "draw_prey:",
    "LD I, prey",
    "draw_do:",
    "DRW V3, V4, 4",
    "JMP loop",
    "hunter:",
    "BYTE 0xF090",
    "BYTE 0x90F0",
    "prey:",
    "BYTE 0x0060",
    "BYTE 0x6000",
    "blk:",
    "BYTE 0xC0C0",
  ]);
}
