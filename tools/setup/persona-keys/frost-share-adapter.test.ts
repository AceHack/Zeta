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
  FROST_SEALED_SHARE_SCHEMA_V1,
  INSECURE_FAKE_SEAL_ALG,
  isHardwareSealTier,
  parseCkTokenInfoIdentity,
  type ExtractingFrostShareAdapter,
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
    const adapters: ExtractingFrostShareAdapter[] = [
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
    const anonymous = createSealedFileShareAdapter(
      fx2,
      root2,
      "ca",
      { getSealKey: () => new Uint8Array(32) },
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
