// Ace ed25519 trust-core cross-verification oracle (TS).
// Asserts every vector against expected values; writes ts-output.json; exit non-zero on
// any mismatch (assert-don't-skip). rfc8032 = published RFC 8032 7.1 (the independent
// cross-language anchor; node:crypto must verify + deterministically reproduce each sig).
// key_id / envelope / invalid exercise the Ace surface via signing.ts's existing exports.
// Run from this directory: `bun cross-verify.ts`.
import { createPrivateKey, createPublicKey, sign as nodeSign, verify as nodeVerify } from "node:crypto";
import { keyId, signManifest, verifySignature, type TrustEntry } from "../../../src/Core.TypeScript/ace/signing.ts";

const hexToBuf = (h: string): Buffer => Buffer.from(h, "hex");
const b64url = (h: string): string => Buffer.from(h, "hex").toString("base64url");

interface RfcVec { id: string; secret_hex: string; public_hex: string; message_hex: string; signature_hex: string; }
interface KeyIdVec { id: string; public_hex: string; expected_key_id: string; }
interface EnvVec { id: string; private_pem: string; manifest: Record<string, unknown>; expected_key_id: string; expected_sig: string; }
interface InvalidVec { id: string; manifest: Record<string, unknown>; trust: Record<string, TrustEntry>; expected_reason: string; }

const vec = JSON.parse(await Bun.file("vectors.json").text()) as {
  rfc8032: RfcVec[]; key_id: KeyIdVec[]; envelope: EnvVec[]; invalid: InvalidVec[];
};

const out: Record<string, unknown> = {};
let mismatches = 0;
const fail = (msg: string): void => { mismatches++; console.error(msg); };

// --- rfc8032 layer: verify the published sig + deterministically reproduce it ---
const rfcOut: Record<string, { verified: boolean; reproduced: string }> = {};
for (const v of vec.rfc8032) {
  const priv = createPrivateKey({ key: { kty: "OKP", crv: "Ed25519", d: b64url(v.secret_hex), x: b64url(v.public_hex) }, format: "jwk" });
  const pub = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: b64url(v.public_hex) }, format: "jwk" });
  const msg = hexToBuf(v.message_hex);
  const verified = nodeVerify(null, msg, pub, hexToBuf(v.signature_hex));
  const reproduced = (nodeSign(null, msg, priv) as Buffer).toString("hex");
  rfcOut[v.id] = { verified, reproduced };
  if (!verified) fail(`rfc8032 ${v.id}: node failed to VERIFY the published signature`);
  if (reproduced !== v.signature_hex) fail(`rfc8032 ${v.id}: reproduce MISMATCH\n  got=${reproduced}\n  exp=${v.signature_hex}`);
}
out.rfc8032 = rfcOut;

// --- key_id layer: SPKI-DER -> sha256 -> ed25519:16hex ---
const keyIdOut: Record<string, string> = {};
for (const v of vec.key_id) {
  const pub = createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x: b64url(v.public_hex) }, format: "jwk" });
  const spkiB64 = (pub.export({ type: "spki", format: "der" }) as Buffer).toString("base64");
  const kid = keyId(spkiB64);
  keyIdOut[v.id] = kid;
  if (v.expected_key_id !== "" && kid !== v.expected_key_id) fail(`key_id ${v.id}: MISMATCH got=${kid} exp=${v.expected_key_id}`);
}
out.key_id = keyIdOut;

// --- envelope layer (Task 2 populates vec.envelope) ---
const envOut: Record<string, { key_id: string; sig: string; verify_ok: boolean }> = {};
for (const v of vec.envelope) {
  const sig = signManifest(v.manifest as never, v.private_pem);
  const trust = new Map<string, TrustEntry>();
  const pub = createPublicKey(v.private_pem);
  const spkiB64 = (pub.export({ type: "spki", format: "der" }) as Buffer).toString("base64");
  trust.set(sig.key_id, { public_key: spkiB64 });
  const signed = { ...v.manifest, signature: sig };
  const vr = verifySignature(signed as never, trust);
  envOut[v.id] = { key_id: sig.key_id, sig: sig.sig, verify_ok: vr.ok };
  if (v.expected_key_id !== "" && sig.key_id !== v.expected_key_id) fail(`envelope ${v.id}: key_id MISMATCH got=${sig.key_id} exp=${v.expected_key_id}`);
  if (v.expected_sig !== "" && sig.sig !== v.expected_sig) fail(`envelope ${v.id}: sig MISMATCH got=${sig.sig} exp=${v.expected_sig}`);
  if (!vr.ok) fail(`envelope ${v.id}: verifySignature rejected a freshly-signed manifest`);
}
out.envelope = envOut;

// --- invalid layer (Task 2 populates vec.invalid): verify MUST reject ---
const invalidOut: Record<string, string> = {};
for (const v of vec.invalid) {
  const trust = new Map<string, TrustEntry>(Object.entries(v.trust));
  const vr = verifySignature(v.manifest as never, trust);
  const reason = vr.ok ? "ACCEPTED" : vr.reason;
  invalidOut[v.id] = reason;
  if (reason !== v.expected_reason) fail(`invalid ${v.id}: expected reason=${v.expected_reason} got=${reason}`);
}
out.invalid = invalidOut;

await Bun.write("ts-output.json", JSON.stringify(out, null, 2) + "\n");
console.log(`ed25519 cross-verify: rfc8032=${vec.rfc8032.length} key_id=${vec.key_id.length} envelope=${vec.envelope.length} invalid=${vec.invalid.length}, ${mismatches} mismatches.`);
if (mismatches > 0) process.exit(1);
