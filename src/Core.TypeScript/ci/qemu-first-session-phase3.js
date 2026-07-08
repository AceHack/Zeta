import {
  assertHappyPathFirstSessionSerial,
  assertSkipGhFirstSessionSerial
} from "../zflash/test-harness/serial-markers";
export {
  assertHappyPathFirstSessionSerial,
  assertSkipGhFirstSessionSerial
} from "../zflash/test-harness/serial-markers";
export function firstSessionPhase3Enabled() {
  return process.env.QEMU_FIRST_SESSION_PHASE3 === "1";
}
export function firstSessionMarkersSatisfied(serialOutput) {
  return "ok" in assertHappyPathFirstSessionSerial(serialOutput) || "ok" in assertSkipGhFirstSessionSerial(serialOutput);
}
