/**
 * qemu-first-session-phase3.ts — B-0891 S4 society-cadence helpers.
 *
 * Opt-in via QEMU_FIRST_SESSION_PHASE3=1 on qemu-full-install-test phase 2.
 * Installed nodes with /etc/zeta/qemu-first-session-ci run the boot demo
 * service and tee markers to ttyS0.
 */

import { assertFirstSessionSerialMarkers } from "../zflash/test-harness/qemu-state";

export function firstSessionPhase3Enabled(): boolean {
  return process.env.QEMU_FIRST_SESSION_PHASE3 === "1";
}

export function firstSessionMarkersSatisfied(serialOutput: string): boolean {
  return "ok" in assertFirstSessionSerialMarkers(serialOutput);
}
