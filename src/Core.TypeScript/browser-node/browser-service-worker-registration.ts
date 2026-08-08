export const BROWSER_SERVICE_WORKER_REGISTRATION_SCHEMA = "zeta.browser-service-worker-registration.v1" as const;

export interface BrowserServiceWorkerRegistrationFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "service-worker-registration-invalid"
    | "service-worker-registration-unavailable"
    | "service-worker-registration-blocked"
    | "service-worker-registration-failed"
    | "service-worker-ready-failed"
    | "service-worker-controller-subscribe-failed";
  readonly detail: string;
}

export interface BrowserServiceWorkerRegistrationReadout {
  readonly schema: typeof BROWSER_SERVICE_WORKER_REGISTRATION_SCHEMA;
  readonly scriptUrl: string;
  readonly scope?: string;
  readonly status: "controlled" | "fallback";
  readonly feedback?: BrowserServiceWorkerRegistrationFeedback;
}

export type BrowserServiceWorkerRegistrationResult =
  | { readonly ok: true; readonly value: BrowserServiceWorkerRegistrationReadout }
  | { readonly ok: false; readonly feedback: BrowserServiceWorkerRegistrationFeedback };

interface ControllerChangeEventLike {
  readonly type?: string;
}

interface ServiceWorkerContainerLike {
  readonly controller?: unknown;
  readonly ready: PromiseLike<unknown>;
  register(scriptUrl: string, options: { readonly type: "module"; readonly scope?: string }): PromiseLike<unknown>;
  addEventListener(type: "controllerchange", listener: (event: ControllerChangeEventLike) => void): void;
  removeEventListener(type: "controllerchange", listener: (event: ControllerChangeEventLike) => void): void;
}

type ServiceWorkerContainerInspection =
  | { readonly ok: true; readonly value: ServiceWorkerContainerLike }
  | { readonly ok: false; readonly status: "unavailable" | "blocked" };

type ControllerInspection = { readonly ok: true; readonly present: boolean } | { readonly ok: false };

export interface NativeServiceWorkerRegistrationOptions {
  readonly scriptUrl: string;
  readonly scope?: string;
}

function failed(
  code: BrowserServiceWorkerRegistrationFeedback["code"],
  detail: string,
  severity: BrowserServiceWorkerRegistrationFeedback["severity"] = "heat",
): BrowserServiceWorkerRegistrationResult {
  return { ok: false, feedback: { severity, code, detail } };
}

function fallback(
  options: NativeServiceWorkerRegistrationOptions,
  feedback: BrowserServiceWorkerRegistrationFeedback,
): BrowserServiceWorkerRegistrationResult {
  const base = {
    schema: BROWSER_SERVICE_WORKER_REGISTRATION_SCHEMA,
    scriptUrl: options.scriptUrl,
    status: "fallback" as const,
    feedback,
  };
  return {
    ok: true,
    value: options.scope === undefined ? base : { ...base, scope: options.scope },
  };
}

function controlled(options: NativeServiceWorkerRegistrationOptions): BrowserServiceWorkerRegistrationResult {
  const base = {
    schema: BROWSER_SERVICE_WORKER_REGISTRATION_SCHEMA,
    scriptUrl: options.scriptUrl,
    status: "controlled" as const,
  };
  return {
    ok: true,
    value: options.scope === undefined ? base : { ...base, scope: options.scope },
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function serviceWorkerContainer(root: unknown): ServiceWorkerContainerInspection {
  if (!isRecord(root)) return { ok: false, status: "unavailable" };
  try {
    const navigatorValue = Reflect.get(root, "navigator");
    if (!isRecord(navigatorValue)) return { ok: false, status: "unavailable" };
    const container = Reflect.get(navigatorValue, "serviceWorker");
    if (!isRecord(container)) return { ok: false, status: "unavailable" };
    if (
      typeof Reflect.get(container, "register") !== "function" ||
      typeof Reflect.get(container, "addEventListener") !== "function" ||
      typeof Reflect.get(container, "removeEventListener") !== "function"
    ) {
      return { ok: false, status: "unavailable" };
    }
    const ready = Reflect.get(container, "ready");
    if (!isRecord(ready) || typeof Reflect.get(ready, "then") !== "function") {
      return { ok: false, status: "unavailable" };
    }
    return { ok: true, value: container as unknown as ServiceWorkerContainerLike };
  } catch {
    return { ok: false, status: "blocked" };
  }
}

function controllerPresent(container: ServiceWorkerContainerLike): ControllerInspection {
  try {
    const controller = container.controller;
    return { ok: true, present: controller !== null && controller !== undefined };
  } catch {
    return { ok: false };
  }
}

function registrationOptions(options: NativeServiceWorkerRegistrationOptions): {
  readonly type: "module";
  readonly scope?: string;
} {
  return options.scope === undefined ? { type: "module" } : { type: "module", scope: options.scope };
}

async function waitForController(
  container: ServiceWorkerContainerLike,
): Promise<"controlled" | "subscription-failed" | "inspection-blocked"> {
  const initial = controllerPresent(container);
  if (!initial.ok) return "inspection-blocked";
  if (initial.present) return "controlled";

  return await new Promise<"controlled" | "subscription-failed" | "inspection-blocked">((resolve) => {
    let listening = false;
    const stop = (): void => {
      if (!listening) return;
      try {
        container.removeEventListener("controllerchange", changed);
      } catch {
        // The control edge is already established; cleanup failure does not revoke it.
      }
      listening = false;
    };
    const changed = (): void => {
      const current = controllerPresent(container);
      if (!current.ok) {
        stop();
        resolve("inspection-blocked");
        return;
      }
      if (!current.present) return;
      stop();
      resolve("controlled");
    };
    try {
      container.addEventListener("controllerchange", changed);
      listening = true;
      changed();
    } catch {
      stop();
      resolve("subscription-failed");
    }
  });
}

/** Register a module worker and do not return controlled until it owns the current page. */
export async function prepareNativeServiceWorkerControl(
  root: unknown,
  options: NativeServiceWorkerRegistrationOptions,
): Promise<BrowserServiceWorkerRegistrationResult> {
  if (options.scriptUrl.length === 0 || (options.scope !== undefined && options.scope.length === 0)) {
    return failed(
      "service-worker-registration-invalid",
      "The service-worker script URL and optional scope must be non-empty strings.",
    );
  }

  const inspected = serviceWorkerContainer(root);
  if (!inspected.ok) {
    const blocked = inspected.status === "blocked";
    return fallback(options, {
      severity: blocked ? "heat" : "backpressure",
      code: blocked ? "service-worker-registration-blocked" : "service-worker-registration-unavailable",
      detail: blocked
        ? "The browser blocked inspection of its service-worker registration container."
        : "This runtime does not expose a service-worker registration container.",
    });
  }
  const container = inspected.value;

  try {
    await container.register(options.scriptUrl, registrationOptions(options));
  } catch {
    return fallback(options, {
      severity: "heat",
      code: "service-worker-registration-failed",
      detail: "The browser refused to register the module service worker.",
    });
  }

  try {
    await container.ready;
  } catch {
    return fallback(options, {
      severity: "heat",
      code: "service-worker-ready-failed",
      detail: "The registered service worker did not reach ready state.",
    });
  }

  const ownership = await waitForController(container);
  if (ownership === "controlled") return controlled(options);
  return fallback(options, {
    severity: "heat",
    code:
      ownership === "inspection-blocked"
        ? "service-worker-registration-blocked"
        : "service-worker-controller-subscribe-failed",
    detail:
      ownership === "inspection-blocked"
        ? "The browser blocked inspection of the active service-worker controller."
        : "The browser refused the controller-change subscription required before room startup.",
  });
}
