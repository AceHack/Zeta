/**
 * Falsifiers for the probe adapter.
 *
 * The one that matters most: an adapter that cannot look must not report an
 * empty network. Every failure path below is asserted to produce
 * `probe-failed`, and the burst count a silence carries is asserted to be a
 * COUNT OF PASSES THAT RAN rather than a constant.
 *
 * No network, no avahi, no sleeping: the runner, clock and sleeper are
 * injected, so the 30 s dwell runs in microseconds of virtual time.
 */

import { describe, expect, test } from "bun:test";

import { PASS_OFFSETS_MS, probeForClusters, type BrowsePassResult } from "./probe";

const CLUSTER = "a".repeat(64);
const TXT = `"txtvers=1" "cluster=${CLUSTER}" "td=zeta.home" "role=control-plane" "node=node-ad1efd"`;
const RESOLVED = `=;eth0;IPv4;node-ad1efd;_zeta-k3s._tcp;local;node-ad1efd.local;10.88.0.1;6443;${TXT}`;

/** A virtual clock: `sleep` advances it, so the dwell costs no wall time. */
function virtualTime(): { now: () => number; sleep: (ms: number) => Promise<void> } {
  let clock = 0;
  return {
    now: () => clock,
    sleep: async (ms: number) => {
      clock += ms;
      await Promise.resolve();
    },
  };
}

function ok(stdout: string): BrowsePassResult {
  return { exitCode: 0, stdout, stderr: "" };
}

describe("a probe that cannot look never reports an empty network", () => {
  test("avahi-browse absent: probe-failed(browser-missing)", async () => {
    const time = virtualTime();
    const outcome = await probeForClusters({ runBrowse: async () => null, ...time });
    expect(outcome.kind).toBe("probe-failed");
    if (outcome.kind !== "probe-failed") {
      return;
    }
    expect(outcome.reason).toBe("browser-missing");
  });

  test("avahi daemon down: probe-failed(responder-unavailable)", async () => {
    const time = virtualTime();
    const outcome = await probeForClusters({
      runBrowse: async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "Failed to create client object: Daemon not running",
      }),
      ...time,
    });
    expect(outcome.kind).toBe("probe-failed");
    if (outcome.kind !== "probe-failed") {
      return;
    }
    expect(outcome.reason).toBe("responder-unavailable");
  });

  test("any other non-zero exit: probe-failed(browser-error)", async () => {
    const time = virtualTime();
    const outcome = await probeForClusters({
      runBrowse: async () => ({ exitCode: 2, stdout: "", stderr: "invalid arguments" }),
      ...time,
    });
    expect(outcome.kind).toBe("probe-failed");
  });

  test("no carrier: probe-failed(no-carrier), and the browser is never run", async () => {
    const time = virtualTime();
    let calls = 0;
    const outcome = await probeForClusters({
      runBrowse: async () => {
        calls += 1;
        return ok("");
      },
      hasCarrier: async () => false,
      ...time,
    });
    expect(outcome.kind).toBe("probe-failed");
    expect(calls).toBe(0);
  });
});

describe("what a real silence and a real answer look like", () => {
  test("every pass ran and heard nothing: silence, with the burst count MEASURED", async () => {
    const time = virtualTime();
    const outcome = await probeForClusters({ runBrowse: async () => ok(""), ...time });
    expect(outcome.kind).toBe("silence");
    if (outcome.kind !== "silence") {
      return;
    }
    expect(outcome.queryBursts).toBe(PASS_OFFSETS_MS.length);
    expect(outcome.elapsedMs).toBe(outcome.dwellMs);
  });

  test("a responder that only answers on the third pass is still found", async () => {
    const time = virtualTime();
    let pass = 0;
    const outcome = await probeForClusters({
      runBrowse: async () => {
        pass += 1;
        return ok(pass >= 3 ? RESOLVED : "");
      },
      ...time,
    });
    expect(outcome.kind).toBe("responded");
    if (outcome.kind !== "responded") {
      return;
    }
    expect(outcome.advertisements.length).toBe(1);
  });

  test("the same answer in every pass is unioned, not counted five times", async () => {
    const time = virtualTime();
    const outcome = await probeForClusters({ runBrowse: async () => ok(RESOLVED), ...time });
    expect(outcome.kind).toBe("responded");
    if (outcome.kind !== "responded") {
      return;
    }
    expect(outcome.advertisements.length).toBe(1);
    expect(outcome.queryBursts).toBe(PASS_OFFSETS_MS.length);
  });

  test("a shortened schedule is reported as a shortened schedule", async () => {
    const time = virtualTime();
    const outcome = await probeForClusters({
      runBrowse: async () => ok(""),
      passOffsetsMs: [0, 1_000],
      dwellMs: 2_000,
      ...time,
    });
    expect(outcome.kind).toBe("silence");
    if (outcome.kind !== "silence") {
      return;
    }
    expect(outcome.queryBursts).toBe(2);
    expect(outcome.dwellMs).toBe(2_000);
  });
});

describe("the adapter and the decision compose end to end", () => {
  test("a shortened schedule produces a silence the decision then REFUSES", async () => {
    const time = virtualTime();
    const outcome = await probeForClusters({
      runBrowse: async () => ok(""),
      passOffsetsMs: [0],
      dwellMs: 1_000,
      ...time,
    });
    const { decideClusterBoot } = await import("./decide");
    const decision = decideClusterBoot({ probe: outcome, credentials: { tokenAvailable: true } });
    expect(decision.action).toBe("refuse");
  });

  test("the full schedule with no answers produces a silence the decision ACCEPTS", async () => {
    const time = virtualTime();
    const outcome = await probeForClusters({ runBrowse: async () => ok(""), ...time });
    const { decideClusterBoot } = await import("./decide");
    const decision = decideClusterBoot({ probe: outcome, credentials: { tokenAvailable: false } });
    expect(decision.action).toBe("bootstrap");
  });
});
