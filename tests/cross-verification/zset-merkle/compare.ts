// compare.ts — ZSetMerkle cross-language conformance oracle.
//
// Verifies every PRESENT language output (cs/go/python/ts/fsharp/rust — read
// relative to this dir, absent ones skipped) against the CANONICAL vectors in
// vectors.yaml: each impl must produce `expected_hex` for every vector id, with
// the exact vector key-set (no missing / extra / renamed vectors). Exits non-zero
// on any mismatch. assert-don't-skip: a primitive dir with no runnable oracle is
// an unchecked primitive (cross-verify-all flags it), so this file is required.
//
// Output shape: { "<vector id>": "<hex hash>" }. Canonical source is
// vectors.yaml's `expected_hex` per id (stronger than a TS-as-reference
// cross-check — a value all impls agree on WRONGLY would still fail here).

import { readFileSync } from "fs";

// --- canonical expected hashes from vectors.yaml ---
// Line-scan (not full YAML parse): the fixture is a flat list of `- id:` /
// `expected_hex:` pairs; `id:` appears only as a vector key (entries use `key:`).
const expected: Record<string, string> = {};
{
  let currentId: string | null = null;
  for (const line of readFileSync("vectors.yaml", "utf8").split("\n")) {
    const idMatch = line.match(/^\s*-?\s*id:\s*(\S+)\s*$/);
    if (idMatch) {
      currentId = idMatch[1] ?? null;
      continue;
    }
    const hexMatch = line.match(/^\s*expected_hex:\s*"([0-9a-fA-F]+)"\s*$/);
    if (hexMatch && currentId) {
      expected[currentId] = (hexMatch[1] ?? "").toLowerCase();
      currentId = null;
    }
  }
}

const expectedKeys = Object.keys(expected);
if (expectedKeys.length === 0) {
  console.error("zset-merkle: no expected_hex vectors parsed from vectors.yaml");
  process.exit(1);
}

function loadOutput(file: string): Record<string, string> | null {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
  } catch {
    return null;
  }
}

const impls: ReadonlyArray<readonly [string, string]> = [
  ["TS", "ts-output.json"],
  ["F#", "fsharp-output.json"],
  ["C#", "cs-output.json"],
  ["Rust", "rust-output.json"],
  ["Py", "python-output.json"],
  ["Go", "go-output.json"],
];

let mismatches = 0;
let present = 0;
const expectedKeySet = new Set(expectedKeys);

console.log("ZSetMerkle cross-verification (each impl vs canonical vectors.yaml):");
for (const [name, file] of impls) {
  const out = loadOutput(file);
  if (!out) {
    console.log(`  ${name}: MISSING (skipped)`);
    continue;
  }
  present++;
  const outKeys = Object.keys(out);
  console.log(`  ${name}: ${outKeys.length} vectors`);

  for (const k of outKeys) {
    if (!expectedKeySet.has(k)) {
      console.error(`Extra vector in ${name} not in vectors.yaml: ${k}`);
      mismatches++;
    }
  }
  for (const id of expectedKeys) {
    const got = (out[id] ?? "").toLowerCase();
    if (got !== expected[id]) {
      console.error(`Mismatch ${id}: ${name}=${out[id] ?? "MISSING"} expected=${expected[id]}`);
      mismatches++;
    }
  }
}

if (present === 0) {
  console.error("zset-merkle: no language outputs present to verify");
  process.exit(1);
}

if (mismatches === 0) {
  console.log(`✅ ${present} implementation(s) agree with the canonical ${expectedKeys.length} vectors.`);
  process.exit(0);
} else {
  console.log(`❌ ${mismatches} mismatch(es).`);
  process.exit(1);
}
