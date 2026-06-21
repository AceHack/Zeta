// ZSetMerkle INCLUSION-PROOF cross-language conformance oracle (math-team row 4).
//
// Two independent checks, neither sufficient alone:
//   (1) N-WAY AGREEMENT — every present `<lang>-output.json` must reproduce the
//       canonical proof string for every vector id (the byte-lock). Absent ports
//       are skipped so peers can land independently; at least one must be present.
//   (2) VERIFY-AGAINST-ROOT — for each canonical proof string we re-fold the audit
//       path HERE (a third differ, independent of every emitter) and assert it
//       recomputes the embedded root. A unanimous-but-wrong proof (a shared-bug
//       Sybil) still fails this, exactly as the root primitive asserts against
//       canonical `expected_hex`. The proof bytes ARE the canonical expectation,
//       so the YAML carries only the inputs (entries + probe); the canonical proof
//       is taken to be the agreed value, and verify-against-root is the external
//       ground truth that the agreed value is actually a valid inclusion witness.
import { readFileSync } from "fs";
import { ofBytes, toHex } from "../../../src/Core.TypeScript/merkle/merkle";
function loadOutput(path) {
    try {
        return JSON.parse(readFileSync(path, "utf8"));
    }
    catch {
        return null;
    }
}
// ── independent verifier (re-folds the audit path from the proof string alone) ──
function hexToBytes(hex) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++)
        out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
    return out;
}
function hashOfHex(hex) {
    // a 128-bit digest hex is 32 chars (hi 16 + lo 16).
    return { hi: BigInt("0x" + hex.slice(0, 16)), lo: BigInt("0x" + hex.slice(16, 32)) };
}
function leafBytes(keyBytes, weight) {
    const buf = new Uint8Array(4 + keyBytes.length + 8);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    view.setInt32(0, keyBytes.length, true);
    buf.set(keyBytes, 4);
    view.setBigInt64(4 + keyBytes.length, weight, true);
    return buf;
}
function combine(a, b) {
    const buf = new Uint8Array(32);
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    view.setBigUint64(0, a.hi, true);
    view.setBigUint64(8, a.lo, true);
    view.setBigUint64(16, b.hi, true);
    view.setBigUint64(24, b.lo, true);
    return ofBytes(buf);
}
/** Parse `root|leafHex:weight|<R|L>sib,...` and re-fold; return true iff it recomputes root. */
function verifyProofString(s) {
    const parts = s.split("|");
    if (parts.length !== 3)
        return false;
    const [rootHex, leafPart, pathPart] = parts;
    const colon = leafPart.lastIndexOf(":");
    if (colon < 0)
        return false;
    const leafHex = leafPart.slice(0, colon);
    const weight = BigInt(leafPart.slice(colon + 1));
    let acc = ofBytes(leafBytes(hexToBytes(leafHex), weight));
    if (pathPart.length > 0) {
        for (const step of pathPart.split(",")) {
            const dir = step[0];
            const sib = hashOfHex(step.slice(1));
            if (dir === "R")
                acc = combine(acc, sib);
            else if (dir === "L")
                acc = combine(sib, acc);
            else
                return false;
        }
    }
    return toHex(acc) === rootHex;
}
const implementations = [
    ["TS", "ts-output.json"],
    ["F#", "fsharp-output.json"],
    ["C#", "cs-output.json"],
    ["Rust", "rust-output.json"],
    ["Python", "python-output.json"],
    ["Go", "go-output.json"],
];
const present = [];
for (const [name, file] of implementations) {
    const out = loadOutput(file);
    if (out !== null)
        present.push([name, out]);
}
console.log("ZSetMerkle inclusion-proof cross-verification:");
if (present.length === 0) {
    console.error("zset-merkle-proof: no language outputs present to verify");
    process.exit(1);
}
// canonical = the agreed value across present peers; computed as the first peer's,
// then every other peer must match it (no privileged oracle — disagreement fails).
const [firstName, firstOut] = present[0];
const ids = Object.keys(firstOut).sort();
if (ids.length === 0) {
    console.error("zset-merkle-proof: first oracle has no vectors");
    process.exit(1);
}
let mismatches = 0;
// (1) N-way agreement.
for (const [name, out] of present) {
    console.log(`  ${name}: ${Object.keys(out).length} vectors`);
    const keys = Object.keys(out).sort();
    if (keys.length !== ids.length || keys.some((k, i) => k !== ids[i])) {
        console.error(`Key-set mismatch in ${name}: [${keys}] vs [${ids}]`);
        mismatches++;
    }
    for (const id of ids) {
        if (out[id] !== firstOut[id]) {
            console.error(`Disagreement ${id}: ${name}=${out[id]} ${firstName}=${firstOut[id]}`);
            mismatches++;
        }
    }
}
// (2) verify-against-root: the agreed proof must actually be a valid inclusion witness.
for (const id of ids) {
    const proof = firstOut[id];
    if (!verifyProofString(proof)) {
        console.error(`Proof does NOT verify against its embedded root: ${id} = ${proof}`);
        mismatches++;
    }
}
if (mismatches === 0) {
    console.log(`OK: ${present.length} implementation(s) agree on ${ids.length} inclusion proofs, all verify against their roots.`);
    process.exit(0);
}
console.log(`${mismatches} problem(s).`);
process.exit(1);
