// Ace canonical-JSON seam trust-core cross-verification oracle (TS).
// Asserts every vector against expected values; writes ts-output.json; exit non-zero on any
// mismatch (assert-don't-skip). Two layers:
//   canonical — canonicalBytes(value) decodes to expected_canonical_json AND sha256(bytes)
//               equals expected_sha256 (composes slice 8 SHA-256 + 8.1 canonical-JSON).
//   invalid   — canonicalBytes(value) THROWS and the message contains expected_error_substring
//               (the seam's safe-integer + lone-surrogate rejection rules).
// The canonical expected_canonical_json + expected_sha256 were re-derived independently via
// Python `json.dumps(sort_keys=True, ensure_ascii=False, separators=(",",":"))` + hashlib.sha256
// at fixture-creation time — Python's JSON impl is wholly separate from Ace's canonicalJson, so a
// match here is genuine cross-language agreement, not a TS-vs-TS tautology. (Object keys are
// BMP-only so Python's code-point key sort == JS's UTF-16 code-unit sort.) Run from this
// directory: `bun cross-verify.ts`.
import { createHash } from "node:crypto";
import { canonicalBytes } from "../../../tools/ace/canonical.ts";

interface CanonVec { id: string; value: unknown; expected_canonical_json: string; expected_sha256: string; }
interface InvalidVec { id: string; value: unknown; expected_error_substring: string; }

const vec = JSON.parse(await Bun.file("vectors.json").text()) as {
  canonical: CanonVec[]; invalid: InvalidVec[];
};

const dec = new TextDecoder();
const out: Record<string, unknown> = {};
let mismatches = 0;
const fail = (msg: string): void => { mismatches++; console.error(msg); };
const sha256hex = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex");

// --- canonical layer: TS reproduces the Python-derived canonical bytes + their SHA-256 ---
const canonOut: Record<string, { canonical_json: string; sha256: string }> = {};
for (const v of vec.canonical) {
  const bytes = canonicalBytes(v.value);
  const got = dec.decode(bytes);
  const hash = sha256hex(bytes);
  canonOut[v.id] = { canonical_json: got, sha256: hash };
  if (got !== v.expected_canonical_json) fail(`canonical ${v.id}: JSON MISMATCH\n  got=${got}\n  exp=${v.expected_canonical_json}`);
  if (hash !== v.expected_sha256) fail(`canonical ${v.id}: sha256 MISMATCH got=${hash} exp=${v.expected_sha256}`);
}
out.canonical = canonOut;

// --- invalid layer: canonicalBytes MUST throw with the expected substring ---
const invalidOut: Record<string, string> = {};
for (const v of vec.invalid) {
  let result: string;
  try {
    canonicalBytes(v.value);
    result = "ACCEPTED";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    result = msg.includes(v.expected_error_substring) ? `threw:${v.expected_error_substring}` : `threw:OTHER(${msg})`;
  }
  invalidOut[v.id] = result;
  if (result !== `threw:${v.expected_error_substring}`) fail(`invalid ${v.id}: expected throw containing "${v.expected_error_substring}", got ${result}`);
}
out.invalid = invalidOut;

await Bun.write("ts-output.json", JSON.stringify(out, null, 2) + "\n");
console.log(`canonical-json cross-verify: canonical=${vec.canonical.length} invalid=${vec.invalid.length}, ${mismatches} mismatches.`);
if (mismatches > 0) process.exit(1);
