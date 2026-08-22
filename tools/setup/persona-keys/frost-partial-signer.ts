// FROST partial-signing port: the share is USED, never RETURNED.
// Monorepo tools-over-trunks: tools/setup/persona-keys/
//
// 081KWPHRNFW DoD item 6 -- the port change that item 5 filed as required.
// Ladder: docs/research/2026-08-14-agent-sovereign-keys-incremental-ladder-L0-to-L6.
//
// ============================================================================
// WHAT THIS PORT ACHIEVES, AND WHAT IT DOES NOT
// ============================================================================
//
// The share-storage port (frost-share-adapter.ts) has loadShare, which RETURNS the
// share scalar. Sovereignty invariant 2 (use-without-extract) can therefore never be
// met behind it: an adapter that can hand you the secret has failed, whatever it
// encrypts. That is why every extract-capable adapter there is typed
// usesWithoutExtract: false.
//
// This port is the other shape. It has NO method that returns a share scalar. A
// caller can obtain a nonce commitment and a partial signature; it cannot obtain s_i,
// and it cannot obtain the one-time nonces d_i / e_i either.
//
// THE SOFTWARE ADAPTER IN THIS FILE IS STILL NOT use-without-extract.
// createSoftwarePartialSigner is CONSTRUCTED FROM an ExtractingFrostShareAdapter --
// it reads the scalar and does the arithmetic in this process. What changed is the
// SIZE OF THE EXPOSURE WINDOW, not its existence:
//
//   loadShare          the scalar lives in the CALLER's process, for as long as the
//                      caller keeps it. Boundary: "caller-process".
//   signPartial (sw)   the scalar lives inside one function frame in this module.
//                      Boundary: "signer-function".
//   signPartial (hw)   the scalar never exists outside the chip.
//                      Boundary: "hardware-boundary". NOT ACHIEVED BY ANYTHING HERE.
//
// Narrowing an exposure window is a real improvement and it is NOT the invariant. The
// distinction is carried in the TYPE, not in this comment: FrostPartialSigner is a
// discriminated union in which usesWithoutExtract: true is reachable only together
// with exposureBoundary: "hardware-boundary", and no constructor in this repository
// produces that branch (createNonExtractingPartialSignerStub throws by construction,
// and FPS-14 enumerates the exported factories to prove none reaches it).
//
// ============================================================================
// WHY TWO ROUNDS, AND WHY THE NONCES ARE BORN AND DIE IN HERE
// ============================================================================
//
// One signPartial call CANNOT suffice, and this is a property of FROST rather than a
// choice about the port. The partial is
//
//     z_i = d_i + rho_i * e_i + lambda_i * s_i * c
//
// where rho_i (the binding factor) is a hash over the FULL commitment list, and c is
// the challenge over the group commitment R = SUM_j (D_j + [rho_j]E_j). A participant
// cannot know either value when it generates its own nonce, because both depend on
// every other participant's commitment. So the port is commit() then signPartial(),
// matching RFC 9591's two rounds.
//
// The nonces are generated inside commit() and NEVER cross the boundary -- only the
// public commitments D_i = [d_i]B and E_i = [e_i]B do. That is not tidiness. A leaked
// or reused nonce is as fatal as a leaked key: two partials over different challenges
// against one nonce pair give z1 - z2 = lambda*(c1 - c2)*s_i, so s_i falls out by
// division. The port therefore hands back an OPAQUE, SINGLE-USE handle, and
// signPartial deletes the nonce record BEFORE it does any arithmetic, so even a
// mid-computation throw cannot leave a reusable nonce behind.
//
// ============================================================================
// PKCS#11 CANNOT COMPOSE A PARTIAL FROM GENERIC PRIMITIVES (CHECKED vs the spec)
// ============================================================================
//
// The earlier note at ladder L2 said consumer HSMs and TPMs do not implement FROST
// partial signing in firmware. That was inherited rather than checked, so it was
// checked against the specification (2026-08-14):
//
//   * PKCS#11 v3.1 (OASIS) defines, for elliptic curves: CKM_ECDSA and its
//     CKM_ECDSA_SHA* variants, CKM_EDDSA, CKM_XEDDSA, and the derive family
//     (CKM_ECDH1_DERIVE, CKM_ECDH1_COFACTOR_DERIVE, CKM_ECMQV_DERIVE,
//     CKM_ECDH_AES_KEY_WRAP). There is NO mechanism that performs modular scalar
//     arithmetic on a stored private scalar and returns the numeric result.
//   * The signature mechanisms are all-or-nothing: CKM_ECDSA and CKM_EDDSA generate
//     the nonce internally and compute the challenge over THEIR OWN R and public key.
//     Neither accepts an externally supplied nonce or an externally supplied
//     challenge, so neither can be bound to the group's R -- which is exactly what a
//     FROST partial requires.
//   * The derive mechanisms output KEY OBJECTS, not numbers, and a derived key
//     inherits the base key's sensitivity (CKA_ALWAYS_SENSITIVE /
//     CKA_NEVER_EXTRACTABLE). CKM_ECDH1_DERIVE computes [s_i]P, a point
//     multiplication, not arithmetic in Z_L. Additive-tweak derivation of the shape a
//     partial would need (CKM_BIP32_CHILD_DERIVE) is a VENDOR EXTENSION (Thales), is
//     secp256k1-only, and still yields a non-extractable key object, not a scalar.
//
// And the absence is STRUCTURAL, not an oversight in the mechanism list. A partial is
// an extractable number that is an affine function of the sensitive scalar. A generic
// primitive emitting one, with the caller choosing rho / lambda / c, would be a
// key-extraction oracle the moment the caller replayed it against a second challenge
// on the same nonce. To emit a partial safely, a token must itself enforce that the
// nonce is fresh and consumed exactly once and that the challenge is bound to a
// commitment list it saw -- which IS "implementing FROST in firmware." So the
// conclusion holds, with a better reason than the one it was inherited with:
//
//   L2 is NOT reachable by clever composition on an orderable general-purpose token.
//   It needs FROST-aware firmware: a programmable applet (JavaCard), an open-firmware
//   token that can be extended, or a purpose-built FROST device (Frostsnap ships one,
//   for Bitcoin / secp256k1, not as a PKCS#11 token).
//
// NO HARDWARE WAS EXERCISED FOR ANY CLAIM IN THIS FILE. The PKCS#11 finding is read
// from the specification: CHECKED against the spec, PROPOSED as applying to any
// particular token, since token mechanism lists vary and vendors add extensions.
//
// ============================================================================
// PLATFORM NOTE (unchanged and still true)
// ============================================================================
//
// Apple Silicon has a Secure Enclave, NOT a TPM 2.0. hardware-tpm2 cannot work on
// such a machine at all; PKCS#11 with an external token is the only hardware tier
// available there. The Enclave is P-256-only through the Keychain and cannot do
// Ed25519 FROST partials either, so it does not rescue this port.

import { randomBytes as nodeRandomBytes } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import { sha512 } from "@noble/hashes/sha2.js";
import type { FrostCaCustodyEffects } from "./frost-ca-custody.ts";
import { frostChallenge, lagrangeCoefficient } from "./frost.ts";
import {
  createInsecureFakeHsmShareAdapter,
  describeSealTierGap,
  type ExtractingFrostShareAdapter,
  type FrostSealTier,
  type InsecureFakeHsmAcknowledgement,
} from "./frost-share-adapter.ts";

const Fn = ed25519.Point.Fn;
const G = ed25519.Point.BASE;

/**
 * Where the share scalar can appear. The security-bearing field of this port, in the
 * same role sealTier plays for storage: it describes the BOUNDARY, not the storage.
 */
export type FrostExposureBoundary =
  /** loadShare: the caller holds the scalar and decides how long to keep it. */
  | "caller-process"
  /** Software signPartial: the scalar exists only inside one function frame here. */
  | "signer-function"
  /** The scalar never exists outside the chip. This is invariant 2. Not achieved here. */
  | "hardware-boundary";

/** Public round-1 output. The only thing that leaves the boundary in round 1. */
export interface FrostNonceCommitment {
  readonly x: number;
  /** D_i = [d_i]B, 32-byte compressed Ed25519 point. */
  readonly hidingCommitment: Uint8Array;
  /** E_i = [e_i]B, 32-byte compressed Ed25519 point. */
  readonly bindingCommitment: Uint8Array;
}

/**
 * Opaque single-use ticket for a round-1 nonce pair.
 *
 * Carries NO secret: it is an index into signer-private state, so passing it around or
 * logging it leaks nothing. It is invalidated by the first signPartial call.
 */
export interface FrostCommitmentHandle {
  readonly x: number;
  readonly sessionId: string;
  /** The tier that issued it. Checked against the package at sign time. */
  readonly sealTier: FrostSealTier;
}

/** Round-2 input, assembled by the coordinator from every participant's round-1 output. */
export interface FrostSigningPackage {
  readonly message: Uint8Array;
  /** 32-byte compressed group public key. */
  readonly groupPublicKey: Uint8Array;
  /** RFC 9591 requires ascending order by identifier; enforced here, not assumed. */
  readonly commitments: readonly FrostNonceCommitment[];
  /**
   * Declared by the coordinator. Mandatory, exactly as requireTier is mandatory on the
   * storage factory: an undeclared tier is how a downgrade hides.
   */
  readonly requiredSealTier: FrostSealTier;
}

/**
 * A participant's signature share.
 *
 * sealTier and exposureBoundary are MISCONFIGURATION AND MASQUERADE guards, not
 * cryptographic ones. They cannot be: a partial must verify against the group key or
 * it is not a signature, so a fake's z is necessarily indistinguishable from a
 * hardware z by inspection. What the labels buy is the property the seal tiers bought
 * at rest -- an accidental or silent substitution is refused by the next stage
 * (combineFrostPartials) instead of passing unnoticed. A hostile party who can author
 * partials can also author the label; that is not the threat these fields address, and
 * the stronger guard for it is that signPartial itself refuses to produce a partial at
 * all for a session whose declared tier is not its own.
 */
export interface FrostPartialSignature {
  readonly x: number;
  readonly z: bigint;
  readonly sealTier: FrostSealTier;
  readonly exposureBoundary: FrostExposureBoundary;
}

interface FrostPartialSignerBase {
  readonly sealTier: FrostSealTier;
  /** Round 1. Nonces are generated inside and do not appear in the return value. */
  commit(x: number): { readonly commitment: FrostNonceCommitment; readonly handle: FrostCommitmentHandle };
  /** Round 2. Consumes the handle; a second call with the same handle throws. */
  signPartial(handle: FrostCommitmentHandle, pkg: FrostSigningPackage): FrostPartialSignature;
}

export interface ExtractingBoundarySigner extends FrostPartialSignerBase {
  readonly exposureBoundary: "caller-process" | "signer-function";
  readonly usesWithoutExtract: false;
}

export interface NonExtractingBoundarySigner extends FrostPartialSignerBase {
  readonly exposureBoundary: "hardware-boundary";
  readonly usesWithoutExtract: true;
}

export type FrostPartialSigner = ExtractingBoundarySigner | NonExtractingBoundarySigner;

// ============================================================================
// RFC 9591 FROST(Ed25519, SHA-512) hashes
// ============================================================================
//
// CHECKED: the aggregate produced by this file verifies under a stock RFC 8032
// Ed25519 verifier (FPS-1). That is a genuine falsifier -- every scalar, the binding
// factors, the group commitment and the Lagrange coefficients must all be right or
// the check fails.
//
// PROPOSED, and deliberately NOT claimed as CHECKED: byte-compatibility with the RFC
// 9591 Appendix test vectors. Those vectors were not run here, so a wire-format
// divergence in the binding-factor input encoding would not have been caught. It does
// not affect correctness of OUR aggregate (every participant runs this code) but it
// would affect interoperability with another RFC 9591 implementation.

const CONTEXT_STRING = new TextEncoder().encode("FROST-ED25519-SHA512-v1");

function concatBytes(...parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function bytesToNumberLE(bytes: Uint8Array): bigint {
  let n = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) n = (n << 8n) + BigInt(bytes[i]!);
  return n;
}

function numberToBytesLE(n: bigint, len: number): Uint8Array {
  const out = new Uint8Array(len);
  let x = n;
  for (let i = 0; i < len; i++) {
    out[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return out;
}

function domainHash(label: string, ...parts: readonly Uint8Array[]): Uint8Array {
  return sha512(concatBytes(CONTEXT_STRING, new TextEncoder().encode(label), ...parts));
}

/** H1 -- binding factor. */
function h1(...parts: readonly Uint8Array[]): bigint {
  return Fn.create(bytesToNumberLE(domainHash("rho", ...parts)));
}

/** H3 -- nonce generation. */
function h3(...parts: readonly Uint8Array[]): bigint {
  return Fn.create(bytesToNumberLE(domainHash("nonce", ...parts)));
}

/** H4 -- message hash. */
function h4(msg: Uint8Array): Uint8Array {
  return domainHash("msg", msg);
}

/** H5 -- commitment-list hash. */
function h5(encoded: Uint8Array): Uint8Array {
  return domainHash("com", encoded);
}

function encodeCommitmentList(commitments: readonly FrostNonceCommitment[]): Uint8Array {
  return concatBytes(
    ...commitments.flatMap((c) => [
      numberToBytesLE(BigInt(c.x), 32),
      c.hidingCommitment,
      c.bindingCommitment,
    ]),
  );
}

/**
 * Validate the coordinator package before any secret is touched.
 *
 * Refuses rather than repairs. An out-of-order or duplicated commitment list changes
 * the binding factors AND the Lagrange coefficients, so silently sorting it here would
 * let two participants compute a different R for the same session and produce an
 * aggregate that verifies for nobody.
 */
function assertWellFormedPackage(pkg: FrostSigningPackage): void {
  if (pkg.commitments.length === 0) throw new Error("frost-partial-signer: empty commitment list");
  if (pkg.groupPublicKey.length !== 32) {
    throw new Error("frost-partial-signer: group public key must be 32 bytes");
  }
  for (let i = 1; i < pkg.commitments.length; i++) {
    const prev = pkg.commitments[i - 1]!.x;
    const cur = pkg.commitments[i]!.x;
    if (cur === prev) {
      throw new Error(`frost-partial-signer: duplicate participant ${String(cur)} in commitment list`);
    }
    if (cur < prev) {
      throw new Error(
        "frost-partial-signer: commitment list is not sorted ascending by identifier " +
          "(RFC 9591 requires it; sorting it here would let participants disagree on R)",
      );
    }
  }
  for (const c of pkg.commitments) {
    if (!Number.isInteger(c.x) || c.x < 1) {
      throw new Error(
        `frost-partial-signer: participant identifier must be a positive integer, got ${String(c.x)}`,
      );
    }
    if (c.hidingCommitment.length !== 32 || c.bindingCommitment.length !== 32) {
      throw new Error(
        `frost-partial-signer: commitment for participant ${String(c.x)} is not two 32-byte points`,
      );
    }
  }
}

/** Binding factor rho_i for every participant, per RFC 9591 compute_binding_factors. */
function bindingFactors(pkg: FrostSigningPackage): Map<number, bigint> {
  const prefix = concatBytes(h4(pkg.message), h5(encodeCommitmentList(pkg.commitments)));
  const out = new Map<number, bigint>();
  for (const c of pkg.commitments) out.set(c.x, h1(prefix, numberToBytesLE(BigInt(c.x), 32)));
  return out;
}

/** Group commitment R = SUM_j (D_j + [rho_j]E_j). Public inputs only. */
function groupCommitment(pkg: FrostSigningPackage, rhos: ReadonlyMap<number, bigint>): Uint8Array {
  let acc = ed25519.Point.ZERO;
  for (const c of pkg.commitments) {
    const rho = rhos.get(c.x);
    if (rho === undefined) {
      throw new Error(`frost-partial-signer: no binding factor for participant ${String(c.x)}`);
    }
    acc = acc
      .add(ed25519.Point.fromBytes(c.hidingCommitment))
      .add(ed25519.Point.fromBytes(c.bindingCommitment).multiply(rho));
  }
  return acc.toBytes();
}

/**
 * Recompute R from public data alone.
 *
 * Exported because the coordinator must derive R itself rather than trust any
 * participant to report it.
 */
export function frostGroupCommitment(pkg: FrostSigningPackage): Uint8Array {
  assertWellFormedPackage(pkg);
  return groupCommitment(pkg, bindingFactors(pkg));
}

// ============================================================================
// The software partial signer
// ============================================================================

/** Injected entropy door (noninterference). The ONLY randomness source in this file. */
export interface FrostPartialSignerEffects {
  readonly randomBytes?: (length: number) => Uint8Array;
}

interface NonceRecord {
  readonly x: number;
  readonly hidingNonce: bigint;
  readonly bindingNonce: bigint;
  readonly commitment: FrostNonceCommitment;
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Partial signer over an extract-capable storage adapter.
 *
 * THE CONSTRUCTOR SIGNATURE IS THE HONESTY CLAIM. Taking an
 * ExtractingFrostShareAdapter is precisely what makes the boundary
 * "signer-function" and not "hardware-boundary": this function can read the scalar,
 * so the scalar is in this process. A real non-extracting signer would take a chip
 * session and could not be built from this argument at all.
 */
export function createSoftwarePartialSigner(
  adapter: ExtractingFrostShareAdapter,
  fx: FrostPartialSignerEffects = {},
): FrostPartialSigner {
  const randomBytes = fx.randomBytes ?? ((n: number) => new Uint8Array(nodeRandomBytes(n)));
  const open = new Map<string, NonceRecord>();

  const loadScalar = (x: number): bigint => {
    const rec = adapter.loadShare(x);
    if (rec === null) throw new Error(`frost-partial-signer: no share for participant ${String(x)}`);
    return Fn.create(rec.secretShare);
  };

  return {
    sealTier: adapter.sealTier,
    exposureBoundary: "signer-function",
    usesWithoutExtract: false,

    commit(x: number) {
      // RFC 9591 nonce_generate: hash fresh randomness TOGETHER WITH the secret share,
      // so a degraded RNG does not immediately hand over a predictable nonce. Belt and
      // braces, never a licence to weaken the RNG.
      const secret = loadScalar(x);
      const secretBytes = numberToBytesLE(secret, 32);
      const hidingNonce = h3(randomBytes(32), secretBytes);
      const bindingNonce = h3(randomBytes(32), secretBytes);
      const commitment: FrostNonceCommitment = {
        x,
        hidingCommitment: G.multiply(hidingNonce).toBytes(),
        bindingCommitment: G.multiply(bindingNonce).toBytes(),
      };
      // The session id indexes signer-private state. It is not derived from any secret.
      const sessionId = Array.from(randomBytes(16), (b) => b.toString(16).padStart(2, "0")).join("");
      open.set(sessionId, { x, hidingNonce, bindingNonce, commitment });
      return { commitment, handle: { x, sessionId, sealTier: adapter.sealTier } };
    },

    signPartial(handle: FrostCommitmentHandle, pkg: FrostSigningPackage): FrostPartialSignature {
      const rec = open.get(handle.sessionId);
      // DELETE FIRST. Every path below can throw, and a nonce that survived a failed
      // signPartial would still be available for a second, different challenge -- which
      // is exactly the arithmetic that recovers s_i. Fail closed.
      open.delete(handle.sessionId);
      if (rec === undefined) {
        throw new Error(
          "frost-partial-signer: commitment handle is unknown or already consumed. Nonces " +
            "are single-use: signing twice against one commitment reveals the share.",
        );
      }
      if (handle.sealTier !== pkg.requiredSealTier) {
        throw new Error(
          "frost-partial-signer: no-silent-downgrade violation: the session requires " +
            `"${pkg.requiredSealTier}" but this signer is "${handle.sealTier}". ` +
            // Same wording as the storage port, from the same function, so the two ports
            // cannot drift into describing one gap two ways.
            describeSealTierGap(pkg.requiredSealTier, handle.sealTier),
        );
      }
      assertWellFormedPackage(pkg);

      const mine = pkg.commitments.find((c) => c.x === rec.x);
      if (mine === undefined) {
        throw new Error(`frost-partial-signer: participant ${String(rec.x)} is not in the signing set`);
      }
      if (
        !sameBytes(mine.hidingCommitment, rec.commitment.hidingCommitment) ||
        !sameBytes(mine.bindingCommitment, rec.commitment.bindingCommitment)
      ) {
        throw new Error(
          `frost-partial-signer: the coordinator commitment for participant ${String(rec.x)} is ` +
            "not the one this signer issued. Refusing to sign against a substituted commitment.",
        );
      }

      const rhos = bindingFactors(pkg);
      const R = groupCommitment(pkg, rhos);
      const c = frostChallenge(R, pkg.groupPublicKey, pkg.message);
      const lambda = lagrangeCoefficient(
        rec.x,
        pkg.commitments.map((k) => k.x),
      );
      const rho = rhos.get(rec.x)!;

      // The one place the scalar exists in this process. Loaded here, not retained:
      // the signer holds no share state between calls.
      const s = loadScalar(rec.x);
      const z = Fn.add(
        Fn.add(rec.hidingNonce, Fn.mul(rho, rec.bindingNonce)),
        Fn.mul(Fn.mul(lambda, s), c),
      );

      return { x: rec.x, z, sealTier: adapter.sealTier, exposureBoundary: "signer-function" };
    },
  };
}

/**
 * Fake partial signer for CI, over the declared fake seal tier.
 *
 * It inherits the fake share adapter construction gate (an explicit acknowledgement
 * object) and its published seal key, so it cannot be built by accident. Its partials
 * carry the shouting tier -- and, the mechanism that actually matters, a session that
 * declares a hardware tier makes signPartial THROW here, so a fake partial for a
 * hardware session is never produced in the first place rather than being detected
 * afterwards.
 */
export function createInsecureFakePartialSigner(
  fxIo: FrostCaCustodyEffects,
  sharesDir: string,
  ca: string,
  ack: InsecureFakeHsmAcknowledgement,
  fx: FrostPartialSignerEffects = {},
): FrostPartialSigner {
  const adapter = createInsecureFakeHsmShareAdapter(fxIo, sharesDir, ca, ack);
  const warn = ack.warn ?? ((m: string) => console.warn(m));
  const inner = createSoftwarePartialSigner(adapter, fx);
  return {
    sealTier: adapter.sealTier,
    exposureBoundary: "signer-function",
    usesWithoutExtract: false,
    commit(x: number) {
      warn("frost-partial-signer: COMMITTING WITH THE INSECURE SOFTWARE FAKE - this is NOT hardware");
      return inner.commit(x);
    },
    signPartial(handle, pkg) {
      warn("frost-partial-signer: PARTIAL-SIGNING WITH THE INSECURE SOFTWARE FAKE - NOT hardware");
      return inner.signPartial(handle, pkg);
    },
  };
}

/**
 * The unbuilt rung. Present so the shape of a real one is written down; throws so that
 * the NonExtractingBoundarySigner branch has no inhabitant anywhere in this repository.
 *
 * A real implementation must, ON THE CHIP: generate d_i and e_i, keep them there,
 * enforce one partial per nonce pair, accept the commitment list and message as
 * inputs, and emit only z_i. See the PKCS#11 finding in this file header for why no
 * general-purpose token can be driven into that shape from outside.
 */
export function createNonExtractingPartialSignerStub(): NonExtractingBoundarySigner {
  throw new Error(
    "frost-partial-signer: no non-extracting signer exists. use-without-extract needs " +
      "FROST-aware firmware (a programmable applet or a purpose-built device); no PKCS#11 " +
      "mechanism composes a partial from a sensitive key. Choose an extract-capable tier " +
      "and declare it.",
  );
}

// ============================================================================
// Coordinator combine -- where a mismatched tier is refused
// ============================================================================

/**
 * Aggregate partials into a 64-byte Ed25519 signature (R concatenated with z).
 *
 * Refuses, never repairs:
 *   * any partial whose sealTier differs from the tier the session declared,
 *   * a participant who did not commit,
 *   * a duplicate participant,
 *   * a partial set that is not exactly the committed set.
 *
 * The first of these is the analogue of the storage port rule that seal tiers must
 * match on load: a fake partial cannot be quietly folded into a run that declared
 * hardware. R is recomputed from the commitments rather than taken from any
 * participant.
 */
export function combineFrostPartials(
  pkg: FrostSigningPackage,
  partials: readonly FrostPartialSignature[],
): Uint8Array {
  assertWellFormedPackage(pkg);
  const expected = new Set(pkg.commitments.map((c) => c.x));
  const seen = new Set<number>();
  let z = Fn.ZERO;
  for (const p of partials) {
    if (p.sealTier !== pkg.requiredSealTier) {
      throw new Error(
        `frost-partial-signer: refusing partial from participant ${String(p.x)}: produced at ` +
          `"${p.sealTier}" but the session declared "${pkg.requiredSealTier}". ` +
          describeSealTierGap(pkg.requiredSealTier, p.sealTier),
      );
    }
    if (!expected.has(p.x)) {
      throw new Error(`frost-partial-signer: partial from participant ${String(p.x)} who did not commit`);
    }
    if (seen.has(p.x)) {
      throw new Error(`frost-partial-signer: duplicate partial from participant ${String(p.x)}`);
    }
    seen.add(p.x);
    z = Fn.add(z, p.z);
  }
  if (seen.size !== expected.size) {
    throw new Error(
      "frost-partial-signer: expected " +
        `${String(expected.size)} partials to match the commitment list, got ${String(seen.size)}`,
    );
  }
  return concatBytes(frostGroupCommitment(pkg), numberToBytesLE(z, 32));
}
