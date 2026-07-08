/**
 * qemu-first-session-phase3.ts — 081KSNY2Z0008QG0R0008PN7RQ S4 society-cadence helpers.
 *
 * Opt-in via QEMU_FIRST_SESSION_PHASE3=1 on qemu-full-install-test phase 2.
 * Installed nodes with /etc/zeta/qemu-first-session-ci run the boot demo
 * service and tee markers to ttyS0.
 */

import {
  assertHappyPathFirstSessionSerial,
  assertMockIdentityAuthFirstSessionSerial,
  assertSkipGhFirstSessionSerial,
} from "../zflash/test-harness/serial-markers";

export {
  assertHappyPathFirstSessionSerial,
  assertMockIdentityAuthFirstSessionSerial,
  assertSkipGhFirstSessionSerial,
} from "../zflash/test-harness/serial-markers";

export function firstSessionPhase3Enabled(): boolean {
  return process.env.QEMU_FIRST_SESSION_PHASE3 === "1";
}

export function firstSessionMarkersSatisfied(serialOutput: string): boolean {
  return (
    "ok" in assertMockIdentityAuthFirstSessionSerial(serialOutput) ||
    "ok" in assertHappyPathFirstSessionSerial(serialOutput) ||
    "ok" in assertSkipGhFirstSessionSerial(serialOutput)
  );
}
