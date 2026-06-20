import { readFileSync } from "node:fs";

const ts = JSON.parse(readFileSync("ts-output.json", "utf8")) as Record<string, string>;
const fsExists = (() => {
  try {
    return JSON.parse(readFileSync("fsharp-output.json", "utf8")) as Record<string, string>;
  } catch {
    return null;
  }
})();
const csExists = (() => {
  try {
    return JSON.parse(readFileSync("cs-output.json", "utf8")) as Record<string, string>;
  } catch {
    return null;
  }
})();
const rustExists = (() => {
  try {
    return JSON.parse(readFileSync("rust-output.json", "utf8")) as Record<string, string>;
  } catch {
    return null;
  }
})();

// Read vectors.yaml to assert each impl's hex against the canonical expected_hex.
interface Vec {
  id: string;
  expected_hex: string;
}
const vectorFile = (Bun.YAML.parse(await Bun.file("vectors.yaml").text()) as { vectors: Vec[] })
  .vectors;
const expectedByKey = new Map<string, string>(vectorFile.map((v) => [v.id, v.expected_hex]));

let mismatches = 0;
const keys = Object.keys(ts);

console.log(`BLAKE3-256 Cross-verification across implementations:`);
console.log(`  TS:   ${keys.length} vectors`);
console.log(`  F#:   ${fsExists ? Object.keys(fsExists).length : "MISSING"} vectors`);
console.log(`  C#:   ${csExists ? Object.keys(csExists).length : "MISSING"} vectors`);
console.log(`  Rust: ${rustExists ? Object.keys(rustExists).length : "MISSING"} vectors`);

// Key-set equality: every present impl must have exactly the TS key set.
const tsKeySet = new Set(keys);
for (const [name, impl] of [
  ["F#", fsExists],
  ["C#", csExists],
  ["Rust", rustExists],
] as const) {
  if (!impl) continue;
  const implKeys = Object.keys(impl);
  for (const k of implKeys) {
    if (!tsKeySet.has(k)) {
      console.error(`Extra vector in ${name} not present in TS: ${k}`);
      mismatches++;
    }
  }
  if (implKeys.length !== keys.length) {
    console.error(`Vector count mismatch: TS=${keys.length} ${name}=${implKeys.length}`);
    mismatches++;
  }
}

// Per-key hex equality across all present impls + assert against canonical expected_hex.
for (const key of keys) {
  const tsHex = ts[key];

  // Assert TS against canonical expected_hex from vectors.yaml.
  const canonical = expectedByKey.get(key);
  if (canonical !== undefined && tsHex !== canonical) {
    console.error(`TS hex vs canonical MISMATCH ${key}: TS=${tsHex ?? "MISSING"} expected=${canonical}`);
    mismatches++;
  }

  if (fsExists) {
    const fsHex = fsExists[key];
    if (tsHex !== fsHex) {
      console.error(`Mismatch ${key}: TS=${tsHex ?? "MISSING"} F#=${fsHex ?? "MISSING"}`);
      mismatches++;
    }
    if (canonical !== undefined && fsHex !== canonical) {
      console.error(`F# hex vs canonical MISMATCH ${key}: F#=${fsHex ?? "MISSING"} expected=${canonical}`);
      mismatches++;
    }
  }
  if (csExists) {
    const csHex = csExists[key];
    if (tsHex !== csHex) {
      console.error(`Mismatch ${key}: TS=${tsHex ?? "MISSING"} C#=${csHex ?? "MISSING"}`);
      mismatches++;
    }
    if (canonical !== undefined && csHex !== canonical) {
      console.error(`C# hex vs canonical MISMATCH ${key}: C#=${csHex ?? "MISSING"} expected=${canonical}`);
      mismatches++;
    }
  }
  if (rustExists) {
    const rustHex = rustExists[key];
    if (tsHex !== rustHex) {
      console.error(`Mismatch ${key}: TS=${tsHex ?? "MISSING"} Rust=${rustHex ?? "MISSING"}`);
      mismatches++;
    }
    if (canonical !== undefined && rustHex !== canonical) {
      console.error(`Rust hex vs canonical MISMATCH ${key}: Rust=${rustHex ?? "MISSING"} expected=${canonical}`);
      mismatches++;
    }
  }
}

if (mismatches === 0) {
  console.log(`All implementations agree on ${keys.length} vectors.`);
  process.exit(0);
} else {
  console.log(`${mismatches} mismatches.`);
  process.exit(1);
}
