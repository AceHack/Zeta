// MessagePack cross-verification comparator.
// Reads the committed per-language outputs (ts-output.json, fsharp-output.json when present, etc.)
// and vectors.json, asserting that every present language's result matches the expected canonical bytes.

import { readFileSync } from "fs";

interface MsgpackVec {
  id: string;
  value: any;
  expected_msgpack: string;
}

const vec = JSON.parse(readFileSync("vectors.json", "utf8")) as {
  vectors: MsgpackVec[];
};

const expected = new Map<string, string>();
for (const v of vec.vectors) {
  expected.set(v.id, v.expected_msgpack);
}

function load(file: string): Record<string, string> | null {
  try {
    return JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
  } catch {
    return null;
  }
}

const impls: Array<[string, Record<string, string> | null]> = [
  ["TS", load("ts-output.json")],
  ["F#", load("fsharp-output.json")],
];

let mismatches = 0;
console.log("MessagePack cross-verification:");
for (const [name, impl] of impls) {
  console.log(`  ${name}: ${impl ? `${Object.keys(impl).length} results` : "MISSING"}`);
}

const tsImpl = impls[0];
if (!tsImpl || !tsImpl[1]) {
  console.error("ts-output.json MISSING — the TS reference oracle is required");
  process.exit(1);
}

for (const [name, impl] of impls) {
  if (!impl) continue;
  const keys = Object.keys(impl).sort();
  const expKeys = [...expected.keys()].sort();

  if (keys.length !== expKeys.length || keys.some((k, i) => k !== expKeys[i])) {
    console.error(`${name}: key-set does not match the canonical vectors`);
    mismatches++;
  }

  for (const [k, want] of expected) {
    if (impl[k] !== want) {
      console.error(`${name} ${k} MISMATCH: got ${impl[k] ?? "MISSING"} expected ${want}`);
      mismatches++;
    }
  }
}

if (mismatches === 0) {
  const present = impls
    .filter(([, i]) => i)
    .map(([n]) => n)
    .join("+");
  console.log(`✅ All present implementations (${present}) agree on ${expected.size} vectors.`);
  process.exit(0);
} else {
  console.log(`❌ ${mismatches} mismatches.`);
  process.exit(1);
}
