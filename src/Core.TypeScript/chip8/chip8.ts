/**
 * CHIP-8 Emulator - Full Standard Instruction Set
 */

import { COMMON_SEED } from "../observe/phase-clock";
import { splitmix32Step } from "./seeded-rng";

export const W = 64;
export const H = 32;
const PROGRAM_START = 0x200;

export interface Frame {
  mem: Map<number, number>;
  v: Uint8Array;
  i: number;
  pc: number;
  display: Map<number, boolean>;
  stack: number[];
  dt: number;
  st: number;
  keys: boolean[];
  fault: string | null;
  causalMask: boolean[];
  plane: number;
  extra: Map<number, number>;
  /**
   * Seeded PRNG state for the RND opcode. Derived from COMMON_SEED so a run
   * replays deterministically (DST) and two viewers fold identical evidence
   * (noninterference §13). Never `Math.random()`.
   */
  rngState: number;
}

export function create(seed: number = COMMON_SEED): Frame {
  return {
    mem: new Map(),
    v: new Uint8Array(16),
    i: 0,
    pc: PROGRAM_START,
    display: new Map(),
    stack: [],
    dt: 0,
    st: 0,
    keys: new Array(16).fill(false),
    fault: null,
    causalMask: new Array(4096).fill(false),
    plane: 1,
    extra: new Map(),
    rngState: seed | 0,
  };
}

/**
 * The standard CHIP-8 hex fontset: 16 glyphs (0-F), 4×5 pixels each, one byte
 * per row with the glyph in the HIGH nibble. Loaded at 0x000-0x04F by
 * `loadRom`, addressed by `LD F, Vx`. Exported so the OCR layer matches
 * against exactly the bitmaps the emulator draws — one source of truth.
 */
export const FONTSET: readonly number[] = [
  0xF0, 0x90, 0x90, 0x90, 0xF0, // 0
  0x20, 0x60, 0x20, 0x20, 0x70, // 1
  0xF0, 0x10, 0xF0, 0x80, 0xF0, // 2
  0xF0, 0x10, 0xF0, 0x10, 0xF0, // 3
  0x90, 0x90, 0xF0, 0x10, 0x10, // 4
  0xF0, 0x80, 0xF0, 0x10, 0xF0, // 5
  0xF0, 0x80, 0xF0, 0x90, 0xF0, // 6
  0xF0, 0x10, 0x20, 0x40, 0x40, // 7
  0xF0, 0x90, 0xF0, 0x90, 0xF0, // 8
  0xF0, 0x90, 0xF0, 0x10, 0xF0, // 9
  0xF0, 0x90, 0xF0, 0x90, 0x90, // A
  0xE0, 0x90, 0xE0, 0x90, 0xE0, // B
  0xF0, 0x80, 0x80, 0x80, 0xF0, // C
  0xE0, 0x90, 0x90, 0x90, 0xE0, // D
  0xF0, 0x80, 0xF0, 0x80, 0xF0, // E
  0xF0, 0x80, 0xF0, 0x80, 0x80, // F
];

export function loadRom(rom: Uint8Array, f: Frame): Frame {
  rom.forEach((b, idx) => f.mem.set(PROGRAM_START + idx, b));
  // Load standard fontset at 0x000-0x04F (single source of truth: FONTSET above)
  FONTSET.forEach((b, idx) => f.mem.set(idx, b));
  return f;
}

export function decrementTimers(f: Frame) {
  if (f.dt > 0) f.dt--;
  if (f.st > 0) f.st--;
}

export function clearCausalMask(f: Frame) {
  f.causalMask.fill(false);
}

export function renderDisplay(f: Frame): string {
  let out = "";
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      out += f.display.get(y * W + x) ? "█" : " ";
    }
    out += "\n";
  }
  return out;
}

export function colorAt(x: number, y: number, f: Frame): number {
  const idx = (y % H) * W + (x % W);
  const mono = f.display.get(idx) ? 1 : 0;
  return mono | (f.extra.get(idx) ?? 0);
}

/**
 * OR the frame's currently-lit pixels into `target` (length W*H, color-mask
 * values). Calling this after EVERY emulator step across a tick builds a
 * persistence-of-vision composite: game loops XOR-erase and redraw sprites
 * each iteration, so a single end-of-tick snapshot can phase-lock onto the
 * erased window and a sprite "vanishes" for many consecutive ticks. The
 * composite is what a CRT (and an eye) would show — every pixel lit at any
 * point during the tick. Perception should consume THIS, not a raw snapshot.
 */
export function compositeInto(target: number[], f: Frame): void {
  for (const [idx, on] of f.display) {
    if (on && idx >= 0 && idx < W * H) target[idx] = (target[idx] ?? 0) | 1;
  }
  for (const [idx, mask] of f.extra) {
    if (idx >= 0 && idx < W * H) target[idx] = (target[idx] ?? 0) | mask;
  }
}

export function step(f: Frame): Frame {
  // Mark instruction as causally relevant (with bounds check)
  if (f.pc < 4096) f.causalMask[f.pc] = true;
  if (f.pc + 1 < 4096) f.causalMask[f.pc + 1] = true;

  const op = ((f.mem.get(f.pc) ?? 0) << 8) | (f.mem.get(f.pc + 1) ?? 0);
  const x = (op & 0x0f00) >> 8;
  const y = (op & 0x00f0) >> 4;
  const n = op & 0x000f;
  const nn = op & 0x00ff;
  const nnn = op & 0x0fff;
  f.pc += 2;

  switch (op & 0xf000) {
    case 0x0000:
      if (op === 0x00e0) {
        if (f.plane & 1) f.display.clear(); // CLS
        const keep = ~f.plane & 0b110;
        if (keep !== 0b110) {
          for (const [k, m] of [...f.extra]) {
            const m2 = m & keep;
            if (m2 === 0) f.extra.delete(k);
            else f.extra.set(k, m2);
          }
        }
      }
      else if (op === 0x00ee) { // RET
        const top = f.stack.pop();
        if (top !== undefined) f.pc = top;
        else if (f.fault === null) f.fault = "stack underflow: 00EE (RET)";
      }
      break;
    case 0x1000: // JMP NNN
      f.pc = nnn;
      break;
    case 0x2000: // CALL NNN
      if (f.stack.length >= 16) {
        if (f.fault === null) f.fault = "stack overflow: CALL (2NNN)";
      } else {
        f.stack.push(f.pc);
        f.pc = nnn;
      }
      break;
    case 0x3000: // SE Vx, byte
      if (f.v[x] === nn) f.pc += 2;
      break;
    case 0x4000: // SNE Vx, byte
      if (f.v[x] !== nn) f.pc += 2;
      break;
    case 0x5000: // SE Vx, Vy
      if (f.v[x] === f.v[y]) f.pc += 2;
      break;
    case 0x6000: // LD Vx, byte
      f.v[x] = nn;
      break;
    case 0x7000: // ADD Vx, byte
      f.v[x] = (f.v[x]! + nn) & 0xff;
      break;
    case 0x8000:
      switch (n) {
        case 0x0: f.v[x] = f.v[y]!; break;
        case 0x1: f.v[x] = f.v[x]! | f.v[y]!; break;
        case 0x2: f.v[x] = f.v[x]! & f.v[y]!; break;
        case 0x3: f.v[x] = f.v[x]! ^ f.v[y]!; break;
        case 0x4: {
          const sum = f.v[x]! + f.v[y]!;
          f.v[0xf] = sum > 255 ? 1 : 0;
          f.v[x] = sum & 0xff;
          break;
        }
        case 0x5: {
          const vx = f.v[x]!;
          const vy = f.v[y]!;
          f.v[0xf] = vx >= vy ? 1 : 0;
          f.v[x] = (vx - vy) & 0xff;
          break;
        }
        case 0x6: {
          const vx = f.v[x]!;
          f.v[0xf] = vx & 1;
          f.v[x] = vx >> 1;
          break;
        }
        case 0x7: {
          const vx = f.v[x]!;
          const vy = f.v[y]!;
          f.v[0xf] = vy >= vx ? 1 : 0;
          f.v[x] = (vy - vx) & 0xff;
          break;
        }
        case 0xe: {
          const vx = f.v[x]!;
          f.v[0xf] = (vx & 0x80) >> 7;
          f.v[x] = (vx << 1) & 0xff;
          break;
        }
      }
      break;
    case 0x9000: // SNE Vx, Vy
      if (f.v[x] !== f.v[y]) f.pc += 2;
      break;
    case 0xa000: // LD I, addr
      f.i = nnn;
      break;
    case 0xc000: { // RND Vx, byte — frame-local seeded stream, never Math.random
      const r = splitmix32Step(f.rngState);
      f.rngState = r.next;
      f.v[x] = (r.u32 & 0xff) & nn;
      break;
    }
    case 0xd000: { // DRW Vx, Vy, nibble
      const ox = (f.v[x] ?? 0) % W;
      const oy = (f.v[y] ?? 0) % H;
      const hiSel = f.plane & 0b110;
      let collision = 0;
      for (let row = 0; row < n; row++) {
        f.causalMask[f.i + row] = true; // Mark sprite data as causal
        const sprite = f.mem.get(f.i + row) ?? 0;
        for (let col = 0; col < 8; col++) {
          if (((sprite >> (7 - col)) & 1) === 1) {
            // Toroidal wrap: pixel space agrees with register space at the
            // edges. Clipping instead makes a sprite at x=63/y=31 draw ZERO
            // pixels while its coordinate registers remain valid — an
            // invisible object perception can never see but the game logic
            // still simulates.
            const px = (ox + col) % W;
            const py = (oy + row) % H;
            {
              const idx = py * W + px;

              // Global cross-plane collision: if ANY pixel was set here before we draw.
              const curMono = f.display.get(idx) ?? false;
              const curExtra = f.extra.get(idx) ?? 0;
              if (curMono || curExtra > 0) collision = 1;

              if (f.plane & 1) {
                f.display.set(idx, !curMono);
              }
              if (hiSel !== 0) {
                const nxt = curExtra ^ hiSel;
                if (nxt === 0) f.extra.delete(idx);
                else f.extra.set(idx, nxt);
              }
            }
          }
        }
      }
      f.v[0xf] = collision;
      break;
    }
    case 0xe000:
      if (nn === 0x9e) { if (f.keys[f.v[x]!]) f.pc += 2; }
      else if (nn === 0xa1) { if (!f.keys[f.v[x]!]) f.pc += 2; }
      break;
    case 0xf000:
      switch (nn) {
        case 0x01: f.plane = x & 0b111; break; // Fn01: CHIP-9 plane select
        case 0x07: f.v[x] = f.dt; break;
        case 0x0a: { // Wait for key
          let pressed = -1;
          for (let k = 0; k < 16; k++) {
            if (f.keys[k]) { pressed = k; break; }
          }
          if (pressed === -1) f.pc -= 2; // block
          else f.v[x] = pressed;
          break;
        }
        case 0x15: f.dt = f.v[x]!; break;
        case 0x18: f.st = f.v[x]!; break;
        case 0x1e: f.i += f.v[x]!; break;
        case 0x29: f.i = f.v[x]! * 5; break; // Font sprite
        case 0x33: {
          const val = f.v[x]!;
          f.causalMask[f.i] = true;
          f.causalMask[f.i + 1] = true;
          f.causalMask[f.i + 2] = true;
          f.mem.set(f.i, Math.floor(val / 100));
          f.mem.set(f.i + 1, Math.floor((val / 10) % 10));
          f.mem.set(f.i + 2, (val % 10));
          break;
        }
        case 0x55:
          for (let k = 0; k <= x; k++) {
            f.causalMask[f.i + k] = true;
            f.mem.set(f.i + k, f.v[k]!);
          }
          break;
        case 0x65:
          for (let k = 0; k <= x; k++) {
            f.causalMask[f.i + k] = true;
            f.v[k] = f.mem.get(f.i + k) ?? 0;
          }
          break;
      }
      break;
  }
  return f;
}
