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
 * USAGE
 *
 *   bun tools/setup/persona-keys/frost-hsm-provision.ts status
 *   bun tools/setup/persona-keys/frost-hsm-provision.ts plan
 *   bun tools/setup/persona-keys/frost-hsm-provision.ts apply --apply
 *
 *   Environment (the same names the hardware lane already uses):
 *     ZETA_FROST_PKCS11_LIB    path to the PKCS#11 module (.dylib/.so)
 *     ZETA_FROST_PKCS11_PIN    PKCS#11 PIN. For a YubiHSM this is <4-hex-authkey><password>
 *     ZETA_FROST_PKCS11_SLOT   slot index (default 0)
 *     ZETA_FROST_PKCS11_LABEL  wrap-key label (default zeta-frost-wrap)
 *     ZETA_YUBIHSM_CONNECTOR   connector URL for `apply` (default http://127.0.0.1:12345)
 *     ZETA_YUBIHSM_AUTHKEY     auth key id for `apply` (default 1)
 *     ZETA_YUBIHSM_PASSWORD    the yubihsm-shell password for `apply`. NOT the PKCS#11
 *                              PIN: `yubihsm-shell` takes `--authkey 1 -p <password>`
 *                              where PKCS#11 takes the two concatenated. Measured
 *                              2026-08-26: `-p 0001password` and `--authkey 1 -p password`
 *                              are not interchangeable spellings of one thing.
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
      if (opts.pin.length > 0) {
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
// CLI
// ============================================================================

export function usage(): string {
  return [
    "usage:",
    "  bun tools/setup/persona-keys/frost-hsm-provision.ts status   # read-only ladder; rc 0/3/1",
    "  bun tools/setup/persona-keys/frost-hsm-provision.ts plan     # + the exact command, redacted",
    "  bun tools/setup/persona-keys/frost-hsm-provision.ts apply --apply   # operator-approved",
    "",
    "  rc 0 = provisioned   rc 3 = reachable but NOT provisioned (expected; one command away)",
    "  rc 1 = unreachable   rc 2 = usage",
    "",
  ].join("\n");
}

/* c8 ignore start -- process wiring; the logic above is what the tests drive */
if (import.meta.main) {
  const argv = process.argv.slice(2);
  const verb = argv[0] ?? "";
  const probe: WrapKeyProbeOptions = {
    libraryPath: process.env["ZETA_FROST_PKCS11_LIB"] ?? "",
    pin: process.env["ZETA_FROST_PKCS11_PIN"] ?? "",
    slotId: Number(process.env["ZETA_FROST_PKCS11_SLOT"] ?? "0"),
    label: process.env["ZETA_FROST_PKCS11_LABEL"] ?? FROST_WRAP_KEY_LABEL,
  };

  if (verb === "status") {
    const r = classifyWrapKeyReadiness(probe);
    process.stdout.write(renderReadiness(r));
    process.exit(readinessExitCode(r));
  }

  if (verb === "plan" || verb === "apply") {
    let plan: WrapKeyProvisioningPlan;
    try {
      plan = planWrapKeyProvisioning({
        connector: process.env["ZETA_YUBIHSM_CONNECTOR"] ?? "http://127.0.0.1:12345",
        authKeyId: Number(process.env["ZETA_YUBIHSM_AUTHKEY"] ?? "1"),
        password: process.env["ZETA_YUBIHSM_PASSWORD"] ?? "",
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

  process.stderr.write(usage());
  process.exit(2);
}
/* c8 ignore stop */
