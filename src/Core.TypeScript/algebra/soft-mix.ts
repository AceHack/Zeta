/**
 * src/Core.TypeScript/algebra/soft-mix.ts — ring-generic IR interpreter over weighted ensembles.
 *
 * The SAME function handles both soft lanes:
 *   - realRing → Soft-Bayesian (probability mixture, no interference)
 *   - complexRing → Soft-Quantum (amplitude ensemble, interference)
 *   - quaternionRing → future (non-commutative weights)
 *
 * This is WSet.apply + WSet.consolidate from the F# side, specialized to the
 * zeta-ir-v1 op vocabulary (mul, xorshr). The ring is DI'd — swap it, change the physics.
 *
 * Composes with:
 *   - src/Core.TypeScript/algebra/star-ring.ts (the ring interface + instances)
 *   - src/Core/WSet.fs (F# source: consolidate + apply)
 *   - tests/cross-verification/_harness/codegen-from-ir.ts (the classical lane)
 */

import { type StarRing, type WEntry, consolidate, realRing, complexRing, type Complex } from "./star-ring";

// ─── IR types (inline to avoid cross-directory import issues) ────────────────

interface IrOp {
  op: "mul" | "xorshr";
  k?: number | bigint;
  s?: number;
}

interface ZetaIrV1 {
  schema: string;
  generator: string;
  version: number;
  width: number;
  ops: IrOp[];
}

/** Parse IR JSON with BigInt-safe integer handling. */
function parseIrJson(text: string): ZetaIrV1 {
  const safe = text.replace(/"k"\s*:\s*(-?\d+)/g, '"k": "$1"');
  const parsed = JSON.parse(safe);
  if (parsed.ops) {
    for (const op of parsed.ops) {
      if (op.k !== undefined) op.k = BigInt(op.k);
    }
  }
  return parsed;
}

// ─── The ring-generic soft interpreter ───────────────────────────────────────

export interface SoftEnsemble<W> {
  readonly entries: WEntry<bigint, W>[];
}

/**
 * Apply one IR op to every entry in the ensemble, then consolidate (merge).
 * Ring-generic: the merge uses ring.add on same-key weights.
 *
 * The op can FORK a frame into multiple frames (the "grows in bits by uncertainty"
 * property). For deterministic ops (mul, xorshr), each frame maps to exactly one
 * output frame (support unchanged). For branching ops (future: conditional, measure),
 * one frame can produce N output frames weighted by √(1/N) — support grows by the
 * actual uncertainty introduced, NOT by the register width.
 */
function applyOp<W>(
  ir: ZetaIrV1,
  ring: StarRing<W>,
  isZero: (w: W) => boolean,
  ensemble: WEntry<bigint, W>[],
  op: { op: string; k?: bigint | number; s?: number },
): WEntry<bigint, W>[] {
  const MASK = (1n << BigInt(ir.width)) - 1n;

  // Each frame can produce multiple output frames (fork).
  // For mul/xorshr: deterministic (1 → 1, no growth).
  // ISA ops: branch=fork, join=conditional-flip, emit/retract=weight injection.
  const stepped = ensemble.flatMap((entry): WEntry<bigint, W>[] => {
    if (op.op === "mul") {
      const newKey = (entry.key * (BigInt(op.k!) & MASK)) & MASK;
      return [{ key: newKey, weight: entry.weight }];
    } else if (op.op === "xorshr") {
      const newKey = (entry.key ^ (entry.key >> BigInt(op.s!))) & MASK;
      return [{ key: newKey, weight: entry.weight }];
    } else if (op.op === "branch") {
      // Fork: two frames — bit flipped vs not (the H gate / Hadamard).
      // Support grows by 1 bit of uncertainty.
      const bit = BigInt(op.s ?? (op as any).bit ?? 0);
      return [
        { key: entry.key, weight: entry.weight },
        { key: (entry.key ^ (1n << bit)) & MASK, weight: entry.weight },
      ];
    } else if (op.op === "emit") {
      // Weight injection: add ring.one to current weight (amplitude +1).
      return [{ key: entry.key, weight: ring.add(entry.weight, ring.one) }];
    } else if (op.op === "retract") {
      // Retraction: subtract ring.one from weight (amplitude -1, cancels with emit).
      return [{ key: entry.key, weight: ring.add(entry.weight, ring.negate(ring.one)) }];
    } else if (op.op === "join") {
      // Entangle: flip target bit conditioned on control bit (CNOT).
      const control = BigInt((op as any).control ?? 0);
      const target = BigInt((op as any).target ?? 1);
      const controlSet = (entry.key >> control) & 1n;
      const newKey = controlSet ? (entry.key ^ (1n << target)) & MASK : entry.key;
      return [{ key: newKey, weight: entry.weight }];
    } else if (op.op === "merge") {
      // Merge is implicit — consolidate after each step handles it.
      return [{ key: entry.key, weight: entry.weight }];
    }
    return [{ key: entry.key, weight: entry.weight }];
  });

  return consolidate(ring, isZero, stepped, (a, b) => a === b);
}

/**
 * The ring-generic soft mix: fold ALL IR ops over the ensemble.
 * One function — works for any StarRing instance.
 */
export function softMixGeneric<W>(
  ir: ZetaIrV1,
  ring: StarRing<W>,
  isZero: (w: W) => boolean,
  input: WEntry<bigint, W>[],
): WEntry<bigint, W>[] {
  let ensemble = input;
  for (const op of ir.ops) {
    ensemble = applyOp(ir, ring, isZero, ensemble, op);
  }
  return ensemble;
}

// ─── Convenience: typed wrappers for the two main lanes ──────────────────────

const EPS = 1e-12;
const isZeroReal = (w: number) => Math.abs(w) < EPS;
const isZeroComplex = (w: Complex) => w.re * w.re + w.im * w.im < EPS;

/** Soft-Bayesian: real probability weights, no interference. */
export function softBayesianMix(ir: ZetaIrV1, x: bigint): bigint {
  const MASK = (1n << BigInt(ir.width)) - 1n;
  const input: WEntry<bigint, number>[] = [{ key: x & MASK, weight: 1.0 }];
  const result = softMixGeneric(ir, realRing, isZeroReal, input);
  return result[0]?.key ?? 0n;
}

/** Soft-Quantum: complex amplitudes, interference. */
export function softQuantumMix(ir: ZetaIrV1, x: bigint): bigint {
  const MASK = (1n << BigInt(ir.width)) - 1n;
  const input: WEntry<bigint, Complex>[] = [{ key: x & MASK, weight: { re: 1, im: 0 } }];
  const result = softMixGeneric(ir, complexRing, isZeroComplex, input);
  return result[0]?.key ?? 0n;
}

export { parseIrJson, type ZetaIrV1 };
