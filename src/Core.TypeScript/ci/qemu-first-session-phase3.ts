/**
 * qemu-first-session-phase3.ts — 081KSNY2Z0008QG0R0008PN7RQ S4 society-cadence helpers.
 *
 * Opt-in via QEMU_FIRST_SESSION_PHASE3=1 on qemu-full-install-test phase 2.
 * Installed nodes with /etc/zeta/qemu-first-session-ci run the boot demo
 * service and tee markers to ttyS0.
 *
 * Cascade #6 deepen (2026-07-08): when phase-3 is on, prefer mock identity-auth
 * coverage (or explicit skip markers). Bare dry-run happy-path without
 * identity-auth-mock-* / identity-auth-skip no longer counts as auth coverage.
 */

import {
  assertHappyPathFirstSessionSerial,
  assertMockIdentityAuthFirstSessionSerial,
  assertSkipGhFirstSessionSerial,
  FIRST_SESSION_SKIP_IDENTITY_AUTH_MARKERS,
} from "../zflash/test-harness/serial-markers";

export {
  assertHappyPathFirstSessionSerial,
  assertMockIdentityAuthFirstSessionSerial,
  assertSkipGhFirstSessionSerial,
} from "../zflash/test-harness/serial-markers";

export function firstSessionPhase3Enabled(): boolean {
  return process.env.QEMU_FIRST_SESSION_PHASE3 === "1";
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
 * - explicit skip-gh / identity-auth-skip (visible non-coverage), or
 * - legacy happy-path only when ZETA_FIRST_SESSION_ALLOW_DRY_RUN_AUTH=1
 *   (escape hatch for older ISOs without mock wiring).
 */
export function firstSessionMarkersSatisfied(serialOutput: string): boolean {
  if ("ok" in assertMockIdentityAuthFirstSessionSerial(serialOutput)) {
    return true;
  }
  if (firstSessionIdentityAuthSkipSatisfied(serialOutput)) {
    return true;
  }
  if (process.env.ZETA_FIRST_SESSION_ALLOW_DRY_RUN_AUTH === "1") {
    return "ok" in assertHappyPathFirstSessionSerial(serialOutput);
  }
  return false;
}
