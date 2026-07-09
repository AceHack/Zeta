import {
  assertMockIdentityAuthFirstSessionSerial,
  assertSkipGhFirstSessionSerial,
  FIRST_SESSION_SKIP_IDENTITY_AUTH_MARKERS
} from "../zflash/test-harness/serial-markers";
import { postBootSelfRegMarkersSatisfied } from "./self-reg-serial.ts";
export {
  assertHappyPathFirstSessionSerial,
  assertMockIdentityAuthFirstSessionSerial,
  assertSkipGhFirstSessionSerial
} from "../zflash/test-harness/serial-markers";
export function firstSessionPhase3Enabled() {
  return process.env.QEMU_FIRST_SESSION_PHASE3 === "1";
}
export function postBootSelfRegPhase3Required() {
  return firstSessionPhase3Enabled();
}
export function firstSessionIdentityAuthSkipSatisfied(serialOutput) {
  if ("ok" in assertSkipGhFirstSessionSerial(serialOutput))
    return !0;
  return FIRST_SESSION_SKIP_IDENTITY_AUTH_MARKERS.every((m) => serialOutput.includes(m));
}
export function firstSessionMarkersSatisfied(serialOutput) {
  if ("ok" in assertMockIdentityAuthFirstSessionSerial(serialOutput))
    return !0;
  return firstSessionIdentityAuthSkipSatisfied(serialOutput);
}
export function phase3BootMarkersSatisfied(serialOutput) {
  if (!firstSessionMarkersSatisfied(serialOutput))
    return !1;
  if (!postBootSelfRegPhase3Required())
    return !0;
  return postBootSelfRegMarkersSatisfied(serialOutput);
}
