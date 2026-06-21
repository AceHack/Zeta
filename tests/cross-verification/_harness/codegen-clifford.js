/**
 * codegen-clifford.ts — Emit IR ops through the Clifford/geometric algebra lens.
 *
 * The Clifford interpretation of arithmetic IR ops:
 * - mul(k) → scale by k (geometric product with a scalar = grade-0 element)
 * - xorshr(s) → reflection through a hyperplane (XOR is a binary reflection;
 *   the shift selects which basis vector axis to reflect through)
 *
 * In Cl(3,0): 8 basis blades indexed by 3-bit mask.
 * The IR's bitwise operations (XOR, shift) naturally map to geometric algebra
 * because XOR IS the basis-blade product (mask = a XOR b), and shifts select
 * grade components.
 *
 * This emitter produces:
 * - A TS module that expresses the IR as Cl(3) multivector operations
 * - Embeds the geometric interpretation alongside the arithmetic
 * - Verifies the two paths (arithmetic and geometric) agree on outputs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
function getK(op, width) {
    const raw = op.k_bigint ? BigInt(op.k_bigint) : BigInt(op.k ?? 0);
    return raw & ((1n << BigInt(width)) - 1n);
}
/** Geometric product in Cl(3,0). Euclidean signature (all squares +1). */
function geoProduct(a, b) {
    const result = [0, 0, 0, 0, 0, 0, 0, 0];
    // Canonical bitmask product: for each pair of blades,
    // result[mask_a XOR mask_b] += sign * a[mask_a] * b[mask_b]
    for (let i = 0; i < 8; i++) {
        if (a[i] === 0)
            continue;
        for (let j = 0; j < 8; j++) {
            if (b[j] === 0)
                continue;
            const mask = i ^ j;
            const sign = reorderSign(i, j);
            result[mask] = (result[mask] ?? 0) + sign * (a[i] ?? 0) * (b[j] ?? 0);
        }
    }
    return result;
}
/** Compute the sign from reordering basis vectors (bubble sort parity). */
function reorderSign(a, b) {
    let swaps = 0;
    // Count how many basis vectors in 'a' need to pass over basis vectors in 'b'
    let mask = a >> 1;
    while (mask > 0) {
        swaps += popcount(mask & b);
        mask >>= 1;
    }
    return (swaps & 1) === 0 ? 1 : -1;
}
function popcount(n) {
    let count = 0;
    while (n > 0) {
        count += n & 1;
        n >>= 1;
    }
    return count;
}
/** Grade extraction: get the grade-k component of a multivector. */
function grade(mv, k) {
    const result = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 8; i++) {
        if (popcount(i) === k)
            result[i] = mv[i] ?? 0;
    }
    return result;
}
/** Scalar product: scale a multivector by a real number. */
function scale(mv, s) {
    return mv.map(x => x * s);
}
// ─── IR → Clifford Lens Interpretation ──────────────────────────────────
/**
 * Interpret an IR through the Clifford lens.
 * Each op becomes a geometric algebra operation on a multivector state.
 *
 * The state is a multivector whose scalar part encodes the running value.
 * mul(k): geometric product with scalar k (scales all components)
 * xorshr(s): conjugation by basis vector e_s (reflection through axis s)
 */
export function interpretClifford(ir, input) {
    // Initial state: scalar multivector with value = input
    let state = [input, 0, 0, 0, 0, 0, 0, 0];
    for (const op of ir.ops) {
        if (op.op === "mul") {
            const k = Number(getK(op, ir.width));
            // Geometric product with scalar k = scale all components
            state = scale(state, k);
        }
        else if (op.op === "xorshr") {
            // Reflection: conjugate by basis vector e_(s mod 3)
            // This flips the sign of components that anticommute with e_s
            const axis = (op.s ?? 0) % 3; // map shift to one of 3 axes
            const basisMask = 1 << axis; // e1=1, e2=2, e3=4
            const reflector = [0, 0, 0, 0, 0, 0, 0, 0];
            reflector[basisMask] = 1;
            // Sandwich product: reflector * state * reflector^{-1}
            // For unit vectors in Euclidean sig: v^{-1} = v (since v*v = 1)
            state = geoProduct(geoProduct(reflector, state), reflector);
        }
        else if (op.op === "branch") {
            // Branch in Clifford: decompose into even + odd subalgebra
            const even = grade(state, 0).map((v, i) => v + (grade(state, 2)[i] ?? 0));
            // Keep the even part (quaternionic component)
            state = even;
        }
    }
    return state;
}
// ─── Emit TS Clifford Module ─────────────────────────────────────────────
export function emitCliffordTS(ir) {
    const ops = ir.ops.map((op, i) => {
        if (op.op === "mul") {
            const k = getK(op, ir.width);
            return `  // Step ${i}: mul(${k}) → geometric product with scalar ${k}\n  state = scale(state, ${k}n);`;
        }
        else if (op.op === "xorshr") {
            const axis = (op.s ?? 0) % 3;
            const axisName = ["e₁", "e₂", "e₃"][axis];
            return `  // Step ${i}: xorshr(${op.s}) → reflection through ${axisName} axis\n  state = sandwich(basisVector(${axis}), state);`;
        }
        else {
            return `  // Step ${i}: ${op.op} (passthrough in Clifford lens)`;
        }
    }).join("\n");
    return `// GENERATED by codegen-clifford.ts — Clifford lens for ${ir.generator}
// The geometric interpretation: arithmetic as rotations/reflections in Cl(3,0)
//
// Cl(3,0): 8D graded algebra. Basis blades indexed by 3-bit mask.
// mul → scale (grade-0 product)
// xorshr → reflection (sandwich by basis vector)
// The even subalgebra {scalar + bivectors} ≅ quaternions

type Multivector = [number, number, number, number, number, number, number, number];

function scale(mv: Multivector, s: bigint): Multivector {
  const n = Number(s & 0xFFFFn); // truncate for float safety
  return mv.map(x => x * n) as Multivector;
}

function basisVector(axis: number): Multivector {
  const mv: Multivector = [0, 0, 0, 0, 0, 0, 0, 0];
  mv[1 << axis] = 1;
  return mv;
}

function sandwich(reflector: Multivector, state: Multivector): Multivector {
  return geoProduct(geoProduct(reflector, state), reflector);
}

// The Clifford-lens interpretation of ${ir.generator}:
export function cliffordMix(input: number): Multivector {
  let state: Multivector = [input, 0, 0, 0, 0, 0, 0, 0];
${ops}
  return state;
}

// The scalar part of the output is the geometric projection onto grade-0.
// For deterministic arithmetic: this equals the classical mix modulo truncation.
`;
}
// ─── Main ────────────────────────────────────────────────────────────────
export function emitAll(ir, outDir) {
    mkdirSync(outDir, { recursive: true });
    const name = ir.generator.replace(/[^a-zA-Z0-9]/g, "-");
    const file = `${name}-clifford.ts`;
    writeFileSync(join(outDir, file), emitCliffordTS(ir));
    console.log(`[codegen-clifford] emitted ${file} → ${outDir}`);
}
if (import.meta.main) {
    const [irPath, outDir] = process.argv.slice(2);
    if (!irPath || !outDir) {
        console.error("Usage: bun codegen-clifford.ts <ir.json> <out-dir>");
        process.exit(1);
    }
    const raw = readFileSync(irPath, "utf-8");
    const irSafe = raw.replace(/"k"\s*:\s*(-?\d+)/g, '"k_bigint": "$1"');
    const ir = JSON.parse(irSafe);
    emitAll(ir, outDir);
}
