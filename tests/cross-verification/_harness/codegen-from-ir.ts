/**
 * codegen-from-ir.ts — multi-language codegen from the zeta generator IR.
 *
 * Reads a zeta generator IR artifact (JSON) and emits runnable oracle scripts in
 * each target language. The generated scripts fold the IR's op list over inputs —
 * they do not hardcode the algorithm.
 *
 * This is Phase B of the gen(gen)===gen trajectory: proving the generator
 * reproduces what humans already byte-locked, by generating code that produces
 * identical golden-vector output.
 *
 * Targets: TypeScript, F#, C#, Rust, Python, Go, Q#
 *
 * Usage:
 *   bun tests/cross-verification/_harness/codegen-from-ir.ts <ir.json> <output-dir>
 *
 * ── WIDTH AND GRAMMAR ARE LOAD-BEARING (2026-08-15) ──────────────────────────
 *
 * Two defects were found by comparing this generator's output against the
 * repo's HAND-WRITTEN oracles (`ir-vs-handwritten.ts`), and both are fixed here.
 * They are recorded because each is a shape worth not repeating:
 *
 *   1. WIDTH WAS IGNORED IN 4 OF 7 LANES. `emitTypeScript`/`emitFSharp`/
 *      `emitCSharp`/`emitRust` hardcoded 64-bit words (`(1n<<64n)-1n`, `uint64`,
 *      `ulong`, `u64`) regardless of `ir.width`, while Python/Go/Q# honoured it.
 *      So `hash.fmix32` (width 32) generated FOUR lanes computing at width 64 and
 *      THREE at width 32 — mutually contradictory code from one IR. Executed:
 *      the TS lane returned 7340060871154608311 for x-1 where the hand-written
 *      fmix32 (and the committed golden) return 1364076727. The Go lane did not
 *      even compile, because the canonical input list was a fixed u64 set whose
 *      values overflow `uint32`. Invisible because the only IR this file was
 *      ever tested against is splitmix64, which is width 64.
 *
 *   2. THE "TOTAL INTERPRETER" WAS NOT TOTAL. Every emitter used the shape
 *      `if (op.op === "mul") {...} return <xorshr>` — so ANY op outside v1's
 *      two-op grammar was silently emitted as `xorshr undefined`. With v2/v3/v4
 *      in the repo (`rotl`, `add`, `xrotxor`, `xshrxor`) that is six of the nine
 *      committed IRs mis-compiled into garbage rather than rejected. Silent
 *      mis-compilation of an unknown op is the vacuity class: a generator that
 *      cannot fail on an input it does not understand is not a generator.
 *
 * The fix: one shared op grammar (v1..v4), rendered per language through an
 * explicit total switch that THROWS on an unknown op at generation time, and a
 * per-language word type derived from `ir.width`. Widths 32 and 64 are supported
 * (the two the repo uses); any other width is rejected rather than silently
 * approximated.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";

// ─── IR types ────────────────────────────────────────────────────────────────

/**
 * The union of the v1..v4 op grammar.
 *
 *   mul     k       z := z * k                (v1)
 *   xorshr  s       z := z ^ (z >>> s)        (v1)
 *   rotl    r       z := rotl(z, r)           (v2)
 *   xrotxor rs      z := z ^ rotl(z,r_i) ^ …  (v3)
 *   xshrxor ss      z := z ^ (z>>>s_i) ^ …    (v3)
 *   add     k       z := z + k                (v4)
 *
 * All arithmetic is mod 2^width.
 */
export interface IrOp {
  op: "mul" | "add" | "xorshr" | "rotl" | "xrotxor" | "xshrxor";
  k?: number | bigint;
  s?: number;
  r?: number;
  rs?: number[];
  ss?: number[];
}

export interface ZetaIrV1 {
  schema?: string;
  generator: string;
  version: number;
  width: number;
  ops: IrOp[];
}

/**
 * Parse a zeta generator IR JSON string with BigInt-safe integer handling.
 * JSON.parse loses precision on int64s; we use regex replacement to preserve them.
 */
function parseIrJson(text: string): ZetaIrV1 {
  // Replace integer values in "k": <big-number> with string form for safe parsing
  const safe = text.replace(/"k"\s*:\s*(-?\d+)/g, '"k": "$1"');
  const parsed = JSON.parse(safe) as ZetaIrV1;
  // Convert k strings back to bigint
  if (parsed.ops) {
    for (const op of parsed.ops) {
      if (op.k !== undefined) op.k = BigInt(op.k as unknown as string);
    }
  }
  return parsed;
}

// ─── Width + grammar helpers (shared by every emitter) ───────────────────────

/** Widths this generator emits correct code for. Anything else is REJECTED. */
export const SUPPORTED_WIDTHS: readonly number[] = [32, 64];

function checkWidth(width: number): number {
  if (!SUPPORTED_WIDTHS.includes(width)) {
    throw new Error(
      `codegen-from-ir: width ${String(width)} is not supported (supported: ${SUPPORTED_WIDTHS.join(", ")}). ` +
        `Refusing to emit code at a width the emitters cannot represent — a silently-approximated width is the defect this check exists to prevent.`,
    );
  }
  return width;
}

function maskOf(width: number): bigint {
  return (1n << BigInt(width)) - 1n;
}

/** The op's multiplier/addend reinterpreted as an unsigned word of `width` bits. */
function unsignedK(op: IrOp, width: number): bigint {
  if (op.k === undefined) {
    throw new Error(`codegen-from-ir: op \`${op.op}\` requires \`k\``);
  }
  return BigInt(op.k) & maskOf(width);
}

function shiftOf(op: IrOp): number {
  if (op.s === undefined) throw new Error("codegen-from-ir: op `xorshr` requires `s`");
  return op.s;
}

function rotOf(op: IrOp): number {
  if (op.r === undefined) throw new Error("codegen-from-ir: op `rotl` requires `r`");
  return op.r;
}

function rotListOf(op: IrOp): number[] {
  if (!Array.isArray(op.rs) || op.rs.length === 0) {
    throw new Error("codegen-from-ir: op `xrotxor` requires a non-empty `rs`");
  }
  return op.rs;
}

function shiftListOf(op: IrOp): number[] {
  if (!Array.isArray(op.ss) || op.ss.length === 0) {
    throw new Error("codegen-from-ir: op `xshrxor` requires a non-empty `ss`");
  }
  return op.ss;
}

/**
 * Render one op into one target language, via an explicit TOTAL switch.
 *
 * `r` supplies the six per-language fragments. An op outside the grammar throws
 * HERE, at generation time — it is never emitted as some other op. That refusal
 * is the whole point of this indirection: the previous shape (`if mul … else
 * xorshr`) turned every unknown op into a silently-wrong `xorshr`.
 */
interface OpRenderer {
  mul(k: bigint): string;
  add(k: bigint): string;
  xorshr(s: number): string;
  rotl(r: number): string;
  xrotxor(rs: number[]): string;
  xshrxor(ss: number[]): string;
}

export function renderOps(ir: ZetaIrV1, r: OpRenderer): string[] {
  const width = checkWidth(ir.width);
  return ir.ops.map((op) => {
    switch (op.op) {
      case "mul":
        return r.mul(unsignedK(op, width));
      case "add":
        return r.add(unsignedK(op, width));
      case "xorshr":
        return r.xorshr(shiftOf(op));
      case "rotl":
        return r.rotl(rotOf(op));
      case "xrotxor":
        return r.xrotxor(rotListOf(op));
      case "xshrxor":
        return r.xshrxor(shiftListOf(op));
      default: {
        const unknown: string = (op as { op: string }).op;
        throw new Error(
          `codegen-from-ir: op \`${unknown}\` is not in the v1..v4 grammar ` +
            `(mul | add | xorshr | rotl | xrotxor | xshrxor). Refusing to emit.`,
        );
      }
    }
  });
}

// ─── Canonical inputs (width-derived; shared across all targets) ─────────────
//
// These id/value pairs are chosen to coincide EXACTLY with the vector ids the
// committed hand-written oracles use at each width, so a generated lane's output
// can be diffed key-for-key against `<lang>-output.json` with no remapping.

const CANONICAL_INPUTS_64: readonly (readonly [string, string])[] = [
  ["x-0", "0"],
  ["x-1", "1"],
  ["x-2", "2"],
  ["x-10", "10"],
  ["x-255", "255"],
  ["x-u64max", "18446744073709551615"],
  ["x-golden", "11400714819323198485"],
  ["x-2pow63", "9223372036854775808"],
  ["x-12345678901234567890", "12345678901234567890"],
  ["x-1e18", "1000000000000000000"],
];

const CANONICAL_INPUTS_32: readonly (readonly [string, string])[] = [
  ["x-0", "0"],
  ["x-1", "1"],
  ["x-2", "2"],
  ["x-10", "10"],
  ["x-255", "255"],
  ["x-u32max", "4294967295"],
  ["x-0x9e3779b9", "2654435769"],
  ["x-2pow31", "2147483648"],
  ["x-3735928559", "3735928559"],
  ["x-1e9", "1000000000"],
];

/**
 * The canonical input set for a width. Every value is in range for the width —
 * feeding a u64 constant into a u32 lane is a compile error in Go and a silent
 * truncation everywhere else, which is exactly how the width defect hid.
 */
export function canonicalInputsFor(width: number): [string, string][] {
  checkWidth(width);
  const base = width === 32 ? CANONICAL_INPUTS_32 : CANONICAL_INPUTS_64;
  return base.map(([id, v]) => [id, v] as [string, string]);
}

type Inputs = readonly (readonly [string, string])[];

function inputsFor(ir: ZetaIrV1, inputs?: Inputs): Inputs {
  return inputs ?? canonicalInputsFor(ir.width);
}

// ─── Code generators ─────────────────────────────────────────────────────────

function emitTypeScript(ir: ZetaIrV1, inputs?: Inputs): string {
  const width = checkWidth(ir.width);
  const ins = inputsFor(ir, inputs);
  // Keep the IR as DATA in the emitted program (the homoiconic property this
  // file's trajectory depends on): serialise the ops and fold them at runtime.
  const opsLiteral = ir.ops
    .map((op) => {
      switch (op.op) {
        case "mul":
          return `{ op: "mul", k: "${unsignedK(op, width).toString()}" }`;
        case "add":
          return `{ op: "add", k: "${unsignedK(op, width).toString()}" }`;
        case "xorshr":
          return `{ op: "xorshr", s: ${String(shiftOf(op))} }`;
        case "rotl":
          return `{ op: "rotl", r: ${String(rotOf(op))} }`;
        case "xrotxor":
          return `{ op: "xrotxor", rs: [${rotListOf(op).join(", ")}] }`;
        case "xshrxor":
          return `{ op: "xshrxor", ss: [${shiftListOf(op).join(", ")}] }`;
        default: {
          const unknown: string = (op as { op: string }).op;
          throw new Error(`codegen-from-ir: op \`${unknown}\` is not in the v1..v4 grammar. Refusing to emit.`);
        }
      }
    })
    .join(", ");

  return `// GENERATED by codegen-from-ir.ts — DO NOT EDIT
// IR-driven total interpreter for ${ir.generator} (width=${String(width)})
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

const W = ${String(width)}n;
const MASK = (1n << W) - 1n;
const uw = (x: bigint): bigint => x & MASK;
const rotl = (x: bigint, r: bigint): bigint => {
  const k = r % W;
  return k === 0n ? uw(x) : uw((x << k) | (uw(x) >> (W - k)));
};

const OPS: readonly { op: string; k?: string; s?: number; r?: number; rs?: number[]; ss?: number[] }[] = [${opsLiteral}];

function mix(x: bigint): bigint {
  return OPS.reduce((z: bigint, step) => {
    switch (step.op) {
      case "mul":
        return uw(z * BigInt(step.k as string));
      case "add":
        return uw(z + BigInt(step.k as string));
      case "xorshr":
        return uw(z ^ (z >> BigInt(step.s as number)));
      case "rotl":
        return rotl(z, BigInt(step.r as number));
      case "xrotxor":
        return uw((step.rs as number[]).reduce((a, r) => a ^ rotl(z, BigInt(r)), z));
      case "xshrxor":
        return uw((step.ss as number[]).reduce((a, s) => a ^ (z >> BigInt(s)), z));
      default:
        throw new Error(\`unknown op: \${step.op}\`);
    }
  }, uw(x));
}

const inputs: [string, string][] = ${JSON.stringify(ins)};
const out: Record<string, string> = { _source: "generated-from-ir" };
for (const [id, x] of inputs) out[id] = mix(BigInt(x)).toString();

const target = join(dirname(import.meta.dir), "ts-output.json");
writeFileSync(target, JSON.stringify(out, null, 2) + "\\n");
console.log("wrote ts-output.json (generated-from-ir)");
`;
}

function emitFSharp(ir: ZetaIrV1, inputs?: Inputs): string {
  const width = checkWidth(ir.width);
  const ins = inputsFor(ir, inputs);
  const ty = width === 32 ? "uint32" : "uint64";
  const suf = width === 32 ? "u" : "UL";
  const w = String(width);
  const steps = renderOps(ir, {
    mul: (k) => `    z <- z * ${k.toString()}${suf}`,
    add: (k) => `    z <- z + ${k.toString()}${suf}`,
    xorshr: (s) => `    z <- z ^^^ (z >>> ${String(s)})`,
    rotl: (r) => `    z <- rotl z ${String(r)}`,
    xrotxor: (rs) => `    z <- ${rs.map((r) => `rotl z ${String(r)}`).reduce((a, b) => `${a} ^^^ ${b}`, "z")}`,
    xshrxor: (ss) => `    z <- ${ss.map((s) => `(z >>> ${String(s)})`).reduce((a, b) => `${a} ^^^ ${b}`, "z")}`,
  });

  return `// GENERATED by codegen-from-ir.ts — DO NOT EDIT
// IR-driven total interpreter for ${ir.generator} (width=${w})
open System.IO
open System.Text

let inline rotl (x: ${ty}) (r: int) : ${ty} =
    let k = r % ${w}
    if k = 0 then x else (x <<< k) ||| (x >>> (${w} - k))

let mix (x: ${ty}) : ${ty} =
    let mutable z = x
${steps.join("\n")}
    z

let inputs =
    [ ${ins.map(([id, x]) => `"${id}", ${x}${suf}`).join("\n      ")} ]

let sb = StringBuilder()
sb.AppendLine("{") |> ignore
sb.AppendLine("  \\"_source\\": \\"generated-from-ir\\",") |> ignore
inputs
|> List.iteri (fun i (id, x) ->
    let comma = if i < inputs.Length - 1 then "," else ""
    sb.AppendLine(sprintf "  \\"%s\\": \\"%d\\"%s" id (mix x) comma) |> ignore)
sb.AppendLine("}") |> ignore

let here = __SOURCE_DIRECTORY__
let target = Path.Combine(Path.GetDirectoryName(here), "fsharp-output.json")
File.WriteAllText(target, sb.ToString())
printfn "wrote fsharp-output.json (generated-from-ir)"
`;
}

function emitCSharp(ir: ZetaIrV1, inputs?: Inputs): string {
  const width = checkWidth(ir.width);
  const ins = inputsFor(ir, inputs);
  const ty = width === 32 ? "uint" : "ulong";
  const suf = width === 32 ? "U" : "UL";
  const w = String(width);
  const hex = (k: bigint) => `0x${k.toString(16).toUpperCase()}${suf}`;
  const steps = renderOps(ir, {
    mul: (k) => `        z = z * ${hex(k)};`,
    add: (k) => `        z = z + ${hex(k)};`,
    xorshr: (s) => `        z = z ^ (z >> ${String(s)});`,
    rotl: (r) => `        z = Rotl(z, ${String(r)});`,
    xrotxor: (rs) => `        z = ${rs.map((r) => `Rotl(z, ${String(r)})`).reduce((a, b) => `${a} ^ ${b}`, "z")};`,
    xshrxor: (ss) => `        z = ${ss.map((s) => `(z >> ${String(s)})`).reduce((a, b) => `${a} ^ ${b}`, "z")};`,
  });

  return `// GENERATED by codegen-from-ir.ts — DO NOT EDIT
// IR-driven total interpreter for ${ir.generator} (width=${w})
using System;
using System.IO;
using System.Text;

static ${ty} Rotl(${ty} x, int r)
{
    unchecked
    {
        var k = r % ${w};
        return k == 0 ? x : (${ty})((x << k) | (x >> (${w} - k)));
    }
}

static ${ty} Mix(${ty} x)
{
    unchecked
    {
        ${ty} z = x;
${steps.join("\n")}
        return z;
    }
}

var inputs = new (string Id, ${ty} X)[]
{
${ins.map(([id, x]) => `    ("${id}", ${x}${suf}),`).join("\n")}
};

var sb = new StringBuilder();
sb.AppendLine("{");
sb.AppendLine("  \\"_source\\": \\"generated-from-ir\\",");
for (int i = 0; i < inputs.Length; i++)
{
    var (id, x) = inputs[i];
    var comma = i < inputs.Length - 1 ? "," : "";
    sb.AppendLine($"  \\"{id}\\": \\"{Mix(x)}\\"{comma}");
}
sb.AppendLine("}");

var here = Path.GetDirectoryName(Path.GetFullPath("gen.csx"))!;
var target = Path.Combine(Directory.GetParent(here)!.FullName, "cs-output.json");
File.WriteAllText(target, sb.ToString());
Console.WriteLine("wrote cs-output.json (generated-from-ir)");
`;
}

/**
 * The Rust per-op fragments. Extracted from `emitRust` (unchanged, character for
 * character) so `bonsai-emit.ts` can emit a byte-identical `mix` in both of its
 * arrest lanes — the difference between those lanes must be the arrest level and
 * nothing else, or the measurement is not attributable.
 */
export const RUST_OP_RENDERER: OpRenderer = {
  mul: (k) => `    z = z.wrapping_mul(0x${k.toString(16).toUpperCase()});`,
  add: (k) => `    z = z.wrapping_add(0x${k.toString(16).toUpperCase()});`,
  xorshr: (s) => `    z = z ^ (z >> ${String(s)});`,
  rotl: (r) => `    z = z.rotate_left(${String(r)});`,
  xrotxor: (rs) => `    z = ${rs.map((r) => `z.rotate_left(${String(r)})`).reduce((a, b) => `${a} ^ ${b}`, "z")};`,
  xshrxor: (ss) => `    z = ${ss.map((s) => `(z >> ${String(s)})`).reduce((a, b) => `${a} ^ ${b}`, "z")};`,
};

function emitRust(ir: ZetaIrV1, inputs?: Inputs): string {
  const width = checkWidth(ir.width);
  const ins = inputsFor(ir, inputs);
  const ty = width === 32 ? "u32" : "u64";
  const steps = renderOps(ir, RUST_OP_RENDERER);

  return `// GENERATED by codegen-from-ir.ts — DO NOT EDIT
// IR-driven total interpreter for ${ir.generator} (width=${String(width)})
use std::fs;
use std::path::Path;

fn mix(x: ${ty}) -> ${ty} {
    let mut z = x;
${steps.join("\n")}
    z
}

fn main() {
    let inputs: [(&str, ${ty}); ${String(ins.length)}] = [
${ins.map(([id, x]) => `        ("${id}", ${x}),`).join("\n")}
    ];
    let mut s = String::from("{\\n");
    s.push_str("  \\"_source\\": \\"generated-from-ir\\",\\n");
    for (i, (id, x)) in inputs.iter().enumerate() {
        let comma = if i < inputs.len() - 1 { "," } else { "" };
        s.push_str(&format!("  \\"{}\\": \\"{}\\"{}\\n", id, mix(*x), comma));
    }
    s.push_str("}\\n");
    let target = Path::new("..").join("rust-output.json");
    fs::write(target, s).expect("write rust-output.json");
    println!("wrote rust-output.json (generated-from-ir)");
}
`;
}

function emitPython(ir: ZetaIrV1, inputs?: Inputs): string {
  const width = checkWidth(ir.width);
  const ins = inputsFor(ir, inputs);
  const w = String(width);
  const steps = renderOps(ir, {
    mul: (k) => `    z = (z * ${k.toString()}) & MASK`,
    add: (k) => `    z = (z + ${k.toString()}) & MASK`,
    xorshr: (s) => `    z = (z ^ (z >> ${String(s)})) & MASK`,
    rotl: (r) => `    z = _rotl(z, ${String(r)})`,
    xrotxor: (rs) => `    z = (${rs.map((r) => `_rotl(z, ${String(r)})`).reduce((a, b) => `${a} ^ ${b}`, "z")}) & MASK`,
    xshrxor: (ss) => `    z = (${ss.map((s) => `(z >> ${String(s)})`).reduce((a, b) => `${a} ^ ${b}`, "z")}) & MASK`,
  });

  return `#!/usr/bin/env python3
# GENERATED by codegen-from-ir.ts — DO NOT EDIT
# IR-driven total interpreter for ${ir.generator} (width=${w})
import json
import os

WIDTH = ${w}
MASK = (1 << WIDTH) - 1


def _rotl(x: int, r: int) -> int:
    k = r % WIDTH
    if k == 0:
        return x & MASK
    return ((x << k) | ((x & MASK) >> (WIDTH - k))) & MASK


def mix(x: int) -> int:
    z = x & MASK
${steps.join("\n")}
    return z


INPUTS = {
${ins.map(([id, x]) => `    "${id}": ${x},`).join("\n")}
}

out = {"_source": "generated-from-ir"}
out.update({k: str(mix(v)) for k, v in INPUTS.items()})
here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(here, "python-output.json"), "w") as f:
    json.dump(out, f, indent=2)
    f.write("\\n")
print("wrote python-output.json (generated-from-ir)")
`;
}

function emitGo(ir: ZetaIrV1, inputs?: Inputs): string {
  const width = checkWidth(ir.width);
  const ins = inputsFor(ir, inputs);
  const ty = width === 32 ? "uint32" : "uint64";
  const w = String(width);
  const hex = (k: bigint) => `0x${k.toString(16).toUpperCase()}`;
  const steps = renderOps(ir, {
    mul: (k) => `\tz = z * ${hex(k)}`,
    add: (k) => `\tz = z + ${hex(k)}`,
    xorshr: (s) => `\tz = z ^ (z >> ${String(s)})`,
    rotl: (r) => `\tz = rotl(z, ${String(r)})`,
    xrotxor: (rs) => `\tz = ${rs.map((r) => `rotl(z, ${String(r)})`).reduce((a, b) => `${a} ^ ${b}`, "z")}`,
    xshrxor: (ss) => `\tz = ${ss.map((s) => `(z >> ${String(s)})`).reduce((a, b) => `${a} ^ ${b}`, "z")}`,
  });

  return `// GENERATED by codegen-from-ir.ts — DO NOT EDIT
// IR-driven total interpreter for ${ir.generator} (width=${w})
package main

import (
\t"encoding/json"
\t"fmt"
\t"os"
\t"path/filepath"
\t"strconv"
)

func rotl(x ${ty}, r uint) ${ty} {
\tk := r % ${w}
\tif k == 0 {
\t\treturn x
\t}
\treturn (x << k) | (x >> (${w} - k))
}

func mix(x ${ty}) ${ty} {
\tz := x
${steps.join("\n")}
\treturn z
}

func main() {
\tinputs := []struct {
\t\tid string
\t\tx  ${ty}
\t}{
${ins.map(([id, x]) => `\t\t{"${id}", ${x}},`).join("\n")}
\t}
\tout := map[string]string{"_source": "generated-from-ir"}
\tfor _, in := range inputs {
\t\tout[in.id] = strconv.FormatUint(uint64(mix(in.x)), 10)
\t}
\tb, err := json.MarshalIndent(out, "", "  ")
\tif err != nil {
\t\tpanic(err)
\t}
\tb = append(b, '\\n')
\tdir, _ := os.Getwd()
\ttarget := filepath.Join(filepath.Dir(dir), "go-output.json")
\tif err := os.WriteFile(target, b, 0o644); err != nil {
\t\tpanic(err)
\t}
\tfmt.Println("wrote go-output.json (generated-from-ir)")
}
`;
}

/** Reference fold, in TypeScript, used to precompute the Q# spot-check value. */
export function foldIr(ir: ZetaIrV1, x: bigint): bigint {
  const width = checkWidth(ir.width);
  const MASK = maskOf(width);
  const W = BigInt(width);
  const uw = (v: bigint): bigint => v & MASK;
  const rotl = (v: bigint, r: bigint): bigint => {
    const k = r % W;
    return k === 0n ? uw(v) : uw((v << k) | (uw(v) >> (W - k)));
  };
  let z = uw(x);
  for (const op of ir.ops) {
    switch (op.op) {
      case "mul":
        z = uw(z * unsignedK(op, width));
        break;
      case "add":
        z = uw(z + unsignedK(op, width));
        break;
      case "xorshr":
        z = uw(z ^ (z >> BigInt(shiftOf(op))));
        break;
      case "rotl":
        z = rotl(z, BigInt(rotOf(op)));
        break;
      case "xrotxor":
        z = uw(rotListOf(op).reduce((a, r) => a ^ rotl(z, BigInt(r)), z));
        break;
      case "xshrxor":
        z = uw(shiftListOf(op).reduce((a, s) => a ^ (z >> BigInt(s)), z));
        break;
      default: {
        const unknown: string = (op as { op: string }).op;
        throw new Error(`codegen-from-ir: op \`${unknown}\` is not in the v1..v4 grammar.`);
      }
    }
  }
  return z;
}

function emitQSharp(ir: ZetaIrV1): string {
  // Q# doesn't have native fixed-width wrapping — it uses BigInt (arbitrary
  // precision). We emulate wrapping by AND-masking after each op, same as Python.
  // Q# conformance tier: behavioral-equivalence (not byte-lock).
  const width = checkWidth(ir.width);
  const w = String(width);
  const mask = `0x${maskOf(width).toString(16).toUpperCase()}`;
  const steps = renderOps(ir, {
    mul: (k) => `        set z = (z * ${k.toString()}L) &&& MASK;`,
    add: (k) => `        set z = (z + ${k.toString()}L) &&& MASK;`,
    xorshr: (s) => `        set z = (z ^^^ (z >>> ${String(s)})) &&& MASK;`,
    rotl: (r) => `        set z = Rotl(z, ${String(r)}, MASK);`,
    xrotxor: (rs) =>
      `        set z = (${rs.map((r) => `Rotl(z, ${String(r)}, MASK)`).reduce((a, b) => `${a} ^^^ ${b}`, "z")}) &&& MASK;`,
    xshrxor: (ss) =>
      `        set z = (${ss.map((s) => `(z >>> ${String(s)})`).reduce((a, b) => `${a} ^^^ ${b}`, "z")}) &&& MASK;`,
  });
  const spot = foldIr(ir, 1n).toString();

  return `/// GENERATED by codegen-from-ir.ts — DO NOT EDIT
/// IR-driven total interpreter for ${ir.generator} (width=${w})
/// Conformance tier: BEHAVIORAL-EQUIVALENCE (not byte-lock — Q# execution model)

namespace Zeta.CrossVerify {
    open Microsoft.Quantum.Intrinsic;
    open Microsoft.Quantum.Math;

    /// The wrapping mask for ${w}-bit arithmetic.
    function MASK() : Int { return ${mask}L; }

    /// Rotate-left within a ${w}-bit word.
    function Rotl(x : Int, r : Int, mask : Int) : Int {
        let k = r % ${w};
        if k == 0 { return x &&& mask; }
        return ((x <<< k) ||| ((x &&& mask) >>> (${w} - k))) &&& mask;
    }

    /// Total interpreter: fold the IR ops over input x.
    function Mix(x : Int) : Int {
        let MASK = ${mask}L;
        mutable z = x &&& MASK;
${steps.join("\n")}
        return z;
    }

    /// Verification entry point — check against golden vectors.
    @EntryPoint()
    operation VerifyGolden() : Unit {
        // Spot-check: Mix(1) should equal the canonical golden
        let result = Mix(1L);
        if result == ${spot}L {
            Message("PASS: Mix(1) matches golden vector");
        } else {
            Message($"FAIL: Mix(1) = {result}, expected ${spot}");
        }
    }
}
`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): number {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: codegen-from-ir.ts <ir.json> <output-dir>");
    return 1;
  }

  const irPath = args[0]!;
  const outDir = args[1]!;

  const ir: ZetaIrV1 = parseIrJson(readFileSync(irPath, "utf-8"));

  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, "gen.ts"), emitTypeScript(ir));
  writeFileSync(join(outDir, "gen.fsx"), emitFSharp(ir));
  writeFileSync(join(outDir, "gen.csx"), emitCSharp(ir));
  writeFileSync(join(outDir, "gen.rs"), emitRust(ir));
  writeFileSync(join(outDir, "gen.py"), emitPython(ir));
  writeFileSync(join(outDir, "gen.go"), emitGo(ir));
  writeFileSync(join(outDir, "gen.qs"), emitQSharp(ir));

  console.log(
    `[codegen] emitted 7 oracle scripts from ${basename(irPath)} → ${outDir} (width=${String(ir.width)})`,
  );
  console.log(`  gen.ts  — TypeScript (BigInt masked to width)`);
  console.log(`  gen.fsx — F# (native unsigned word)`);
  console.log(`  gen.csx — C# (unchecked unsigned word)`);
  console.log(`  gen.rs  — Rust (wrapping_* / rotate_left)`);
  console.log(`  gen.py  — Python (int masking)`);
  console.log(`  gen.go  — Go (native unsigned word)`);
  console.log(`  gen.qs  — Q# (Int masking, behavioral-equiv)`);
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}

export { emitTypeScript, emitFSharp, emitCSharp, emitRust, emitPython, emitGo, emitQSharp, parseIrJson };
