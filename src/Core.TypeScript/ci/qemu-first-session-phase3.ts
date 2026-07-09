/**
 * qemu-first-session-phase3.ts — 081KSNY2Z0008QG0R0008PN7RQ S4 society-cadence helpers.
 *
 * Opt-in via QEMU_FIRST_SESSION_PHASE3=1 on qemu-full-install-test phase 2.
 * Installed nodes with /etc/zeta/qemu-first-session-ci run the boot demo
 * service and tee markers to ttyS0.
 *
 * Cascade #6 (2026-07-08): phase-3 requires mock identity-auth (or explicit
 * skip markers) AND post-boot zeta-self-register CI dry-run markers.
 * No legacy-ISO escape hatches — rebuild the ISO.
 */

import {
  assertMockIdentityAuthFirstSessionSerial,
  assertSkipGhFirstSessionSerial,
  FIRST_SESSION_SKIP_IDENTITY_AUTH_MARKERS,
} from "../zflash/test-harness/serial-markers";
import { postBootSelfRegMarkersSatisfied } from "./self-reg-serial.ts";

export {
  assertHappyPathFirstSessionSerial,
  assertMockIdentityAuthFirstSessionSerial,
  assertSkipGhFirstSessionSerial,
} from "../zflash/test-harness/serial-markers";

export function firstSessionPhase3Enabled(): boolean {
  return process.env.QEMU_FIRST_SESSION_PHASE3 === "1";
}

/** Phase-3 always requires post-boot self-register CI dry-run markers. */
export function postBootSelfRegPhase3Required(): boolean {
  return firstSessionPhase3Enabled();
}

/** True when serial shows explicit CI skip of live identity auth. */
export function firstSessionIdentityAuthSkipSatisfied(serialOutput: string): boolean {
  const skipGh = assertSkipGhFirstSessionSerial(serialOutput);
  if ("ok" in skipGh) return true;
  return FIRST_SESSION_SKIP_IDENTITY_AUTH_MARKERS.every((m) => serialOutput.includes(m));
}

/**
 * Phase-3 first-session gate for cascade #6:
 * - mock identity-auth path (preferred — proves device-code UX without secrets), or
 * - explicit skip-gh / identity-auth-skip (visible non-coverage).
 *
 * Dry-run-only happy path without mock/skip markers does NOT satisfy.
 */
export function firstSessionMarkersSatisfied(serialOutput: string): boolean {
  if ("ok" in assertMockIdentityAuthFirstSessionSerial(serialOutput)) {
    return true;
  }
  return firstSessionIdentityAuthSkipSatisfied(serialOutput);
}

/**
 * Full phase-3 success: first-session auth markers AND post-boot
 * self-register CI dry-run markers.
 */
export function phase3BootMarkersSatisfied(serialOutput: string): boolean {
  if (!firstSessionMarkersSatisfied(serialOutput)) return false;
  if (!postBootSelfRegPhase3Required()) return true;
  return postBootSelfRegMarkersSatisfied(serialOutput);
}
