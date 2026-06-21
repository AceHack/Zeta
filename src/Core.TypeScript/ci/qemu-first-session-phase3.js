/**
 * qemu-first-session-phase3.ts — 081KSNY2Z0008QG0R0008PN7RQ S4 society-cadence helpers.
 *
 * Opt-in via QEMU_FIRST_SESSION_PHASE3=1 on qemu-full-install-test phase 2.
 * Installed nodes with /etc/zeta/qemu-first-session-ci run the boot demo
 * service and tee markers to ttyS0.
 */
import { assertFirstSessionSerialMarkers } from "../zflash/test-harness/qemu-state";
export function firstSessionPhase3Enabled() {
    return process.env.QEMU_FIRST_SESSION_PHASE3 === "1";
}
export function firstSessionMarkersSatisfied(serialOutput) {
    return "ok" in assertFirstSessionSerialMarkers(serialOutput);
}
