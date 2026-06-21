/**
 * codegen-harness.ts — Auto-generate test + benchmark harness per language from IR.
 *
 * Given a zeta-ir-v2 artifact + golden vectors, emits a complete test harness
 * in each target language that:
 * 1. Runs the generated interpreter/specialized code
 * 2. Asserts output matches the golden vectors (correctness)
 * 3. Benchmarks interpreted vs specialized (performance)
 * 4. Reports pass/fail + timing
 *
 * The harness is self-contained — one file per language that can be run standalone.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// ─── Parse ───────────────────────────────────────────────────────────────
function parseIrWithGoldens(irRaw, goldensRaw) {
    // BigInt-safe IR parsing
    const irSafe = irRaw.replace(/"k"\s*:\s*(-?\d+)/g, '"k_bigint": "$1"');
    const ir = JSON.parse(irSafe);
    // Golden vectors: { "id": "value", ... }
    const goldens = JSON.parse(goldensRaw);
    const vectors = [];
    for (const [id, expected] of Object.entries(goldens)) {
        if (id === "_source")
            continue;
        // Parse input from id: "x-0" → "0", "x-u64max" → "18446744073709551615"
        const inputStr = id.replace("x-", "");
        const input = inputStr === "u64max" ? "18446744073709551615" :
            inputStr === "golden" ? "11400714819323198485" :
                inputStr === "2pow63" ? "9223372036854775808" :
                    inputStr === "1e18" ? "1000000000000000000" :
                        inputStr;
        vectors.push({ id, input, expected });
    }
    return { generator: ir.generator, width: ir.width, ops: ir.ops, goldens: vectors };
}
// ─── Get unsigned constant ──────────────────────────────────────────────
function getK(op, width) {
    const raw = op.k_bigint ? BigInt(op.k_bigint) : BigInt(op.k ?? 0);
    return raw & ((1n << BigInt(width)) - 1n);
}
// ─── Emit TypeScript Harness ─────────────────────────────────────────────
export function emitTypeScriptHarness(cfg) {
    const mask = cfg.width === 64 ? "(1n << 64n) - 1n" : `(1n << ${cfg.width}n) - 1n`;
    const u = (e) => `(${e}) & MASK`;
    const mixBody = cfg.ops.map(op => {
        if (op.op === "mul")
            return `  z = ${u(`z * ${getK(op, cfg.width)}n`)};`;
        if (op.op === "xorshr")
            return `  z = ${u(`z ^ (z >> ${op.s}n)`)};`;
        return `  // unknown: ${op.op}`;
    }).join("\n");
    const goldenAsserts = cfg.goldens.map(g => `  assert(mix(${g.input}n) === ${g.expected}n, "${g.id}");`).join("\n");
    return `// AUTO-GENERATED HARNESS by codegen-harness.ts — ${cfg.generator}
const MASK = ${mask};

function mix(x: bigint): bigint {
  let z = x & MASK;
${mixBody}
  return z;
}

// ─── Golden Vector Test ──────────────────────────────────────────────
let pass = 0, fail = 0;
function assert(cond: boolean, id: string) {
  if (cond) { pass++; } else { fail++; console.error("FAIL:", id); }
}

${goldenAsserts}

// ─── Benchmark ───────────────────────────────────────────────────────
const N = 1_000_000;
const start = performance.now();
for (let i = 0n; i < BigInt(N); i++) mix(i);
const elapsed = performance.now() - start;

console.log(\`[${cfg.generator}] \${pass}/\${pass + fail} golden vectors PASS\`);
console.log(\`[${cfg.generator}] benchmark: \${elapsed.toFixed(1)}ms (\${N} iterations)\`);
if (fail > 0) process.exit(1);
`;
}
// ─── Emit Python Harness ─────────────────────────────────────────────────
export function emitPythonHarness(cfg) {
    const mask = cfg.width === 64 ? "(1 << 64) - 1" : `(1 << ${cfg.width}) - 1`;
    const mixBody = cfg.ops.map(op => {
        if (op.op === "mul")
            return `    z = (z * ${getK(op, cfg.width)}) & MASK`;
        if (op.op === "xorshr")
            return `    z = (z ^ (z >> ${op.s})) & MASK`;
        return `    # unknown: ${op.op}`;
    }).join("\n");
    const goldenAsserts = cfg.goldens.map(g => `    ("${g.id}", ${g.input}, ${g.expected}),`).join("\n");
    return `# AUTO-GENERATED HARNESS by codegen-harness.ts — ${cfg.generator}
import time

MASK = ${mask}

def mix(x: int) -> int:
    z = x & MASK
${mixBody}
    return z

# ─── Golden Vector Test ──────────────────────────────────────────────
vectors = [
${goldenAsserts}
]

passed = failed = 0
for vid, inp, expected in vectors:
    got = mix(inp)
    if got == expected:
        passed += 1
    else:
        failed += 1
        print(f"FAIL: {vid} got={got} expected={expected}")

# ─── Benchmark ───────────────────────────────────────────────────────
N = 1_000_000
start = time.perf_counter()
for i in range(N):
    mix(i)
elapsed = (time.perf_counter() - start) * 1000

print(f"[${cfg.generator}] {passed}/{passed + failed} golden vectors PASS")
print(f"[${cfg.generator}] benchmark: {elapsed:.1f}ms ({N} iterations)")
if failed > 0:
    exit(1)
`;
}
// ─── Emit Go Harness ─────────────────────────────────────────────────────
export function emitGoHarness(cfg) {
    const mixBody = cfg.ops.map(op => {
        if (op.op === "mul")
            return `\tz = z * ${getK(op, cfg.width)}`;
        if (op.op === "xorshr")
            return `\tz = z ^ (z >> ${op.s})`;
        return `\t// unknown: ${op.op}`;
    }).join("\n");
    const goldenTests = cfg.goldens.map(g => `\t{"${g.id}", ${g.input}, ${g.expected}},`).join("\n");
    return `// AUTO-GENERATED HARNESS by codegen-harness.ts — ${cfg.generator}
package main

import (
\t"fmt"
\t"os"
\t"time"
)

func mix(x uint64) uint64 {
\tz := x
${mixBody}
\treturn z
}

func main() {
\ttype vector struct {
\t\tid       string
\t\tinput    uint64
\t\texpected uint64
\t}
\tvectors := []vector{
${goldenTests}
\t}

\tpassed, failed := 0, 0
\tfor _, v := range vectors {
\t\tgot := mix(v.input)
\t\tif got == v.expected {
\t\t\tpassed++
\t\t} else {
\t\t\tfailed++
\t\t\tfmt.Fprintf(os.Stderr, "FAIL: %s got=%d expected=%d\\n", v.id, got, v.expected)
\t\t}
\t}

\t// Benchmark
\tN := 1_000_000
\tstart := time.Now()
\tfor i := uint64(0); i < uint64(N); i++ {
\t\tmix(i)
\t}
\telapsed := time.Since(start)

\tfmt.Printf("[${cfg.generator}] %d/%d golden vectors PASS\\n", passed, passed+failed)
\tfmt.Printf("[${cfg.generator}] benchmark: %v (%d iterations)\\n", elapsed, N)
\tif failed > 0 {
\t\tos.Exit(1)
\t}
}
`;
}
// ─── Main ────────────────────────────────────────────────────────────────
export function emitAll(cfg, outDir) {
    mkdirSync(outDir, { recursive: true });
    const files = [
        [`harness-${cfg.generator.replace(/\./g, "-")}.ts`, emitTypeScriptHarness(cfg)],
        [`harness-${cfg.generator.replace(/\./g, "-")}.py`, emitPythonHarness(cfg)],
        [`harness-${cfg.generator.replace(/\./g, "-")}.go`, emitGoHarness(cfg)],
    ];
    for (const [filename, content] of files) {
        writeFileSync(join(outDir, filename), content);
    }
    console.log(`[codegen-harness] emitted ${files.length} test harnesses from ${cfg.generator} → ${outDir}`);
    for (const [filename] of files) {
        console.log(`  ${filename}`);
    }
}
if (import.meta.main) {
    const [irPath, goldensPath, outDir] = process.argv.slice(2);
    if (!irPath || !goldensPath || !outDir) {
        console.error("Usage: bun codegen-harness.ts <ir.json> <goldens.json> <out-dir>");
        process.exit(1);
    }
    const irRaw = readFileSync(irPath, "utf-8");
    const goldensRaw = readFileSync(goldensPath, "utf-8");
    const cfg = parseIrWithGoldens(irRaw, goldensRaw);
    emitAll(cfg, outDir);
}
