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
// HOW TO RUN -- READ THIS LINE FIRST
//
//   The `--config=bunfig.hardware-lane.toml` flag is REQUIRED, and it must come
//   BEFORE the `test` subcommand. Without it the commands below match NO test
//   files and the lane does not run.
//
//   MEASURED 2026-08-23 on darwin-arm64. This file is listed in bunfig.toml's
//   pathIgnorePatterns to keep it out of the whole-suite gate, and bun applies
//   pathIgnorePatterns even to an EXPLICIT path filter. The commands in this
//   header previously omitted the flag, so:
//
//     ZETA_FROST_HARDWARE_LANE=pkcs11 bun test ./...hardware.test.ts
//     -> "The following filters did not match any test files"   rc=1
//
//   rc=1 is also what a correctly-running lane returns when the token is absent.
//   So the exit status could not distinguish "the token is missing" from "the
//   lane never ran", and the second reading is the one where nothing was checked.
//   Note also that `bun test --config=X` parses fine and IGNORES X; only
//   `bun --config=X test` honours it.
//

//   PKCS#11 (macOS or Linux, needs a token holding an AES-256 key labelled
//   zeta-frost-wrap):
//     ZETA_FROST_HARDWARE_LANE=pkcs11 \
//     ZETA_FROST_PKCS11_LIB=/opt/homebrew/lib/ykcs11.dylib \
//     ZETA_FROST_PKCS11_PIN=... \
//     bun --config=bunfig.hardware-lane.toml test \
//       ./tools/setup/persona-keys/frost-share-adapter.hardware.test.ts
//
//   PKCS#11 MULTI-TOKEN (the one that tests the property a token PACK buys). Plug in
//   two or more tokens, provision each with an AES-256 key labelled zeta-frost-wrap,
//   and NAME THEM. Same PIN across tokens is fine -- in fact it is the case most worth
//   testing, because identical PINs and identical key material are exactly how a roster
//   silently collapses to 1-of-N.
//
//   Step 1, discover the identities (label#serial, printed on the outside of the device;
//   no key material is read or shown):
//     bun tools/setup/persona-keys/frost-token-roster.ts tokens /opt/homebrew/lib/ykcs11.dylib
//
//   Step 2, name them. Identities, NOT slot numbers -- slot numbers move when anything
//   is unplugged, and a roster written in slot numbers silently re-points itself:
//     ZETA_FROST_HARDWARE_LANE=pkcs11-multi \
//     ZETA_FROST_PKCS11_LIB=/opt/homebrew/lib/ykcs11.dylib \
//     ZETA_FROST_PKCS11_PIN=... \
//     ZETA_FROST_PKCS11_TOKENS='house-a#12345678,house-b#87654321' \
//     bun --config=bunfig.hardware-lane.toml test \
//       ./tools/setup/persona-keys/frost-share-adapter.hardware.test.ts
//
//   Optionally add a BACKUP token for participant 1, to exercise duplication. A share may
//   live on N devices and is still ONE participant; the roster check is what enforces
//   that the backup did not become a second position:
//     ZETA_FROST_PKCS11_BACKUP_TOKEN='house-d#11112222'
//
//   TPM 2.0 (Linux only -- Apple Silicon has no TPM; see the adapter header):
//     tpm2_createprimary -c primary.ctx
//     head -c 32 /dev/urandom > k.bin
//     tpm2_create -C primary.ctx -i k.bin -u k.pub -r k.priv
//     tpm2_load -C primary.ctx -u k.pub -r k.priv -c sealed.key
//     ZETA_FROST_HARDWARE_LANE=tpm2 ZETA_FROST_TPM_SEALED_KEY=$PWD/sealed.key \
//     bun --config=bunfig.hardware-lane.toml test \
//       ./tools/setup/persona-keys/frost-share-adapter.hardware.test.ts

import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createHsmShareAdapter,
  describeAttachedPkcs11Tokens,
  isHardwareSealTier,
  type ExtractingFrostShareAdapter,
} from "./frost-share-adapter.ts";
import { frostSharePath, type FrostCaCustodyEffects } from "./frost-ca-custody.ts";
import {
  assertRosterSound,
  attestRosterOnDevices,
  collectSealBindings,
  FROST_TOKEN_ROSTER_SCHEMA,
  type FrostRosterEffects,
  type FrostTokenRoster,
} from "./frost-token-roster.ts";

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
  const LIB: string = process.env["ZETA_FROST_PKCS11_LIB"] ?? "";
  const tokens: string[] = (process.env["ZETA_FROST_PKCS11_TOKENS"] ?? "")
    .split(",")
    .map((s: string) => s.trim())
    .filter((s: string) => s !== "");
  const backupToken: string = (process.env["ZETA_FROST_PKCS11_BACKUP_TOKEN"] ?? "").trim();

  /** Addressed by IDENTITY, never by slot: the point of the lane is that the roster
   *  survives a replug, and a slot number is exactly what does not. */
  const optsForToken = (tokenIdentity: string) => ({
    libraryPath: LIB,
    pin: process.env["ZETA_FROST_PKCS11_PIN"] ?? "",
    address: { by: "token-identity" as const, tokenIdentity },
    keyLabel: process.env["ZETA_FROST_PKCS11_LABEL"] ?? "zeta-frost-wrap",
  });

  const adapterFor = (
    tokenIdentity: string,
    fx: FrostCaCustodyEffects,
    dir: string,
  ): ExtractingFrostShareAdapter =>
    createHsmShareAdapter(fx, dir, "hw-ca", {
      requireTier: "hardware-pkcs11",
      pkcs11Opts: optsForToken(tokenIdentity),
    });

  /** One directory per device -- what actually happens when a device goes to a house. */
  const dirFor = (root: string, tokenIdentity: string): string =>
    join(root, tokenIdentity.replaceAll(/[^A-Za-z0-9_.-]/gu, "_"));

  const rosterEffects = (files: Map<string, string>): FrostRosterEffects => ({
    exists: (p) => [...files.keys()].some((k) => k.startsWith(`${p}/`)),
    readText: (p) => files.get(p) ?? "",
    listFiles: (p) => [...files.keys()].filter((k) => k.startsWith(`${p}/`)).map((k) => k.slice(p.length + 1)),
  });

  test("HW-6: at least two tokens were actually named, by identity", () => {
    // Opting into the multi lane with one token would test nothing about distribution.
    expect(tokens.length).toBeGreaterThanOrEqual(2);
    expect(existsSync(LIB)).toBe(true);
    // Named by identity, not by slot. A bare number here means the operator is still
    // thinking positionally, which is the habit this lane exists to break.
    for (const t of tokens) expect(t).toMatch(/#/u);
  });

  test("HW-7: every named token is ATTACHED, and they are physically distinct", () => {
    const attached = describeAttachedPkcs11Tokens({ libraryPath: LIB });
    const present = new Set(attached.map((a) => a.tokenIdentity).filter((i): i is string => i !== null));
    for (const t of tokens) expect([...present]).toContain(t);
    // Two names for one chip would make every later assertion vacuous.
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  test("HW-8: each token opens its OWN share", () => {
    const { fx, root } = sandboxFx();
    tokens.forEach((t: string, i: number) => {
      const a = adapterFor(t, fx, dirFor(root, t));
      a.storeShare({ ...REC, x: i + 1 }, "hw-ca");
      expect(a.loadShare(i + 1)?.secretShare).toBe(REC.secretShare);
    });
  });

  test("HW-9: no token opens ANOTHER token's share -- one compromise, one share", () => {
    const { fx, root } = sandboxFx();
    // Every share in EVERY directory, so the cross-product below is a real attempt to
    // open another participant's artifact rather than a file-not-found.
    tokens.forEach((t: string, i: number) => {
      for (const dir of tokens.map((o: string) => dirFor(root, o))) {
        adapterFor(t, fx, dir).storeShare({ ...REC, x: i + 1 }, "hw-ca");
      }
    });
    tokens.forEach((attackerToken: string, i: number) => {
      const attacker = adapterFor(attackerToken, fx, dirFor(root, attackerToken));
      tokens.forEach((_: string, j: number) => {
        if (i === j) return;
        expect(() => attacker.loadShare(j + 1)).toThrow(/wrong token for share x=/);
      });
    });
  });

  test("HW-10: the roster the ceremony produced is VERIFIED, not asserted", () => {
    const { fx, root, files } = sandboxFx();
    tokens.forEach((t: string, i: number) => {
      adapterFor(t, fx, dirFor(root, t)).storeShare({ ...REC, x: i + 1 }, "hw-ca");
    });
    const declared: FrostTokenRoster = {
      schema: FROST_TOKEN_ROSTER_SCHEMA,
      ca: "hw-ca",
      groupPublicKeyHex: REC.groupPublicKeyHex,
      threshold: REC.threshold,
      totalShares: tokens.length,
      sealTier: "hardware-pkcs11",
      participants: tokens.map((t: string, i: number) => ({ x: i + 1, devices: [t] })),
    };
    const observed = collectSealBindings(
      rosterEffects(files),
      tokens.map((t: string) => dirFor(root, t)),
    );
    expect(observed.length).toBe(tokens.length);
    assertRosterSound(declared, observed);
  });

  test("HW-11: the N x N matrix is attested on the real chips", () => {
    // The strongest available form of "verifiably distributed": not that the headers
    // agree, but that the devices actually behave that way.
    const { fx, root } = sandboxFx();
    tokens.forEach((t: string, i: number) => {
      adapterFor(t, fx, dirFor(root, t)).storeShare({ ...REC, x: i + 1 }, "hw-ca");
    });
    const declared: FrostTokenRoster = {
      schema: FROST_TOKEN_ROSTER_SCHEMA,
      ca: "hw-ca",
      groupPublicKeyHex: REC.groupPublicKeyHex,
      threshold: REC.threshold,
      totalShares: tokens.length,
      sealTier: "hardware-pkcs11",
      participants: tokens.map((t: string, i: number) => ({ x: i + 1, devices: [t] })),
    };
    const findings = attestRosterOnDevices(declared, (device: string, x: number) => {
      const owner = tokens[x - 1] ?? "";
      try {
        return adapterFor(device, fx, dirFor(root, owner)).loadShare(x) === null ? "refused" : "opened";
      } catch {
        return "refused";
      }
    });
    expect(findings).toEqual([]);
  });

  test.if(backupToken !== "")("HW-12: a BACKUP device is one participant, not a new position", () => {
    // Duplication for availability: the same share on two devices, in two houses. The
    // roster must accept that as ONE position -- and must refuse the spelling that counts
    // it as two, which is how a threshold silently drops.
    const { fx, root, files } = sandboxFx();
    tokens.forEach((t: string, i: number) => {
      adapterFor(t, fx, dirFor(root, t)).storeShare({ ...REC, x: i + 1 }, "hw-ca");
    });
    // The SAME share x=1, sealed a second time to the backup device.
    adapterFor(backupToken, fx, dirFor(root, backupToken)).storeShare({ ...REC, x: 1 }, "hw-ca");
    expect(adapterFor(backupToken, fx, dirFor(root, backupToken)).loadShare(1)?.secretShare).toBe(
      REC.secretShare,
    );

    const dirs = [...tokens, backupToken].map((t: string) => dirFor(root, t));
    const observed = collectSealBindings(rosterEffects(files), dirs);
    const base = {
      schema: FROST_TOKEN_ROSTER_SCHEMA,
      ca: "hw-ca",
      groupPublicKeyHex: REC.groupPublicKeyHex,
      threshold: REC.threshold,
      totalShares: tokens.length,
      sealTier: "hardware-pkcs11" as const,
    };
    // ONE participant, two devices: sound.
    const asOneParticipant: FrostTokenRoster = {
      ...base,
      participants: tokens.map((t: string, i: number) => ({
        x: i + 1,
        devices: i === 0 ? [t, backupToken] : [t],
      })),
    };
    assertRosterSound(asOneParticipant, observed);

    // The same devices, spelled as an extra position: refused.
    const asExtraPosition: FrostTokenRoster = {
      ...base,
      totalShares: tokens.length + 1,
      participants: [
        ...tokens.map((t: string, i: number) => ({ x: i + 1, devices: [t] })),
        { x: 1, devices: [backupToken] },
      ],
    };
    expect(() => assertRosterSound(asExtraPosition, observed)).toThrow(/duplicate-participant-index/);
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
