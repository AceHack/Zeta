// canonical-json 4-language byte-lock comparator (slice 8.8).
// Reads the committed per-language outputs (ts-output.json + rust-output.json, and fsharp-/cs-
// output.json when they exist) and the canonical vectors.json, and asserts that every PRESENT
// language's result equals the expected value per id AND that all present languages agree.
// Resilient to a missing language (try/catch -> null), so F#/C# can be added incrementally
// (8.8.1 / 8.8.2) without changing this file. Exit non-zero on any mismatch (assert-don't-skip).
//
// Output shape (flat, keyed "<layer>:<id>"):
//   canonical:<id> -> the canonical_json byte string  (must equal vectors.json expected_canonical_json)
//   invalid:<id>   -> "<rejected>"                     (the cross-language reject contract)
//
// The expected canonical strings were Python-authored (8.5) + TS-reproduced (8.5) + Rust-reproduced
// (8.8); cross-language agreement here is the byte-lock, not a TS-vs-TS tautology.
import { readFileSync } from "fs";
const vec = JSON.parse(readFileSync("vectors.json", "utf8"));
const expected = new Map();
for (const c of vec.canonical)
    expected.set(`canonical:${c.id}`, c.expected_canonical_json);
for (const c of vec.invalid)
    expected.set(`invalid:${c.id}`, "<rejected>");
const expKeys = [...expected.keys()].sort();
function load(file) {
    try {
        return JSON.parse(readFileSync(file, "utf8"));
    }
    catch {
        return null;
    }
}
const impls = [
    ["TS", load("ts-output.json")],
    ["Rust", load("rust-output.json")],
    ["F#", load("fsharp-output.json")],
    ["C#", load("cs-output.json")],
    ["Go", load("go-output.json")],
    ["Python", load("python-output.json")],
];
let mismatches = 0;
console.log("canonical-json cross-verification:");
for (const [name, impl] of impls)
    console.log(`  ${name}: ${impl ? `${Object.keys(impl).length} results` : "MISSING"}`);
// TS is the committed reference oracle and must be present.
if (!impls[0][1]) {
    console.error("ts-output.json MISSING — the TS reference oracle is required");
    process.exit(1);
}
// At least one non-TS oracle must be present, else the "cross-language" lock is vacuous.
if (!impls.slice(1).some(([, impl]) => impl)) {
    console.error("no non-TS oracle present — cross-language byte-lock is vacuous");
    process.exit(1);
}
for (const [name, impl] of impls) {
    if (!impl)
        continue;
    const keys = Object.keys(impl).sort();
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
    const present = impls.filter(([, i]) => i).map(([n]) => n).join("+");
    console.log(`All present implementations (${present}) agree on ${expected.size} vectors.`);
    process.exit(0);
}
else {
    console.log(`${mismatches} mismatches.`);
    process.exit(1);
}
