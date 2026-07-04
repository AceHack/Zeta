// Ace index-signature trust-core cross-verification oracle (TS).
// Asserts every vector against expected values; writes ts-output.json; exit non-zero on any
// mismatch (assert-don't-skip). Three layers:
//   canonical — canonicalIndexBytes(content) == expected_canonical_json (8.1 over the index shape).
//   envelope  — signIndex(content, pem) == {expected_key_id, expected_sig}; verifyIndexSignature accepts.
//   invalid   — verifyIndexSignature rejects with the expected reason.
// The envelope expected_sig + expected_key_id + the expected_canonical_json were independently
// re-derived via Python `cryptography` at fixture-creation time (sign the expected_canonical_json
// bytes -> expected_sig; sha256(SPKI-DER)[:16] -> expected_key_id), so no layer is a TS-vs-TS
// tautology. Run from this directory: `bun cross-verify.ts`.
import { createPublicKey } from "node:crypto";
import { signIndex, verifyIndexSignature, canonicalIndexBytes, type IndexSignableContent } from "../../../src/Core.TypeScript/ace/index-signature.ts";
import { type TrustEntry, type AceSignature } from "../../../src/Core.TypeScript/ace/signing.ts";

interface CanonVec { id: string; content: IndexSignableContent; expected_canonical_json: string; }
interface EnvVec { id: string; private_pem: string; content: IndexSignableContent; expected_key_id: string; expected_sig: string; expected_canonical_json: string; }
interface InvalidVec { id: string; content: IndexSignableContent; signature: { algo: string; key_id: string; sig: string }; trust: Record<string, TrustEntry>; expected_reason: string; }

const vec = JSON.parse(await Bun.file("vectors.json").text()) as {
  canonical: CanonVec[]; envelope: EnvVec[]; invalid: InvalidVec[];
};

const dec = new TextDecoder();
const out: Record<string, unknown> = {};
let mismatches = 0;
const fail = (msg: string): void => { mismatches++; console.error(msg); };

// --- canonical layer: TS reproduces the committed canonical bytes (anchored to sig by Python) ---
const canonOut: Record<string, string> = {};
for (const v of vec.canonical) {
  const got = dec.decode(canonicalIndexBytes(v.content));
  canonOut[v.id] = got;
  if (got !== v.expected_canonical_json) fail(`canonical ${v.id}: MISMATCH\n  got=${got}\n  exp=${v.expected_canonical_json}`);
}
out.canonical = canonOut;

// --- envelope layer: deterministic ed25519 sign reproduces {key_id, sig}; verify accepts ---
const envOut: Record<string, { key_id: string; sig: string; verify_ok: boolean }> = {};
for (const v of vec.envelope) {
  const sig = signIndex(v.content, v.private_pem);
  const spkiB64 = (createPublicKey(v.private_pem).export({ type: "spki", format: "der" }) as Buffer).toString("base64");
  const trust = new Map<string, TrustEntry>([[sig.key_id, { public_key: spkiB64 }]]);
  const vr = verifyIndexSignature(v.content, sig, trust);
  envOut[v.id] = { key_id: sig.key_id, sig: sig.sig, verify_ok: vr.ok };
  if (sig.key_id !== v.expected_key_id) fail(`envelope ${v.id}: key_id MISMATCH got=${sig.key_id} exp=${v.expected_key_id}`);
  if (sig.sig !== v.expected_sig) fail(`envelope ${v.id}: sig MISMATCH`);
  if (dec.decode(canonicalIndexBytes(v.content)) !== v.expected_canonical_json) fail(`envelope ${v.id}: canonical MISMATCH`);
  if (!vr.ok) fail(`envelope ${v.id}: verifyIndexSignature rejected a freshly-signed index`);
}
out.envelope = envOut;

// --- invalid layer: verify MUST reject with the expected reason ---
const invalidOut: Record<string, string> = {};
for (const v of vec.invalid) {
  const trust = new Map<string, TrustEntry>(Object.entries(v.trust));
  const vr = verifyIndexSignature(v.content, v.signature as unknown as AceSignature, trust);
  const reason = vr.ok ? "ACCEPTED" : vr.reason;
  invalidOut[v.id] = reason;
  if (reason !== v.expected_reason) fail(`invalid ${v.id}: expected reason=${v.expected_reason} got=${reason}`);
}
out.invalid = invalidOut;

await Bun.write("ts-output.json", JSON.stringify(out, null, 2) + "\n");
console.log(`index-signature cross-verify: canonical=${vec.canonical.length} envelope=${vec.envelope.length} invalid=${vec.invalid.length}, ${mismatches} mismatches.`);
if (mismatches > 0) process.exit(1);
