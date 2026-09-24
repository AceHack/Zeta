#!/usr/bin/env bun
/**
 * src/Core.TypeScript/ci/qemu-guest-teardown.ts
 *
 * WP27 (081M392JR97087G0R003QAFH0Y) — shut the GUEST down, not the emulator.
 *
 * THE MEASUREMENT THIS EXISTS FOR. `qemu-full-install-test.ts`'s `runQemuUntil`
 * used to tear every phase down with
 *
 *     qemu.kill("SIGTERM"); await Bun.sleep(2000); qemu.kill("SIGKILL");
 *
 * SIGTERM to `qemu-system-x86_64` kills the EMULATOR. The guest OS inside it is
 * never told anything: its page cache is discarded and every dirty block that
 * had not yet reached the virtual disk is lost. On ext4 with delayed allocation
 * that produces the exact pathology WP25 spent two CI runs chasing — files whose
 * inode exists and whose data blocks never landed, i.e. ZERO-LENGTH files.
 * Measured on run 35954415942's `qemu-k3s-first-boot-verify-serial-log`: on the
 * phase-3 boot every file under `/var/lib/rancher/k3s/agent` was 0 bytes with
 * timestamps from the PREVIOUS boot, plus `/etc/rancher/node/password` at 0
 * bytes. k3s's `LoadOrGenerateKeyFile` refuses to regenerate a file that exists,
 * so `k3s.service` retried forever and never reached active.
 *
 * THE CONSEQUENCE THAT MATTERS, AND WHY THIS IS NOT A TIDY-UP. Phase 2 was
 * ALWAYS crashed before phase 3 booted. So the "WP11 — installed-disk first-boot
 * k3s verify" lane has only ever measured the POST-CRASH path. The path a real
 * user gets — plug the USB in, install, the machine reboots cleanly, k3s comes
 * up — has never been measured by that lane at all. Closing that gap is the
 * whole point; the self-heal stays, because a power cut on real hardware
 * produces exactly the crashed state and something must survive it.
 *
 * THE LADDER, AND WHY IT REPORTS WHICH RUNG IT USED. ACPI powerdown can fail for
 * reasons that are not this harness's fault (no QMP socket, a guest with no
 * acpid/logind handler, a kernel already wedged). A teardown that always claimed
 * "graceful" without checking would be the vacuity class this repo refuses — a
 * check that cannot fail. So every rung is named on stdout with its elapsed
 * time, and `graceful` is reported ONLY when the QMP command was accepted AND
 * the process was then observed to exit. A QMP failure is logged loudly, never
 * swallowed.
 *
 * Not on gate. Pure module: no QEMU, no sockets, in the ladder itself — the
 * process is reached only through the injected {@link TeardownDeps}, so
 * `qemu-guest-teardown.test.ts` exercises every rung without a hypervisor.
 *
 * Anchor (Beacon): the ACPI Specification's power-button event, and
 * systemd-logind's `HandlePowerKey=poweroff` default, are what make
 * `system_powerdown` a real shutdown rather than a politer kill — NixOS guests
 * run a full `systemd-shutdown`, which syncs and unmounts.
 */

import { Socket } from "node:net";

/**
 * How long to wait for the guest to finish its own shutdown after
 * `system_powerdown` is accepted.
 *
 * A NixOS shutdown with k3s running is not fast: containerd has to stop every
 * shim, kubelet has to unmount its volumes, and then the filesystems sync. The
 * task brief budgets "at least 120s"; 180s is chosen instead so that a SLOW but
 * correct shutdown is not misreported as a broken one. The cost of being wrong
 * in this direction is CI seconds on a lane already budgeting 4500s for phase 3;
 * the cost of being wrong in the other direction is the crashed disk this module
 * exists to stop manufacturing.
 */
export const GRACEFUL_WAIT_MS = 180_000;

/** After SIGTERM to the emulator. QEMU's own SIGTERM handler is quick. */
export const SIGTERM_WAIT_MS = 15_000;

/** After SIGKILL. The kernel does this; the wait only exists so the log is true. */
export const SIGKILL_WAIT_MS = 5_000;

/** Exit polling interval. */
export const TEARDOWN_POLL_MS = 500;

/** Connect + greeting + two commands. Generous; a live socket answers in ms. */
export const QMP_TIMEOUT_MS = 15_000;

/**
 * Which rung of the ladder actually stopped the process.
 *
 * `graceful` is the ONLY one that means the guest filesystem was synced. The
 * other three all mean the emulator was shot and the guest's page cache went
 * with it — which is a legitimate outcome for a deliberate abort, and a finding
 * worth reading in the log for anything else.
 */
export type TeardownPath = "already-exited" | "graceful" | "sigterm" | "sigkill";

export interface TeardownOutcome {
  readonly path: TeardownPath;
  readonly elapsedMs: number;
  /** False for a deliberate abort (see `graceful` in {@link TeardownOptions}). */
  readonly gracefulAttempted: boolean;
  /**
   * Why the graceful rung did not produce an exit: the QMP transport error, or
   * the guest outlasting {@link GRACEFUL_WAIT_MS}. Absent when graceful worked
   * or was never attempted.
   */
  readonly gracefulFailure?: string;
}

/**
 * The process, reached only through callbacks. This is what keeps the ladder
 * testable: the unit test supplies a fake that "exits" on whichever rung the
 * case under test is about.
 */
export interface TeardownDeps {
  readonly hasExited: () => boolean;
  readonly powerdown: () => Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }>;
  readonly kill: (signal: "SIGTERM" | "SIGKILL") => void;
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => number;
  readonly log: (line: string) => void;
}

export interface TeardownBudget {
  readonly gracefulWaitMs: number;
  readonly sigtermWaitMs: number;
  readonly sigkillWaitMs: number;
  readonly pollMs: number;
}

export const DEFAULT_TEARDOWN_BUDGET: TeardownBudget = {
  gracefulWaitMs: GRACEFUL_WAIT_MS,
  sigtermWaitMs: SIGTERM_WAIT_MS,
  sigkillWaitMs: SIGKILL_WAIT_MS,
  pollMs: TEARDOWN_POLL_MS,
};

export interface TeardownOptions {
  /**
   * When false, skip the graceful rung entirely and go straight to signals.
   *
   * This is for a DELIBERATE mid-work abort: the phase has already failed, the
   * guest has not finished what it was doing, and no later phase will read the
   * disk. Asking such a guest to shut down politely spends up to
   * {@link GRACEFUL_WAIT_MS} of CI time to sync a filesystem nobody will open.
   * The reason is logged either way, so the log never leaves the reader guessing
   * which of the two cases a run was in.
   */
  readonly graceful: boolean;
  /** Phase label, verbatim from the caller, so log lines stay greppable per phase. */
  readonly label: string;
  /** One clause saying why, appended to the log line. */
  readonly reason: string;
}

async function waitForExit(deps: TeardownDeps, budgetMs: number, pollMs: number): Promise<boolean> {
  const deadline = deps.now() + budgetMs;
  for (;;) {
    if (deps.hasExited()) return true;
    if (deps.now() >= deadline) return false;
    await deps.sleep(pollMs);
  }
}

/**
 * Stop the guest, reporting which rung of the ladder did it.
 *
 * Never throws: a teardown that fails loudly is still a teardown, and turning a
 * phase's verdict red because the shutdown was untidy would hide the verdict
 * behind the cleanup.
 */
export async function tearDownGuest(
  deps: TeardownDeps,
  options: TeardownOptions,
  budget: TeardownBudget = DEFAULT_TEARDOWN_BUDGET,
): Promise<TeardownOutcome> {
  const start = deps.now();
  const seconds = (ms: number): string => (ms / 1000).toFixed(1);
  const finish = (path: TeardownPath, gracefulAttempted: boolean, gracefulFailure?: string): TeardownOutcome => {
    const elapsedMs = deps.now() - start;
    deps.log(
      `${options.label}: teardown path=${path} elapsed=${seconds(elapsedMs)}s ` +
        `graceful-attempted=${gracefulAttempted}` +
        (gracefulFailure === undefined ? "" : ` graceful-failure="${gracefulFailure}"`),
    );
    return {
      path,
      elapsedMs,
      gracefulAttempted,
      ...(gracefulFailure === undefined ? {} : { gracefulFailure }),
    };
  };

  if (deps.hasExited()) {
    return finish("already-exited", false);
  }

  let gracefulFailure: string | undefined;
  if (options.graceful) {
    deps.log(`${options.label}: teardown — asking the GUEST to power down via QMP (${options.reason})`);
    const powered = await deps.powerdown();
    if (powered.ok) {
      if (await waitForExit(deps, budget.gracefulWaitMs, budget.pollMs)) {
        return finish("graceful", true);
      }
      gracefulFailure = `guest did not exit within ${seconds(budget.gracefulWaitMs)}s of system_powerdown`;
    } else {
      gracefulFailure = powered.error;
    }
    // Loud, never silent: the whole defect this module fixes was a teardown
    // nobody could read afterwards.
    deps.log(
      `${options.label}: WARNING — graceful guest shutdown did not happen (${gracefulFailure}). ` +
        "Falling back to signals; the guest's page cache WILL be discarded and the disk " +
        "may carry zero-length files on the next boot.",
    );
  } else {
    deps.log(`${options.label}: teardown — killing the emulator without a guest shutdown (${options.reason})`);
  }

  deps.kill("SIGTERM");
  if (await waitForExit(deps, budget.sigtermWaitMs, budget.pollMs)) {
    return finish("sigterm", options.graceful, gracefulFailure);
  }
  deps.kill("SIGKILL");
  await waitForExit(deps, budget.sigkillWaitMs, budget.pollMs);
  return finish("sigkill", options.graceful, gracefulFailure);
}

// ── QMP: the three-message handshake, as a pure state machine ─────────────

/** Where the handshake is. QEMU speaks first (the greeting). */
export type QmpStage = "greeting" | "capabilities" | "powerdown";

export type QmpStep =
  /** Write `payload` to the socket and move to `nextStage`. */
  | { readonly kind: "send"; readonly payload: string; readonly nextStage: QmpStage }
  /** Not for us (an asynchronous event, e.g. SHUTDOWN/POWERDOWN). Keep reading. */
  | { readonly kind: "wait" }
  /** `system_powerdown` was acknowledged. The guest is now shutting itself down. */
  | { readonly kind: "done" }
  | { readonly kind: "error"; readonly error: string };

export const QMP_CAPABILITIES_COMMAND = '{"execute":"qmp_capabilities"}\n';
export const QMP_POWERDOWN_COMMAND = '{"execute":"system_powerdown"}\n';

/**
 * Exported for unit tests. One QMP message in, one action out.
 *
 * QMP interleaves asynchronous EVENTS with command replies on the same socket,
 * so "the next line is my reply" is false and a state machine that assumed it
 * would wedge on the first `POWERDOWN` event. Anything that is neither an
 * `error` nor the reply this stage is waiting for is `wait`.
 */
export function advanceQmpHandshake(stage: QmpStage, message: Record<string, unknown>): QmpStep {
  if ("error" in message) {
    const err = message["error"];
    const desc =
      typeof err === "object" && err !== null && "desc" in err ? String((err as Record<string, unknown>)["desc"]) : JSON.stringify(err);
    return { kind: "error", error: `QMP returned an error at stage ${stage}: ${desc}` };
  }
  switch (stage) {
    case "greeting":
      return "QMP" in message
        ? { kind: "send", payload: QMP_CAPABILITIES_COMMAND, nextStage: "capabilities" }
        : { kind: "wait" };
    case "capabilities":
      return "return" in message
        ? { kind: "send", payload: QMP_POWERDOWN_COMMAND, nextStage: "powerdown" }
        : { kind: "wait" };
    case "powerdown":
      return "return" in message ? { kind: "done" } : { kind: "wait" };
  }
}

/**
 * Exported for unit tests. Split a socket read into complete JSON lines, keeping
 * whatever tail has not been terminated yet. QMP is newline-delimited JSON and a
 * TCP/unix read boundary lands wherever it likes.
 */
export function drainJsonLines(buffer: string): {
  readonly messages: readonly Record<string, unknown>[];
  readonly rest: string;
  readonly undecodable: readonly string[];
} {
  const messages: Record<string, unknown>[] = [];
  const undecodable: string[] = [];
  let rest = buffer;
  for (;;) {
    const nl = rest.indexOf("\n");
    if (nl < 0) break;
    const line = rest.slice(0, nl).trim();
    rest = rest.slice(nl + 1);
    if (line.length === 0) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed === "object" && parsed !== null) {
        messages.push(parsed as Record<string, unknown>);
      } else {
        undecodable.push(line);
      }
    } catch {
      // Reported, not swallowed: the caller logs these. A QMP socket that starts
      // emitting non-JSON is a finding, not noise to drop.
      undecodable.push(line);
    }
  }
  return { messages, rest, undecodable };
}

/**
 * QEMU's own flag for the socket this module talks to. `server=on,wait=off` so
 * QEMU creates the socket and boots immediately rather than blocking for a
 * client that only shows up at teardown time.
 */
export function qmpSocketArgs(socketPath: string): readonly string[] {
  return ["-qmp", `unix:${socketPath},server=on,wait=off`];
}

/**
 * Connect to a live QMP socket and ask the guest to power down.
 *
 * Returns ok only when QEMU ACKNOWLEDGED `system_powerdown`. That acknowledgement
 * means the ACPI power-button event was injected — it does NOT mean the guest
 * has finished, or even started, shutting down. Observing the exit is the
 * caller's job (see {@link tearDownGuest}), and keeping those two facts separate
 * is what stops "the command was accepted" from being reported as "the disk was
 * synced".
 */
export function qmpSystemPowerdown(
  socketPath: string,
  timeoutMs: number = QMP_TIMEOUT_MS,
  log: (line: string) => void = () => {},
): Promise<{ readonly ok: true } | { readonly ok: false; readonly error: string }> {
  return new Promise((resolvePromise) => {
    let settled = false;
    let stage: QmpStage = "greeting";
    let buffer = "";
    let socket: Socket | undefined;

    const timer = setTimeout(() => {
      finish({ ok: false, error: `QMP handshake timed out after ${timeoutMs}ms at stage ${stage} (${socketPath})` });
    }, timeoutMs);
    // Never hold the process open on account of the teardown's own timer.
    timer.unref?.();

    function finish(result: { readonly ok: true } | { readonly ok: false; readonly error: string }): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket?.destroy();
      } catch {
        // Closing a socket we are done with must never turn a teardown into a throw.
      }
      resolvePromise(result);
    }

    // HANDLERS BEFORE CONNECT, deliberately. `Socket#connect` can emit `error`
    // SYNCHRONOUSLY — a missing unix socket path does exactly that under Bun —
    // so the `connect(path)` one-liner loses the errno to an unhandled 'error'
    // event and leaves the caller with the much vaguer close-path message. The
    // first draft of this file did that, and the falsifier below ("returns a
    // NAMED error for a socket path that does not exist") is what caught it.
    const sock = new Socket();
    socket = sock;
    sock.setEncoding("utf8");

    // `close` always follows `error`, and on its own it cannot say WHY. Keep the
    // errno so the close handler reports the real cause rather than "closed".
    let socketError: string | undefined;
    sock.on("error", (err: Error) => {
      socketError = `QMP socket error on ${socketPath}: ${err.message}`;
      finish({ ok: false, error: socketError });
    });
    sock.on("close", () => {
      finish({
        ok: false,
        error:
          socketError ??
          `QMP socket closed at stage ${stage} before system_powerdown was acknowledged (${socketPath})`,
      });
    });
    sock.on("data", (chunk: string) => {
      buffer += chunk;
      const drained = drainJsonLines(buffer);
      buffer = drained.rest;
      for (const line of drained.undecodable) {
        log(`QMP: ignoring undecodable line from ${socketPath}: ${line.slice(0, 200)}`);
      }
      for (const message of drained.messages) {
        const step = advanceQmpHandshake(stage, message);
        if (step.kind === "wait") continue;
        if (step.kind === "error") {
          finish({ ok: false, error: step.error });
          return;
        }
        if (step.kind === "done") {
          finish({ ok: true });
          return;
        }
        stage = step.nextStage;
        sock.write(step.payload);
      }
    });
    sock.connect(socketPath);
  });
}
