import { describe, expect, test } from "bun:test";
import { generateKeyPairSync } from "node:crypto";
import {
  generateKeypair, keyId, canonicalManifestBytes, signManifest, verifySignature,
  type TrustEntry,
  publicKeyInfoFromPrivatePem,
} from "./signing.ts";
import { signIndex, verifyIndexSignature } from "./index-signature.ts";
import type { AceManifest } from "./store.ts";

function baseManifest(overrides: Partial<AceManifest> = {}): AceManifest {
  return { format_version: 1, name: "demo", version: "1.0.0", content_hash: "blake3:abc", ...overrides };
}

describe("keyId", () => {
  test("is ed25519:<16 hex> and deterministic for the same SPKI", () => {
    const { publicSpkiB64 } = generateKeypair();
    const a = keyId(publicSpkiB64);
    const b = keyId(publicSpkiB64);
    expect(a).toBe(b);
    expect(a).toMatch(/^ed25519:[0-9a-f]{16}$/);
  });
});

describe("canonicalManifestBytes", () => {
  test("is identical regardless of input key order and excludes signature", () => {
    const m1 = { format_version: 1, name: "x", version: "1", content_hash: "h" } as AceManifest;
    const m2 = { content_hash: "h", version: "1", name: "x", format_version: 1 } as AceManifest;
    expect(Buffer.from(canonicalManifestBytes(m1))).toEqual(Buffer.from(canonicalManifestBytes(m2)));
    const signed = { ...m1, signature: { algo: "ed25519", key_id: "k", sig: "s" } } as AceManifest;
    expect(Buffer.from(canonicalManifestBytes(signed))).toEqual(Buffer.from(canonicalManifestBytes(m1)));
  });
});

describe("sign + verify", () => {
  test("roundtrip: a manifest signed by a trusted key verifies ok", () => {
    const kp = generateKeypair();
    const m = baseManifest();
    const sig = signManifest(m, kp.privatePem);
    const signed = { ...m, signature: sig };
    const trust: Map<string, TrustEntry> = new Map([[kp.keyId, { public_key: kp.publicSpkiB64, label: "me" }]]);
    const r = verifySignature(signed, trust);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.key_id).toBe(kp.keyId); expect(r.label).toBe("me"); }
  });

  test("tampered content_hash -> bad-signature", () => {
    const kp = generateKeypair();
    const m = baseManifest();
    const signed = { ...m, signature: signManifest(m, kp.privatePem), content_hash: "blake3:TAMPERED" } as AceManifest;
    const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    const r = verifySignature(signed, trust);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad-signature");
  });

  test("tampered ARBITRARY field -> bad-signature (whole-manifest coverage, not an allowlist)", () => {
    const kp = generateKeypair();
    const m = baseManifest({ description: "orig" });
    const signed = { ...m, signature: signManifest(m, kp.privatePem), description: "EVIL" } as AceManifest;
    const trust = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    const r = verifySignature(signed, trust);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("bad-signature");
  });

  test("untrusted key -> untrusted-key", () => {
    const kp = generateKeypair();
    const m = baseManifest();
    const signed = { ...m, signature: signManifest(m, kp.privatePem) };
    const r = verifySignature(signed, new Map()); // empty trust store
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("untrusted-key");
  });

  test("no signature -> no-signature", () => {
    const r = verifySignature(baseManifest(), new Map());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("no-signature");
  });

  test("tampered signature.algo -> unsupported-algo (algorithm-confusion / alg:none)", () => {
    const kp = generateKeypair();
    const m = baseManifest();
    const sig = signManifest(m, kp.privatePem);
    // Mutate algo to "none" on an otherwise validly-signed manifest
    const signed = { ...m, signature: { ...sig, algo: "none" as "ed25519" } };
    const trust: Map<string, TrustEntry> = new Map([[kp.keyId, { public_key: kp.publicSpkiB64 }]]);
    const r = verifySignature(signed, trust);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("unsupported-algo");
  });
});

describe("publicKeyInfoFromPrivatePem", () => {
  test("derives the same keyId + public_key as generateKeypair for the same key", () => {
    const kp = generateKeypair();
    const info = publicKeyInfoFromPrivatePem(kp.privatePem);
    expect(info.keyId).toBe(kp.keyId);
    expect(info.public_key).toBe(kp.publicSpkiB64);
  });
  test("the derived public_key verifies an index this key signed", () => {
    const kp = generateKeypair();
    const content = { format_version: 1 as const, sequence: 1, issued_at: "2026-06-01T12:00:00Z",
      packages: { leaf: { "1.0.0": { url: "https://x/l.json", package_hash: "blake3:aa" } } } };
    const sig = signIndex(content, kp.privatePem);
    const info = publicKeyInfoFromPrivatePem(kp.privatePem);
    const trust = new Map([[info.keyId, { public_key: info.public_key }]]);
    expect(verifyIndexSignature(content, sig, trust).ok).toBe(true);
  });
  test("throws for a non-ed25519 key", () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const rsaPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    expect(() => publicKeyInfoFromPrivatePem(rsaPem)).toThrow(/ed25519/);
  });
});
