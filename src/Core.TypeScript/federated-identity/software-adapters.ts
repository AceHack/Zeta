/**
 * software-adapters.ts — the adapters you can actually run and test.
 *
 * REGISTER: `toy`. Everything here is named `toy*` or `Software*` and is for
 * tests and the local demo loop only. It is not a custody guarantee and must
 * never be cited as one.
 *
 * ── WHAT IS REAL AND WHAT IS NOT ─────────────────────────────────────────────
 * The ed25519 signing IS real (`node:crypto`), which is what makes the negative
 * tests meaningful — a bad signature genuinely fails to verify rather than
 * failing a string comparison. What is NOT real is the custody: the private half
 * lives in this process's heap, so `exposureBoundary` self-reports
 * `"signer-function"`. Host root, a debugger, or a core dump reaches it.
 *
 * ── KEY MATERIAL DISCIPLINE ──────────────────────────────────────────────────
 * Every keypair here is generated fresh, in memory, at call time. Nothing is
 * read from disk, from an agent, from a keychain, or from an environment
 * variable; nothing is written anywhere; nothing is logged. No pre-existing
 * secret, PIN, password, or credential is touched by any code path in this
 * module. `toyGenerateSigner()` exists so tests have a key to sign with, and
 * those keys die with the process.
 */

import {
  createHash,
  createPublicKey,
  generateKeyPairSync,
  sign as nodeSign,
  verify as nodeVerify,
  type KeyObject,
} from "node:crypto";

import { type Result, type Signer, type SignatureVerifier, type SignerRefusal, err, ok } from "./ports.ts";

/**
 * An in-process ed25519 signer. TEST ONLY.
 *
 * The private `KeyObject` is captured in the closure and is not a property of
 * the returned object, so it is not reachable by property access, `JSON.stringify`,
 * or a structured clone of the signer. That is a narrower window than a field —
 * and it is emphatically not a hardware boundary.
 */
export function toyGenerateSigner(keyId: string): Signer {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return toySignerFromKeyObjects(keyId, publicKey, privateKey);
}

function toySignerFromKeyObjects(keyId: string, publicKey: KeyObject, privateKey: KeyObject): Signer {
  const spki = publicKey.export({ type: "spki", format: "der" }) as Buffer;
  const publicKeyB64 = spki.toString("base64");
  return {
    keyId,
    algorithm: "ed25519",
    exposureBoundary: "signer-function",
    publicKey: () => publicKeyB64,
    sign: (message: Uint8Array): Result<string, SignerRefusal> => {
      try {
        return ok(nodeSign(null, message, privateKey).toString("base64"));
      } catch (cause) {
        return err({ kind: "device-unavailable", detail: `software ed25519 sign failed: ${String(cause)}` });
      }
    },
  };
}

/** Verification needs no key custody at all — that asymmetry is the point. */
export const softwareEd25519Verifier: SignatureVerifier = {
  verify(publicKeyB64: string, message: Uint8Array, signatureB64: string): boolean {
    try {
      const key = createPublicKey({ key: Buffer.from(publicKeyB64, "base64"), format: "der", type: "spki" });
      return nodeVerify(null, message, key, Buffer.from(signatureB64, "base64"));
    } catch {
      // A malformed key or signature is a FAILED verification, never a thrown
      // exception that a caller might catch and treat as "inconclusive".
      // Unknown is not permissive.
      return false;
    }
  },
};

/** Content-address a public key, so a keyId is derived rather than asserted. */
export function keyIdOf(publicKeyB64: string): string {
  return createHash("sha256").update(publicKeyB64, "utf8").digest("hex").slice(0, 32);
}

// ── The YubiHSM adapter: an interface and an honest refusal ──────────────────

/**
 * The hardware path. It does NOT work, and this is not a stub that pretends.
 *
 * MEASURED, unauthenticated only (`yubihsm-shell -a get-device-info`, no session
 * opened, no credential handled): firmware 2.4.1, serial 39160506. Supported
 * mechanisms include `eck256` (secp256k1), `ecdsa-sha256`, and `ed25519`. There
 * is **no FROST-capable mechanism** on this device, so any design that wants
 * threshold signing in hardware does not have a home here today.
 *
 * Why it refuses rather than signs: producing a signature requires opening an
 * authenticated session, which requires an auth key and password. Handling a
 * credential is forbidden to this agent outright, and the repo's standing
 * position is that the human approves sensitive gates via biometric
 * (`memory/feedback_nothing_operator_run_only_operator_approved_via_biometric_aaron_2026_06_21.md`
 * — the agent executes setup, the human authorizes). So the honest adapter is
 * one that returns `requires-human-ceremony` from every signing call, and says
 * exactly what ceremony.
 *
 * A caller that wires this in gets a working *shape* and a loud refusal, which
 * is strictly better than a demo that appears to use hardware and does not.
 */
export function yubiHsmSignerRequiringCeremony(params: {
  readonly keyId: string;
  readonly hsmDomain: number;
  readonly algorithm: "ecdsa-sha256-p256" | "ecdsa-sha256-k256" | "ed25519";
  /** The public half CAN be read without a session, so it is an honest input. */
  readonly publicKey: string;
}): Signer {
  return {
    keyId: params.keyId,
    algorithm: params.algorithm,
    exposureBoundary: "hardware-boundary",
    publicKey: () => params.publicKey,
    sign: (): Result<string, SignerRefusal> =>
      err({
        kind: "requires-human-ceremony",
        operation: "open-authenticated-hsm-session",
        detail:
          `signing with YubiHSM key '${params.keyId}' in domain ${String(params.hsmDomain)} needs an authenticated session; ` +
          "an agent may not hold the auth credential. Aaron's biometric ceremony authorizes the session, and only then " +
          "may this adapter be replaced by one that signs.",
      }),
  };
}

/**
 * Deterministic signer for DST replay — same seed, same signature, every run.
 *
 * REGISTER: `toy`, and deliberately UNSAFE in a way you can see: the "key" is a
 * seed string and the "signature" is a hash. There is no asymmetry, so anyone
 * holding the public value can forge. It exists so a deterministic simulation
 * can replay signature-carrying flows byte-identically without an ed25519 key
 * being generated per run. Never use it for anything that matters.
 */
export function toyDeterministicSigner(keyId: string, seed: string): Signer {
  const publicKey = `toy-det:${createHash("sha256").update(seed, "utf8").digest("hex").slice(0, 32)}`;
  return {
    keyId,
    algorithm: "ed25519",
    exposureBoundary: "signer-function",
    publicKey: () => publicKey,
    sign: (message: Uint8Array) => ok(createHash("sha256").update(publicKey, "utf8").update(message).digest("base64")),
  };
}

/** The matching verifier for `toyDeterministicSigner`. Forgeable by design. */
export const toyDeterministicVerifier: SignatureVerifier = {
  verify(publicKey: string, message: Uint8Array, signature: string): boolean {
    if (!publicKey.startsWith("toy-det:")) return false;
    return createHash("sha256").update(publicKey, "utf8").update(message).digest("base64") === signature;
  },
};
