import {
  createBrowserSequenceCounter,
  createNativeBrowserLifecyclePort,
  startBrowserLifecycleHost,
  type BrowserDocumentVisibility,
  type BrowserLifecycleHost,
  type BrowserLifecycleHostOptions,
  type BrowserReadoutSinkResult,
} from "../browser-node/browser-lifecycle-host";
import type { BrowserTabState } from "../browser-node/browser-node";
import {
  injectedBrowserTabChannelSelection,
  selectNativeBrowserTabChannel,
  type BrowserTabChannelSelection,
  type BrowserTabTransportReadout,
} from "../browser-node/browser-tab-channel-selector";
import type { BrowserTabChannel, BrowserTabCoordinatorReadout } from "../browser-node/browser-tab-coordinator";
import { emptyCrossRunReader, type CrossRunReader } from "../chip9/chip8-cross-run-store";
import { createDarkHallBrowserTabSink, createNativeDarkHallRoomMount } from "./darkhall-browser-tab-sink";
import type { DarkHallDatabaseReadout } from "./darkhall-database-readout";
import type { RoomRunTranscript } from "./darkhall-room";

export const DARK_HALL_BROWSER_BOOTSTRAP_SCHEMA = "zeta.darkhall.browser-bootstrap.v1" as const;

export interface DarkHallBrowserBootstrapFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "lifecycle-start-failed"
    | "visibility-start-failed"
    | "sequence-start-failed"
    | "mount-start-failed"
    | "channel-start-failed"
    | "host-start-failed";
  readonly detail: string;
  readonly cleanup: readonly string[];
}

export type DarkHallBrowserBootstrapResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: DarkHallBrowserBootstrapFeedback };

export interface DarkHallBrowserBootstrapOptions extends Omit<BrowserLifecycleHostOptions, "initialState"> {
  readonly channelName: string;
  readonly channel?: BrowserTabChannel;
  readonly transcript: RoomRunTranscript;
  readonly mount: unknown;
  readonly root?: unknown;
  readonly onTabReadout?: (readout: BrowserTabCoordinatorReadout) => BrowserReadoutSinkResult<null>;
  readonly crossRunReader?: CrossRunReader;
}

export interface DarkHallBrowserRuntime {
  readonly schema: typeof DARK_HALL_BROWSER_BOOTSTRAP_SCHEMA;
  readonly channelName: string;
  readonly transport: BrowserTabTransportReadout;
  readonly host: BrowserLifecycleHost;
  readonly crossRunReader: CrossRunReader;
  updateTranscript(transcript: RoomRunTranscript): BrowserReadoutSinkResult<null>;
  updateDatabaseReadout(readout: DarkHallDatabaseReadout): BrowserReadoutSinkResult<null>;
}

function succeeded<T>(value: T): DarkHallBrowserBootstrapResult<T> {
  return { ok: true, value };
}

function failed(
  code: DarkHallBrowserBootstrapFeedback["code"],
  detail: string,
  severity: DarkHallBrowserBootstrapFeedback["severity"] = "heat",
  cleanup: readonly string[] = [],
): DarkHallBrowserBootstrapResult<never> {
  return { ok: false, feedback: { severity, code, detail, cleanup } };
}

function initialState(visibility: BrowserDocumentVisibility): BrowserTabState {
  if (visibility === "visible") return "foreground";
  if (visibility === "hidden") return "background";
  return "suspended";
}

/** Compose the native browser edges while keeping identity, order, and policy explicit. */
export function startNativeDarkHallBrowser(
  options: DarkHallBrowserBootstrapOptions,
): DarkHallBrowserBootstrapResult<DarkHallBrowserRuntime> {
  const {
    root: suppliedRoot,
    mount: mountValue,
    channelName,
    channel: suppliedChannel,
    transcript,
    onTabReadout,
    crossRunReader = emptyCrossRunReader,
    ...hostOptions
  } = options;
  const root = suppliedRoot === undefined ? globalThis : suppliedRoot;

  const lifecycle = createNativeBrowserLifecyclePort(root);
  if (!lifecycle.ok) {
    return failed(
      "lifecycle-start-failed",
      `${lifecycle.feedback.code}: ${lifecycle.feedback.detail}`,
      lifecycle.feedback.severity,
    );
  }

  const visibility = lifecycle.value.visibility();
  if (!visibility.ok) {
    return failed(
      "visibility-start-failed",
      `${visibility.feedback.code}: ${visibility.feedback.detail}`,
      visibility.feedback.severity,
    );
  }

  const sequence = createBrowserSequenceCounter(hostOptions.initialSequence);
  if (!sequence.ok) {
    return failed(
      "sequence-start-failed",
      `${sequence.feedback.code}: ${sequence.feedback.detail}`,
      sequence.feedback.severity,
    );
  }

  const mount = createNativeDarkHallRoomMount(mountValue);
  if (!mount.ok) return failed("mount-start-failed", mount.detail);

  const selection =
    suppliedChannel === undefined
      ? selectNativeBrowserTabChannel(root, channelName)
      : succeeded(injectedBrowserTabChannelSelection(suppliedChannel));
  if (!selection.ok)
    return failed(
      "channel-start-failed",
      `${selection.feedback.code}: ${selection.feedback.detail}`,
      selection.feedback.severity,
    );
  const channel: BrowserTabChannelSelection = selection.value;

  const sink = createDarkHallBrowserTabSink(transcript, mount.value, channel.readout);
  const observedSink =
    onTabReadout === undefined
      ? sink
      : {
          write: (readout: BrowserTabCoordinatorReadout) => {
            const rendered = sink.write(readout);
            return rendered.ok ? onTabReadout(readout) : rendered;
          },
        };
  const host = startBrowserLifecycleHost(
    { ...hostOptions, initialState: initialState(visibility.value) },
    channel.channel,
    lifecycle.value,
    sequence.value,
    observedSink,
  );
  if (!host.ok) {
    const cleanup = channel.channel.close();
    return failed(
      "host-start-failed",
      `${host.feedback.code}: ${host.feedback.detail}`,
      host.feedback.severity,
      cleanup.ok ? [] : [`${cleanup.feedback.code}: ${cleanup.feedback.detail}`],
    );
  }

  return succeeded({
    schema: DARK_HALL_BROWSER_BOOTSTRAP_SCHEMA,
    channelName,
    transport: channel.readout,
    host: host.value,
    crossRunReader,
    updateTranscript: (nextTranscript) => sink.updateTranscript(nextTranscript),
    updateDatabaseReadout: (readout) => sink.updateDatabaseReadout(readout),
  });
}
