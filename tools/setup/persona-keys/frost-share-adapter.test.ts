// frost-share-adapter.ts -- CI-SAFE LANE (081KWPHRNFW DoD item 5).
//
// Everything here runs on any runner: no TPM, no PKCS#11 token, no shell.
// Real-hardware coverage lives in frost-share-adapter.hardware.test.ts, which is
// opt-in and refuses to pass vacuously.
//
// The tests below are mostly about the ANTI-VACUITY machinery rather than about
// round-tripping, because round-tripping is what the previous version of this file
// tested and it is what let a software fake pass as hardware.

import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertNoSilentSealTierDowngrade,
  createHsmShareAdapter,
  createHsmShareAdapterStub,
  createInsecureFakeHsmShareAdapter,
  createPkcs11ShareAdapter,
  createSealedFileShareAdapter,
  createSoftwareFileShareAdapter,
  createTpmSealEffects,
  createTpmShareAdapter,
  defaultPointerOf,
  describeAttachedPkcs11Tokens,
  FROST_SEALED_SHARE_SCHEMA_V1,
  INSECURE_FAKE_SEAL_ALG,
  isHardwareSealTier,
  isHostRamAtUseSealTier,
  isHsmResidentSealTier,
  parseCkTokenInfoIdentity,
  resolveSlotForTokenIdentity,
  SEAL_TIER_KEY_RESIDENCY,
  sealKeyEntersHostRam,
  sealKeyResidencyOf,
  type ExtractingFrostShareAdapter,
  type FrostSealTier,
  type FrostShareAdapter,
  type Pkcs11Lib,
  type Pkcs11PointerOf,
} from "./frost-share-adapter.ts";
import { frostSharePath, type FrostCaCustodyEffects } from "./frost-ca-custody.ts";
import {
  assertRosterSound,
  collectSealBindings,
  FROST_TOKEN_ROSTER_SCHEMA,
  type FrostRosterEffects,
  type FrostTokenRoster,
} from "./frost-token-roster.ts";

function sandboxFx(): { fx: FrostCaCustodyEffects; root: string; files: Map<string, string> } {
  const root = mkdtempSync(join(tmpdir(), "zeta-frost-adapter-"));
  const files = new Map<string, string>();
  const fx: FrostCaCustodyEffects = {
    exists: (p) => files.has(p),
    readText: (p) => files.get(p) ?? "",
    writeText: (p, c) => {
      files.set(p, c);
    },
    mkdirp: () => {},
  };
  return { fx, root, files };
}

const REC = {
  x: 1,
  secretShare: 987654321n,
  threshold: 2,
  totalShares: 3,
  groupPublicKeyHex: "cc".repeat(32),
};

/** Build a raw CK_TOKEN_INFO the way a real module does: blank-padded, NOT NUL-terminated. */
function mockCkTokenInfo(label: string, serial: string): Uint8Array {
  const info = new Uint8Array(1024).fill(0x20); // 0x20 = ' ', the PKCS#11 pad byte
  info.set(new TextEncoder().encode(label.padEnd(32, " ").slice(0, 32)), 0);
  info.set(new TextEncoder().encode("Yubico".padEnd(32, " ")), 32);
  info.set(new TextEncoder().encode("YubiKey".padEnd(16, " ")), 64);
  info.set(new TextEncoder().encode(serial.padEnd(16, " ").slice(0, 16)), 80);
  return info;
}

/** A PKCS#11 token that is present, holds the key, and XOR-"encrypts".
 *  `serial` is what distinguishes one physical token from another below. */
function mockToken(opts: { keyPresent?: boolean; serial?: string; label?: string } = {}): Pkcs11Lib {
  const keyPresent = opts.keyPresent ?? true;
  const serial = opts.serial ?? "0000001";
  const label = opts.label ?? "zeta-guard";
  return {
    C_Initialize: () => 0n,
    C_Finalize: () => 0n,
    C_GetSlotList: () => 0n,
    C_GetTokenInfo: (_slot, pInfo) => {
      (pInfo as Uint8Array).set(mockCkTokenInfo(label, serial));
      return 0n;
    },
    C_OpenSession: (_s, _f, _a, _n, phSession) => {
      phSession[0] = 123n;
      return 0n;
    },
    C_CloseSession: () => 0n,
    C_Login: () => 0n,
    C_Logout: () => 0n,
    C_FindObjectsInit: () => 0n,
    C_FindObjects: (_s, phObject, _max, pulCount) => {
      phObject[0] = keyPresent ? 999n : 0n;
      pulCount[0] = keyPresent ? 1n : 0n;
      return 0n;
    },
    C_FindObjectsFinal: () => 0n,
    C_EncryptInit: () => 0n,
    C_Encrypt: (_s, pData, ulDataLen, pOut, pulOutLen) => {
      const len = Number(ulDataLen);
      if (!pOut || pOut === 0n) {
        pulOutLen[0] = BigInt(len);
        return 0n;
      }
      const src = pData as Uint8Array;
      const dst = pOut as Uint8Array;
      for (let i = 0; i < len; i++) dst[i] = (src[i] ?? 0) ^ 0xff;
      pulOutLen[0] = BigInt(len);
      return 0n;
    },
    C_DecryptInit: () => 0n,
    C_Decrypt: (_s, pIn, ulInLen, pOut, pulOutLen) => {
      const len = Number(ulInLen);
      if (!pOut || pOut === 0n) {
        pulOutLen[0] = BigInt(len);
        return 0n;
      }
      const src = pIn as Uint8Array;
      const dst = pOut as Uint8Array;
      for (let i = 0; i < len; i++) dst[i] = (src[i] ?? 0) ^ 0xff;
      pulOutLen[0] = BigInt(len);
      return 0n;
    },
  };
}

/** Mocks never dereference, so a stub pointer is correct here and must be DECLARED. */
const stubPointerOf: Pkcs11PointerOf = () => 1n;

interface MockSlot {
  readonly slotId: number;
  readonly serial: string;
  readonly label?: string;
}

/** CKR_SLOT_ID_INVALID -- what a real module returns for a slot that is not there. */
const CKR_SLOT_ID_INVALID = 0x03n;

/**
 * A PKCS#11 MODULE with several slots, each holding a distinct token.
 *
 * mockToken() above models one device and answers C_GetTokenInfo the same way for every
 * slot, which is fine for binding tests and useless for ADDRESSING tests -- a mock where
 * every slot is the same device cannot tell a resolver that reached the right slot from
 * one that reached slot 0 and got lucky. This mock can: slots are distinct, an
 * unpopulated slot fails, and every opened slot is recorded so a test can assert on where
 * the adapter actually went rather than only on what it returned.
 */
function mockModule(slots: readonly MockSlot[]): Pkcs11Lib & { readonly opened: number[] } {
  const opened: number[] = [];
  const base = mockToken();
  const find = (slotId: number): MockSlot | undefined => slots.find((s) => s.slotId === slotId);
  return {
    ...base,
    opened,
    C_GetSlotList: (tokenPresent, pSlotList, pulCount) => {
      // tokenPresent must be CK_TRUE: an empty reader is not an addressable device.
      if (Number(tokenPresent) !== 1) return 0x05n;
      const count = pulCount as BigUint64Array;
      if (!pSlotList || pSlotList === 0n) {
        count[0] = BigInt(slots.length);
        return 0n;
      }
      const list = pSlotList as BigUint64Array;
      slots.forEach((s, i) => {
        list[i] = BigInt(s.slotId);
      });
      count[0] = BigInt(slots.length);
      return 0n;
    },
    C_GetTokenInfo: (slotID, pInfo) => {
      const s = find(Number(slotID));
      if (s === undefined) return CKR_SLOT_ID_INVALID;
      (pInfo as Uint8Array).set(mockCkTokenInfo(s.label ?? "zeta-guard", s.serial));
      return 0n;
    },
    C_OpenSession: (slotID, _f, _a, _n, phSession) => {
      opened.push(Number(slotID));
      if (find(Number(slotID)) === undefined) return CKR_SLOT_ID_INVALID;
      phSession[0] = 123n;
      return 0n;
    },
  };
}

describe("FrostShareAdapter: storage round-trips", () => {
  test("FSA-1: software adapter round-trips share", () => {
    const { fx, root } = sandboxFx();
    const adapter = createSoftwareFileShareAdapter(fx, root, "test-ca");
    adapter.storeShare({ ...REC, secretShare: 42n }, "test-ca");
    const loaded = adapter.loadShare(1);
    expect(loaded?.secretShare).toBe(42n);
    expect(loaded?.threshold).toBe(2);
    expect(adapter.sealTier).toBe("software-plaintext");
  });

  test("FSA-2: the bulk extraction path no longer exists on the module surface", async () => {
    // loadFrostKeyShares walked every index and returned every scalar in one array.
    // It was deleted with the port split; signing goes through FrostPartialSigner.
    // This asserts the ABSENCE, so re-adding it under the old name fails here.
    const mod = (await import("./frost-share-adapter.ts")) as Record<string, unknown>;
    expect(Object.keys(mod)).not.toContain("loadFrostKeyShares");
    const bulkNamed = Object.keys(mod).filter((k) => /^load.*Shares$/.test(k));
    expect(bulkNamed).toEqual([]);
  });

  test("FSA-3: HSM stub throws honestly", () => {
    const stub = createHsmShareAdapterStub();
    expect(stub.kind).toBe("hsm-stub");
    expect(() => stub.loadShare(1)).toThrow(/not implemented/);
  });

  test("FSA-4: sealed-file adapter leaves no plaintext secretShare on disk", () => {
    const { fx, root, files } = sandboxFx();
    const adapter = createSealedFileShareAdapter(fx, root, "sealed-ca", {
      getSealKey: () => new Uint8Array(32).fill(9),
      randomBytes: (len) => new Uint8Array(len).fill(7),
    });
    adapter.storeShare(REC, "sealed-ca");
    const onDisk = files.get(frostSharePath(root, 1)) ?? "";
    expect(onDisk).toContain("zeta-frost-share-sealed-v2");
    expect(onDisk).not.toContain("987654321");
    expect(adapter.loadShare(1)?.secretShare).toBe(987654321n);
  });

  test("FSA-5: pkcs11 adapter round-trips against a mock token", () => {
    const { fx, root } = sandboxFx();
    const adapter = createPkcs11ShareAdapter(fx, root, "pkcs11-ca", {
      libraryPath: "/mock/libpkcs11.so",
      pin: "1234",
      slotId: 1,
      keyLabel: "test-key-label",
      ffiLoader: () => mockToken(),
      pointerOf: stubPointerOf,
    });
    expect(adapter.sealTier).toBe("hardware-pkcs11");
    adapter.storeShare({ ...REC, secretShare: 12345n }, "pkcs11-ca");
    expect(adapter.loadShare(1)?.secretShare).toBe(12345n);
  });
});

describe("FrostShareAdapter: the fake cannot pass as hardware", () => {
  test("FSA-6: the fake refuses to be constructed without an explicit acknowledgement", () => {
    const { fx, root } = sandboxFx();
    // The cast models a caller who has NOT read the docs.
    const noAck = {} as { iUnderstandThisIsNotHardware: true };
    expect(() => createInsecureFakeHsmShareAdapter(fx, root, "ca", noAck)).toThrow(/acknowledgement/);
    expect(() =>
      createHsmShareAdapter(fx, root, "ca", { requireTier: "INSECURE-SOFTWARE-FAKE-HSM" }),
    ).toThrow(/fakeAck/);
  });

  test("FSA-7: the fake is distinguishable at runtime, at rest, and in the alg string", () => {
    const { fx, root, files } = sandboxFx();
    const warnings: string[] = [];
    const fake = createInsecureFakeHsmShareAdapter(fx, root, "ca", {
      iUnderstandThisIsNotHardware: true,
      warn: (m) => warnings.push(m),
    });

    // 1. runtime: the tier shouts, and it is not a hardware tier.
    expect(fake.sealTier).toBe("INSECURE-SOFTWARE-FAKE-HSM");
    expect(isHardwareSealTier(fake.sealTier)).toBe(false);

    // 2. at rest: the artifact carries the tier and a fake-specific alg, forever.
    fake.storeShare(REC, "ca");
    const onDisk = files.get(frostSharePath(root, 1)) ?? "";
    expect(onDisk).toContain("INSECURE-SOFTWARE-FAKE-HSM");
    expect(onDisk).toContain(INSECURE_FAKE_SEAL_ALG);

    // 3. loud: every seal and unseal warns.
    expect(warnings.length).toBeGreaterThan(0);
    fake.loadShare(1);
    expect(warnings.filter((w) => w.includes("NOT hardware")).length).toBe(2);
  });

  test("FSA-8: a hardware adapter REFUSES a fake-sealed artifact (downgrade caught at rest)", () => {
    const { fx, root } = sandboxFx();
    createInsecureFakeHsmShareAdapter(fx, root, "ca", {
      iUnderstandThisIsNotHardware: true,
      warn: () => {},
    }).storeShare(REC, "ca");

    // Same directory, same ca, real (mock-backed) hardware tier reading a fake share.
    const hw = createPkcs11ShareAdapter(fx, root, "ca", {
      libraryPath: "/mock/lib.so",
      slotId: 0,
      ffiLoader: () => mockToken(),
      pointerOf: stubPointerOf,
    });
    expect(() => hw.loadShare(1)).toThrow(/seal-tier mismatch/);
  });
});

describe("FrostShareAdapter: no-silent-downgrade", () => {
  test("FSA-9: an unavailable TPM THROWS at construction; there is no fallback", () => {
    const { fx, root } = sandboxFx();
    // This is the regression test for the defect the old FSA-9 masked: the previous
    // factory took allowSimulatorFallback, returned an adapter reporting the same kind
    // as the real one, and the flag was inert anyway because construction did no work.
    expect(() =>
      createHsmShareAdapter(fx, root, "ca", {
        requireTier: "hardware-tpm2",
        tpmOpts: {
          sealedKeyPath: "/nonexistent/sealed.key",
          run: () => {
            throw new Error("no TPM on this machine");
          },
        },
      }),
    ).toThrow(/no TPM on this machine/);
  });

  test("FSA-10: an absent PKCS#11 key THROWS at construction, not at first signature", () => {
    const { fx, root } = sandboxFx();
    let sealAttempted = false;
    expect(() =>
      createHsmShareAdapter(fx, root, "ca", {
        requireTier: "hardware-pkcs11",
        pkcs11Opts: {
          libraryPath: "/mock/lib.so",
          slotId: 0,
          ffiLoader: () => {
            sealAttempted = true;
            return mockToken({ keyPresent: false });
          },
          pointerOf: stubPointerOf,
        },
      }),
    ).toThrow(/no PKCS#11 key labelled/);
    // The eager probe is what made this fail here rather than much later.
    expect(sealAttempted).toBe(true);
  });

  test("FSA-11: the factory never returns a tier other than the one required", () => {
    const { fx, root } = sandboxFx();
    const built: FrostShareAdapter = createHsmShareAdapter(fx, root, "ca", {
      requireTier: "INSECURE-SOFTWARE-FAKE-HSM",
      fakeAck: { iUnderstandThisIsNotHardware: true, warn: () => {} },
    });
    expect(built.sealTier).toBe("INSECURE-SOFTWARE-FAKE-HSM");
    // Asking for hardware and supplying only fake options is an error, not a downgrade.
    expect(() =>
      createHsmShareAdapter(fx, root, "ca", {
        requireTier: "hardware-pkcs11",
        fakeAck: { iUnderstandThisIsNotHardware: true, warn: () => {} },
      }),
    ).toThrow(/pkcs11Opts required/);
  });

  test("FSA-12: defaultPointerOf refuses to hand NULL to a token when FFI is unavailable", () => {
    // Under Bun, FFI is present, so this asserts the real pointer path instead. Either
    // way the forbidden outcome -- silently returning 0n -- is excluded.
    let result: bigint | null = null;
    let threw = false;
    try {
      result = defaultPointerOf(new Uint8Array(8));
    } catch {
      threw = true;
    }
    expect(threw || (result !== null && result !== 0n)).toBe(true);
  });
});

// ============================================================================
// THE HSM/TPM CROSSING -- the gap between "key never in host RAM" and "key in host
// RAM while the seal is open", made impossible to cross silently.
// ============================================================================
//
// Owner call 2026-08-20: the TPM is assumed present on a Linux node, an HSM is OPTIONAL.
// So "caller declared hardware-pkcs11 on a machine that only has a TPM" is the ORDINARY
// configuration, and every test below is written as the common case, not the exotic one.

describe("FrostShareAdapter: HSM-resident vs TPM-sealed is readable off the tier", () => {
  test("FSA-TR1: the residency map is total, so a new tier cannot skip the question", () => {
    // Not a restatement of the type: it asserts that every INHABITANT has a value at
    // runtime. A tier added to the union without a row here fails to compile; a tier
    // added to the map without a union member is caught by this equality.
    const tiers: readonly FrostSealTier[] = [
      "software-plaintext",
      "software-sealed",
      "INSECURE-SOFTWARE-FAKE-HSM",
      "hardware-pkcs11",
      "hardware-tpm2",
    ];
    expect(Object.keys(SEAL_TIER_KEY_RESIDENCY).sort()).toEqual([...tiers].sort());
    for (const t of tiers) expect(sealKeyResidencyOf(t)).toBeDefined();
  });

  test("FSA-TR2: the two hardware tiers differ on whether the key enters host RAM", () => {
    // THE PROPERTY, read off the tier alone -- no adapter, no host, no comment.
    expect(sealKeyResidencyOf("hardware-pkcs11")).toBe("hardware-resident");
    expect(sealKeyResidencyOf("hardware-tpm2")).toBe("host-ram-at-use");
    expect(sealKeyEntersHostRam("hardware-pkcs11")).toBe(false);
    expect(sealKeyEntersHostRam("hardware-tpm2")).toBe(true);

    // And the OLD predicate cannot tell them apart, which is why it was not enough.
    expect(isHardwareSealTier("hardware-pkcs11")).toBe(true);
    expect(isHardwareSealTier("hardware-tpm2")).toBe(true);
    expect(isHsmResidentSealTier("hardware-pkcs11")).toBe(true);
    expect(isHsmResidentSealTier("hardware-tpm2")).toBe(false);
    expect(isHostRamAtUseSealTier("hardware-tpm2")).toBe(true);
  });
});

describe("FrostShareAdapter: a TPM-sealed backend can NEVER serve an HSM-resident caller", () => {
  /** A TPM backend that WORKS -- so the refusal cannot be mistaken for "no TPM here". */
  const workingTpmOpts = {
    sealedKeyPath: "/sealed/wrap.key",
    tpm2UnsealCmd: "tpm2_unseal",
    run: () => new Uint8Array(32).fill(3),
  };

  test("FSA-TR3: THE INVARIANT -- a working TPM backend labelled hardware-pkcs11 THROWS", () => {
    const { fx, root } = sandboxFx();
    // One wrong argument. Nothing else about this call is unusual, the TPM answers, and
    // before assertBackendCanClaimTier this produced an adapter that reported
    // hardware-pkcs11, wrote hardware-pkcs11 into the artifact, and unsealed its wrapping
    // key into host RAM on every load. That is the crossing.
    expect(() =>
      createSealedFileShareAdapter(fx, root, "ca", createTpmSealEffects(workingTpmOpts), "hardware-pkcs11"),
    ).toThrow(/seal-tier\/backend mismatch/);
    expect(() =>
      createSealedFileShareAdapter(fx, root, "ca", createTpmSealEffects(workingTpmOpts), "hardware-pkcs11"),
    ).toThrow(/HOST-COMPROMISE-AT-USE WINDOW/);
  });

  test("FSA-TR4: the same backend under its OWN tier builds and round-trips", () => {
    // The other half of a real falsifier: the refusal above must be about the LABEL, not
    // about the backend being broken. If this failed too, FSA-TR3 would prove nothing.
    const { fx, root } = sandboxFx();
    const honest = createSealedFileShareAdapter(fx, root, "ca", createTpmSealEffects(workingTpmOpts), "hardware-tpm2");
    expect(honest.sealTier).toBe("hardware-tpm2");
    honest.storeShare(REC, "ca");
    expect(honest.loadShare(1)?.secretShare).toBe(REC.secretShare);
  });

  test("FSA-TR5: an UNDECLARED backend cannot wear either hardware label", () => {
    const { fx, root } = sandboxFx();
    const anonymous = { getSealKey: () => new Uint8Array(32).fill(5) };
    for (const tier of ["hardware-pkcs11", "hardware-tpm2"] as const) {
      expect(() => createSealedFileShareAdapter(fx, root, "ca", anonymous, tier)).toThrow(
        /declares no keyResidency/,
      );
    }
    // Software tiers are unaffected: an omission there cannot buy a stronger claim.
    expect(createSealedFileShareAdapter(fx, root, "ca", anonymous, "software-sealed").sealTier).toBe(
      "software-sealed",
    );
  });
});

describe("FrostShareAdapter: assertNoSilentSealTierDowngrade, as a function", () => {
  // HONESTLY REGISTERED: the CALL SITE inside createHsmShareAdapter is defence in depth and
  // is currently unreachable-as-a-difference -- buildForTier is a total switch and every
  // branch constructs at the tier it was asked for, so deleting the throw there changes no
  // end-to-end outcome and NO end-to-end test can falsify it. Measured, not assumed: a
  // mutation that made the call site a no-op left 69/69 tests green.
  //
  // So the falsifier for this guard is the function itself, exercised directly. That is a
  // real test of a real refusal; it is not a test that the call site is reached.
  test("FSA-TR8: it throws on any mismatch, in both directions, and names the window", () => {
    expect(() => assertNoSilentSealTierDowngrade("hardware-pkcs11", "hardware-pkcs11")).not.toThrow();
    expect(() => assertNoSilentSealTierDowngrade("hardware-pkcs11", "hardware-tpm2")).toThrow(
      /HOST-COMPROMISE-AT-USE WINDOW/,
    );
    // A silent UPGRADE is refused too: the artifact records the tier it was sealed at, so
    // being handed a stronger adapter than declared produces files the caller cannot reopen.
    expect(() => assertNoSilentSealTierDowngrade("hardware-tpm2", "hardware-pkcs11")).toThrow(
      /no-silent-downgrade violation/,
    );
    expect(() => assertNoSilentSealTierDowngrade("hardware-tpm2", "INSECURE-SOFTWARE-FAKE-HSM")).toThrow(
      /strictly weaker/,
    );
  });
});

describe("FrostShareAdapter: the factory refusal names the property, not just the string", () => {
  test("FSA-TR6: declaring hardware-pkcs11 with only TPM options refuses and says why", () => {
    // The ordinary node, per the owner call: a TPM is there, an HSM is not.
    const { fx, root } = sandboxFx();
    let message = "";
    try {
      createHsmShareAdapter(fx, root, "ca", {
        requireTier: "hardware-pkcs11",
        tpmOpts: { sealedKeyPath: "/sealed/wrap.key", run: () => new Uint8Array(32).fill(3) },
      });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toMatch(/NOT a substitute/);
    expect(message).toMatch(/HOST-COMPROMISE-AT-USE WINDOW/);
    expect(message).toMatch(/optional hardware/);
  });

  test("FSA-TR7: a hardware-tpm2 artifact is refused by a hardware-pkcs11 adapter at rest", () => {
    // Belt and braces, one layer lower: even if a mislabelled adapter were somehow built,
    // the artifact records the tier it was sealed at and the tier check refuses it.
    const { fx, root } = sandboxFx();
    createSealedFileShareAdapter(
      fx,
      root,
      "ca",
      createTpmSealEffects({ sealedKeyPath: "/s.key", run: () => new Uint8Array(32).fill(3) }),
      "hardware-tpm2",
    ).storeShare(REC, "ca");

    const hsmSide = createSealedFileShareAdapter(
      fx,
      root,
      "ca",
      { getSealKey: () => new Uint8Array(32).fill(3), keyResidency: "hardware-resident" },
      "hardware-pkcs11",
    );
    expect(() => hsmSide.loadShare(1)).toThrow(/seal-tier mismatch/);
  });
});

describe("FrostShareAdapter: integrity and honesty", () => {
  test("FSA-13: no adapter claims use-without-extract", () => {
    const { fx, root } = sandboxFx();
    const adapters: ExtractingFrostShareAdapter[] = [
      createSoftwareFileShareAdapter(fx, root, "ca"),
      createHsmShareAdapterStub(),
      createSealedFileShareAdapter(fx, root, "ca", { getSealKey: () => new Uint8Array(32).fill(1) }),
      createInsecureFakeHsmShareAdapter(fx, root, "ca", { iUnderstandThisIsNotHardware: true, warn: () => {} }),
      createPkcs11ShareAdapter(fx, root, "ca", {
        libraryPath: "/mock/lib.so",
        slotId: 0,
        ffiLoader: () => mockToken(),
        pointerOf: stubPointerOf,
      }),
    ];
    for (const a of adapters) {
      expect(a.usesWithoutExtract).toBe(false);
      // Named for the forfeit, not just marked with it.
      expect(a.extractsScalar).toBe(true);
    }
  });

  test("FSA-17: storage and extraction are separate ports", () => {
    const { fx, root } = sandboxFx();
    const adapter = createSoftwareFileShareAdapter(fx, root, "ca");
    // A store-only view is a legitimate FrostShareAdapter and has NO read-back.
    const storeOnly: FrostShareAdapter = adapter;
    expect("loadShare" in storeOnly).toBe(true); // the object has it...
    expect(typeof (storeOnly as ExtractingFrostShareAdapter).extractsScalar).toBe("boolean");
    // ...but the base port does not declare it, which is what a consumer sees.
    const baseKeys: readonly string[] = ["kind", "sealTier", "storeShare"];
    for (const k of baseKeys) expect(k in adapter).toBe(true);
  });

  test("FSA-14: header tampering on a PKCS#11-sealed share is detected", () => {
    const { fx, root, files } = sandboxFx();
    const opts = {
      libraryPath: "/mock/lib.so",
      slotId: 0,
      ffiLoader: () => mockToken(),
      pointerOf: stubPointerOf,
    };
    createPkcs11ShareAdapter(fx, root, "ca", opts).storeShare(REC, "ca");

    // CKM_AES_CBC_PAD has no associated-data input, so without the in-plaintext binding
    // this edit would go unnoticed. Flip the group public key in the header.
    const p = frostSharePath(root, 1);
    const tampered = (files.get(p) ?? "").replace("cc".repeat(32), "dd".repeat(32));
    files.set(p, tampered);

    expect(() => createPkcs11ShareAdapter(fx, root, "ca", opts).loadShare(1)).toThrow(/seal-binding mismatch/);
  });

  test("FSA-15: a pre-tier v1 artifact is refused, not read at an unknown protection level", () => {
    const { fx, root, files } = sandboxFx();
    files.set(
      frostSharePath(root, 1),
      JSON.stringify({
        schema: FROST_SEALED_SHARE_SCHEMA_V1,
        ca: "ca",
        threshold: 2,
        totalShares: 3,
        groupPublicKeyHex: "cc".repeat(32),
        x: 1,
        sealed: { alg: "AES-256-GCM", nonceB64: "", ciphertextB64: "", tagB64: "" },
      }),
    );
    const adapter = createSealedFileShareAdapter(fx, root, "ca", {
      getSealKey: () => new Uint8Array(32).fill(9),
    });
    expect(() => adapter.loadShare(1)).toThrow(/refusing pre-tier sealed artifact/);
  });

  test("FSA-16: the TPM backend takes argv, so a shell string cannot masquerade as a chip", () => {
    const { fx, root } = sandboxFx();
    const seen: Array<{ cmd: string; args: readonly string[] }> = [];
    const adapter = createTpmShareAdapter(fx, root, "ca", {
      sealedKeyPath: "/path with spaces/sealed.key; echo pwned",
      run: (cmd, args) => {
        seen.push({ cmd, args });
        return new Uint8Array(32).fill(3);
      },
    });
    expect(adapter.sealTier).toBe("hardware-tpm2");
    // The path is a single argv element: no shell, so no interpolation and no injection.
    expect(seen[0]!.args).toEqual(["-c", "/path with spaces/sealed.key; echo pwned"]);
    adapter.storeShare(REC, "ca");
    expect(adapter.loadShare(1)?.secretShare).toBe(987654321n);
  });
});

// ============================================================================
// MULTI-TOKEN ROSTER: the count is where the defence comes from, not the tier
// ============================================================================
//
// Neither a YubiKey nor a YubiHSM reaches use-without-extract (see the file header and
// the PKCS#11 finding). So the security a token pack buys is DISTRIBUTION: N tokens each
// sealing a distinct share means compromising one token yields one share, which is below
// threshold and worth nothing on its own.
//
// That property is not free. It holds only if share i can be opened by token i AND BY NO
// OTHER TOKEN. The tempting provisioning shortcut -- put the same wrapping key on every
// token, so there is one PIN and a spare if one is lost -- silently converts an N-of-N
// roster into 1-of-N, and before sealedByToken there was nothing in the artifact, the
// types, or the logs that could tell the difference. These tests are that difference.

describe("FrostShareAdapter: multi-token roster", () => {
  const guard = (serial: string) => ({
    libraryPath: "/mock/pkcs11.so",
    slotId: 0,
    keyLabel: "zeta-frost-wrap",
    ffiLoader: () => mockToken({ serial }),
    pointerOf: defaultPointerOf as Pkcs11PointerOf,
  });

  test("FSA-20: a sealed share records WHICH token sealed it", () => {
    const { fx, root, files } = sandboxFx();
    const a = createPkcs11ShareAdapter(fx, root, "ca", guard("YK-11111"));
    a.storeShare(REC, "ca");
    const onDisk = files.get(frostSharePath(root, 1)) ?? "";
    expect(onDisk).toContain("zeta-guard#YK-11111");
    // The identity is a label and a serial. It must never be a secret.
    expect(onDisk).not.toContain(REC.secretShare.toString(10));
  });

  test("FSA-21: the sealing token opens its own share", () => {
    const { fx, root } = sandboxFx();
    const a = createPkcs11ShareAdapter(fx, root, "ca", guard("YK-11111"));
    a.storeShare(REC, "ca");
    expect(a.loadShare(1)?.secretShare).toBe(REC.secretShare);
  });

  test("FSA-22: a DIFFERENT token is refused, even though its key would decrypt", () => {
    // Both mock tokens XOR with 0xff, i.e. this models the exact dangerous provisioning:
    // identical wrapping key material on two physically distinct tokens. Cryptography
    // alone cannot catch this -- the second token really can decrypt. Only the recorded
    // identity can, which is why the check is not redundant with the seal.
    const { fx, root } = sandboxFx();
    const sealer = createPkcs11ShareAdapter(fx, root, "ca", guard("YK-11111"));
    sealer.storeShare(REC, "ca");

    const impostor = createPkcs11ShareAdapter(fx, root, "ca", guard("YK-22222"));
    expect(() => impostor.loadShare(1)).toThrow(/wrong token for share x=1/);
    expect(() => impostor.loadShare(1)).toThrow(/would be 1-of-N, not a threshold/);
  });

  test("FSA-23: one compromised token yields ONE share, not the roster", () => {
    // Three guards, three shares, three tokens with identical key material.
    const { fx, root } = sandboxFx();
    const serials = ["YK-11111", "YK-22222", "YK-33333"];
    serials.forEach((s, i) => {
      createPkcs11ShareAdapter(fx, root, "ca", guard(s)).storeShare({ ...REC, x: i + 1 }, "ca");
    });

    // The attacker has token 1 only.
    const stolen = createPkcs11ShareAdapter(fx, root, "ca", guard("YK-11111"));
    expect(stolen.loadShare(1)?.secretShare).toBe(REC.secretShare); // its own: yes
    for (const x of [2, 3]) {
      expect(() => stolen.loadShare(x)).toThrow(/wrong token for share x=/); // the rest: no
    }
  });

  test("FSA-24: stripping the binding does not dodge the check (non-AEAD tier)", () => {
    // PKCS#11 seals with CKM_AES_CBC_PAD, which has no associated-data input, so the
    // AAD alone would not protect this field. The in-plaintext bind string does.
    const { fx, root, files } = sandboxFx();
    createPkcs11ShareAdapter(fx, root, "ca", guard("YK-11111")).storeShare(REC, "ca");

    const p = frostSharePath(root, 1);
    const body = JSON.parse(files.get(p) ?? "{}") as Record<string, unknown>;
    delete body["sealedByToken"];
    files.set(p, JSON.stringify(body));

    const impostor = createPkcs11ShareAdapter(fx, root, "ca", guard("YK-22222"));
    expect(() => impostor.loadShare(1)).toThrow(/seal-binding mismatch/);
  });

  test("FSA-25: editing the binding to name the attacker's token is also refused", () => {
    const { fx, root, files } = sandboxFx();
    createPkcs11ShareAdapter(fx, root, "ca", guard("YK-11111")).storeShare(REC, "ca");

    const p = frostSharePath(root, 1);
    const body = JSON.parse(files.get(p) ?? "{}") as Record<string, unknown>;
    body["sealedByToken"] = "zeta-guard#YK-22222";
    files.set(p, JSON.stringify(body));

    const impostor = createPkcs11ShareAdapter(fx, root, "ca", guard("YK-22222"));
    // Passes the identity comparison, then fails the cryptographic binding.
    expect(() => impostor.loadShare(1)).toThrow(/seal-binding mismatch/);
  });

  test("FSA-26: a token-bound share is refused by a backend with no token identity", () => {
    const { fx, root, files } = sandboxFx();
    createPkcs11ShareAdapter(fx, root, "ca", guard("YK-11111")).storeShare(REC, "ca");
    const raw = files.get(frostSharePath(root, 1)) ?? "";

    // Same tier, same everything, but a backend that cannot say which token it is.
    const { fx: fx2, root: root2, files: files2 } = sandboxFx();
    files2.set(frostSharePath(root2, 1), raw.replaceAll(root, root2));
    // The backend must declare hardware-resident to wear the hardware-pkcs11 label at all
    // (assertBackendCanClaimTier). That is a DIFFERENT guard from the one under test here,
    // and leaving the declaration off would make this test fail at construction for the
    // wrong reason -- proving the label check, not the token-identity check. The honest
    // shape of the scenario is a real HSM-resident backend whose module cannot report a
    // token identity, which is exactly what is built below.
    const anonymous = createSealedFileShareAdapter(
      fx2,
      root2,
      "ca",
      { getSealKey: () => new Uint8Array(32), keyResidency: "hardware-resident" },
      "hardware-pkcs11",
    );
    expect(() => anonymous.loadShare(1)).toThrow(/reports no token identity/);
  });

  test("FSA-27: shares sealed before this field existed still load", () => {
    // Backward compatibility is load-bearing: sealedByToken is optional, and an artifact
    // without it must reconstruct byte-identical AAD or every existing share breaks.
    const { fx, root } = sandboxFx();
    const noIdentity = createSealedFileShareAdapter(
      fx,
      root,
      "ca",
      { getSealKey: () => new Uint8Array(32).fill(7) },
      "software-sealed",
    );
    noIdentity.storeShare(REC, "ca");
    expect(noIdentity.loadShare(1)?.secretShare).toBe(REC.secretShare);
  });
});

// ============================================================================
// ADDRESSING -- which token, and what happens when it is not there
// ============================================================================
//
// Addressing is NOT the security property. sealedByToken is; these tests sit on top of
// it. What addressing buys, once the binding exists, is that a roster can be written in
// terms of devices instead of USB positions, and that a device which is not present
// produces a refusal instead of a conversation with whatever else was plugged in.
//
// FSA-36 is the load-bearing one. An absent token quietly resolving to slot 0 would undo
// the binding FROM THE OUTSIDE -- the wrong device gets opened, and the operator sees a
// PIN prompt from a token they did not mean to touch.

describe("FrostShareAdapter: token addressing", () => {
  const byIdentity = (identity: string, mod: Pkcs11Lib) => ({
    libraryPath: "/mock/pkcs11.so",
    keyLabel: "zeta-frost-wrap",
    address: { by: "token-identity" as const, tokenIdentity: identity },
    ffiLoader: () => mod,
    pointerOf: stubPointerOf,
  });

  test("FSA-32: an options object that names no token is REFUSED, not defaulted to slot 0", () => {
    // The regression guard for `opts.slotId ?? 0`. With that default, N adapters built for
    // N tokens by a caller who forgot the field all addressed the SAME device, and the
    // roster was N copies of one risk while every log line said hardware-pkcs11.
    const { fx, root } = sandboxFx();
    expect(() =>
      createPkcs11ShareAdapter(fx, root, "ca", {
        libraryPath: "/mock/pkcs11.so",
        ffiLoader: () => mockModule([{ slotId: 0, serial: "YK-11111" }]),
        pointerOf: stubPointerOf,
      }),
    ).toThrow(/no PKCS#11 token address/);
    expect(() =>
      createPkcs11ShareAdapter(fx, root, "ca", {
        libraryPath: "/mock/pkcs11.so",
        ffiLoader: () => mockModule([{ slotId: 0, serial: "YK-11111" }]),
        pointerOf: stubPointerOf,
      }),
    ).toThrow(/There is no default/);
  });

  test("FSA-33: naming the token two ways at once is refused rather than resolved silently", () => {
    const { fx, root } = sandboxFx();
    expect(() =>
      createPkcs11ShareAdapter(fx, root, "ca", {
        libraryPath: "/mock/pkcs11.so",
        slotId: 0,
        address: { by: "token-identity", tokenIdentity: "zeta-guard#YK-11111" },
        ffiLoader: () => mockModule([{ slotId: 0, serial: "YK-11111" }]),
        pointerOf: stubPointerOf,
      }),
    ).toThrow(/Refusing to choose one silently/);
  });

  test("FSA-34: a token-identity address finds the device wherever it is plugged in", () => {
    const { fx, root } = sandboxFx();
    const mod = mockModule([
      { slotId: 4, serial: "YK-11111" },
      { slotId: 9, serial: "YK-22222" },
    ]);
    const a = createPkcs11ShareAdapter(fx, root, "ca", byIdentity("zeta-guard#YK-22222", mod));
    a.storeShare(REC, "ca");
    expect(a.loadShare(1)?.secretShare).toBe(REC.secretShare);
    // It went to slot 9. Never slot 0, and never slot 4.
    expect(new Set(mod.opened)).toEqual(new Set([9]));
  });

  test("FSA-35: a replug reorders the slots and the roster is unaffected", () => {
    // The argument for identity addressing over slot addressing, made concrete. Two
    // adapters, two devices, two shares. Then the tokens are pulled and re-inserted in
    // the other order, which is the single most ordinary thing that can happen to a
    // desk. Under slot addressing every share would now be addressed at the wrong device.
    const { fx, root } = sandboxFx();
    const before = mockModule([
      { slotId: 0, serial: "YK-11111" },
      { slotId: 1, serial: "YK-22222" },
    ]);
    createPkcs11ShareAdapter(fx, root, "ca", byIdentity("zeta-guard#YK-11111", before)).storeShare(
      { ...REC, x: 1 },
      "ca",
    );
    createPkcs11ShareAdapter(fx, root, "ca", byIdentity("zeta-guard#YK-22222", before)).storeShare(
      { ...REC, x: 2 },
      "ca",
    );

    const after = mockModule([
      { slotId: 0, serial: "YK-22222" },
      { slotId: 1, serial: "YK-11111" },
    ]);
    expect(
      createPkcs11ShareAdapter(fx, root, "ca", byIdentity("zeta-guard#YK-11111", after)).loadShare(1)
        ?.secretShare,
    ).toBe(REC.secretShare);
    expect(
      createPkcs11ShareAdapter(fx, root, "ca", byIdentity("zeta-guard#YK-22222", after)).loadShare(2)
        ?.secretShare,
    ).toBe(REC.secretShare);
  });

  test("FSA-36: an ABSENT token throws and never falls back to slot 0", () => {
    // The regression that would quietly undo the identity binding. A resolver that
    // shrugged and used slot 0 would open a device this share is not bound to; the load
    // would then fail on the binding, but the SEAL would have written a share to the
    // wrong device with a confident label, and the operator would have been asked for the
    // wrong token's PIN.
    const { fx, root } = sandboxFx();
    const mod = mockModule([
      { slotId: 0, serial: "YK-11111" },
      { slotId: 1, serial: "YK-22222" },
    ]);
    expect(() =>
      createPkcs11ShareAdapter(fx, root, "ca", byIdentity("zeta-guard#YK-99999", mod)),
    ).toThrow(/is not attached/);
    // Not "it failed later". It never opened a session with any slot at all.
    expect(mod.opened).toEqual([]);
  });

  test("FSA-37: the error names what IS attached, so the operator can fix it", () => {
    const { fx, root } = sandboxFx();
    const mod = mockModule([{ slotId: 7, serial: "YK-11111" }]);
    expect(() =>
      createPkcs11ShareAdapter(fx, root, "ca", byIdentity("zeta-guard#YK-99999", mod)),
    ).toThrow(/slot 7: zeta-guard#YK-11111/);
  });

  test("FSA-38: two devices reporting ONE identity is refused, never guessed between", () => {
    const { fx, root } = sandboxFx();
    const mod = mockModule([
      { slotId: 0, serial: "YK-11111" },
      { slotId: 1, serial: "YK-11111" },
    ]);
    expect(() =>
      createPkcs11ShareAdapter(fx, root, "ca", byIdentity("zeta-guard#YK-11111", mod)),
    ).toThrow(/Refusing to guess/);
  });

  test("FSA-39: slot addressing with an expected identity refuses a swapped device", () => {
    // The upgrade path for a caller that has a slot number and wants it checked: the slot
    // is opened, the device is asked who it is, and a different answer is a refusal.
    const { fx, root } = sandboxFx();
    const mod = mockModule([{ slotId: 0, serial: "YK-22222" }]);
    expect(() =>
      createPkcs11ShareAdapter(fx, root, "ca", {
        libraryPath: "/mock/pkcs11.so",
        address: { by: "slot-index", slotId: 0, expectTokenIdentity: "zeta-guard#YK-11111" },
        ffiLoader: () => mod,
        pointerOf: stubPointerOf,
      }).storeShare(REC, "ca"),
    ).toThrow(/addressed to "zeta-guard#YK-11111"/);
  });

  test("FSA-40: enumeration reports identities, and an unidentifiable slot cannot be addressed", () => {
    const mod = mockModule([
      { slotId: 2, serial: "YK-11111" },
      { slotId: 5, serial: "" }, // a token that reports no serial
    ]);
    const attached = describeAttachedPkcs11Tokens({
      libraryPath: "/mock/pkcs11.so",
      ffiLoader: () => mod,
    });
    expect(attached.map((t) => t.slotId)).toEqual([2, 5]);
    expect(attached[0]?.tokenIdentity).toBe("zeta-guard#YK-11111");
    // Reported, not dropped -- and null, so no address can ever match it.
    expect(attached[1]?.tokenIdentity).toBeNull();
    expect(attached[1]?.reason).toMatch(/empty serial/);
    expect(() => resolveSlotForTokenIdentity(attached, "zeta-guard#")).toThrow(/is not attached/);
  });

  test("FSA-41: the sealed identity is the DEVICE'S report, not an echo of the address", () => {
    // If tokenIdentity() returned the configured string, a token-identity address would
    // be self-fulfilling: the artifact would name a device that was never asked to
    // confirm it. Here the module reports a label the caller never typed, and that label
    // is what lands in the artifact.
    const { fx, root, files } = sandboxFx();
    const mod = mockModule([{ slotId: 3, serial: "YK-11111", label: "house-a" }]);
    createPkcs11ShareAdapter(fx, root, "ca", byIdentity("house-a#YK-11111", mod)).storeShare(REC, "ca");
    expect(files.get(frostSharePath(root, 1)) ?? "").toContain('"sealedByToken": "house-a#YK-11111"');
  });
});

// ============================================================================
// END TO END -- seal on addressed devices, then CHECK the roster it produced
// ============================================================================
//
// The two halves meet here. The adapter writes artifacts that name the device that sealed
// them; the roster reads those artifacts back and does the arithmetic. Neither half is
// trusted on its own: the roster is a claim a human wrote, the artifacts are the
// evidence, and the check is whether they entail each other.

describe("FrostShareAdapter x FrostTokenRoster: the roster is verified, not asserted", () => {
  const DEVICES = [
    { slot: 5, serial: "YK-11111", label: "house-a", x: 1 },
    { slot: 2, serial: "YK-22222", label: "house-b", x: 2 },
    { slot: 9, serial: "YK-33333", label: "house-c", x: 3 },
  ] as const;

  const identityOf = (d: (typeof DEVICES)[number]): string => `${d.label}#${d.serial}`;

  /** One directory per device -- which is what actually happens: one directory travels
   *  to one house. The directory name is never trusted; the artifact names its device. */
  function sealAll(): { files: Map<string, string>; dirs: string[]; groupKey: string } {
    const { fx, root, files } = sandboxFx();
    const mod = mockModule(DEVICES.map((d) => ({ slotId: d.slot, serial: d.serial, label: d.label })));
    const dirs: string[] = [];
    for (const d of DEVICES) {
      const dir = join(root, d.label);
      dirs.push(dir);
      createPkcs11ShareAdapter(fx, dir, "ca", {
        libraryPath: "/mock/pkcs11.so",
        keyLabel: "zeta-frost-wrap",
        address: { by: "token-identity", tokenIdentity: identityOf(d) },
        ffiLoader: () => mod,
        pointerOf: stubPointerOf,
      }).storeShare({ ...REC, x: d.x }, "ca");
    }
    return { files, dirs, groupKey: REC.groupPublicKeyHex };
  }

  function readerOver(files: Map<string, string>): FrostRosterEffects {
    return {
      exists: (p) => [...files.keys()].some((k) => k.startsWith(`${p}/`)),
      readText: (p) => files.get(p) ?? "",
      listFiles: (p) =>
        [...files.keys()].filter((k) => k.startsWith(`${p}/`)).map((k) => k.slice(p.length + 1)),
    };
  }

  const rosterFor = (groupKey: string): FrostTokenRoster => ({
    schema: FROST_TOKEN_ROSTER_SCHEMA,
    ca: "ca",
    groupPublicKeyHex: groupKey,
    threshold: 2,
    totalShares: 3,
    sealTier: "hardware-pkcs11",
    participants: DEVICES.map((d) => ({ x: d.x, location: d.label, devices: [identityOf(d)] })),
  });

  test("FSA-42: shares sealed to addressed devices satisfy the roster that declares them", () => {
    const { files, dirs, groupKey } = sealAll();
    const observed = collectSealBindings(readerOver(files), dirs);
    expect(observed.length).toBe(3);
    expect(() => assertRosterSound(rosterFor(groupKey), observed)).not.toThrow();
  });

  test("FSA-43: MUTANT -- slot binding removed, so every share is sealed by one device", () => {
    // The pre-addressing world: every adapter addressed slot 0 (or whatever answered),
    // so all three shares carry ONE sealing identity. Each artifact is still perfectly
    // bound and each still opens only under that device -- the cryptography is fine and
    // the custody is 1-of-1. The roster is what notices.
    const { fx, root, files } = sandboxFx();
    const flat = mockModule([{ slotId: 0, serial: "YK-11111", label: "house-a" }]);
    const dirs: string[] = [];
    for (const d of DEVICES) {
      const dir = join(root, d.label);
      dirs.push(dir);
      createPkcs11ShareAdapter(fx, dir, "ca", {
        libraryPath: "/mock/pkcs11.so",
        keyLabel: "zeta-frost-wrap",
        slotId: 0, // one slot, one device, three shares
        ffiLoader: () => flat,
        pointerOf: stubPointerOf,
      }).storeShare({ ...REC, x: d.x }, "ca");
    }
    const observed = collectSealBindings(readerOver(files), dirs);
    expect(new Set(observed.map((o) => o.sealedByToken)).size).toBe(1);
    expect(() => assertRosterSound(rosterFor(REC.groupPublicKeyHex), observed)).toThrow(
      /undeclared-artifact/,
    );
  });
});

describe("parseCkTokenInfoIdentity: the struct offsets", () => {
  // The FFI call cannot be exercised without hardware. The parse can, and a wrong
  // serialNumber offset would bind every token to the same string, silently restoring
  // any-token-opens-any-share. So the offsets are pinned here.
  test("FSA-28: reads label and serial at the PKCS#11 offsets, blank-trimmed", () => {
    expect(parseCkTokenIdentityFixture("zeta-guard", "YK-11111")).toBe("zeta-guard#YK-11111");
  });

  test("FSA-29: distinct serials produce distinct identities", () => {
    expect(parseCkTokenIdentityFixture("zeta-guard", "YK-11111")).not.toBe(
      parseCkTokenIdentityFixture("zeta-guard", "YK-22222"),
    );
  });

  test("FSA-30: an empty serial is refused, never bound as a shared empty identity", () => {
    expect(() => parseCkTokenIdentityFixture("zeta-guard", "")).toThrow(/empty serial number/);
  });

  test("FSA-31: a full-width 16-char serial is not truncated", () => {
    expect(parseCkTokenIdentityFixture("L", "0123456789ABCDEF")).toBe("L#0123456789ABCDEF");
  });
});

function parseCkTokenIdentityFixture(label: string, serial: string): string {
  return parseCkTokenInfoIdentity(mockCkTokenInfo(label, serial));
}
