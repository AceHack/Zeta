import {
  assertHappyPathFirstSessionSerial,
  assertMockIdentityAuthFirstSessionSerial,
  assertSkipGhFirstSessionSerial
} from "../zflash/test-harness/serial-markers";
export {
  assertHappyPathFirstSessionSerial,
  assertMockIdentityAuthFirstSessionSerial,
  assertSkipGhFirstSessionSerial
} from "../zflash/test-harness/serial-markers";
export function firstSessionPhase3Enabled() {
  return process.env.QEMU_FIRST_SESSION_PHASE3 === "1";
}
export function firstSessionMarkersSatisfied(serialOutput) {
  return "ok" in assertMockIdentityAuthFirstSessionSerial(serialOutput) || "ok" in assertHappyPathFirstSessionSerial(serialOutput) || "ok" in assertSkipGhFirstSessionSerial(serialOutput);
}
