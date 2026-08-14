// frost-share-adapter -- HARDWARE-ONLY LANE (081KWPHRNFW DoD item 5).
//
// This lane touches a REAL chip. It is excluded from the whole-suite gate
// (bunfig pathIgnorePatterns + registry/unexecuted-test-files.json) because no CI
// runner has a TPM 2.0 or a PKCS#11 token.
//
// TWO PROPERTIES MAKE THIS LANE NON-VACUOUS, and both matter:
//
//   1. It NEVER falls back to the software fake. No code path here constructs
//      createInsecureFakeHsmShareAdapter. If the hardware is absent, the lane does
//      not run; it does not quietly test something else.
//   2. Opting in and finding no hardware is a FAILURE, not a skip. Setting
//      ZETA_FROST_HARDWARE_LANE asserts "hardware is attached". If it is not, these
//      tests fail loudly. Without that, an opt-in lane that skips itself is the
//      classic green-because-nothing-ran result.
//
// HOW TO RUN
//
//   PKCS#11 (macOS or Linux, needs a token holding an AES-256 key labelled
//   zeta-frost-wrap):
//     ZETA_FROST_HARDWARE_LANE=pkcs11 \
//     ZETA_FROST_PKCS11_LIB=/opt/homebrew/lib/ykcs11.dylib \
//     ZETA_FROST_PKCS11_PIN=... \
//     bun test ./tools/setup/persona-keys/frost-share-adapter.hardware.test.ts
//
//   PKCS#11 MULTI-TOKEN (the one that tests the property a token PACK buys). Plug in
//   two or more tokens, provision each with an AES-256 key labelled zeta-frost-wrap,
//   and list their slots. Same PIN across tokens is fine -- in fact it is the case most
//   worth testing, because identical PINs and identical key material are exactly how a
//   roster silently collapses to 1-of-N:
//     ZETA_FROST_HARDWARE_LANE=pkcs11-multi \
//     ZETA_FROST_PKCS11_LIB=/opt/homebrew/lib/ykcs11.dylib \
//     ZETA_FROST_PKCS11_PIN=... \
//     ZETA_FROST_PKCS11_SLOTS=0,1,2 \
//     bun test ./tools/setup/persona-keys/frost-share-adapter.hardware.test.ts
//
//   TPM 2.0 (Linux only -- Apple Silicon has no TPM; see the adapter header):
//     tpm2_createprimary -c primary.ctx
//     head -c 32 /dev/urandom > k.bin
//     tpm2_create -C primary.ctx -i k.bin -u k.pub -r k.priv
//     tpm2_load -C primary.ctx -u k.pub -r k.priv -c sealed.key
//     ZETA_FROST_HARDWARE_LANE=tpm2 ZETA_FROST_TPM_SEALED_KEY=$PWD/sealed.key \
//     bun test ./tools/setup/persona-keys/frost-share-adapter.hardware.test.ts

import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createHsmShareAdapter,
  isHardwareSealTier,
  type ExtractingFrostShareAdapter,
} from "./frost-share-adapter.ts";
import { frostSharePath, type FrostCaCustodyEffects } from "./frost-ca-custody.ts";

const LANE = process.env["ZETA_FROST_HARDWARE_LANE"] ?? "";
const PKCS11_LANE = LANE === "pkcs11";
const PKCS11_MULTI_LANE = LANE === "pkcs11-multi";
const TPM_LANE = LANE === "tpm2";

function sandboxFx(): { fx: FrostCaCustodyEffects; root: string; files: Map<string, string> } {
  const root = mkdtempSync(join(tmpdir(), "zeta-frost-hw-"));
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
  secretShare: 0x5eaf00dfeed5n,
  threshold: 2,
  totalShares: 3,
  groupPublicKeyHex: "ab".repeat(32),
};

function assertRoundTripOnRealChip(adapter: ExtractingFrostShareAdapter, files: Map<string, string>, root: string): void {
  expect(isHardwareSealTier(adapter.sealTier)).toBe(true);
  // Even on real hardware this port still extracts. Do not let the lane imply otherwise.
  // The port split made that structural: the adapter is named for the forfeit, and the
  // signing path that does NOT forfeit lives in frost-partial-signer.ts.
  expect(adapter.usesWithoutExtract).toBe(false);
  expect(adapter.extractsScalar).toBe(true);

  adapter.storeShare(REC, "hw-ca");
  const onDisk = files.get(frostSharePath(root, 1)) ?? "";
  expect(onDisk).toContain(adapter.sealTier);
  expect(onDisk).not.toContain(REC.secretShare.toString(10));
  expect(onDisk).not.toContain("INSECURE");
  expect(adapter.loadShare(1)?.secretShare).toBe(REC.secretShare);
}

describe.if(PKCS11_LANE)("hardware lane: PKCS#11", () => {
  test("HW-1: the declared token is actually present", () => {
    const lib = process.env["ZETA_FROST_PKCS11_LIB"] ?? "";
    expect(lib).not.toBe("");
    // Opting in and finding nothing is a failure, never a skip.
    expect(existsSync(lib)).toBe(true);
  });

  test("HW-2: a share round-trips through the token; the wrapping key never leaves it", () => {
    const { fx, root, files } = sandboxFx();
    const adapter = createHsmShareAdapter(fx, root, "hw-ca", {
      requireTier: "hardware-pkcs11",
      pkcs11Opts: {
        libraryPath: process.env["ZETA_FROST_PKCS11_LIB"] ?? "",
        pin: process.env["ZETA_FROST_PKCS11_PIN"] ?? "",
        slotId: Number(process.env["ZETA_FROST_PKCS11_SLOT"] ?? "0"),
        keyLabel: process.env["ZETA_FROST_PKCS11_LABEL"] ?? "zeta-frost-wrap",
      },
    });
    assertRoundTripOnRealChip(adapter, files, root);
  });
});

describe.if(TPM_LANE)("hardware lane: TPM 2.0", () => {
  test("HW-3: a TPM device node and a sealed object are actually present", () => {
    const sealed = process.env["ZETA_FROST_TPM_SEALED_KEY"] ?? "";
    expect(sealed).not.toBe("");
    expect(existsSync(sealed)).toBe(true);
    expect(existsSync("/dev/tpmrm0") || existsSync("/dev/tpm0")).toBe(true);
  });

  test("HW-4: a share round-trips through a TPM-unsealed key", () => {
    const { fx, root, files } = sandboxFx();
    const adapter = createHsmShareAdapter(fx, root, "hw-ca", {
      requireTier: "hardware-tpm2",
      tpmOpts: { sealedKeyPath: process.env["ZETA_FROST_TPM_SEALED_KEY"] ?? "" },
    });
    assertRoundTripOnRealChip(adapter, files, root);
  });
});

// ============================================================================
// MULTI-TOKEN LANE -- the property a token PACK buys, on real tokens
// ============================================================================
//
// Neither a YubiKey nor a YubiHSM reaches use-without-extract, so a bigger token does
// not buy a higher rung. What N tokens buy is DISTRIBUTION: one compromised token yields
// one share, which is below threshold. That holds only if share i is openable by token i
// and by no other, and the failure mode is silent -- provision the same wrapping key on
// every token (one PIN, and a spare if one is lost) and any token opens any share with
// nothing in the artifact to show it. This lane proves the refusal on real hardware.

describe.if(PKCS11_MULTI_LANE)("hardware lane: PKCS#11 multi-token roster", () => {
  const slotsRaw: string = process.env["ZETA_FROST_PKCS11_SLOTS"] ?? "";
  const slots: number[] = slotsRaw
    .split(",")
    .map((s: string) => s.trim())
    .filter((s: string) => s !== "")
    .map((s: string) => Number(s));

  const optsForSlot = (slotId: number) => ({
    libraryPath: process.env["ZETA_FROST_PKCS11_LIB"] ?? "",
    pin: process.env["ZETA_FROST_PKCS11_PIN"] ?? "",
    slotId,
    keyLabel: process.env["ZETA_FROST_PKCS11_LABEL"] ?? "zeta-frost-wrap",
  });

  test("HW-6: at least two tokens were actually declared", () => {
    // Opting into the multi lane with one slot would test nothing about distribution.
    expect(slots.length).toBeGreaterThanOrEqual(2);
    expect(existsSync(process.env["ZETA_FROST_PKCS11_LIB"] ?? "")).toBe(true);
  });

  test("HW-7: the declared slots are physically DISTINCT tokens", () => {
    // Two slot numbers pointing at one token would make every later assertion vacuous,
    // and is an easy mistake: slot ids are module-assigned and not stable identities.
    const { fx, root, files } = sandboxFx();
    const identities = slots.map((slotId: number, i: number) => {
      const a = createHsmShareAdapter(fx, root, "hw-ca", {
        requireTier: "hardware-pkcs11",
        pkcs11Opts: optsForSlot(slotId),
      });
      a.storeShare({ ...REC, x: i + 1 }, "hw-ca");
      const body = JSON.parse(files.get(frostSharePath(root, i + 1)) ?? "{}") as {
        sealedByToken?: string;
      };
      return body.sealedByToken ?? "";
    });
    for (const id of identities) expect(id).not.toBe("");
    expect(new Set(identities).size).toBe(slots.length);
  });

  test("HW-8: each token opens its OWN share", () => {
    const { fx, root } = sandboxFx();
    slots.forEach((slotId: number, i: number) => {
      const a = createHsmShareAdapter(fx, root, "hw-ca", {
        requireTier: "hardware-pkcs11",
        pkcs11Opts: optsForSlot(slotId),
      });
      a.storeShare({ ...REC, x: i + 1 }, "hw-ca");
      expect(a.loadShare(i + 1)?.secretShare).toBe(REC.secretShare);
    });
  });

  test("HW-9: no token opens ANOTHER token's share -- one compromise, one share", () => {
    const { fx, root } = sandboxFx();
    slots.forEach((slotId: number, i: number) => {
      createHsmShareAdapter(fx, root, "hw-ca", {
        requireTier: "hardware-pkcs11",
        pkcs11Opts: optsForSlot(slotId),
      }).storeShare({ ...REC, x: i + 1 }, "hw-ca");
    });
    // Every token against every share that is not its own.
    slots.forEach((slotId: number, i: number) => {
      const attacker = createHsmShareAdapter(fx, root, "hw-ca", {
        requireTier: "hardware-pkcs11",
        pkcs11Opts: optsForSlot(slotId),
      });
      slots.forEach((_: number, j: number) => {
        if (i === j) return;
        expect(() => attacker.loadShare(j + 1)).toThrow(/wrong token for share x=/);
      });
    });
  });
});

const NO_LANE = LANE === "";

describe.if(NO_LANE)("hardware lane: not selected", () => {
  test("HW-0: this file asserts NOTHING about hardware unless a lane is selected", () => {
    expect(LANE).toBe("");
  });
});

// A typo in ZETA_FROST_HARDWARE_LANE would otherwise select no describe block at all,
// and a file that runs zero tests reports green. Refuse that outcome explicitly.
describe.if(LANE !== "")("hardware lane: selection is recognised", () => {
  test("HW-5: an opted-in lane name must be one this file implements", () => {
    expect(["pkcs11", "pkcs11-multi", "tpm2"]).toContain(LANE);
  });
});
