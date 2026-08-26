// frost-hsm-provision.test.ts — falsifiers for the wrap-key readiness ladder and the
// operator-approved provisioning plan.
//
// WHAT THESE TESTS ARE FOR. The module's whole claim is that "the device is not
// provisioned" and "the device is broken" stop being one answer. A test suite that only
// checked the happy path would leave that claim unfalsified, so the majority of what
// follows drives the ladder to each of its failure rungs and asserts the rung by NAME.
//
// The mocks here deliberately RETURN NON-ZERO. The defect this module was written after
// (`CKM_AES_CBC_PAD = 0x10d`, undetected for the life of the file) survived because every
// fake in the package answered `() => 0n` to everything — a fake that cannot refuse cannot
// falsify a refusal. `refusingLib` below is the correction: it answers from a table and
// returns CKR values the caller has to handle.

import { describe, expect, test } from "bun:test";
import type { Pkcs11Lib } from "./frost-share-adapter.ts";
import {
  applyWrapKeyProvisioning,
  classifyWrapKeyReadiness,
  discoverPkcs11Module,
  ensureConnectorConfig,
  FROST_WRAP_KEY_LABEL,
  moduleNotFoundRefusal,
  needsConfigHandoff,
  PKCS11_MODULE_CANDIDATES,
  resolveDeviceCredential,
  isMissingPrerequisite,
  type MechanismCheck,
  mechanismSatisfiesAdapter,
  planWrapKeyProvisioning,
  provisioningBrief,
  readinessExitCode,
  renderReadiness,
  usage,
  WrapKeyPlanError,
  type WrapKeyProbeEffects,
  type WrapKeyReadiness,
} from "./frost-hsm-provision.ts";
import { renderCeremonyBrief } from "./ceremony-brief.ts";
import { frostHsmSecretSource } from "./frost-hsm-secrets.ts";
import { readFileSync } from "node:fs";

const PASSWORD = "not-a-real-password";
const LIB_PATH = "/fake/pkcs11.dylib";

/** The two names the ceremony used to take from the environment. Retired: the store is the
 *  only source, and these must not appear in the module's executable text. */
const RETIRED_CREDENTIAL_VARS: readonly string[] = ["ZETA_YUBIHSM_PASSWORD", "ZETA_FROST_PKCS11_PIN"];

/** Drop comment lines so a scan checks CODE, never the prose that documents the property.
 *  Duplicated in `frost-hsm-secrets.test.ts` rather than imported: importing one test module
 *  from another re-runs its suites, and a helper is cheaper than a double count. */
function stripComments(source: string): string {
  return source
    .split("\n")
    .filter((line) => {
      const t = line.trimStart();
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
    })
    .join("\n");
}

/** CK_TOKEN_INFO layout the adapter's `parseCkTokenInfoIdentity` reads: 32-byte label,
 *  32-byte manufacturer, 16-byte model, 16-byte serial, at offsets 0/32/64/80. */
function tokenInfoBytes(label: string, serial: string): Uint8Array {
  const buf = new Uint8Array(1024).fill(0x20);
  const enc = new TextEncoder();
  buf.set(enc.encode(label.padEnd(32, " ").slice(0, 32)), 0);
  buf.set(enc.encode(serial.padEnd(16, " ").slice(0, 16)), 80);
  return buf;
}

interface LibKnobs {
  readonly initRv?: bigint;
  readonly slotListRv?: bigint;
  readonly slotCount?: number;
  readonly mechanismRv?: bigint;
  readonly mechanismInfo?: readonly [bigint, bigint, bigint];
  readonly omitMechanismFn?: boolean;
  readonly openSessionRv?: bigint;
  readonly loginRv?: bigint;
  readonly findRv?: bigint;
  readonly keyPresent?: boolean;
}

/** A mock that ANSWERS FROM A TABLE and can say no. Writes through the real pointer
 *  handoff shape (BigUint64Array out-params), so the caller's parsing is exercised. */
function refusingLib(k: LibKnobs = {}): Pkcs11Lib {
  const mechInfo = k.mechanismInfo ?? [16n, 32n, 0x301n];
  const lib: Pkcs11Lib = {
    C_Initialize: () => k.initRv ?? 0n,
    C_Finalize: () => 0n,
    C_GetSlotList: (_present, pSlotList, pulCount) => {
      if ((k.slotListRv ?? 0n) !== 0n) return k.slotListRv ?? 0n;
      const count = BigInt(k.slotCount ?? 1);
      if (pSlotList === 0n || pSlotList === null || pSlotList === undefined) {
        (pulCount as BigUint64Array)[0] = count;
        return 0n;
      }
      const list = pSlotList as BigUint64Array;
      for (let i = 0; i < Number(count); i++) list[i] = BigInt(i);
      (pulCount as BigUint64Array)[0] = count;
      return 0n;
    },
    C_GetTokenInfo: (_slot, pInfo) => {
      (pInfo as Uint8Array).set(tokenInfoBytes("test-token", "12345678"));
      return 0n;
    },
    C_OpenSession: (_slot, _flags, _app, _notify, phSession) => {
      if ((k.openSessionRv ?? 0n) !== 0n) return k.openSessionRv ?? 0n;
      phSession[0] = 7n;
      return 0n;
    },
    C_CloseSession: () => 0n,
    C_Login: () => k.loginRv ?? 0n,
    C_Logout: () => 0n,
    C_FindObjectsInit: () => 0n,
    C_FindObjects: (_s, phObject, _max, pulCount) => {
      if ((k.findRv ?? 0n) !== 0n) return k.findRv ?? 0n;
      if (k.keyPresent === true) {
        phObject[0] = 42n;
        pulCount[0] = 1n;
      } else {
        pulCount[0] = 0n;
      }
      return 0n;
    },
    C_FindObjectsFinal: () => 0n,
    C_EncryptInit: () => 0n,
    C_Encrypt: () => 0n,
    C_DecryptInit: () => 0n,
    C_Decrypt: () => 0n,
    ...(k.omitMechanismFn === true
      ? {}
      : {
          C_GetMechanismInfo: (_slot: number | bigint, _type: number | bigint, pInfo: unknown) => {
            if ((k.mechanismRv ?? 0n) !== 0n) return k.mechanismRv ?? 0n;
            const out = pInfo as BigUint64Array;
            out[0] = mechInfo[0];
            out[1] = mechInfo[1];
            out[2] = mechInfo[2];
            return 0n;
          },
        }),
  };
  return lib;
}

function fx(lib: Pkcs11Lib, existsOverride?: boolean): WrapKeyProbeEffects {
  return {
    exists: () => existsOverride ?? true,
    load: () => lib,
    // The out-params the classifier hands across are real typed arrays, so the mock writes
    // into them directly and no pointer is needed. Returning 1n keeps the ATTRIBUTE
    // template non-NULL, which is what the adapter refuses to fake.
    pointerOf: () => 1n,
  };
}

function classify(k: LibKnobs = {}, existsOverride?: boolean): WrapKeyReadiness {
  return classifyWrapKeyReadiness({ libraryPath: LIB_PATH, pin: "0001pw" }, fx(refusingLib(k), existsOverride));
}

// ============================================================================
// THE LADDER — every rung, by name
// ============================================================================

describe("HSMP: the readiness ladder separates unprovisioned from broken", () => {
  test("HSMP-1: a token that answers everything and holds no key is reachable-unprovisioned, NOT unreachable", () => {
    const r = classify({ keyPresent: false });
    expect(r.kind).toBe("reachable-unprovisioned");
    expect(isMissingPrerequisite(r)).toBe(true);
    expect(readinessExitCode(r)).toBe(3);
  });

  test("HSMP-2: the same token holding the key is provisioned", () => {
    const r = classify({ keyPresent: true });
    expect(r.kind).toBe("provisioned");
    expect(readinessExitCode(r)).toBe(0);
  });

  test("HSMP-3: the three exit codes are DISTINCT — the whole point of the module", () => {
    const provisioned = classify({ keyPresent: true });
    const unprovisioned = classify({ keyPresent: false });
    const broken = classify({ loginRv: 0xa0n });
    const codes = [readinessExitCode(provisioned), readinessExitCode(unprovisioned), readinessExitCode(broken)];
    expect(new Set(codes).size).toBe(3);
    expect(codes).toEqual([0, 3, 1]);
  });

  test("HSMP-4: a refused login is unreachable/login-refused, never 'not provisioned'", () => {
    const r = classify({ loginRv: 0xa0n });
    expect(r.kind).toBe("unreachable");
    if (r.kind !== "unreachable") throw new Error("unreachable");
    expect(r.stage).toBe("login-refused");
    // The message must carry the PIN-format fact, because a wrong-format PIN is the single
    // most likely cause and reads identically to a wrong password.
    expect(r.detail).toContain("<4-hex-authkey-id><password>");
  });

  test("HSMP-5: a module that will not initialise names CONFIGURATION, not hardware", () => {
    const r = classify({ initRv: 7n });
    if (r.kind !== "unreachable") throw new Error("expected unreachable");
    expect(r.stage).toBe("module-init-failed");
    expect(r.detail).toContain("YUBIHSM_PKCS11_CONF");
  });

  test("HSMP-6: CKR_CRYPTOKI_ALREADY_INITIALIZED is NOT an init failure", () => {
    const r = classify({ initRv: 0x191n, keyPresent: false });
    expect(r.kind).toBe("reachable-unprovisioned");
  });

  test("HSMP-7: an absent module file is module-absent, and never reaches the device", () => {
    const r = classify({}, false);
    if (r.kind !== "unreachable") throw new Error("expected unreachable");
    expect(r.stage).toBe("module-absent");
  });

  test("HSMP-8: an empty module path is module-absent — an unset env var is not a device verdict", () => {
    const r = classifyWrapKeyReadiness({ libraryPath: "", pin: "" }, fx(refusingLib()));
    if (r.kind !== "unreachable") throw new Error("expected unreachable");
    expect(r.stage).toBe("module-absent");
    expect(r.detail).toContain("ZETA_FROST_PKCS11_LIB");
  });

  test("HSMP-9: zero token-present slots is no-token-attached, not 'unprovisioned'", () => {
    const r = classify({ slotCount: 0 });
    if (r.kind !== "unreachable") throw new Error("expected unreachable");
    expect(r.stage).toBe("no-token-attached");
  });

  test("HSMP-10: a failing C_OpenSession is session-failed", () => {
    const r = classify({ openSessionRv: 0x101n });
    if (r.kind !== "unreachable") throw new Error("expected unreachable");
    expect(r.stage).toBe("session-failed");
  });

  test("HSMP-11: a module that would not load is module-load-failed, not module-absent", () => {
    const r = classifyWrapKeyReadiness(
      { libraryPath: LIB_PATH, pin: "" },
      {
        exists: () => true,
        load: () => {
          throw new Error("dlopen: no such symbol");
        },
        pointerOf: () => 1n,
      },
    );
    if (r.kind !== "unreachable") throw new Error("expected unreachable");
    expect(r.stage).toBe("module-load-failed");
    expect(r.detail).toContain("dlopen");
  });

  test("HSMP-12: a FAILED search throws rather than reading as 'no such key'", () => {
    // The pre-split code folded a non-OK C_FindObjects into the same branch as count==0,
    // so a broken search reported the token as merely unprovisioned. That is the exact
    // conflation this module exists to remove, one layer down.
    expect(() => classify({ findRv: 0x90n })).toThrow(/C_FindObjects failed/);
  });

  test("HSMP-13: C_Finalize runs even when a rung fails — no leaked module state", () => {
    let finalized = 0;
    const lib = { ...refusingLib({ loginRv: 0xa0n }), C_Finalize: () => ((finalized += 1), 0n) };
    classifyWrapKeyReadiness({ libraryPath: LIB_PATH, pin: "x" }, fx(lib));
    expect(finalized).toBe(1);
  });
});

// ============================================================================
// THE MECHANISM CHECK — the H3' half, falsified against a lying module
// ============================================================================

describe("HSMP: the mechanism check is a check, not a formality", () => {
  test("HSMP-14: a module declaring CKM_AES_CBC_PAD with a 16-byte ceiling is REFUSED", () => {
    // Supports the mechanism; cannot hold an AES-256 key. Provisioning would appear to work.
    const r = classify({ mechanismInfo: [16n, 16n, 0x301n] });
    if (r.kind !== "unreachable") throw new Error("expected unreachable");
    expect(r.stage).toBe("mechanism-unsupported");
    expect(r.detail).toContain("tops out at 16");
  });

  test("HSMP-15: encrypt-without-decrypt is refused — sealing a share you can never open", () => {
    const r = classify({ mechanismInfo: [16n, 32n, 0x101n] });
    if (r.kind !== "unreachable") throw new Error("expected unreachable");
    expect(r.stage).toBe("mechanism-unsupported");
    expect(r.detail).toContain("CKF_DECRYPT");
  });

  test("HSMP-16: CKR_MECHANISM_INVALID is reported as NOT-CHECKED, never as a pass", () => {
    // 112 = 0x70 = CKR_MECHANISM_INVALID — the rv the real device returns for the pre-fix
    // 0x10d constant. It leaves readiness answerable but must not read as verified.
    const r = classify({ mechanismRv: 112n, keyPresent: false });
    expect(r.kind).toBe("reachable-unprovisioned");
    if (r.kind === "unreachable") throw new Error("unreachable");
    expect(r.mechanism.checked).toBe(false);
    expect(mechanismSatisfiesAdapter(r.mechanism).ok).toBe(false);
  });

  test("HSMP-17: a lib with no C_GetMechanismInfo reports not-checked and SAYS SO", () => {
    const r = classify({ omitMechanismFn: true, keyPresent: false });
    if (r.kind === "unreachable") throw new Error("unreachable");
    expect(r.mechanism.checked).toBe(false);
    const verdict = mechanismSatisfiesAdapter(r.mechanism);
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toContain("NOT verified");
    expect(renderReadiness(r)).toContain("NOT VERIFIED");
  });

  test("HSMP-18: the real device's measured answer (min 16, max 32, flags 0x301) SATISFIES the adapter", () => {
    // Measured 2026-08-26, YubiHSM 2 fw 2.4.1 serial 39160506:
    //   C_GetMechanismInfo(slot 0, 0x1085) -> rv 0, min 16, max 32, flags 0x301
    const measured: MechanismCheck = { checked: true, minKeyBytes: 16n, maxKeyBytes: 32n, flags: 0x301n };
    const verdict = mechanismSatisfiesAdapter(measured);
    expect(verdict.ok).toBe(true);
    expect(verdict.why).toContain("32");
  });
});

// ============================================================================
// THE PLAN — the refusals are the falsifiers
// ============================================================================

describe("HSMP: the plan refuses the commands that fail LATE", () => {
  test("HSMP-19: a key without decrypt-cbc is refused at plan time", () => {
    expect(() => planWrapKeyProvisioning({ password: PASSWORD, capabilities: ["encrypt-cbc"] })).toThrow(
      WrapKeyPlanError,
    );
    try {
      planWrapKeyProvisioning({ password: PASSWORD, capabilities: ["encrypt-cbc"] });
    } catch (e) {
      expect((e as Error).message).toContain("UNSEAL");
    }
  });

  test("HSMP-20: a key without encrypt-cbc is refused, and the message names SEAL", () => {
    try {
      planWrapKeyProvisioning({ password: PASSWORD, capabilities: ["decrypt-cbc"] });
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as Error).message).toContain("SEAL");
    }
  });

  test("HSMP-21: exportable-under-wrap is refused — it voids hardware residency", () => {
    expect(() =>
      planWrapKeyProvisioning({
        password: PASSWORD,
        capabilities: ["encrypt-cbc", "decrypt-cbc", "exportable-under-wrap"],
      }),
    ).toThrow(/hardware-resident/);
  });

  test("HSMP-22: a shorter algorithm is refused rather than silently lowering the tier", () => {
    expect(() => planWrapKeyProvisioning({ password: PASSWORD, algorithm: "aes128" })).toThrow(/aes128/);
  });

  test("HSMP-23: an empty password is refused — no interactive prompt behind a biometric gate", () => {
    expect(() => planWrapKeyProvisioning({ password: "" })).toThrow(WrapKeyPlanError);
  });

  test("HSMP-24: an empty label is refused — the adapter searches BY label", () => {
    expect(() => planWrapKeyProvisioning({ password: PASSWORD, label: "   " })).toThrow(/label/);
  });

  test("HSMP-25: the default plan carries the verified flag spellings and the adapter's label", () => {
    const plan = planWrapKeyProvisioning({ password: PASSWORD });
    expect(plan.label).toBe(FROST_WRAP_KEY_LABEL);
    expect(plan.argv).toContain("generate-symmetric-key");
    expect(plan.argv).toContain("--connector");
    expect(plan.argv).toContain("--authkey");
    expect(plan.argv[plan.argv.indexOf("-A") + 1]).toBe("aes256");
    expect(plan.argv[plan.argv.indexOf("-c") + 1]).toBe("encrypt-cbc,decrypt-cbc");
    expect(plan.argv[plan.argv.indexOf("-l") + 1]).toBe(FROST_WRAP_KEY_LABEL);
  });

  test("HSMP-26: the password is IN argv and NOT in displayArgv — carried by an EXACT pin", () => {
    const plan = planWrapKeyProvisioning({ password: PASSWORD });
    // An absence assertion witnesses ONE rendering of a leak, never its absence — so the
    // claim is carried by an exact-equality pin on the WHOLE array, which fails on any
    // extra, missing, moved, or altered element. `.not.toContain` below is then a
    // redundant statement of intent, not the check.
    expect(plan.displayArgv).toEqual([
      "-p",
      "<redacted>",
      "--connector",
      "http://127.0.0.1:12345",
      "--authkey",
      "1",
      "-a",
      "generate-symmetric-key",
      "-i",
      "0",
      "-l",
      FROST_WRAP_KEY_LABEL,
      "-d",
      "1",
      "-c",
      "encrypt-cbc,decrypt-cbc",
      "-A",
      "aes256",
    ]);
    // The other direction matters just as much: a plan that never authenticates would
    // satisfy every redaction assertion and would be a command that cannot work.
    expect(plan.argv).toEqual(["-p", PASSWORD, ...plan.displayArgv.slice(2)]);
    expect(plan.displayArgv).not.toContain(PASSWORD);
    expect(plan.displayArgv.join(" ")).not.toContain(PASSWORD);
  });

  test("HSMP-27: the brief the operator reads carries the redacted command and never the password", () => {
    const plan = planWrapKeyProvisioning({ password: PASSWORD });
    const rendered = renderCeremonyBrief(provisioningBrief(plan));
    // The positive pin that carries the claim: the brief's command subject is EXACTLY the
    // redacted argv, character for character. Any substitution of the real password for
    // the placeholder changes this line, so the absence assertion below cannot be the only
    // thing standing between a secret and an operator's terminal.
    expect(rendered).toContain(`yubihsm-shell ${plan.displayArgv.join(" ")}`);
    expect(rendered).not.toContain(PASSWORD);
    expect(rendered).toContain(FROST_WRAP_KEY_LABEL);
    // `ceremony-gate.ts` classifies this operation `biometric-ceremony`; if that ever
    // changes, renderCeremonyBrief prints the MISMATCH arm and this fails loudly.
    expect(rendered).toContain("WHY GATED");
    expect(rendered).not.toContain("MISMATCH");
  });
});

// ============================================================================
// APPLY — fail-closed at four points
// ============================================================================

describe("HSMP: apply is fail-closed, and dry run never opens the door", () => {
  const plan = planWrapKeyProvisioning({ password: PASSWORD });
  const neverRun = {
    run: () => {
      throw new Error("the device was touched when it must not have been");
    },
  };

  test("HSMP-28: a dry run returns the plan and NEVER calls the biometric door", async () => {
    let doorCalls = 0;
    const out = await applyWrapKeyProvisioning({
      probe: { libraryPath: LIB_PATH, pin: "x" },
      plan,
      dryRun: true,
      biometricAuth: async () => ((doorCalls += 1), { ok: true, platform: "macos-touchid" as const }),
      probeFx: fx(refusingLib({ keyPresent: false })),
      execFx: neverRun,
    });
    expect(out.action).toBe("dry-run");
    expect(doorCalls).toBe(0);
  });

  test("HSMP-29: an ABSENT biometric door aborts — fail-closed, not fail-open", async () => {
    const out = await applyWrapKeyProvisioning({
      probe: { libraryPath: LIB_PATH, pin: "x" },
      plan,
      dryRun: false,
      probeFx: fx(refusingLib({ keyPresent: false })),
      execFx: neverRun,
    });
    expect(out.action).toBe("aborted-biometric");
  });

  test("HSMP-30: a declined approval aborts and the device is never touched", async () => {
    const out = await applyWrapKeyProvisioning({
      probe: { libraryPath: LIB_PATH, pin: "x" },
      plan,
      dryRun: false,
      biometricAuth: async () => ({ ok: false, platform: "macos-touchid" as const, reason: "user cancelled" }),
      probeFx: fx(refusingLib({ keyPresent: false })),
      execFx: neverRun,
    });
    expect(out.action).toBe("aborted-biometric");
    expect(out.detail).toContain("cancelled");
  });

  test("HSMP-31: an already-provisioned token is a no-op that raises NO prompt (idempotency §12)", async () => {
    let doorCalls = 0;
    const out = await applyWrapKeyProvisioning({
      probe: { libraryPath: LIB_PATH, pin: "x" },
      plan,
      dryRun: false,
      biometricAuth: async () => ((doorCalls += 1), { ok: true, platform: "macos-touchid" as const }),
      probeFx: fx(refusingLib({ keyPresent: true })),
      execFx: neverRun,
    });
    expect(out.action).toBe("already-provisioned");
    expect(doorCalls).toBe(0);
  });

  test("HSMP-32: an unreachable device is refused WITHOUT prompting a human", async () => {
    let doorCalls = 0;
    const out = await applyWrapKeyProvisioning({
      probe: { libraryPath: LIB_PATH, pin: "x" },
      plan,
      dryRun: false,
      biometricAuth: async () => ((doorCalls += 1), { ok: true, platform: "macos-touchid" as const }),
      probeFx: fx(refusingLib({ loginRv: 0xa0n })),
      execFx: neverRun,
    });
    expect(out.action).toBe("refused-device-unreachable");
    expect(doorCalls).toBe(0);
  });

  test("HSMP-33: approval + a zero-exit tool is the ONLY path that reaches the device", async () => {
    const seen: string[][] = [];
    const out = await applyWrapKeyProvisioning({
      probe: { libraryPath: LIB_PATH, pin: "x" },
      plan,
      dryRun: false,
      biometricAuth: async () => ({ ok: true, platform: "macos-touchid" as const }),
      probeFx: fx(refusingLib({ keyPresent: false })),
      execFx: {
        run: (_p, argv) => {
          seen.push([...argv]);
          return { status: 0, output: "Generated Symmetric key 0x1234" };
        },
      },
    });
    expect(out.action).toBe("provisioned");
    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain("generate-symmetric-key");
  });

  test("HSMP-34: a non-zero tool exit is NOT reported as provisioned", async () => {
    const out = await applyWrapKeyProvisioning({
      probe: { libraryPath: LIB_PATH, pin: "x" },
      plan,
      dryRun: false,
      biometricAuth: async () => ({ ok: true, platform: "macos-touchid" as const }),
      probeFx: fx(refusingLib({ keyPresent: false })),
      execFx: { run: () => ({ status: 1, output: "Failed to generate key" }) },
    });
    expect(out.action).not.toBe("provisioned");
    expect(out.detail).toContain("Failed to generate key");
  });

  test("HSMP-35: the ceremony brief is SHOWN before the door opens, not after", async () => {
    const order: string[] = [];
    await applyWrapKeyProvisioning({
      probe: { libraryPath: LIB_PATH, pin: "x" },
      plan,
      dryRun: false,
      biometricAuth: async () => (order.push("door"), { ok: true, platform: "macos-touchid" as const }),
      probeFx: fx(refusingLib({ keyPresent: false })),
      execFx: { run: () => (order.push("exec"), { status: 0, output: "" }) },
      briefFx: { notify: () => order.push("brief") },
    });
    expect(order).toEqual(["brief", "door", "exec"]);
  });
});

// ============================================================================
// THE READOUT — it has to name the next act
// ============================================================================

describe("HSMP: the readout is actionable", () => {
  test("HSMP-36: the unprovisioned readout says EXPECTED and names the one remaining command", () => {
    const out = renderReadiness(classify({ keyPresent: false }));
    expect(out).toContain("EXPECTED");
    expect(out).toContain("frost-hsm-provision.ts apply --apply");
  });

  test("HSMP-37: the unreachable readout says it is a REAL failure, so the two never read alike", () => {
    const out = renderReadiness(classify({ loginRv: 0xa0n }));
    expect(out).toContain("real failure, not a missing prerequisite");
    expect(out).not.toContain("EXPECTED");
  });

  test("HSMP-38: usage documents all four exit codes", () => {
    const u = usage();
    for (const code of ["rc 0", "rc 3", "rc 1", "rc 2"]) expect(u).toContain(code);
  });
});

// ============================================================================
// NO SECRET IS EVER AN ARGUMENT — the invocation shape
// ============================================================================

describe("HSMP: the credential comes from the store and from nowhere else", () => {
  const emptyStore = frostHsmSecretSource(() => undefined);
  const fullStore = frostHsmSecretSource(() => PASSWORD);

  test("HSMP-39: a present credential yields the password AND the derived PIN", () => {
    const r = resolveDeviceCredential(fullStore, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.password.reveal()).toBe(PASSWORD);
    expect(r.pin.reveal()).toBe(`0001${PASSWORD}`);
  });

  test("HSMP-40: an absent credential REFUSES, and the refusal renders its remedy", () => {
    const r = resolveDeviceCredential(emptyStore, 1);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.code).toBe("secret-absent");
    expect(r.rendered).toContain("TO PROCEED:");
    expect(r.rendered).toContain("secret-clip.sh set zeta-yubihsm-password");
  });

  test("HSMP-41: THE ENVIRONMENT CANNOT SATISFY IT — the CLI names no credential variable", () => {
    // Removing the documentation for a variable that is still read would leave the export
    // working and nobody the wiser, so the claim is checked against the module's executable
    // text. A source scan rather than an env-mutation test because setting a credential in
    // this process hoists it into every child's environment —
    // `lint-no-ambient-credential-hoist.ts` refuses that, and it refused this test's first
    // draft. Comments are stripped: the header names both variables in order to say it does
    // not read them.
    //
    // `process.env` itself is NOT forbidden here (unlike in frost-hsm-secrets.ts): this
    // module reads the non-secret overrides — module path, slot, label, connector, auth key
    // id — from it, and none of those is a credential.
    const code = stripComments(readFileSync(new URL("./frost-hsm-provision.ts", import.meta.url), "utf8"));
    expect(RETIRED_CREDENTIAL_VARS.filter((name) => code.includes(name))).toEqual([]);
  });

  test("HSMP-42: a bad auth key id refuses with a remedy, never with a raw throw", () => {
    // A `Pkcs11PinError` escaping to the terminal would be a stack trace where a refusal
    // belongs — technically informative, and with nothing for the reader to do next.
    const r = resolveDeviceCredential(fullStore, 0);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.rendered).toContain("TO PROCEED:");
    expect(r.rendered).toContain("ZETA_YUBIHSM_AUTHKEY=1");
  });

  test("HSMP-43: usage says out loud that no verb takes a credential", () => {
    const u = usage();
    expect(u).toContain("NO VERB TAKES A CREDENTIAL");
    expect(u).toContain("zeta-yubihsm-password");
    expect(u).toContain("rehearse");
  });
});

// ============================================================================
// DISCOVERY — an input the tool can find is an input the operator cannot get wrong
// ============================================================================

describe("HSMP: discovery replaces the exports zflash never needed", () => {
  test("HSMP-44: an explicit override wins and is reported AS an override", () => {
    const d = discoverPkcs11Module(() => true, "/some/where/else.dylib");
    expect(d.found).toBe(true);
    if (!d.found) throw new Error("unreachable");
    expect(d.path).toBe("/some/where/else.dylib");
    expect(d.via).toBe("override");
  });

  test("HSMP-45: discovery picks the first candidate THAT EXISTS, not the first candidate", () => {
    // Picking a path that is not there would turn "none installed" into a misleading
    // "the first one is broken" two rungs later.
    const present = PKCS11_MODULE_CANDIDATES[2] ?? "";
    const d = discoverPkcs11Module((p) => p === present);
    expect(d.found).toBe(true);
    if (!d.found) throw new Error("unreachable");
    expect(d.path).toBe(present);
    expect(d.via).toBe("discovered");
  });

  test("HSMP-46: nothing found reports WHERE it looked — a not-found with no search is a dead end", () => {
    const d = discoverPkcs11Module(() => false);
    expect(d.found).toBe(false);
    if (d.found) throw new Error("unreachable");
    expect(d.searched).toEqual(PKCS11_MODULE_CANDIDATES);
    const rendered = moduleNotFoundRefusal(d.searched);
    expect(rendered).toContain("TO PROCEED:");
    for (const c of PKCS11_MODULE_CANDIDATES) expect(rendered).toContain(c);
  });

  test("HSMP-47: an existing config is NEVER second-guessed — env first, then the real files", () => {
    const wrote: string[] = [];
    const fx = {
      exists: () => true,
      write: (p: string) => wrote.push(p),
      home: "/home/x",
      tmpDir: "/tmp",
    };
    expect(ensureConnectorConfig(fx, "http://c", "/env/path.conf")).toEqual({
      kind: "from-env",
      path: "/env/path.conf",
    });
    expect(ensureConnectorConfig(fx, "http://c", undefined)).toEqual({
      kind: "found",
      path: "/home/x/.yubihsm_pkcs11.conf",
    });
    expect(wrote).toEqual([]); // a configured host is left alone
  });

  test("HSMP-48: with no config anywhere it writes ONE line, naming the connector and no secret", () => {
    const wrote: Array<[string, string]> = [];
    const r = ensureConnectorConfig(
      { exists: () => false, write: (p, c) => wrote.push([p, c]), home: "/home/x", tmpDir: "/tmp" },
      "http://127.0.0.1:12345",
      undefined,
    );
    expect(r).toEqual({ kind: "written", path: "/tmp/zeta-yubihsm-pkcs11.conf", connector: "http://127.0.0.1:12345" });
    expect(wrote).toHaveLength(1);
    expect(wrote[0]?.[1]).toBe("connector = http://127.0.0.1:12345\n");
    // It goes to the process temp dir, never into $HOME or /etc: this writes a file on
    // someone's machine, and the blast radius of doing so should be as small as it can be.
    expect(wrote[0]?.[0]).toBe("/tmp/zeta-yubihsm-pkcs11.conf");
  });

  test("HSMP-53: ONLY a freshly-written config needs a new process — the handoff is one level deep", () => {
    // MEASURED 2026-08-26: the dlopen'd PKCS#11 module reads YUBIHSM_PKCS11_CONF with
    // getenv(3), and an in-process `process.env` assignment does not reach it. Same conf
    // file: set in the parent environment -> reachable-unprovisioned, token
    // YubiHSM#39160506; assigned in-process -> C_Initialize returned 7 (CKR_ARGUMENTS_BAD).
    //
    // What this asserts is the TERMINATION argument, which is the part that could be wrong:
    // the child of a handoff sees the variable set and therefore takes `from-env`, and
    // `from-env` does not hand off. If this predicate were ever true for `from-env`, the
    // CLI would fork itself forever.
    expect(needsConfigHandoff({ kind: "written", path: "/tmp/c", connector: "http://c" })).toBe(true);
    expect(needsConfigHandoff({ kind: "from-env", path: "/tmp/c" })).toBe(false);
    expect(needsConfigHandoff({ kind: "found", path: "/tmp/c" })).toBe(false);
  });

  test("HSMP-49: an empty override is not an override — it falls through to discovery", () => {
    const d = discoverPkcs11Module((p) => p === PKCS11_MODULE_CANDIDATES[0], "");
    expect(d.found).toBe(true);
    if (!d.found) throw new Error("unreachable");
    expect(d.via).toBe("discovered");
  });
});

// ============================================================================
// THE VACUITY THAT WAS FOUND BY RUNNING IT — no PIN is not "no key"
// ============================================================================

describe("HSMP: a search that could not run never wears the answer of one that did", () => {
  test("HSMP-50: an EMPTY PIN is login-refused, NOT reachable-unprovisioned", () => {
    // MEASURED 2026-08-26 against the live device (serial 39160506): the shipped `status`
    // with no credential printed `reachable-unprovisioned` and rc 3 — the rung whose own
    // docstring says it is reached "ONLY by getting all the way through login". It was not.
    // C_Login was skipped, and an unauthenticated C_FindObjects on a YubiHSM returns nothing
    // whether or not the key is there, so "no such key" and "no session that may see any
    // key" produced one answer. That is the exact conflation this module exists to remove.
    const r = classifyWrapKeyReadiness({ libraryPath: LIB_PATH, pin: "" }, fx(refusingLib({ keyPresent: true })));
    if (r.kind !== "unreachable") throw new Error(`expected unreachable, got ${r.kind}`);
    expect(r.stage).toBe("login-refused");
    expect(r.detail).toContain("never attempted");
  });

  test("HSMP-51: the key being PRESENT does not rescue an empty PIN either", () => {
    // The mutant that would survive a weaker test: reporting `provisioned` when the search
    // happens to succeed. A result the session was never authorised to see is not a result.
    const r = classifyWrapKeyReadiness({ libraryPath: LIB_PATH, pin: "" }, fx(refusingLib({ keyPresent: true })));
    expect(r.kind).not.toBe("provisioned");
    expect(readinessExitCode(r)).toBe(1);
  });

  test("HSMP-52: a NON-empty PIN still reaches the search — the guard did not swallow the good path", () => {
    const r = classifyWrapKeyReadiness({ libraryPath: LIB_PATH, pin: "0001pw" }, fx(refusingLib({ keyPresent: true })));
    expect(r.kind).toBe("provisioned");
  });
});
