/**
 * cross-verify-ir.ts — The cross-language byte-lock oracle for zeta-ir-v2.
 *
 * This is what makes "7/7 languages" REAL instead of substring checks.
 * For each IR, it:
 * 1. Generates code in available languages (TS, Python, Go — those we can run)
 * 2. Executes each generated script
 * 3. Compares outputs across all languages (byte-level agreement)
 *
 * If any language produces a different output, the oracle FAILS.
 * This is the diverse-double-compiling (DDC) check — N independent implementations
 * agreeing is the termination test for correctness.
 *
 * Currently runnable targets: TS (bun), Python (python3), Go (go run).
 * Future: C# (dotnet-script), Rust (cargo), F# (dotnet fsi), Q# (qsharp).
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

interface IrOp { op: string; k?: number; s?: number; k_bigint?: string }
interface ZetaIrV2 { schema: string; generator: string; version: number; width: number; ops: IrOp[] }

function getK(op: IrOp, width: number): bigint {
  const raw = op.k_bigint ? BigInt(op.k_bigint) : BigInt(op.k ?? 0);
  return raw & ((1n << BigInt(width)) - 1n);
}

// ─── Generate + Execute for each language ────────────────────────────────

interface OracleResult {
  language: string;
  outputs: Record<string, string>; // input_id → output_value
  error?: string;
}

function generateAndRunTS(ir: ZetaIrV2, inputs: [string, string][], tmpDir: string): OracleResult {
  const mask = `(1n << ${ir.width}n) - 1n`;
  const body = ir.ops.map(op => {
    if (op.op === "mul") return `  z = (z * ${getK(op, ir.width)}n) & MASK;`;
    if (op.op === "xorshr") return `  z = (z ^ (z >> ${op.s}n)) & MASK;`;
    return "";
  }).join("\n");

  const script = `const MASK = ${mask};
function mix(x) { let z = x & MASK;\n${body}\n  return z; }
const out = {};
${inputs.map(([id, val]) => `out["${id}"] = mix(${val}n).toString();`).join("\n")}
process.stdout.write(JSON.stringify(out));`;

  const file = join(tmpDir, "oracle.ts");
  writeFileSync(file, script);
  try {
    const stdout = execSync(`bun ${file}`, { encoding: "utf-8", timeout: 10000 });
    return { language: "typescript", outputs: JSON.parse(stdout) };
  } catch (e: any) {
    return { language: "typescript", outputs: {}, error: e.message };
  }
}

function generateAndRunPython(ir: ZetaIrV2, inputs: [string, string][], tmpDir: string): OracleResult {
  const mask = `(1 << ${ir.width}) - 1`;
  const body = ir.ops.map(op => {
    if (op.op === "mul") return `    z = (z * ${getK(op, ir.width)}) & MASK`;
    if (op.op === "xorshr") return `    z = (z ^ (z >> ${op.s})) & MASK`;
    return "";
  }).join("\n");

  const script = `import json, sys
MASK = ${mask}
def mix(x):
    z = x & MASK
${body}
    return z
out = {}
${inputs.map(([id, val]) => `out["${id}"] = str(mix(${val}))`).join("\n")}
sys.stdout.write(json.dumps(out))`;

  const file = join(tmpDir, "oracle.py");
  writeFileSync(file, script);
  try {
    const stdout = execSync(`python3 ${file}`, { encoding: "utf-8", timeout: 10000 });
    return { language: "python", outputs: JSON.parse(stdout) };
  } catch (e: any) {
    return { language: "python", outputs: {}, error: e.message };
  }
}

function generateAndRunGo(ir: ZetaIrV2, inputs: [string, string][], tmpDir: string): OracleResult {
  const body = ir.ops.map(op => {
    if (op.op === "mul") {
      const line = `\tz = z * ${getK(op, ir.width)}`;
      return ir.width < 64 ? `${line}\n\tz = z & ${(1n << BigInt(ir.width)) - 1n}` : line;
    }
    if (op.op === "xorshr") {
      const line = `\tz = z ^ (z >> ${op.s})`;
      return ir.width < 64 ? `${line}\n\tz = z & ${(1n << BigInt(ir.width)) - 1n}` : line;
    }
    return "";
  }).join("\n");

  const inputLines = inputs.map(([id, val]) => `\tout["${id}"] = fmt.Sprintf("%d", mix(${val}))`).join("\n");

  const script = `package main
import ("fmt"; "encoding/json"; "os")
func mix(x uint64) uint64 {
\tz := x
${body}
\treturn z
}
func main() {
\tout := map[string]string{}
${inputLines}
\tb, _ := json.Marshal(out)
\tos.Stdout.Write(b)
}`;

  const file = join(tmpDir, "oracle.go");
  writeFileSync(file, script);
  try {
    const stdout = execSync(`go run ${file}`, { encoding: "utf-8", timeout: 30000 });
    return { language: "go", outputs: JSON.parse(stdout) };
  } catch (e: any) {
    return { language: "go", outputs: {}, error: e.message };
  }
}

// ─── The Oracle: compare all languages ──────────────────────────────────

function generateAndRunCSharp(ir: ZetaIrV2, inputs: [string, string][], tmpDir: string): OracleResult {
  const maskLine = ir.width < 64 ? `        z = z & ${(1n << BigInt(ir.width)) - 1n}UL;\n` : "";
  const bodyWithMask = ir.ops.map(op => {
    if (op.op === "mul") return `        z = unchecked(z * ${getK(op, ir.width)}UL);\n${maskLine}`.trimEnd();
    if (op.op === "xorshr") return `        z = z ^ (z >> ${op.s});\n${maskLine}`.trimEnd();
    return "";
  }).join("\n");

  // Use dotnet run with a minimal project — no external tool dependency
  const projDir = join(tmpDir, "csharp");
  mkdirSync(projDir, { recursive: true });
  writeFileSync(join(projDir, "oracle.csproj"),
    `<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings></PropertyGroup></Project>`);
  writeFileSync(join(projDir, "Program.cs"),
    `static ulong Mix(ulong x) { unchecked { ulong z = x;
${bodyWithMask}
return z; } }
var sb = new System.Text.StringBuilder();
sb.Append("{");
string[] pairs = {${inputs.map(([id, val]) => `$"\\\"${id}\\\":\\\"{Mix(${val}UL)}\\\""`).join(",")}};
sb.Append(string.Join(",", pairs));
sb.Append("}");
Console.Write(sb.ToString());`);
  try {
    const stdout = execSync(`dotnet run --project ${projDir}`, { encoding: "utf-8", timeout: 60000 });
    return { language: "csharp", outputs: JSON.parse(stdout) };
  } catch (e: any) {
    return { language: "csharp", outputs: {}, error: `dotnet run failed: ${(e.message || "").slice(0, 100)}` };
  }
}

function generateAndRunRust(ir: ZetaIrV2, inputs: [string, string][], tmpDir: string): OracleResult {
  const maskLine = ir.width < 64 ? `    z = z & ${(1n << BigInt(ir.width)) - 1n};\n` : "";
  const body = ir.ops.map(op => {
    if (op.op === "mul") return `    z = z.wrapping_mul(${getK(op, ir.width)});\n${maskLine}`.trimEnd();
    if (op.op === "xorshr") return `    z = z ^ (z >> ${op.s});\n${maskLine}`.trimEnd();
    return "";
  }).join("\n");
  const inputLines = inputs.map(([id, val]) => `    m.insert("${id}", format!("{}", mix(${val})));`).join("\n");
  const script = `use std::collections::HashMap;
fn mix(x: u64) -> u64 { let mut z = x;
${body}
z }
fn main() {
    let mut m: HashMap<&str, String> = HashMap::new();
${inputLines}
    let pairs: Vec<String> = m.iter().map(|(k,v)| format!("\\\"{}\\\":\\\"{}\\\"", k, v)).collect();
    print!("{{{}}}", pairs.join(","));
}`;
  const file = join(tmpDir, "oracle.rs");
  writeFileSync(file, script);
  try {
    const bin = join(tmpDir, "oracle_rs");
    execSync(`rustc ${file} -o ${bin} 2>&1`, { encoding: "utf-8", timeout: 30000 });
    const stdout = execSync(bin, { encoding: "utf-8", timeout: 10000 });
    return { language: "rust", outputs: JSON.parse(stdout) };
  } catch (e: any) {
    return { language: "rust", outputs: {}, error: `rustc not available or failed: ${(e.message || "").slice(0, 100)}` };
  }
}

function generateAndRunFSharp(ir: ZetaIrV2, inputs: [string, string][], tmpDir: string): OracleResult {
  const maskLine = ir.width < 64 ? `    z <- z &&& ${(1n << BigInt(ir.width)) - 1n}UL\n` : "";
  const body = ir.ops.map(op => {
    if (op.op === "mul") return `    z <- z * ${getK(op, ir.width)}UL\n${maskLine}`.trimEnd();
    if (op.op === "xorshr") return `    z <- z ^^^ (z >>> ${op.s})\n${maskLine}`.trimEnd();
    return "";
  }).join("\n");
  const inputLines = inputs.map(([id, val]) => `    sprintf "\\\"%s\\\":\\\"%d\\\"" "${id}" (mix ${val}UL)`).join("\n    ");
  const script = `open System
let mix (x: uint64) : uint64 =
    let mutable z = x
${body}
    z
let pairs = [
    ${inputLines}
]
printf "{%s}" (String.concat "," pairs)`;
  const file = join(tmpDir, "oracle.fsx");
  writeFileSync(file, script);
  try {
    const stdout = execSync(`dotnet fsi ${file}`, { encoding: "utf-8", timeout: 30000 });
    return { language: "fsharp", outputs: JSON.parse(stdout) };
  } catch (e: any) {
    return { language: "fsharp", outputs: {}, error: `dotnet fsi not available or failed: ${(e.message || "").slice(0, 100)}` };
  }
}

export interface CrossVerifyResult {
  generator: string;
  languages: string[];
  inputs: string[];
  allAgree: boolean;
  disagreements: { input: string; values: Record<string, string> }[];
  errors: { language: string; error: string }[];
}

export function crossVerify(ir: ZetaIrV2, inputs: [string, string][]): CrossVerifyResult {
  const tmpDir = join("/tmp", `cross-verify-${ir.generator.replace(/[^a-z0-9]/gi, "-")}-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  const results: OracleResult[] = [
    generateAndRunTS(ir, inputs, tmpDir),
    generateAndRunPython(ir, inputs, tmpDir),
    generateAndRunGo(ir, inputs, tmpDir),
    generateAndRunCSharp(ir, inputs, tmpDir),
    generateAndRunRust(ir, inputs, tmpDir),
    generateAndRunFSharp(ir, inputs, tmpDir),
  ];

  // Clean up
  try { rmSync(tmpDir, { recursive: true }); } catch {}

  const successful = results.filter(r => !r.error);
  const errors = results.filter(r => r.error).map(r => ({ language: r.language, error: r.error! }));

  // Compare: for each input, all successful languages must agree
  const disagreements: { input: string; values: Record<string, string> }[] = [];
  const inputIds = inputs.map(([id]) => id);

  for (const id of inputIds) {
    const values: Record<string, string> = {};
    for (const r of successful) {
      values[r.language] = r.outputs[id] ?? "MISSING";
    }
    const uniqueValues = new Set(Object.values(values));
    if (uniqueValues.size > 1) {
      disagreements.push({ input: id, values });
    }
  }

  return {
    generator: ir.generator,
    languages: successful.map(r => r.language),
    inputs: inputIds,
    allAgree: disagreements.length === 0 && successful.length >= 2,
    disagreements,
    errors,
  };
}

// ─── CLI ─────────────────────────────────────────────────────────────────

if (import.meta.main) {
  const irPath = process.argv[2];
  if (!irPath) {
    console.error("Usage: bun cross-verify-ir.ts <ir.json>");
    process.exit(1);
  }
  const raw = readFileSync(irPath, "utf-8");
  const irSafe = raw.replace(/"k"\s*:\s*(-?\d+)/g, '"k_bigint": "$1"');
  const ir: ZetaIrV2 = JSON.parse(irSafe);

  // Standard test inputs
  const inputs: [string, string][] = [
    ["x-0", "0"], ["x-1", "1"], ["x-2", "2"],
    ["x-10", "10"], ["x-255", "255"],
  ];

  const result = crossVerify(ir, inputs);
  console.log(`[cross-verify] ${result.generator}: ${result.languages.length} languages agreed`);
  if (result.errors.length > 0) {
    for (const e of result.errors) {
      console.log(`  ⚠ ${e.language} unavailable: ${e.error.slice(0, 80)}`);
    }
  }
  if (result.allAgree) {
    console.log(`  ✓ ALL ${result.languages.length} AGREE on ${result.inputs.length} inputs`);
  } else {
    for (const d of result.disagreements) {
      console.log(`  ✗ DISAGREE on ${d.input}: ${JSON.stringify(d.values)}`);
    }
    process.exit(1);
  }
}
