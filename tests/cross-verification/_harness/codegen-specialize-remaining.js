/**
 * codegen-specialize-remaining.ts — 1st Futamura projection for F#/C#/Rust/Go/Q#.
 *
 * Emits UNROLLED straight-line code (no loop, no switch, constants inlined).
 * Performance-equivalent to hand-written. This is the specialized fast path.
 */
function getK(op, width) {
    const raw = op.k_bigint ? BigInt(op.k_bigint) : BigInt(op.k ?? 0);
    return raw & ((1n << BigInt(width)) - 1n);
}
function toHex(n) {
    return "0x" + n.toString(16).toUpperCase();
}
// ─── F# Specialized ─────────────────────────────────────────────────────
export function emitSpecializedFSharp(ir) {
    const body = ir.ops.map(op => {
        if (op.op === "mul")
            return `    z <- z * ${getK(op, ir.width)}UL`;
        if (op.op === "xorshr")
            return `    z <- z ^^^ (z >>> ${op.s})`;
        return `    // unknown: ${op.op}`;
    }).join("\n");
    return `// SPECIALIZED (1st Futamura projection) by codegen-specialize — ${ir.generator}
// Unrolled: no loop, no switch. Performance = hand-written.
let inline mix (x: uint64) : uint64 =
    let mutable z = x
${body}
    z
`;
}
// ─── C# Specialized ─────────────────────────────────────────────────────
export function emitSpecializedCSharp(ir) {
    const body = ir.ops.map(op => {
        if (op.op === "mul")
            return `        z = unchecked(z * ${toHex(getK(op, ir.width))}UL);`;
        if (op.op === "xorshr")
            return `        z = z ^ (z >> ${op.s});`;
        return `        // unknown: ${op.op}`;
    }).join("\n");
    return `// SPECIALIZED (1st Futamura projection) by codegen-specialize — ${ir.generator}
// Unrolled: no loop, no switch. Performance = hand-written.
[MethodImpl(MethodImplOptions.AggressiveInlining)]
public static ulong Mix(ulong x)
{
    unchecked
    {
        ulong z = x;
${body}
        return z;
    }
}
`;
}
// ─── Rust Specialized ────────────────────────────────────────────────────
export function emitSpecializedRust(ir) {
    const body = ir.ops.map(op => {
        if (op.op === "mul")
            return `    z = z.wrapping_mul(${toHex(getK(op, ir.width))});`;
        if (op.op === "xorshr")
            return `    z = z ^ (z >> ${op.s});`;
        return `    // unknown: ${op.op}`;
    }).join("\n");
    return `// SPECIALIZED (1st Futamura projection) by codegen-specialize — ${ir.generator}
// Unrolled: no loop, no switch. Performance = hand-written.
#[inline(always)]
pub fn mix(x: u64) -> u64 {
    let mut z = x;
${body}
    z
}
`;
}
// ─── Go Specialized ──────────────────────────────────────────────────────
export function emitSpecializedGo(ir) {
    const body = ir.ops.map(op => {
        if (op.op === "mul")
            return `\tz = z * ${toHex(getK(op, ir.width))}`;
        if (op.op === "xorshr")
            return `\tz = z ^ (z >> ${op.s})`;
        return `\t// unknown: ${op.op}`;
    }).join("\n");
    return `// SPECIALIZED (1st Futamura projection) by codegen-specialize — ${ir.generator}
// Unrolled: no loop, no switch. Performance = hand-written.
func mix(x uint64) uint64 {
\tz := x
${body}
\treturn z
}
`;
}
// ─── Q# Specialized ─────────────────────────────────────────────────────
export function emitSpecializedQSharp(ir) {
    const mask = `0x${"F".repeat(ir.width / 4)}L`;
    const body = ir.ops.map(op => {
        if (op.op === "mul")
            return `        set z = (z * ${getK(op, ir.width)}L) &&& MASK;`;
        if (op.op === "xorshr")
            return `        set z = z ^^^ (z >>> ${op.s});`;
        return `        // unknown: ${op.op}`;
    }).join("\n");
    return `// SPECIALIZED (1st Futamura projection) by codegen-specialize — ${ir.generator}
// Unrolled: no loop, no switch. Behavioral-equivalence tier.
namespace Zeta.Specialized {
    function Mix(x : Int) : Int {
        let MASK = ${mask};
        mutable z = x &&& MASK;
${body}
        return z;
    }
}
`;
}
