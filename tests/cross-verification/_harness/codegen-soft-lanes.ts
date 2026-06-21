/**
 * codegen-soft-lanes.ts — emit soft-quantum + soft-bayesian oracle scripts from zeta-ir-v1.
 *
 * Extends the classical codegen with two soft-lane emitters per language.
 * The soft lanes fold the SAME IR ops through an amplitude/probability ensemble
 * rather than raw arithmetic — same output on deterministic inputs, but capable
 * of representing uncertainty (superposition / belief distribution).
 *
 * Targets: TS, Python, F# (languages with natural complex-number / dynamic support)
 *
 * Usage:
 *   bun tests/cross-verification/_harness/codegen-soft-lanes.ts <ir.json> <output-dir>
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { parseIrJson, type ZetaIrV1 } from "./codegen-from-ir";

// ─── Canonical inputs ────────────────────────────────────────────────────────

const CANONICAL_INPUTS: [string, string][] = [
  ["x-0", "0"], ["x-1", "1"], ["x-2", "2"], ["x-10", "10"],
  ["x-255", "255"], ["x-u64max", "18446744073709551615"],
  ["x-golden", "11400714819323198485"], ["x-2pow63", "9223372036854775808"],
  ["x-12345678901234567890", "12345678901234567890"], ["x-1e18", "1000000000000000000"],
];

// ─── Soft-Quantum TS ─────────────────────────────────────────────────────────

function emitSoftQuantumTS(ir: ZetaIrV1): string {
  const opsLiteral = ir.ops.map(op => {
    if (op.op === "mul") return `{ op: "mul", k: "${op.k}" }`;
    return `{ op: "xorshr", s: ${op.s} }`;
  }).join(", ");

  return `// GENERATED — Soft-Quantum (AmplitudeEmu) lane for ${ir.generator}
// Complex amplitudes, interference on merge, O(support) cost.
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

const MASK = (1n << ${ir.width}n) - 1n;
const EPS = 1e-12;
type Amp = { state: bigint; re: number; im: number }[];
const OPS = [${opsLiteral}] as const;

function merge(a: Amp): Amp {
  const m = new Map<string, { re: number; im: number }>();
  for (const f of a) {
    const k = f.state.toString();
    const e = m.get(k);
    if (e) { e.re += f.re; e.im += f.im; }
    else m.set(k, { re: f.re, im: f.im });
  }
  const r: Amp = [];
  for (const [k, v] of m) if (v.re * v.re + v.im * v.im > EPS) r.push({ state: BigInt(k), ...v });
  return r;
}

function softMix(input: Amp): Amp {
  let ens = input;
  for (const op of OPS) {
    ens = ens.map(f => {
      let s = f.state;
      if (op.op === "mul") s = (s * (BigInt(op.k) & MASK)) & MASK;
      else s = (s ^ (s >> BigInt(op.s))) & MASK;
      return { state: s, re: f.re, im: f.im };
    });
    ens = merge(ens);
  }
  return ens;
}

const inputs: [string, string][] = ${JSON.stringify(CANONICAL_INPUTS)};
const out: Record<string, string> = { _source: "soft-quantum" };
for (const [id, x] of inputs) {
  const r = softMix([{ state: BigInt(x) & MASK, re: 1, im: 0 }]);
  out[id] = r[0]!.state.toString();
}
writeFileSync(join(dirname(import.meta.dir), "ts-soft-quantum-output.json"), JSON.stringify(out, null, 2) + "\\n");
console.log("wrote ts-soft-quantum-output.json");
`;
}

// ─── Soft-Bayesian TS ────────────────────────────────────────────────────────

function emitSoftBayesianTS(ir: ZetaIrV1): string {
  const opsLiteral = ir.ops.map(op => {
    if (op.op === "mul") return `{ op: "mul", k: "${op.k}" }`;
    return `{ op: "xorshr", s: ${op.s} }`;
  }).join(", ");

  return `// GENERATED — Soft-Bayesian (SoftEmu) lane for ${ir.generator}
// Real probability weights, no interference, O(support) cost.
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

const MASK = (1n << ${ir.width}n) - 1n;
const EPS = 1e-12;
type Bayes = { state: bigint; w: number }[];
const OPS = [${opsLiteral}] as const;

function bayesMerge(a: Bayes): Bayes {
  const m = new Map<string, number>();
  for (const f of a) {
    const k = f.state.toString();
    m.set(k, (m.get(k) ?? 0) + f.w);
  }
  const r: Bayes = [];
  for (const [k, w] of m) if (w > EPS) r.push({ state: BigInt(k), w });
  return r;
}

function bayesMix(input: Bayes): Bayes {
  let ens = input;
  for (const op of OPS) {
    ens = ens.map(f => {
      let s = f.state;
      if (op.op === "mul") s = (s * (BigInt(op.k) & MASK)) & MASK;
      else s = (s ^ (s >> BigInt(op.s))) & MASK;
      return { state: s, w: f.w };
    });
    ens = bayesMerge(ens);
  }
  return ens;
}

const inputs: [string, string][] = ${JSON.stringify(CANONICAL_INPUTS)};
const out: Record<string, string> = { _source: "soft-bayesian" };
for (const [id, x] of inputs) {
  const r = bayesMix([{ state: BigInt(x) & MASK, w: 1.0 }]);
  out[id] = r[0]!.state.toString();
}
writeFileSync(join(dirname(import.meta.dir), "ts-soft-bayesian-output.json"), JSON.stringify(out, null, 2) + "\\n");
console.log("wrote ts-soft-bayesian-output.json");
`;
}

// ─── Soft-Quantum Python ─────────────────────────────────────────────────────

function emitSoftQuantumPython(ir: ZetaIrV1): string {
  const mask = `(1 << ${ir.width}) - 1`;
  const ops = ir.ops.map(op => {
    if (op.op === "mul") {
      const unsigned = BigInt(op.k!) & ((1n << BigInt(ir.width)) - 1n);
      return `    ("mul", ${unsigned})`;
    }
    return `    ("xorshr", ${op.s})`;
  }).join(",\n");

  return `#!/usr/bin/env python3
# GENERATED — Soft-Quantum (AmplitudeEmu) lane for ${ir.generator}
# Complex amplitudes, interference on merge, O(support) cost.
import json, os

MASK = ${mask}
EPS = 1e-12
OPS = [
${ops}
]

def merge(frames):
    grouped = {}
    for state, re, im in frames:
        k = state
        if k in grouped:
            grouped[k] = (grouped[k][0] + re, grouped[k][1] + im)
        else:
            grouped[k] = (re, im)
    return [(k, r, i) for k, (r, i) in grouped.items() if r*r + i*i > EPS]

def soft_mix(x):
    ens = [(x & MASK, 1.0, 0.0)]
    for op_type, val in OPS:
        if op_type == "mul":
            ens = [((s * val) & MASK, r, i) for s, r, i in ens]
        else:
            ens = [((s ^ (s >> val)) & MASK, r, i) for s, r, i in ens]
        ens = merge(ens)
    return ens[0][0]

INPUTS = {
${CANONICAL_INPUTS.map(([id, x]) => `    "${id}": ${x},`).join("\n")}
}

out = {"_source": "soft-quantum"}
out.update({k: str(soft_mix(v)) for k, v in INPUTS.items()})
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(here, "python-soft-quantum-output.json"), "w") as f:
    json.dump(out, f, indent=2)
    f.write("\\n")
print("wrote python-soft-quantum-output.json")
`;
}

// ─── Soft-Bayesian Python ────────────────────────────────────────────────────

function emitSoftBayesianPython(ir: ZetaIrV1): string {
  const mask = `(1 << ${ir.width}) - 1`;
  const ops = ir.ops.map(op => {
    if (op.op === "mul") {
      const unsigned = BigInt(op.k!) & ((1n << BigInt(ir.width)) - 1n);
      return `    ("mul", ${unsigned})`;
    }
    return `    ("xorshr", ${op.s})`;
  }).join(",\n");

  return `#!/usr/bin/env python3
# GENERATED — Soft-Bayesian (SoftEmu) lane for ${ir.generator}
# Real probability weights, no interference, O(support) cost.
import json, os

MASK = ${mask}
EPS = 1e-12
OPS = [
${ops}
]

def bayes_merge(frames):
    grouped = {}
    for state, w in frames:
        grouped[state] = grouped.get(state, 0.0) + w
    return [(k, w) for k, w in grouped.items() if w > EPS]

def bayes_mix(x):
    ens = [(x & MASK, 1.0)]
    for op_type, val in OPS:
        if op_type == "mul":
            ens = [((s * val) & MASK, w) for s, w in ens]
        else:
            ens = [((s ^ (s >> val)) & MASK, w) for s, w in ens]
        ens = bayes_merge(ens)
    return ens[0][0]

INPUTS = {
${CANONICAL_INPUTS.map(([id, x]) => `    "${id}": ${x},`).join("\n")}
}

out = {"_source": "soft-bayesian"}
out.update({k: str(bayes_mix(v)) for k, v in INPUTS.items()})
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(here, "python-soft-bayesian-output.json"), "w") as f:
    json.dump(out, f, indent=2)
    f.write("\\n")
print("wrote python-soft-bayesian-output.json")
`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): number {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: codegen-soft-lanes.ts <ir.json> <output-dir>");
    return 1;
  }

  const ir: ZetaIrV1 = parseIrJson(readFileSync(args[0]!, "utf-8"));
  const outDir = args[1]!;
  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, "gen-soft-quantum.ts"), emitSoftQuantumTS(ir));
  writeFileSync(join(outDir, "gen-soft-bayesian.ts"), emitSoftBayesianTS(ir));
  writeFileSync(join(outDir, "gen-soft-quantum.py"), emitSoftQuantumPython(ir));
  writeFileSync(join(outDir, "gen-soft-bayesian.py"), emitSoftBayesianPython(ir));

  console.log(`[codegen-soft] emitted 4 soft-lane scripts from ${basename(args[0]!)} → ${outDir}`);
  console.log(`  gen-soft-quantum.ts   — TS AmplitudeEmu`);
  console.log(`  gen-soft-bayesian.ts  — TS SoftEmu`);
  console.log(`  gen-soft-quantum.py   — Python AmplitudeEmu`);
  console.log(`  gen-soft-bayesian.py  — Python SoftEmu`);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}

export { emitSoftQuantumTS, emitSoftBayesianTS, emitSoftQuantumPython, emitSoftBayesianPython };
