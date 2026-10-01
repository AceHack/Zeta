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

import { decideClusterBoot } from "./decide";
import {
  AVAHI_BROWSE_UNCONDITIONAL_LONG_OPTIONS,
  PASS_OFFSETS_MS,
  browseArgs,
  probeForClusters,
  type BrowsePassResult,
} from "./probe";

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

describe("the argument list is one the shipped avahi-browse accepts (081M39K8ND1087G0R000G4EN4N)", () => {
  // Until 2026-09-27 browseArgs() carried `--no-db-lookup`, which avahi 0.8
  // compiles only with gdbm/dbm -- and nixpkgs builds avahi `--disable-gdbm`.
  // Every pass exited 1, so discovery had NEVER run on a shipped image, and the
  // existing tests stayed green because they checked the args as a value.

  /**
   * A getopt-faithful stand-in for the nixpkgs avahi-browse: long options in
   * the unconditional table are accepted, anything else is rejected exactly the
   * way the measured binary rejected `--no-db-lookup` (run 35985197702).
   */
  function nixpkgsAvahiBrowse(stdout: string): (args: readonly string[]) => Promise<BrowsePassResult> {
    return async (args) => {
      for (const arg of args) {
        if (arg.startsWith("--") && !AVAHI_BROWSE_UNCONDITIONAL_LONG_OPTIONS.has(arg.slice(2).split("=")[0] ?? "")) {
          return { exitCode: 1, stdout: "", stderr: `avahi-browse: unrecognized option '${arg}'` };
        }
      }
      return ok(stdout);
    };
  }

  test("every long option is one avahi 0.8 compiles on every build (fails on --no-db-lookup)", () => {
    const longOptions = browseArgs()
      .filter((arg) => arg.startsWith("--"))
      .map((arg) => arg.slice(2));
    expect(longOptions.length).toBeGreaterThan(0);
    for (const option of longOptions) {
      expect(AVAHI_BROWSE_UNCONDITIONAL_LONG_OPTIONS.has(option)).toBe(true);
    }
    // The gdbm-only pair must never be in the accepted set, or the guard above is vacuous.
    expect(AVAHI_BROWSE_UNCONDITIONAL_LONG_OPTIONS.has("no-db-lookup")).toBe(false);
    expect(AVAHI_BROWSE_UNCONDITIONAL_LONG_OPTIONS.has("dump-db")).toBe(false);
  });

  test("the args still ask for parsable, resolved, terminating output on our service type", () => {
    const args = browseArgs();
    expect(args).toContain("--parsable");
    expect(args).toContain("--resolve");
    expect(args).toContain("--terminate");
    expect(args[args.length - 1]).toBe("_zeta-k3s._tcp");
  });

  test("against the stand-in, an empty segment is a SILENCE with every pass counted", async () => {
    const time = virtualTime();
    const outcome = await probeForClusters({ runBrowse: nixpkgsAvahiBrowse(""), ...time });
    expect(outcome.kind).toBe("silence");
    if (outcome.kind !== "silence") {
      return;
    }
    expect(outcome.queryBursts).toBe(PASS_OFFSETS_MS.length);
  });

  test("against the stand-in, a live cluster is FOUND", async () => {
    const time = virtualTime();
    const outcome = await probeForClusters({ runBrowse: nixpkgsAvahiBrowse(RESOLVED), ...time });
    expect(outcome.kind).toBe("responded");
  });

  test("the measured rejection is probe-failed, never silence, and the decision never bootstraps on it", async () => {
    const time = virtualTime();
    const outcome = await probeForClusters({
      runBrowse: async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "avahi-browse: unrecognized option '--no-db-lookup'",
      }),
      ...time,
    });
    expect(outcome.kind).toBe("probe-failed");
    if (outcome.kind !== "probe-failed") {
      return;
    }
    expect(outcome.reason).toBe("browser-error");
    const { decideClusterBoot } = await import("./decide");
    for (const tokenAvailable of [true, false]) {
      const decision = decideClusterBoot({ probe: outcome, credentials: { tokenAvailable } });
      expect(decision.action).toBe("refuse");
    }
  });
});

describe("the dwell is honoured as MEASURED, not as requested", () => {
  /** A sleeper whose timer wakes `earlyBy` ms short of what was asked, as a real one sometimes does. */
  function earlyTime(earlyBy: number): { now: () => number; sleep: (ms: number) => Promise<void> } {
    let clock = 0;
    return {
      now: () => clock,
      sleep: async (ms: number) => {
        clock += ms > earlyBy ? ms - earlyBy : ms;
        await Promise.resolve();
      },
    };
  }

  test("a timer that wakes 1 ms early still yields elapsedMs >= dwellMs (run 36832486494: 29999 ms halted an install)", async () => {
    const outcome = await probeForClusters({ runBrowse: async () => ok(""), ...earlyTime(1) });
    expect(outcome.kind).toBe("silence");
    if (outcome.kind !== "silence") {
      return;
    }
    expect(outcome.elapsedMs).toBeGreaterThanOrEqual(outcome.dwellMs);
    // And the decision accepts it: the strict admissibility check was never the defect.
    expect(
      decideClusterBoot({ probe: outcome, credentials: { tokenAvailable: false } }).action,
    ).toBe("bootstrap");
  });

  test("a sleeper that never advances the clock cannot spin the probe: it falls through to the refusal", async () => {
    let clock = 0;
    let sleeps = 0;
    const outcome = await probeForClusters({
      runBrowse: async () => ok(""),
      now: () => clock,
      sleep: async () => {
        sleeps += 1;
        await Promise.resolve();
      },
    });
    expect(outcome.kind).toBe("silence");
    if (outcome.kind !== "silence") {
      return;
    }
    expect(outcome.elapsedMs).toBeLessThan(outcome.dwellMs);
    expect(sleeps).toBeLessThan(50);
    expect(clock).toBe(0);
    expect(
      decideClusterBoot({ probe: outcome, credentials: { tokenAvailable: false } }).action,
    ).toBe("refuse");
  });
});
