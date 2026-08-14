// frost-partial-signer.ts -- CI-SAFE LANE (081KWPHRNFW DoD item 6).
//
// No TPM, no token, no shell. There is no hardware lane for this file because there is
// no hardware adapter: the non-extracting rung is a throwing stub, and FPS-14 asserts
// that nothing in the module reaches it.
//
// The tests are about three things, in order of how easy each would be to fake:
//   1. the protocol is actually right (the aggregate verifies under stock Ed25519),
//   2. the nonce cannot be reused and the coordinator cannot substitute commitments,
//   3. the claim in the type is the claim in the object.

import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { frostKeygen, frostVerify } from "./frost.ts";
import {
  createInsecureFakeHsmShareAdapter,
  createSoftwareFileShareAdapter,
  type FrostSealTier,
} from "./frost-share-adapter.ts";
import type { FrostCaCustodyEffects } from "./frost-ca-custody.ts";
import {
  combineFrostPartials,
  createInsecureFakePartialSigner,
  createNonExtractingPartialSignerStub,
  createSoftwarePartialSigner,
  frostGroupCommitment,
  type FrostNonceCommitment,
  type FrostPartialSignature,
  type FrostPartialSigner,
  type FrostSigningPackage,
} from "./frost-partial-signer.ts";

function sandboxFx(): { fx: FrostCaCustodyEffects; root: string } {
  const root = mkdtempSync(join(tmpdir(), "zeta-frost-partial-"));
  const files = new Map<string, string>();
  const fx: FrostCaCustodyEffects = {
    exists: (q) => files.has(q),
    readText: (q) => files.get(q) ?? "",
    writeText: (q, c) => {
      files.set(q, c);
    },
    mkdirp: () => {},
  };
  return { fx, root };
}

const MESSAGE = new TextEncoder().encode("zeta frost partial signing");

/** Deterministic byte source so a failure is reproducible (DST discipline). */
function seededBytes(seed: number): (n: number) => Uint8Array {
  let s = seed >>> 0;
  return (n: number) => {
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      out[i] = (s >>> 24) & 0xff;
    }
    return out;
  };
}

function toHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

interface Fixture {
  readonly groupPublicKey: Uint8Array;
  readonly signers: readonly FrostPartialSigner[];
}

function fixture(threshold = 2, total = 3): Fixture {
  const { fx, root } = sandboxFx();
  const kg = frostKeygen(threshold, total, () => 0.5);
  const adapter = createSoftwareFileShareAdapter(fx, root, "ca");
  for (const s of kg.shares) {
    adapter.storeShare(
      {
        x: s.x,
        secretShare: s.secretShare,
        threshold,
        totalShares: total,
        groupPublicKeyHex: toHex(kg.groupPublicKey),
      },
      "ca",
    );
  }
  const signers = kg.shares.map((_, i) =>
    createSoftwarePartialSigner(adapter, { randomBytes: seededBytes(i + 1) }),
  );
  return { groupPublicKey: kg.groupPublicKey, signers };
}

function runRound(f: Fixture, indices: readonly number[], requiredSealTier: FrostSealTier = "software-plaintext") {
  const committed = indices.map((x, i) => {
    const signer = f.signers[i]!;
    return { signer, ...signer.commit(x) };
  });
  const commitments: FrostNonceCommitment[] = committed
    .map((c) => c.commitment)
    .slice()
    .sort((a, b) => a.x - b.x);
  const pkg: FrostSigningPackage = {
    message: MESSAGE,
    groupPublicKey: f.groupPublicKey,
    commitments,
    requiredSealTier,
  };
  const partials = committed.map((c) => c.signer.signPartial(c.handle, pkg));
  return { pkg, partials, committed };
}

describe("FrostPartialSigner: the protocol is right", () => {
  test("FPS-1: a two-round threshold sign verifies under stock RFC 8032 Ed25519", () => {
    const f = fixture(2, 3);
    const { pkg, partials } = runRound(f, [1, 2]);
    const sig = combineFrostPartials(pkg, partials);
    expect(sig.length).toBe(64);
    expect(frostVerify(f.groupPublicKey, MESSAGE, sig)).toBe(true);
  });

  test("FPS-2: a different quorum of the same key also verifies", () => {
    const f = fixture(2, 3);
    const { pkg, partials } = runRound(f, [2, 3]);
    expect(frostVerify(f.groupPublicKey, MESSAGE, combineFrostPartials(pkg, partials))).toBe(true);
  });

  test("FPS-3: the signature does not verify for a message it was not made over", () => {
    const f = fixture(2, 3);
    const { pkg, partials } = runRound(f, [1, 2]);
    const sig = combineFrostPartials(pkg, partials);
    expect(frostVerify(f.groupPublicKey, new TextEncoder().encode("other"), sig)).toBe(false);
  });

  test("FPS-4: the coordinator derives R from public data alone and agrees with the signature", () => {
    const f = fixture(2, 3);
    const { pkg, partials } = runRound(f, [1, 2]);
    const sig = combineFrostPartials(pkg, partials);
    expect(Array.from(sig.slice(0, 32))).toEqual(Array.from(frostGroupCommitment(pkg)));
  });

  test("FPS-5: the binding factor is load-bearing -- a tampered message changes R", () => {
    const f = fixture(2, 3);
    const { pkg } = runRound(f, [1, 2]);
    const other: FrostSigningPackage = { ...pkg, message: new TextEncoder().encode("other") };
    expect(toHex(frostGroupCommitment(pkg))).not.toBe(toHex(frostGroupCommitment(other)));
  });
});

describe("FrostPartialSigner: nonces are single-use and coordinator-bound", () => {
  test("FPS-6: a handle cannot be used twice", () => {
    const f = fixture(2, 3);
    const { pkg, committed } = runRound(f, [1, 2]);
    expect(() => committed[0]!.signer.signPartial(committed[0]!.handle, pkg)).toThrow(
      /unknown or already consumed/,
    );
  });

  test("FPS-7: a nonce is burned even when signPartial FAILS, so a retry cannot reuse it", () => {
    const f = fixture(2, 3);
    const a = f.signers[0]!.commit(1);
    const b = f.signers[1]!.commit(2);
    const commitments = [a.commitment, b.commitment].sort((x, y) => x.x - y.x);
    const wrongTier: FrostSigningPackage = {
      message: MESSAGE,
      groupPublicKey: f.groupPublicKey,
      commitments,
      requiredSealTier: "hardware-pkcs11",
    };
    expect(() => f.signers[0]!.signPartial(a.handle, wrongTier)).toThrow(/no-silent-downgrade/);
    const rightTier: FrostSigningPackage = { ...wrongTier, requiredSealTier: "software-plaintext" };
    expect(() => f.signers[0]!.signPartial(a.handle, rightTier)).toThrow(/unknown or already consumed/);
  });

  test("FPS-8: a substituted commitment for this participant is refused, either half", () => {
    // Both halves are exercised SEPARATELY on purpose. Swapping both at once leaves a
    // mutation that removes one of the two comparisons alive: the surviving half still
    // catches it, and the test passes while half the guard is gone.
    const swapHiding = (): void => {
      const f = fixture(2, 3);
      const a = f.signers[0]!.commit(1);
      const b = f.signers[1]!.commit(2);
      const forged: FrostNonceCommitment = {
        x: 1,
        hidingCommitment: b.commitment.hidingCommitment,
        bindingCommitment: a.commitment.bindingCommitment,
      };
      const pkg: FrostSigningPackage = {
        message: MESSAGE,
        groupPublicKey: f.groupPublicKey,
        commitments: [forged, b.commitment],
        requiredSealTier: "software-plaintext",
      };
      f.signers[0]!.signPartial(a.handle, pkg);
    };
    const swapBinding = (): void => {
      const f = fixture(2, 3);
      const a = f.signers[0]!.commit(1);
      const b = f.signers[1]!.commit(2);
      const forged: FrostNonceCommitment = {
        x: 1,
        hidingCommitment: a.commitment.hidingCommitment,
        bindingCommitment: b.commitment.bindingCommitment,
      };
      const pkg: FrostSigningPackage = {
        message: MESSAGE,
        groupPublicKey: f.groupPublicKey,
        commitments: [forged, b.commitment],
        requiredSealTier: "software-plaintext",
      };
      f.signers[0]!.signPartial(a.handle, pkg);
    };
    expect(swapHiding).toThrow(/not the one this signer issued/);
    expect(swapBinding).toThrow(/not the one this signer issued/);
  });

  test("FPS-9: an unsorted or duplicated commitment list is refused, not repaired", () => {
    const f = fixture(2, 3);
    const a = f.signers[0]!.commit(1);
    const b = f.signers[1]!.commit(2);
    const unsorted: FrostSigningPackage = {
      message: MESSAGE,
      groupPublicKey: f.groupPublicKey,
      commitments: [b.commitment, a.commitment],
      requiredSealTier: "software-plaintext",
    };
    expect(() => f.signers[0]!.signPartial(a.handle, unsorted)).toThrow(/not sorted ascending/);
    const dup: FrostSigningPackage = { ...unsorted, commitments: [a.commitment, a.commitment] };
    expect(() => frostGroupCommitment(dup)).toThrow(/duplicate participant/);
  });

  test("FPS-9b: a malformed package is refused before any secret is touched", () => {
    const f = fixture(2, 3);
    const a = f.signers[0]!.commit(1);
    const b = f.signers[1]!.commit(2);
    const good: FrostSigningPackage = {
      message: MESSAGE,
      groupPublicKey: f.groupPublicKey,
      commitments: [a.commitment, b.commitment],
      requiredSealTier: "software-plaintext",
    };
    // Empty list: R would otherwise be the identity point and the aggregate would be a
    // signature over a group commitment nobody contributed to.
    expect(() => frostGroupCommitment({ ...good, commitments: [] })).toThrow(/empty commitment list/);
    expect(() => combineFrostPartials({ ...good, commitments: [] }, [])).toThrow(/empty commitment list/);
    // x = 0 is f(0), which IS the secret; it must never appear as a participant.
    const zeroIndexed = { ...a.commitment, x: 0 };
    expect(() => frostGroupCommitment({ ...good, commitments: [zeroIndexed] })).toThrow(
      /positive integer/,
    );
    // A short group public key would silently change the challenge preimage.
    expect(() => frostGroupCommitment({ ...good, groupPublicKey: new Uint8Array(31) })).toThrow(
      /must be 32 bytes/,
    );
    // A short commitment point cannot be decompressed to a curve point.
    const shortPoint = { ...a.commitment, hidingCommitment: new Uint8Array(31) };
    expect(() => frostGroupCommitment({ ...good, commitments: [shortPoint] })).toThrow(
      /two 32-byte points/,
    );
  });

  test("FPS-10: two commits from one signer never repeat a commitment or a session id", () => {
    const f = fixture(2, 3);
    const first = f.signers[0]!.commit(1);
    const second = f.signers[0]!.commit(1);
    expect(toHex(first.commitment.hidingCommitment)).not.toBe(toHex(second.commitment.hidingCommitment));
    expect(toHex(first.commitment.bindingCommitment)).not.toBe(toHex(second.commitment.bindingCommitment));
    expect(first.handle.sessionId).not.toBe(second.handle.sessionId);
  });
});

describe("FrostPartialSigner: the port returns no scalar", () => {
  test("FPS-11: nothing on the signer surface hands back a share or a nonce", () => {
    const f = fixture(2, 3);
    const signer = f.signers[0]!;
    expect(new Set(Object.keys(signer))).toEqual(
      new Set(["sealTier", "exposureBoundary", "usesWithoutExtract", "commit", "signPartial"]),
    );
    const round1 = signer.commit(1);
    expect(new Set(Object.keys(round1))).toEqual(new Set(["commitment", "handle"]));
    expect(new Set(Object.keys(round1.handle))).toEqual(new Set(["x", "sessionId", "sealTier"]));
    // The handle is an index, not a secret: no curve scalar may ride on it.
    for (const v of Object.values(round1.handle)) expect(typeof v).not.toBe("bigint");
    for (const v of Object.values(round1.commitment)) expect(typeof v).not.toBe("bigint");
  });
});

describe("FrostPartialSigner: honesty of the claim", () => {
  test("FPS-12: the software signer declares signer-function, NOT the invariant", () => {
    const f = fixture(2, 3);
    for (const s of f.signers) {
      expect(s.exposureBoundary).toBe("signer-function");
      expect(s.usesWithoutExtract).toBe(false);
    }
  });

  test("FPS-13: the non-extracting rung is not implemented, and says why", () => {
    expect(() => createNonExtractingPartialSignerStub()).toThrow(/FROST-aware firmware/);
    expect(() => createNonExtractingPartialSignerStub()).toThrow(/no PKCS#11/);
  });

  test("FPS-14: NO exported factory produces a hardware-boundary signer", async () => {
    // The type permits usesWithoutExtract: true only together with
    // exposureBoundary: "hardware-boundary". This walks every exported factory and
    // asserts none reaches that branch, so the claim is unmade in FACT, not in prose.
    const mod = (await import("./frost-partial-signer.ts")) as Record<string, unknown>;
    const { fx, root } = sandboxFx();
    const built: Array<{ usesWithoutExtract: unknown; exposureBoundary: unknown }> = [];
    let factories = 0;
    for (const [name, value] of Object.entries(mod)) {
      if (typeof value !== "function" || !name.startsWith("create")) continue;
      factories++;
      try {
        const made =
          name === "createInsecureFakePartialSigner"
            ? (value as (...a: unknown[]) => unknown)(fx, root, "ca", {
                iUnderstandThisIsNotHardware: true,
                warn: () => {},
              })
            : (value as (...a: unknown[]) => unknown)(createSoftwareFileShareAdapter(fx, root, "ca"));
        built.push(made as { usesWithoutExtract: unknown; exposureBoundary: unknown });
      } catch {
        // A factory that refuses to build (the stub) claims nothing, which is the point.
      }
    }
    expect(factories).toBeGreaterThanOrEqual(3);
    expect(built.length).toBeGreaterThan(0);
    for (const s of built) {
      expect(s.usesWithoutExtract).toBe(false);
      expect(s.exposureBoundary).not.toBe("hardware-boundary");
    }
  });

  test("FPS-15: partials carry the boundary and tier they were made at", () => {
    const f = fixture(2, 3);
    const { partials } = runRound(f, [1, 2]);
    for (const p of partials) {
      expect(p.exposureBoundary).toBe("signer-function");
      expect(p.sealTier).toBe("software-plaintext");
    }
  });
});

describe("FrostPartialSigner: the fake cannot pass as hardware", () => {
  test("FPS-16: the fake signer needs the explicit acknowledgement", () => {
    const { fx, root } = sandboxFx();
    const noAck = {} as { iUnderstandThisIsNotHardware: true };
    expect(() => createInsecureFakePartialSigner(fx, root, "ca", noAck)).toThrow(/acknowledgement/);
  });

  test("FPS-17: a fake signer REFUSES a session that declared hardware, and warns", () => {
    const { fx, root } = sandboxFx();
    const warnings: string[] = [];
    const fake = createInsecureFakePartialSigner(fx, root, "ca", {
      iUnderstandThisIsNotHardware: true,
      warn: (m: string) => warnings.push(m),
    });
    expect(fake.sealTier).toBe("INSECURE-SOFTWARE-FAKE-HSM");
    const handle = { x: 1, sessionId: "no-such-session", sealTier: fake.sealTier };
    const hardwarePkg: FrostSigningPackage = {
      message: MESSAGE,
      groupPublicKey: new Uint8Array(32),
      commitments: [{ x: 1, hidingCommitment: new Uint8Array(32), bindingCommitment: new Uint8Array(32) }],
      requiredSealTier: "hardware-pkcs11",
    };
    expect(() => fake.signPartial(handle, hardwarePkg)).toThrow();
    expect(warnings.some((w) => w.includes("NOT hardware"))).toBe(true);
  });

  test("FPS-17b: the fake CAN sign a fake-declared session, so FPS-17 is not vacuous", () => {
    // Without this, "the fake refuses hardware" would be indistinguishable from "the
    // fake refuses everything", and the refusal test would prove nothing.
    const { fx, root } = sandboxFx();
    const ack = { iUnderstandThisIsNotHardware: true as const, warn: () => {} };
    const kg = frostKeygen(1, 1, () => 0.5);
    // Seed the share through a fake-tier adapter so the tiers match on load.
    const seeder = createInsecureFakeHsmShareAdapter(fx, root, "ca", ack);
    seeder.storeShare(
      {
        x: 1,
        secretShare: kg.shares[0]!.secretShare,
        threshold: 1,
        totalShares: 1,
        groupPublicKeyHex: toHex(kg.groupPublicKey),
      },
      "ca",
    );
    const fake = createInsecureFakePartialSigner(fx, root, "ca", ack, { randomBytes: seededBytes(7) });
    const round1 = fake.commit(1);
    const pkg: FrostSigningPackage = {
      message: MESSAGE,
      groupPublicKey: kg.groupPublicKey,
      commitments: [round1.commitment],
      requiredSealTier: "INSECURE-SOFTWARE-FAKE-HSM",
    };
    const partial = fake.signPartial(round1.handle, pkg);
    expect(partial.sealTier).toBe("INSECURE-SOFTWARE-FAKE-HSM");
    const sig = combineFrostPartials(pkg, [partial]);
    expect(frostVerify(kg.groupPublicKey, MESSAGE, sig)).toBe(true);
  });

  test("FPS-18: combine REFUSES a partial produced at a tier the session did not declare", () => {
    const f = fixture(2, 3);
    const { pkg, partials } = runRound(f, [1, 2]);
    const swapped: FrostPartialSignature[] = [
      partials[0]!,
      { ...partials[1]!, sealTier: "INSECURE-SOFTWARE-FAKE-HSM" },
    ];
    expect(() => combineFrostPartials(pkg, swapped)).toThrow(/but the session declared/);
    // And the reverse direction, so the check is not one-sided.
    const fakePkg: FrostSigningPackage = { ...pkg, requiredSealTier: "INSECURE-SOFTWARE-FAKE-HSM" };
    expect(() => combineFrostPartials(fakePkg, partials)).toThrow(/but the session declared/);
  });

  test("FPS-19: combine refuses duplicates, strangers, and short sets", () => {
    const f = fixture(2, 3);
    const { pkg, partials } = runRound(f, [1, 2]);
    expect(() => combineFrostPartials(pkg, [partials[0]!, partials[0]!])).toThrow(/duplicate partial/);
    expect(() => combineFrostPartials(pkg, [partials[0]!])).toThrow(/to match the commitment list/);
    const stranger: FrostPartialSignature = { ...partials[0]!, x: 9 };
    expect(() => combineFrostPartials(pkg, [stranger, partials[1]!])).toThrow(/did not commit/);
  });
});
