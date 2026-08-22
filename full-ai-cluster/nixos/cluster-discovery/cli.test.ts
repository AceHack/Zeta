/**
 * Falsifiers for the entrypoint.
 *
 * Two of these run REAL processes -- /bin/echo and /bin/sleep -- because the
 * properties they check are properties of process handling, and a fake would
 * be checking the fake. Neither touches a network.
 */

import { describe, expect, test } from "bun:test";

import {
  KILLED_BY_TIMEOUT_EXIT_CODE,
  anyInterfaceUp,
  bunBrowseRunner,
  credentialStateFromFlags,
  explicitRoleFromFlags,
  parseArgs,
  policyFromFlags,
} from "./cli";

const CLUSTER = "c".repeat(64);

describe("the runner distinguishes its failure modes", () => {
  test("a binary that does not exist yields null, so the probe can say browser-missing", async () => {
    const run = bunBrowseRunner("/nonexistent/avahi-browse");
    expect(await run([])).toBeNull();
  });

  test("a binary that runs and exits is reported with its output", async () => {
    const run = bunBrowseRunner("/bin/echo");
    const result = await run(["hello"]);
    expect(result?.exitCode).toBe(0);
    expect(result?.stdout.trim()).toBe("hello");
  });

  test("a pass that never terminates is killed and reported as a failure", async () => {
    const run = bunBrowseRunner("/bin/sleep", 150);
    const result = await run(["30"]);
    expect(result?.exitCode).toBe(KILLED_BY_TIMEOUT_EXIT_CODE);
    expect(result?.stderr).toContain("without terminating");
  }, 10_000);

  test("a missing /sys/class/net reads as NO carrier, never as carrier", async () => {
    expect(await anyInterfaceUp("/nonexistent/sys/class/net")).toBe(false);
  });
});

describe("flags are lifted without inventing values", () => {
  test("an unknown positional is an error, not an ignored word", () => {
    expect(typeof parseArgs(["oops"])).toBe("string");
  });

  test("a bare flag reads as true", () => {
    const flags = parseArgs(["--token-present"]);
    expect(typeof flags).not.toBe("string");
    if (typeof flags === "string") {
      return;
    }
    expect(flags["token-present"]).toBe("true");
  });

  test("no token flag at all means NO token, never an assumed one", () => {
    const state = credentialStateFromFlags({});
    expect(typeof state).not.toBe("string");
    if (typeof state === "string") {
      return;
    }
    expect(state.tokenAvailable).toBe(false);
    expect(state.expectedClusterId).toBeUndefined();
  });

  test("a token prefix yields the CA pin and nothing else", () => {
    const state = credentialStateFromFlags({ "token-present": "true", "token-prefix": `K10${CLUSTER}` });
    expect(typeof state).not.toBe("string");
    if (typeof state === "string") {
      return;
    }
    expect(state.expectedClusterId).toBe(CLUSTER);
  });

  test("a malformed token prefix is refused rather than dropped", () => {
    expect(typeof credentialStateFromFlags({ "token-prefix": "K10nope" })).toBe("string");
  });

  test("two pin sources at once is refused rather than silently ranked", () => {
    const state = credentialStateFromFlags({ "token-prefix": `K10${CLUSTER}`, "expect-cluster-id": CLUSTER });
    expect(typeof state).toBe("string");
  });
});

describe("role and policy lifting", () => {
  test("no --role means no declaration, so discovery decides", () => {
    expect(explicitRoleFromFlags({})).toBeUndefined();
  });

  test("a --role with no --join-server-url carries no endpoint", () => {
    const declaration = explicitRoleFromFlags({ role: "joiner", "role-source": "esp" });
    expect(declaration?.role).toBe("joiner");
    expect(declaration?.joinServerUrl).toBeUndefined();
  });

  test("an unrecognised role is passed through so the DECISION refuses it", () => {
    expect(explicitRoleFromFlags({ role: "worker-gpu" })?.role).toBe("worker-gpu");
  });

  test("no --trust-domain leaves the expectation unset rather than defaulting one", () => {
    expect(policyFromFlags({}).expectedTrustDomain).toBeUndefined();
  });

  test("the short-dwell acknowledgement is off unless it is asked for", () => {
    expect(policyFromFlags({}).acknowledgedShortDwell).toBe(false);
    expect(policyFromFlags({ "acknowledge-short-dwell": "true" }).acknowledgedShortDwell).toBe(true);
  });
});
