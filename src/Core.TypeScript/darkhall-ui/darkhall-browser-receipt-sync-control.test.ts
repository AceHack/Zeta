import { describe, expect, test } from "bun:test";
import type {
  BrowserLifecycleEvent,
  BrowserLifecycleEventType,
  BrowserLifecyclePort,
} from "../browser-node/browser-lifecycle-host";
import type {
  BrowserDatabaseReceiptSyncReadout,
  BrowserDatabaseReceiptSyncRuntime,
} from "../browser-node/browser-database-receipt-sync-runtime";
import type { BrowserDatabaseReceiptPasskeyEnrollmentRuntime } from "../browser-node/browser-database-receipt-passkey-enrollment";
import {
  DARK_HALL_BROWSER_RECEIPT_SYNC_CONTROL_SCHEMA,
  renderDarkHallBrowserReceiptSyncControlHtml,
  startDarkHallBrowserReceiptSyncControl,
} from "./darkhall-browser-receipt-sync-control";

type NativeListener = (event: unknown) => void;

class ControlButton {
  private readonly command: "submit" | "enroll";

  constructor(command: "submit" | "enroll") {
    this.command = command;
  }

  closest(selector: string): ControlButton | null {
    return selector === `[data-receipt-sync-${this.command}]` ? this : null;
  }
}

class ControlMount {
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Set<NativeListener>>();
  readonly output = { textContent: "" };
  readonly enrollmentOutput = { textContent: "" };
  readonly submitButton = new ControlButton("submit");
  readonly enrollButton = new ControlButton("enroll");

  querySelector(selector: string): unknown {
    if (selector === "[data-receipt-sync-readout]") return this.output;
    return selector === "[data-receipt-sync-enrollment]" ? this.enrollmentOutput : null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: NativeListener): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: NativeListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  click(command: "submit" | "enroll" = "submit"): void {
    const target = command === "submit" ? this.submitButton : this.enrollButton;
    for (const listener of this.listeners.get("click") ?? []) {
      listener({ button: 0, target, preventDefault: () => undefined });
    }
  }
}

function lifecycle(): {
  readonly port: BrowserLifecyclePort;
  readonly emit: (eventType: BrowserLifecycleEventType) => void;
  readonly setVisibility: (value: "visible" | "hidden") => void;
} {
  let visibility: "visible" | "hidden" = "visible";
  const listeners = new Map<BrowserLifecycleEventType, Set<(event: BrowserLifecycleEvent) => void>>();
  return {
    port: {
      visibility: () => ({ ok: true, value: visibility }),
      subscribe: (eventType, listener) => {
        const entries = listeners.get(eventType) ?? new Set();
        entries.add(listener);
        listeners.set(eventType, entries);
        return {
          ok: true,
          value: {
            unsubscribe: () => {
              entries.delete(listener);
              return { ok: true, value: null };
            },
          },
        };
      },
    },
    emit: (eventType) => {
      for (const listener of listeners.get(eventType) ?? []) listener({ persisted: false });
    },
    setVisibility: (value) => {
      visibility = value;
    },
  };
}

function syncRuntime(): {
  readonly runtime: BrowserDatabaseReceiptSyncRuntime;
  readonly calls: { submissions: number; polls: number };
} {
  const calls = { submissions: 0, polls: 0 };
  let readout: BrowserDatabaseReceiptSyncReadout = {
    schema: "zeta.browser-database-receipt-sync-readout.v1",
    status: "idle",
    databaseNodeId: "db",
    archiveNodeId: "archive",
    receiptCount: 0,
    highWaterSequence: null,
    contentHash: null,
    proposal: null,
    handoff: null,
    feedback: null,
  };
  return {
    calls,
    runtime: {
      read: () => ({ ...readout }),
      submitFromUserActivation: () => {
        calls.submissions += 1;
        readout = { ...readout, status: "presented", receiptCount: 3 };
        return Promise.resolve({ ok: true, value: { ...readout } });
      },
      pollAcceptance: () => {
        calls.polls += 1;
        readout = { ...readout, status: "pending" };
        return Promise.resolve({ ok: true, value: { ...readout } });
      },
    },
  };
}

function enrollmentRuntime(): {
  readonly runtime: BrowserDatabaseReceiptPasskeyEnrollmentRuntime;
  readonly calls: { count: number };
} {
  const calls = { count: 0 };
  return {
    calls,
    runtime: {
      enrollFromUserActivation: () => {
        calls.count += 1;
        return Promise.resolve({
          ok: true,
          value: {
            schema: "zeta.proposal-passkey-enrollment.v1",
            repository: "Lucent-Financial-Group/Zeta",
            credentialId: "credential-a",
            challenge: "challenge-a",
            clientDataJSON: "client-data-a",
            attestationObject: "attestation-a",
            origin: "https://lucent-financial-group.github.io",
            rpId: "lucent-financial-group.github.io",
            createdAt: "2026-08-14T12:20:00.000Z",
          },
        });
      },
    },
  };
}

async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("Dark Hall browser receipt synchronization control", () => {
  test("routes clicks only to explicit submission and lifecycle events only to polling", async () => {
    const mount = new ControlMount();
    const life = lifecycle();
    const sync = syncRuntime();
    const started = startDarkHallBrowserReceiptSyncControl({
      mount,
      lifecycle: life.port,
      synchronization: sync.runtime,
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    mount.click();
    await settle();
    expect(sync.calls).toEqual({ submissions: 1, polls: 0 });
    expect(started.value.read().last).toEqual({
      operation: "submit",
      trigger: "user-activation",
      outcome: "complete",
      feedbackCode: null,
    });

    life.emit("visibilitychange");
    await settle();
    life.emit("pageshow");
    await settle();
    expect(sync.calls).toEqual({ submissions: 1, polls: 2 });
    expect(started.value.read().last?.operation).toBe("poll");
    expect(started.value.read().last?.trigger).toBe("pageshow");
  });

  test("routes passkey enrollment only from its explicit command and exposes the public package", async () => {
    const mount = new ControlMount();
    const life = lifecycle();
    const sync = syncRuntime();
    const enrollment = enrollmentRuntime();
    const started = startDarkHallBrowserReceiptSyncControl({
      mount,
      lifecycle: life.port,
      synchronization: sync.runtime,
      enrollment: enrollment.runtime,
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    mount.click("enroll");
    await settle();

    expect(enrollment.calls.count).toBe(1);
    expect(sync.calls).toEqual({ submissions: 0, polls: 0 });
    expect(started.value.read()).toMatchObject({
      enrollments: 1,
      last: { operation: "enroll", trigger: "user-activation", outcome: "complete" },
      enrollment: { credentialId: "credential-a" },
    });
    expect(mount.attributes.get("data-receipt-sync-enrollment-status")).toBe("exported");
    expect(mount.enrollmentOutput.textContent).toContain('"credentialId": "credential-a"');
  });

  test("skips polling while hidden without spending submission authority", async () => {
    const mount = new ControlMount();
    const life = lifecycle();
    const sync = syncRuntime();
    const started = startDarkHallBrowserReceiptSyncControl({
      mount,
      lifecycle: life.port,
      synchronization: sync.runtime,
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    life.setVisibility("hidden");
    life.emit("visibilitychange");
    await settle();
    expect(sync.calls).toEqual({ submissions: 0, polls: 0 });
    expect(started.value.read().last).toMatchObject({ operation: "poll", outcome: "skipped" });
  });

  test("renders stable CSS readout attributes and removes listeners on stop", async () => {
    const mount = new ControlMount();
    const life = lifecycle();
    const sync = syncRuntime();
    const started = startDarkHallBrowserReceiptSyncControl({
      mount,
      lifecycle: life.port,
      synchronization: sync.runtime,
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;

    await started.value.pollAcceptance("startup");
    expect(started.value.read()).toMatchObject({
      schema: DARK_HALL_BROWSER_RECEIPT_SYNC_CONTROL_SCHEMA,
      status: "live",
      polls: 1,
      synchronization: { status: "pending" },
    });
    expect(mount.attributes.get("data-receipt-sync-status")).toBe("pending");
    expect(mount.attributes.get("data-receipt-sync-trigger")).toBe("startup");
    expect(mount.output.textContent).toBe("pending | 0 receipts");

    expect(started.value.stop()).toMatchObject({ ok: true, value: { status: "stopped" } });
    mount.click();
    life.emit("pageshow");
    await settle();
    expect(sync.calls).toEqual({ submissions: 0, polls: 1 });
  });

  test("renders the explicit command without script-owned credentials", () => {
    const html = renderDarkHallBrowserReceiptSyncControlHtml();
    expect(html).toContain('data-receipt-sync-control="zeta.darkhall.browser-receipt-sync-control.v1"');
    expect(html).toContain("data-receipt-sync-submit");
    expect(html).not.toContain("token");
    expect(html).not.toContain("credential");
  });
});
