#!/usr/bin/env bun
/**
 * frost-hsm-provision.ts — the ONE device-state change the `hardware-pkcs11` tier needs,
 * written as reviewable code instead of as instructions in a doc.
 *
 * ============================================================================
 * WHAT THIS EXISTS TO FIX — "MISSING PREREQUISITE" LOOKED LIKE "BROKEN DEVICE"
 * ============================================================================
 *
 * MEASURED 2026-08-26 on a YubiHSM 2 (firmware 2.4.1, serial 39160506), factory-empty:
 * the hardware lane opts in, HW-1 passes, and HW-2 fails with
 *
 *     frost-share-adapter: no PKCS#11 key labelled zeta-frost-wrap in the token
 *
 * That failure is CORRECT — the lane must not skip and must not fall back to the software
 * fake. But it is reported at the same severity, through the same exit status (1), as a
 * dead connector, an unloadable module, or a refused login. An operator reading rc=1
 * cannot tell "you have one approved command left to run" from "your hardware is broken",
 * and the first of those is the ordinary, expected state of a device fresh out of its box.
 *
 * So this module gives the question a LADDER instead of a boolean, and gives the middle
 * rung its own exit code:
 *
 *   provisioned              rc 0   the wrap key is on the device; the lane can run
 *   reachable-unprovisioned  rc 3   the device answered, authenticated, and holds no such
 *                                   key. EXPECTED. One approved command away.
 *   unreachable              rc 1   something is actually wrong, and `stage` says which
 *                                   of eight things it is.
 *
 * `reachable-unprovisioned` is reachable ONLY by getting all the way through login, so it
 * is not a guess: the module loaded, the connector answered, a token was in the slot, the
 * mechanism the adapter needs is supported, a session opened, and the PIN was accepted.
 * Everything except the key. Anything short of that is `unreachable` with a named stage —
 * a check that could not run never wears the answer of a check that ran and said no.
 *
 * ============================================================================
 * WHY THIS IS CODE AND NOT A DOC LINE
 * ============================================================================
 *
 * The previous readiness note carried the provisioning step as a shell snippet with the
 * honest disclaimer *"flags not executed, so treat the exact spelling as unverified"*.
 * A command nobody can run is a command nobody can check, and the two things most likely
 * to be wrong in it are the two things that fail SILENTLY LATE:
 *
 *   - a key generated WITHOUT `decrypt-cbc` provisions fine and cannot unseal a share;
 *   - a key generated WITH `exportable-under-wrap` provisions fine and quietly voids the
 *     one property that separates `hardware-pkcs11` from a software tier — the wrapping
 *     key never leaving the device.
 *
 * `planWrapKeyProvisioning` REFUSES both, at plan time, before a human is asked to
 * approve anything. That refusal is the part a doc line cannot have.
 *
 * ============================================================================
 * THE HUMAN GATE — the agent executes, the operator approves
 * ============================================================================
 *
 * `apply` runs behind `ceremony-gate.ts`'s `provision-or-reconfigure-hardware-token`,
 * which that closed set already classifies `biometric-ceremony`. The standing position is
 * that the biometric IS the authorization
 * (`memory/feedback_nothing_operator_run_only_operator_approved_via_biometric_aaron_2026_06_21.md`),
 * and `requireBiometric` is fail-closed: no injected door ⇒ no approval ⇒ nothing runs.
 *
 * DEFAULT IS DRY RUN. `apply` requires `--apply` explicitly; every other verb, and the
 * bare command, only reads. A dry run never calls the biometric door at all, so planning
 * cannot habituate an operator into approving.
 *
 * ============================================================================
 * WHAT THIS MODULE DOES NOT DO
 * ============================================================================
 *
 * It does not change the device's authentication key or password, does not delete
 * objects, and does not reset. It generates ONE AES-256 key with two capabilities. Those
 * are separate operations with separate blast radii and they belong behind their own
 * briefs, not folded into this one so that approving a wrap key silently approves a
 * password change.
 *
 * ============================================================================
 * NO SECRET IS EVER AN ARGUMENT — the invocation shape, adopted from zflash
 * ============================================================================
 *
 * Every verb below takes NO credential of any kind. The one credential this ceremony needs
 * is read from the OS keystore under the name `zeta-yubihsm-password`, and the PKCS#11 PIN
 * is DERIVED from it — see `frost-hsm-secrets.ts`, which carries the reasoning, the
 * comparison against zflash, and the honest note about what zflash has not shipped.
 *
 * The module path and the connector config are DISCOVERED rather than exported, for the same
 * reason zflash discovers the newest ISO and the newest removable device: an input the tool
 * can find is an input the operator cannot get wrong. Environment variables still override
 * every discovered value — none of them is a secret.
 *
 * USAGE — one command, no exports, nothing sensitive typed
 *
 *   bun tools/setup/persona-keys/frost-hsm-provision.ts status     # read-only; rc 0/3/1
 *   bun tools/setup/persona-keys/frost-hsm-provision.ts plan       # + the exact command, redacted
 *   bun tools/setup/persona-keys/frost-hsm-provision.ts rehearse --apply   # gate, NO device write
 *   bun tools/setup/persona-keys/frost-hsm-provision.ts apply --apply      # the real act
 *
 *   `rehearse --apply` runs the WHOLE chain — classify, resolve the credential from the
 *   keystore, fully specify, read the device, brief, and open the Touch ID door — against an
 *   act that does nothing. It exists because an untested gate is the failure this repo keeps
 *   finding, and because the ceremony should be exercised once before it is trusted with a
 *   device write.
 *
 *   Environment — NON-SECRET overrides only. There is deliberately no environment variable
 *   for the password or the PIN; they are not accepted from the environment at all.
 *     ZETA_FROST_PKCS11_LIB    path to the PKCS#11 module (default: discovered)
 *     ZETA_FROST_PKCS11_SLOT   slot index (default 0)
 *     ZETA_FROST_PKCS11_LABEL  wrap-key label (default zeta-frost-wrap)
 *     YUBIHSM_PKCS11_CONF      the module's own config file (default: discovered, else written
 *                              to a temp file naming the connector — config, never a secret)
 *     ZETA_YUBIHSM_CONNECTOR   connector URL (default http://127.0.0.1:12345)
 *     ZETA_YUBIHSM_AUTHKEY     auth key id (default 1)
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  defaultFfiLoader,
  defaultPointerOf,
  enumeratePkcs11Tokens,
  findKeyByLabel,
  type Pkcs11AttachedToken,
  type Pkcs11Lib,
  type Pkcs11PointerOf,
} from "./frost-share-adapter.ts";
import {
  assertGatedCeremony,
  type CeremonyBrief,
  type CeremonyBriefEffects,
  ceremonyPromptLine,
  renderCeremonyBrief,
  requestedBy,
} from "./ceremony-brief.ts";
import { type BiometricAuth, requireBiometric } from "./biometric.ts";
import {
  HANDOFF_REFUSAL_CODES,
  namedEscape,
  refusal,
  renderRefusal,
  resolveSecret,
  runGatedCeremony,
  type Secret,
  type SecretSource,
} from "./ceremony-handoff.ts";
import {
  FROST_HSM_PASSWORD_REF,
  FROST_HSM_PASSWORD_REQUIREMENT,
  frostHsmSecretSource,
  pinHexCaseIsObservable,
  pkcs11PinFor,
  realKeystoreRead,
} from "./frost-hsm-secrets.ts";

/** The label the adapter looks for. Single source; the plan and the probe share it. */
export const FROST_WRAP_KEY_LABEL = "zeta-frost-wrap";

/** The mechanism `frost-share-adapter` seals with. Duplicated here DELIBERATELY as a
 *  literal rather than imported: this module's job is to check that the device supports
 *  what the adapter asks for, and importing the adapter's constant would compare the
 *  value to itself, which cannot fail. Same reasoning as FSA-32. */
const CKM_AES_CBC_PAD_EXPECTED = 0x00001085n;

const CKF_ENCRYPT = 0x00000100n;
const CKF_DECRYPT = 0x00000200n;
const CKF_SERIAL_SESSION = 0x00000004n;
const CKF_RW_SESSION = 0x00000002n;
const CKU_USER = 1n;
const CKR_OK = 0n;
const CKR_CRYPTOKI_ALREADY_INITIALIZED = 0x191n;
const CKR_USER_ALREADY_LOGGED_IN = 0x100n;
/** AES-256 in bytes. CK_MECHANISM_INFO key sizes are in bytes for AES. */
const AES256_KEY_BYTES = 32n;

function rvOk(rv: number | bigint): boolean {
  return BigInt(rv) === CKR_OK;
}

/**
 * Where the ladder stopped when it did not reach a token that could answer.
 *
 * Eight values, not one. Each names a DIFFERENT thing to go fix, and collapsing them into
 * "hardware failed" is what produced the readout this module exists to replace.
 */
export type WrapKeyUnreachableStage =
  | "module-absent"
  | "module-load-failed"
  | "module-init-failed"
  | "slot-enumeration-failed"
  | "no-token-attached"
  | "mechanism-unsupported"
  | "session-failed"
  | "login-refused";

/** Whether the mechanism check ran at all. `not-checked` is an honest third value: a
 *  caller driving a lib without `C_GetMechanismInfo` gets "did not run", never "passed". */
export type MechanismCheck =
  | { readonly checked: false; readonly reason: string }
  | { readonly checked: true; readonly minKeyBytes: bigint; readonly maxKeyBytes: bigint; readonly flags: bigint };

export type WrapKeyReadiness =
  | {
      readonly kind: "provisioned";
      readonly tokenIdentity: string | undefined;
      readonly label: string;
      readonly mechanism: MechanismCheck;
    }
  | {
      readonly kind: "reachable-unprovisioned";
      readonly tokenIdentity: string | undefined;
      readonly label: string;
      readonly mechanism: MechanismCheck;
    }
  | {
      readonly kind: "unreachable";
      readonly stage: WrapKeyUnreachableStage;
      readonly detail: string;
      readonly tokenIdentity: string | undefined;
    };

/**
 * Exit codes, as a total function so the mapping is testable rather than scattered
 * through the CLI. `3` is the whole point of the file: a distinct, greppable status for
 * "expected, actionable, not broken".
 */
export function readinessExitCode(r: WrapKeyReadiness): 0 | 1 | 3 {
  switch (r.kind) {
    case "provisioned":
      return 0;
    case "reachable-unprovisioned":
      return 3;
    case "unreachable":
      return 1;
  }
}

/** True when the device answered every question except the one about the key. */
export function isMissingPrerequisite(r: WrapKeyReadiness): boolean {
  return r.kind === "reachable-unprovisioned";
}

/** The injected door set (§13 noninterference). Nothing here is ambient. */
export interface WrapKeyProbeEffects {
  readonly exists: (path: string) => boolean;
  readonly load: (libraryPath: string) => Pkcs11Lib;
  readonly pointerOf: Pkcs11PointerOf;
}

export function realWrapKeyProbeEffects(): WrapKeyProbeEffects {
  return { exists: existsSync, load: defaultFfiLoader, pointerOf: defaultPointerOf };
}

export interface WrapKeyProbeOptions {
  readonly libraryPath: string;
  readonly pin: string;
  readonly slotId?: number;
  readonly label?: string;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function checkMechanism(lib: Pkcs11Lib, slotId: number): MechanismCheck {
  const getInfo = lib.C_GetMechanismInfo;
  if (getInfo === undefined) {
    return {
      checked: false,
      reason:
        "the loaded PKCS#11 surface exposes no C_GetMechanismInfo, so mechanism support was NOT " +
        "verified. Reported as not-checked rather than as a pass.",
    };
  }
  // CK_MECHANISM_INFO on a 64-bit host: three CK_ULONGs — min key size, max key size, flags.
  const info = new BigUint64Array(3);
  const rv = getInfo(BigInt(slotId), CKM_AES_CBC_PAD_EXPECTED, info);
  if (!rvOk(rv)) {
    return { checked: false, reason: `C_GetMechanismInfo(0x1085) returned ${rv}` };
  }
  return { checked: true, minKeyBytes: info[0] ?? 0n, maxKeyBytes: info[1] ?? 0n, flags: info[2] ?? 0n };
}

/**
 * Does this mechanism report satisfy what `frost-share-adapter` will ask of it? Separate
 * from the reading so the judgement is testable without a device.
 *
 * Three requirements, and all three have bitten a token somewhere: encrypt, decrypt, and a
 * maximum key size that reaches AES-256. A module advertising CBC_PAD with a 16-byte
 * ceiling supports the mechanism and cannot hold this key.
 *
 * SCANNER NOTE (2026-08-26, PR #15564). GitHub code-quality flags the two `m.flags & CKF_*`
 * lines below as "implicit operand conversion ... from undefined to number". Adjudicated as a
 * FALSE POSITIVE, not suppressed: `m.flags` is `bigint` on the `checked: true` arm, both
 * `CKF_*` are `bigint` literals, and `bigint & bigint` is `bigint` with no conversion of any
 * kind. The scanner appears not to follow the `if (!m.checked) return` narrowing, so it sees
 * the union's other arm — where `flags` is absent, hence `undefined`. `tsc --strict` with
 * `exactOptionalPropertyTypes` reports zero errors on this file, and that is the authority.
 * Left as-is deliberately: restructuring correct code to quiet a tool that misreads it would
 * make the code worse and the tool no better.
 */
export function mechanismSatisfiesAdapter(m: MechanismCheck): { ok: boolean; why: string } {
  if (!m.checked) return { ok: false, why: m.reason };
  if ((m.flags & CKF_ENCRYPT) === 0n) return { ok: false, why: "CKM_AES_CBC_PAD is declared without CKF_ENCRYPT" };
  if ((m.flags & CKF_DECRYPT) === 0n) return { ok: false, why: "CKM_AES_CBC_PAD is declared without CKF_DECRYPT" };
  if (m.maxKeyBytes < AES256_KEY_BYTES) {
    return {
      ok: false,
      why: `CKM_AES_CBC_PAD tops out at ${m.maxKeyBytes} bytes; the wrap key is AES-256 (${AES256_KEY_BYTES} bytes)`,
    };
  }
  return { ok: true, why: `CKM_AES_CBC_PAD present, encrypt+decrypt, up to ${m.maxKeyBytes} bytes` };
}

/**
 * Walk the ladder. Every rung either advances or returns `unreachable` NAMING the rung —
 * there is no path that returns a cheerful answer on the strength of a step that did not
 * run.
 *
 * Read-only on the device by construction: it enumerates, opens a session, logs in, and
 * searches for a label. It creates nothing, deletes nothing, and writes no attribute.
 */
export function classifyWrapKeyReadiness(
  opts: WrapKeyProbeOptions,
  fx: WrapKeyProbeEffects = realWrapKeyProbeEffects(),
): WrapKeyReadiness {
  const label = opts.label ?? FROST_WRAP_KEY_LABEL;
  const slotId = opts.slotId ?? 0;
  const nope = (stage: WrapKeyUnreachableStage, detail: string, tokenIdentity?: string): WrapKeyReadiness => ({
    kind: "unreachable",
    stage,
    detail,
    tokenIdentity,
  });

  if (opts.libraryPath.trim() === "") {
    return nope("module-absent", "no PKCS#11 module path was given (ZETA_FROST_PKCS11_LIB is empty)");
  }
  if (!fx.exists(opts.libraryPath)) {
    return nope("module-absent", `no PKCS#11 module at ${opts.libraryPath}`);
  }

  let lib: Pkcs11Lib;
  try {
    lib = fx.load(opts.libraryPath);
  } catch (err) {
    return nope("module-load-failed", `${opts.libraryPath} would not load: ${messageOf(err)}`);
  }

  const initRv = lib.C_Initialize(0n);
  if (!rvOk(initRv) && BigInt(initRv) !== CKR_CRYPTOKI_ALREADY_INITIALIZED) {
    return nope(
      "module-init-failed",
      `C_Initialize returned ${initRv}. The module loaded and would not initialise, which is ` +
        "usually module CONFIGURATION rather than hardware. For the YubiHSM module: point " +
        "YUBIHSM_PKCS11_CONF at a file containing `connector = http://127.0.0.1:12345`, with " +
        "yubihsm-connector running.",
    );
  }

  let tokenIdentity: string | undefined;
  try {
    let attached: readonly Pkcs11AttachedToken[];
    try {
      attached = enumeratePkcs11Tokens(lib);
    } catch (err) {
      return nope("slot-enumeration-failed", messageOf(err));
    }
    if (attached.length === 0) {
      return nope("no-token-attached", "C_GetSlotList reported no token-present slots");
    }
    // `?? undefined` collapses "the token declined to identify itself" (null) into the same
    // absent value the renderer prints as "(not resolved)". Deliberate: an unidentifiable
    // token is not a READINESS state — refusing on identity is frost-token-roster.ts's job,
    // and it still does it. This module must not quietly grow a second identity policy.
    tokenIdentity = attached.find((t) => t.slotId === slotId)?.tokenIdentity ?? undefined;

    const mechanism = checkMechanism(lib, slotId);
    const verdict = mechanismSatisfiesAdapter(mechanism);
    // `not-checked` is NOT a failure — a caller driving a reduced surface still gets a
    // useful readiness answer. It IS a failure when the module answered and answered wrong.
    if (mechanism.checked && !verdict.ok) {
      return nope("mechanism-unsupported", verdict.why, tokenIdentity);
    }

    const phSession = new BigUint64Array(1);
    // SCANNER NOTE: flagged as an implicit undefined→number conversion (PR #15564). False
    // positive, same shape as the one on mechanismSatisfiesAdapter — `CKF_SERIAL_SESSION`
    // and `CKF_RW_SESSION` are both `bigint` literals, so `|` is a bigint OR and nothing is
    // converted. Adjudicated, not suppressed; `tsc --strict` is clean on this line.
    const orv = lib.C_OpenSession(BigInt(slotId), CKF_SERIAL_SESSION | CKF_RW_SESSION, 0n, 0n, phSession);
    if (!rvOk(orv)) {
      return nope("session-failed", `C_OpenSession on slot ${slotId} returned ${orv}`, tokenIdentity);
    }
    const hSession = phSession[0] ?? 0n;
    let loggedIn = false;
    try {
      // NO PIN ⇒ login-refused, NOT a cheerful search. Found 2026-08-26 by running the
      // shipped `status` against the live device with no credential: it printed
      // `reachable-unprovisioned` (rc 3) — the rung whose own docstring says it is
      // "reachable ONLY by getting all the way through login". It was not. The old
      // `if (opts.pin.length > 0)` skipped C_Login entirely, and an UNAUTHENTICATED
      // C_FindObjects on a YubiHSM sees no objects, so "no key with that label" and "no
      // session that may see any key" produced the identical answer. That is the exact
      // conflation this whole module exists to remove, one rung further down, and it is the
      // vacuity class in its purest form: a check that cannot fail wearing the result of one
      // that ran. It matters more now that the CLI refuses an absent credential up front —
      // an empty PIN can now only arrive from a caller that built one by hand.
      if (opts.pin.length === 0) {
        return nope(
          "login-refused",
          "no PKCS#11 PIN was supplied, so C_Login was never attempted. An unauthenticated " +
            "C_FindObjects returns nothing whether or not the key exists, so this is reported as a " +
            "login that did not happen rather than as a key that is not there.",
          tokenIdentity,
        );
      }
      {
        const pinBytes = new TextEncoder().encode(opts.pin);
        const lrv = lib.C_Login(hSession, CKU_USER, pinBytes, BigInt(pinBytes.length));
        if (!rvOk(lrv) && BigInt(lrv) !== CKR_USER_ALREADY_LOGGED_IN) {
          return nope(
            "login-refused",
            `C_Login returned ${lrv}. For a YubiHSM the PKCS#11 PIN is <4-hex-authkey-id><password>, ` +
              "e.g. authkey 1 with password `password` is `0001password`.",
            tokenIdentity,
          );
        }
        loggedIn = true;
      }
      const handle = findKeyByLabel(lib, hSession, label, fx.pointerOf);
      return handle === null
        ? { kind: "reachable-unprovisioned", tokenIdentity, label, mechanism }
        : { kind: "provisioned", tokenIdentity, label, mechanism };
    } finally {
      if (loggedIn) lib.C_Logout(hSession);
      lib.C_CloseSession(hSession);
    }
  } finally {
    lib.C_Finalize(0n);
  }
}

const RULE = "─".repeat(74);

/** The operator-facing readout. Says which rung, and what the next act is. */
export function renderReadiness(r: WrapKeyReadiness): string {
  const lines: string[] = [RULE, "  FROST wrap-key readiness (hardware-pkcs11 tier)", RULE];
  if (r.kind === "unreachable") {
    lines.push(
      `  STATE       unreachable — the device could not answer`,
      `  STAGE       ${r.stage}`,
      `  DETAIL      ${r.detail}`,
      `  TOKEN       ${r.tokenIdentity ?? "(not resolved)"}`,
      `  NEXT        This is a real failure, not a missing prerequisite. Fix the stage above.`,
    );
  } else {
    const m = mechanismSatisfiesAdapter(r.mechanism);
    lines.push(
      `  STATE       ${r.kind}`,
      `  TOKEN       ${r.tokenIdentity ?? "(not resolved)"}`,
      `  LABEL       ${r.label}`,
      `  MECHANISM   ${m.ok ? "ok" : "NOT VERIFIED"} — ${m.why}`,
    );
    lines.push(
      r.kind === "provisioned"
        ? `  NEXT        Nothing. The hardware lane can run.`
        : `  NEXT        EXPECTED for a factory device. One operator-approved command remains:\n` +
            `              bun tools/setup/persona-keys/frost-hsm-provision.ts apply --apply`,
    );
  }
  lines.push(RULE, "");
  return lines.join("\n");
}

// ============================================================================
// THE PLAN — the command, built and checked before anyone is asked to approve it
// ============================================================================

export interface WrapKeyProvisioningOptions {
  readonly connector?: string;
  readonly authKeyId?: number;
  readonly password: string;
  readonly objectId?: number;
  readonly label?: string;
  readonly domains?: string;
  readonly capabilities?: readonly string[];
  readonly algorithm?: string;
  readonly program?: string;
}

export interface WrapKeyProvisioningPlan {
  readonly program: string;
  /** What is actually executed. Contains the password — never print this. */
  readonly argv: readonly string[];
  /** What a human is shown. The password is replaced, not omitted, so the shape is legible. */
  readonly displayArgv: readonly string[];
  readonly label: string;
  readonly algorithm: string;
  readonly capabilities: readonly string[];
  readonly domains: string;
  readonly objectId: number;
  readonly connector: string;
  readonly authKeyId: number;
}

export class WrapKeyPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WrapKeyPlanError";
  }
}

const REDACTED = "<redacted>";
/** The two the adapter cannot work without. Measured names, from libyubihsm's own
 *  capability table (`strings /usr/local/lib/libyubihsm.dylib`), 2026-08-26. */
const REQUIRED_CAPABILITIES: readonly string[] = ["encrypt-cbc", "decrypt-cbc"];
/** Any of these turns a hardware-resident key into an exportable one. */
const FORBIDDEN_CAPABILITIES: readonly string[] = ["exportable-under-wrap"];

/**
 * Build the exact `yubihsm-shell` invocation, and REFUSE the ones that would provision
 * successfully and fail later.
 *
 * Flag spellings verified 2026-08-26 against `yubihsm-shell --help` (3.0.7) on the host
 * holding the device: `-C/--connector`, `--authkey`, `-p`, `-a generate-symmetric-key`,
 * `-i`, `-l`, `-d`, `-c`, `-A`. Capability tokens and the `aes256` algorithm name verified
 * against `libyubihsm.dylib`'s own tables and the device's `get-device-info` algorithm
 * list. The command itself has NOT been executed — that is the operator's act.
 */
export function planWrapKeyProvisioning(opts: WrapKeyProvisioningOptions): WrapKeyProvisioningPlan {
  const label = opts.label ?? FROST_WRAP_KEY_LABEL;
  const algorithm = opts.algorithm ?? "aes256";
  const capabilities = opts.capabilities ?? REQUIRED_CAPABILITIES;
  const domains = opts.domains ?? "1";
  const objectId = opts.objectId ?? 0;
  const connector = opts.connector ?? "http://127.0.0.1:12345";
  const authKeyId = opts.authKeyId ?? 1;
  const program = opts.program ?? "yubihsm-shell";

  if (opts.password === "") {
    throw new WrapKeyPlanError(
      "frost-hsm-provision: no device password was supplied. Refusing to build a command that " +
        "would prompt interactively behind a biometric gate — the operator would be approving " +
        "an act whose authentication had not happened yet.",
    );
  }
  if (label.trim() === "") {
    throw new WrapKeyPlanError("frost-hsm-provision: the wrap-key label is empty; the adapter searches by label");
  }
  if (algorithm !== "aes256") {
    throw new WrapKeyPlanError(
      `frost-hsm-provision: algorithm '${algorithm}' refused. The seal path is AES-256; a shorter ` +
        "key provisions without error and silently lowers the tier's strength below what its name claims.",
    );
  }
  for (const need of REQUIRED_CAPABILITIES) {
    if (!capabilities.includes(need)) {
      throw new WrapKeyPlanError(
        `frost-hsm-provision: capability '${need}' is missing. A key without it is created ` +
          "successfully and then cannot " +
          (need === "encrypt-cbc" ? "SEAL" : "UNSEAL") +
          " a share — a failure that surfaces after the ceremony, on a device an operator already approved.",
      );
    }
  }
  for (const banned of FORBIDDEN_CAPABILITIES) {
    if (capabilities.includes(banned)) {
      throw new WrapKeyPlanError(
        `frost-hsm-provision: capability '${banned}' refused. It permits the wrapping key to LEAVE ` +
          "the device, which voids `keyResidency: hardware-resident` — the single property that " +
          "distinguishes this tier from a software one.",
      );
    }
  }

  const shared: readonly string[] = [
    "--connector",
    connector,
    "--authkey",
    String(authKeyId),
    "-a",
    "generate-symmetric-key",
    "-i",
    String(objectId),
    "-l",
    label,
    "-d",
    domains,
    "-c",
    capabilities.join(","),
    "-A",
    algorithm,
  ];
  return {
    program,
    argv: ["-p", opts.password, ...shared],
    displayArgv: ["-p", REDACTED, ...shared],
    label,
    algorithm,
    capabilities,
    domains,
    objectId,
    connector,
    authKeyId,
  };
}

/** Build the brief from the PLAN, never beside it — same one-object discipline as ca.ts. */
export function provisioningBrief(plan: WrapKeyProvisioningPlan, fx: CeremonyBriefEffects = {}): CeremonyBrief {
  return {
    operation: "provision-or-reconfigure-hardware-token",
    summary: "Generate a NEW AES-256 wrapping key ON the hardware security module",
    subjects: [
      { label: "connector", value: plan.connector },
      { label: "auth key", value: String(plan.authKeyId) },
      { label: "key label", value: plan.label },
      { label: "algorithm", value: plan.algorithm },
      { label: "capabilities", value: plan.capabilities.join(",") },
      { label: "domains", value: plan.domains },
      { label: "command", value: `${plan.program} ${plan.displayArgv.join(" ")}` },
    ],
    ifDeclined:
      "no key is generated and the device is byte-for-byte as it was. The hardware lane keeps " +
      "reporting 'reachable-unprovisioned' (exit 3) and every software tier is unaffected. " +
      "Nothing is half-done: this is a single device operation, not a sequence.",
    ...requestedBy(fx.requester),
  };
}

export type ProvisionAction =
  | "already-provisioned"
  | "refused-device-unreachable"
  | "aborted-biometric"
  | "dry-run"
  | "provisioned";

export interface ProvisionOutcome {
  readonly action: ProvisionAction;
  readonly readiness: WrapKeyReadiness;
  readonly plan: WrapKeyProvisioningPlan;
  readonly detail?: string;
}

export interface ProvisionExecEffects {
  /** argv form, never a shell string. Returns rc + merged output. */
  readonly run: (program: string, argv: readonly string[]) => { readonly status: number; readonly output: string };
}

export function realProvisionExecEffects(): ProvisionExecEffects {
  return {
    run: (program, argv) => {
      const r = spawnSync(program, [...argv], { encoding: "utf8", timeout: 30_000 });
      return { status: r.status ?? 1, output: `${r.stdout ?? ""}${r.stderr ?? ""}` };
    },
  };
}

/**
 * The one act. Fail-closed at four separate points, in this order:
 *
 *   1. already provisioned  -> no-op, and NO PROMPT. Idempotency (§12): re-running must
 *      not raise a ceremony, or the operator is trained to approve a key they already
 *      have. Generating a SECOND key with the same label is also how a token quietly
 *      acquires two candidates for one search.
 *   2. device unreachable   -> refuse WITHOUT prompting. Asking a human to approve an act
 *      against a device that cannot answer is the unevaluable prompt.
 *   3. dry run              -> return the plan, never touch the biometric door.
 *   4. biometric declined   -> abort. `requireBiometric` is fail-closed on an absent door.
 */
export async function applyWrapKeyProvisioning(args: {
  readonly probe: WrapKeyProbeOptions;
  readonly plan: WrapKeyProvisioningPlan;
  readonly dryRun: boolean;
  readonly biometricAuth?: BiometricAuth;
  readonly probeFx?: WrapKeyProbeEffects;
  readonly execFx?: ProvisionExecEffects;
  readonly briefFx?: CeremonyBriefEffects;
}): Promise<ProvisionOutcome> {
  const briefFx = args.briefFx ?? {};
  const readiness = classifyWrapKeyReadiness(args.probe, args.probeFx ?? realWrapKeyProbeEffects());

  if (readiness.kind === "provisioned") {
    return {
      action: "already-provisioned",
      readiness,
      plan: args.plan,
      detail: `a key labelled ${readiness.label} is already on the token; nothing to do`,
    };
  }
  if (readiness.kind === "unreachable") {
    return {
      action: "refused-device-unreachable",
      readiness,
      plan: args.plan,
      detail: `refusing to raise a ceremony against an unreachable device (${readiness.stage}: ${readiness.detail})`,
    };
  }
  if (args.dryRun) {
    return { action: "dry-run", readiness, plan: args.plan, detail: "no biometric door was opened" };
  }

  assertGatedCeremony("provision-or-reconfigure-hardware-token");
  const brief = provisioningBrief(args.plan, briefFx);
  briefFx.notify?.(renderCeremonyBrief(brief));
  const approval = await requireBiometric(args.biometricAuth, ceremonyPromptLine(brief));
  if (!approval.ok) {
    return {
      action: "aborted-biometric",
      readiness,
      plan: args.plan,
      detail: approval.reason ?? "the operator declined",
    };
  }

  const exec = args.execFx ?? realProvisionExecEffects();
  const r = exec.run(args.plan.program, args.plan.argv);
  if (r.status !== 0) {
    return {
      action: "refused-device-unreachable",
      readiness,
      plan: args.plan,
      detail: `${args.plan.program} exited ${r.status}: ${r.output.trim()}`,
    };
  }
  return { action: "provisioned", readiness, plan: args.plan, detail: r.output.trim() };
}

// ============================================================================
// DISCOVERY — an input the tool can find is an input the operator cannot get wrong
// ============================================================================
//
// This is the half of zflash's shape that transfers directly (see `frost-hsm-secrets.ts` for
// the full comparison). `zeta flash usb` takes no arguments because it finds the newest ISO
// and the newest removable device and SHOWS them. Neither of the two values below is a
// secret; both were previously required exports, and every required export is a line an
// operator has to get right in a terminal.

/** Where a YubiHSM PKCS#11 module lands, in the order the search tries them. Homebrew's
 *  arm64 prefix first because that is the modern Mac, then the Intel/pkg prefix this fleet's
 *  device actually uses, then the Linux paths for the lane that is not macOS-only. */
export const PKCS11_MODULE_CANDIDATES: readonly string[] = [
  "/opt/homebrew/lib/pkcs11/yubihsm_pkcs11.dylib",
  "/usr/local/lib/pkcs11/yubihsm_pkcs11.dylib",
  "/usr/local/lib/pkcs11/yubihsm_pkcs11.so",
  "/usr/lib/x86_64-linux-gnu/pkcs11/yubihsm_pkcs11.so",
];

/** Discovery result. `searched` travels with the miss so the refusal can list what was
 *  looked at — "not found" without "where I looked" is a dead end wearing a diagnosis. */
export type ModuleDiscovery =
  | { readonly found: true; readonly path: string; readonly via: "override" | "discovered" }
  | { readonly found: false; readonly searched: readonly string[] };

/** Resolve the PKCS#11 module path. An explicit override wins and is NOT existence-checked
 *  here — `classifyWrapKeyReadiness` already reports `module-absent` for a path that is not
 *  there, and checking twice would make the two disagree about which message the reader
 *  sees. Discovery, by contrast, must check: picking a candidate that is not present would
 *  turn a "none installed" into a misleading "the first one is broken". */
export function discoverPkcs11Module(exists: (p: string) => boolean, override?: string): ModuleDiscovery {
  if (override !== undefined && override.trim() !== "") {
    return { found: true, path: override, via: "override" };
  }
  for (const candidate of PKCS11_MODULE_CANDIDATES) {
    if (exists(candidate)) return { found: true, path: candidate, via: "discovered" };
  }
  return { found: false, searched: PKCS11_MODULE_CANDIDATES };
}

/** Where the YubiHSM PKCS#11 module looks for its own config, in `yubihsm-pkcs11`'s
 *  documented order. Home first: a per-user file is the one an operator can write without
 *  root, which is the one they will actually have. */
export function connectorConfigCandidates(home: string): readonly string[] {
  return [`${home}/.yubihsm_pkcs11.conf`, "/etc/yubihsm_pkcs11.conf", "/usr/local/etc/yubihsm_pkcs11.conf"];
}

/** What the config step did, for the readout. `written` is reported rather than silent
 *  because writing a file on someone's machine is not a thing to do quietly, even when the
 *  file holds no secret. */
export interface WrittenConnectorConfig {
  readonly kind: "written";
  readonly path: string;
  /** The URL the written file names. Config, never a credential. */
  readonly connector: string;
}

export type ConnectorConfig =
  | { readonly kind: "from-env"; readonly path: string }
  | { readonly kind: "found"; readonly path: string }
  | WrittenConnectorConfig;

/**
 * Whether a freshly-written config has to be handed to a NEW PROCESS to be seen.
 *
 * ── MEASURED, NOT ASSUMED (2026-08-26, this host) ────────────────────────────────────
 *
 * The vendor's PKCS#11 module is `dlopen`ed and reads `YUBIHSM_PKCS11_CONF` with `getenv(3)`
 * inside `C_Initialize`. Assigning `process.env["YUBIHSM_PKCS11_CONF"]` in the running
 * process does NOT reach it. The A/B, same file, same bytes, same device:
 *
 *   set in the parent environment    -> reachable-unprovisioned, token YubiHSM#39160506
 *   assigned in-process before load  -> C_Initialize returned 7 (CKR_ARGUMENTS_BAD)
 *
 * So the config crosses on the one channel a `dlopen`ed library certainly reads: a fresh
 * process's environment. This predicate is the decision, kept out of the process wiring so
 * it is testable — and note it is FALSE for every branch except `written`, which is what
 * bounds the handoff to exactly one level: the child sees the variable set, takes the
 * `from-env` branch, writes nothing and hands off to nobody.
 */
export function needsConfigHandoff(conf: ConnectorConfig): conf is WrittenConnectorConfig {
  return conf.kind === "written";
}

/** The doors the config step touches. Injected (§13 noninterference) so a test can describe
 *  any host — one with the env set, one with a file, one with neither — without a filesystem. */
export interface ConnectorConfigEffects {
  readonly exists: (path: string) => boolean;
  readonly write: (path: string, contents: string) => void;
  readonly home: string;
  readonly tmpDir: string;
}

/**
 * Make sure the module can find its connector, and SAY which way it got there.
 *
 * The YubiHSM PKCS#11 module reads a config file to learn the connector URL, and with no
 * config it fails at `C_Initialize` — the `module-init-failed` rung, whose remedy told the
 * operator to go and export `YUBIHSM_PKCS11_CONF`. That remedy is correct and it is another
 * export, so this writes the two-line config itself when there is none.
 *
 * WHAT IS AND IS NOT WRITTEN, because writing anything at all deserves a plain statement:
 * the file contains `connector = <url>` and nothing else. It holds no credential, it is
 * written under the process temp directory rather than into the operator's home or /etc, and
 * it is never written when the env var is set or when a real config already exists — a host
 * that has been configured is never second-guessed.
 */
export function ensureConnectorConfig(
  fx: ConnectorConfigEffects,
  connector: string,
  envValue: string | undefined,
): ConnectorConfig {
  if (envValue !== undefined && envValue.trim() !== "") return { kind: "from-env", path: envValue };
  for (const candidate of connectorConfigCandidates(fx.home)) {
    if (fx.exists(candidate)) return { kind: "found", path: candidate };
  }
  const path = `${fx.tmpDir}/zeta-yubihsm-pkcs11.conf`;
  fx.write(path, `connector = ${connector}\n`);
  return { kind: "written", path, connector };
}

// ============================================================================
// CREDENTIAL RESOLUTION — the store is the ONLY source, and that is structural
// ============================================================================

/**
 * Resolve the one credential this ceremony needs, and derive the PIN from it.
 *
 * ── WHY THIS TAKES A `SecretSource` AND READS NO ENVIRONMENT ─────────────────────────
 *
 * The defect being removed was an operator typing `export ZETA_YUBIHSM_PASSWORD=…`. A fix
 * that merely stopped DOCUMENTING that variable would leave the read in place, and the next
 * person to hit a refusal would find the export still works and use it. So the environment
 * is not consulted here at all: the store arrives as a parameter, and a caller holding a
 * source that returns nothing gets a refusal no ambient value can satisfy.
 *
 * That is a property a test can falsify rather than a promise — see
 * `frost-hsm-provision.test.ts` §"the store is the only source", which sets both retired
 * variables in `process.env` and asserts the refusal still fires.
 */
export type CredentialResolution =
  | { readonly ok: true; readonly password: Secret; readonly pin: Secret }
  | { readonly ok: false; readonly code: string; readonly rendered: string };

export function resolveDeviceCredential(source: SecretSource, authKeyId: number): CredentialResolution {
  const r = resolveSecret(FROST_HSM_PASSWORD_REQUIREMENT, source);
  if (!r.ok) return { ok: false, code: r.refusal.code, rendered: renderRefusal(r.refusal) };
  try {
    return { ok: true, password: r.secret, pin: pkcs11PinFor(r.secret, authKeyId) };
  } catch (err) {
    const ref = refusal({
      code: HANDOFF_REFUSAL_CODES.underspecified,
      what: "refusing to build a PKCS#11 PIN from the stored credential",
      why: messageOf(err),
      remedy: [
        {
          why: "set the auth key id to a real YubiHSM object id (the factory key is 1)",
          command: "ZETA_YUBIHSM_AUTHKEY=1 bun tools/setup/persona-keys/frost-hsm-provision.ts status",
        },
        {
          why: "or re-store the device password if what came back from the keystore was blank",
          command: `tools/setup/secret-clip.sh set ${FROST_HSM_PASSWORD_REF} --clipboard --clear-clipboard`,
        },
      ],
    });
    return { ok: false, code: ref.code, rendered: renderRefusal(ref) };
  }
}

/** The refusal for "no PKCS#11 module anywhere". Built here rather than left to the
 *  `module-absent` rung because discovery knows WHERE IT LOOKED, and a not-found that cannot
 *  say what it searched is the dead end invariant 4 exists to abolish. */
export function moduleNotFoundRefusal(searched: readonly string[]): string {
  return renderRefusal(
    refusal({
      code: "pkcs11-module-absent",
      what: "refusing to run: no YubiHSM PKCS#11 module was found",
      why:
        "the ceremony talks to the device through the vendor's PKCS#11 module, and none of the paths " +
        `it knows about exists on this host: ${searched.join(", ")}.`,
      remedy: [
        {
          why: "install the YubiHSM SDK (it ships the module and yubihsm-shell together)",
          note: "macOS: the YubiHSM2 SDK package from Yubico, or `brew install yubihsm-shell`. Linux: the yubihsm2-sdk package.",
        },
        {
          why: "or point at an existing module directly",
          command:
            "ZETA_FROST_PKCS11_LIB=/path/to/yubihsm_pkcs11.dylib bun tools/setup/persona-keys/frost-hsm-provision.ts status",
        },
      ],
    }),
  );
}

// ============================================================================
// CLI
// ============================================================================

export function usage(): string {
  return [
    "usage:",
    "  bun tools/setup/persona-keys/frost-hsm-provision.ts status   # read-only ladder; rc 0/3/1",
    "  bun tools/setup/persona-keys/frost-hsm-provision.ts plan     # + the exact command, redacted",
    "  bun tools/setup/persona-keys/frost-hsm-provision.ts rehearse --apply  # the gate, no device write",
    "  bun tools/setup/persona-keys/frost-hsm-provision.ts apply --apply     # operator-approved",
    "",
    "  NO VERB TAKES A CREDENTIAL. The device password is read from the OS keystore item",
    `  '${FROST_HSM_PASSWORD_REF}'; the PKCS#11 PIN is derived from it. There is no`,
    "  environment variable for either, and neither is ever an argument.",
    "",
    "  rc 0 = provisioned   rc 3 = reachable but NOT provisioned (expected; one command away)",
    "  rc 1 = unreachable   rc 2 = usage, or a refusal (which names its remedy)",
    "",
  ].join("\n");
}

/* c8 ignore start -- process wiring; the logic above is what the tests drive */
if (import.meta.main) {
  const { writeFileSync } = await import("node:fs");
  const { homedir, tmpdir } = await import("node:os");

  const argv = process.argv.slice(2);
  const verb = argv[0] ?? "";
  if (verb !== "status" && verb !== "plan" && verb !== "apply" && verb !== "rehearse") {
    process.stderr.write(usage());
    process.exit(2);
  }

  const authKeyId = Number(process.env["ZETA_YUBIHSM_AUTHKEY"] ?? "1");
  const connector = process.env["ZETA_YUBIHSM_CONNECTOR"] ?? "http://127.0.0.1:12345";
  const label = process.env["ZETA_FROST_PKCS11_LABEL"] ?? FROST_WRAP_KEY_LABEL;
  const slotId = Number(process.env["ZETA_FROST_PKCS11_SLOT"] ?? "0");

  // ── DISCOVERY, then PROVENANCE. Every value the act depends on is shown with WHERE it
  //    came from, before anything is decided — the operator should never have to guess
  //    which module or which connector an approval covers.
  const discovery = discoverPkcs11Module(existsSync, process.env["ZETA_FROST_PKCS11_LIB"]);
  if (!discovery.found) {
    process.stderr.write(moduleNotFoundRefusal(discovery.searched));
    process.exit(2);
  }
  const conf = ensureConnectorConfig(
    {
      exists: existsSync,
      write: (p, c) => writeFileSync(p, c, { mode: 0o600 }),
      home: homedir(),
      tmpDir: tmpdir(),
    },
    connector,
    process.env["YUBIHSM_PKCS11_CONF"],
  );
  // Hand the freshly-written config over in a new process's environment — see
  // `needsConfigHandoff` for the measurement that makes this necessary rather than tidy.
  // Bounded to one level by construction: the child takes the `from-env` branch.
  if (needsConfigHandoff(conf)) {
    process.stderr.write(
      `  CONFIG      wrote ${conf.path} (connector = ${conf.connector}) and re-running so the\n` +
        "              PKCS#11 module can read it — a dlopen'd library sees getenv, not process.env.\n",
    );
    const handoff = spawnSync(process.execPath, [import.meta.path, ...argv], {
      env: { ...process.env, YUBIHSM_PKCS11_CONF: conf.path },
      stdio: "inherit",
    });
    process.exit(handoff.status ?? 1);
  }

  process.stdout.write(
    [
      `  MODULE      ${discovery.path} (${discovery.via})`,
      // `written` cannot reach here: `needsConfigHandoff` above narrows it away by exiting.
      `  CONFIG      ${conf.path} (${conf.kind})`,
      `  CREDENTIAL  OS keystore item '${FROST_HSM_PASSWORD_REF}' — never an argument, never an export`,
      `  PIN         derived from that item + auth key ${String(authKeyId)}`,
      ...(pinHexCaseIsObservable(authKeyId)
        ? [
            `  NOTE        auth key ${String(authKeyId)} puts a letter in the PIN's hex prefix; this emits it`,
            "              LOWERCASE, which is documented-but-unmeasured on this module (frost-hsm-secrets.ts).",
          ]
        : []),
      "",
    ].join("\n"),
  );

  const source = frostHsmSecretSource(realKeystoreRead());
  const withoutCredential = argv.includes("--without-credential");
  const cred = resolveDeviceCredential(source, authKeyId);

  // ── REHEARSE: the whole chain, against an act that does nothing ──────────────────────
  //
  // This is the verb that makes the gate testable. It runs `runGatedCeremony` — the protocol
  // entry point whose BODY is the ordering, so approval cannot precede authentication — with
  // an `act` that touches no device and no file. Two things get exercised that nothing else
  // exercises until the real ceremony: the credential's path out of the keystore, and the
  // Touch ID door itself. An untested gate is a check nobody has watched fail.
  //
  // The keystore is read TWICE on this path, deliberately: once here so the probe has a
  // session to read the device with, and once inside `runGatedCeremony`, whose resolution
  // step is part of what is under rehearsal. Reading it once and handing the value in would
  // rehearse a different sequence than `apply` performs.
  if (verb === "rehearse") {
    if (!cred.ok && !withoutCredential) {
      process.stderr.write(cred.rendered);
      process.stderr.write(
        "  The biometric door was NOT opened: the rehearsal stopped before it, which is the\n" +
          "  ordering it exists to demonstrate. Store the credential and run this again — or add\n" +
          "  --without-credential to rehearse the gate alone (it lifts exactly the secret-absent\n" +
          "  refusal, and only because a rehearsal's act writes nothing).\n\n",
      );
      process.exit(2);
    }
    const probeOpts: WrapKeyProbeOptions = {
      libraryPath: discovery.path,
      pin: cred.ok ? cred.pin.reveal() : "",
      slotId,
      label,
    };
    const { realBriefEffects } = await import("./ceremony-brief.ts");
    const { realBiometric } = await import("./biometric.ts");
    const outcome = await runGatedCeremony<string, string>({
      operation: "provision-or-reconfigure-hardware-token",
      summary: "REHEARSAL — exercise the approval gate end to end against an act that does NOTHING",
      subjects: [
        { label: "what will run", value: "nothing. This act writes no object and no file." },
        { label: "device readout", value: "taken before and after, and compared" },
        { label: "connector", value: connector },
        { label: "module", value: discovery.path },
        {
          label: "credential",
          value: `OS keystore '${FROST_HSM_PASSWORD_REF}'${cred.ok ? "" : " (ESCAPED — absent)"}`,
        },
        { label: "real ceremony", value: "bun tools/setup/persona-keys/frost-hsm-provision.ts apply --apply" },
      ],
      ifDeclined:
        "nothing at all happens, which is also what happens if you approve — a rehearsal's act is a " +
        "no-op either way. Declining here is the safe way to check that declining works.",
      requires: [FROST_HSM_PASSWORD_REQUIREMENT],
      source,
      escapes: withoutCredential
        ? [
            namedEscape({
              liftsCode: HANDOFF_REFUSAL_CODES.secretAbsent,
              reason:
                "a rehearsal's act performs no device command, so it needs no device credential. This " +
                "lifts ONLY secret-absent and only on this verb; `apply` has no such escape and cannot " +
                "acquire one without a code change that shows in a diff.",
              authorizedBy: "the operator, by typing --without-credential on this rehearsal",
            }),
          ]
        : [],
      probe: () => classifyWrapKeyReadiness(probeOpts).kind,
      act: () => "no-op: the rehearsal act deliberately does nothing",
      dryRun: !argv.includes("--apply"),
      biometricAuth: realBiometric(),
      briefFx: realBriefEffects(),
    });

    switch (outcome.kind) {
      case "refused":
        process.stderr.write(renderRefusal(outcome.refusal));
        process.exit(2);
        break;
      case "dry-run":
        process.stdout.write(
          `  DEVICE      ${outcome.before}\n` +
            `  WOULD ASK   ${outcome.promptLine}\n` +
            "  (dry run — the biometric door was NOT opened. Add --apply to rehearse the touch.)\n\n",
        );
        process.exit(0);
        break;
      case "declined":
        process.stdout.write(
          `  DEVICE      ${outcome.before}\n  DECLINED    ${outcome.reason}\n` +
            "  The gate refused, which is the outcome it must be able to produce. Nothing ran.\n\n",
        );
        process.exit(1);
        break;
      case "performed":
        process.stdout.write(
          `  APPROVED    the gate opened and the no-op act ran\n` +
            `  DEVICE      ${outcome.measured.before} -> ${outcome.measured.after}` +
            ` (${outcome.measured.changed ? "CHANGED — investigate, a rehearsal must not" : "unchanged, as read"})\n` +
            "  The whole chain is exercised. `apply --apply` performs the same sequence with a real act.\n\n",
        );
        process.exit(outcome.measured.changed ? 1 : 0);
        break;
    }
  }

  if (!cred.ok) {
    process.stderr.write(cred.rendered);
    process.exit(2);
  }

  const probe: WrapKeyProbeOptions = { libraryPath: discovery.path, pin: cred.pin.reveal(), slotId, label };

  if (verb === "status") {
    const r = classifyWrapKeyReadiness(probe);
    process.stdout.write(renderReadiness(r));
    process.exit(readinessExitCode(r));
  }

  let plan: WrapKeyProvisioningPlan;
  try {
    plan = planWrapKeyProvisioning({
      connector,
      authKeyId,
      password: cred.password.reveal(),
      label: probe.label ?? FROST_WRAP_KEY_LABEL,
    });
  } catch (err) {
    process.stderr.write(`${messageOf(err)}\n`);
    process.exit(2);
  }
  const dryRun = verb === "plan" || !argv.includes("--apply");
  const { realBriefEffects } = await import("./ceremony-brief.ts");
  const { realBiometric } = await import("./biometric.ts");
  const outcome = await applyWrapKeyProvisioning({
    probe,
    plan,
    dryRun,
    ...(dryRun ? {} : { biometricAuth: realBiometric() }),
    briefFx: realBriefEffects(),
  });
  process.stdout.write(renderReadiness(outcome.readiness));
  process.stdout.write(`  ACTION      ${outcome.action}\n`);
  if (outcome.detail !== undefined) process.stdout.write(`  DETAIL      ${outcome.detail}\n`);
  if (dryRun) {
    process.stdout.write(`  WOULD RUN   ${plan.program} ${plan.displayArgv.join(" ")}\n`);
    process.stdout.write("  (dry run — the biometric door was never opened and the device is untouched)\n");
  }
  process.exit(outcome.action === "provisioned" ? 0 : readinessExitCode(outcome.readiness));
}
/* c8 ignore stop */
