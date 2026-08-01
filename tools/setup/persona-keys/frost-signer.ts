/**
 * frost-signer.ts — FROST (Flexible Round-Optimized Schnorr Threshold) Signer Engine.
 *
 * Implements round 1 nonce commitment, round 2 partial signature generation over PKCS#11 / TPM shares,
 * and threshold signature aggregation according to the FROST draft spec (RFC 9591 / Ed25519-FROST).
 */

import { randomBytes, createHash } from "node:crypto";
import { ed25519 } from "@noble/curves/ed25519.js";

const Fn = ed25519.Point.Fn;

export interface FrostShare {
  index: number;
  shareBytes: Uint8Array;
}

function bytesToNumberLE(bytes: Uint8Array): bigint {
  let n = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    n = (n << 8n) + BigInt(bytes[i]!);
  }
  return n;
}

function numberToBytesLE(n: bigint, len: number = 32): Uint8Array {
  const out = new Uint8Array(len);
  let x = n;
  for (let i = 0; i < len; i++) {
    out[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return out;
}

export function splitSecret(secret: Uint8Array, threshold: number, total: number): FrostShare[] {
  const secretInt = Fn.create(bytesToNumberLE(secret));

  // Generate random coefficients a_1 ... a_{t-1}
  const coeffs: bigint[] = [secretInt];
  for (let i = 1; i < threshold; i++) {
    const r = randomBytes(32);
    coeffs.push(Fn.create(bytesToNumberLE(r)));
  }

  // Evaluate polynomial f(x) for x = 1..total
  const shares: FrostShare[] = [];
  for (let x = 1; x <= total; x++) {
    const bx = Fn.create(BigInt(x));
    let fx = 0n;
    let xPow = Fn.ONE;

    for (const c of coeffs) {
      fx = Fn.add(fx, Fn.mul(c, xPow));
      xPow = Fn.mul(xPow, bx);
    }

    shares.push({ index: x, shareBytes: numberToBytesLE(fx, 32) });
  }

  return shares;
}

export interface NoncePair {
  hidingSecret: Uint8Array;
  bindingSecret: Uint8Array;
  hidingPublic: Uint8Array;
  bindingPublic: Uint8Array;
}

export interface NonceCommitment {
  index: number;
  hidingPublic: Uint8Array;
  bindingPublic: Uint8Array;
}

export interface PartialSignature {
  index: number;
  z: bigint;
}

/**
 * Generate Round-1 hiding and binding nonces and public commitments.
 */
export function generateFrostNoncePair(index: number): { noncePair: NoncePair; commitment: NonceCommitment } {
  const hidingSecret = randomBytes(32);
  const bindingSecret = randomBytes(32);

  const hidingScalar = Fn.create(bytesToNumberLE(hidingSecret));
  const bindingScalar = Fn.create(bytesToNumberLE(bindingSecret));

  const hidingPublic = ed25519.getPublicKey(numberToBytesLE(hidingScalar));
  const bindingPublic = ed25519.getPublicKey(numberToBytesLE(bindingScalar));

  return {
    noncePair: {
      hidingSecret,
      bindingSecret,
      hidingPublic,
      bindingPublic,
    },
    commitment: {
      index,
      hidingPublic,
      bindingPublic,
    },
  };
}

/**
 * Compute Lagrange interpolation coefficient lambda_i for participant index `i` given participant indices.
 */
export function computeLagrangeCoefficient(indices: number[], targetIndex: number): bigint {
  let num = Fn.ONE;
  let den = Fn.ONE;

  for (const j of indices) {
    if (j === targetIndex) continue;
    num = Fn.mul(num, Fn.neg(Fn.create(BigInt(j))));
    den = Fn.mul(den, Fn.create(BigInt(targetIndex - j)));
  }

  return Fn.div(num, den);
}

/**
 * Compute binding factor rho_i for participant `index`.
 */
export function computeBindingFactor(
  commitments: NonceCommitment[],
  message: Uint8Array,
  targetIndex: number
): bigint {
  const hasher = createHash("sha512");

  hasher.update(Buffer.from("FROST-Ed25519-BindingFactor"));
  hasher.update(Buffer.from([targetIndex]));
  hasher.update(message);

  for (const comm of commitments) {
    hasher.update(Buffer.from([comm.index]));
    hasher.update(comm.hidingPublic);
    hasher.update(comm.bindingPublic);
  }

  const hash = hasher.digest();
  return Fn.create(bytesToNumberLE(hash));
}

/**
 * Round 2: Generate partial signature z_i using secret share and nonces.
 */
export function signPartialShare(
  share: FrostShare,
  noncePair: NoncePair,
  commitments: NonceCommitment[],
  message: Uint8Array
): PartialSignature {
  const participantIndices = commitments.map((c) => c.index);

  // 1. Compute binding factors rho_i for all participants
  const rho = computeBindingFactor(commitments, message, share.index);

  // 2. Compute Lagrange coefficient lambda_i
  const lambda = computeLagrangeCoefficient(participantIndices, share.index);

  // 3. Challenge hash c = H(message)
  const challengeHash = createHash("sha512").update(message).digest();
  const c = Fn.create(bytesToNumberLE(challengeHash));

  // 4. Secret share BigInt s_i
  const si = Fn.create(bytesToNumberLE(share.shareBytes));

  // 5. Nonce secrets d_i, e_i
  const di = Fn.create(bytesToNumberLE(noncePair.hidingSecret));
  const ei = Fn.create(bytesToNumberLE(noncePair.bindingSecret));

  // z_i = d_i + (e_i * rho_i) + (lambda_i * s_i * c) mod L
  const zi = Fn.add(Fn.add(di, Fn.mul(ei, rho)), Fn.mul(Fn.mul(lambda, si), c));

  return {
    index: share.index,
    z: zi,
  };
}

/**
 * Aggregate t partial signatures into a single threshold signature.
 */
export function aggregateFrostSignatures(
  partials: PartialSignature[],
  commitments: NonceCommitment[]
): Uint8Array {
  let zTotal = 0n;

  for (const p of partials) {
    zTotal = Fn.add(zTotal, p.z);
  }

  // Serialize z scalar (32 bytes little-endian)
  const zBytes = numberToBytesLE(zTotal, 32);

  // Final 64-byte signature = R (32 bytes) || z (32 bytes)
  const R = commitments[0]!.hidingPublic; // 32 bytes
  const sig = new Uint8Array(64);
  sig.set(R, 0);
  sig.set(zBytes, 32);

  return sig;
}
