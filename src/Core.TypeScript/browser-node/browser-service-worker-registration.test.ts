import { describe, expect, test } from "bun:test";
import {
  BROWSER_SERVICE_WORKER_REGISTRATION_SCHEMA,
  prepareNativeServiceWorkerControl,
} from "./browser-service-worker-registration";

type NativeListener = () => void;

class NativeServiceWorkerContainer {
  controller: unknown = { postMessage: (): void => undefined };
  ready: Promise<unknown> = Promise.resolve({ active: true });
  readonly registrations: { readonly scriptUrl: string; readonly options: unknown }[] = [];
  readonly listeners = new Set<NativeListener>();
  rejectRegistration = false;
  rejectReady = false;
  rejectSubscription = false;

  async register(scriptUrl: string, options: unknown): Promise<unknown> {
    this.registrations.push({ scriptUrl, options });
    if (this.rejectRegistration) throw new Error("registration refused");
    if (this.rejectReady) this.ready = Promise.reject(new Error("ready refused"));
    return { active: true };
  }

  addEventListener(_type: "controllerchange", listener: NativeListener): void {
    if (this.rejectSubscription) throw new Error("subscription refused");
    this.listeners.add(listener);
  }

  removeEventListener(_type: "controllerchange", listener: NativeListener): void {
    this.listeners.delete(listener);
  }

  claim(controller: unknown = { postMessage: (): void => undefined }): void {
    this.controller = controller;
    for (const listener of [...this.listeners]) listener();
  }
}

describe("native service-worker registration", () => {
  test("registers a module worker and reports an existing controller", async () => {
    const container = new NativeServiceWorkerContainer();
    const result = await prepareNativeServiceWorkerControl(
      { navigator: { serviceWorker: container } },
      { scriptUrl: "./sw.js", scope: "./" },
    );

    expect(result).toEqual({
      ok: true,
      value: {
        schema: BROWSER_SERVICE_WORKER_REGISTRATION_SCHEMA,
        scriptUrl: "./sw.js",
        scope: "./",
        status: "controlled",
      },
    });
    expect(container.registrations).toEqual([{ scriptUrl: "./sw.js", options: { type: "module", scope: "./" } }]);
  });

  test("waits for controllerchange before reporting controlled", async () => {
    const container = new NativeServiceWorkerContainer();
    container.controller = null;
    let settled = false;
    const pending = prepareNativeServiceWorkerControl(
      { navigator: { serviceWorker: container } },
      { scriptUrl: "./sw.js" },
    ).then((result) => {
      settled = true;
      return result;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(container.listeners.size).toBe(1);

    container.claim();
    await expect(pending).resolves.toMatchObject({ ok: true, value: { status: "controlled" } });
    expect(container.listeners.size).toBe(0);
  });

  test("returns typed fallback evidence when registration is unavailable or refused", async () => {
    await expect(prepareNativeServiceWorkerControl({}, { scriptUrl: "./sw.js" })).resolves.toMatchObject({
      ok: true,
      value: {
        status: "fallback",
        feedback: { code: "service-worker-registration-unavailable", severity: "backpressure" },
      },
    });

    const container = new NativeServiceWorkerContainer();
    container.controller = null;
    container.rejectRegistration = true;
    await expect(
      prepareNativeServiceWorkerControl({ navigator: { serviceWorker: container } }, { scriptUrl: "./sw.js" }),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        status: "fallback",
        feedback: { code: "service-worker-registration-failed", severity: "heat" },
      },
    });
  });

  test("does not accept a null ready value as a service-worker container", async () => {
    const container = new NativeServiceWorkerContainer();
    (container as unknown as { ready: unknown }).ready = null;

    await expect(
      prepareNativeServiceWorkerControl({ navigator: { serviceWorker: container } }, { scriptUrl: "./sw.js" }),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        status: "fallback",
        feedback: { code: "service-worker-registration-unavailable", severity: "backpressure" },
      },
    });
    expect(container.registrations).toHaveLength(0);
  });

  test("reports blocked browser and controller getters without throwing", async () => {
    const blockedRoot = Object.defineProperty({}, "navigator", {
      get: () => {
        throw new Error("navigator blocked");
      },
    });
    await expect(prepareNativeServiceWorkerControl(blockedRoot, { scriptUrl: "./sw.js" })).resolves.toMatchObject({
      ok: true,
      value: {
        status: "fallback",
        feedback: { code: "service-worker-registration-blocked", severity: "heat" },
      },
    });

    const container = new NativeServiceWorkerContainer();
    Object.defineProperty(container, "controller", {
      get: () => {
        throw new Error("controller blocked");
      },
    });
    await expect(
      prepareNativeServiceWorkerControl({ navigator: { serviceWorker: container } }, { scriptUrl: "./sw.js" }),
    ).resolves.toMatchObject({
      ok: true,
      value: {
        status: "fallback",
        feedback: { code: "service-worker-registration-blocked", severity: "heat" },
      },
    });
  });

  test("rejects invalid configuration before inspecting the browser", async () => {
    await expect(prepareNativeServiceWorkerControl({}, { scriptUrl: "" })).resolves.toMatchObject({
      ok: false,
      feedback: { code: "service-worker-registration-invalid", severity: "heat" },
    });
  });
});
