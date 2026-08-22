import { describe, expect, test } from "bun:test";
import {
  isExpiredDeviceCapability,
  isOperatorCapabilityExpiry,
  operatorCapabilityExpiryTeachingError,
  operatorNetworkTeachingError,
} from "./passkeyProposal";

describe("operator network teaching errors", () => {
  test("turns opaque browser transport failures into a corrective error", () => {
    const error = operatorNetworkTeachingError(new TypeError("Failed to fetch"));

    expect(error.message).toContain("teaching error:");
    expect(error.message).toContain("retract -1 operator-proposal");
    expect(error.message).toContain("reload the current lightweight authorization page");
    expect(error.message).toContain("Failed to fetch");
  });
});

describe("delegated capability expiry", () => {
  test("FAULT INJECTION: an expired browser delegation yields a corrective reauthorization lesson", () => {
    const expired = {
      capability: "capability",
      credentialId: "credential",
      authorRegistrySequence: 4,
      expiresAt: "2026-08-17T15:00:00.000Z",
    };

    expect(isExpiredDeviceCapability(expired, new Date("2026-08-17T15:00:00.000Z"))).toBeTrue();
    expect(isOperatorCapabilityExpiry(new Error("teaching error: the operator capability has expired"))).toBeTrue();

    const error = operatorCapabilityExpiryTeachingError();
    expect(error.message).toContain("retract -1 operator-proposal");
    expect(error.message).toContain("reviewed passkey");
    expect(error.message).toContain("authorize this device again");
  });
});
