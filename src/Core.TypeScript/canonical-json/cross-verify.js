// TS reference generator for the canonical-json 4-language byte-lock (slice 8.8).
// Reads tests/cross-verification/canonical-json/vectors.json (run with cwd = that dir),
// computes the Ace canonical seam (src/Core.TypeScript/ace/canonical.ts canonicalBytes), and writes a FLAT
// ts-output.json keyed "canonical:<id>" -> canonical_json string and "invalid:<id>" -> "<rejected>".
// compare.ts then cross-checks TS + Rust (+ F#/C# when present) against the canonical vectors.
//
// This is the TS oracle (#1). It still asserts the 8.5 rigor (canonical == expected_canonical_json;
// each invalid throws with its expected_error_substring) and exits non-zero on any mismatch; the
// FLAT "<rejected>" sentinel is the cross-language reject contract (a non-TS Ace words its error
// differently — the byte-lock is the canonical string + reject-or-not). Regenerate ts-output.json
// with: `cd tests/cross-verification/canonical-json && bun ../../../src/Core.TypeScript/canonical-json/cross-verify.ts`.
import { canonicalBytes } from "../ace/canonical.js";
const vec = JSON.parse(await Bun.file("vectors.json").text());
const dec = new TextDecoder();
const out = {};
let mismatches = 0;
for (const v of vec.canonical) {
    const got = dec.decode(canonicalBytes(v.value));
    out[`canonical:${v.id}`] = got;
    if (got !== v.expected_canonical_json) {
        mismatches++;
        console.error(`canonical:${v.id} MISMATCH\n  got=${got}\n  exp=${v.expected_canonical_json}`);
    }
}
for (const v of vec.invalid) {
    let rejected = false;
    let msgOk = false;
    try {
        canonicalBytes(v.value);
    }
    catch (e) {
        rejected = true;
        msgOk = (e instanceof Error ? e.message : String(e)).includes(v.expected_error_substring);
    }
    out[`invalid:${v.id}`] = rejected ? "<rejected>" : "ACCEPTED";
    if (!rejected) {
        mismatches++;
        console.error(`invalid:${v.id} expected reject, was ACCEPTED`);
    }
    else if (!msgOk) {
        mismatches++;
        console.error(`invalid:${v.id} rejected but message lacks "${v.expected_error_substring}"`);
    }
}
await Bun.write("ts-output.json", JSON.stringify(out, null, 2) + "\n");
console.log(`canonical-json TS oracle: canonical=${vec.canonical.length} invalid=${vec.invalid.length}, ${mismatches} mismatches.`);
if (mismatches > 0)
    process.exit(1);
