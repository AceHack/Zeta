import { describe, expect, test } from "bun:test";
import type { BrowserExecutionAdmissionPort } from "./browser-execution-admission";
import { createNativeBrowserExecutionAdmission } from "./browser-web-lock-execution-admission";

interface TestLock {
  readonly name: string;
  readonly mode: "exclusive";
}

interface TestLockOptions {
  readonly ifAvailable: boolean;
  readonly mode: "exclusive";
}

type TestLockCallback<T> = (lock: TestLock | null) => Promise<T>;

class ContendedLockManager {
  held = false;
  readonly requests: { readonly name: string; readonly options: TestLockOptions }[] = [];

  async request<T>(name: string, options: TestLockOptions, callback: TestLockCallback<T>): Promise<T> {
    this.requests.push({ name, options });
    if (this.held && options.ifAvailable) return callback(null);

    this.held = true;
    try {
      return await callback({ name, mode: "exclusive" });
    } finally {
      this.held = false;
    }
  }
}

function unwrap(root: unknown): BrowserExecutionAdmissionPort {
  const selected = createNativeBrowserExecutionAdmission(root);
  expect(selected.ok).toBe(true);
  if (!selected.ok) throw new Error(selected.feedback.detail);
  return selected.value;
}

describe("native browser execution admission", () => {
  test("reports unavailable and blocked Web Locks as typed feedback", () => {
    expect(createNativeBrowserExecutionAdmission({ navigator: {} })).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "execution-admission-unavailable" },
    });

    const blocked = Object.defineProperty({}, "navigator", {
      get(): never {
        throw new Error("blocked");
      },
    });
    expect(createNativeBrowserExecutionAdmission(blocked)).toMatchObject({
      ok: false,
      feedback: { severity: "heat", code: "execution-admission-blocked" },
    });
  });

  test("requests a nonblocking exclusive lock with a stable resource name", async () => {
    const locks = new ContendedLockManager();
    const port = unwrap({ navigator: { locks } });

    expect(await port.tryRun("database/browser-global", () => Promise.resolve(7))).toEqual({
      ok: true,
      value: {
        schema: "zeta.browser-execution-admission.v1",
        resourceId: "database/browser-global",
        status: "admitted",
        value: 7,
      },
    });
    expect(locks.requests).toEqual([
      {
        name: "zeta:database/browser-global",
        options: { ifAvailable: true, mode: "exclusive" },
      },
    ]);
  });

  test("backpressures a competitor without running it and admits the next operation after release", async () => {
    const locks = new ContendedLockManager();
    const port = unwrap({ navigator: { locks } });
    let release: (() => void) | undefined;
    let competitorRan = false;
    const held = port.tryRun("database/browser-global", async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return "first";
    });
    for (let attempt = 0; attempt < 100 && !locks.held; attempt += 1) await Promise.resolve();

    expect(
      await port.tryRun("database/browser-global", () => {
        competitorRan = true;
        return Promise.resolve("second");
      }),
    ).toEqual({
      ok: true,
      value: {
        schema: "zeta.browser-execution-admission.v1",
        resourceId: "database/browser-global",
        status: "busy",
      },
    });
    expect(competitorRan).toBe(false);

    release?.();
    expect(await held).toMatchObject({ ok: true, value: { status: "admitted", value: "first" } });
    expect(await port.tryRun("database/browser-global", () => Promise.resolve("third"))).toMatchObject({
      ok: true,
      value: { status: "admitted", value: "third" },
    });
  });

  test("releases after rejected work and rejects malformed lock evidence", async () => {
    const locks = new ContendedLockManager();
    const port = unwrap({ navigator: { locks } });

    expect(
      await port.tryRun("database/browser-global", () => Promise.reject(new Error("executor failed"))),
    ).toMatchObject({ ok: false, feedback: { code: "execution-admission-request-failed" } });
    expect(await port.tryRun("database/browser-global", () => Promise.resolve("recovered"))).toMatchObject({
      ok: true,
      value: { status: "admitted", value: "recovered" },
    });

    const malformed = unwrap({
      navigator: {
        locks: {
          request: (_name: string, _options: TestLockOptions, callback: TestLockCallback<string>) =>
            callback({ name: "wrong", mode: "exclusive" }),
        },
      },
    });
    expect(await malformed.tryRun("database/browser-global", () => Promise.resolve("never"))).toMatchObject({
      ok: false,
      feedback: { code: "execution-admission-invalid" },
    });
  });

  test("rejects invalid resource identifiers without touching the browser", async () => {
    const locks = new ContendedLockManager();
    const port = unwrap({ navigator: { locks } });

    expect(await port.tryRun("", () => Promise.resolve(null))).toMatchObject({
      ok: false,
      feedback: { code: "execution-admission-configuration-invalid" },
    });
    expect(locks.requests).toEqual([]);
  });
});
