import { readFileSync } from "fs";

const ts = JSON.parse(readFileSync("ts-output.json", "utf8"));
const fsExists = (() => {
  try {
    return JSON.parse(readFileSync("fsharp-output.json", "utf8"));
  } catch {
    return null;
  }
})();
const csExists = (() => {
  try {
    return JSON.parse(readFileSync("cs-output.json", "utf8"));
  } catch {
    return null;
  }
})();
const rustExists = (() => {
  try {
    return JSON.parse(readFileSync("rust-output.json", "utf8"));
  } catch {
    return null;
  }
})();
const pyExists = (() => {
  try {
    return JSON.parse(readFileSync("python-output.json", "utf8"));
  } catch {
    return null;
  }
})();
const goExists = (() => {
  try {
    return JSON.parse(readFileSync("go-output.json", "utf8"));
  } catch {
    return null;
  }
})();

let mismatches = 0;
const keys = Object.keys(ts);

console.log(`Cross-verification across implementations:`);
console.log(`  TS:   ${keys.length} vectors`);
console.log(`  F#:   ${fsExists ? Object.keys(fsExists).length : "MISSING"} vectors`);
console.log(`  C#:   ${csExists ? Object.keys(csExists).length : "MISSING"} vectors`);
console.log(`  Rust: ${rustExists ? Object.keys(rustExists).length : "MISSING"} vectors`);
console.log(`  Py:   ${pyExists ? Object.keys(pyExists).length : "MISSING"} vectors`);
console.log(`  Go:   ${goExists ? Object.keys(goExists).length : "MISSING"} vectors`);

// Key-set equality, not just TS-key iteration (PR review 2026-06-01): the per-key
// loop below catches a vector MISSING from another impl (its hex reads undefined),
// but an EXTRA or renamed vector in another impl — drift — would slip past silently.
// Assert every present impl has exactly the TS key set.
const tsKeySet = new Set(keys);
for (const [name, impl] of [
  ["F#", fsExists],
  ["C#", csExists],
  ["Rust", rustExists],
  ["Python", pyExists],
  ["Go", goExists],
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

for (const key of keys) {
  const tsHex = typeof ts[key] === "string" ? ts[key] : ts[key].hex;
  const tsCrockford = typeof ts[key] === "string" ? undefined : ts[key].crockford;

  if (fsExists) {
    const fsHex = typeof fsExists[key] === "string" ? fsExists[key] : fsExists[key]?.hex;
    if (tsHex !== fsHex) {
      console.error(`Mismatch ${key} hex: TS=${tsHex} F#=${fsHex ?? "MISSING"}`);
      mismatches++;
    }
    const fsCrockford = fsExists[key]?.crockford;
    if (tsCrockford !== fsCrockford) {
      console.error(`Mismatch ${key} crockford: TS=${tsCrockford} F#=${fsCrockford ?? "MISSING"}`);
      mismatches++;
    }
  }
  if (csExists) {
    const csHex = typeof csExists[key] === "string" ? csExists[key] : csExists[key]?.hex;
    if (tsHex !== csHex) {
      console.error(`Mismatch ${key} hex: TS=${tsHex} C#=${csHex ?? "MISSING"}`);
      mismatches++;
    }
    const csCrockford = csExists[key]?.crockford;
    if (tsCrockford !== csCrockford) {
      console.error(`Mismatch ${key} crockford: TS=${tsCrockford} C#=${csCrockford ?? "MISSING"}`);
      mismatches++;
    }
  }
  if (rustExists) {
    const rustHex = typeof rustExists[key] === "string" ? rustExists[key] : rustExists[key]?.hex;
    if (tsHex !== rustHex) {
      console.error(`Mismatch ${key} hex: TS=${tsHex} Rust=${rustHex ?? "MISSING"}`);
      mismatches++;
    }
    const rustCrockford = rustExists[key]?.crockford;
    if (tsCrockford !== rustCrockford) {
      console.error(`Mismatch ${key} crockford: TS=${tsCrockford} Rust=${rustCrockford ?? "MISSING"}`);
      mismatches++;
    }
  }
  if (pyExists) {
    const pyHex = typeof pyExists[key] === "string" ? pyExists[key] : pyExists[key]?.hex;
    if (tsHex !== pyHex) {
      console.error(`Mismatch ${key} hex: TS=${tsHex} Py=${pyHex ?? "MISSING"}`);
      mismatches++;
    }
    const pyCrockford = pyExists[key]?.crockford;
    if (tsCrockford !== pyCrockford) {
      console.error(`Mismatch ${key} crockford: TS=${tsCrockford} Py=${pyCrockford ?? "MISSING"}`);
      mismatches++;
    }
  }
  if (goExists) {
    const goHex = typeof goExists[key] === "string" ? goExists[key] : goExists[key]?.hex;
    if (tsHex !== goHex) {
      console.error(`Mismatch ${key} hex: TS=${tsHex} Go=${goHex ?? "MISSING"}`);
      mismatches++;
    }
    const goCrockford = goExists[key]?.crockford;
    if (tsCrockford !== goCrockford) {
      console.error(`Mismatch ${key} crockford: TS=${tsCrockford} Go=${goCrockford ?? "MISSING"}`);
      mismatches++;
    }
  }
}

if (mismatches === 0) {
  console.log(`✅ All implementations agree on ${keys.length} vectors.`);
  process.exit(0);
} else {
  console.log(`❌ ${mismatches} mismatches.`);
  process.exit(1);
}
