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
});
