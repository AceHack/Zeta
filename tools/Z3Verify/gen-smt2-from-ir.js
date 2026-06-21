/**
 * gen-smt2-from-ir.ts -- parameterised Z3 QF_BV denotation-preservation proof
 * generator for the zeta-ir finaliser rows.
 *
 *   Reads a zeta-ir-v{1,2,3} artifact (the op-list of a mixer/finaliser) and the
 *   sibling vectors.yaml byte-lock, and EMITS the .smt2 denotation proof -- the
 *   same structure as the hand-written gen-denotation-splitmix64.smt2, but
 *   parameterised over the row. Every new generator that lands on the registry
 *   gets a machine-checkable denotation proof for free.
 *
 *   Author: Soraya (formal-verification-expert role), invoked by Otto. The
 *   cheap-next-step flagged at the close of C2 (gen-denotation arc). Reason from
 *   our own understanding; this is not a port.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE EMITTED PROOF PROVES (and why it is not a tautology)
 * ---------------------------------------------------------------------------
 * The interpreter denotation of each IR op is committed in
 *   tests/cross-verification/nasam/_gen/gen.ts   (the v3 total interpreter)
 *   tests/cross-verification/_harness/codegen-from-ir.ts
 * The emitted proof renders that SAME denotation TWICE, from two INDEPENDENT
 * SMT encodings, then refutes their disagreement over the WHOLE input domain:
 *
 *   *_oracle  -- the REFERENCE encoding. `mul` uses the named-hex u-word literal
 *                (#x...), so the constant is read as the human writes it.
 *                `rotl` / `xrotxor` use Z3's PRIMITIVE ((_ rotate_left r) z).
 *
 *   *_interp  -- the GENERATED encoding, exactly as the codegen emits it. `mul`
 *                uses fromI64 == bvneg(|stored signed decimal|) -- the stored
 *                int64 magnitude reinterpreted to its u-word (the round-trip the
 *                TS/F#/C#/Rust interpreters perform). `rotl` / `xrotxor` use the
 *                MANUAL shift-or decomposition (bvor (bvshl z r) (bvlshr z W-r)).
 *
 * THEOREM (forall x. oracle(x) = interp(x)) therefore discharges, over every one
 * of the 2^W inputs and independent of any test vector:
 *   - that fromI64's signed->unsigned reinterpretation is bit-exact, and
 *   - that the manual rotate decomposition equals Z3's native rotate.
 * In SMT we refute the negation; `unsat` certifies equality over the domain.
 *
 * CONTROL grounds the generated fold against the sibling vectors.yaml -- the
 * cross-language (cs/rust/fsharp/python/ts/go) byte-lock. That external oracle is
 * what makes an "identically-wrong on both encodings" bug observable.
 *
 * Honest scope: when a row's ops are all `mul`/`xorshr` with NON-NEGATIVE small
 * constants (e.g. xoshiro256ss mul-5/mul-9, fmix32), the two encodings coincide
 * and THEOREM reduces to a reflexive identity -- the load-bearing grounding for
 * those rows is the CONTROL against vectors.yaml. The emitted header states which
 * regime the row is in. (A negative `mul` constant or any rotate makes THEOREM
 * non-trivial: splitmix64, fmix64, nasam, xoshiro's rotl.)
 *
 * Anchors (Beacon): QF_BV is decidable (Barrett/Tinelli, SMT-LIB 2.6); bvmul is
 * the mod-2^n product so wrapping word arithmetic is exact. Per-generator human
 * anchors live in each vectors.yaml description.
 *
 * Usage:
 *   bun tools/Z3Verify/gen-smt2-from-ir.ts <ir.json> [out.smt2]
 *     no out path  -> writes <ir-dir>/gen-denotation-<generator>.smt2 and prints it
 *     out == "-"   -> writes the proof to stdout
 *
 * Verify the emitted proof:  z3 <out.smt2>   (expect a column of `unsat`)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
// --- IR parsing (BigInt-safe: JSON.parse loses precision on int64 `k`) -------
export function parseIrJson(text) {
    // Quote every integer that could exceed 2^53 so JSON.parse keeps it exact.
    const safe = text.replace(/"(k)"\s*:\s*(-?\d+)/g, '"$1":"$2"');
    const raw = JSON.parse(safe);
    if (typeof raw.generator !== "string")
        throw new Error("IR: missing string `generator`");
    if (!Array.isArray(raw.ops))
        throw new Error("IR: missing `ops` array");
    const width = BigInt(raw.width ?? 64); // splitmix64's row omits width (u64 default)
    const ops = raw.ops.map((node, i) => {
        const o = node;
        switch (o.op) {
            case "mul":
                return { op: "mul", k: BigInt(o.k) };
            case "xorshr":
                return { op: "xorshr", s: BigInt(o.s) };
            case "rotl":
                return { op: "rotl", r: BigInt(o.r) };
            case "xrotxor":
                return { op: "xrotxor", rs: o.rs.map((v) => BigInt(v)) };
            case "xshrxor":
                return { op: "xshrxor", ss: o.ss.map((v) => BigInt(v)) };
            default:
                throw new Error(`IR: op #${i} has unknown op "${String(o.op)}"`);
        }
    });
    return { schema: raw.schema, generator: raw.generator, version: raw.version ?? 1, width, ops };
}
// --- vectors.yaml loading (sibling byte-lock; Bun.YAML, as the harness uses) --
export function loadVectors(irPath) {
    // ir lives at <dir>/_gen/<name>.ir.json; vectors.yaml is at <dir>/vectors.yaml
    const genDir = dirname(irPath);
    const primDir = basename(genDir) === "_gen" ? dirname(genDir) : genDir;
    const yamlP = join(primDir, "vectors.yaml");
    if (!existsSync(yamlP))
        return [];
    const yaml = globalThis.Bun?.YAML;
    if (yaml === undefined)
        throw new Error(`Bun.YAML unavailable while parsing ${yamlP} (run under bun)`);
    const root = yaml.parse(readFileSync(yamlP, "utf8"));
    if (!Array.isArray(root.vectors))
        return [];
    const out = [];
    for (const v of root.vectors) {
        // a row needs an explicit input `x` AND a canonical `result` to be a control point
        if (v.x === undefined || v.result === undefined)
            continue;
        out.push({ id: String(v.id), x: BigInt(String(v.x)), result: BigInt(String(v.result)) });
    }
    return out;
}
// --- bitvector literal helpers ----------------------------------------------
/** Reduce a (possibly negative) integer to its W-bit two's-complement value. */
function toWord(n, width) {
    const mod = 1n << width;
    return ((n % mod) + mod) % mod;
}
/** A W-bit literal as #x.. hex when W % 4 == 0, else (_ bv<dec> W). */
function bvHex(n, width) {
    const w = toWord(n, width);
    if (width % 4n === 0n)
        return `#x${w.toString(16).padStart(Number(width) / 4, "0")}`;
    return `(_ bv${w} ${width})`;
}
/** A decimal-form W-bit literal, (_ bv<value> W). */
function bvDec(n, width) {
    return `(_ bv${toWord(n, width)} ${width})`;
}
/**
 * The GENERATED-side constant for a `mul` op, mirroring fromI64 exactly:
 * a stored-negative int64 reinterprets via bvneg(|stored|); non-negative is direct.
 */
function interpMulConst(k, width) {
    return k < 0n ? `(bvneg (_ bv${-k} ${width}))` : `(_ bv${k} ${width})`;
}
// --- op renderers: oracle (reference) vs interp (as-codegen-emits) -----------
function rotlManual(z, r, width) {
    const rk = ((r % width) + width) % width;
    if (rk === 0n)
        return z;
    return `(bvor (bvshl ${z} ${bvDec(rk, width)}) (bvlshr ${z} ${bvDec(width - rk, width)}))`;
}
function rotlNative(z, r, width) {
    const rk = ((r % width) + width) % width;
    return rk === 0n ? z : `((_ rotate_left ${rk}) ${z})`;
}
/** Render one op as the SMT expression that maps the previous accumulator `z`. */
function renderOp(op, z, width, side) {
    switch (op.op) {
        case "mul": {
            const c = side === "oracle" ? bvHex(op.k, width) : interpMulConst(op.k, width);
            return `(bvmul ${z} ${c})`;
        }
        case "xorshr":
            return `(bvxor ${z} (bvlshr ${z} ${bvDec(op.s, width)}))`;
        case "rotl":
            return side === "oracle" ? rotlNative(z, op.r, width) : rotlManual(z, op.r, width);
        case "xrotxor": {
            const terms = op.rs.map((r) => (side === "oracle" ? rotlNative(z, r, width) : rotlManual(z, r, width)));
            return `(bvxor ${z} ${terms.join(" ")})`;
        }
        case "xshrxor": {
            const terms = op.ss.map((s) => `(bvlshr ${z} ${bvDec(s, width)})`);
            return `(bvxor ${z} ${terms.join(" ")})`;
        }
    }
}
/** A one-line English gloss of an op, for the per-op comment column. */
function opGloss(op) {
    switch (op.op) {
        case "mul":
            return `mul k=${op.k}`;
        case "xorshr":
            return `xorshr s=${op.s}`;
        case "rotl":
            return `rotl r=${op.r}`;
        case "xrotxor":
            return `xrotxor rs=[${op.rs.join(",")}]`;
        case "xshrxor":
            return `xshrxor ss=[${op.ss.join(",")}]`;
    }
}
/** Build a nested-let mix function body folding `ops` over the argument `arg`. */
function emitMixFn(name, arg, ir, side) {
    const W = ir.width;
    const lines = [`(define-fun ${name} ((${arg} (_ BitVec ${W}))) (_ BitVec ${W})`];
    let cur = arg;
    const closers = ir.ops.length; // one let per op
    ir.ops.forEach((op, i) => {
        const next = `z${i + 1}`;
        const expr = renderOp(op, cur, W, side);
        const isLast = i === ir.ops.length - 1;
        if (isLast) {
            // final op: produce the body of the innermost let chain directly
            lines.push(`  (let ((${next} ${expr})) ${next}`);
        }
        else {
            lines.push(`  (let ((${next} ${expr}))                ; op ${i}: ${opGloss(op)}`);
        }
        cur = next;
    });
    // close all lets + the define-fun
    lines[lines.length - 1] += ")".repeat(closers) + ")";
    // append op-N comment to the last line
    const lastOp = ir.ops[ir.ops.length - 1];
    if (lastOp)
        lines[lines.length - 1] += `  ; op ${ir.ops.length - 1}: ${opGloss(lastOp)}`;
    return lines.join("\n");
}
// --- whole-proof emission ----------------------------------------------------
export function emitSmt2(ir, vectors) {
    const W = ir.width;
    const muls = ir.ops.filter((o) => o.op === "mul");
    const negMul = muls.some((m) => m.k < 0n);
    const hasRot = ir.ops.some((o) => o.op === "rotl" || o.op === "xrotxor");
    const nonTrivial = negMul || hasRot;
    const name = ir.generator.replace(/[^A-Za-z0-9]/g, "_");
    const L = [];
    L.push("; ============================================================================");
    L.push(`; gen-denotation-${ir.generator}.smt2  --  Z3 QF_BV denotation-preservation proof`);
    L.push(";   GENERATED by tools/Z3Verify/gen-smt2-from-ir.ts -- do not hand-edit.");
    L.push(`;   generator ${ir.generator}@${ir.version}  width=${W}  schema=${ir.schema ?? "(v1)"}`);
    L.push(";");
    L.push(";   oracle side : reference encoding (named-hex mul constants; native rotate_left)");
    L.push(";   interp side : as-codegen encoding (fromI64 = bvneg|stored|; manual rotate)");
    L.push(`;   THEOREM regime: ${nonTrivial ? "NON-TRIVIAL" : "reflexive"} ` +
        `(${negMul ? "negative mul constant; " : ""}${hasRot ? "rotation present; " : ""}` +
        `${nonTrivial ? "" : "all mul constants non-negative, no rotation -> grounding is the CONTROL"})`);
    L.push("; ============================================================================");
    L.push("");
    L.push("(set-logic QF_BV)");
    L.push("(set-info :status unsat)");
    L.push("");
    // LEMMA -- per mul constant, the named-hex oracle literal == the fromI64 interp form.
    if (muls.length > 0) {
        L.push("; LEMMA -- each mul constant's fromI64 (bvneg of stored signed decimal) reinterpretation");
        L.push(";          equals its named-hex u-word literal. Discharges the round-trip per constant,");
        L.push(";          independent of the fold.");
        L.push("(push)");
        const conj = muls.map((m) => `(= ${bvHex(m.k, W)} ${interpMulConst(m.k, W)})`).join("\n  ");
        L.push(`(assert (not (and\n  ${conj}\n)))`);
        L.push("(check-sat)   ; expect: unsat");
        L.push("(pop)");
        L.push("");
    }
    // the two independent mix functions
    L.push("; --- oracle: reference encoding (one let per IR op) ---");
    L.push(emitMixFn(`${name}_oracle`, "x", ir, "oracle"));
    L.push("");
    L.push("; --- interp: generated encoding, exactly as the codegen emits (one let per IR op) ---");
    L.push(emitMixFn(`${name}_interp`, "x", ir, "interp"));
    L.push("");
    // THEOREM -- denotation preservation over all 2^W inputs.
    L.push(`; THEOREM -- oracle == interp over all 2^${W} inputs.`);
    L.push("(push)");
    L.push(`(declare-const X (_ BitVec ${W}))`);
    L.push(`(assert (not (= (${name}_oracle X) (${name}_interp X))))`);
    L.push("(check-sat)   ; expect: unsat");
    L.push("(pop)");
    L.push("");
    // CONTROL -- the generated fold reproduces the vectors.yaml cross-language byte-lock.
    if (vectors.length > 0) {
        L.push(`; CONTROL -- the generated fold reproduces the ${vectors.length} committed vectors.yaml`);
        L.push(";            golden vectors (the cs/rust/fsharp/python/ts/go byte-lock).");
        L.push("(push)");
        const conj = vectors
            .map((v) => `(= (${name}_interp ${bvDec(v.x, W)}) ${bvDec(v.result, W)})  ; ${v.id}`)
            .join("\n  ");
        L.push(`(assert (not (and\n  ${conj}\n)))`);
        L.push("(check-sat)   ; expect: unsat");
        L.push("(pop)");
        L.push("");
    }
    const checks = 1 + (muls.length > 0 ? 1 : 0) + (vectors.length > 0 ? 1 : 0);
    L.push("; ============================================================================");
    L.push(`; ${checks} checks, all expected unsat:`);
    if (muls.length > 0)
        L.push(";   LEMMA   -- fromI64 reinterpretation exact (per mul constant)");
    L.push(`;   THEOREM -- ${name}_oracle == ${name}_interp over all 2^${W} inputs`);
    if (vectors.length > 0)
        L.push(`;   CONTROL -- generated fold reproduces ${vectors.length} byte-locked vectors`);
    L.push("; ============================================================================");
    return L.join("\n") + "\n";
}
// --- CLI --------------------------------------------------------------------
function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error("Usage: bun tools/Z3Verify/gen-smt2-from-ir.ts <ir.json> [out.smt2 | -]");
        return 1;
    }
    const irPath = args[0];
    const ir = parseIrJson(readFileSync(irPath, "utf8"));
    const vectors = loadVectors(irPath);
    const smt2 = emitSmt2(ir, vectors);
    const outArg = args[1];
    if (outArg === "-") {
        process.stdout.write(smt2);
        return 0;
    }
    const outPath = outArg ?? join(dirname(irPath), `gen-denotation-${ir.generator}.smt2`);
    writeFileSync(outPath, smt2);
    console.error(`[gen-smt2] ${ir.generator}@${ir.version} (width ${ir.width}, ${ir.ops.length} ops, ` +
        `${vectors.length} control vectors) -> ${outPath}`);
    return 0;
}
if (import.meta.main) {
    process.exit(main());
}
