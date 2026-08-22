/**
 * The dialect family under test — ONE machine, parameterised along named structural axes.
 *
 * WHY parameterised rather than four hand-written interpreters: "same complexity, different
 * structure" has to be true BY CONSTRUCTION, not asserted in a comment. Every dialect below is
 * the same `step` with a different setting of one axis, so the opcode alphabet, the memory model,
 * the display size, the per-instruction work and the decode path are literally shared code. The
 * only thing that varies is the named structure each control destroys.
 *
 * Faithfulness is checked, not claimed: `transfer.test.ts` asserts that this machine at the
 * identity parameters (`chip9`) reproduces `../chip9/golden-vectors.lines` byte-for-byte — the
 * same treaty the F#, C# and Rust oracles are locked to. If this file drifts from the shipped
 * oracle, that check goes red.
 *
 * Register: `unmetered` for the dialect family itself (it is a research instrument, nothing
 * depends on it); the transfer MEASUREMENT it feeds is `metered` — see `lessons.ts`.
 */

export const W = 64;
export const H = 32;
export const PROGRAM_START = 0x200;

/** The pixel combinator: how a set sprite bit combines with the pixel already there. */
export type Combinator = "xor" | "or";

/**
 * The named structural axes. Each control below moves EXACTLY ONE of these off its CHIP-8 value,
 * which is what makes the control calibrated: the prediction is not "the control fails", it is
 * "these specific lessons fail and these specific lessons survive".
 */
export interface Dialect {
  readonly name: string;
  /** `Fn01` recognised (CHIP-9) or ignored (CHIP-8). */
  readonly planes: boolean;
  /** Pixel combinator. CHIP-8/9 = `xor` (the group); `or` = the join-semilattice. */
  readonly combinator: Combinator;
  /** COSMAC VIP: pixels past the right/bottom edge are dropped. `false` ⇒ they wrap around. */
  readonly clipPixels: boolean;
  /** COSMAC VIP: the sprite ORIGIN wraps mod W/H. `false` ⇒ an off-screen origin draws nothing. */
  readonly wrapOrigin: boolean;
  /** VF is reset per `DXYN`. `false` ⇒ VF latches once set (the witness stops being per-draw). */
  readonly vfPerDraw: boolean;
  /**
   * A bijection on the opcode high nibble, applied at DECODE time. Identity for every dialect
   * except `relabel`. NOTE this axis is deliberately an ISOMORPHISM, not a structure destruction
   * — it is the trap control (see `TARGETS`).
   */
  readonly nibble: (hi: number) => number;
}

const id = (hi: number): number => hi;

/**
 * The relabelling bijection: a 3-cycle on the high nibbles the lesson battery uses.
 * 6 -> A -> D -> 6. Decoding applies its INVERSE, so a ROM written in the relabelled alphabet
 * behaves exactly as the original ROM does on CHIP-8.
 */
const RELABEL_FWD = new Map<number, number>([
  [0x6, 0xa],
  [0xa, 0xd],
  [0xd, 0x6],
]);
const RELABEL_INV = new Map<number, number>([...RELABEL_FWD].map(([k, v]) => [v, k]));

export const relabelForward = (hi: number): number => RELABEL_FWD.get(hi) ?? hi;
const relabelInverse = (hi: number): number => RELABEL_INV.get(hi) ?? hi;

const CHIP8: Dialect = {
  name: "chip8",
  planes: false,
  combinator: "xor",
  clipPixels: true,
  wrapOrigin: true,
  vfPerDraw: true,
  nibble: id,
};

/** THE MORPHISM TARGET. CHIP-8 plus `Fn01`; everything else identical. */
export const CHIP9: Dialect = { ...CHIP8, name: "chip9", planes: true };

/**
 * THE CONTROLS. Each names the structure it destroys and, with it, the reason no
 * structure-preserving map from CHIP-8 can exist.
 */
export const CONTROLS: readonly Dialect[] = [
  /**
   * `or-draw` — the display update algebra stops being a group.
   *
   * Under XOR the display transitions generate (Z/2)^n: every draw is its own inverse. Under OR
   * they generate the join-semilattice 2^n: idempotent, and no element except the identity has an
   * inverse. An injective map h with `step_or(h s) = h(step_8 s)` would have to send an
   * involutive generator to a non-involutive one while preserving composition, which no map can
   * do. So this is not "scrambled until it looks different" — it is provably not a conservative
   * extension, and the proof is one sentence long.
   */
  { ...CHIP8, name: "or-draw", combinator: "or" },
  /** `no-clip` — the VIP edge geometry is destroyed; pixels wrap instead of being dropped. */
  { ...CHIP8, name: "no-clip", clipPixels: false },
  /** `no-origin-wrap` — an off-screen sprite origin draws nothing instead of wrapping. */
  { ...CHIP8, name: "no-origin-wrap", wrapOrigin: false },
  /** `vf-sticky` — VF latches, so it stops being a per-draw collision witness. */
  { ...CHIP8, name: "vf-sticky", vfPerDraw: false },
];

/**
 * THE TRAP CONTROL. Permuting the opcode table is the intuitive meaning of "scrambled", and it is
 * the wrong control: a permutation of labels is an AUTOMORPHISM of the machine family. Transfer
 * across it succeeds whenever the artifact is carried through the same permutation, and fails
 * only when it is not — so a naive scramble measures whether you remembered to translate, not
 * whether structure was preserved. Included precisely so the experiment can demonstrate that.
 */
export const RELABEL: Dialect = { ...CHIP8, name: "relabel", nibble: relabelInverse };

export const BASELINE: Dialect = CHIP8;

export interface Frame {
  mem: Map<number, number>;
  v: Uint8Array;
  i: number;
  pc: number;
  plane: number;
  display: Map<number, boolean>;
  extra: Map<number, number>;
  stack: number[];
  fault: string | null;
}

export function create(): Frame {
  return {
    mem: new Map(),
    v: new Uint8Array(16),
    i: 0,
    pc: PROGRAM_START,
    plane: 1,
    display: new Map(),
    extra: new Map(),
    stack: [],
    fault: null,
  };
}

export function loadRom(rom: Uint8Array, f: Frame): Frame {
  rom.forEach((b, idx) => f.mem.set(PROGRAM_START + idx, b));
  return f;
}

/** Plane-0 (mono) bit plus the higher-plane mask — the machine-neutral reading of a pixel. */
export function colorAt(x: number, y: number, f: Frame): number {
  const idx = (y % H) * W + (x % W);
  const mono = f.display.get(idx) ? 1 : 0;
  return mono | (f.extra.get(idx) ?? 0);
}

function combineMono(cur: boolean, d: Dialect): boolean {
  return d.combinator === "xor" ? !cur : true;
}

function combineHi(cur: number, sel: number, d: Dialect): number {
  return d.combinator === "xor" ? cur ^ sel : cur | sel;
}

export function step(f: Frame, d: Dialect): Frame {
  const raw = ((f.mem.get(f.pc) ?? 0) << 8) | (f.mem.get(f.pc + 1) ?? 0);
  const hi = d.nibble((raw & 0xf000) >> 12);
  const op = (hi << 12) | (raw & 0x0fff);
  const x = (op & 0x0f00) >> 8;
  const n = op & 0x000f;
  const nn = op & 0x00ff;
  const nnn = op & 0x0fff;
  f.pc += 2;

  switch (op & 0xf000) {
    case 0x0000:
      if (op === 0x00ee) {
        const top = f.stack.pop();
        if (top !== undefined) f.pc = top;
        else if (f.fault === null) f.fault = "stack underflow: 00EE (RET) on empty stack";
      } else if (op === 0x00e0) {
        if (f.plane & 1) f.display.clear();
        const keep = ~f.plane & 0b110;
        if (keep !== 0b110) {
          for (const [k, m] of [...f.extra]) {
            const m2 = m & keep;
            if (m2 === 0) f.extra.delete(k);
            else f.extra.set(k, m2);
          }
        }
      }
      break;
    case 0x2000:
      if (f.stack.length >= 16) {
        if (f.fault === null) f.fault = "stack overflow: CALL (2NNN) at depth 16 refused";
      } else {
        f.stack.push(f.pc);
        f.pc = nnn;
      }
      break;
    case 0x6000:
      f.v[x] = nn;
      break;
    case 0xa000:
      f.i = nnn;
      break;
    case 0xd000: {
      const rawX = f.v[x] ?? 0;
      const rawY = f.v[(op & 0x00f0) >> 4] ?? 0;
      // `wrapOrigin` axis: VIP wraps the origin; the control refuses to draw off-screen origins.
      if (!d.wrapOrigin && (rawX >= W || rawY >= H)) {
        if (d.vfPerDraw) f.v[0xf] = 0;
        break;
      }
      const ox = rawX % W;
      const oy = rawY % H;
      const hiSel = d.planes ? f.plane & 0b110 : 0;
      const monoSel = d.planes ? (f.plane & 1) !== 0 : true;
      let collision = 0;
      for (let row = 0; row < n; row++) {
        const sprite = f.mem.get(f.i + row) ?? 0;
        for (let col = 0; col < 8; col++) {
          if (((sprite >> (7 - col)) & 1) === 1) {
            const px = ox + col;
            const py = oy + row;
            // `clipPixels` axis: VIP drops the overhang; the control wraps it around.
            if (d.clipPixels && (px >= W || py >= H)) continue;
            const idx = (py % H) * W + (px % W);
            if (monoSel) {
              const cur = f.display.get(idx) ?? false;
              if (cur) collision = 1;
              f.display.set(idx, combineMono(cur, d));
            }
            if (hiSel !== 0) {
              const cur = f.extra.get(idx) ?? 0;
              if ((cur & hiSel) !== 0) collision = 1;
              const nxt = combineHi(cur, hiSel, d);
              if (nxt === 0) f.extra.delete(idx);
              else f.extra.set(idx, nxt);
            }
          }
        }
      }
      // `vfPerDraw` axis: VIP recomputes VF every draw; the control latches it.
      if (d.vfPerDraw) f.v[0xf] = collision;
      else if (collision === 1) f.v[0xf] = 1;
      break;
    }
    case 0xf000:
      if (nn === 0x01 && d.planes) f.plane = x & 0b111;
      break;
    default:
      break;
  }
  return f;
}
