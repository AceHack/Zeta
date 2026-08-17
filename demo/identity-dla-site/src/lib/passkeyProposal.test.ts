import { describe, expect, test } from "bun:test";
import { operatorNetworkTeachingError } from "./passkeyProposal";

describe("operator network teaching errors", () => {
  test("turns opaque browser transport failures into a corrective error", () => {
    const error = operatorNetworkTeachingError(new TypeError("Failed to fetch"));

    expect(error.message).toContain("teaching error:");
    expect(error.message).toContain("retract -1 operator-proposal");
    expect(error.message).toContain("reload the current lightweight authorization page");
    expect(error.message).toContain("Failed to fetch");
  });
});
