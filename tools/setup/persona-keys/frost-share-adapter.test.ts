// frost-share-adapter.ts — software vs HSM stub (081KWPHRNFW slice 1).
import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createHsmShareAdapterStub,
  createSealedFileShareAdapter,
  createSoftwareFileShareAdapter,
  loadFrostKeyShares,
  createPkcs11ShareAdapter,
  createTpmShareAdapter,
  createHsmShareAdapter,
  type Pkcs11Lib,
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

describe("FrostShareAdapter", () => {
  test("FSA-1: software adapter round-trips share", () => {
    const { fx, root } = sandboxFx();
    const adapter = createSoftwareFileShareAdapter(fx, root, "test-ca");
    adapter.storeShare(
      {
        x: 1,
        secretShare: 42n,
        threshold: 2,
        totalShares: 3,
        groupPublicKeyHex: "aa".repeat(32),
      },
      "test-ca",
    );
    const loaded = adapter.loadShare(1);
    expect(loaded?.secretShare).toBe(42n);
    expect(loaded?.threshold).toBe(2);
  });

  test("FSA-2: loadFrostKeyShares collects all present shares", () => {
    const { fx, root } = sandboxFx();
    const adapter = createSoftwareFileShareAdapter(fx, root, "ca");
    for (let x = 1; x <= 2; x++) {
      adapter.storeShare(
        {
          x,
          secretShare: BigInt(x * 10),
          threshold: 2,
          totalShares: 2,
          groupPublicKeyHex: "bb".repeat(32),
        },
        "ca",
      );
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

  test("FSA-4: sealed-file adapter round-trips without plaintext secretShare on disk", () => {
    const { fx, root, files } = sandboxFx();
    const adapter = createSealedFileShareAdapter(fx, root, "sealed-ca", {
      getSealKey: () => new Uint8Array(32).fill(9),
      randomBytes: (len) => new Uint8Array(len).fill(7),
    });
    adapter.storeShare(
      {
        x: 1,
        secretShare: 987654321n,
        threshold: 2,
        totalShares: 3,
        groupPublicKeyHex: "cc".repeat(32),
      },
      "sealed-ca",
    );

    const plaintextFile = files.get(frostSharePath(root, 1)) ?? "";
    expect(plaintextFile).toContain("zeta-frost-share-sealed-v1");
    expect(plaintextFile).not.toContain("987654321");
    expect(plaintextFile).not.toContain("secretShare");
    expect(adapter.loadShare(1)?.secretShare).toBe(987654321n);
  });

  test("FSA-5: pkcs11 adapter round-trips via mock ffiLoader", () => {
    const { fx, root } = sandboxFx();
    
    let sessionOpened = false;
    let loggedIn = false;
    
    const mockLib: Pkcs11Lib = {
      C_Initialize: () => 0n,
      C_Finalize: () => 0n,
      C_GetSlotList: () => 0n,
      C_OpenSession: (_slotId, _flags, _pApp, _pNotify, phSession) => {
        sessionOpened = true;
        phSession[0] = 123n;
        return 0n;
      },
      C_CloseSession: (_hSession) => {
        sessionOpened = false;
        return 0n;
      },
      C_Login: (_hSession, _userType, _pPin, _ulPinLen) => {
        loggedIn = true;
        return 0n;
      },
      C_Logout: (_hSession) => {
        loggedIn = false;
        return 0n;
      },
      C_FindObjectsInit: () => 0n,
      C_FindObjects: (_hSession, phObject, _ulMaxObjectCount, pulObjectCount) => {
        phObject[0] = 999n;
        pulObjectCount[0] = 1n;
        return 0n;
      },
      C_FindObjectsFinal: () => 0n,
      C_EncryptInit: () => 0n,
      C_Encrypt: (_hSession, pData, ulDataLen, pEncryptedData, pulEncryptedDataLen) => {
        const len = Number(ulDataLen);
        if (!pEncryptedData || pEncryptedData === 0n || pEncryptedData === 0) {
          pulEncryptedDataLen[0] = BigInt(len);
          return 0n;
        }
        for (let i = 0; i < len; i++) {
          pEncryptedData[i] = pData[i] ^ 0xFF;
        }
        pulEncryptedDataLen[0] = BigInt(len);
        return 0n;
      },
      C_DecryptInit: () => 0n,
      C_Decrypt: (_hSession, pEncryptedData, ulEncryptedDataLen, pData, pulDataLen) => {
        const len = Number(ulEncryptedDataLen);
        if (!pData || pData === 0n || pData === 0) {
          pulDataLen[0] = BigInt(len);
          return 0n;
        }
        for (let i = 0; i < len; i++) {
          pData[i] = pEncryptedData[i] ^ 0xFF;
        }
        pulDataLen[0] = BigInt(len);
        return 0n;
      },
    };
    
    const adapter = createPkcs11ShareAdapter(fx, root, "pkcs11-ca", {
      libraryPath: "/mock/libpkcs11.so",
      pin: "1234",
      slotId: 1,
      keyLabel: "test-key-label",
      ffiLoader: () => mockLib,
    });
    
    adapter.storeShare(
      {
        x: 1,
        secretShare: 12345n,
        threshold: 2,
        totalShares: 3,
        groupPublicKeyHex: "dd".repeat(32),
      },
      "pkcs11-ca",
    );
    
    const loaded = adapter.loadShare(1);
    expect(loaded).not.toBeNull();
    expect(loaded?.secretShare).toBe(12345n);
    expect(sessionOpened).toBe(false);
    expect(loggedIn).toBe(false);
  });

  test("FSA-6: tpm adapter unseals via mock cmd", () => {
    const { fx, root } = sandboxFx();
    const mockTpmCmd = `printf '\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09\\x09'`;
    
    const adapter = createTpmShareAdapter(fx, root, "tpm-ca", {
      sealedKeyPath: "/path/to/sealed.key",
      tpm2UnsealCmd: mockTpmCmd,
    });
    
    adapter.storeShare(
      {
        x: 1,
        secretShare: 99999n,
        threshold: 2,
        totalShares: 3,
        groupPublicKeyHex: "ee".repeat(32),
      },
      "tpm-ca",
    );
    
    const loaded = adapter.loadShare(1);
    expect(loaded).not.toBeNull();
    expect(loaded?.secretShare).toBe(99999n);
  });

  test("FSA-7: createHsmShareAdapter factory routing", () => {
    const { fx, root } = sandboxFx();
    
    const stub = createHsmShareAdapter(fx, root, "ca", { hsmKind: "stub" });
    expect(stub.kind).toBe("hsm-stub");
    
    const mockLib: Pkcs11Lib = {
      C_Initialize: () => 0n,
      C_Finalize: () => 0n,
      C_GetSlotList: () => 0n,
      C_OpenSession: () => 0n,
      C_CloseSession: () => 0n,
      C_Login: () => 0n,
      C_Logout: () => 0n,
      C_FindObjectsInit: () => 0n,
      C_FindObjects: () => 0n,
      C_FindObjectsFinal: () => 0n,
      C_EncryptInit: () => 0n,
      C_Encrypt: () => 0n,
      C_DecryptInit: () => 0n,
      C_Decrypt: () => 0n,
    };
    const pkcs11 = createHsmShareAdapter(fx, root, "ca", {
      hsmKind: "pkcs11",
      pkcs11Opts: {
        libraryPath: "/mock/lib.so",
        ffiLoader: () => mockLib,
      }
    });
    expect(pkcs11.kind).toBe("sealed-file");
    
    const tpm = createHsmShareAdapter(fx, root, "ca", {
      hsmKind: "tpm",
      tpmOpts: {
        sealedKeyPath: "/mock/key",
        tpm2UnsealCmd: "echo -n 12345678901234567890123456789012"
      }
    });
    expect(tpm.kind).toBe("sealed-file");
  });

  test("FSA-9: simulator adapter round-trips shares and falls back gracefully", () => {
    const { fx, root } = sandboxFx();
    const sim = createHsmShareAdapter(fx, root, "sim-ca", {
      hsmKind: "simulator",
    });
    expect(sim.kind).toBe("sealed-file");

    sim.storeShare(
      {
        x: 1,
        secretShare: 123456789n,
        threshold: 2,
        totalShares: 3,
        groupPublicKeyHex: "dd".repeat(32),
      },
      "sim-ca",
    );

    const loaded = sim.loadShare(1);
    expect(loaded?.secretShare).toBe(123456789n);

    // Verify allowSimulatorFallback when hardware unattached
    const fallbackSim = createHsmShareAdapter(fx, root, "sim-ca", {
      hsmKind: "tpm",
      tpmOpts: {
        sealedKeyPath: "/invalid/path",
        tpm2UnsealCmd: "false",
      },
      allowSimulatorFallback: true,
    });
    expect(fallbackSim.kind).toBe("sealed-file");
  });
});
