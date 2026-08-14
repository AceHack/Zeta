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
  createHsmShareAdapter,
  createHsmShareAdapterStub,
  createInsecureFakeHsmShareAdapter,
  createPkcs11ShareAdapter,
  createSealedFileShareAdapter,
  createSoftwareFileShareAdapter,
  createTpmShareAdapter,
  defaultPointerOf,
  loadFrostKeyShares,
  FROST_SEALED_SHARE_SCHEMA_V1,
  INSECURE_FAKE_SEAL_ALG,
  isHardwareSealTier,
  type FrostShareAdapter,
  type Pkcs11Lib,
  type Pkcs11PointerOf,
} from "./frost-share-adapter.ts";
import { frostSharePath, type FrostCaCustodyEffects } from "./frost-ca-custody.ts";

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

/** A PKCS#11 token that is present, holds the key, and XOR-"encrypts". */
function mockToken(opts: { keyPresent?: boolean } = {}): Pkcs11Lib {
  const keyPresent = opts.keyPresent ?? true;
  return {
    C_Initialize: () => 0n,
    C_Finalize: () => 0n,
    C_GetSlotList: () => 0n,
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

  test("FSA-2: loadFrostKeyShares collects all present shares", () => {
    const { fx, root } = sandboxFx();
    const adapter = createSoftwareFileShareAdapter(fx, root, "ca");
    for (let x = 1; x <= 2; x++) {
      adapter.storeShare({ ...REC, x, secretShare: BigInt(x * 10), totalShares: 2 }, "ca");
    }
    const shares = loadFrostKeyShares(adapter, 2);
    expect(shares.length).toBe(2);
    expect(shares[0]!.secretShare).toBe(10n);
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

describe("FrostShareAdapter: integrity and honesty", () => {
  test("FSA-13: no adapter claims use-without-extract", () => {
    const { fx, root } = sandboxFx();
    const adapters: FrostShareAdapter[] = [
      createSoftwareFileShareAdapter(fx, root, "ca"),
      createHsmShareAdapterStub(),
      createSealedFileShareAdapter(fx, root, "ca", { getSealKey: () => new Uint8Array(32).fill(1) }),
      createInsecureFakeHsmShareAdapter(fx, root, "ca", { iUnderstandThisIsNotHardware: true, warn: () => {} }),
      createPkcs11ShareAdapter(fx, root, "ca", {
        libraryPath: "/mock/lib.so",
        ffiLoader: () => mockToken(),
        pointerOf: stubPointerOf,
      }),
    ];
    for (const a of adapters) expect(a.usesWithoutExtract).toBe(false);
  });

  test("FSA-14: header tampering on a PKCS#11-sealed share is detected", () => {
    const { fx, root, files } = sandboxFx();
    const opts = {
      libraryPath: "/mock/lib.so",
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
