import { spawnSync } from "node:child_process";

import { describe, expect, test } from "bun:test";

import {
  agencySignatureBlock,
  assertNoSkipCi,
  signedFlushMessage,
} from "./flush-via-staging";

// The telemetry lanes that flush through this tool.
const LANES = ["tick-metrics", "society", "red-state"] as const;

// The validator's REQUIRED_KEYS, duplicated deliberately: if that list changes,
// this test must go red rather than silently accept a block missing a key.
const REQUIRED_KEYS = [
  "Agency-Signature-Version",
  "Agent",
  "Agent-Runtime",
  "Agent-Model",
  "Credential-Identity",
  "Credential-Mode",
  "Human-Review",
  "Human-Review-Evidence",
  "Action-Mode",
  "Task",
] as const;

/** git's own trailer parser — the only witness that matters. */
function parsedTrailers(message: string): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const r = spawnSync("git", ["interpret-trailers", "--parse"], {
    encoding: "utf8",
    input: message,
  });
  return r.stdout;
}

describe("assertNoSkipCi", () => {
  test("refuses a skip token", () => {
    expect(assertNoSkipCi("metrics: append tick frame [skip ci]")).not.toBeNull();
  });

  test("accepts a clean message", () => {
    expect(assertNoSkipCi("metrics: append tick frame")).toBeNull();
  });
});

// These lanes used to emit UNSIGNED commits, which the post-merge auditor could
// only pass via the explicit MACHINE-LANE-EXEMPT roster entry (#10573). Signing
// them makes them CORRECT instead of exempt, shrinking the exemption surface.
describe("AgencySignature on telemetry flushes", () => {
  test.each([...LANES])("%s: the block carries every required key", (lane) => {
    const block = agencySignatureBlock(lane);
    for (const key of REQUIRED_KEYS) {
      expect(block).toContain(`${key}:`);
    }
    expect(block).toContain("Co-authored-by:");
  });

  test.each([...LANES])("%s: the lane is named in the Agent field", (lane: string) => {
    expect(agencySignatureBlock(lane)).toContain(`Agent: ${lane}-flush-workflow`);
  });

  test("the canonical key spelling is used, not the Agent- twin", () => {
    const block = agencySignatureBlock("tick-metrics");
    expect(block).toContain("Agency-Signature-Version: 1");
    // MUTATION: this is the slip that reached main three times and was, until
    // #10573, exempt AND unsigned at once.
    expect(/^Agent-Signature-Version:/m.test(block)).toBe(false);
  });

  test("the block is CONTIGUOUS — no blank line may split it", () => {
    // git's trailer parser reads only the final blank-line-delimited paragraph,
    // so a blank line inside the block silently drops everything above it.
    expect(agencySignatureBlock("society")).not.toContain("\n\n");
  });

  test.each([...LANES])(
    "%s: git itself parses every required key out of the flush message",
    (lane) => {
      // Not "the string contains the keys" — the PARSER is the witness. A block
      // that reads correctly and does not parse is the exact failure mode
      // (Trailer Contiguity Survival Failure).
      const trailers = parsedTrailers(signedFlushMessage("metrics: append tick frame", lane));
      for (const key of REQUIRED_KEYS) {
        expect(trailers).toContain(`${key}:`);
      }
    },
  );

  test("MUTATION: a blank line inside the block makes git drop the keys above it", () => {
    // The falsifier for the contiguity test above — proves that test is testing
    // something, by constructing the failure it is meant to exclude.
    const broken =
      "metrics: append tick frame\n\nAgency-Signature-Version: 1\nAgent: x\n\nTask: none\n";
    const trailers = parsedTrailers(broken);
    expect(trailers).toContain("Task:");
    expect(trailers).not.toContain("Agency-Signature-Version:");
  });

  test("the signed message keeps the original subject as its first line", () => {
    // The PR title is built from the message's first line; signing must not
    // displace it.
    const msg = signedFlushMessage("metrics: append tick frame", "tick-metrics");
    expect(msg.split("\n")[0]).toBe("metrics: append tick frame");
  });

  test("signing does not smuggle in a CI-skip token", () => {
    // A skip token in the flush commit means `gate (required)` never runs and the
    // PR hangs unmergeable forever.
    expect(assertNoSkipCi(signedFlushMessage("metrics: append tick frame", "society"))).toBeNull();
  });
});
