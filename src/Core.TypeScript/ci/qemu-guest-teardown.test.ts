import { describe, expect, it } from "bun:test";
import {
  advanceQmpHandshake,
  DEFAULT_TEARDOWN_BUDGET,
  drainJsonLines,
  QMP_CAPABILITIES_COMMAND,
  QMP_POWERDOWN_COMMAND,
  qmpSocketArgs,
  qmpSystemPowerdown,
  tearDownGuest,
  type TeardownBudget,
  type TeardownDeps,
} from "./qemu-guest-teardown.ts";

/**
 * A fake QEMU process. `exitsAfterMs` is measured on the FAKE clock, from the
 * moment the named rung is used — so a case can say "this guest ignores ACPI but
 * dies on SIGTERM" without a hypervisor and without real time passing.
 */
interface FakeGuestSpec {
  readonly powerdown: { readonly ok: true } | { readonly ok: false; readonly error: string };
  /** ms after a successful powerdown before the process exits; null = never. */
  readonly exitsAfterPowerdownMs: number | null;
  /** ms after SIGTERM before the process exits; null = never. */
  readonly exitsAfterSigtermMs: number | null;
  /** ms after SIGKILL before the process exits. */
  readonly exitsAfterSigkillMs?: number;
  readonly alreadyExited?: boolean;
}

function fakeGuest(spec: FakeGuestSpec): {
  readonly deps: TeardownDeps;
  readonly signals: readonly string[];
  readonly lines: readonly string[];
  readonly powerdownCalls: () => number;
} {
  let clock = 1_000;
  let exitAt: number | null = spec.alreadyExited === true ? clock : null;
  const signals: string[] = [];
  const lines: string[] = [];
  let powerdowns = 0;

  const deps: TeardownDeps = {
    hasExited: () => exitAt !== null && clock >= exitAt,
    powerdown: async () => {
      powerdowns += 1;
      if (spec.powerdown.ok && spec.exitsAfterPowerdownMs !== null) {
        exitAt = clock + spec.exitsAfterPowerdownMs;
      }
      return spec.powerdown;
    },
    kill: (signal) => {
      signals.push(signal);
      if (signal === "SIGTERM" && spec.exitsAfterSigtermMs !== null) {
        exitAt = clock + spec.exitsAfterSigtermMs;
      }
      if (signal === "SIGKILL") {
        exitAt = clock + (spec.exitsAfterSigkillMs ?? 100);
      }
    },
    // The fake clock only advances when the ladder sleeps, so every budget below
    // is exercised in microseconds of real time.
    sleep: async (ms) => {
      clock += ms;
    },
    now: () => clock,
    log: (line) => {
      lines.push(line);
    },
  };
  return { deps, signals, lines, powerdownCalls: () => powerdowns };
}

const OPTIONS = { graceful: true, label: "phase 2 (disk boot)", reason: "phase-3 reads this disk" } as const;
const ABORT_OPTIONS = { graceful: false, label: "phase 1 (ISO install)", reason: "deliberate abort" } as const;

// A tight budget keeps the fake clock's arithmetic readable; the ladder's shape
// is what is under test, never the constants' magnitudes.
const BUDGET: TeardownBudget = {
  gracefulWaitMs: 10_000,
  sigtermWaitMs: 2_000,
  sigkillWaitMs: 1_000,
  pollMs: 500,
};

describe("tearDownGuest — the fallback ladder", () => {
  it("reports already-exited without sending anything when the process is already gone", async () => {
    const g = fakeGuest({
      alreadyExited: true,
      powerdown: { ok: true },
      exitsAfterPowerdownMs: 0,
      exitsAfterSigtermMs: 0,
    });
    const outcome = await tearDownGuest(g.deps, OPTIONS, BUDGET);
    expect(outcome.path).toBe("already-exited");
    expect(outcome.gracefulAttempted).toBe(false);
    expect(g.signals).toEqual([]);
    expect(g.powerdownCalls()).toBe(0);
  });

  it("reports graceful — and sends NO signal — when QMP powerdown is accepted and the guest exits", async () => {
    const g = fakeGuest({
      powerdown: { ok: true },
      exitsAfterPowerdownMs: 4_000,
      exitsAfterSigtermMs: 0,
    });
    const outcome = await tearDownGuest(g.deps, OPTIONS, BUDGET);
    expect(outcome.path).toBe("graceful");
    expect(outcome.gracefulAttempted).toBe(true);
    expect(outcome.gracefulFailure).toBeUndefined();
    // THE POINT OF THE WHOLE MODULE: on the happy path the emulator is never
    // shot, so the guest's page cache reaches the disk.
    expect(g.signals).toEqual([]);
    expect(outcome.elapsedMs).toBeGreaterThanOrEqual(4_000);
  });

  it("falls back to SIGTERM and NAMES the transport failure when the QMP socket is unreachable", async () => {
    const g = fakeGuest({
      powerdown: { ok: false, error: "QMP connect threw for /tmp/qmp.sock: ENOENT" },
      exitsAfterPowerdownMs: null,
      exitsAfterSigtermMs: 500,
    });
    const outcome = await tearDownGuest(g.deps, OPTIONS, BUDGET);
    expect(outcome.path).toBe("sigterm");
    expect(outcome.gracefulAttempted).toBe(true);
    expect(outcome.gracefulFailure).toContain("ENOENT");
    expect(g.signals).toEqual(["SIGTERM"]);
    // Never silent — the ladder must say out loud that the disk was not synced.
    expect(g.lines.some((l) => l.includes("WARNING") && l.includes("page cache WILL be discarded"))).toBe(true);
  });

  it("falls back to SIGTERM when powerdown is ACCEPTED but the guest outlasts the graceful budget", async () => {
    const g = fakeGuest({
      powerdown: { ok: true },
      exitsAfterPowerdownMs: null, // ACPI acknowledged, guest wedged
      exitsAfterSigtermMs: 500,
    });
    const outcome = await tearDownGuest(g.deps, OPTIONS, BUDGET);
    expect(outcome.path).toBe("sigterm");
    // An ACCEPTED command that produced no exit must NOT read as graceful.
    // This is the vacuity falsifier: "QMP said yes" is not "the disk synced".
    expect(outcome.gracefulFailure).toContain("did not exit within");
    expect(g.signals).toEqual(["SIGTERM"]);
  });

  it("escalates to SIGKILL when SIGTERM is ignored, and still reports why graceful failed", async () => {
    const g = fakeGuest({
      powerdown: { ok: false, error: "QMP socket closed at stage greeting" },
      exitsAfterPowerdownMs: null,
      exitsAfterSigtermMs: null,
      exitsAfterSigkillMs: 200,
    });
    const outcome = await tearDownGuest(g.deps, OPTIONS, BUDGET);
    expect(outcome.path).toBe("sigkill");
    expect(g.signals).toEqual(["SIGTERM", "SIGKILL"]);
    expect(outcome.gracefulFailure).toContain("stage greeting");
  });

  it("skips the graceful rung entirely for a deliberate abort, and says so", async () => {
    const g = fakeGuest({
      powerdown: { ok: true },
      exitsAfterPowerdownMs: 0,
      exitsAfterSigtermMs: 500,
    });
    const outcome = await tearDownGuest(g.deps, ABORT_OPTIONS, BUDGET);
    expect(outcome.path).toBe("sigterm");
    expect(outcome.gracefulAttempted).toBe(false);
    expect(outcome.gracefulFailure).toBeUndefined();
    expect(g.powerdownCalls()).toBe(0);
    expect(g.lines.some((l) => l.includes("killing the emulator without a guest shutdown"))).toBe(true);
  });

  it("logs the rung it took on every path, so a later run can be read rather than guessed at", async () => {
    for (const spec of [
      { powerdown: { ok: true } as const, exitsAfterPowerdownMs: 1_000, exitsAfterSigtermMs: null },
      { powerdown: { ok: false, error: "no socket" } as const, exitsAfterPowerdownMs: null, exitsAfterSigtermMs: 100 },
      {
        powerdown: { ok: false, error: "no socket" } as const,
        exitsAfterPowerdownMs: null,
        exitsAfterSigtermMs: null,
      },
    ]) {
      const g = fakeGuest(spec);
      const outcome = await tearDownGuest(g.deps, OPTIONS, BUDGET);
      expect(g.lines.some((l) => l.includes(`teardown path=${outcome.path}`) && l.includes("elapsed="))).toBe(true);
    }
  });

  it("ships a default budget that leaves a real NixOS+k3s shutdown room to finish", () => {
    // The brief's floor was 120s; the constant must not drift under it without
    // someone changing this line on purpose.
    expect(DEFAULT_TEARDOWN_BUDGET.gracefulWaitMs).toBeGreaterThanOrEqual(120_000);
    expect(DEFAULT_TEARDOWN_BUDGET.sigtermWaitMs).toBeGreaterThan(DEFAULT_TEARDOWN_BUDGET.pollMs);
  });
});

describe("advanceQmpHandshake — the three-message QMP exchange", () => {
  it("answers the greeting with qmp_capabilities", () => {
    const step = advanceQmpHandshake("greeting", { QMP: { version: {}, capabilities: [] } });
    expect(step).toEqual({ kind: "send", payload: QMP_CAPABILITIES_COMMAND, nextStage: "capabilities" });
  });

  it("answers the capabilities return with system_powerdown", () => {
    const step = advanceQmpHandshake("capabilities", { return: {} });
    expect(step).toEqual({ kind: "send", payload: QMP_POWERDOWN_COMMAND, nextStage: "powerdown" });
  });

  it("is done when system_powerdown returns", () => {
    expect(advanceQmpHandshake("powerdown", { return: {} })).toEqual({ kind: "done" });
  });

  it("WAITS through interleaved asynchronous events at every stage", () => {
    // QMP puts events on the same socket as replies. A state machine that took
    // "the next line" as its reply would wedge on the first of these.
    const event = { event: "POWERDOWN", timestamp: { seconds: 1, microseconds: 2 } };
    expect(advanceQmpHandshake("greeting", event)).toEqual({ kind: "wait" });
    expect(advanceQmpHandshake("capabilities", event)).toEqual({ kind: "wait" });
    expect(advanceQmpHandshake("powerdown", event)).toEqual({ kind: "wait" });
  });

  it("surfaces a QMP error with its desc rather than treating it as a wait", () => {
    const step = advanceQmpHandshake("capabilities", {
      error: { class: "CommandNotFound", desc: "The command qmp_capabilities has not been found" },
    });
    expect(step.kind).toBe("error");
    if (step.kind === "error") {
      expect(step.error).toContain("has not been found");
      expect(step.error).toContain("capabilities");
    }
  });
});

describe("drainJsonLines — newline-delimited JSON across read boundaries", () => {
  it("keeps a partial trailing line for the next read", () => {
    const first = drainJsonLines('{"QMP":{}}\n{"ret');
    expect(first.messages).toEqual([{ QMP: {} }]);
    expect(first.rest).toBe('{"ret');
    const second = drainJsonLines(first.rest + 'urn":{}}\n');
    expect(second.messages).toEqual([{ return: {} }]);
    expect(second.rest).toBe("");
  });

  it("reports undecodable lines instead of silently dropping them", () => {
    const drained = drainJsonLines("not json at all\n{\"return\":{}}\n");
    expect(drained.undecodable).toEqual(["not json at all"]);
    expect(drained.messages).toEqual([{ return: {} }]);
  });

  it("skips blank lines and bare scalars", () => {
    const drained = drainJsonLines('\n\n42\n{"QMP":{}}\n');
    expect(drained.messages).toEqual([{ QMP: {} }]);
    expect(drained.undecodable).toEqual(["42"]);
  });
});

describe("qmpSocketArgs", () => {
  it("asks QEMU to create the socket and boot without waiting for a client", () => {
    // wait=off is load-bearing: this harness only connects at TEARDOWN time, so
    // wait=on would hang every phase at startup.
    expect(qmpSocketArgs("/tmp/x/qmp.sock")).toEqual(["-qmp", "unix:/tmp/x/qmp.sock,server=on,wait=off"]);
  });
});

describe("qmpSystemPowerdown — transport failures are reported, never swallowed", () => {
  it("returns a NAMED error for a socket path that does not exist", async () => {
    const result = await qmpSystemPowerdown("/nonexistent/zeta-qmp-does-not-exist.sock", 2_000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("zeta-qmp-does-not-exist.sock");
    }
  });
});
