// Ace revoke/quarantine mark-algebra trust-core cross-verification oracle (TS).
// Dispatches each case's op to the real applyRevoke / applyQuarantine / applyUnquarantine and
// asserts the result; writes ts-output.json; exit non-zero on any mismatch (assert-don't-skip).
// Two layers:
//   transitions — the apply produces content; assert canonicalBytes(content) == expected_canonical_json
//                 AND sha256(bytes) == expected_sha256 (composes slice 8 SHA-256 + 8.1/8.5 canonical).
//                 The content is exactly what a maintainer would then sign (8.4).
//   invalid     — the apply returns { error }; assert error contains expected_error_substring
//                 (the supersession guards: revoke-terminal, unquarantine-must-be-quarantined).
//
// Each expected value was authored by an INDEPENDENT Python re-implementation of the algebra
// (the three apply functions + withFmt: revoke-supersedes-quarantine, revoke-terminal, the
// v2-iff-marks + empty-map-strip logic, issued_at=at) + json.dumps(sort_keys) + hashlib.sha256.
// Python's algebra impl is wholly separate from registry-revoke.ts, so a match here is genuine
// cross-language agreement, not a TS-vs-TS tautology. Run from this directory: `bun cross-verify.ts`.
import { createHash } from "node:crypto";
import { applyRevoke, applyQuarantine, applyUnquarantine } from "../../../src/Core.TypeScript/ace/registry-revoke.js";
import { canonicalBytes } from "../../../src/Core.TypeScript/ace/canonical.js";
const vec = JSON.parse(await Bun.file("vectors.json").text());
function applyOp(c) {
    if (c.op === "revoke")
        return applyRevoke(c.prev, c.name, c.version, c.reason, c.at);
    if (c.op === "quarantine")
        return applyQuarantine(c.prev, c.name, c.version, c.reason, c.at);
    return applyUnquarantine(c.prev, c.name, c.version, c.at);
}
const dec = new TextDecoder();
const out = {};
let mismatches = 0;
const fail = (msg) => { mismatches++; console.error(msg); };
const sha256hex = (b) => createHash("sha256").update(b).digest("hex");
// --- transitions: real apply produces content; assert canonical bytes + sha256 ---
const tOut = {};
for (const c of vec.transitions) {
    const r = applyOp(c);
    if ("error" in r) {
        fail(`transition ${c.id}: unexpected error ${r.error}`);
        continue;
    }
    const bytes = canonicalBytes(r);
    const got = dec.decode(bytes);
    const hash = sha256hex(bytes);
    tOut[c.id] = { canonical_json: got, sha256: hash };
    if (got !== c.expected_canonical_json)
        fail(`transition ${c.id}: JSON MISMATCH\n  got=${got}\n  exp=${c.expected_canonical_json}`);
    if (hash !== c.expected_sha256)
        fail(`transition ${c.id}: sha256 MISMATCH got=${hash} exp=${c.expected_sha256}`);
}
out.transitions = tOut;
// --- invalid: real apply returns { error } containing the expected substring ---
const iOut = {};
for (const c of vec.invalid) {
    const r = applyOp(c);
    let result;
    if (!("error" in r))
        result = "ACCEPTED";
    else
        result = r.error.includes(c.expected_error_substring) ? `error:${c.expected_error_substring}` : `error:OTHER(${r.error})`;
    iOut[c.id] = result;
    if (result !== `error:${c.expected_error_substring}`)
        fail(`invalid ${c.id}: expected error containing "${c.expected_error_substring}", got ${result}`);
}
out.invalid = iOut;
await Bun.write("ts-output.json", JSON.stringify(out, null, 2) + "\n");
console.log(`revoke-quarantine cross-verify: transitions=${vec.transitions.length} invalid=${vec.invalid.length}, ${mismatches} mismatches.`);
if (mismatches > 0)
    process.exit(1);
