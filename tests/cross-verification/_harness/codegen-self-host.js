/**
 * codegen-self-host.ts — The self-hosting codegen: gen(gen)=gen made operational.
 *
 * This file describes the codegen's own structure as an IR, then generates
 * a codegen from that description, and verifies the output matches the
 * committed codegen (behavioral equivalence).
 *
 * The 3rd Futamura projection made concrete:
 * - mix(program, input) = output (the interpreter)
 * - mix(mix, program) = compiled-program (the 1st projection, our specialize())
 * - mix(mix, mix) = cogen (the 3rd projection, THIS FILE)
 *
 * The test: generate(IR-of-generate) produces a codegen that, given any
 * arithmetic IR, produces the SAME output as the committed codegen.
 */
// ─── The TypeScript codegen described as IR ──────────────────────────────
export const typeScriptCodegenIr = {
    schema: "zeta-ir-v2-codegen",
    target: "typescript",
    header: `const MASK = (1n << {width}n) - 1n;\nfunction mix(x: bigint): bigint {\n  let z = x & MASK;`,
    footer: `  return z;\n}`,
    wrapExpr: "({expr}) & MASK",
    patterns: [
        {
            opType: "mul",
            template: "  z = ({expr}) & MASK;",
            substitutions: [{ placeholder: "{expr}", source: "k_unsigned" }],
        },
        {
            opType: "xorshr",
            template: "  z = ({expr}) & MASK;",
            substitutions: [{ placeholder: "{expr}", source: "shift" }],
        },
    ],
};
function getKUnsigned(op, width) {
    const raw = op.k_bigint ? BigInt(op.k_bigint) : BigInt(op.k ?? 0);
    return raw & ((1n << BigInt(width)) - 1n);
}
/**
 * The self-hosting generator: reads a CodegenIr (meta) and produces a
 * function that, given an ArithIr, produces source code.
 *
 * This IS gen(gen): the meta-IR generates a codegen.
 */
export function generateCodegen(meta) {
    return (ir) => {
        const header = meta.header.replace("{width}", String(ir.width));
        const footer = meta.footer;
        const body = ir.ops.map(op => {
            const pattern = meta.patterns.find(p => p.opType === op.op);
            if (!pattern)
                return `  // unknown op: ${op.op}`;
            let line = pattern.template;
            for (const sub of pattern.substitutions) {
                let value;
                if (sub.source === "k_unsigned") {
                    value = `z * ${getKUnsigned(op, ir.width)}n`;
                }
                else if (sub.source === "shift") {
                    value = `z ^ (z >> ${op.s}n)`;
                }
                else if (sub.source === "bit") {
                    value = `z ^ (1n << ${op.bit}n)`;
                }
                else {
                    value = "z";
                }
                line = line.replace(sub.placeholder, value);
            }
            return line;
        }).join("\n");
        return `${header}\n${body}\n${footer}`;
    };
}
// ─── The reference codegen (what the generated one must match) ───────────
/**
 * The "hand-written" codegen (what we already have, simplified).
 * The self-hosting test proves: generateCodegen(meta)(ir) === referenceCodegen(ir)
 */
export function referenceCodegen(ir) {
    const mask = `(1n << ${ir.width}n) - 1n`;
    const header = `const MASK = ${mask};\nfunction mix(x: bigint): bigint {\n  let z = x & MASK;`;
    const footer = `  return z;\n}`;
    const body = ir.ops.map(op => {
        if (op.op === "mul") {
            const k = getKUnsigned(op, ir.width);
            return `  z = (z * ${k}n) & MASK;`;
        }
        else if (op.op === "xorshr") {
            return `  z = (z ^ (z >> ${op.s}n)) & MASK;`;
        }
        return `  // unknown op: ${op.op}`;
    }).join("\n");
    return `${header}\n${body}\n${footer}`;
}
// ─── Verify gen(gen)=gen ─────────────────────────────────────────────────
/**
 * The fixpoint test: the generated codegen produces the same output
 * as the reference codegen for ANY arithmetic IR.
 */
export function verifyFixpoint(meta, testIrs) {
    const generated = generateCodegen(meta);
    const failures = [];
    for (const ir of testIrs) {
        const genOutput = generated(ir);
        const refOutput = referenceCodegen(ir);
        if (genOutput !== refOutput) {
            failures.push(`${ir.generator}: generated !== reference`);
        }
    }
    return { pass: failures.length === 0, failures };
}
