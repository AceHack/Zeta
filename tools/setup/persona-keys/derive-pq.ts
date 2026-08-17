// Crypto-agile PQ key derivation — key TYPE is a parameter, never a hardcode.
// 081KVNYZXQ608QG0R002G35565.
//
// WHAT THIS IS: the same ONE BIP-39 seed that `derive.ts` turns into the classical
// keyring (SSH/PGP/Nostr/BTC/ETH/SOL) also derives post-quantum key MATERIAL, each
// type on its own hardened HD path. Deterministic: same (mnemonic, type) -> byte-
// identical keypair.
//
// WHAT THIS IS NOT — read before citing this file as a security property:
//   • Deriving an ML-DSA-65 keypair does NOT make anything quantum-safe. Nothing in
//     this repo SIGNS or ENCAPSULATES with these keys yet. This is key material and
//     a type registry; it is not a protocol, not a rotation, and not a migration.
//   • No primitive is implemented here. Every keygen is a call into `@noble/post-
//     quantum` @0.6.1 (already a pinned root dependency, already used by
//     `src/Core.TypeScript/crypto/better-git-crypt/crypto.ts`). No lattice code is
//     hand-rolled in Zeta and none should be.
//   • "hybrid" appears in this file only as a DECLARED, UNIMPLEMENTED type. There is
//     no hybrid key here. See the OPEN MAINTAINER DECISIONS block below.
//
// THE CARDINAL REFUSAL (the load-bearing part of this file):
//   A caller that asks for a PQ key type and receives a CLASSICAL key would believe
//   it holds post-quantum protection it does not hold. That is the worst failure this
//   module could have, so it is made structurally impossible: `derivePqKey` has no
//   fallback path of any kind. An unknown type, a declared-but-unimplemented type, or
//   an experimental type all THROW. There is no branch that returns a classical key,
//   a substitute algorithm, or `undefined`.
//
// Anchors (Beacon): NIST FIPS 203 (ML-KEM, 2024) · FIPS 204 (ML-DSA, 2024) ·
// FIPS 205 (SLH-DSA, 2024) · Barbosa et al., "X-Wing: The Hybrid KEM You've Been
// Looking For" (2024) · Kerckhoffs (1883) — good crypto, not secret crypto.

import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { HDKey as ED } from "micro-key-producer/slip10.js";
import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";

/** A raw keypair as the vetted library returns it. */
export interface RawKeypair {
  readonly publicKey: Uint8Array;
  readonly secretKey: Uint8Array;
}

/** What the key type is FOR. A signer is not a KEM; conflating them is a caller bug. */
export type KeyFamily = "signature" | "kem";

/**
 * A key type's entry in the crypto-agility registry.
 *
 * `keygen` is OPTIONAL on purpose: an entry may be *declared* (so callers can
 * discover that the type exists and is spoken about) without being *implemented*.
 * The status is COMPUTED from whether `keygen` is present — see `statusOf` — so a
 * hand-edited status string can never claim an implementation that is not there.
 */
export interface KeyTypeEntry {
  /** Stable id; also the HKDF domain-separation label. */
  readonly id: string;
  readonly family: KeyFamily;
  /** The published standard/spec this type is defined by, for the Beacon register. */
  readonly standard: string;
  /** Hardened BIP-44 coin index for this type's derivation path. */
  readonly coin: number;
  /** Seed bytes the primitive's keygen consumes. Only stated where verified. */
  readonly seedLen?: number;
  /**
   * Verified output lengths, used as a POST-CONDITION after keygen so that a
   * mis-wired registry (e.g. an ml-dsa-65 row pointing at ml_dsa44) is caught
   * rather than silently serving the wrong algorithm. Only present where measured.
   */
  readonly lengths?: { readonly publicKey: number; readonly secretKey: number };
  /**
   * Unproven / experimental construction. Such a type may NEVER be a caller's sole
   * protection, so `derivePqKey` refuses it even if a `keygen` is later attached.
   * Promotion out of this flag requires real cryptanalysis, not a code change.
   */
  readonly neverSoleProtection?: boolean;
  /** Absent => declared but not implemented. Present => implemented. */
  readonly keygen?: (seed: Uint8Array) => RawKeypair;
  /** Why an entry is declared-but-unimplemented (surfaced in the refusal message). */
  readonly deferredBecause?: string;
}

export type KeyTypeStatus = "implemented" | "declared-not-implemented" | "experimental-unproven";

/**
 * Status is DERIVED, never hand-written — the registry cannot lie about what exists.
 * Experimental wins over implemented: an unproven construction is not usable here
 * regardless of whether someone wired a keygen to it.
 */
export function statusOf(entry: KeyTypeEntry): KeyTypeStatus {
  if (entry.neverSoleProtection === true) return "experimental-unproven";
  return entry.keygen === undefined ? "declared-not-implemented" : "implemented";
}

// ── OPEN MAINTAINER DECISIONS (deliberately NOT decided in code) ──────────────
// These are policy, not implementation, and they are gated on a human:
//   1. Hybrid-by-default? The work item proposes classical (+) PQ hybrid as the
//      default posture. That is a protocol decision with interop consequences; it
//      is not made here. `x-wing` is declared and unimplemented pending it.
//   2. Which SLH-DSA parameter set? FIPS 205 defines twelve (SHA2/SHAKE ×
//      128/192/256 × s/f), trading signature size against signing speed by more
//      than 2x. Picking one silently would be the wrong kind of default.
//   3. Coin index assignment. The indices below are unused by anything today, so
//      changing them is currently FREE. Once a key at one of these paths is
//      published or trusted, changing the index re-keys and is no longer free.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The crypto-agility registry. Adding a PQ type is a row here plus a vetted-library
 * keygen — never a new branch at a call site, and never a new primitive in Zeta.
 */
export const KEY_TYPE_REGISTRY: readonly KeyTypeEntry[] = [
  {
    id: "ml-dsa-65",
    family: "signature",
    standard: "NIST FIPS 204 (ML-DSA-65)",
    coin: 1120,
    seedLen: 32,
    // Measured from @noble/post-quantum@0.6.1 and cross-checked against the FIPS 204
    // published parameters for ML-DSA-65 (pk 1952 B, sk 4032 B).
    lengths: { publicKey: 1952, secretKey: 4032 },
    keygen: (seed) => ml_dsa65.keygen(seed),
  },
  {
    id: "ml-kem-768",
    family: "kem",
    standard: "NIST FIPS 203 (ML-KEM-768)",
    coin: 1121,
    seedLen: 64,
    // Measured, and cross-checked against FIPS 203 ML-KEM-768 (ek 1184 B, dk 2400 B).
    lengths: { publicKey: 1184, secretKey: 2400 },
    keygen: (seed) => ml_kem768.keygen(seed),
  },
  {
    id: "x-wing",
    family: "kem",
    standard: "X-Wing hybrid KEM (Barbosa et al. 2024) = ML-KEM-768 + X25519",
    coin: 1122,
    deferredBecause:
      "hybrid-by-default is an unresolved protocol decision (maintainer); no hybrid key is derivable until it is made",
  },
  {
    id: "slh-dsa",
    family: "signature",
    standard: "NIST FIPS 205 (SLH-DSA) — hash-based, non-lattice",
    coin: 1123,
    deferredBecause:
      "FIPS 205 defines twelve parameter sets (SHA2/SHAKE x 128/192/256 x s/f); the choice is a maintainer decision, not a default",
  },
  {
    id: "adinkra-experimental",
    family: "signature",
    standard: "IN-HOUSE, UNPROVEN — Gates adinkra doubly-even self-dual codes lineage",
    coin: 1124,
    neverSoleProtection: true,
    deferredBecause:
      "experimental-unproven: no cryptanalysis exists; may never be sole protection",
  },
];

const BY_ID = new Map(KEY_TYPE_REGISTRY.map((e) => [e.id, e]));

/** Every declared type id, in registry order. */
export function declaredKeyTypes(): readonly string[] {
  return KEY_TYPE_REGISTRY.map((e) => e.id);
}

/** Only the type ids that will actually produce a key. */
export function implementedKeyTypes(): readonly string[] {
  return KEY_TYPE_REGISTRY.filter((e) => statusOf(e) === "implemented").map((e) => e.id);
}

/** A derived PQ key. `algorithm` is what was ACTUALLY produced, not what was asked. */
export interface DerivedPqKey {
  readonly algorithm: string;
  readonly family: KeyFamily;
  readonly standard: string;
  readonly path: string;
  readonly publicKey: Uint8Array;
  readonly secretKey: Uint8Array;
}

/** Hardened path for a type, matching the classical keyring's `m/44'/<coin>'/0'/0'`. */
export function pqPath(coin: number): string {
  return `m/44'/${coin}'/0'/0'`;
}

/**
 * Expand the 32-byte hardened HD node into exactly the seed the primitive wants.
 *
 * HKDF-SHA256 (RFC 5869), domain-separated by the key type id so that two types can
 * never expand to the same bytes even if they shared a path. Note honestly: every
 * key in this keychain descends from ONE 256-bit BIP-39 seed, so the whole keyring
 * is bounded by that entropy — expansion does not create entropy and is not claimed
 * to. That is the standard BIP-32/SLIP-0010 tradeoff the classical keyring already
 * makes; it is stated here rather than left implicit.
 */
function expand(node: Uint8Array, typeId: string, len: number): Uint8Array {
  // @noble/hashes 2.x requires `info` as bytes, not a string. The label is ASCII, so
  // UTF-8 encoding is byte-stable across platforms (no locale/collation dependence).
  const info = new TextEncoder().encode(`zeta/pq/${typeId}/v1`);
  return hkdf(sha256, node, undefined, info, len);
}

/**
 * Derive a post-quantum keypair of an EXPLICITLY NAMED type from the seed phrase.
 *
 * There is no default type and no fallback. Every refusal below throws; none of them
 * returns a key of a different algorithm than the one requested.
 *
 * @throws if the mnemonic is invalid
 * @throws if `typeId` is not in the registry
 * @throws if `typeId` is declared but not implemented
 * @throws if `typeId` is experimental (never sole protection)
 * @throws if the produced key does not match the registry's verified lengths
 */
export function derivePqKey(mnemonic: string, typeId: string): DerivedPqKey {
  if (!validateMnemonic(mnemonic, wordlist)) throw new Error("invalid/empty mnemonic");

  const entry = BY_ID.get(typeId);
  if (entry === undefined) {
    throw new Error(
      `unknown key type ${JSON.stringify(typeId)}: NOT derived. ` +
        `No fallback exists — a classical key is never substituted for a requested PQ type. ` +
        `Declared types: ${declaredKeyTypes().join(", ")}. ` +
        `Implemented: ${implementedKeyTypes().join(", ")}.`,
    );
  }

  const status = statusOf(entry);
  if (status === "experimental-unproven") {
    throw new Error(
      `key type ${JSON.stringify(typeId)} is experimental-unproven and may NEVER be sole protection: NOT derived. ` +
        `${entry.deferredBecause ?? ""} Promotion requires cryptanalysis, not a code change.`,
    );
  }
  if (status === "declared-not-implemented" || entry.keygen === undefined) {
    throw new Error(
      `key type ${JSON.stringify(typeId)} is declared but NOT implemented: NOT derived. ` +
        `${entry.deferredBecause ?? ""} ` +
        `Implemented types: ${implementedKeyTypes().join(", ")}.`,
    );
  }
  if (entry.seedLen === undefined) {
    throw new Error(`key type ${JSON.stringify(typeId)} has no verified seed length: NOT derived.`);
  }

  const path = pqPath(entry.coin);
  const node = ED.fromMasterSeed(mnemonicToSeedSync(mnemonic)).derive(path).privateKey;
  const produced = entry.keygen(expand(node, entry.id, entry.seedLen));

  // Post-condition: a mis-wired registry row must not silently serve a weaker or
  // simply different algorithm under the requested name.
  if (entry.lengths !== undefined) {
    const { publicKey: wantPk, secretKey: wantSk } = entry.lengths;
    if (produced.publicKey.length !== wantPk || produced.secretKey.length !== wantSk) {
      throw new Error(
        `key type ${JSON.stringify(typeId)} produced ${produced.publicKey.length}/${produced.secretKey.length} ` +
          `bytes but ${entry.standard} requires ${wantPk}/${wantSk}: NOT returned. The registry is mis-wired.`,
      );
    }
  }

  return {
    algorithm: entry.id,
    family: entry.family,
    standard: entry.standard,
    path,
    publicKey: produced.publicKey,
    secretKey: produced.secretKey,
  };
}
