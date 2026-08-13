import { probeBrowserRuntime, type BrowserRuntimeProbeReadout } from "../browser-node/browser-runtime-probe";
import { ContentHash256 } from "../blake3/blake3";
import type { BrowserLifecycleHostReadout, BrowserReadoutSinkResult } from "../browser-node/browser-lifecycle-host";
import type { BrowserServiceWorkerRegistrationReadout } from "../browser-node/browser-service-worker-registration";
import type { BrowserTabTransportReadout } from "../browser-node/browser-tab-channel-selector";
import type {
  BrowserDatabaseExecutionReceiptNotice,
  BrowserDatabaseInvalidation,
  BrowserTabCoordinatorReadout,
} from "../browser-node/browser-tab-coordinator";
import type { BrowserExecutionAdmissionPort } from "../browser-node/browser-execution-admission";
import type {
  BrowserDatabaseIntentLimits,
  BrowserDatabaseIntentOutboxPort,
  BrowserDatabaseIntentReadout,
} from "../browser-node/browser-database-intent-outbox";
import {
  createZetaDbBrowserDatabaseReceiptArchive,
  type BrowserDatabaseReceiptArchiveExecutor,
  type BrowserDatabaseReceiptArchivePort,
} from "../browser-node/browser-database-receipt-archive";
import {
  createBrowserDatabaseReceiptHandoffRuntime,
  createZetaDbBrowserDatabaseReceiptArchiveMaintenance,
  createZetaDbBrowserDatabaseReceiptHandoff,
  type BrowserDatabaseReceiptHandoffLimits,
  type BrowserDatabaseReceiptHandoffReadout,
  type BrowserDatabaseReceiptHandoffRuntime,
} from "../browser-node/browser-database-receipt-handoff";
import {
  createNativeBrowserDatabaseReceiptBroadcastPeerLink,
  type BrowserDatabaseReceiptBroadcastPeerLinkLimits,
  type BrowserDatabaseReceiptBroadcastPeerLinkReadout,
  type BrowserDatabaseReceiptBroadcastPeerLinkRuntime,
} from "../browser-node/browser-database-receipt-broadcast-peer-link";
import { openNativeIndexedDbDatabaseIntentOutbox } from "../browser-node/browser-indexeddb-database-intent-outbox";
import { createNativeBrowserExecutionAdmission } from "../browser-node/browser-web-lock-execution-admission";
import {
  loadBrowserZetaDbImage,
  runBrowserZetaDbWake,
  saveBrowserZetaDbImage,
} from "../browser-node/browser-zetadb-image-port";
import {
  startBrowserZetaDbTabRuntime,
  type BrowserZetaDbTabExecutor,
  type BrowserZetaDbTabRuntime,
} from "../browser-node/browser-zetadb-tab-runtime";
import type { ZetaDbTickLimits } from "../zetadb/zeta-db-node";
import {
  startNativeDarkHallPwa,
  type DarkHallBrowserPwaOptions,
  type DarkHallBrowserPwaRuntime,
} from "./darkhall-browser-pwa";
import {
  selectDarkHallDatabaseRow,
  zetaDbTickToDarkHallDatabaseReadout,
  type DarkHallDatabaseReadout,
} from "./darkhall-database-readout";
import {
  DARK_HALL_BROWSER_DATABASE_ACTIONS,
  startDarkHallBrowserDatabaseController,
  type DarkHallBrowserDatabaseCommand,
  type DarkHallBrowserDatabaseControllerReadout,
  type DarkHallBrowserDatabaseControllerResult,
  type DarkHallBrowserDatabaseControllerRuntime,
} from "./darkhall-browser-database-controller";
import {
  startDarkHallBrowserControllerInput,
  type DarkHallBrowserControllerCommandResolver,
  type DarkHallBrowserControllerInputReadout,
  type DarkHallBrowserControllerInputResult,
  type DarkHallBrowserControllerInputRuntime,
  type DarkHallBrowserControllerInputSource,
} from "./darkhall-browser-controller-input";
import {
  DARK_HALL_BROWSER_ROW_COMMAND_EDITOR_MOUNT_ID,
  renderDarkHallBrowserRowCommandEditorHtml,
  startDarkHallBrowserRowCommandEditor,
  type DarkHallBrowserRowCommandEditorReadout,
  type DarkHallBrowserRowCommandEditorRuntime,
} from "./darkhall-browser-row-command-editor";
import {
  startDarkHallBrowserDatabaseRowSelection,
  type DarkHallBrowserDatabaseRowSelectionReadout,
  type DarkHallBrowserDatabaseRowSelectionResult,
  type DarkHallBrowserDatabaseRowSelectionRuntime,
} from "./darkhall-browser-database-row-selection";
import { renderDarkHallRoomHtml, type RoomRunTranscript } from "./darkhall-room";

export const DARK_HALL_BROWSER_PAGE_SCHEMA = "zeta.darkhall.browser-page.v9" as const;
export const DARK_HALL_BROWSER_PAGE_GLOBAL = "__zetaDarkHallPage" as const;
export const DARK_HALL_BROWSER_PAGE_MOUNT_ID = "darkhall-room" as const;

export type DarkHallBrowserPageStatus = "starting" | "live" | "stopped";

export interface DarkHallBrowserPageFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "page-root-invalid"
    | "page-document-unavailable"
    | "page-mount-unavailable"
    | "page-location-unavailable"
    | "page-identity-unavailable"
    | "page-configuration-invalid"
    | "page-status-update-failed"
    | "page-start-failed"
    | "page-database-start-failed"
    | "page-database-hydration-failed"
    | "page-database-stop-failed"
    | "page-database-receipt-peer-stop-failed"
    | "page-editor-start-failed"
    | "page-editor-stop-failed"
    | "page-selection-start-failed"
    | "page-selection-stop-failed"
    | "page-input-start-failed"
    | "page-input-stop-failed"
    | "page-controller-stop-failed"
    | "page-stop-failed";
  readonly detail: string;
}

export type DarkHallBrowserPageResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: DarkHallBrowserPageFeedback };

export interface DarkHallBrowserPageReadout {
  readonly schema: typeof DARK_HALL_BROWSER_PAGE_SCHEMA;
  readonly status: DarkHallBrowserPageStatus;
  readonly nodeId: string;
  readonly tabId: string;
  readonly runtime: BrowserRuntimeProbeReadout;
  readonly registration: BrowserServiceWorkerRegistrationReadout;
  readonly transport: BrowserTabTransportReadout;
  readonly host: BrowserLifecycleHostReadout;
  readonly database: DarkHallDatabaseReadout;
  readonly receiptHandoff: BrowserDatabaseReceiptHandoffReadout | null;
  readonly receiptPeer: BrowserDatabaseReceiptBroadcastPeerLinkReadout | null;
  readonly controller: DarkHallBrowserDatabaseControllerReadout | null;
  readonly editor: DarkHallBrowserRowCommandEditorReadout;
  readonly selection: DarkHallBrowserDatabaseRowSelectionReadout;
  readonly input: DarkHallBrowserControllerInputReadout;
}

export interface DarkHallBrowserPageRuntime {
  read(): DarkHallBrowserPageReadout;
  dispatchController(
    command: DarkHallBrowserDatabaseCommand,
  ): Promise<DarkHallBrowserDatabaseControllerResult<DarkHallBrowserDatabaseControllerReadout>>;
  dispatchControllerInput(
    cell: number,
    source: DarkHallBrowserControllerInputSource,
  ): Promise<DarkHallBrowserControllerInputResult<DarkHallBrowserControllerInputReadout>>;
  selectDatabaseRow(
    rowKey: string,
    source: DarkHallBrowserControllerInputSource,
  ): DarkHallBrowserDatabaseRowSelectionResult<DarkHallBrowserDatabaseRowSelectionReadout>;
  stop(): DarkHallBrowserPageResult<DarkHallBrowserPageReadout>;
}

export interface NativeDarkHallBrowserPageOptions {
  readonly root?: unknown;
  readonly mountId?: string;
  readonly transcript?: RoomRunTranscript;
  readonly nodeId?: string;
  readonly channelName?: string;
  readonly serviceWorkerScriptUrl?: string;
  readonly serviceWorkerScope?: string;
  readonly maxTrackedTabs?: number;
  readonly maxFeedback?: number;
  readonly databaseNodeId?: string;
  readonly databaseName?: string;
  readonly databaseStoreName?: string;
  readonly databaseLimits?: ZetaDbTickLimits;
  readonly databaseExecutionAdmission?: BrowserExecutionAdmissionPort;
  readonly databaseIntentOutbox?: BrowserDatabaseIntentOutboxPort;
  readonly databaseIntentDatabaseName?: string;
  readonly databaseIntentStoreName?: string;
  readonly databaseIntentLimits?: BrowserDatabaseIntentLimits;
  readonly databaseReceiptArchive?: BrowserDatabaseReceiptArchivePort;
  readonly databaseReceiptArchiveNodeId?: string;
  readonly databaseReceiptArchiveLimits?: ZetaDbTickLimits;
  readonly databaseReceiptArchiveExecutor?: BrowserDatabaseReceiptArchiveExecutor;
  readonly databaseReceiptHandoff?: BrowserDatabaseReceiptHandoffRuntime;
  readonly databaseReceiptHandoffTargetNodeId?: string;
  readonly databaseReceiptHandoffLimits?: BrowserDatabaseReceiptHandoffLimits;
  readonly databaseReceiptHandoffTargetLimits?: ZetaDbTickLimits;
  readonly databaseReceiptHandoffTargetExecutor?: BrowserDatabaseReceiptArchiveExecutor;
  readonly databaseReceiptPeerId?: string;
  readonly databaseReceiptPeerChannelName?: string;
  readonly databaseReceiptPeerInitialSequence?: number;
  readonly databaseReceiptPeerLimits?: BrowserDatabaseReceiptBroadcastPeerLinkLimits;
  readonly databaseExecutor?: BrowserZetaDbTabExecutor;
  readonly maxControllerInputInFlight?: number;
  readonly rowCommandEditorMountId?: string;
  readonly maxRowCommandPayloadBytes?: number;
  readonly controllerCommandResolver?: DarkHallBrowserControllerCommandResolver;
}

interface NativePageMount {
  readonly value: unknown;
  setStatus(status: DarkHallBrowserPageStatus | "backpressured" | "heat", detail?: string): boolean;
  setAttribute(name: string, value: string): boolean;
}

interface NativePageContext {
  readonly mount: NativePageMount;
  readonly document: unknown;
  readonly parameters: URLSearchParams;
  readonly mintTabId: () => string | null;
}

interface PagePeerDarkRecovery {
  readonly onTabReadout: (readout: BrowserTabCoordinatorReadout) => BrowserReadoutSinkResult<null>;
  readonly install: (database: BrowserZetaDbTabRuntime) => void;
}

export const DARK_HALL_BROWSER_PAGE_TRANSCRIPT: RoomRunTranscript = {
  schema: "zeta.darkhall.room-ui.v1",
  roomName: "dark hall browser node",
  seed: "browser-page-v9",
  generatedBy: "darkhall-browser-page",
  controller: DARK_HALL_BROWSER_DATABASE_ACTIONS.map((action) => ({
    cell: action.cell,
    label: action.label,
    actionId: action.actionId,
    actionClass: action.actionClass,
    selected: action.kind === "inspect",
  })),
  ticks: [
    {
      tick: 0,
      phase: "observe",
      event: "await browser lifecycle evidence",
      outcome: "ok",
    },
  ],
  heatRows: [],
};

function succeeded<T>(value: T): DarkHallBrowserPageResult<T> {
  return { ok: true, value };
}

function failed(
  code: DarkHallBrowserPageFeedback["code"],
  detail: string,
  severity: DarkHallBrowserPageFeedback["severity"] = "heat",
): DarkHallBrowserPageResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function method(value: unknown, name: string): ((...arguments_: readonly unknown[]) => unknown) | null {
  if (!isRecord(value)) return null;
  try {
    const candidate = Reflect.get(value, name);
    return typeof candidate === "function" ? (candidate as (...arguments_: readonly unknown[]) => unknown) : null;
  } catch {
    return null;
  }
}

function nativePageContext(root: unknown, mountId: string): DarkHallBrowserPageResult<NativePageContext> {
  if (!isRecord(root)) return failed("page-root-invalid", "The active browser page requires an object-like host.");

  let documentValue: unknown;
  let locationValue: unknown;
  let cryptoValue: unknown;
  try {
    documentValue = Reflect.get(root, "document");
    locationValue = Reflect.get(root, "location");
    cryptoValue = Reflect.get(root, "crypto");
  } catch {
    return failed("page-root-invalid", "The browser blocked inspection of the active page host.");
  }

  const getElementById = method(documentValue, "getElementById");
  if (getElementById === null) {
    return failed("page-document-unavailable", "The active browser page does not expose document.getElementById.");
  }

  let mountValue: unknown;
  try {
    mountValue = Reflect.apply(getElementById, documentValue, [mountId]);
  } catch {
    return failed("page-document-unavailable", "The browser threw while locating the active room mount.");
  }
  const setAttribute = method(mountValue, "setAttribute");
  const removeAttribute = method(mountValue, "removeAttribute");
  if (
    !isRecord(mountValue) ||
    !Reflect.has(mountValue, "innerHTML") ||
    setAttribute === null ||
    removeAttribute === null
  ) {
    return failed("page-mount-unavailable", `The active browser page is missing mount #${mountId}.`);
  }

  let search: unknown;
  try {
    search = isRecord(locationValue) ? Reflect.get(locationValue, "search") : undefined;
  } catch {
    return failed("page-location-unavailable", "The browser blocked inspection of the active page URL.");
  }
  if (typeof search !== "string") {
    return failed("page-location-unavailable", "The active browser page does not expose a URL query string.");
  }

  const randomUuid = method(cryptoValue, "randomUUID");
  const mount: NativePageMount = {
    value: mountValue,
    setAttribute: (name, value) => {
      try {
        Reflect.apply(setAttribute, mountValue, [name, value]);
        return true;
      } catch {
        return false;
      }
    },
    setStatus: (status, detail) => {
      try {
        Reflect.apply(setAttribute, mountValue, ["data-pwa-status", status]);
        if (detail === undefined) Reflect.apply(removeAttribute, mountValue, ["data-pwa-detail"]);
        else Reflect.apply(setAttribute, mountValue, ["data-pwa-detail", detail]);
        return true;
      } catch {
        return false;
      }
    },
  };

  return succeeded({
    mount,
    document: documentValue,
    parameters: new URLSearchParams(search),
    mintTabId: () => {
      if (randomUuid === null) return null;
      try {
        const value = Reflect.apply(randomUuid, cryptoValue, []);
        return typeof value === "string" && value.length > 0 ? `tab-${value}` : null;
      } catch {
        return null;
      }
    },
  });
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint < 32 || codePoint === 127)) return true;
  }
  return false;
}

function identifier(value: string | null, fallback: string): DarkHallBrowserPageResult<string> {
  const selected = value ?? fallback;
  if (selected.length === 0 || selected.length > 256 || hasControlCharacter(selected)) {
    return failed("page-configuration-invalid", "Browser page identifiers must contain 1 to 256 printable characters.");
  }
  return succeeded(selected);
}

function initialSequence(value: string | null): DarkHallBrowserPageResult<number> {
  if (value === null) return succeeded(0);
  const sequence = Number(value);
  return Number.isSafeInteger(sequence) && sequence >= 0
    ? succeeded(sequence)
    : failed("page-configuration-invalid", "The browser page sequence must be a non-negative safe integer.");
}

function pageElement(documentValue: unknown, elementId: string): DarkHallBrowserPageResult<unknown> {
  const getElementById = method(documentValue, "getElementById");
  if (getElementById === null) {
    return failed("page-document-unavailable", "The active browser page does not expose document.getElementById.");
  }
  try {
    const value = Reflect.apply(getElementById, documentValue, [elementId]);
    return value === null || value === undefined
      ? failed("page-editor-start-failed", `The active browser page is missing row command editor #${elementId}.`)
      : succeeded(value);
  } catch {
    return failed("page-editor-start-failed", "The browser threw while locating the row command editor.");
  }
}

function pageStatusFromSeverity(severity: DarkHallBrowserPageFeedback["severity"]): "backpressured" | "heat" {
  return severity === "backpressure" ? "backpressured" : "heat";
}

function inputPageStatus(severity: "cold" | "backpressure" | "heat"): "backpressured" | "heat" {
  return severity === "heat" ? "heat" : "backpressured";
}

function pwaOptions(
  options: NativeDarkHallBrowserPageOptions,
  root: unknown,
  context: NativePageContext,
  runtime: BrowserRuntimeProbeReadout,
  nodeId: string,
  tabId: string,
  sequence: number,
  onDatabaseInvalidated: (invalidation: BrowserDatabaseInvalidation) => void,
  onDatabaseExecutionReceipt: (receipt: BrowserDatabaseExecutionReceiptNotice) => void,
  onTabReadout: (readout: BrowserTabCoordinatorReadout) => BrowserReadoutSinkResult<null>,
): DarkHallBrowserPwaOptions {
  const scope = options.serviceWorkerScope ?? "./";
  return {
    root,
    mount: context.mount.value,
    transcript: options.transcript ?? DARK_HALL_BROWSER_PAGE_TRANSCRIPT,
    channelName: options.channelName ?? "zeta-darkhall-browser-page",
    nodeId,
    tabId,
    initialSequence: sequence,
    maxTrackedTabs: options.maxTrackedTabs ?? 32,
    maxFeedback: options.maxFeedback ?? 32,
    capabilities: runtime.capabilities,
    checkpoint: "none",
    onDatabaseInvalidated,
    onDatabaseExecutionReceipt,
    onTabReadout,
    serviceWorker: {
      scriptUrl: options.serviceWorkerScriptUrl ?? "./sw.js",
      scope,
    },
  };
}

const defaultDatabaseLimits: ZetaDbTickLimits = {
  maxDeltas: 16,
  maxEntries: 64,
  maxCheckpointBytes: 64 * 1024,
};

const defaultDatabaseIntentLimits: BrowserDatabaseIntentLimits = {
  maxIntents: 64,
  maxReceipts: 256,
  maxLedgerBytes: 256 * 1024,
};

const defaultDatabaseReceiptArchiveLimits: ZetaDbTickLimits = {
  maxDeltas: 1,
  maxEntries: 256,
  maxCheckpointBytes: 256 * 1024,
};

const defaultDatabaseReceiptHandoffLimits: BrowserDatabaseReceiptHandoffLimits = {
  minimumReceipts: 64,
  maxReceipts: 256,
  maxBatchBytes: 256 * 1024,
};

const defaultDatabaseReceiptHandoffTargetLimits: ZetaDbTickLimits = {
  maxDeltas: 1,
  maxEntries: 1024,
  maxCheckpointBytes: 16 * 1024 * 1024,
};

const defaultDatabaseReceiptPeerLimits: BrowserDatabaseReceiptBroadcastPeerLinkLimits = {
  handoff: defaultDatabaseReceiptHandoffLimits,
  peer: {
    maxReceipts: 256,
    maxRequestBytes: 512 * 1024,
    maxResponseBytes: 32 * 1024,
  },
  broadcast: {
    maxRequestPayloadBytes: 512 * 1024,
    maxResponsePayloadBytes: 32 * 1024,
    maxInFlight: 1,
  },
};

function selectPageDatabaseAdmission(
  options: NativeDarkHallBrowserPageOptions,
  root: unknown,
  context: NativePageContext,
): DarkHallBrowserPageResult<BrowserExecutionAdmissionPort> {
  if (options.databaseExecutionAdmission !== undefined) return succeeded(options.databaseExecutionAdmission);

  const nativeAdmission = createNativeBrowserExecutionAdmission(root);
  if (nativeAdmission.ok) return succeeded(nativeAdmission.value);
  context.mount.setStatus(pageStatusFromSeverity(nativeAdmission.feedback.severity), "page-database-start-failed");
  return failed(
    "page-database-start-failed",
    `${nativeAdmission.feedback.code}: ${nativeAdmission.feedback.detail}`,
    nativeAdmission.feedback.severity,
  );
}

async function selectPageDatabaseIntentOutbox(
  options: NativeDarkHallBrowserPageOptions,
  root: unknown,
  context: NativePageContext,
): Promise<DarkHallBrowserPageResult<BrowserDatabaseIntentOutboxPort>> {
  if (options.databaseIntentOutbox !== undefined) return succeeded(options.databaseIntentOutbox);

  const native = await openNativeIndexedDbDatabaseIntentOutbox(root, {
    databaseName: options.databaseIntentDatabaseName ?? `${options.databaseName ?? "zeta-browser-node"}-intents`,
    storeName: options.databaseIntentStoreName ?? "database-intents",
    limits: options.databaseIntentLimits ?? defaultDatabaseIntentLimits,
  });
  if (native.ok) return succeeded(native.value);
  context.mount.setStatus(pageStatusFromSeverity(native.feedback.severity), "page-database-start-failed");
  return failed(
    "page-database-start-failed",
    `${native.feedback.code}: ${native.feedback.detail}`,
    native.feedback.severity,
  );
}

function selectPageDatabaseReceiptArchive(
  options: NativeDarkHallBrowserPageOptions,
  configuration: NativePageConfiguration,
): DarkHallBrowserPageResult<BrowserDatabaseReceiptArchivePort> {
  if (options.databaseReceiptArchive !== undefined) return succeeded(options.databaseReceiptArchive);
  const archiveNodeId = identifier(
    options.databaseReceiptArchiveNodeId ?? null,
    `${configuration.databaseNodeId}:receipts`,
  );
  if (!archiveNodeId.ok) return archiveNodeId;
  const archive = createZetaDbBrowserDatabaseReceiptArchive({
    sourceDatabaseNodeId: configuration.databaseNodeId,
    archiveNodeId: archiveNodeId.value,
    executorId: configuration.tabId,
    limits: options.databaseReceiptArchiveLimits ?? defaultDatabaseReceiptArchiveLimits,
    execute:
      options.databaseReceiptArchiveExecutor ??
      ((request) =>
        runBrowserZetaDbWake(
          configuration.root,
          {
            databaseName: options.databaseName ?? "zeta-browser-node",
            storeName: options.databaseStoreName ?? "database-images",
          },
          request,
        )),
  });
  if (archive.ok) return succeeded(archive.value);
  configuration.context.mount.setStatus(
    pageStatusFromSeverity(archive.feedback.severity),
    "page-database-start-failed",
  );
  return failed(
    "page-database-start-failed",
    `${archive.feedback.code}: ${archive.feedback.detail}`,
    archive.feedback.severity,
  );
}

function pageReceiptHandoffFailure(
  configuration: NativePageConfiguration,
  feedback: { readonly severity: "backpressure" | "heat"; readonly code: string; readonly detail: string },
): DarkHallBrowserPageResult<never> {
  configuration.context.mount.setStatus(pageStatusFromSeverity(feedback.severity), "page-database-start-failed");
  return failed("page-database-start-failed", `${feedback.code}: ${feedback.detail}`, feedback.severity);
}

interface PageDatabaseReceiptHandoffSelection {
  readonly runtime: BrowserDatabaseReceiptHandoffRuntime | null;
  readonly peer: BrowserDatabaseReceiptBroadcastPeerLinkRuntime | null;
}

function pageReceiptPeerId(
  options: NativeDarkHallBrowserPageOptions,
  configuration: NativePageConfiguration,
): DarkHallBrowserPageResult<string | null> {
  const selected = configuration.context.parameters.get("receipt-peer") ?? options.databaseReceiptPeerId ?? null;
  if (selected === null) return succeeded(null);
  const peerId = identifier(selected, "");
  if (!peerId.ok) return peerId;
  return peerId.value === configuration.tabId
    ? failed("page-configuration-invalid", "A browser receipt peer must differ from the local tab identity.")
    : succeeded(peerId.value);
}

function pageReceiptPeerInitialSequence(
  options: NativeDarkHallBrowserPageOptions,
  configuration: NativePageConfiguration,
): DarkHallBrowserPageResult<number> {
  const parameter = configuration.context.parameters.get("receipt-sequence");
  if (parameter !== null) return initialSequence(parameter);
  const selected = options.databaseReceiptPeerInitialSequence ?? configuration.sequence;
  return Number.isSafeInteger(selected) && selected >= 0
    ? succeeded(selected)
    : failed("page-configuration-invalid", "The receipt peer sequence must be a non-negative safe integer.");
}

function pageReceiptPeerLimits(
  options: NativeDarkHallBrowserPageOptions,
  configuration: NativePageConfiguration,
): DarkHallBrowserPageResult<BrowserDatabaseReceiptBroadcastPeerLinkLimits> {
  const limits = options.databaseReceiptPeerLimits ?? defaultDatabaseReceiptPeerLimits;
  const parameter = configuration.context.parameters.get("receipt-minimum");
  if (parameter === null) return succeeded(limits);
  const minimumReceipts = Number(parameter);
  if (
    !Number.isSafeInteger(minimumReceipts) ||
    minimumReceipts < 1 ||
    minimumReceipts > limits.handoff.maxReceipts
  ) {
    return failed(
      "page-configuration-invalid",
      "The receipt peer minimum must be a positive safe integer within the handoff receipt budget.",
    );
  }
  return succeeded({
    ...limits,
    handoff: { ...limits.handoff, minimumReceipts },
  });
}

function selectPageDatabaseReceiptHandoff(
  options: NativeDarkHallBrowserPageOptions,
  configuration: NativePageConfiguration,
): DarkHallBrowserPageResult<PageDatabaseReceiptHandoffSelection> {
  const peerId = pageReceiptPeerId(options, configuration);
  if (!peerId.ok) return peerId;
  if (options.databaseReceiptHandoff !== undefined) {
    return peerId.value === null
      ? succeeded({ runtime: options.databaseReceiptHandoff, peer: null })
      : failed(
          "page-configuration-invalid",
          "An injected receipt handoff runtime cannot also select a native receipt peer.",
        );
  }
  if (options.databaseReceiptArchive !== undefined || options.databaseReceiptArchiveExecutor !== undefined) {
    return peerId.value === null
      ? succeeded({ runtime: null, peer: null })
      : failed(
          "page-configuration-invalid",
          "A native receipt peer requires the page-owned receipt archive maintenance boundary.",
        );
  }

  const archiveNodeId = identifier(
    options.databaseReceiptArchiveNodeId ?? null,
    `${configuration.databaseNodeId}:receipts`,
  );
  if (!archiveNodeId.ok) return archiveNodeId;
  const targetNodeId = identifier(
    options.databaseReceiptHandoffTargetNodeId ?? null,
    `${configuration.databaseNodeId}:receipt-batches`,
  );
  if (!targetNodeId.ok) return targetNodeId;
  const imageOptions = {
    databaseName: options.databaseName ?? "zeta-browser-node",
    storeName: options.databaseStoreName ?? "database-images",
  };
  const archiveLimits = options.databaseReceiptArchiveLimits ?? defaultDatabaseReceiptArchiveLimits;
  const maintenance = createZetaDbBrowserDatabaseReceiptArchiveMaintenance({
    sourceDatabaseNodeId: configuration.databaseNodeId,
    archiveNodeId: archiveNodeId.value,
    executorId: configuration.tabId,
    limits: archiveLimits,
    load: (nodeId) => loadBrowserZetaDbImage(configuration.root, imageOptions, nodeId),
    save: (replacement) => saveBrowserZetaDbImage(configuration.root, imageOptions, replacement),
  });
  if (!maintenance.ok) return pageReceiptHandoffFailure(configuration, maintenance.feedback);

  const hasher = { hash: (payload: Uint8Array) => `blake3:${ContentHash256.ofBytes(payload).toHex()}` };
  const downstream = createZetaDbBrowserDatabaseReceiptHandoff({
    sourceDatabaseNodeId: configuration.databaseNodeId,
    sourceArchiveNodeId: archiveNodeId.value,
    targetNodeId: targetNodeId.value,
    executorId: configuration.tabId,
    limits: options.databaseReceiptHandoffTargetLimits ?? defaultDatabaseReceiptHandoffTargetLimits,
    hasher,
    execute:
      options.databaseReceiptHandoffTargetExecutor ??
      ((request) => runBrowserZetaDbWake(configuration.root, imageOptions, request)),
  });
  if (!downstream.ok) return pageReceiptHandoffFailure(configuration, downstream.feedback);

  if (peerId.value !== null) {
    const sequence = pageReceiptPeerInitialSequence(options, configuration);
    if (!sequence.ok) return sequence;
    const limits = pageReceiptPeerLimits(options, configuration);
    if (!limits.ok) return limits;
    const channelName = identifier(
      options.databaseReceiptPeerChannelName ?? null,
      `${options.channelName ?? "zeta-darkhall-browser-page"}:receipt-handoff`,
    );
    if (!channelName.ok) return channelName;
    const peer = createNativeBrowserDatabaseReceiptBroadcastPeerLink({
      root: configuration.root,
      channelName: channelName.value,
      localPeerId: configuration.tabId,
      remotePeerId: peerId.value,
      initialSequence: sequence.value,
      databaseNodeId: configuration.databaseNodeId,
      archiveNodeId: archiveNodeId.value,
      targetNodeId: targetNodeId.value,
      archive: maintenance.value,
      downstream: downstream.value,
      hasher,
      limits: limits.value,
    });
    return peer.ok
      ? succeeded({ runtime: peer.value.handoff, peer: peer.value })
      : pageReceiptHandoffFailure(configuration, peer.feedback);
  }

  const runtime = createBrowserDatabaseReceiptHandoffRuntime({
    databaseNodeId: configuration.databaseNodeId,
    archiveNodeId: archiveNodeId.value,
    targetNodeId: targetNodeId.value,
    archive: maintenance.value,
    downstream: downstream.value,
    hasher,
    limits: options.databaseReceiptHandoffLimits ?? defaultDatabaseReceiptHandoffLimits,
  });
  return runtime.ok
    ? succeeded({ runtime: runtime.value, peer: null })
    : pageReceiptHandoffFailure(configuration, runtime.feedback);
}

function observePageDatabaseOutbox(
  context: NativePageContext,
  readout: BrowserDatabaseIntentReadout,
): { readonly ok: true } | { readonly ok: false; readonly feedback: DarkHallBrowserPageFeedback } {
  const attributes = [
    ["data-database-outbox-admission", readout.admission],
    ["data-database-outbox-queued", readout.queued.toString()],
    ["data-database-outbox-executing", readout.executing.toString()],
    ["data-database-outbox-settled", readout.settled.toString()],
    ["data-database-outbox-refused", readout.refused.toString()],
    ["data-database-outbox-bytes", readout.ledgerBytes.toString()],
    ["data-database-outbox-latest-status", readout.receipts.at(-1)?.status ?? "none"],
    ["data-database-outbox-latest-intent", readout.receipts.at(-1)?.intentId ?? "none"],
    ["data-database-outbox-latest-revision", readout.receipts.at(-1)?.revision.toString() ?? "none"],
  ] as const;
  for (const [name, value] of attributes) {
    if (!context.mount.setAttribute(name, value)) {
      return {
        ok: false,
        feedback: {
          severity: "heat",
          code: "page-status-update-failed",
          detail: `The browser refused database outbox attribute ${name}.`,
        },
      };
    }
  }
  return { ok: true };
}

function observePageDatabaseReceiptHandoff(
  context: NativePageContext,
  readout: BrowserDatabaseReceiptHandoffReadout,
): { readonly ok: true } | { readonly ok: false; readonly feedback: DarkHallBrowserPageFeedback } {
  const attributes = [
    ["data-database-receipt-handoff-status", readout.status],
    ["data-database-receipt-handoff-target", readout.targetNodeId],
    ["data-database-receipt-handoff-retained", readout.retainedReceipts.toString()],
    ["data-database-receipt-handoff-released", readout.releasedReceipts.toString()],
    ["data-database-receipt-handoff-bytes", readout.receiptPayloadBytes.toString()],
    ["data-database-receipt-handoff-high-water", readout.highWaterSequence?.toString() ?? "none"],
    ["data-database-receipt-handoff-hash", readout.contentHash ?? "none"],
    ["data-database-receipt-handoff-feedback", readout.feedback?.code ?? "none"],
  ] as const;
  for (const [name, value] of attributes) {
    if (!context.mount.setAttribute(name, value)) {
      return {
        ok: false,
        feedback: {
          severity: "heat",
          code: "page-status-update-failed",
          detail: `The browser refused database receipt handoff attribute ${name}.`,
        },
      };
    }
  }
  return { ok: true };
}

function optionalReceiptHandoff(receiptHandoff: BrowserDatabaseReceiptHandoffRuntime | null): {
  readonly receiptHandoff?: BrowserDatabaseReceiptHandoffRuntime;
} {
  return receiptHandoff === null ? {} : { receiptHandoff };
}

function createPagePeerDarkRecovery(context: NativePageContext, localTabId: string): PagePeerDarkRecovery {
  let database: BrowserZetaDbTabRuntime | null = null;
  let pending = false;
  let darkFingerprint = "[]";
  const schedule = (): void => {
    if (database === null) {
      pending = true;
      return;
    }
    pending = false;
    void database.recoverPending().then((result) => {
      context.mount.setAttribute("data-database-outbox-recovery", result.ok ? "complete" : result.feedback.severity);
    });
  };
  return {
    onTabReadout: (readout) => {
      const nextFingerprint = JSON.stringify(readout.liveness.darkTabIds.filter((tabId) => tabId !== localTabId));
      if (nextFingerprint === darkFingerprint) return { ok: true, value: null };
      darkFingerprint = nextFingerprint;
      if (nextFingerprint !== "[]") schedule();
      return { ok: true, value: null };
    },
    install: (runtime) => {
      database = runtime;
      if (pending) schedule();
    },
  };
}

interface NativePageConfiguration {
  readonly root: unknown;
  readonly context: NativePageContext;
  readonly nodeId: string;
  readonly tabId: string;
  readonly sequence: number;
  readonly databaseNodeId: string;
  readonly editorMount: unknown;
  readonly transcript: RoomRunTranscript;
  readonly databaseLimits: ZetaDbTickLimits;
  readonly databaseExecutionAdmission: BrowserExecutionAdmissionPort;
}

function nativePageConfiguration(
  options: NativeDarkHallBrowserPageOptions,
): DarkHallBrowserPageResult<NativePageConfiguration> {
  const root = options.root ?? globalThis;
  const contextResult = nativePageContext(root, options.mountId ?? DARK_HALL_BROWSER_PAGE_MOUNT_ID);
  if (!contextResult.ok) return contextResult;
  const context = contextResult.value;

  const nodeId = identifier(context.parameters.get("node"), options.nodeId ?? "zeta-darkhall-browser-node");
  if (!nodeId.ok) return nodeId;
  const explicitTabId = context.parameters.get("tab");
  const mintedTabId = explicitTabId ?? context.mintTabId();
  if (mintedTabId === null) {
    return failed(
      "page-identity-unavailable",
      "The active browser page needs an explicit tab query parameter or crypto.randomUUID.",
      "backpressure",
    );
  }
  const tabId = identifier(mintedTabId, "");
  if (!tabId.ok) return tabId;
  const sequence = initialSequence(context.parameters.get("sequence"));
  if (!sequence.ok) return sequence;
  const databaseNodeId = identifier(options.databaseNodeId ?? null, `${nodeId.value}:database`);
  if (!databaseNodeId.ok) return databaseNodeId;
  const editorMountId = identifier(
    options.rowCommandEditorMountId ?? null,
    DARK_HALL_BROWSER_ROW_COMMAND_EDITOR_MOUNT_ID,
  );
  if (!editorMountId.ok) return editorMountId;
  const editorMount = pageElement(context.document, editorMountId.value);
  if (!editorMount.ok) return editorMount;
  const databaseExecutionAdmission = selectPageDatabaseAdmission(options, root, context);
  if (!databaseExecutionAdmission.ok) return databaseExecutionAdmission;

  return succeeded({
    root,
    context,
    nodeId: nodeId.value,
    tabId: tabId.value,
    sequence: sequence.value,
    databaseNodeId: databaseNodeId.value,
    editorMount: editorMount.value,
    transcript: options.transcript ?? DARK_HALL_BROWSER_PAGE_TRANSCRIPT,
    databaseLimits: options.databaseLimits ?? defaultDatabaseLimits,
    databaseExecutionAdmission: databaseExecutionAdmission.value,
  });
}

function controllerCellEnabled(
  cell: RoomRunTranscript["controller"][number],
  editorReady: boolean,
  replaceReady: boolean,
): boolean | undefined {
  if (cell.actionId === "darkhall.database.emit" || cell.actionId === "darkhall.database.retract") {
    return cell.enabled !== false && editorReady;
  }
  if (cell.actionId === "darkhall.database.replace") return cell.enabled !== false && replaceReady;
  return cell.enabled;
}

function controllerTranscriptWithState(
  transcript: RoomRunTranscript,
  editorReady: boolean,
  replaceReady: boolean,
  selectedControllerCell: number | null,
): RoomRunTranscript {
  return {
    ...transcript,
    controller: transcript.controller.map((cell) => {
      const enabled = controllerCellEnabled(cell, editorReady, replaceReady);
      const selected = selectedControllerCell === null ? cell.selected : cell.cell === selectedControllerCell;
      return {
        ...cell,
        ...(enabled === undefined ? {} : { enabled }),
        ...(selected === undefined ? {} : { selected }),
      };
    }),
  };
}

function databaseFailure(
  context: NativePageContext,
  pwa: DarkHallBrowserPwaRuntime,
  database: BrowserZetaDbTabRuntime | null,
  code: "page-database-start-failed" | "page-database-hydration-failed",
  detail: string,
  severity: DarkHallBrowserPageFeedback["severity"],
): DarkHallBrowserPageResult<never> {
  if (database !== null) database.stop();
  pwa.browser.host.stop();
  context.mount.setStatus(pageStatusFromSeverity(severity), code);
  return failed(code, detail, severity);
}

async function startPagePwa(
  options: NativeDarkHallBrowserPageOptions,
  configuration: NativePageConfiguration,
  runtime: BrowserRuntimeProbeReadout,
  transcript: RoomRunTranscript,
  onDatabaseInvalidated: (invalidation: BrowserDatabaseInvalidation) => void,
  onDatabaseExecutionReceipt: (receipt: BrowserDatabaseExecutionReceiptNotice) => void,
  onTabReadout: (readout: BrowserTabCoordinatorReadout) => BrowserReadoutSinkResult<null>,
): Promise<DarkHallBrowserPageResult<DarkHallBrowserPwaRuntime>> {
  const { context, root, nodeId, tabId, sequence } = configuration;
  if (!context.mount.setStatus("starting")) {
    return failed("page-status-update-failed", "The browser refused the active page startup readout.");
  }

  let started;
  try {
    started = await startNativeDarkHallPwa(
      pwaOptions(
        { ...options, transcript },
        root,
        context,
        runtime,
        nodeId,
        tabId,
        sequence,
        onDatabaseInvalidated,
        onDatabaseExecutionReceipt,
        onTabReadout,
      ),
    );
  } catch {
    context.mount.setStatus("heat", "page-start-threw");
    return failed("page-start-failed", "The active browser page threw while starting its PWA runtime.");
  }
  if (started.ok) return succeeded(started.value);

  context.mount.setStatus(pageStatusFromSeverity(started.feedback.severity), started.feedback.code);
  return failed("page-start-failed", `${started.feedback.code}: ${started.feedback.detail}`, started.feedback.severity);
}

async function startPageEdges(
  options: NativeDarkHallBrowserPageOptions,
  configuration: NativePageConfiguration,
  runtime: BrowserRuntimeProbeReadout,
  transcript: RoomRunTranscript,
  onDatabaseInvalidated: (invalidation: BrowserDatabaseInvalidation) => void,
  onDatabaseExecutionReceipt: (receipt: BrowserDatabaseExecutionReceiptNotice) => void,
  onTabReadout: (readout: BrowserTabCoordinatorReadout) => BrowserReadoutSinkResult<null>,
): Promise<
  DarkHallBrowserPageResult<{
    readonly pwa: DarkHallBrowserPwaRuntime;
    readonly outbox: BrowserDatabaseIntentOutboxPort;
    readonly receiptArchive: BrowserDatabaseReceiptArchivePort;
    readonly receiptHandoff: BrowserDatabaseReceiptHandoffRuntime | null;
    readonly receiptPeer: BrowserDatabaseReceiptBroadcastPeerLinkRuntime | null;
  }>
> {
  const pwa = await startPagePwa(
    options,
    configuration,
    runtime,
    transcript,
    onDatabaseInvalidated,
    onDatabaseExecutionReceipt,
    onTabReadout,
  );
  if (!pwa.ok) return pwa;
  const outbox = await selectPageDatabaseIntentOutbox(options, configuration.root, configuration.context);
  if (!outbox.ok) {
    pwa.value.browser.host.stop();
    return outbox;
  }
  const receiptArchive = selectPageDatabaseReceiptArchive(options, configuration);
  if (!receiptArchive.ok) {
    outbox.value.close();
    pwa.value.browser.host.stop();
    return receiptArchive;
  }
  const receiptHandoff = selectPageDatabaseReceiptHandoff(options, configuration);
  if (!receiptHandoff.ok) {
    outbox.value.close();
    pwa.value.browser.host.stop();
    return receiptHandoff;
  }
  return succeeded({
    pwa: pwa.value,
    outbox: outbox.value,
    receiptArchive: receiptArchive.value,
    receiptHandoff: receiptHandoff.value.runtime,
    receiptPeer: receiptHandoff.value.peer,
  });
}

async function hydratePageDatabase(
  context: NativePageContext,
  pwa: DarkHallBrowserPwaRuntime,
  database: BrowserZetaDbTabRuntime,
  pendingStartupInvalidation: () => BrowserDatabaseInvalidation | null,
  receiveDatabaseInvalidation: (invalidation: BrowserDatabaseInvalidation) => void,
  observedDatabase: () => DarkHallDatabaseReadout | null,
): Promise<DarkHallBrowserPageResult<DarkHallDatabaseReadout>> {
  const recovered = await database.recoverPending();
  if (!recovered.ok) {
    return databaseFailure(
      context,
      pwa,
      database,
      "page-database-hydration-failed",
      `${recovered.feedback.code}: ${recovered.feedback.detail}`,
      recovered.feedback.severity,
    );
  }
  const hydrated = await database.tick([]);
  if (!hydrated.ok) {
    return databaseFailure(
      context,
      pwa,
      database,
      "page-database-hydration-failed",
      `${hydrated.feedback.code}: ${hydrated.feedback.detail}`,
      hydrated.feedback.severity,
    );
  }

  const startupInvalidation = pendingStartupInvalidation();
  if (startupInvalidation !== null) receiveDatabaseInvalidation(startupInvalidation);
  const drained = await database.drainInvalidations();
  if (!drained.ok) {
    return databaseFailure(
      context,
      pwa,
      database,
      "page-database-hydration-failed",
      `${drained.feedback.code}: ${drained.feedback.detail}`,
      drained.feedback.severity,
    );
  }

  const initialDatabase = observedDatabase();
  return initialDatabase === null
    ? databaseFailure(
        context,
        pwa,
        database,
        "page-database-hydration-failed",
        "The finite database hydration tick produced no observable readout.",
        "heat",
      )
    : succeeded(initialDatabase);
}

/** Start only from the explicit active page; the standing room never imports this module. */
export async function startNativeDarkHallBrowserPage(
  options: NativeDarkHallBrowserPageOptions = {},
): Promise<DarkHallBrowserPageResult<DarkHallBrowserPageRuntime>> {
  const configuration = nativePageConfiguration(options);
  if (!configuration.ok) return configuration;
  const {
    root,
    context,
    nodeId,
    tabId,
    databaseNodeId,
    editorMount,
    transcript: suppliedTranscript,
    databaseLimits,
    databaseExecutionAdmission,
  } = configuration.value;
  let editorReady = options.controllerCommandResolver !== undefined;
  let replaceReady = options.controllerCommandResolver !== undefined;
  let selectedControllerCell: number | null = null;
  const controllerTranscript = (): RoomRunTranscript =>
    controllerTranscriptWithState(suppliedTranscript, editorReady, replaceReady, selectedControllerCell);
  const peerDarkRecovery = createPagePeerDarkRecovery(context, tabId);

  let receiveDatabaseInvalidation: ((invalidation: BrowserDatabaseInvalidation) => void) | null = null;
  let startupDatabaseInvalidation: BrowserDatabaseInvalidation | null = null;
  const pendingStartupInvalidation = (): BrowserDatabaseInvalidation | null => startupDatabaseInvalidation;
  const onDatabaseInvalidated = (invalidation: BrowserDatabaseInvalidation): void => {
    if (receiveDatabaseInvalidation !== null) {
      receiveDatabaseInvalidation(invalidation);
      return;
    }
    if (
      invalidation.databaseNodeId === databaseNodeId &&
      (startupDatabaseInvalidation === null || invalidation.revision > startupDatabaseInvalidation.revision)
    ) {
      startupDatabaseInvalidation = invalidation;
    }
  };
  const onDatabaseExecutionReceipt = (receipt: BrowserDatabaseExecutionReceiptNotice): void => {
    if (receipt.databaseNodeId !== databaseNodeId) return;
    const attributes = [
      ["data-database-peer-receipt-status", receipt.status],
      ["data-database-peer-receipt-intent", receipt.intentId],
      ["data-database-peer-receipt-revision", receipt.revision.toString()],
      ["data-database-peer-receipt-source", receipt.sourceTabId],
    ] as const;
    const rendered = attributes.every(([name, value]) => context.mount.setAttribute(name, value));
    if (!rendered) context.mount.setStatus("heat", "page-database-receipt-render-failed");
  };

  const runtimeProbe = probeBrowserRuntime(root);
  const edges = await startPageEdges(
    options,
    configuration.value,
    runtimeProbe,
    controllerTranscript(),
    onDatabaseInvalidated,
    onDatabaseExecutionReceipt,
    peerDarkRecovery.onTabReadout,
  );
  if (!edges.ok) return edges;

  const { pwa, outbox, receiptArchive, receiptHandoff, receiptPeer } = edges.value;
  let latestDatabase: DarkHallDatabaseReadout | null = null;
  const observedDatabase = (): DarkHallDatabaseReadout | null => latestDatabase;
  let latestController: DarkHallBrowserDatabaseControllerReadout | null = null;
  const databaseStarted = startBrowserZetaDbTabRuntime({
    databaseNodeId,
    executorId: tabId,
    limits: databaseLimits,
    admission: databaseExecutionAdmission,
    outbox,
    receiptArchive,
    ...optionalReceiptHandoff(receiptHandoff),
    execute:
      options.databaseExecutor ??
      ((request) =>
        runBrowserZetaDbWake(
          root,
          {
            databaseName: options.databaseName ?? "zeta-browser-node",
            storeName: options.databaseStoreName ?? "database-images",
          },
          request,
        )),
    observe: (tick) => {
      latestDatabase = zetaDbTickToDarkHallDatabaseReadout(tick);
      const rendered = pwa.browser.updateDatabaseReadout(latestDatabase);
      return rendered.ok
        ? { ok: true }
        : {
            ok: false,
            feedback: {
              severity: "heat",
              code: "database-readout-render-failed",
              detail: rendered.detail,
            },
          };
    },
    observeOutbox: (readout) => observePageDatabaseOutbox(context, readout),
    observeReceiptHandoff: (readout) => observePageDatabaseReceiptHandoff(context, readout),
    publishInvalidation: (nextDatabaseNodeId, revision) =>
      pwa.browser.host.publishDatabaseInvalidation(nextDatabaseNodeId, revision),
    publishExecutionReceipt: (receipt) =>
      pwa.browser.host.publishDatabaseExecutionReceipt({
        databaseNodeId: receipt.databaseNodeId,
        intentId: receipt.intentId,
        sequence: receipt.sequence,
        status: receipt.status,
        revision: receipt.revision,
        accepted: receipt.accepted,
        duplicates: receipt.duplicates,
      }),
  });
  if (!databaseStarted.ok) {
    receiptPeer?.close();
    outbox.close();
    return databaseFailure(
      context,
      pwa,
      null,
      "page-database-start-failed",
      `${databaseStarted.feedback.code}: ${databaseStarted.feedback.detail}`,
      databaseStarted.feedback.severity,
    );
  }
  const database = databaseStarted.value;
  peerDarkRecovery.install(database);
  receiveDatabaseInvalidation = (invalidation) => {
    database.receiveInvalidation(invalidation);
  };

  const hydration = await hydratePageDatabase(
    context,
    pwa,
    database,
    pendingStartupInvalidation,
    receiveDatabaseInvalidation,
    observedDatabase,
  );
  if (!hydration.ok) {
    receiptPeer?.close();
    return hydration;
  }
  const hydratedDatabase = hydration.value;
  const controllerStarted = startDarkHallBrowserDatabaseController({
    databaseNodeId,
    maxCommandBytes: databaseLimits.maxCheckpointBytes,
    tick: (deltas) => database.tick(deltas),
    compareAndSwap: (expectedRevision, deltas) => database.compareAndSwap(expectedRevision, deltas),
    observe: (readout) => {
      latestController = readout;
      selectedControllerCell = readout.cell;
      const rendered = pwa.browser.updateTranscript(controllerTranscript());
      if (!rendered.ok) {
        return {
          ok: false,
          feedback: { severity: "heat", code: "controller-readout-render-failed", detail: rendered.detail },
        };
      }
      return context.mount.setAttribute("data-controller-cell", readout.cell.toString())
        ? { ok: true }
        : {
            ok: false,
            feedback: {
              severity: "heat",
              code: "controller-readout-attribute-failed",
              detail: "The browser refused the selected controller-cell readout.",
            },
          };
    },
  });
  if (!controllerStarted.ok) {
    receiptPeer?.close();
    return databaseFailure(
      context,
      pwa,
      database,
      "page-database-start-failed",
      `${controllerStarted.feedback.code}: ${controllerStarted.feedback.detail}`,
      controllerStarted.feedback.severity,
    );
  }
  const controller: DarkHallBrowserDatabaseControllerRuntime = controllerStarted.value;
  const editorStarted = startDarkHallBrowserRowCommandEditor({
    mount: editorMount,
    eventIdPrefix: tabId,
    maxPayloadBytes: options.maxRowCommandPayloadBytes ?? databaseLimits.maxCheckpointBytes,
    observe: (readout) => {
      const nextReady =
        options.controllerCommandResolver === undefined
          ? readout.status === "live" && readout.validity === "ready"
          : true;
      const nextReplaceReady =
        options.controllerCommandResolver === undefined ? nextReady && readout.loadedRevision !== null : true;
      if (nextReady === editorReady && nextReplaceReady === replaceReady) return { ok: true };
      editorReady = nextReady;
      replaceReady = nextReplaceReady;
      const rendered = pwa.browser.updateTranscript(controllerTranscript());
      return rendered.ok
        ? { ok: true }
        : {
            ok: false,
            feedback: { severity: "heat", code: "row-command-editor-render-failed", detail: rendered.detail },
          };
    },
  });
  if (!editorStarted.ok) {
    receiptPeer?.close();
    controller.stop();
    database.stop();
    pwa.browser.host.stop();
    context.mount.setStatus(inputPageStatus(editorStarted.feedback.severity), editorStarted.feedback.code);
    return failed(
      "page-editor-start-failed",
      `${editorStarted.feedback.code}: ${editorStarted.feedback.detail}`,
      editorStarted.feedback.severity === "heat" ? "heat" : "backpressure",
    );
  }
  const editor: DarkHallBrowserRowCommandEditorRuntime = editorStarted.value;
  const editorResolver: DarkHallBrowserControllerCommandResolver = (action, source) => {
    const resolved = editor.resolve(action, source);
    if (resolved.ok) return resolved;
    return {
      ok: false,
      feedback: {
        severity: resolved.feedback.severity,
        code:
          resolved.feedback.code === "row-command-editor-stopped"
            ? "controller-input-stopped"
            : "controller-input-command-unavailable",
        detail: `${resolved.feedback.code}: ${resolved.feedback.detail}`,
      },
    };
  };
  const selectionStarted = startDarkHallBrowserDatabaseRowSelection({
    pointerTarget: context.mount.value,
    resolveSelection: (rowKey) => selectDarkHallDatabaseRow(latestDatabase ?? hydratedDatabase, rowKey),
    loadSelection: (selection) => editor.load(selection),
    observe: (readout) => {
      const interaction = readout.last;
      const attributes: readonly (readonly [string, string])[] = [
        ["data-database-selection-status", readout.status],
        ["data-database-selection-count", readout.selected.toString()],
        ["data-database-selection-row", readout.selectedRowKey ?? "none"],
        ["data-database-selection-source", interaction?.source ?? "none"],
        ["data-database-selection-outcome", interaction?.outcome ?? "none"],
        ["data-database-selection-feedback", interaction?.feedbackCode ?? "none"],
      ];
      return attributes.every(([name, value]) => context.mount.setAttribute(name, value))
        ? { ok: true }
        : {
            ok: false,
            feedback: {
              severity: "heat",
              code: "database-row-selection-readout-attribute-failed",
              detail: "The browser refused a database row selection readout attribute.",
            },
          };
    },
  });
  if (!selectionStarted.ok) {
    receiptPeer?.close();
    editor.stop();
    controller.stop();
    database.stop();
    pwa.browser.host.stop();
    context.mount.setStatus(inputPageStatus(selectionStarted.feedback.severity), selectionStarted.feedback.code);
    return failed(
      "page-selection-start-failed",
      `${selectionStarted.feedback.code}: ${selectionStarted.feedback.detail}`,
      selectionStarted.feedback.severity === "heat" ? "heat" : "backpressure",
    );
  }
  const selection: DarkHallBrowserDatabaseRowSelectionRuntime = selectionStarted.value;
  const inputStarted = startDarkHallBrowserControllerInput({
    pointerTarget: context.mount.value,
    keyboardTarget: context.document,
    maxInFlight: options.maxControllerInputInFlight ?? 1,
    resolveCommand: options.controllerCommandResolver ?? editorResolver,
    dispatch: (command) => controller.dispatch(command),
    observe: (readout) => {
      const interaction = readout.last;
      const attributes: readonly (readonly [string, string])[] = [
        ["data-controller-input-status", readout.status],
        ["data-controller-input-in-flight", readout.inFlight.toString()],
        ["data-controller-input-source", interaction?.source ?? "none"],
        ["data-controller-input-cell", interaction?.cell.toString() ?? "none"],
        ["data-controller-input-outcome", interaction?.outcome ?? "none"],
        ["data-controller-input-feedback", interaction?.feedbackCode ?? "none"],
      ];
      return attributes.every(([name, value]) => context.mount.setAttribute(name, value))
        ? { ok: true }
        : {
            ok: false,
            feedback: {
              severity: "heat",
              code: "controller-input-readout-attribute-failed",
              detail: "The browser refused a controller input readout attribute.",
            },
          };
    },
  });
  if (!inputStarted.ok) {
    receiptPeer?.close();
    selection.stop();
    editor.stop();
    controller.stop();
    database.stop();
    pwa.browser.host.stop();
    context.mount.setStatus(inputPageStatus(inputStarted.feedback.severity), inputStarted.feedback.code);
    return failed(
      "page-input-start-failed",
      `${inputStarted.feedback.code}: ${inputStarted.feedback.detail}`,
      inputStarted.feedback.severity === "heat" ? "heat" : "backpressure",
    );
  }
  const input: DarkHallBrowserControllerInputRuntime = inputStarted.value;

  let status: DarkHallBrowserPageStatus = "live";
  if (
    !context.mount.setStatus("live") ||
    !context.mount.setAttribute("data-pwa-registration", pwa.registration.status) ||
    !context.mount.setAttribute("data-browser-transport", pwa.browser.transport.selected) ||
    !context.mount.setAttribute("data-browser-tab", tabId)
  ) {
    receiptPeer?.close();
    input.stop();
    selection.stop();
    editor.stop();
    controller.stop();
    database.stop();
    pwa.browser.host.stop();
    return failed("page-status-update-failed", "The browser refused the active page live readout.");
  }

  const read = (): DarkHallBrowserPageReadout => ({
    schema: DARK_HALL_BROWSER_PAGE_SCHEMA,
    status,
    nodeId,
    tabId,
    runtime: runtimeProbe,
    registration: pwa.registration,
    transport: pwa.browser.transport,
    host: pwa.browser.host.read(),
    database: latestDatabase ?? hydratedDatabase,
    receiptHandoff: database.readReceiptHandoff(),
    receiptPeer: receiptPeer?.read() ?? null,
    controller: latestController,
    editor: editor.read(),
    selection: selection.read(),
    input: input.read(),
  });

  return succeeded({
    read,
    dispatchController: (command) => controller.dispatch(command),
    dispatchControllerInput: (cell, source) => input.dispatchCell(cell, source),
    selectDatabaseRow: (rowKey, source) => selection.select(rowKey, source),
    stop: () => {
      const inputStopped = input.stop();
      if (!inputStopped.ok) {
        receiptPeer?.close();
        context.mount.setStatus(inputPageStatus(inputStopped.feedback.severity), inputStopped.feedback.code);
        return failed(
          "page-input-stop-failed",
          `${inputStopped.feedback.code}: ${inputStopped.feedback.detail}`,
          inputStopped.feedback.severity === "heat" ? "heat" : "backpressure",
        );
      }
      const selectionStopped = selection.stop();
      if (!selectionStopped.ok) {
        receiptPeer?.close();
        context.mount.setStatus(inputPageStatus(selectionStopped.feedback.severity), selectionStopped.feedback.code);
        return failed(
          "page-selection-stop-failed",
          `${selectionStopped.feedback.code}: ${selectionStopped.feedback.detail}`,
          selectionStopped.feedback.severity === "heat" ? "heat" : "backpressure",
        );
      }
      const editorStopped = editor.stop();
      if (!editorStopped.ok) {
        receiptPeer?.close();
        context.mount.setStatus(inputPageStatus(editorStopped.feedback.severity), editorStopped.feedback.code);
        return failed(
          "page-editor-stop-failed",
          `${editorStopped.feedback.code}: ${editorStopped.feedback.detail}`,
          editorStopped.feedback.severity === "heat" ? "heat" : "backpressure",
        );
      }
      const controllerStopped = controller.stop();
      if (!controllerStopped.ok) {
        receiptPeer?.close();
        context.mount.setStatus(
          pageStatusFromSeverity(controllerStopped.feedback.severity),
          controllerStopped.feedback.code,
        );
        return failed(
          "page-controller-stop-failed",
          `${controllerStopped.feedback.code}: ${controllerStopped.feedback.detail}`,
          controllerStopped.feedback.severity,
        );
      }
      const databaseStopped = database.stop();
      if (!databaseStopped.ok) {
        receiptPeer?.close();
        context.mount.setStatus(
          pageStatusFromSeverity(databaseStopped.feedback.severity),
          databaseStopped.feedback.code,
        );
        return failed(
          "page-database-stop-failed",
          `${databaseStopped.feedback.code}: ${databaseStopped.feedback.detail}`,
          databaseStopped.feedback.severity,
        );
      }
      const receiptPeerStopped = receiptPeer?.close();
      if (receiptPeerStopped !== undefined && !receiptPeerStopped.ok) {
        context.mount.setStatus(
          pageStatusFromSeverity(receiptPeerStopped.feedback.severity),
          receiptPeerStopped.feedback.code,
        );
        return failed(
          "page-database-receipt-peer-stop-failed",
          `${receiptPeerStopped.feedback.code}: ${receiptPeerStopped.feedback.detail}`,
          receiptPeerStopped.feedback.severity,
        );
      }
      const stopped = pwa.browser.host.stop();
      if (!stopped.ok) {
        context.mount.setStatus(pageStatusFromSeverity(stopped.feedback.severity), stopped.feedback.code);
        return failed(
          "page-stop-failed",
          `${stopped.feedback.code}: ${stopped.feedback.detail}`,
          stopped.feedback.severity,
        );
      }
      status = "stopped";
      if (!context.mount.setStatus("stopped")) {
        return failed("page-status-update-failed", "The browser refused the active page stopped readout.");
      }
      return succeeded(read());
    },
  });
}

export function renderDarkHallBrowserNodeDocument(): string {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="theme-color" content="#11110f">',
    "<title>Zeta - Dark Hall Browser Node</title>",
    '<link rel="manifest" href="./manifest.webmanifest">',
    '<link rel="stylesheet" href="./room.css">',
    "</head>",
    '<body data-browser-page="active">',
    '<nav class="zeta-room-nav"><a href="./">&larr; static room</a><span>active browser node</span></nav>',
    renderDarkHallBrowserRowCommandEditorHtml(),
    `<main id="${DARK_HALL_BROWSER_PAGE_MOUNT_ID}" data-pwa-status="starting" data-database-outbox-admission="open" data-database-outbox-queued="0" data-database-outbox-executing="0" data-database-outbox-settled="0" data-database-outbox-refused="0" data-database-outbox-bytes="0" data-database-outbox-latest-status="none" data-database-outbox-latest-intent="none" data-database-outbox-latest-revision="none" data-database-peer-receipt-status="none" data-database-peer-receipt-intent="none" data-database-peer-receipt-revision="none" data-database-peer-receipt-source="none" data-database-outbox-recovery="idle" aria-live="polite">`,
    renderDarkHallRoomHtml(DARK_HALL_BROWSER_PAGE_TRANSCRIPT),
    "</main>",
    '<noscript><nav class="zeta-room-nav"><a href="./">static room</a></nav></noscript>',
    '<script type="module" src="./darkhall-browser-page.js"></script>',
    "</body>",
    "</html>",
  ].join("\n");
}
