// Zeta SHARED biometric-approval gate — the ONE physical-presence approval primitive that
// every sensitive key-onboarding op runs through (workitem 081KVM1TK3Z08QG0R0002959G6
// §"agent-run, operator-approved"). Aaron (2026-06-21): *"nothing is operator run, only
// operator approved with hello/biometrics … i'll have you run what you need to for setup."*
//
// The AGENT executes every step (keygen / sign / publish); the HUMAN's Touch ID / Windows
// Hello is the AUTHORIZATION at each sensitive gate. This module is the lift-out of the
// biometric primitive that publish.ts (#8859) originally owned — extracted here so ca.ts,
// machine.ts, and publish.ts share ONE gate, not three copies of the Touch-ID logic.
//
// SECURITY INVARIANTS (security-class — honesty over green):
//  1. FAIL-CLOSED — the gate returns `ok:true` ONLY when the operator physically confirmed.
//     Absent biometric (no pam_tid / declined / unsupported platform / error) ⇒ `ok:false`.
//     A caller MUST abort its sensitive action on `ok:false`; this module never performs the
//     sensitive action itself — it only reports approval.
//  2. NEVER carries a secret — a `BiometricResult` has no key/seed bytes; it is approval-only.
//  3. NONINTERFERENCE (manifesto §13) — the biometric prompt enters a caller ONLY through an
//     injected `biometricAuth(prompt)` door. Tests inject a FAKE (no real prompt); the CLI
//     injects `realBiometric()`. `--dry-run` callers must not call the door at all.
//
// Anchors (Beacon): Touch ID PAM (`pam_tid.so`) biometric sudo — Apple PAM / the repo's
// biometric-sudo ADR (docs/DECISIONS/2026-05-29-biometric-sudo-elevation-via-touch-id-pam.md)
// + zflash's Touch-ID-gated dd. Windows Hello programmatic consent —
// `Windows.Security.Credentials.UI.UserConsentVerifier.RequestVerificationAsync` (Microsoft
// WinRT). Physical-presence consent as an action floor — FIDO/WebAuthn user-verification.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { platform as osPlatform } from "node:os";

/** The biometric platforms we know how to gate on. `unsupported` ⇒ fail-closed. */
export type BiometricPlatform = "macos-touchid" | "windows-hello" | "unsupported";

/** The outcome of a biometric confirmation attempt — never carries a secret. */
export interface BiometricResult {
  /** True ONLY if the operator physically confirmed (Touch ID / Windows Hello). */
  readonly ok: boolean;
  /** Which mechanism was attempted (for the readout + honest "unsupported" reporting). */
  readonly platform: BiometricPlatform;
  /** Present when ok === false — why (unsupported platform, declined, timeout, error). */
  readonly reason?: string;
}

/** The injectable biometric door — the ONLY channel for the physical-presence prompt
 *  (noninterference §13). A sensitive op takes this and MUST get `ok:true` before acting.
 *  Tests inject a fake; the CLI injects `realBiometric()`; `--dry-run` never calls it. */
export type BiometricAuth = (prompt: string) => Promise<BiometricResult>;

/**
 * Require an operator approval through the SHARED gate — the one helper every sensitive op
 * calls right before its real action. FAIL-CLOSED by construction: if NO door was injected
 * (`auth === undefined`), this returns `{ ok:false, platform:"unsupported" }` — so a caller
 * that forgot to wire the gate aborts rather than silently acting. Otherwise it delegates to
 * the injected door. NEVER carries a secret.
 */
export async function requireBiometric(
  auth: BiometricAuth | undefined,
  prompt: string,
): Promise<BiometricResult> {
  if (auth === undefined) {
    return {
      ok: false,
      platform: "unsupported",
      reason:
        "no biometric approval door was provided — fail-closed (the sensitive action is " +
        "agent-run but operator-APPROVED; wire the biometric gate before running it).",
    };
  }
  return auth(prompt);
}

/** Detect the biometric platform for the current host. macOS = Touch ID; Windows =
 *  Windows Hello (seam); everything else = unsupported (fail-closed). */
export function detectBiometricPlatform(plat: string = osPlatform()): BiometricPlatform {
  if (plat === "darwin") return "macos-touchid";
  if (plat === "win32") return "windows-hello";
  return "unsupported";
}

/** macOS Touch ID gate — reuse the zflash / biometric-sudo pattern: a no-op `sudo`
 *  command goes through PAM, and (when `pam_tid.so` is configured per the 2026-05-29
 *  ADR) prompts Touch ID. We `sudo -k` first to invalidate any cached timestamp so a
 *  FRESH biometric confirmation is required every time (no silent timestamp reuse), then
 *  run `sudo -p '' true`. Success ⇒ the operator physically confirmed.
 *
 *  Fail-closed: if `pam_tid.so` is NOT present in /etc/pam.d/sudo we DO NOT fall back to
 *  a password prompt (that would not be a biometric proof) — we report unsupported so the
 *  caller aborts. The operator enables Touch-ID-for-sudo per the ADR first. */
function macTouchIdAuth(prompt: string): BiometricResult {
  // Require pam_tid to be configured — otherwise `sudo` would gate on a password, which
  // is NOT the biometric proof this gate promises. Honest fail-closed.
  let pamHasTouchId = false;
  try {
    const pam = readFileSync("/etc/pam.d/sudo", "utf8");
    pamHasTouchId = /^\s*auth\s+sufficient\s+pam_tid\.so/m.test(pam);
  } catch {
    pamHasTouchId = false;
  }
  if (!pamHasTouchId) {
    return {
      ok: false,
      platform: "macos-touchid",
      reason:
        "Touch ID for sudo is not configured (pam_tid.so absent from /etc/pam.d/sudo). " +
        "Enable it per docs/DECISIONS/2026-05-29-biometric-sudo-elevation-via-touch-id-pam.md, then retry.",
    };
  }
  // Invalidate cached sudo timestamp so a fresh Touch ID press is required.
  spawnSync("sudo", ["-k"], { stdio: "ignore" });
  // `sudo -p ''` suppresses the password-prompt text; pam_tid pops the Touch ID dialog.
  // stdin is "ignore" so a non-biometric machine fails-closed (no password can be typed)
  // rather than hanging on a password prompt.
  process.stderr.write(`🔐 Touch ID: ${prompt}\n`);
  const r = spawnSync("sudo", ["-p", "", "true"], { stdio: ["ignore", "ignore", "inherit"] });
  if (r.status === 0) return { ok: true, platform: "macos-touchid" };
  return {
    ok: false,
    platform: "macos-touchid",
    reason: `Touch ID was declined or failed (sudo status ${r.status ?? "signal"})`,
  };
}

/** Windows Hello gate — SEAM (honest-stop, TODO). A clean programmatic Windows Hello
 *  consent is `Windows.Security.Credentials.UI.UserConsentVerifier.RequestVerificationAsync`,
 *  reachable from PowerShell via WinRT projection — but that bridge is NOT cleanly invokable
 *  from this TS CLI today (no WinRT binding shipped here). Rather than fake a biometric or
 *  weaken the fail-closed gate, this returns unsupported with the wiring point named. Wire
 *  `RequestVerificationAsync` (or the elevated-UAC/Hello path that flash-usb-windows.ts uses
 *  for admin elevation) here when the WinRT bridge lands. */
function windowsHelloAuth(_prompt: string): BiometricResult {
  return {
    ok: false,
    platform: "windows-hello",
    reason:
      "Windows Hello programmatic consent is not yet wired from this TS CLI " +
      "(seam: Windows.Security.Credentials.UI.UserConsentVerifier.RequestVerificationAsync via WinRT/PowerShell). " +
      "Wire it in biometric.ts windowsHelloAuth() before running on Windows — fail-closed until then.",
  };
}

/** The REAL biometric door (CLI-only): the per-platform physical-presence gate. macOS =
 *  Touch ID via pam_tid; Windows = Windows Hello (seam); everything else = unsupported
 *  (fail-closed). NEVER carries a secret — it returns approval only. */
export function realBiometric(): BiometricAuth {
  return async (prompt: string): Promise<BiometricResult> => {
    const plat = detectBiometricPlatform();
    if (plat === "macos-touchid") return macTouchIdAuth(prompt);
    if (plat === "windows-hello") return windowsHelloAuth(prompt);
    return {
      ok: false,
      platform: "unsupported",
      reason: `no biometric mechanism on platform '${osPlatform()}' — fail-closed (no approval)`,
    };
  };
}
