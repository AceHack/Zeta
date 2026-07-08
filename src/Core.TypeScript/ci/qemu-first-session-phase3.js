import {
  assertHappyPathFirstSessionSerial,
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
  if (!firstSessionPhase3Enabled())
    return !1;
  return process.env.QEMU_SELF_REGISTER_ALLOW_MISSING !== "1";
}
export function firstSessionIdentityAuthSkipSatisfied(serialOutput) {
  if ("ok" in assertSkipGhFirstSessionSerial(serialOutput))
    return !0;
  return FIRST_SESSION_SKIP_IDENTITY_AUTH_MARKERS.every((m) => serialOutput.includes(m));
}
export function firstSessionMarkersSatisfied(serialOutput) {
  if ("ok" in assertMockIdentityAuthFirstSessionSerial(serialOutput))
    return !0;
  if (firstSessionIdentityAuthSkipSatisfied(serialOutput))
    return !0;
  if (process.env.ZETA_FIRST_SESSION_ALLOW_DRY_RUN_AUTH === "1")
    return "ok" in assertHappyPathFirstSessionSerial(serialOutput);
  return !1;
}
export function phase3BootMarkersSatisfied(serialOutput) {
  if (!firstSessionMarkersSatisfied(serialOutput))
    return !1;
  if (!postBootSelfRegPhase3Required())
    return !0;
  return postBootSelfRegMarkersSatisfied(serialOutput);
}
