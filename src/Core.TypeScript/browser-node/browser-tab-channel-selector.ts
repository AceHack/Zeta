import { createNativeBroadcastTabChannel } from "./browser-broadcast-channel";
import { createNativeServiceWorkerTabChannel } from "./browser-service-worker-channel";
import type {
  BrowserTabChannel,
  BrowserTabCoordinatorFeedback,
  BrowserTabOperationResult,
} from "./browser-tab-coordinator";

export const BROWSER_TAB_TRANSPORT_READOUT_SCHEMA = "zeta.browser-tab-transport.v1" as const;

export type BrowserTabTransportKind = "service-worker" | "broadcast-channel" | "injected";

export interface BrowserTabTransportAttempt {
  readonly kind: BrowserTabTransportKind;
  readonly status: "selected" | "refused";
  readonly feedback?: BrowserTabCoordinatorFeedback;
}

export interface BrowserTabTransportReadout {
  readonly schema: typeof BROWSER_TAB_TRANSPORT_READOUT_SCHEMA;
  readonly selected: BrowserTabTransportKind;
  readonly attempts: readonly BrowserTabTransportAttempt[];
}

export interface BrowserTabChannelSelection {
  readonly channel: BrowserTabChannel;
  readonly readout: BrowserTabTransportReadout;
}

export interface BrowserTabTransportSelectionFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code: "browser-tab-transport-unavailable";
  readonly detail: string;
  readonly attempts: readonly BrowserTabTransportAttempt[];
}

export type BrowserTabTransportSelectionResult =
  | { readonly ok: true; readonly value: BrowserTabChannelSelection }
  | { readonly ok: false; readonly feedback: BrowserTabTransportSelectionFeedback };

function selected(
  channel: BrowserTabChannel,
  kind: BrowserTabTransportKind,
  attempts: readonly BrowserTabTransportAttempt[],
): BrowserTabTransportSelectionResult {
  return {
    ok: true,
    value: {
      channel,
      readout: {
        schema: BROWSER_TAB_TRANSPORT_READOUT_SCHEMA,
        selected: kind,
        attempts: [...attempts, { kind, status: "selected" }],
      },
    },
  };
}

function refused(
  kind: BrowserTabTransportKind,
  result: Extract<BrowserTabOperationResult<BrowserTabChannel>, { readonly ok: false }>,
): BrowserTabTransportAttempt {
  return { kind, status: "refused", feedback: result.feedback };
}

export function injectedBrowserTabChannelSelection(channel: BrowserTabChannel): BrowserTabChannelSelection {
  return {
    channel,
    readout: {
      schema: BROWSER_TAB_TRANSPORT_READOUT_SCHEMA,
      selected: "injected",
      attempts: [{ kind: "injected", status: "selected" }],
    },
  };
}

/** Prefer an already controlling worker; use BroadcastChannel as the explicit fallback. */
export function selectNativeBrowserTabChannel(root: unknown, channelName: string): BrowserTabTransportSelectionResult {
  const worker = createNativeServiceWorkerTabChannel(root);
  if (worker.ok) return selected(worker.value, "service-worker", []);

  const workerAttempt = refused("service-worker", worker);
  const broadcast = createNativeBroadcastTabChannel(root, channelName);
  if (broadcast.ok) return selected(broadcast.value, "broadcast-channel", [workerAttempt]);

  const attempts = [workerAttempt, refused("broadcast-channel", broadcast)] as const;
  const severity = attempts.some((attempt) => attempt.feedback?.severity === "heat") ? "heat" : "backpressure";
  return {
    ok: false,
    feedback: {
      severity,
      code: "browser-tab-transport-unavailable",
      detail: attempts.map((attempt) => `${attempt.kind}: ${attempt.feedback?.code ?? "unknown refusal"}`).join("; "),
      attempts,
    },
  };
}
