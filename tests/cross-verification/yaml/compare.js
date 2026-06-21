import { readFileSync } from "fs";
function load(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    }
    catch {
        return null;
    }
}
const ts = load("ts-output.json");
if (!ts) {
    console.error("ts-output.json missing — run the TS cross-verify first.");
    process.exit(1);
}
const fsImpl = load("fsharp-output.json");
const csImpl = load("cs-output.json");
const rustImpl = load("rust-output.json");
const goImpl = load("go-output.json");
const pythonImpl = load("python-output.json");
const fixture = JSON.parse(readFileSync("vectors.json", "utf8"));
const expectedById = new Map(fixture.vectors.map((v) => [v.id, v.expected]));
let mismatches = 0;
const keys = Object.keys(ts);
console.log(`Cross-verification across implementations:`);
console.log(`  TS:     ${keys.length} vectors`);
console.log(`  F#:     ${fsImpl ? Object.keys(fsImpl).length : "MISSING"} vectors`);
console.log(`  C#:     ${csImpl ? Object.keys(csImpl).length : "MISSING"} vectors`);
console.log(`  Rust:   ${rustImpl ? Object.keys(rustImpl).length : "MISSING"} vectors`);
console.log(`  Go:     ${goImpl ? Object.keys(goImpl).length : "MISSING"} vectors`);
console.log(`  Python: ${pythonImpl ? Object.keys(pythonImpl).length : "MISSING"} vectors`);
// Key-set equality — an EXTRA or renamed vector in another impl is drift and must fail
// (mirrors the zeta-id compare guard).
const tsKeySet = new Set(keys);
for (const [name, impl] of [
    ["F#", fsImpl],
    ["C#", csImpl],
    ["Rust", rustImpl],
    ["Go", goImpl],
    ["Python", pythonImpl],
]) {
    if (!impl)
        continue;
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
    const tsEvents = ts[key];
    // TS must match the fixture's expected (the reference truth).
    const expected = expectedById.get(key);
    if (!expected) {
        console.error(`No fixture 'expected' for vector ${key}`);
        mismatches++;
    }
    else if (!Bun.deepEquals(tsEvents, expected)) {
        console.error(`Mismatch ${key}: TS events != fixture expected`);
        mismatches++;
    }
    for (const [name, impl] of [
        ["F#", fsImpl],
        ["C#", csImpl],
        ["Rust", rustImpl],
        ["Go", goImpl],
        ["Python", pythonImpl],
    ]) {
        if (!impl)
            continue;
        const implEvents = impl[key];
        if (implEvents === undefined) {
            console.error(`Mismatch ${key}: ${name}=MISSING`);
            mismatches++;
            continue;
        }
        if (!Bun.deepEquals(tsEvents, implEvents)) {
            console.error(`Mismatch ${key}: TS != ${name}`);
            mismatches++;
        }
    }
}
if (mismatches === 0) {
    console.log(`✅ All implementations agree on ${keys.length} vectors.`);
    process.exit(0);
}
else {
    console.log(`❌ ${mismatches} mismatches.`);
    process.exit(1);
}
