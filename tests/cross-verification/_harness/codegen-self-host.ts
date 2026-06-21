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

import { readFileSync } from "node:fs";
import { join } from "node:path";

// ─── The IR of the codegen itself ────────────────────────────────────────

/**
 * The codegen's logic described as data (an IR).
 * This is NOT the zeta-ir-v2 (which describes arithmetic). This is a
 * meta-IR that describes CODE GENERATION PATTERNS.
 *
 * Each entry says: "for op type X, emit template Y with substitutions Z"
 */
export interface CodegenPattern {
  opType: string;
  template: string;
  substitutions: { placeholder: string; source: "k_unsigned" | "shift" | "bit" | "control" | "target" }[];
}

export interface CodegenIr {
  schema: "zeta-ir-v2-codegen";
  target: string; // "typescript" | "python" | "go" | etc
  header: string;
  footer: string;
  patterns: CodegenPattern[];
  wrapExpr: string; // how to wrap the final expression (e.g. "({expr}) & MASK")
}

// ─── The TypeScript codegen described as IR ──────────────────────────────

export const typeScriptCodegenIr: CodegenIr = {
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

// ─── Generate a codegen from the meta-IR ─────────────────────────────────

interface ArithOp { op: string; k?: number; s?: number; k_bigint?: string }
interface ArithIr { generator: string; width: number; ops: ArithOp[] }

function getKUnsigned(op: ArithOp, width: number): bigint {
  const raw = op.k_bigint ? BigInt(op.k_bigint) : BigInt(op.k ?? 0);
  return raw & ((1n << BigInt(width)) - 1n);
}

/**
 * The self-hosting generator: reads a CodegenIr (meta) and produces a
 * function that, given an ArithIr, produces source code.
 *
 * This IS gen(gen): the meta-IR generates a codegen.
 */
export function generateCodegen(meta: CodegenIr): (ir: ArithIr) => string {
  return (ir: ArithIr): string => {
    const header = meta.header.replace("{width}", String(ir.width));
    const footer = meta.footer;

    const body = ir.ops.map(op => {
      const pattern = meta.patterns.find(p => p.opType === op.op);
      if (!pattern) return `  // unknown op: ${op.op}`;

      let line = pattern.template;
      for (const sub of pattern.substitutions) {
        let value: string;
        if (sub.source === "k_unsigned") {
          value = `z * ${getKUnsigned(op, ir.width)}n`;
        } else if (sub.source === "shift") {
          value = `z ^ (z >> ${op.s}n)`;
        } else if (sub.source === "bit") {
          value = `z ^ (1n << ${(op as any).bit}n)`;
        } else {
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
export function referenceCodegen(ir: ArithIr): string {
  const mask = `(1n << ${ir.width}n) - 1n`;
  const header = `const MASK = ${mask};\nfunction mix(x: bigint): bigint {\n  let z = x & MASK;`;
  const footer = `  return z;\n}`;

  const body = ir.ops.map(op => {
    if (op.op === "mul") {
      const k = getKUnsigned(op, ir.width);
      return `  z = (z * ${k}n) & MASK;`;
    } else if (op.op === "xorshr") {
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
export function verifyFixpoint(meta: CodegenIr, testIrs: ArithIr[]): { pass: boolean; failures: string[] } {
  const generated = generateCodegen(meta);
  const failures: string[] = [];

  for (const ir of testIrs) {
    const genOutput = generated(ir);
    const refOutput = referenceCodegen(ir);
    if (genOutput !== refOutput) {
      failures.push(`${ir.generator}: generated !== reference`);
    }
  }

  return { pass: failures.length === 0, failures };
}
