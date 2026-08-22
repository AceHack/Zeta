// Pluggable FROST share storage: software file | sealed file | PKCS#11 | TPM 2.0 | declared fake.
// Monorepo tools-over-trunks: tools/setup/persona-keys/
//
// 081KWPHRNFW DoD item 5 (the L1 rung of the agent-sovereign-keys ladder, see
// docs/research/2026-08-14-agent-sovereign-keys-incremental-ladder-L0-to-L6-destruction-not-leakage.md).
//
// ============================================================================
// READ THIS BEFORE TRUSTING ANY TIER BELOW
// ============================================================================
//
// use-without-extract is NOT met by any adapter in this file, and cannot be met
// behind the extracting port. loadShare RETURNS the share scalar, so the raw
// secret necessarily lands in host RAM. Sovereignty invariant 2 says: if an
// adapter can return the share, it has failed the invariant regardless of what
// it encrypts.
//
// That fact is made unfakeable at the type level: every adapter here is an
// ExtractingFrostShareAdapter, which carries extractsScalar typed as the LITERAL
// true and usesWithoutExtract typed as the LITERAL false. An adapter that tries
// to claim otherwise does not compile.
//
// THE PORT CHANGE THAT WAS FILED HERE HAS LANDED, in frost-partial-signer.ts.
// That module has commit() and signPartial() and NO method returning a scalar,
// so it is the shape in which the invariant is reachable. Its software adapter
// still does not reach it -- it narrows the exposure window from the caller
// process to one function frame and says so in its type (exposureBoundary:
// "signer-function"). Use it for SIGNING; use this file for storage, re-seal,
// backup, and migration, which genuinely need the scalar.
//
// What the hardware tiers DO buy today is at-rest sealing: the share on disk is
// not readable without the chip. That is real and worth having (it is the
// "host root dumps a share at rest" row of the ladder threat model), and it is
// strictly less than use-without-extract. Do not conflate the two.
// ============================================================================

import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { createCipheriv, createDecipheriv, randomBytes as nodeRandomBytes } from "node:crypto";
import type { FrostCaCustodyEffects, FrostShareFileV1 } from "./frost-ca-custody.ts";
import { FROST_SHARE_SCHEMA, frostSharePath } from "./frost-ca-custody.ts";

export interface FrostShareRecord {
  readonly x: number;
  readonly secretShare: bigint;
  readonly threshold: number;
  readonly totalShares: number;
  readonly groupPublicKeyHex: string;
}

/**
 * What actually protected the share. This is the security-bearing discriminator,
 * NOT kind (which only describes the storage shape).
 *
 * The fake tier is spelled in shouting case on purpose: it appears in the adapter
 * object, in the on-disk artifact, and in the seal algorithm string, so a fake
 * share is identifiable at runtime, at rest, and in a git diff. It is not
 * distinguished by documentation.
 */
export type FrostSealTier =
  | "software-plaintext"
  | "software-sealed"
  | "INSECURE-SOFTWARE-FAKE-HSM"
  | "hardware-pkcs11"
  | "hardware-tpm2";

// ============================================================================
// THE TPM-SEALED TIER IS ALREADY A MEMBER -- WHAT WAS MISSING IS THE DIFFERENCE
// ============================================================================
//
// The question that produced this section was: "is a TPM-SEALED tier -- key sealed to
// PCR state, unsealed into host RAM to be used -- representable here?"
//
// IT IS. hardware-tpm2 is exactly that tier and always has been: createTpmSealEffects
// runs tpm2_unseal, which RETURNS THE WRAPPING KEY TO THE HOST, and the AES-GCM seal
// then happens in this process with that key in ordinary memory. So no new tier string
// was added. Adding one would have produced two spellings of one thing, an on-disk
// migration for every artifact already carrying "hardware-tpm2", and a second name for a
// distinction that is not about the STORAGE at all.
//
// WHAT WAS ACTUALLY MISSING is that the difference between that tier and the HSM-resident
// one was invisible to every consumer. Both answered true to isHardwareSealTier, both sat
// in one flat HARDWARE_SEAL_TIERS list, and the only place the gap was written down was a
// paragraph of comment further down this file. A comment is not readable by a caller.
//
// So the difference is now a TOTAL FUNCTION OF THE TIER:
//
//   | tier                        | wrapping key at rest      | wrapping key WHILE USED |
//   | hardware-pkcs11             | inside the token          | NEVER in host RAM       |
//   | hardware-tpm2               | sealed to measured boot   | IN HOST RAM             |
//   | software-sealed             | wherever the host put it  | in host RAM             |
//   | INSECURE-SOFTWARE-FAKE-HSM  | a PUBLISHED CONSTANT      | in host RAM             |
//   | software-plaintext          | there is no wrapping key  | --                      |
//
// WHICH ROW IS THE FLOOR (owner call, 2026-08-20): "for the TPM i think we can count on
// it, for the HSM we cannot, it is optional". So the availability order is the OPPOSITE of
// the strength order:
//
//   * hardware-tpm2   -- assume PRESENT on a Linux node. This is the base case, the tier
//                        most shares will actually be sealed at, and therefore the row most
//                        operators will silently believe is row 1 when it is row 2.
//   * hardware-pkcs11 -- OPTIONAL. Present only where a token or an HSM is attached.
//
// That asymmetry does not weaken the no-silent-downgrade invariant; it is why the invariant
// earns its keep. A caller declaring hardware-pkcs11 on an ordinary TPM-only node is the
// COMMON configuration, not an exotic one, so the refusal below fires in production rather
// than being a guard nobody reaches. The one outcome that must never happen is that such a
// caller is quietly handed hardware-tpm2 and told it has what it asked for.
//
// PRECISION THAT MUST NOT BE LOST, because overclaiming here would be worse than saying
// nothing: the column above is about the WRAPPING KEY, not about the FROST SHARE. The share
// scalar is in host RAM at EVERY tier in this file -- loadShare returns it, which is why
// every adapter here is an ExtractingFrostShareAdapter with usesWithoutExtract typed as the
// literal false. The operator-facing row "key during signing never in host RAM" is NOT
// achieved by hardware-pkcs11 for the share; it is achieved for the key that wraps the
// share. Two different claims; this module makes only the second.
//
// The window this makes legible is real and narrow: a host compromised AT SEAL OR UNSEAL
// TIME reads the wrapping key out of process memory under hardware-tpm2 and cannot under
// hardware-pkcs11, where C_Encrypt/C_Decrypt execute on the token. Sealing to measured boot
// defeats an offline attacker holding the disk; it does not defeat an attacker who is
// already root while the seal is open.

/**
 * Where the WRAPPING key lives while it is being used. The security-bearing property that
 * separates the two hardware tiers, stated so a caller reads it off the tier instead of
 * off a comment.
 *
 * NOT a claim about the FROST share -- see the note above.
 */
export type FrostSealKeyResidency =
  /** software-plaintext: nothing wraps the share, so there is no key to place. */
  | "no-seal-key"
  /** The fake: the key is a constant published in this repository. */
  | "host-ram-published"
  /** software-sealed: a host-supplied key, in this process for its whole life. */
  | "host-ram"
  /** hardware-tpm2: sealed to the chip at rest, RELEASED into host RAM to be used. */
  | "host-ram-at-use"
  /** hardware-pkcs11: the key is used ON the token and never crosses into host RAM. */
  | "hardware-resident";

/**
 * Total by construction. Record<FrostSealTier, ...> means a new tier does not compile
 * until someone has said where its wrapping key lives -- which is the whole mechanism. A
 * lookup table a new member could silently skip would be a comment with braces.
 */
export const SEAL_TIER_KEY_RESIDENCY: Readonly<Record<FrostSealTier, FrostSealKeyResidency>> = {
  "software-plaintext": "no-seal-key",
  "INSECURE-SOFTWARE-FAKE-HSM": "host-ram-published",
  "software-sealed": "host-ram",
  "hardware-tpm2": "host-ram-at-use",
  "hardware-pkcs11": "hardware-resident",
};

export function sealKeyResidencyOf(tier: FrostSealTier): FrostSealKeyResidency {
  return SEAL_TIER_KEY_RESIDENCY[tier];
}

/**
 * Does the wrapping key EVER enter host RAM at this tier? The one-bit form of the gap.
 *
 * true for hardware-tpm2, false for hardware-pkcs11 -- the two isHardwareSealTier cannot
 * tell apart, which is why that predicate is not the question to ask when the
 * host-compromise-at-use window is what matters. On a TPM-only node this bit IS the whole
 * security difference between what the operator believes they have and what they have.
 */
export function sealKeyEntersHostRam(tier: FrostSealTier): boolean {
  return sealKeyResidencyOf(tier) !== "hardware-resident";
}

/** Wrapping key never leaves the chip. A narrowing of FrostSealTier, so a new tier of this
 *  class cannot be added without this type being reconsidered. OPTIONAL in deployment. */
export type HsmResidentSealTier = Extract<FrostSealTier, "hardware-pkcs11">;
/** Sealed to hardware at rest, key released into host RAM to be used. The assumed floor. */
export type HostRamAtUseSealTier = Extract<FrostSealTier, "hardware-tpm2">;

export function isHsmResidentSealTier(tier: FrostSealTier): tier is HsmResidentSealTier {
  return sealKeyResidencyOf(tier) === "hardware-resident";
}

export function isHostRamAtUseSealTier(tier: FrostSealTier): tier is HostRamAtUseSealTier {
  return sealKeyResidencyOf(tier) === "host-ram-at-use";
}

/**
 * "Is this backed by a chip at all". DERIVED from the residency map rather than written
 * out, so it cannot drift from it.
 *
 * READ THE NAME NARROWLY. It answers a storage-at-rest question and deliberately does NOT
 * separate the two hardware tiers; isHsmResidentSealTier is the predicate for the
 * host-compromise-at-use question. A caller that needs the wrapping key off the host and
 * asks this one instead is exactly the silent crossing this section exists to prevent.
 */
export const HARDWARE_SEAL_TIERS: readonly FrostSealTier[] = (
  Object.keys(SEAL_TIER_KEY_RESIDENCY) as readonly FrostSealTier[]
).filter((t) => {
  const r = sealKeyResidencyOf(t);
  return r === "hardware-resident" || r === "host-ram-at-use";
});

export function isHardwareSealTier(tier: FrostSealTier): boolean {
  return HARDWARE_SEAL_TIERS.includes(tier);
}

/** Strength order over residencies. Used ONLY to phrase a refusal precisely; nothing in
 *  this file ever accepts a tier because it outranks another. Exact match or throw. */
const RESIDENCY_RANK: Readonly<Record<FrostSealKeyResidency, number>> = {
  "no-seal-key": 0,
  "host-ram-published": 1,
  "host-ram": 2,
  "host-ram-at-use": 3,
  "hardware-resident": 4,
};

export function sealKeyResidencyRank(residency: FrostSealKeyResidency): number {
  return RESIDENCY_RANK[residency];
}

/**
 * One sentence naming what a caller loses by being served `actual` where it declared
 * `required`. Exported so the storage port and the signing port phrase the same gap the
 * same way instead of each inventing wording.
 */
export function describeSealTierGap(required: FrostSealTier, actual: FrostSealTier): string {
  const rq = sealKeyResidencyOf(required);
  const ac = sealKeyResidencyOf(actual);
  const base = `declared tier "${required}" keeps its wrapping key ${rq}; served tier "${actual}" keeps it ${ac}`;
  if (rq === "hardware-resident" && ac === "host-ram-at-use") {
    return (
      `${base}. THIS IS THE HOST-COMPROMISE-AT-USE WINDOW, and on a TPM-only node it is the ` +
      "ORDINARY case rather than an exotic one: the HSM-resident tier runs the wrap on the " +
      "token so the key is never in this process, while the TPM-sealed tier unseals it INTO " +
      "host RAM to use it. An attacker who is root on this host while the seal is open reads " +
      "the key in the second case and cannot in the first. Sealing to measured boot defeats " +
      "someone holding the disk, not someone holding the host. An HSM is OPTIONAL hardware; " +
      "if this node has none, the honest outcome is this refusal, never a quiet substitution."
    );
  }
  if (sealKeyResidencyRank(ac) < sealKeyResidencyRank(rq)) {
    return `${base}. The served tier is strictly weaker on where the wrapping key lives.`;
  }
  return `${base}.`;
}

/**
 * The invariant, in one callable place: a caller that DECLARED a tier is served that tier
 * or is served an exception. Never a neighbour, never the nearest available, never the one
 * the host happens to have.
 *
 * Exact match, not rank comparison. A silent UPGRADE is refused too: the on-disk artifact
 * records the tier it was sealed at and loadShare demands equality, so an adapter handed
 * back at a different tier than the caller declared would produce artifacts the caller own
 * configuration cannot reopen. "Stronger" is not a licence to substitute either.
 */
export function assertNoSilentSealTierDowngrade(required: FrostSealTier, actual: FrostSealTier): void {
  if (required === actual) return;
  throw new Error(
    `frost-share-adapter: no-silent-downgrade violation: caller required "${required}" but ` +
      `the built adapter is "${actual}". ${describeSealTierGap(required, actual)} ` +
      "No fallback is offered -- declare a tier this host can honour, or attach the hardware.",
  );
}

/**
 * Store a participant FROST share. STORAGE ONLY -- there is no read-back here.
 *
 * The read side was split out into ExtractingFrostShareAdapter below, because reading
 * is what forfeits the invariant and a port should say so in its name.
 */
export interface FrostShareAdapter {
  /** Storage shape only. Carries NO security claim; read sealTier for that. */
  readonly kind: "software-file" | "sealed-file" | "hsm-stub";
  /** What actually protected the share. The security-bearing field. */
  readonly sealTier: FrostSealTier;
  storeShare(record: FrostShareRecord, ca: string): void;
}

/**
 * The lesser port: an adapter that will hand the share scalar back.
 *
 * Named for what it does rather than for what it stores. Everything in this file is
 * one of these, because a file-backed share must be readable to be usable. That is
 * exactly why usesWithoutExtract is the literal false here: an adapter that can return
 * the share has failed sovereignty invariant 2 regardless of what it encrypts, and the
 * type refuses to let any adapter claim otherwise.
 *
 * PREFER FrostPartialSigner (frost-partial-signer.ts) for SIGNING. This port remains
 * for the operations that genuinely need the scalar and that a signing port cannot
 * serve -- keygen write-out, re-seal at a different tier, backup, and migration -- and
 * for the software partial signer, whose constructor takes one of these precisely so
 * that its own exposure boundary is legible in its signature.
 */
export interface ExtractingFrostShareAdapter extends FrostShareAdapter {
  /** Declares the forfeit. Literal true: this is not a knob. */
  readonly extractsScalar: true;
  /** Entailed by loadShare existing. Literal false: it cannot be widened. */
  readonly usesWithoutExtract: false;
  loadShare(x: number): FrostShareRecord | null;
}

export const FROST_SEALED_SHARE_SCHEMA = "zeta-frost-share-sealed-v2" as const;
/** Pre-tier artifacts. Refused on load rather than silently read at an unknown tier. */
export const FROST_SEALED_SHARE_SCHEMA_V1 = "zeta-frost-share-sealed-v1" as const;

export interface FrostShareSealBox {
  readonly alg: string;
  readonly nonceB64: string;
  readonly ciphertextB64: string;
  readonly tagB64?: string;
}

export interface FrostShareSealEffects {
  /**
   * Software-seal key supplied by the host, keychain, or tests. A seal backend that
   * genuinely never releases key material (PKCS#11) throws here on purpose.
   */
  readonly getSealKey: () => Uint8Array;
  readonly randomBytes?: (length: number) => Uint8Array;
  /** Optional door for platform-specific sealing. Defaults to AES-256-GCM. */
  readonly seal?: (plaintext: Uint8Array, aad: Uint8Array) => FrostShareSealBox;
  readonly unseal?: (box: FrostShareSealBox, aad: Uint8Array) => Uint8Array;
  /**
   * Eager liveness check. Called once at adapter construction so an absent or
   * unusable chip fails LOUDLY and EARLY instead of at first signature. Absence of
   * this hook means there is nothing external to probe.
   */
  readonly probe?: () => void;
  /**
   * A stable identity for the token behind this backend ("label#serial"), when there is
   * one. Recorded at seal time and REQUIRED to match at load time; see
   * FrostSealedShareFileV2.sealedByToken for why an N-token roster is not a threshold
   * without it. NEVER carries key material -- a label and a serial number are printed on
   * the outside of the device.
   *
   * Absent for TPM and software backends, which have no token to name.
   */
  readonly tokenIdentity?: () => string;
  /**
   * WHAT THIS BACKEND ACTUALLY DOES WITH THE WRAPPING KEY.
   *
   * The seal tier passed to createSealedFileShareAdapter is a LABEL supplied by the
   * caller; nothing derived it from the backend. So
   * createSealedFileShareAdapter(fx, dir, ca, createTpmSealEffects(o), "hardware-pkcs11")
   * used to produce an adapter that reported hardware-pkcs11, wrote hardware-pkcs11 into
   * the artifact, and was in fact driven by tpm2_unseal with the key in host RAM. That is
   * the row-1/row-2 crossing, performed silently, by a single wrong argument.
   *
   * Declaring it here lets the factory CHECK the label against the backend instead of
   * trusting it. Optional only for the software tiers, whose residency the caller cannot
   * misrepresent as hardware: any tier in HARDWARE_SEAL_TIERS REQUIRES this field, so an
   * undeclared backend can never wear a hardware label.
   */
  readonly keyResidency?: FrostSealKeyResidency;
}

interface FrostSealedShareFileV2 {
  readonly schema: typeof FROST_SEALED_SHARE_SCHEMA;
  readonly sealTier: FrostSealTier;
  readonly ca: string;
  readonly threshold: number;
  readonly totalShares: number;
  readonly groupPublicKeyHex: string;
  readonly x: number;
  /**
   * WHICH token sealed this share (label+serial), when the backend can say.
   *
   * This is what makes an N-token roster a real threshold instead of N copies of one
   * risk. Without it, share i is opened by whatever token happens to answer at the
   * configured slot, so an operator who provisions the same wrapping key onto every
   * token -- the obvious move, since it avoids N different PINs and gives "backup" --
   * silently gets a roster where ANY ONE token opens EVERY share. That is a threshold
   * that has collapsed to 1-of-N with nothing in the artifact, the logs, or the types
   * to show it. Recording the sealing token and refusing a different one on load turns
   * "compromising one token yields one share" from an assumption into a checked fact.
   *
   * Optional because TPM and software backends have no token identity to report, and
   * because artifacts sealed before this field existed must still load. It cannot be
   * stripped to dodge the check: it is part of the AAD *and* of the in-plaintext bind
   * string, so removing or editing it fails the binding comparison on every tier,
   * including the non-AEAD PKCS#11 one.
   */
  readonly sealedByToken?: string;
  readonly sealed: FrostShareSealBox;
}

export function createSoftwareFileShareAdapter(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
): ExtractingFrostShareAdapter {
  return {
    kind: "software-file",
    sealTier: "software-plaintext",
    extractsScalar: true,
    usesWithoutExtract: false,
    loadShare(x: number): FrostShareRecord | null {
      const p = frostSharePath(sharesDir, x);
      if (!fx.exists(p)) return null;
      const body = JSON.parse(fx.readText(p)) as FrostShareFileV1;
      if (body.schema !== FROST_SHARE_SCHEMA || body.ca !== ca) return null;
      return {
        x: body.x,
        secretShare: BigInt(body.secretShare),
        threshold: body.threshold,
        totalShares: body.totalShares,
        groupPublicKeyHex: body.groupPublicKeyHex,
      };
    },
    storeShare(record: FrostShareRecord, caName: string): void {
      const body: FrostShareFileV1 = {
        schema: FROST_SHARE_SCHEMA,
        ca: caName,
        threshold: record.threshold,
        totalShares: record.totalShares,
        groupPublicKeyHex: record.groupPublicKeyHex,
        x: record.x,
        secretShare: record.secretShare.toString(10),
      };
      fx.writeText(frostSharePath(sharesDir, record.x), JSON.stringify(body, null, 2) + "\n", 0o600);
    },
  };
}

function toB64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function fromB64(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64"));
}

/**
 * The label must match the backend. THE SEAL TIER IS A CLAIM ABOUT A BACKEND, NOT A NAME
 * FOR A DIRECTORY, and until this function existed nothing checked that the two agreed.
 *
 * Two refusals, and the second is the one that closes the row-1/row-2 crossing:
 *
 *   1. A hardware tier with an UNDECLARED backend is refused. Silence cannot buy the
 *      strongest labels -- the same reason there is no default PKCS#11 slot.
 *   2. A declared residency that DISAGREES with the tier is refused. This is what stops a
 *      TPM backend (key unsealed into host RAM) being labelled hardware-pkcs11 (key never
 *      leaves the token). On a TPM-only node that mislabel is one wrong argument away and
 *      it produces an artifact that lies about its own protection forever.
 *
 * Software tiers may leave it undeclared: their residency is bounded above by the label
 * they carry, so an omission cannot be spent as a stronger claim.
 */
function assertBackendCanClaimTier(sealFx: FrostShareSealEffects, sealTier: FrostSealTier): void {
  const required = sealKeyResidencyOf(sealTier);
  const declared = sealFx.keyResidency;
  if (declared === undefined) {
    if (!isHardwareSealTier(sealTier)) return;
    throw new Error(
      `frost-share-adapter: seal backend declares no keyResidency but the tier "${sealTier}" ` +
        `claims "${required}". A hardware tier must be backed by a backend that says what it ` +
        "does with the wrapping key. Set keyResidency on the effects, or declare a software tier.",
    );
  }
  if (declared !== required) {
    throw new Error(
      `frost-share-adapter: seal-tier/backend mismatch: the tier "${sealTier}" claims the ` +
        `wrapping key is "${required}", but this backend reports "${declared}". ` +
        `${describeSealTierGap(sealTier, hardwareTierClaiming(declared) ?? sealTier)} ` +
        "Refusing: a mislabelled artifact carries the wrong protection claim for its whole life.",
    );
  }
}

/** The tier a residency corresponds to, when exactly one does. Used only for the message. */
function hardwareTierClaiming(residency: FrostSealKeyResidency): FrostSealTier | undefined {
  const hits = (Object.keys(SEAL_TIER_KEY_RESIDENCY) as readonly FrostSealTier[]).filter(
    (t) => SEAL_TIER_KEY_RESIDENCY[t] === residency,
  );
  return hits.length === 1 ? hits[0] : undefined;
}

function sealedShareAad(body: Omit<FrostSealedShareFileV2, "sealed">): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(body));
}

function defaultSeal(sealFx: FrostShareSealEffects, plaintext: Uint8Array, aad: Uint8Array): FrostShareSealBox {
  const key = sealFx.getSealKey();
  if (key.length !== 32) throw new Error("frost-share-adapter: sealed-file requires 32-byte AES key");
  const nonce = sealFx.randomBytes?.(12) ?? new Uint8Array(nodeRandomBytes(12));
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: "AES-256-GCM",
    nonceB64: toB64(nonce),
    ciphertextB64: toB64(ciphertext),
    tagB64: toB64(tag),
  };
}

function defaultUnseal(sealFx: FrostShareSealEffects, box: FrostShareSealBox, aad: Uint8Array): Uint8Array {
  if (!box.alg.endsWith("AES-256-GCM")) {
    throw new Error(`frost-share-adapter: unsupported seal alg ${box.alg}`);
  }
  if (box.tagB64 === undefined) throw new Error("frost-share-adapter: missing AES-GCM tag");
  const key = sealFx.getSealKey();
  if (key.length !== 32) throw new Error("frost-share-adapter: sealed-file requires 32-byte AES key");
  const decipher = createDecipheriv("aes-256-gcm", key, fromB64(box.nonceB64));
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(box.tagB64, "base64"));
  return new Uint8Array(Buffer.concat([decipher.update(fromB64(box.ciphertextB64)), decipher.final()]));
}

/**
 * Sealed-file adapter over an injected seal backend.
 *
 * The header binding (schema, tier, ca, threshold, totalShares, group pubkey, x) is
 * bound to the ciphertext TWICE:
 *   1. as AEAD associated data, where the backend is an AEAD (the AES-GCM default), and
 *   2. embedded INSIDE the plaintext and compared after decrypt.
 *
 * (2) exists because not every backend is an AEAD. The PKCS#11 backend below uses
 * CKM_AES_CBC_PAD, which supplies confidentiality and NO integrity and which has no
 * associated-data input at all. Without (2), the header of a PKCS#11-sealed share --
 * including its x index and its group public key -- would be freely editable.
 *
 * Stated precisely so it is not oversold: (2) is a binding CHECK, not a MAC. It detects
 * header substitution, and ciphertext tampering garbles the plaintext so the check
 * fails with overwhelming probability. It is NOT INT-CTXT. A token that offers
 * CKM_AES_GCM should use it; that upgrade is a named open item on 081KWPHRNFW.
 */
export function createSealedFileShareAdapter(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
  sealFx: FrostShareSealEffects,
  sealTier: FrostSealTier = "software-sealed",
): ExtractingFrostShareAdapter {
  assertBackendCanClaimTier(sealFx, sealTier);
  sealFx.probe?.();
  return {
    kind: "sealed-file",
    sealTier,
    extractsScalar: true,
    usesWithoutExtract: false,
    loadShare(x: number): FrostShareRecord | null {
      const p = frostSharePath(sharesDir, x);
      if (!fx.exists(p)) return null;
      const body = JSON.parse(fx.readText(p)) as FrostSealedShareFileV2;
      if ((body.schema as string) === FROST_SEALED_SHARE_SCHEMA_V1) {
        throw new Error(
          "frost-share-adapter: refusing pre-tier sealed artifact " +
            `${FROST_SEALED_SHARE_SCHEMA_V1} at x=${x}; it records no seal tier, so its ` +
            "protection level is unknown. Re-seal it under a declared tier.",
        );
      }
      if (body.schema !== FROST_SEALED_SHARE_SCHEMA) {
        throw new Error(`frost-share-adapter: unknown sealed-share schema ${String(body.schema)} at x=${x}`);
      }
      if (body.ca !== ca) return null;
      if (body.sealTier !== sealTier) {
        throw new Error(
          `frost-share-adapter: seal-tier mismatch at x=${x}: artifact was sealed by ` +
            `"${body.sealTier}" but this adapter is "${sealTier}". Refusing rather than ` +
            "silently accepting a differently-protected share.",
        );
      }
      // WHICH TOKEN. Enforced before any decrypt is attempted, so the refusal names the
      // real reason instead of surfacing as an opaque padding error three layers down.
      const presentedToken = sealFx.tokenIdentity?.();
      if (body.sealedByToken !== undefined) {
        if (presentedToken === undefined) {
          throw new Error(
            `frost-share-adapter: share x=${x} is bound to token "${body.sealedByToken}", but ` +
              "this backend reports no token identity. Refusing rather than opening a " +
              "token-bound share with an unidentified backend.",
          );
        }
        if (presentedToken !== body.sealedByToken) {
          throw new Error(
            `frost-share-adapter: wrong token for share x=${x}: sealed by ` +
              `"${body.sealedByToken}" but "${presentedToken}" is present. Refusing. ` +
              "If one token could open every share, the roster would be 1-of-N, not a threshold.",
          );
        }
      }
      const aadBody: Omit<FrostSealedShareFileV2, "sealed"> = {
        schema: body.schema,
        sealTier: body.sealTier,
        ca: body.ca,
        threshold: body.threshold,
        totalShares: body.totalShares,
        groupPublicKeyHex: body.groupPublicKeyHex,
        x: body.x,
        // Undefined keys are omitted by JSON.stringify, so an artifact sealed before this
        // field existed reconstructs byte-identical AAD and still loads.
        ...(body.sealedByToken !== undefined ? { sealedByToken: body.sealedByToken } : {}),
      };
      const aad = sealedShareAad(aadBody);
      const plaintext = sealFx.unseal?.(body.sealed, aad) ?? defaultUnseal(sealFx, body.sealed, aad);
      const payload = JSON.parse(new TextDecoder().decode(plaintext)) as {
        readonly bind: string;
        readonly secretShare: string;
      };
      if (payload.bind !== new TextDecoder().decode(aad)) {
        throw new Error(
          `frost-share-adapter: seal-binding mismatch at x=${x}; the sealed header does not ` +
            "match the file header. Treat this share as tampered.",
        );
      }
      return {
        x: body.x,
        secretShare: BigInt(payload.secretShare),
        threshold: body.threshold,
        totalShares: body.totalShares,
        groupPublicKeyHex: body.groupPublicKeyHex,
      };
    },
    storeShare(record: FrostShareRecord, caName: string): void {
      const sealingToken = sealFx.tokenIdentity?.();
      const aadBody: Omit<FrostSealedShareFileV2, "sealed"> = {
        schema: FROST_SEALED_SHARE_SCHEMA,
        sealTier,
        ca: caName,
        threshold: record.threshold,
        totalShares: record.totalShares,
        groupPublicKeyHex: record.groupPublicKeyHex,
        x: record.x,
        ...(sealingToken !== undefined ? { sealedByToken: sealingToken } : {}),
      };
      const aad = sealedShareAad(aadBody);
      const plaintext = new TextEncoder().encode(
        JSON.stringify({ bind: new TextDecoder().decode(aad), secretShare: record.secretShare.toString(10) }),
      );
      const sealed = sealFx.seal?.(plaintext, aad) ?? defaultSeal(sealFx, plaintext, aad);
      const body: FrostSealedShareFileV2 = { ...aadBody, sealed };
      fx.writeText(frostSharePath(sharesDir, record.x), JSON.stringify(body, null, 2) + "\n", 0o600);
    },
  };
}

/** Honest stub: documents the HSM seam without pretending hardware exists. */
export function createHsmShareAdapterStub(): ExtractingFrostShareAdapter {
  const err = (): never => {
    throw new Error("frost-share-adapter: HSM/TPM seal not implemented for this kind - choose a declared tier");
  };
  return {
    kind: "hsm-stub",
    sealTier: "software-plaintext",
    extractsScalar: true,
    usesWithoutExtract: false,
    loadShare: err,
    storeShare: err,
  };
}

// ============================================================================
// THE FAKE
// ============================================================================
//
// CI runners have no usable TPM and no PKCS#11 token, so the port needs a software
// stand-in. A stand-in that can be MISTAKEN for hardware is the vacuity class -- a
// check that cannot fail looking like one that passed. So the fake is made
// unmistakable by four independent mechanisms, none of which is documentation:
//
//   1. CONSTRUCTION IS GATED. It cannot be built by accident: the caller must pass
//      an explicit acknowledgement object. There is no default and no boolean flag
//      that reads as innocuous.
//   2. THE TIER SHOUTS. sealTier is "INSECURE-SOFTWARE-FAKE-HSM" on the live object.
//   3. THE ARTIFACT SHOUTS, FOREVER. The tier and a fake-specific alg string are
//      written into the on-disk share, so a fake-sealed share stays identifiable
//      long after the process that made it is gone, and shows up in a git diff.
//   4. THE REAL ADAPTER REFUSES IT. Because seal tiers must match exactly on load
//      (see createSealedFileShareAdapter), a hardware adapter throws on a
//      fake-sealed artifact. A silent substitution is therefore caught at the next
//      load even if nobody was watching when it was written.
//
// The seal key is a PUBLISHED CONSTANT below. It is not a secret and is not meant
// to be one: anyone with this repository can decrypt anything the fake sealed. That
// is the point -- the fake must not be able to masquerade as protection.

/** Deliberately public. Anyone with the repo can open a fake-sealed share. */
export const INSECURE_FAKE_SEAL_KEY_SEED = "zeta-INSECURE-fake-hsm-seed-NOT-A-SECRET";

export const INSECURE_FAKE_SEAL_ALG = "INSECURE-SOFTWARE-FAKE-HSM:AES-256-GCM";

export interface InsecureFakeHsmAcknowledgement {
  /** Must be literally true. Typed as the literal so it cannot be widened silently. */
  readonly iUnderstandThisIsNotHardware: true;
  /** Where the loud runtime warning goes. Injected so tests can capture it (noninterference). */
  readonly warn?: (message: string) => void;
}

/**
 * Software stand-in for a hardware seal. NOT hardware. NOT secret. NOT a security
 * boundary. Use only in tests and in explicitly-declared local development.
 */
export function createInsecureFakeHsmShareAdapter(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
  ack: InsecureFakeHsmAcknowledgement,
): ExtractingFrostShareAdapter {
  if (ack?.iUnderstandThisIsNotHardware !== true) {
    throw new Error(
      "frost-share-adapter: the fake HSM adapter requires an explicit acknowledgement " +
        "({ iUnderstandThisIsNotHardware: true }). It provides NO confidentiality: its seal " +
        "key is a published constant. Refusing to construct it implicitly.",
    );
  }
  const warn = ack.warn ?? ((m: string) => console.warn(m));
  const sealKey = new Uint8Array(32);
  sealKey.set(new TextEncoder().encode(INSECURE_FAKE_SEAL_KEY_SEED).subarray(0, 32));

  const sealFx: FrostShareSealEffects = {
    getSealKey: () => sealKey,
    seal(plaintext: Uint8Array, aad: Uint8Array): FrostShareSealBox {
      warn("frost-share-adapter: SEALING WITH THE INSECURE SOFTWARE FAKE - this is NOT hardware");
      return { ...defaultSeal(sealFx, plaintext, aad), alg: INSECURE_FAKE_SEAL_ALG };
    },
    unseal(box: FrostShareSealBox, aad: Uint8Array): Uint8Array {
      warn("frost-share-adapter: UNSEALING WITH THE INSECURE SOFTWARE FAKE - this is NOT hardware");
      if (box.alg !== INSECURE_FAKE_SEAL_ALG) {
        throw new Error(`frost-share-adapter: fake adapter refuses non-fake alg ${box.alg}`);
      }
      return defaultUnseal(sealFx, box, aad);
    },
  };
  return createSealedFileShareAdapter(fx, sharesDir, ca, sealFx, "INSECURE-SOFTWARE-FAKE-HSM");
}

// ============================================================================
// PKCS#11 (macOS + Linux, needs Bun FFI and a token)
// ============================================================================

export interface Pkcs11Lib {
  readonly C_Initialize: (pInitArgs: number | bigint) => number | bigint;
  readonly C_Finalize: (pReserved: number | bigint) => number | bigint;
  readonly C_GetSlotList: (tokenPresent: number, pSlotList: unknown, pulCount: unknown) => number | bigint;
  /** Fills a 1024-byte CK_TOKEN_INFO. The source of the token identity we bind shares to. */
  readonly C_GetTokenInfo: (slotID: number | bigint, pInfo: unknown) => number | bigint;
  readonly C_OpenSession: (
    slotID: number | bigint,
    flags: number | bigint,
    pApplication: unknown,
    Notify: unknown,
    phSession: BigUint64Array,
  ) => number | bigint;
  readonly C_CloseSession: (hSession: number | bigint) => number | bigint;
  readonly C_Login: (
    hSession: number | bigint,
    userType: number | bigint,
    pPin: unknown,
    ulPinLen: number | bigint,
  ) => number | bigint;
  readonly C_Logout: (hSession: number | bigint) => number | bigint;
  readonly C_FindObjectsInit: (hSession: number | bigint, pTemplate: unknown, ulCount: number | bigint) => number | bigint;
  readonly C_FindObjects: (
    hSession: number | bigint,
    phObject: BigUint64Array,
    ulMaxObjectCount: number | bigint,
    pulObjectCount: BigUint64Array,
  ) => number | bigint;
  readonly C_FindObjectsFinal: (hSession: number | bigint) => number | bigint;
  readonly C_EncryptInit: (hSession: number | bigint, pMechanism: unknown, hKey: number | bigint) => number | bigint;
  readonly C_Encrypt: (
    hSession: number | bigint,
    pData: unknown,
    ulDataLen: number | bigint,
    pEncryptedData: unknown,
    pulEncryptedDataLen: BigUint64Array,
  ) => number | bigint;
  readonly C_DecryptInit: (hSession: number | bigint, pMechanism: unknown, hKey: number | bigint) => number | bigint;
  readonly C_Decrypt: (
    hSession: number | bigint,
    pEncryptedData: unknown,
    ulEncryptedDataLen: number | bigint,
    pData: unknown,
    pulDataLen: BigUint64Array,
  ) => number | bigint;
}

/**
 * Address-of for buffers handed across the FFI boundary.
 *
 * This is an INJECTED effect, not an ambient capability, for a specific reason: the
 * previous implementation wrapped bun:ffi ptr() in try/catch and left NULL (0n) in the
 * attribute template when FFI was unavailable. A real PKCS#11 module handed that
 * template would search on a malformed attribute list; a mock never dereferences it and
 * passes. That is a defect that only appears on hardware -- exactly the class the fake
 * must not be able to hide. Making it injected means the no-FFI case is a declared
 * choice by the caller rather than a silent catch.
 */
export type Pkcs11PointerOf = (buf: Uint8Array | BigUint64Array) => bigint;

export const defaultPointerOf: Pkcs11PointerOf = (buf) => {
  const ffi = tryRequireBunFfi();
  if (!ffi) {
    throw new Error(
      "frost-share-adapter: Bun FFI is unavailable, so no real pointer can be taken for the " +
        "PKCS#11 attribute template. Refusing to pass NULL to a token. Inject pointerOf explicitly " +
        "if you are driving a mock.",
    );
  }
  return BigInt(ffi.ptr(buf));
};

interface BunFfi {
  readonly dlopen: (path: string, symbols: unknown) => { symbols: unknown };
  readonly FFIType: Record<string, unknown>;
  readonly ptr: (buf: Uint8Array | BigUint64Array) => number | bigint;
}

function tryRequireBunFfi(): BunFfi | null {
  try {
    return require("bun:ffi") as BunFfi;
  } catch {
    return null;
  }
}

export const defaultFfiLoader = (libPath: string): Pkcs11Lib => {
  const ffi = tryRequireBunFfi();
  if (!ffi) throw new Error("frost-share-adapter: Bun FFI is not supported in this runtime environment");
  const t = ffi.FFIType;
  const lib = ffi.dlopen(libPath, {
    C_Initialize: { args: [t.ptr], returns: t.u64 },
    C_Finalize: { args: [t.ptr], returns: t.u64 },
    C_GetSlotList: { args: [t.u8, t.ptr, t.ptr], returns: t.u64 },
    C_GetTokenInfo: { args: [t.u64, t.ptr], returns: t.u64 },
    C_OpenSession: { args: [t.u64, t.u64, t.ptr, t.ptr, t.ptr], returns: t.u64 },
    C_CloseSession: { args: [t.u64], returns: t.u64 },
    C_Login: { args: [t.u64, t.u64, t.ptr, t.u64], returns: t.u64 },
    C_Logout: { args: [t.u64], returns: t.u64 },
    C_FindObjectsInit: { args: [t.u64, t.ptr, t.u64], returns: t.u64 },
    C_FindObjects: { args: [t.u64, t.ptr, t.u64, t.ptr], returns: t.u64 },
    C_FindObjectsFinal: { args: [t.u64], returns: t.u64 },
    C_EncryptInit: { args: [t.u64, t.ptr, t.u64], returns: t.u64 },
    C_Encrypt: { args: [t.u64, t.ptr, t.u64, t.ptr, t.ptr], returns: t.u64 },
    C_DecryptInit: { args: [t.u64, t.ptr, t.u64], returns: t.u64 },
    C_Decrypt: { args: [t.u64, t.ptr, t.u64, t.ptr, t.ptr], returns: t.u64 },
  });
  return lib.symbols as Pkcs11Lib;
};

const CKF_SERIAL_SESSION = 0x00000004n;
const CKF_RW_SESSION = 0x00000002n;
const CKU_USER = 1n;
const CKO_SECRET_KEY = 4n;
const CKA_CLASS = 0x00000000n;
const CKA_LABEL = 0x00000003n;
const CKM_AES_CBC_PAD = 0x0000010dn;
const CKR_OK = 0n;
const CKR_USER_ALREADY_LOGGED_IN = 0x100n;

export const PKCS11_SEAL_ALG = "PKCS11:AES-256-CBC-PAD";

// ============================================================================
// ADDRESSING A TOKEN -- and what addressing is NOT
// ============================================================================
//
// Read this together with FrostSealedShareFileV2.sealedByToken. That field is the
// SECURITY property: share i is openable only by the token that sealed it, checked
// against the device's own reported identity. Nothing below weakens or replaces it.
//
// What is below is ADDRESSING: how a caller says WHICH token it wants to reach. It is
// not a security property. Addressing decides which device you talk to; the binding
// decides whether the artifact opens. A roster that only addresses shares to different
// slots -- with no identity binding -- looks distributed and is not, which is worse than
// obviously-undistributed because it reads as done. So addressing is worth having only
// ON TOP of the binding, which is the order these two landed in.
//
// Two ways to name a token, and they are not equals:
//
//   by: "token-identity"  -- ROSTER-GRADE. Name the device ("YubiKey PIV #12345678").
//        Resolution enumerates the attached tokens (C_GetSlotList + C_GetTokenInfo) and
//        finds the slot currently holding THAT device. Stable across replug, across
//        reboot, across "someone unplugged the printer dongle and everything shifted
//        down one". If the named device is not attached, resolution THROWS. There is no
//        nearest-match and no fall-through to slot 0.
//
//   by: "slot-index"      -- DISCOVERY-GRADE. A raw index into the module's slot list.
//        Positional, module-assigned, and NOT an identity: replug two tokens in the
//        other order and slot 0 is a different device. Keep it for bootstrap ("what is
//        in slot 0 right now, so I can learn its identity and write it into a roster")
//        and for single-token hosts. `expectTokenIdentity` upgrades it: the slot is
//        opened, the device is asked who it is, and a mismatch throws.
//
// THERE IS NO DEFAULT. The previous `opts.slotId ?? 0` meant an options object that
// simply forgot to say where the token was addressed slot 0 -- so N adapters built for N
// tokens all quietly addressed the SAME device, and (before the identity binding) sealed
// N shares to one risk while every log line said "hardware-pkcs11". An undeclared
// address is refused.

export type Pkcs11TokenAddress =
  | {
      readonly by: "token-identity";
      /** "label#serial" exactly as parseCkTokenInfoIdentity reports it. */
      readonly tokenIdentity: string;
    }
  | {
      readonly by: "slot-index";
      readonly slotId: number;
      /** When given, the device in that slot must report this identity or the call throws. */
      readonly expectTokenIdentity?: string;
    };

export interface Pkcs11SealEffectsOptions {
  readonly libraryPath: string;
  readonly pin?: string;
  /**
   * WHICH token. Required -- see the addressing note above for why there is no default.
   * `slotId` remains as a shorthand for `{ by: "slot-index", slotId }`; supplying neither
   * throws, and supplying both throws rather than silently preferring one.
   */
  readonly address?: Pkcs11TokenAddress;
  /** Shorthand for `{ by: "slot-index", slotId }`. Positional, not an identity. */
  readonly slotId?: number;
  readonly keyLabel?: string;
  readonly ffiLoader?: (libraryPath: string) => Pkcs11Lib;
  /** Injected on purpose. See Pkcs11PointerOf. */
  readonly pointerOf?: Pkcs11PointerOf;
}

/**
 * Normalise the two spellings into one address, refusing both the undeclared case and
 * the ambiguous case.
 *
 * Exported because "what happens when the caller says nothing" is precisely the
 * behaviour the old `?? 0` got wrong, and a defaulting expression buried in a factory is
 * not something a test can point at.
 */
export function resolvePkcs11Address(opts: Pkcs11SealEffectsOptions): Pkcs11TokenAddress {
  if (opts.address !== undefined && opts.slotId !== undefined) {
    throw new Error(
      "frost-share-adapter: both `address` and the `slotId` shorthand were given. Refusing " +
        "to choose one silently -- an ambiguous token address is how a roster ends up " +
        "pointing somewhere nobody declared.",
    );
  }
  if (opts.address !== undefined) return opts.address;
  if (opts.slotId !== undefined) return { by: "slot-index", slotId: opts.slotId };
  throw new Error(
    "frost-share-adapter: no PKCS#11 token address. Declare one: " +
      '{ address: { by: "token-identity", tokenIdentity: "label#serial" } } for a roster, or ' +
      '{ slotId: n } for single-token discovery. There is no default: defaulting to slot 0 ' +
      "made every adapter in an N-token roster address the same device.",
  );
}

function buildFindKeyTemplate(label: string, pointerOf: Pkcs11PointerOf) {
  const labelBytes = new TextEncoder().encode(label);
  const classVal = new BigUint64Array([CKO_SECRET_KEY]);
  const template = new Uint8Array(48); // 2 attributes * 24 bytes
  const view = new DataView(template.buffer);
  view.setBigUint64(0, CKA_CLASS, true);
  view.setBigUint64(8, pointerOf(classVal), true);
  view.setBigUint64(16, 8n, true);
  view.setBigUint64(24, CKA_LABEL, true);
  view.setBigUint64(32, pointerOf(labelBytes), true);
  view.setBigUint64(40, BigInt(labelBytes.length), true);
  // classVal and labelBytes must outlive the call; returned so the caller keeps them alive.
  return { template, classVal, labelBytes };
}

function buildCbcMechanism(iv: Uint8Array, pointerOf: Pkcs11PointerOf) {
  const mech = new Uint8Array(24);
  const view = new DataView(mech.buffer);
  view.setBigUint64(0, CKM_AES_CBC_PAD, true);
  view.setBigUint64(8, pointerOf(iv), true);
  view.setBigUint64(16, BigInt(iv.length), true);
  return { mechanism: mech, iv };
}

function rvOk(rv: number | bigint): boolean {
  return BigInt(rv) === CKR_OK;
}

/** CK_TOKEN_INFO leading fields (PKCS#11 v2.40 §10.11 / v3.1 §10.12): all blank-padded,
 *  NOT NUL-terminated. label[32] manufacturerID[32] model[16] serialNumber[16]. */
const CK_TOKEN_INFO_SIZE = 1024;
const CK_TOKEN_INFO_LABEL_OFFSET = 0;
const CK_TOKEN_INFO_LABEL_LEN = 32;
const CK_TOKEN_INFO_SERIAL_OFFSET = 80;
const CK_TOKEN_INFO_SERIAL_LEN = 16;

/**
 * Parse a token identity out of a raw CK_TOKEN_INFO buffer. Pure and exported so the
 * struct offsets are covered by tests today, on a machine with no token: the FFI call
 * around it cannot be exercised until hardware lands, but getting `serialNumber` at the
 * wrong offset would bind every share to the same garbage string and quietly restore the
 * any-token-opens-any-share behaviour this field exists to prevent.
 *
 * Returns "label#serial", both blank-trimmed. NEVER touches key material -- these two
 * fields are printed on the outside of the device.
 */
export function parseCkTokenInfoIdentity(info: Uint8Array): string {
  const field = (off: number, len: number): string =>
    new TextDecoder().decode(info.subarray(off, off + len)).replace(/[\s\0]+$/u, "");
  const label = field(CK_TOKEN_INFO_LABEL_OFFSET, CK_TOKEN_INFO_LABEL_LEN);
  const serial = field(CK_TOKEN_INFO_SERIAL_OFFSET, CK_TOKEN_INFO_SERIAL_LEN);
  if (serial === "") {
    throw new Error(
      "frost-share-adapter: token reports an empty serial number, so shares cannot be bound " +
        "to it. Refusing rather than binding every token to the same empty identity.",
    );
  }
  return `${label}#${serial}`;
}

/** CK_TRUE for C_GetSlotList's tokenPresent argument: list only slots WITH a token in
 *  them. An empty reader is not a device, so it must not appear as an addressable one. */
const CK_TRUE = 1;

/** One attached token, as the module currently sees it. */
export interface Pkcs11AttachedToken {
  /** Where it is RIGHT NOW. Changes on replug. Never store this as an identity. */
  readonly slotId: number;
  /** "label#serial", or null when the device could not be identified (see reason). */
  readonly tokenIdentity: string | null;
  readonly reason?: string;
}

/**
 * Enumerate the tokens attached to this module, with the identity each one reports.
 *
 * This is the first and only caller of C_GetSlotList, which the FFI table has declared
 * since this file was written and which nothing ever invoked -- so "which tokens are
 * attached" was a question the code could not ask, and every adapter addressed a slot
 * number instead. Uses the standard two-call idiom: NULL first to learn the count, then
 * a buffer.
 *
 * Enumeration is a SEARCH, never an ASSIGNMENT. It is used to locate a device the caller
 * already named; it must not be used to hand out roster positions in enumeration order,
 * because that order is whatever the module felt like today.
 *
 * A slot whose token cannot be identified (empty serial, C_GetTokenInfo failure) is
 * reported with tokenIdentity null rather than dropped, so a caller's error message can
 * say what WAS there. It can never satisfy a token-identity address, which is the safe
 * direction: an unidentifiable device is not proof of being the named one.
 */
export function enumeratePkcs11Tokens(lib: Pkcs11Lib): readonly Pkcs11AttachedToken[] {
  const count = new BigUint64Array(1);
  let rv = lib.C_GetSlotList(CK_TRUE, 0n, count);
  if (!rvOk(rv)) throw new Error(`frost-share-adapter: C_GetSlotList (count) failed: ${rv}`);
  const n = Number(count[0] ?? 0n);
  if (n === 0) return [];
  const slots = new BigUint64Array(n);
  rv = lib.C_GetSlotList(CK_TRUE, slots, count);
  if (!rvOk(rv)) throw new Error(`frost-share-adapter: C_GetSlotList (list) failed: ${rv}`);
  const found: Pkcs11AttachedToken[] = [];
  for (let i = 0; i < Number(count[0] ?? 0n); i++) {
    const slotId = Number(slots[i] ?? 0n);
    const info = new Uint8Array(CK_TOKEN_INFO_SIZE);
    const irv = lib.C_GetTokenInfo(BigInt(slotId), info);
    if (!rvOk(irv)) {
      found.push({ slotId, tokenIdentity: null, reason: `C_GetTokenInfo failed: ${irv}` });
      continue;
    }
    try {
      found.push({ slotId, tokenIdentity: parseCkTokenInfoIdentity(info) });
    } catch (err) {
      found.push({ slotId, tokenIdentity: null, reason: (err as Error).message });
    }
  }
  return found;
}

/**
 * Which slot currently holds the named token. THROWS when it is not attached.
 *
 * The throw is the no-silent-downgrade invariant applied to addressing. A resolver that
 * fell back to slot 0 when the expected token was absent would undo the identity binding
 * from the outside: the wrong device would be opened, the seal would be attempted against
 * it, and the operator would see a PIN prompt from a token they did not mean to use.
 * Absent token is a refusal, never a substitution.
 *
 * Two attached devices reporting the SAME identity is also a refusal. It should be
 * impossible with real serials, and if it happens the roster's one-device-one-position
 * accounting is already void, so guessing between them is the last thing to do.
 */
export function resolveSlotForTokenIdentity(
  attached: readonly Pkcs11AttachedToken[],
  tokenIdentity: string,
): number {
  const matches = attached.filter((t) => t.tokenIdentity === tokenIdentity);
  if (matches.length > 1) {
    throw new Error(
      `frost-share-adapter: ${matches.length} attached tokens report the identity ` +
        `"${tokenIdentity}" (slots ${matches.map((m) => m.slotId).join(", ")}). Refusing to ` +
        "guess: two devices with one identity means the roster cannot count positions.",
    );
  }
  const only = matches[0];
  if (only === undefined) {
    const seen = attached
      .map((t) => `slot ${t.slotId}: ${t.tokenIdentity ?? `<unidentifiable: ${t.reason ?? "?"}>`}`)
      .join("; ");
    throw new Error(
      `frost-share-adapter: token "${tokenIdentity}" is not attached. Attached now: ` +
        `${seen === "" ? "(no tokens)" : seen}. Refusing -- there is no fallback slot. ` +
        "Falling back to slot 0 here would open a DIFFERENT device than the one this " +
        "share is bound to, which is the whole defect the binding exists to stop.",
    );
  }
  return only.slotId;
}

function findKey(lib: Pkcs11Lib, hSession: bigint | number, keyLabel: string, pointerOf: Pkcs11PointerOf): bigint {
  const held = buildFindKeyTemplate(keyLabel, pointerOf);
  let rv = lib.C_FindObjectsInit(hSession, held.template, 2n);
  if (!rvOk(rv)) throw new Error(`C_FindObjectsInit failed: ${rv}`);
  const phObject = new BigUint64Array(1);
  const pulObjectCount = new BigUint64Array(1);
  rv = lib.C_FindObjects(hSession, phObject, 1n, pulObjectCount);
  lib.C_FindObjectsFinal(hSession);
  if (!rvOk(rv) || (pulObjectCount[0] ?? 0n) === 0n) {
    throw new Error(`frost-share-adapter: no PKCS#11 key labelled ${keyLabel} in the token`);
  }
  void held.classVal;
  void held.labelBytes;
  return phObject[0] ?? 0n;
}

export function createPkcs11SealEffects(opts: Pkcs11SealEffectsOptions): FrostShareSealEffects {
  const pin = opts.pin ?? "";
  const address = resolvePkcs11Address(opts);
  const keyLabel = opts.keyLabel ?? "zeta-frost-wrap";
  const loader = opts.ffiLoader ?? defaultFfiLoader;
  const pointerOf = opts.pointerOf ?? defaultPointerOf;

  let cachedLib: Pkcs11Lib | null = null;
  const getLib = (): Pkcs11Lib => {
    if (!cachedLib) cachedLib = loader(opts.libraryPath);
    return cachedLib;
  };

  /**
   * Where the addressed token is, RIGHT NOW. Never cached, for the same reason
   * tokenIdentity() is never cached: slot ids are module-assigned and shift when devices
   * are added or removed, so a cached resolution would let a replug silently redirect an
   * adapter at a different device between two calls. Requires C_Initialize to have been
   * called already.
   */
  const currentSlot = (lib: Pkcs11Lib): number => {
    if (address.by === "slot-index") return address.slotId;
    return resolveSlotForTokenIdentity(enumeratePkcs11Tokens(lib), address.tokenIdentity);
  };

  /** Read the identity of the device in a slot. Its OWN report, never an echo of config. */
  const identityInSlot = (lib: Pkcs11Lib, slotId: number): string => {
    const info = new Uint8Array(CK_TOKEN_INFO_SIZE);
    const rv = lib.C_GetTokenInfo(BigInt(slotId), info);
    if (!rvOk(rv)) throw new Error(`C_GetTokenInfo failed for slot ${slotId}: ${rv}`);
    return parseCkTokenInfoIdentity(info);
  };

  /** Open a logged-in session, run body, always tear down. */
  const withSession = <T>(body: (lib: Pkcs11Lib, hSession: bigint) => T): T => {
    const lib = getLib();
    lib.C_Initialize(0n);
    let slotId: number;
    try {
      slotId = currentSlot(lib);
    } catch (err) {
      lib.C_Finalize(0n);
      throw err;
    }
    const phSession = new BigUint64Array(1);
    const rv = lib.C_OpenSession(BigInt(slotId), CKF_SERIAL_SESSION | CKF_RW_SESSION, 0n, 0n, phSession);
    if (!rvOk(rv)) {
      lib.C_Finalize(0n);
      throw new Error(`C_OpenSession failed: ${rv}`);
    }
    const hSession = phSession[0] ?? 0n;
    let loggedIn = false;
    try {
      if (pin.length > 0) {
        const pinBytes = new TextEncoder().encode(pin);
        const lrv = lib.C_Login(hSession, CKU_USER, pinBytes, BigInt(pinBytes.length));
        if (!rvOk(lrv) && BigInt(lrv) !== CKR_USER_ALREADY_LOGGED_IN) throw new Error(`C_Login failed: ${lrv}`);
        loggedIn = true;
      }
      return body(lib, hSession);
    } finally {
      if (loggedIn) lib.C_Logout(hSession);
      lib.C_CloseSession(hSession);
      lib.C_Finalize(0n);
    }
  };

  return {
    getSealKey(): Uint8Array {
      throw new Error(
        "frost-share-adapter: PKCS#11 never releases the wrapping key. Wrapping is done on the " +
          "token. (Note this protects the WRAPPING key, not the share -- see the file header.)",
      );
    },

    /**
     * hardware-resident: C_Encrypt/C_Decrypt run ON the token against a key handle. This
     * backend never has the wrapping key -- getSealKey below THROWS on purpose -- which is
     * exactly the property that separates this tier from the TPM-sealed one and the reason
     * the label has to be checked rather than trusted.
     */
    keyResidency: "hardware-resident",

    /** Eager liveness check: prove the token is present and holds the wrapping key. */
    probe(): void {
      withSession((lib, hSession) => findKey(lib, hSession, keyLabel, pointerOf));
    },

    /**
     * WHICH token this adapter is talking to. Read fresh on every call rather than
     * cached, because slot IDs are assigned by the module and are NOT stable identities:
     * replug two tokens in the other order and slot 0 is a different device. Caching the
     * first answer would let a swapped token inherit the previous one's identity, which
     * is the precise failure this binding exists to catch.
     *
     * The returned string is always the DEVICE'S OWN report from C_GetTokenInfo, never
     * the identity string the caller configured. Returning the configured string would
     * make a token-identity address self-fulfilling: the seal would record the name of a
     * device that was never asked to confirm it, and an absent token would still produce
     * a confidently-labelled artifact.
     */
    tokenIdentity(): string {
      const lib = getLib();
      lib.C_Initialize(0n);
      try {
        const slotId = currentSlot(lib);
        const reported = identityInSlot(lib, slotId);
        const expected =
          address.by === "token-identity" ? address.tokenIdentity : address.expectTokenIdentity;
        if (expected !== undefined && reported !== expected) {
          throw new Error(
            `frost-share-adapter: slot ${slotId} holds "${reported}" but this adapter is ` +
              `addressed to "${expected}". Refusing rather than using whichever device answered.`,
          );
        }
        return reported;
      } finally {
        lib.C_Finalize(0n);
      }
    },

    seal(plaintext: Uint8Array, _aad: Uint8Array): FrostShareSealBox {
      // _aad is deliberately unused: CKM_AES_CBC_PAD has no associated-data input.
      // The header binding is carried inside the plaintext by createSealedFileShareAdapter.
      return withSession((lib, hSession) => {
        const hKey = findKey(lib, hSession, keyLabel, pointerOf);
        const iv = new Uint8Array(nodeRandomBytes(16));
        const { mechanism } = buildCbcMechanism(iv, pointerOf);
        let rv = lib.C_EncryptInit(hSession, mechanism, hKey);
        if (!rvOk(rv)) throw new Error(`C_EncryptInit failed: ${rv}`);
        const outLen = new BigUint64Array([BigInt(plaintext.length + 32)]);
        rv = lib.C_Encrypt(hSession, plaintext, BigInt(plaintext.length), 0n, outLen);
        if (!rvOk(rv)) throw new Error(`C_Encrypt size query failed: ${rv}`);
        const buf = new Uint8Array(Number(outLen[0] ?? 0n));
        rv = lib.C_Encrypt(hSession, plaintext, BigInt(plaintext.length), buf, outLen);
        if (!rvOk(rv)) throw new Error(`C_Encrypt failed: ${rv}`);
        return {
          alg: PKCS11_SEAL_ALG,
          nonceB64: toB64(iv),
          ciphertextB64: toB64(buf.slice(0, Number(outLen[0] ?? 0n))),
        };
      });
    },

    unseal(box: FrostShareSealBox, _aad: Uint8Array): Uint8Array {
      if (box.alg !== PKCS11_SEAL_ALG) {
        throw new Error(`frost-share-adapter: PKCS#11 adapter refuses alg ${box.alg}`);
      }
      return withSession((lib, hSession) => {
        const hKey = findKey(lib, hSession, keyLabel, pointerOf);
        const { mechanism } = buildCbcMechanism(fromB64(box.nonceB64), pointerOf);
        let rv = lib.C_DecryptInit(hSession, mechanism, hKey);
        if (!rvOk(rv)) throw new Error(`C_DecryptInit failed: ${rv}`);
        const ct = fromB64(box.ciphertextB64);
        const outLen = new BigUint64Array([BigInt(ct.length)]);
        rv = lib.C_Decrypt(hSession, ct, BigInt(ct.length), 0n, outLen);
        if (!rvOk(rv)) throw new Error(`C_Decrypt size query failed: ${rv}`);
        const buf = new Uint8Array(Number(outLen[0] ?? 0n));
        rv = lib.C_Decrypt(hSession, ct, BigInt(ct.length), buf, outLen);
        if (!rvOk(rv)) throw new Error(`C_Decrypt failed: ${rv}`);
        return buf.slice(0, Number(outLen[0] ?? 0n));
      });
    },
  };
}

// ============================================================================
// TPM 2.0 (LINUX ONLY)
// ============================================================================
//
// Platform reality, stated plainly because a half-covered adapter presented as done
// is worse than a scoped one:
//
//   * Linux with a TPM 2.0 and tpm2-tools -- covered by this backend.
//   * Windows with a TPM 2.0 -- NOT covered (different tooling; no tpm2_unseal).
//   * macOS on Apple Silicon -- NOT COVERED AND CANNOT BE. Apple Silicon has the
//     Secure Enclave, not a TPM 2.0. There is no /dev/tpmrm0 and no tpm2_unseal.
//     The Secure Enclave is reached through the Keychain (kSecAttrTokenIDSecureEnclave),
//     is P-256 only, and exposes no AES key-wrapping primitive of this shape. It needs
//     its own adapter, which this file does not contain.
//
// So on an Apple Silicon machine the ONLY hardware tier available here is
// hardware-pkcs11 with an external token (for example a YubiKey via ykcs11.dylib).
//
// HONEST LIMIT ON THIS TIER: tpm2_unseal returns the unsealed bytes TO THE HOST. The
// AES-GCM seal is then performed in software with that key in process memory. This is
// at-rest protection bound to the chip and to the measured-boot state; it is NOT
// use-without-extract, not even for the wrapping key. The PKCS#11 tier is strictly
// better on that axis, because there the wrapping key never leaves the token.

export interface TpmSealEffectsOptions {
  readonly sealedKeyPath: string;
  readonly parentContext?: string;
  readonly tpm2UnsealCmd?: string;
  /**
   * Injected process runner. argv form, NEVER a shell string.
   *
   * The previous implementation interpolated the command and path into a shell string
   * passed to execSync. That was a command-injection sink, and it also let a test point
   * tpm2UnsealCmd at printf and obtain a share labelled as TPM-sealed. argv form closes
   * the injection; the tier/acknowledgement machinery above closes the masquerade.
   */
  readonly run?: (cmd: string, args: readonly string[]) => Uint8Array;
}

const defaultRun = (cmd: string, args: readonly string[]): Uint8Array =>
  new Uint8Array(execFileSync(cmd, [...args], { stdio: ["ignore", "pipe", "ignore"] }));

export function createTpmSealEffects(opts: TpmSealEffectsOptions): FrostShareSealEffects {
  const cmd = opts.tpm2UnsealCmd ?? "tpm2_unseal";
  const run = opts.run ?? defaultRun;
  const unsealKey = (): Uint8Array => {
    let out: Uint8Array;
    try {
      out = run(cmd, ["-c", opts.sealedKeyPath]);
    } catch (err) {
      throw new Error(`frost-share-adapter: ${cmd} failed: ${(err as Error).message}`);
    }
    if (out.length !== 32) {
      throw new Error(`frost-share-adapter: ${cmd} returned ${out.length} bytes, expected a 32-byte key`);
    }
    return out;
  };
  return {
    getSealKey: unsealKey,
    /**
     * host-ram-at-use, and this is the whole point of the field. tpm2_unseal HANDS THE KEY
     * BACK: the 32 bytes above are in this process before a single byte is wrapped. Sealing
     * to PCR state protects the key from someone holding the disk; it does not protect it
     * from someone holding the host at the moment the seal is open. Declaring it here makes
     * that fact refuse a hardware-pkcs11 label instead of merely being documented near it.
     */
    keyResidency: "host-ram-at-use",
    /** Eager liveness check: prove the TPM can actually open the sealed object. */
    probe(): void {
      unsealKey();
    },
  };
}

/**
 * List the tokens attached to a PKCS#11 module and the identity each reports.
 *
 * The discovery step a roster is WRITTEN from: run it, read the identities off the
 * output, and put them in the roster by hand. Deliberately not a roster generator --
 * generating a roster from enumeration order would make the roster a restatement of
 * today's USB topology, and the whole point of a roster is that it is a declaration a
 * human made and the machine checks. Returns labels and serials only; those are printed
 * on the outside of the device and are not key material.
 */
export function describeAttachedPkcs11Tokens(
  opts: Pick<Pkcs11SealEffectsOptions, "libraryPath" | "ffiLoader">,
): readonly Pkcs11AttachedToken[] {
  const lib = (opts.ffiLoader ?? defaultFfiLoader)(opts.libraryPath);
  lib.C_Initialize(0n);
  try {
    return enumeratePkcs11Tokens(lib);
  } finally {
    lib.C_Finalize(0n);
  }
}

export function createPkcs11ShareAdapter(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
  opts: Pkcs11SealEffectsOptions,
): ExtractingFrostShareAdapter {
  return createSealedFileShareAdapter(fx, sharesDir, ca, createPkcs11SealEffects(opts), "hardware-pkcs11");
}

export function createTpmShareAdapter(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
  opts: TpmSealEffectsOptions,
): ExtractingFrostShareAdapter {
  return createSealedFileShareAdapter(fx, sharesDir, ca, createTpmSealEffects(opts), "hardware-tpm2");
}

// ============================================================================
// no-silent-downgrade
// ============================================================================
//
// The proposal states this invariant for the GOVERNANCE plane: a key sovereignty
// class is declared at creation and is immutable-or-upward, loosened only by its
// owner, never silently downgraded by another party. This is the SEALING-plane
// analogue of that invariant, and it is labelled as an analogue rather than quoted
// as the same rule, because the proposal does not state it for sealing tiers.
//
// The rule enforced here:
//
//   The caller DECLARES the tier it requires. The factory returns an adapter at
//   exactly that tier or it THROWS. There is no fallback path, silent or otherwise.
//   Obtaining the fake requires naming the fake -- requireTier is
//   "INSECURE-SOFTWARE-FAKE-HSM", which cannot be read as innocuous.
//
// What this replaces, and why: the previous factory took allowSimulatorFallback,
// which on failure substituted a software simulator that reported the SAME kind as
// the real adapter, so the caller could not tell. That is the silent downgrade the
// invariant forbids. It was also inert -- the hardware constructors did no work, so
// the try/catch never fired and the flag changed nothing. Both defects are gone: the
// backends now probe eagerly at construction (so failure is real and early) and
// there is no substitution path at all.

export interface HsmShareAdapterOptions {
  /** Mandatory. No default: an undeclared security tier is how downgrades hide. */
  readonly requireTier: FrostSealTier;
  readonly pkcs11Opts?: Pkcs11SealEffectsOptions;
  readonly tpmOpts?: TpmSealEffectsOptions;
  readonly softwareSealFx?: FrostShareSealEffects;
  readonly fakeAck?: InsecureFakeHsmAcknowledgement;
}

export function createHsmShareAdapter(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
  opts: HsmShareAdapterOptions,
): ExtractingFrostShareAdapter {
  const adapter = buildForTier(fx, sharesDir, ca, opts);
  // The refusal now NAMES the property that differs, because "pkcs11 != tpm2" reads as a
  // configuration typo while "the wrapping key would be in host RAM" reads as what it is.
  //
  // HONEST LIMIT, MEASURED 2026-08-20: this call is DEFENCE IN DEPTH and is currently
  // unreachable-as-a-difference. buildForTier is a total switch whose every branch
  // constructs at the tier it was handed, so no input makes this line fire -- a mutation
  // that turned assertNoSilentSealTierDowngrade into a no-op left the whole suite green.
  // It is kept because it is the invariant's statement at the boundary, and it becomes
  // load-bearing the moment buildForTier grows a branch that can return a different tier.
  // Its falsifier is FSA-TR8, which exercises the function directly; the guard that DOES
  // fire on real input is assertBackendCanClaimTier (FSA-TR3/TR5).
  assertNoSilentSealTierDowngrade(opts.requireTier, adapter.sealTier);
  return adapter;
}

function buildForTier(
  fx: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
  opts: HsmShareAdapterOptions,
): ExtractingFrostShareAdapter {
  switch (opts.requireTier) {
    case "hardware-pkcs11": {
      if (!opts.pkcs11Opts) {
        // The common shape of this failure, per the owner call that an HSM is OPTIONAL and
        // a TPM is assumed: a node configured for the TPM, a caller declaring the
        // HSM-resident tier. Naming the gap here means the operator reads why it matters
        // rather than reaching for the nearest option object that would make it go away.
        throw new Error(
          "frost-share-adapter: pkcs11Opts required for hardware-tpm2's stronger sibling " +
            'hardware-pkcs11. ' +
            (opts.tpmOpts
              ? "tpmOpts WERE supplied and are NOT a substitute: " +
                describeSealTierGap("hardware-pkcs11", "hardware-tpm2") + " "
              : "") +
            "An HSM/token is optional hardware; a node without one cannot honour this tier.",
        );
      }
      // Any failure here (no token, no key, no FFI) propagates. That is the point.
      return createPkcs11ShareAdapter(fx, sharesDir, ca, opts.pkcs11Opts);
    }
    case "hardware-tpm2": {
      if (!opts.tpmOpts) throw new Error("frost-share-adapter: tpmOpts required for hardware-tpm2");
      return createTpmShareAdapter(fx, sharesDir, ca, opts.tpmOpts);
    }
    case "software-sealed": {
      if (!opts.softwareSealFx) throw new Error("frost-share-adapter: softwareSealFx required for software-sealed");
      return createSealedFileShareAdapter(fx, sharesDir, ca, opts.softwareSealFx, "software-sealed");
    }
    case "INSECURE-SOFTWARE-FAKE-HSM": {
      if (!opts.fakeAck) {
        throw new Error(
          "frost-share-adapter: the fake tier needs fakeAck ({ iUnderstandThisIsNotHardware: true })",
        );
      }
      return createInsecureFakeHsmShareAdapter(fx, sharesDir, ca, opts.fakeAck);
    }
    case "software-plaintext":
      return createSoftwareFileShareAdapter(fx, sharesDir, ca);
    default: {
      const never: never = opts.requireTier;
      throw new Error(`frost-share-adapter: unknown seal tier ${String(never)}`);
    }
  }
}

// loadFrostKeyShares -- REMOVED 2026-08-14.
//
// It walked every index and returned every share scalar as one array: the bulk
// extraction path, and the widest exposure surface in this file. It had ZERO
// production callers (frost-ca-custody.ts reads its own shares directly for
// frostThresholdSign; nothing else imported it), so deleting it costs nothing and is
// the strongest statement available -- the convenient way to get all the secrets at
// once no longer exists. Signing goes through FrostPartialSigner
// (frost-partial-signer.ts), which never returns a scalar at all.

// ============================================================================
// WHERE use-without-extract ACTUALLY LIVES NOW
// ============================================================================
//
// Sealing the share at rest (what this file does, honestly) is NOT invariant 2. The
// port that can express the invariant is frost-partial-signer.ts:
//
//   commit(x)                        -> public nonce commitments only
//   signPartial(handle, package)     -> a partial z_i, never a share
//
// with the bulk extractor deleted and loadShare demoted to the explicitly-named
// ExtractingFrostShareAdapter. That closes the contradiction with the governing ADR
// (docs/DECISIONS/2026-06-21-hexagonal-pki-and-secret-vault-ports-swappable-adapters.md),
// whose KeyCustody contract reads "hold a private key; sign without exposing": the
// SIGNING port now honours it structurally, and the port that still exposes is named
// for the fact.
//
// The hardware prerequisite is unchanged and is not ours to wish away, but the reason
// is now checked rather than inherited: no PKCS#11 mechanism can compose a FROST
// partial from a sensitive key, and the absence is structural rather than an omission
// in the mechanism list. See the PKCS#11 section of frost-partial-signer.ts. A genuine
// use-without-extract tier needs FROST-aware firmware -- a programmable applet, an
// extensible open-firmware token, or a purpose-built device -- or the
// confidential-compute route at ladder L3.
