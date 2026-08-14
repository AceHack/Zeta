import type { BrowserLifecyclePort, BrowserLifecycleSubscription } from "../browser-node/browser-lifecycle-host";
import type {
  BrowserDatabaseReceiptSyncReadout,
  BrowserDatabaseReceiptSyncRuntime,
} from "../browser-node/browser-database-receipt-sync-runtime";
import type { BrowserDatabaseReceiptPasskeyEnrollmentRuntime } from "../browser-node/browser-database-receipt-passkey-enrollment";
import type { ProposalPasskeyEnrollment } from "../planning/proposal-contract";

export const DARK_HALL_BROWSER_RECEIPT_SYNC_CONTROL_SCHEMA = "zeta.darkhall.browser-receipt-sync-control.v1" as const;
export const DARK_HALL_BROWSER_RECEIPT_SYNC_CONTROL_MOUNT_ID = "darkhall-receipt-sync" as const;

export type DarkHallBrowserReceiptSyncTrigger =
  | "user-activation"
  | "startup"
  | "visibilitychange"
  | "pageshow"
  | "manual";

export interface DarkHallBrowserReceiptSyncInteraction {
  readonly operation: "submit" | "poll" | "enroll";
  readonly trigger: DarkHallBrowserReceiptSyncTrigger;
  readonly outcome: "complete" | "skipped" | "backpressured" | "heat";
  readonly feedbackCode: string | null;
}

export interface DarkHallBrowserReceiptSyncControlReadout {
  readonly schema: typeof DARK_HALL_BROWSER_RECEIPT_SYNC_CONTROL_SCHEMA;
  readonly status: "live" | "stopped";
  readonly active: "submit" | "poll" | "enroll" | null;
  readonly submissions: number;
  readonly polls: number;
  readonly enrollments: number;
  readonly enrollment: ProposalPasskeyEnrollment | null;
  readonly synchronization: BrowserDatabaseReceiptSyncReadout;
  readonly last: DarkHallBrowserReceiptSyncInteraction | null;
}

export interface DarkHallBrowserReceiptSyncControlFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "receipt-sync-control-configuration-invalid"
    | "receipt-sync-control-listener-failed"
    | "receipt-sync-control-observer-failed"
    | "receipt-sync-control-lifecycle-failed"
    | "receipt-sync-control-operation-failed"
    | "receipt-sync-control-busy"
    | "receipt-sync-control-stopped";
  readonly detail: string;
}

export type DarkHallBrowserReceiptSyncControlResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: DarkHallBrowserReceiptSyncControlFeedback };

export interface DarkHallBrowserReceiptSyncControlOptions {
  readonly mount: unknown;
  readonly lifecycle: BrowserLifecyclePort;
  readonly synchronization: BrowserDatabaseReceiptSyncRuntime;
  readonly enrollment?: BrowserDatabaseReceiptPasskeyEnrollmentRuntime;
}

export interface DarkHallBrowserReceiptSyncControlRuntime {
  read(): DarkHallBrowserReceiptSyncControlReadout;
  submitFromUserActivation(): Promise<
    DarkHallBrowserReceiptSyncControlResult<DarkHallBrowserReceiptSyncControlReadout>
  >;
  enrollFromUserActivation(): Promise<
    DarkHallBrowserReceiptSyncControlResult<DarkHallBrowserReceiptSyncControlReadout>
  >;
  pollAcceptance(
    trigger?: Exclude<DarkHallBrowserReceiptSyncTrigger, "user-activation">,
  ): Promise<DarkHallBrowserReceiptSyncControlResult<DarkHallBrowserReceiptSyncControlReadout>>;
  stop(): DarkHallBrowserReceiptSyncControlResult<DarkHallBrowserReceiptSyncControlReadout>;
}

type NativeListener = (event: unknown) => void;

interface NativeControlMount {
  readonly value: unknown;
  readonly query: (...arguments_: readonly unknown[]) => unknown;
  readonly add: (...arguments_: readonly unknown[]) => unknown;
  readonly remove: (...arguments_: readonly unknown[]) => unknown;
  readonly setAttribute: (...arguments_: readonly unknown[]) => unknown;
}

function succeeded<T>(value: T): DarkHallBrowserReceiptSyncControlResult<T> {
  return { ok: true, value };
}

function failed(
  code: DarkHallBrowserReceiptSyncControlFeedback["code"],
  detail: string,
  severity: DarkHallBrowserReceiptSyncControlFeedback["severity"] = "heat",
): DarkHallBrowserReceiptSyncControlResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function member(value: unknown, name: string): unknown {
  if (!isRecord(value)) return undefined;
  try {
    return Reflect.get(value, name);
  } catch {
    return undefined;
  }
}

function method(value: unknown, name: string): ((...arguments_: readonly unknown[]) => unknown) | null {
  const candidate = member(value, name);
  return typeof candidate === "function" ? (candidate as (...arguments_: readonly unknown[]) => unknown) : null;
}

function nativeControlMount(value: unknown): NativeControlMount | null {
  const query = method(value, "querySelector");
  const add = method(value, "addEventListener");
  const remove = method(value, "removeEventListener");
  const setAttribute = method(value, "setAttribute");
  return query === null || add === null || remove === null || setAttribute === null
    ? null
    : { value, query, add, remove, setAttribute };
}

function hasMethods(value: unknown, names: readonly string[]): boolean {
  return isRecord(value) && names.every((name) => method(value, name) !== null);
}

function setText(value: unknown, text: string): boolean {
  if (!isRecord(value)) return false;
  try {
    return Reflect.set(value, "textContent", text);
  } catch {
    return false;
  }
}

function commandGesture(event: unknown): "submit" | "enroll" | null {
  const button = member(event, "button");
  if (typeof button === "number" && button !== 0) return null;
  const target = member(event, "target");
  const closest = method(target, "closest");
  if (closest === null) return null;
  try {
    if (Reflect.apply(closest, target, ["[data-receipt-sync-submit]"]) !== null) return "submit";
    return Reflect.apply(closest, target, ["[data-receipt-sync-enroll]"]) !== null ? "enroll" : null;
  } catch {
    return null;
  }
}

function preventDefault(event: unknown): void {
  const prevent = method(event, "preventDefault");
  if (prevent === null) return;
  try {
    Reflect.apply(prevent, event, []);
  } catch {
    // Submission remains observable even if the host refuses preventDefault.
  }
}

function outcome(readout: BrowserDatabaseReceiptSyncReadout): DarkHallBrowserReceiptSyncInteraction["outcome"] {
  if (readout.status === "backpressured") return "backpressured";
  if (readout.status === "heat") return "heat";
  return "complete";
}

export function renderDarkHallBrowserReceiptSyncControlHtml(): string {
  return [
    `<section id="${DARK_HALL_BROWSER_RECEIPT_SYNC_CONTROL_MOUNT_ID}" class="zeta-receipt-sync"`,
    ` data-receipt-sync-control="${DARK_HALL_BROWSER_RECEIPT_SYNC_CONTROL_SCHEMA}"`,
    ' data-receipt-sync-control-status="unavailable" data-receipt-sync-status="idle"',
    ' aria-labelledby="zeta-receipt-sync-title">',
    '<header class="zeta-receipt-sync-header">',
    '<h2 id="zeta-receipt-sync-title">Receipt sync</h2>',
    '<output class="zeta-receipt-sync-status" data-receipt-sync-readout aria-live="polite">idle | 0 receipts</output>',
    "</header>",
    '<button type="button" class="zeta-receipt-sync-enroll" data-receipt-sync-enroll>Enroll passkey</button>',
    '<button type="button" class="zeta-receipt-sync-submit" data-receipt-sync-submit>Publish receipts</button>',
    '<textarea class="zeta-receipt-sync-enrollment" data-receipt-sync-enrollment aria-label="Public enrollment package" readonly></textarea>',
    "</section>",
  ].join("");
}

/** Keep user-authorized submission separate from lifecycle-driven acceptance polling. */
export function startDarkHallBrowserReceiptSyncControl(
  options: DarkHallBrowserReceiptSyncControlOptions,
): DarkHallBrowserReceiptSyncControlResult<DarkHallBrowserReceiptSyncControlRuntime> {
  const mount = nativeControlMount(options.mount);
  if (
    mount === null ||
    !hasMethods(options.lifecycle, ["visibility", "subscribe"]) ||
    !hasMethods(options.synchronization, ["read", "submitFromUserActivation", "pollAcceptance"])
  ) {
    return failed(
      "receipt-sync-control-configuration-invalid",
      "Receipt synchronization control requires a browser mount, lifecycle port, and synchronization port.",
    );
  }
  let output: unknown;
  try {
    output = Reflect.apply(mount.query, mount.value, ["[data-receipt-sync-readout]"]);
  } catch {
    output = null;
  }
  if (!isRecord(output)) {
    return failed(
      "receipt-sync-control-configuration-invalid",
      "The receipt synchronization control is missing its readout output.",
    );
  }
  let enrollmentOutput: unknown = null;
  if (options.enrollment !== undefined) {
    try {
      enrollmentOutput = Reflect.apply(mount.query, mount.value, ["[data-receipt-sync-enrollment]"]);
    } catch {
      enrollmentOutput = null;
    }
    if (!isRecord(enrollmentOutput) || !hasMethods(options.enrollment, ["enrollFromUserActivation"])) {
      return failed(
        "receipt-sync-control-configuration-invalid",
        "The receipt synchronization control is missing its passkey enrollment output or enrollment port.",
      );
    }
  }

  let stopped = false;
  let active: "submit" | "poll" | "enroll" | null = null;
  let submissions = 0;
  let polls = 0;
  let enrollments = 0;
  let enrollment: ProposalPasskeyEnrollment | null = null;
  let synchronization: BrowserDatabaseReceiptSyncReadout;
  try {
    synchronization = options.synchronization.read();
  } catch {
    return failed(
      "receipt-sync-control-configuration-invalid",
      "The receipt synchronization port threw while publishing its initial readout.",
    );
  }
  let last: DarkHallBrowserReceiptSyncInteraction | null = null;
  const subscriptions: BrowserLifecycleSubscription[] = [];

  const read = (): DarkHallBrowserReceiptSyncControlReadout => ({
    schema: DARK_HALL_BROWSER_RECEIPT_SYNC_CONTROL_SCHEMA,
    status: stopped ? "stopped" : "live",
    active,
    submissions,
    polls,
    enrollments,
    enrollment: enrollment === null ? null : { ...enrollment },
    synchronization,
    last,
  });

  const publish = (): DarkHallBrowserReceiptSyncControlResult<DarkHallBrowserReceiptSyncControlReadout> => {
    const readout = read();
    const attributes: readonly (readonly [string, string])[] = [
      ["data-receipt-sync-control-status", readout.status],
      ["data-receipt-sync-active", readout.active ?? "none"],
      ["data-receipt-sync-status", readout.synchronization.status],
      ["data-receipt-sync-receipts", readout.synchronization.receiptCount.toString()],
      ["data-receipt-sync-submissions", readout.submissions.toString()],
      ["data-receipt-sync-polls", readout.polls.toString()],
      ["data-receipt-sync-enrollments", readout.enrollments.toString()],
      [
        "data-receipt-sync-enrollment-status",
        options.enrollment === undefined ? "unavailable" : enrollment === null ? "ready" : "exported",
      ],
      ["data-receipt-sync-trigger", readout.last?.trigger ?? "none"],
      ["data-receipt-sync-outcome", readout.last?.outcome ?? "none"],
      ["data-receipt-sync-feedback", readout.last?.feedbackCode ?? "none"],
    ];
    try {
      for (const [name, value] of attributes) Reflect.apply(mount.setAttribute, mount.value, [name, value]);
      const text = `${readout.synchronization.status} | ${readout.synchronization.receiptCount.toString()} receipts`;
      if (!setText(output, text)) {
        return failed(
          "receipt-sync-control-observer-failed",
          "The browser refused the receipt synchronization text readout.",
        );
      }
      if (
        enrollmentOutput !== null &&
        !setText(enrollmentOutput, enrollment === null ? "" : `${JSON.stringify(enrollment, null, 2)}\n`)
      ) {
        return failed(
          "receipt-sync-control-observer-failed",
          "The browser refused the public enrollment package readout.",
        );
      }
      return succeeded(readout);
    } catch {
      return failed(
        "receipt-sync-control-observer-failed",
        "The browser refused a receipt synchronization readout attribute.",
      );
    }
  };

  const recordFailure = (
    operation: "submit" | "poll" | "enroll",
    trigger: DarkHallBrowserReceiptSyncTrigger,
    feedbackCode: string,
    severity: "backpressure" | "heat",
  ): DarkHallBrowserReceiptSyncControlResult<never> => {
    let observedCode = feedbackCode;
    let observedSeverity = severity;
    try {
      synchronization = options.synchronization.read();
    } catch {
      observedCode = "receipt-sync-control-read-threw";
      observedSeverity = "heat";
    }
    last = {
      operation,
      trigger,
      outcome: observedSeverity === "backpressure" ? "backpressured" : "heat",
      feedbackCode: observedCode,
    };
    const rendered = publish();
    return rendered.ok ? failed("receipt-sync-control-operation-failed", observedCode, observedSeverity) : rendered;
  };

  const operate = async (
    operation: "submit" | "poll",
    trigger: DarkHallBrowserReceiptSyncTrigger,
  ): Promise<DarkHallBrowserReceiptSyncControlResult<DarkHallBrowserReceiptSyncControlReadout>> => {
    if (stopped) return failed("receipt-sync-control-stopped", "The receipt synchronization control has stopped.");
    if (active !== null) {
      return recordFailure(operation, trigger, "receipt-sync-control-busy", "backpressure");
    }
    active = operation;
    const started = publish();
    if (!started.ok) {
      active = null;
      return started;
    }
    let result;
    try {
      result =
        operation === "submit"
          ? await options.synchronization.submitFromUserActivation()
          : await options.synchronization.pollAcceptance();
    } catch {
      active = null;
      return recordFailure(operation, trigger, "receipt-sync-control-operation-threw", "heat");
    }
    active = null;
    if (operation === "submit") submissions += 1;
    else polls += 1;
    try {
      synchronization = options.synchronization.read();
    } catch {
      last = {
        operation,
        trigger,
        outcome: "heat",
        feedbackCode: "receipt-sync-control-read-threw",
      };
      const rendered = publish();
      return rendered.ok
        ? failed(
            "receipt-sync-control-operation-failed",
            "The receipt synchronization port threw while publishing its operation readout.",
          )
        : rendered;
    }
    last = {
      operation,
      trigger,
      outcome: outcome(synchronization),
      feedbackCode: result.ok ? null : result.feedback.code,
    };
    const rendered = publish();
    if (!rendered.ok) return rendered;
    return result.ok
      ? rendered
      : failed(
          "receipt-sync-control-operation-failed",
          `${result.feedback.code}: ${result.feedback.detail}`,
          result.feedback.severity,
        );
  };

  const enroll = async (): Promise<
    DarkHallBrowserReceiptSyncControlResult<DarkHallBrowserReceiptSyncControlReadout>
  > => {
    if (stopped) return failed("receipt-sync-control-stopped", "The receipt synchronization control has stopped.");
    const enrollmentRuntime = options.enrollment;
    if (enrollmentRuntime === undefined) {
      return recordFailure("enroll", "user-activation", "receipt-passkey-enrollment-unavailable", "backpressure");
    }
    if (active !== null) return recordFailure("enroll", "user-activation", "receipt-sync-control-busy", "backpressure");
    active = "enroll";
    const started = publish();
    if (!started.ok) {
      active = null;
      return started;
    }
    let result;
    try {
      result = await enrollmentRuntime.enrollFromUserActivation();
    } catch {
      active = null;
      return recordFailure("enroll", "user-activation", "receipt-passkey-enrollment-threw", "heat");
    }
    active = null;
    if (!result.ok) {
      return recordFailure("enroll", "user-activation", result.feedback.code, result.feedback.severity);
    }
    enrollment = result.value;
    enrollments += 1;
    last = { operation: "enroll", trigger: "user-activation", outcome: "complete", feedbackCode: null };
    return publish();
  };

  const pollIfVisible = async (
    trigger: Exclude<DarkHallBrowserReceiptSyncTrigger, "user-activation">,
  ): Promise<DarkHallBrowserReceiptSyncControlResult<DarkHallBrowserReceiptSyncControlReadout>> => {
    let visibility: ReturnType<BrowserLifecyclePort["visibility"]>;
    try {
      visibility = options.lifecycle.visibility();
    } catch {
      return recordFailure("poll", trigger, "receipt-sync-control-visibility-threw", "heat");
    }
    if (!visibility.ok) {
      return recordFailure("poll", trigger, visibility.feedback.code, visibility.feedback.severity);
    }
    if (visibility.value !== "visible") {
      last = { operation: "poll", trigger, outcome: "skipped", feedbackCode: null };
      return publish();
    }
    return operate("poll", trigger);
  };

  const clicked: NativeListener = (event) => {
    const command = commandGesture(event);
    if (command === null) return;
    preventDefault(event);
    if (command === "submit") void operate("submit", "user-activation");
    else void enroll();
  };
  const visibilityChanged = (): void => {
    void pollIfVisible("visibilitychange");
  };
  const pageShown = (): void => {
    void pollIfVisible("pageshow");
  };

  try {
    Reflect.apply(mount.add, mount.value, ["click", clicked]);
  } catch {
    return failed("receipt-sync-control-listener-failed", "The browser refused the receipt submission listener.");
  }
  for (const [eventType, listener] of [
    ["visibilitychange", visibilityChanged],
    ["pageshow", pageShown],
  ] as const) {
    let subscribed: ReturnType<BrowserLifecyclePort["subscribe"]>;
    try {
      subscribed = options.lifecycle.subscribe(eventType, listener);
    } catch {
      subscribed = {
        ok: false as const,
        feedback: {
          severity: "heat" as const,
          code: "lifecycle-subscribe-failed" as const,
          detail: `The lifecycle port threw while subscribing to ${eventType}.`,
        },
      };
    }
    if (!subscribed.ok) {
      try {
        Reflect.apply(mount.remove, mount.value, ["click", clicked]);
      } catch {
        // The subscription failure remains the primary signal.
      }
      for (const subscription of subscriptions) {
        try {
          subscription.unsubscribe();
        } catch {
          // The subscription failure remains the primary signal.
        }
      }
      return failed(
        "receipt-sync-control-lifecycle-failed",
        `${subscribed.feedback.code}: ${subscribed.feedback.detail}`,
        subscribed.feedback.severity,
      );
    }
    subscriptions.push(subscribed.value);
  }

  const runtime: DarkHallBrowserReceiptSyncControlRuntime = {
    read,
    submitFromUserActivation: () => operate("submit", "user-activation"),
    enrollFromUserActivation: enroll,
    pollAcceptance: (trigger = "manual") => pollIfVisible(trigger),
    stop: () => {
      if (stopped) return succeeded(read());
      if (active !== null) {
        return failed(
          "receipt-sync-control-busy",
          `Receipt synchronization cannot stop while ${active} is active.`,
          "backpressure",
        );
      }
      try {
        Reflect.apply(mount.remove, mount.value, ["click", clicked]);
      } catch {
        return failed("receipt-sync-control-listener-failed", "The browser refused receipt listener cleanup.");
      }
      for (const subscription of subscriptions) {
        let unsubscribed: ReturnType<BrowserLifecycleSubscription["unsubscribe"]>;
        try {
          unsubscribed = subscription.unsubscribe();
        } catch {
          return failed(
            "receipt-sync-control-lifecycle-failed",
            "The lifecycle port threw while removing a receipt synchronization listener.",
          );
        }
        if (!unsubscribed.ok) {
          return failed(
            "receipt-sync-control-lifecycle-failed",
            `${unsubscribed.feedback.code}: ${unsubscribed.feedback.detail}`,
            unsubscribed.feedback.severity,
          );
        }
      }
      stopped = true;
      return publish();
    },
  };
  const initial = publish();
  if (!initial.ok) {
    runtime.stop();
    return initial;
  }
  return succeeded(runtime);
}
