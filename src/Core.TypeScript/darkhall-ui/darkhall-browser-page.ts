import { probeBrowserRuntime, type BrowserRuntimeProbeReadout } from "../browser-node/browser-runtime-probe";
import type { BrowserLifecycleHostReadout } from "../browser-node/browser-lifecycle-host";
import type { BrowserServiceWorkerRegistrationReadout } from "../browser-node/browser-service-worker-registration";
import type { BrowserTabTransportReadout } from "../browser-node/browser-tab-channel-selector";
import type { BrowserDatabaseInvalidation } from "../browser-node/browser-tab-coordinator";
import { runBrowserZetaDbWake } from "../browser-node/browser-zetadb-image-port";
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
import { zetaDbTickToDarkHallDatabaseReadout, type DarkHallDatabaseReadout } from "./darkhall-database-readout";
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
import { renderDarkHallRoomHtml, type RoomRunTranscript } from "./darkhall-room";

export const DARK_HALL_BROWSER_PAGE_SCHEMA = "zeta.darkhall.browser-page.v5" as const;
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
    | "page-editor-start-failed"
    | "page-editor-stop-failed"
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
  readonly controller: DarkHallBrowserDatabaseControllerReadout | null;
  readonly editor: DarkHallBrowserRowCommandEditorReadout;
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

export const DARK_HALL_BROWSER_PAGE_TRANSCRIPT: RoomRunTranscript = {
  schema: "zeta.darkhall.room-ui.v1",
  roomName: "dark hall browser node",
  seed: "browser-page-v5",
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

/** Start only from the explicit active page; the standing room never imports this module. */
export async function startNativeDarkHallBrowserPage(
  options: NativeDarkHallBrowserPageOptions = {},
): Promise<DarkHallBrowserPageResult<DarkHallBrowserPageRuntime>> {
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
  const suppliedTranscript = options.transcript ?? DARK_HALL_BROWSER_PAGE_TRANSCRIPT;
  const databaseLimits = options.databaseLimits ?? defaultDatabaseLimits;
  let editorReady = options.controllerCommandResolver !== undefined;
  let selectedControllerCell: number | null = null;
  const controllerTranscript = (): RoomRunTranscript => ({
    ...suppliedTranscript,
    controller: suppliedTranscript.controller.map((cell) => {
      const writeAction = cell.actionId === "darkhall.database.emit" || cell.actionId === "darkhall.database.retract";
      const enabled = writeAction ? cell.enabled !== false && editorReady : cell.enabled;
      const selected = selectedControllerCell === null ? cell.selected : cell.cell === selectedControllerCell;
      return {
        ...cell,
        ...(enabled === undefined ? {} : { enabled }),
        ...(selected === undefined ? {} : { selected }),
      };
    }),
  });

  let receiveDatabaseInvalidation: ((invalidation: BrowserDatabaseInvalidation) => void) | null = null;
  let startupDatabaseInvalidation: BrowserDatabaseInvalidation | null = null;
  const onDatabaseInvalidated = (invalidation: BrowserDatabaseInvalidation): void => {
    if (receiveDatabaseInvalidation !== null) {
      receiveDatabaseInvalidation(invalidation);
      return;
    }
    if (
      invalidation.databaseNodeId === databaseNodeId.value &&
      (startupDatabaseInvalidation === null || invalidation.revision > startupDatabaseInvalidation.revision)
    ) {
      startupDatabaseInvalidation = invalidation;
    }
  };

  if (!context.mount.setStatus("starting")) {
    return failed("page-status-update-failed", "The browser refused the active page startup readout.");
  }

  const runtimeProbe = probeBrowserRuntime(root);
  let pwaResult;
  try {
    pwaResult = await startNativeDarkHallPwa(
      pwaOptions(
        { ...options, transcript: controllerTranscript() },
        root,
        context,
        runtimeProbe,
        nodeId.value,
        tabId.value,
        sequence.value,
        onDatabaseInvalidated,
      ),
    );
  } catch {
    context.mount.setStatus("heat", "page-start-threw");
    return failed("page-start-failed", "The active browser page threw while starting its PWA runtime.");
  }
  if (!pwaResult.ok) {
    context.mount.setStatus(pageStatusFromSeverity(pwaResult.feedback.severity), pwaResult.feedback.code);
    return failed(
      "page-start-failed",
      `${pwaResult.feedback.code}: ${pwaResult.feedback.detail}`,
      pwaResult.feedback.severity,
    );
  }

  const pwa: DarkHallBrowserPwaRuntime = pwaResult.value;
  let latestDatabase: DarkHallDatabaseReadout | null = null;
  let latestController: DarkHallBrowserDatabaseControllerReadout | null = null;
  const databaseStarted = startBrowserZetaDbTabRuntime({
    databaseNodeId: databaseNodeId.value,
    executorId: tabId.value,
    limits: databaseLimits,
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
    publishInvalidation: (nextDatabaseNodeId, revision) =>
      pwa.browser.host.publishDatabaseInvalidation(nextDatabaseNodeId, revision),
  });
  if (!databaseStarted.ok) {
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
  receiveDatabaseInvalidation = (invalidation) => {
    database.receiveInvalidation(invalidation);
  };

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
  if (startupDatabaseInvalidation !== null) {
    receiveDatabaseInvalidation(startupDatabaseInvalidation);
  }
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
  if (latestDatabase === null) {
    return databaseFailure(
      context,
      pwa,
      database,
      "page-database-hydration-failed",
      "The finite database hydration tick produced no observable readout.",
      "heat",
    );
  }
  const hydratedDatabase = latestDatabase;
  const controllerStarted = startDarkHallBrowserDatabaseController({
    maxCommandBytes: databaseLimits.maxCheckpointBytes,
    tick: (deltas) => database.tick(deltas),
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
    mount: editorMount.value,
    eventIdPrefix: tabId.value,
    maxPayloadBytes: options.maxRowCommandPayloadBytes ?? databaseLimits.maxCheckpointBytes,
    observe: (readout) => {
      const nextReady =
        options.controllerCommandResolver === undefined
          ? readout.status === "live" && readout.validity === "ready"
          : true;
      if (nextReady === editorReady) return { ok: true };
      editorReady = nextReady;
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
    !context.mount.setAttribute("data-browser-tab", tabId.value)
  ) {
    input.stop();
    editor.stop();
    controller.stop();
    database.stop();
    pwa.browser.host.stop();
    return failed("page-status-update-failed", "The browser refused the active page live readout.");
  }

  const read = (): DarkHallBrowserPageReadout => ({
    schema: DARK_HALL_BROWSER_PAGE_SCHEMA,
    status,
    nodeId: nodeId.value,
    tabId: tabId.value,
    runtime: runtimeProbe,
    registration: pwa.registration,
    transport: pwa.browser.transport,
    host: pwa.browser.host.read(),
    database: latestDatabase ?? hydratedDatabase,
    controller: latestController,
    editor: editor.read(),
    input: input.read(),
  });

  return succeeded({
    read,
    dispatchController: (command) => controller.dispatch(command),
    dispatchControllerInput: (cell, source) => input.dispatchCell(cell, source),
    stop: () => {
      const inputStopped = input.stop();
      if (!inputStopped.ok) {
        context.mount.setStatus(inputPageStatus(inputStopped.feedback.severity), inputStopped.feedback.code);
        return failed(
          "page-input-stop-failed",
          `${inputStopped.feedback.code}: ${inputStopped.feedback.detail}`,
          inputStopped.feedback.severity === "heat" ? "heat" : "backpressure",
        );
      }
      const editorStopped = editor.stop();
      if (!editorStopped.ok) {
        context.mount.setStatus(inputPageStatus(editorStopped.feedback.severity), editorStopped.feedback.code);
        return failed(
          "page-editor-stop-failed",
          `${editorStopped.feedback.code}: ${editorStopped.feedback.detail}`,
          editorStopped.feedback.severity === "heat" ? "heat" : "backpressure",
        );
      }
      const controllerStopped = controller.stop();
      if (!controllerStopped.ok) {
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
    `<main id="${DARK_HALL_BROWSER_PAGE_MOUNT_ID}" data-pwa-status="starting" aria-live="polite">`,
    renderDarkHallRoomHtml(DARK_HALL_BROWSER_PAGE_TRANSCRIPT),
    "</main>",
    '<noscript><nav class="zeta-room-nav"><a href="./">static room</a></nav></noscript>',
    '<script type="module" src="./darkhall-browser-page.js"></script>',
    "</body>",
    "</html>",
  ].join("\n");
}
