import { webcrypto } from "node:crypto";
import { describe, expect, test } from "bun:test";
import {
  browserCheckpointSucceeded,
  copyBrowserCheckpointRecord,
  decideBrowserCheckpointSave,
  type BrowserCheckpointPort,
  type BrowserCheckpointRecord,
} from "../browser-node/browser-checkpoint-port";
import { monotoneLastWriterWinsRevisionPolicy } from "../persistence/revision-policy";
import {
  createInMemoryBrowserDatabaseIntentOutbox,
  type BrowserDatabaseIntentOutboxPort,
} from "../browser-node/browser-database-intent-outbox";
import type { BrowserDatabaseReceiptArchivePort } from "../browser-node/browser-database-receipt-archive";
import type { BrowserDatabaseReceiptArchiveMaintenancePort } from "../browser-node/browser-database-receipt-handoff";
import type { BrowserDatabaseReceiptPagesFetch } from "../browser-node/browser-database-receipt-pages-source";
import type {
  BrowserDatabaseReceiptSyncReadout,
  BrowserDatabaseReceiptSyncRuntime,
} from "../browser-node/browser-database-receipt-sync-runtime";
import { BROWSER_TAB_COORDINATOR_SCHEMA, type BrowserTabChannelMessage } from "../browser-node/browser-tab-coordinator";
import { SLOT } from "../observe/grammar-16";
import type { CrossRunReader } from "../chip9/chip8-cross-run-store";
import type { ZetaDbTickReadout, ZetaDbTickRequest } from "../zetadb/zeta-db-node";
import {
  DARK_HALL_BROWSER_PAGE_SCHEMA,
  DARK_HALL_BROWSER_PAGE_TRANSCRIPT,
  renderDarkHallBrowserNodeDocument,
  startNativeDarkHallBrowserPage as startNativeDarkHallBrowserPageRuntime,
  type NativeDarkHallBrowserPageOptions,
} from "./darkhall-browser-page";
import { DARK_HALL_BROWSER_CONTROLLER_INPUT_SCHEMA } from "./darkhall-browser-controller-input";
import { DARK_HALL_BROWSER_DATABASE_ROW_SELECTION_SCHEMA } from "./darkhall-browser-database-row-selection";
import { DARK_HALL_BROWSER_ROW_COMMAND_EDITOR_SCHEMA } from "./darkhall-browser-row-command-editor";

type NativeListener = (event?: unknown) => void;

function startNativeDarkHallBrowserPage(options: NativeDarkHallBrowserPageOptions = {}) {
  return startNativeDarkHallBrowserPageRuntime({ roomCheckpoint: "none", ...options });
}

function addNativeListener(entries: Map<string, Set<NativeListener>>, type: string, listener: NativeListener): void {
  const listeners = entries.get(type) ?? new Set();
  listeners.add(listener);
  entries.set(type, listeners);
}

class NativeMount {
  innerHTML = "standing room";
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Set<NativeListener>>();

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attributes.delete(name);
  }

  addEventListener(type: string, listener: NativeListener): void {
    addNativeListener(this.listeners, type, listener);
  }

  removeEventListener(type: string, listener: NativeListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string, event: unknown): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class NativeEditorField {
  value: string;
  textContent = "";

  constructor(value: string) {
    this.value = value;
  }
}

class NativeEditorMount {
  readonly rowKey = new NativeEditorField("");
  readonly payload = new NativeEditorField("");
  readonly magnitude = new NativeEditorField("1");
  readonly status = new NativeEditorField("");
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Set<NativeListener>>();

  querySelector(selector: string): NativeEditorField | null {
    if (selector === "[data-row-command-key]") return this.rowKey;
    if (selector === "[data-row-command-payload]") return this.payload;
    if (selector === "[data-row-command-magnitude]") return this.magnitude;
    if (selector === "[data-row-command-status]") return this.status;
    return null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: NativeListener): void {
    addNativeListener(this.listeners, type, listener);
  }

  removeEventListener(type: string, listener: NativeListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener({ type });
  }
}

class NativeControllerCell {
  readonly cell: number;

  constructor(cell: number) {
    this.cell = cell;
  }

  closest(selector: string): NativeControllerCell | null {
    return selector === "[data-controller-cell]" ? this : null;
  }

  getAttribute(name: string): string | null {
    return name === "data-controller-cell" ? this.cell.toString() : null;
  }
}

class NativeDatabaseRowControl {
  private readonly rowKey: string;

  constructor(rowKey: string) {
    this.rowKey = rowKey;
  }

  closest(selector: string): NativeDatabaseRowControl | null {
    return selector === "[data-database-row-select]" ? this : null;
  }

  getAttribute(name: string): string | null {
    return name === "data-row-key" ? this.rowKey : null;
  }
}

class NativeReceiptSyncButton {
  private readonly command: "submit" | "enroll";

  constructor(command: "submit" | "enroll") {
    this.command = command;
  }

  closest(selector: string): NativeReceiptSyncButton | null {
    return selector === `[data-receipt-sync-${this.command}]` ? this : null;
  }
}

class NativeReceiptSyncMount {
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Set<NativeListener>>();
  readonly output = { textContent: "" };
  readonly enrollmentOutput = { textContent: "" };
  readonly submitButton = new NativeReceiptSyncButton("submit");
  readonly enrollButton = new NativeReceiptSyncButton("enroll");

  querySelector(selector: string): unknown {
    if (selector === "[data-receipt-sync-readout]") return this.output;
    return selector === "[data-receipt-sync-enrollment]" ? this.enrollmentOutput : null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  addEventListener(type: string, listener: NativeListener): void {
    addNativeListener(this.listeners, type, listener);
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

class NativeServiceWorkerContainer {
  readonly messages: BrowserTabChannelMessage[] = [];
  readonly listeners = new Map<string, Set<NativeListener>>();
  readonly controller = {
    postMessage: (message: BrowserTabChannelMessage): void => {
      this.messages.push(message);
    },
  };
  readonly ready = Promise.resolve({ active: true });
  readonly registrations: { readonly scriptUrl: string; readonly options: unknown }[] = [];

  register(scriptUrl: string, options: unknown): Promise<unknown> {
    this.registrations.push({ scriptUrl, options });
    return Promise.resolve({ active: true });
  }

  addEventListener(type: string, listener: NativeListener): void {
    addNativeListener(this.listeners, type, listener);
  }

  removeEventListener(type: string, listener: NativeListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(message: BrowserTabChannelMessage): void {
    for (const listener of this.listeners.get("message") ?? []) listener({ data: message });
  }
}

class NativeLockManager {
  readonly requests: {
    readonly name: string;
    readonly options: { readonly ifAvailable: boolean; readonly mode: string };
  }[] = [];

  request<T>(
    name: string,
    options: { readonly ifAvailable: boolean; readonly mode: "exclusive" },
    callback: (lock: { readonly name: string; readonly mode: "exclusive" }) => Promise<T>,
  ): Promise<T> {
    this.requests.push({ name, options });
    return callback({ name, mode: "exclusive" });
  }
}

class NativeBrowserRoot {
  readonly mount = new NativeMount();
  readonly editor = new NativeEditorMount();
  readonly receiptSync = new NativeReceiptSyncMount();
  editorAvailable = true;
  readonly serviceWorker = new NativeServiceWorkerContainer();
  readonly locks = new NativeLockManager();
  readonly navigator = { serviceWorker: this.serviceWorker, locks: this.locks };
  readonly location = { search: "?tab=tab-a&sequence=12" };
  readonly crypto = { randomUUID: (): string => "minted-tab" };
  readonly documentListeners = new Map<string, Set<NativeListener>>();
  readonly pageListeners = new Map<string, Set<NativeListener>>();
  readonly document = {
    visibilityState: "visible",
    getElementById: (id: string): NativeMount | NativeEditorMount | NativeReceiptSyncMount | null => {
      if (id === "darkhall-room") return this.mount;
      if (id === "darkhall-row-command-editor") return this.editorAvailable ? this.editor : null;
      if (id === "darkhall-receipt-sync") return this.receiptSync;
      return null;
    },
    addEventListener: (type: string, listener: NativeListener): void => {
      addNativeListener(this.documentListeners, type, listener);
    },
    removeEventListener: (type: string, listener: NativeListener): void => {
      this.documentListeners.get(type)?.delete(listener);
    },
  };

  addEventListener(type: string, listener: NativeListener): void {
    addNativeListener(this.pageListeners, type, listener);
  }

  removeEventListener(type: string, listener: NativeListener): void {
    this.pageListeners.get(type)?.delete(listener);
  }

  emitDocument(type: string, event: unknown): void {
    for (const listener of this.documentListeners.get(type) ?? []) listener(event);
  }
}

class SharedMemoryCheckpointPort implements BrowserCheckpointPort {
  readonly revisionPolicy = monotoneLastWriterWinsRevisionPolicy;
  closed = false;
  private readonly records: Map<string, BrowserCheckpointRecord>;

  constructor(records: Map<string, BrowserCheckpointRecord>) {
    this.records = records;
  }

  load(nodeId: string) {
    const record = this.records.get(nodeId);
    return Promise.resolve(
      browserCheckpointSucceeded(record === undefined ? null : copyBrowserCheckpointRecord(record)),
    );
  }

  save(record: BrowserCheckpointRecord) {
    const decision = decideBrowserCheckpointSave(this.records.get(record.nodeId) ?? null, record, this.revisionPolicy);
    if (!decision.ok) return Promise.resolve(decision);
    const copy = copyBrowserCheckpointRecord(decision.value.record);
    this.records.set(record.nodeId, copy);
    return Promise.resolve(browserCheckpointSucceeded(copyBrowserCheckpointRecord(copy)));
  }

  remove(nodeId: string, throughRevision: number) {
    const record = this.records.get(nodeId);
    const removed = record !== undefined && record.revision <= throughRevision;
    if (removed) this.records.delete(nodeId);
    return Promise.resolve(browserCheckpointSucceeded(removed));
  }

  close() {
    this.closed = true;
    return browserCheckpointSucceeded(null);
  }
}

class NativeAssertionResponse {}

class NativeAttestationResponse {
  readonly clientDataJSON: ArrayBuffer;
  readonly attestationObject: ArrayBuffer;

  constructor(clientDataJSON: ArrayBuffer, attestationObject: ArrayBuffer) {
    this.clientDataJSON = clientDataJSON;
    this.attestationObject = attestationObject;
  }
}

class NativePublicKeyCredential {
  readonly rawId: ArrayBuffer;
  readonly response: NativeAssertionResponse | NativeAttestationResponse;

  constructor(
    rawId: ArrayBuffer = new ArrayBuffer(0),
    response: NativeAssertionResponse | NativeAttestationResponse = new NativeAssertionResponse(),
  ) {
    this.rawId = rawId;
    this.response = response;
  }
}

function enableNativeReceiptSync(root: NativeBrowserRoot, fetchImpl: BrowserDatabaseReceiptPagesFetch): void {
  Reflect.set(root.location, "href", "https://lucent-financial-group.github.io/Zeta/hall/room/");
  Reflect.set(root.location, "origin", "https://lucent-financial-group.github.io");
  const storage = new Map<string, string>();
  Reflect.set(root, "localStorage", {
    getItem: (key: string): string | null => storage.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      storage.set(key, value);
    },
  });
  Reflect.set(root.crypto, "getRandomValues", (target: Uint8Array): Uint8Array => target.fill(1));
  Reflect.set(root.crypto, "subtle", webcrypto.subtle);
  Reflect.set(root.navigator, "credentials", {
    get: (): Promise<null> => Promise.resolve(null),
    create: (options: CredentialCreationOptions): Promise<Credential> => {
      const challenge = options.publicKey?.challenge;
      const challengeBytes =
        challenge instanceof ArrayBuffer
          ? challenge
          : challenge === undefined
            ? new ArrayBuffer(0)
            : challenge.buffer.slice(challenge.byteOffset, challenge.byteOffset + challenge.byteLength);
      const clientDataJSON = new TextEncoder().encode(
        JSON.stringify({
          type: "webauthn.create",
          challenge: Buffer.from(challengeBytes).toString("base64url"),
          origin: "https://lucent-financial-group.github.io",
        }),
      ).buffer;
      return Promise.resolve(
        new NativePublicKeyCredential(
          Uint8Array.of(7, 8, 9).buffer,
          new NativeAttestationResponse(clientDataJSON, Uint8Array.of(1, 2, 3).buffer),
        ) as unknown as Credential,
      );
    },
  });
  Reflect.set(root, "PublicKeyCredential", NativePublicKeyCredential);
  Reflect.set(root, "AuthenticatorAssertionResponse", NativeAssertionResponse);
  Reflect.set(root, "AuthenticatorAttestationResponse", NativeAttestationResponse);
  Reflect.set(root, "atob", (value: string): string => Buffer.from(value, "base64").toString("binary"));
  Reflect.set(root, "btoa", (value: string): string => Buffer.from(value, "binary").toString("base64"));
  Reflect.set(root, "fetch", fetchImpl);
  Reflect.set(root, "open", (): unknown => ({ location: { href: "" }, opener: null, close: (): void => undefined }));
}

function databaseReadout(
  request: ZetaDbTickRequest,
  revision = request.deltas.length > 0 ? 8 : 7,
  payload = request.deltas.length > 0 ? "9001" : "9000",
): ZetaDbTickReadout {
  return {
    schema: "zeta.db.tick.v1",
    nodeId: request.nodeId,
    executorId: request.executorId,
    executorKind: request.executorKind,
    revision,
    admission: "complete",
    accepted: request.deltas.length,
    duplicates: 0,
    nextDeltaIndex: request.deltas.length,
    rows: [{ rowKey: "game/score", payload, weight: 1 }],
    feedback: [],
  };
}

function databaseExecutor(
  request: ZetaDbTickRequest,
): Promise<{ readonly ok: true; readonly value: ZetaDbTickReadout }> {
  return Promise.resolve({ ok: true, value: databaseReadout(request) });
}

function databaseIntentOutbox(): BrowserDatabaseIntentOutboxPort {
  const created = createInMemoryBrowserDatabaseIntentOutbox({
    maxIntents: 16,
    maxReceipts: 64,
    maxLedgerBytes: 64 * 1024,
  });
  if (!created.ok) throw new Error(created.feedback.detail);
  return created.value;
}

function databaseReceiptArchive(): BrowserDatabaseReceiptArchivePort {
  return {
    archive: (receipt) =>
      Promise.resolve({
        ok: true,
        value: {
          schema: "zeta.browser-database-receipt-archive-ack.v1",
          archiveNodeId: `${receipt.databaseNodeId}:receipts`,
          databaseNodeId: receipt.databaseNodeId,
          intentId: receipt.intentId,
          sequence: receipt.sequence,
          archiveRevision: receipt.sequence + 1,
          disposition: "stored",
        },
      }),
  };
}

function databaseReceiptSync(): {
  readonly runtime: BrowserDatabaseReceiptSyncRuntime;
  readonly calls: { submissions: number; polls: number };
} {
  const calls = { submissions: 0, polls: 0 };
  let readout: BrowserDatabaseReceiptSyncReadout = {
    schema: "zeta.browser-database-receipt-sync-readout.v1",
    status: "idle",
    databaseNodeId: "zeta-darkhall-browser-node:database",
    archiveNodeId: "zeta-darkhall-browser-node:database:receipts",
    receiptCount: 2,
    highWaterSequence: 1,
    contentHash: "blake3:" + "1".repeat(64),
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
        readout = { ...readout, status: "presented" };
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

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await Promise.resolve();
  }
  throw new Error("Timed out waiting for the browser page readout.");
}

describe("Dark Hall active browser page", () => {
  test("checkpoints and recovers the active room through an injected durable port", async () => {
    const records = new Map<string, BrowserCheckpointRecord>();
    const firstRoot = new NativeBrowserRoot();
    const firstPort = new SharedMemoryCheckpointPort(records);
    const first = await startNativeDarkHallBrowserPageRuntime({
      root: firstRoot,
      roomCheckpoint: firstPort,
      databaseIntentOutbox: databaseIntentOutbox(),
      databaseReceiptArchive: databaseReceiptArchive(),
      databaseExecutor,
    });

    expect(first).toMatchObject({ ok: true, value: {} });
    if (!first.ok) return;
    expect(first.value.read().durability).toMatchObject({ recoveredRevision: null, currentRevision: null });
    const checkpointed = await first.value.checkpointRoom(3, {
      ...DARK_HALL_BROWSER_PAGE_TRANSCRIPT,
      roomName: "recovered active room",
      ticks: [
        ...DARK_HALL_BROWSER_PAGE_TRANSCRIPT.ticks,
        { tick: 3, phase: "measure", event: "persist active room", outcome: "ok" },
      ],
    });
    expect(checkpointed).toMatchObject({ ok: true, value: { durability: { currentRevision: 3 } } });
    expect(firstRoot.mount.innerHTML).toContain("recovered active room");
    expect(first.value.stop()).toMatchObject({ ok: true });
    expect(firstPort.closed).toBe(true);

    const secondRoot = new NativeBrowserRoot();
    const secondPort = new SharedMemoryCheckpointPort(records);
    const second = await startNativeDarkHallBrowserPageRuntime({
      root: secondRoot,
      roomCheckpoint: secondPort,
      databaseIntentOutbox: databaseIntentOutbox(),
      databaseReceiptArchive: databaseReceiptArchive(),
      databaseExecutor,
    });

    expect(second).toMatchObject({
      ok: true,
      value: {},
    });
    if (!second.ok) return;
    expect(second.value.read().durability).toMatchObject({ recoveredRevision: 3, currentRevision: 3 });
    expect(secondRoot.mount.innerHTML).toContain("recovered active room");
    expect(secondRoot.mount.innerHTML).toContain("persist active room");
    expect(second.value.stop()).toMatchObject({ ok: true });
    expect(secondPort.closed).toBe(true);
  });

  test("hydrates before live, publishes bounded writes, and projects the database readout", async () => {
    const root = new NativeBrowserRoot();
    const requests: ZetaDbTickRequest[] = [];
    const crossRunReader: CrossRunReader = { tryGet: () => null };
    const started = await startNativeDarkHallBrowserPage({
      root,
      crossRunReader,
      databaseIntentOutbox: databaseIntentOutbox(),
      databaseReceiptArchive: databaseReceiptArchive(),
      databaseExecutor: (request) => {
        requests.push(request);
        return databaseExecutor(request);
      },
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    expect(started.value.crossRunReader).toBe(crossRunReader);
    expect(started.value.read()).toMatchObject({
      schema: DARK_HALL_BROWSER_PAGE_SCHEMA,
      status: "live",
      nodeId: "zeta-darkhall-browser-node",
      tabId: "tab-a",
      registration: { status: "controlled" },
      transport: { selected: "service-worker" },
      host: { state: "foreground", stopped: false },
      database: {
        nodeId: "zeta-darkhall-browser-node:database",
        executorId: "tab-a",
        revision: 7,
        accepted: 0,
        rows: [{ rowKey: "game/score", payload: "9000", weight: 1 }],
      },
      controller: null,
      editor: {
        schema: DARK_HALL_BROWSER_ROW_COMMAND_EDITOR_SCHEMA,
        status: "live",
        validity: "incomplete",
        resolved: 0,
        refused: 0,
        backpressured: 0,
        nextEventSequence: 0,
        feedbackCode: "row-command-key-required",
        last: null,
      },
      selection: {
        schema: DARK_HALL_BROWSER_DATABASE_ROW_SELECTION_SCHEMA,
        status: "live",
        selected: 0,
        refused: 0,
        backpressured: 0,
        selectedRowKey: null,
        last: null,
      },
      input: {
        schema: DARK_HALL_BROWSER_CONTROLLER_INPUT_SCHEMA,
        status: "live",
        accepted: 0,
        refused: 0,
        backpressured: 0,
        last: null,
      },
    });
    expect(requests).toHaveLength(1);
    expect(root.locks.requests).toEqual([]);
    expect(requests[0]).toMatchObject({
      nodeId: "zeta-darkhall-browser-node:database",
      executorId: "tab-a",
      executorKind: "browser-tab",
      deltas: [],
    });
    expect(root.serviceWorker.registrations).toHaveLength(1);
    expect(root.serviceWorker.messages.filter((message) => message.kind === "presence")).toContainEqual({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: "zeta-darkhall-browser-node",
      kind: "presence",
      presence: { tabId: "tab-a", sequence: 12, state: "foreground" },
    });
    expect(root.mount.attributes.get("data-pwa-status")).toBe("live");
    expect(root.mount.attributes.get("data-pwa-registration")).toBe("controlled");
    expect(root.mount.attributes.get("data-browser-transport")).toBe("service-worker");
    expect(root.mount.attributes.get("data-browser-tab")).toBe("tab-a");
    expect(root.mount.attributes.get("data-database-outbox-admission")).toBe("open");
    expect(root.mount.attributes.get("data-database-outbox-queued")).toBe("0");
    expect(root.mount.attributes.get("data-database-outbox-executing")).toBe("0");
    expect(root.mount.attributes.get("data-database-outbox-settled")).toBe("0");
    expect(root.mount.attributes.get("data-database-outbox-refused")).toBe("0");
    expect(root.mount.attributes.get("data-database-outbox-latest-status")).toBe("none");
    expect(root.mount.innerHTML).toContain('data-browser-local-tab="tab-a"');
    expect(root.mount.innerHTML).toContain('data-database-revision="7"');
    expect(root.mount.innerHTML).toContain("game/score");
    expect(root.mount.attributes.get("data-controller-input-status")).toBe("live");
    expect(root.mount.attributes.get("data-controller-input-source")).toBe("none");
    expect(root.mount.attributes.get("data-database-selection-status")).toBe("live");
    expect(root.mount.innerHTML).toMatch(/data-action-id="darkhall\.database\.replace"[^>]* disabled>/u);

    root.mount.emit("click", {
      button: 0,
      detail: 1,
      target: new NativeControllerCell(SLOT.INSPECT),
      preventDefault: () => undefined,
    });
    await waitFor(() => started.value.read().input.accepted === 1);
    root.emitDocument("keydown", {
      code: "KeyC",
      target: { tagName: "DIV" },
      preventDefault: () => undefined,
    });
    await waitFor(() => started.value.read().input.accepted === 2);
    expect(started.value.read().input.last).toMatchObject({
      source: "keyboard",
      cell: SLOT.REFRESH,
      actionId: "darkhall.database.refresh",
      outcome: "accepted",
    });
    expect(root.mount.attributes.get("data-controller-input-cell")).toBe(SLOT.REFRESH.toString());
    expect(root.mount.attributes.get("data-controller-input-outcome")).toBe("accepted");
    expect(requests).toHaveLength(3);

    root.mount.emit("click", {
      button: 0,
      detail: 1,
      target: new NativeDatabaseRowControl("game/score"),
      preventDefault: () => undefined,
    });
    expect(started.value.read()).toMatchObject({
      editor: {
        validity: "ready",
        rowKey: "game/score",
        payloadBytes: 4,
        magnitude: 1,
        loaded: 1,
        loadedRowKey: "game/score",
        nextEventSequence: 0,
      },
      selection: {
        selected: 1,
        selectedRowKey: "game/score",
        last: { source: "pointer", outcome: "selected" },
      },
      input: { accepted: 2 },
    });
    expect(root.editor.rowKey.value).toBe("game/score");
    expect(root.editor.payload.value).toBe("9000");
    expect(root.editor.magnitude.value).toBe("1");
    expect(root.mount.attributes.get("data-database-selection-row")).toBe("game/score");
    expect(root.mount.innerHTML).not.toMatch(/data-action-id="darkhall\.database\.replace"[^>]* disabled>/u);
    expect(requests).toHaveLength(3);

    root.mount.emit("click", {
      button: 0,
      detail: 1,
      target: new NativeControllerCell(SLOT.UNDO_RETRACT),
      preventDefault: () => undefined,
    });
    await waitFor(() => started.value.read().input.accepted === 3);
    expect(root.locks.requests[0]).toEqual({
      name: "zeta:database/zeta-darkhall-browser-node:database",
      options: { ifAvailable: true, mode: "exclusive" },
    });
    expect(requests[3]?.deltas).toEqual([
      { eventId: "tab-a/row-command/0", rowKey: "game/score", payload: "9000", weight: -1 },
    ]);
    expect(started.value.read()).toMatchObject({
      editor: { resolved: 1, nextEventSequence: 1, last: { kind: "retract", outcome: "resolved" } },
      controller: { kind: "retract", cell: SLOT.UNDO_RETRACT, signedWeight: -1 },
      input: { accepted: 3, last: { cell: SLOT.UNDO_RETRACT, outcome: "accepted" } },
    });

    root.editor.rowKey.value = "game/score";
    root.editor.payload.value = "9001";
    root.editor.magnitude.value = "2";
    root.editor.emit("input");
    expect(started.value.read().editor).toMatchObject({
      validity: "ready",
      rowKey: "game/score",
      payloadBytes: 4,
      magnitude: 2,
    });
    expect(root.editor.attributes.get("data-row-command-validity")).toBe("ready");
    expect(root.mount.innerHTML).toContain('data-action-id="darkhall.database.emit"');
    expect(root.mount.innerHTML).not.toContain('data-action-id="darkhall.database.emit" disabled');

    root.mount.emit("click", {
      button: 0,
      detail: 1,
      target: new NativeControllerCell(SLOT.ACCEPT),
      preventDefault: () => undefined,
    });
    await waitFor(() => started.value.read().input.accepted === 4);
    expect(requests[4]?.deltas).toEqual([
      { eventId: "tab-a/row-command/1", rowKey: "game/score", payload: "9001", weight: 2 },
    ]);
    expect(started.value.read().database).toMatchObject({ revision: 8, accepted: 1 });
    expect(started.value.read().controller).toMatchObject({ kind: "emit", cell: SLOT.ACCEPT, signedWeight: 2 });
    expect(root.mount.attributes.get("data-controller-cell")).toBe(SLOT.ACCEPT.toString());
    expect(root.mount.innerHTML).toContain(`data-cell="${SLOT.ACCEPT.toString()}"`);
    expect(root.mount.innerHTML).toContain('data-selected="true"');

    expect(started.value.read()).toMatchObject({
      editor: { resolved: 2, nextEventSequence: 2, last: { kind: "emit", outcome: "resolved" } },
      controller: { kind: "emit", cell: SLOT.ACCEPT, signedWeight: 2 },
      input: { accepted: 4, last: { cell: SLOT.ACCEPT, outcome: "accepted" } },
    });
    expect(root.serviceWorker.messages).toContainEqual({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: "zeta-darkhall-browser-node",
      kind: "database-invalidated",
      invalidation: {
        sourceTabId: "tab-a",
        databaseNodeId: "zeta-darkhall-browser-node:database",
        revision: 8,
      },
    });
    expect(root.serviceWorker.messages).toContainEqual({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: "zeta-darkhall-browser-node",
      kind: "database-execution-receipt",
      receipt: {
        sourceTabId: "tab-a",
        databaseNodeId: "zeta-darkhall-browser-node:database",
        intentId: "tab-a/row-command/1",
        sequence: 1,
        status: "settled",
        revision: 8,
        accepted: 1,
        duplicates: 0,
      },
    });
    expect(root.mount.attributes.get("data-database-outbox-latest-status")).toBe("none");
    expect(root.mount.attributes.get("data-database-outbox-latest-intent")).toBe("none");
    expect(root.mount.attributes.get("data-database-outbox-latest-revision")).toBe("none");

    root.serviceWorker.dispatch({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: "zeta-darkhall-browser-node",
      kind: "database-execution-receipt",
      receipt: {
        sourceTabId: "tab-b",
        databaseNodeId: "zeta-darkhall-browser-node:database",
        intentId: "tab-b/row-command/4",
        sequence: 4,
        status: "settled",
        revision: 9,
        accepted: 0,
        duplicates: 1,
      },
    });
    expect(root.mount.attributes.get("data-database-peer-receipt-status")).toBe("settled");
    expect(root.mount.attributes.get("data-database-peer-receipt-intent")).toBe("tab-b/row-command/4");
    expect(root.mount.attributes.get("data-database-peer-receipt-revision")).toBe("9");
    expect(root.mount.attributes.get("data-database-peer-receipt-source")).toBe("tab-b");

    expect(started.value.stop()).toMatchObject({ ok: true, value: { status: "stopped" } });
    expect(root.mount.attributes.get("data-pwa-status")).toBe("stopped");
    expect(root.mount.attributes.get("data-controller-input-status")).toBe("stopped");
    expect(root.mount.attributes.get("data-database-selection-status")).toBe("stopped");
    expect(root.editor.attributes.get("data-row-command-status")).toBe("stopped");
    expect(root.mount.innerHTML).toMatch(/data-action-id="darkhall\.database\.emit"[^>]* disabled>/u);
    expect(root.mount.innerHTML).toMatch(/data-action-id="darkhall\.database\.retract"[^>]* disabled>/u);
    expect(root.mount.innerHTML).toMatch(/data-action-id="darkhall\.database\.replace"[^>]* disabled>/u);
    expect(root.mount.listeners.get("click")?.size ?? 0).toBe(0);
    expect(root.documentListeners.get("keydown")?.size ?? 0).toBe(0);
    expect(root.editor.listeners.get("input")?.size ?? 0).toBe(0);
  });

  test("recovers durable pending database work before the first hydration read", async () => {
    const root = new NativeBrowserRoot();
    const outbox = databaseIntentOutbox();
    const enqueued = await outbox.enqueue({
      databaseNodeId: "zeta-darkhall-browser-node:database",
      intentId: "event/recovered",
      expectedRevision: null,
      deltas: [{ eventId: "event/recovered", rowKey: "game/score", payload: "17", weight: 1 }],
    });
    expect(enqueued.ok).toBe(true);
    const requests: ZetaDbTickRequest[] = [];

    const started = await startNativeDarkHallBrowserPage({
      root,
      databaseIntentOutbox: outbox,
      databaseReceiptArchive: databaseReceiptArchive(),
      databaseExecutor: (request) => {
        requests.push(request);
        return Promise.resolve({ ok: true, value: databaseReadout(request, 1, "17") });
      },
    });

    expect(started).toMatchObject({ ok: true, value: {} });
    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({
      requireComplete: true,
      deltas: [{ eventId: "event/recovered", rowKey: "game/score", payload: "17", weight: 1 }],
    });
    expect(requests[1]?.deltas).toEqual([]);
    expect(root.mount.attributes.get("data-database-outbox-queued")).toBe("0");
    expect(root.mount.attributes.get("data-database-outbox-executing")).toBe("0");
    expect(root.mount.attributes.get("data-database-outbox-settled")).toBe("0");
    expect(root.mount.attributes.get("data-database-outbox-refused")).toBe("0");
    expect(root.mount.attributes.get("data-database-outbox-latest-intent")).toBe("none");
    expect(root.mount.attributes.get("data-database-outbox-latest-revision")).toBe("none");
    if (started.ok) expect(started.value.stop().ok).toBe(true);
  });

  test("recovers pending database work when a peer tab becomes dark", async () => {
    const root = new NativeBrowserRoot();
    const outbox = databaseIntentOutbox();
    const requests: ZetaDbTickRequest[] = [];
    const started = await startNativeDarkHallBrowserPage({
      root,
      databaseIntentOutbox: outbox,
      databaseReceiptArchive: databaseReceiptArchive(),
      databaseExecutor: (request) => {
        requests.push(request);
        return Promise.resolve({ ok: true, value: databaseReadout(request, request.deltas.length > 0 ? 1 : 0, "23") });
      },
    });
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const enqueued = await outbox.enqueue({
      databaseNodeId: "zeta-darkhall-browser-node:database",
      intentId: "event/peer-dark",
      expectedRevision: null,
      deltas: [{ eventId: "event/peer-dark", rowKey: "game/score", payload: "23", weight: 1 }],
    });
    expect(enqueued.ok).toBe(true);

    root.serviceWorker.dispatch({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: "zeta-darkhall-browser-node",
      kind: "presence",
      presence: { tabId: "tab-b", sequence: 1, state: "foreground" },
    });
    root.serviceWorker.dispatch({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: "zeta-darkhall-browser-node",
      kind: "presence",
      presence: { tabId: "tab-b", sequence: 2, state: "dark" },
    });
    await waitFor(() => requests.length === 2);
    await waitFor(() => root.mount.attributes.get("data-database-outbox-recovery") === "complete");

    expect(requests[1]).toMatchObject({
      requireComplete: true,
      deltas: [{ eventId: "event/peer-dark", rowKey: "game/score", payload: "23", weight: 1 }],
    });
    expect(await outbox.read("zeta-darkhall-browser-node:database")).toMatchObject({
      ok: true,
      value: { queued: 0, executing: 0, settled: 0, refused: 0 },
    });
    expect(started.value.stop().ok).toBe(true);
  });

  test("mints a per-tab identity when the active URL does not provide one", async () => {
    const root = new NativeBrowserRoot();
    root.location.search = "";
    const started = await startNativeDarkHallBrowserPage({
      root,
      databaseIntentOutbox: databaseIntentOutbox(),
      databaseReceiptArchive: databaseReceiptArchive(),
      databaseExecutor,
    });

    expect(started).toMatchObject({ ok: true, value: {} });
    if (started.ok) {
      expect(started.value.read().tabId).toBe("tab-minted-tab");
      expect(started.value.stop().ok).toBe(true);
    }
  });

  test("refuses live status when the finite database hydration is backpressured", async () => {
    const root = new NativeBrowserRoot();
    const result = await startNativeDarkHallBrowserPage({
      root,
      databaseIntentOutbox: databaseIntentOutbox(),
      databaseExecutor: () =>
        Promise.resolve({
          ok: false,
          feedback: {
            severity: "backpressure",
            code: "database-read-failed",
            detail: "The persisted image is temporarily unavailable.",
          },
        }),
    });

    expect(result).toMatchObject({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "page-database-hydration-failed",
      },
    });
    expect(root.mount.attributes.get("data-pwa-status")).toBe("backpressured");
    expect(root.mount.attributes.get("data-pwa-detail")).toBe("page-database-hydration-failed");
  });

  test("backpressures startup when cross-tab execution admission is unavailable", async () => {
    const root = new NativeBrowserRoot();
    Reflect.deleteProperty(root.navigator, "locks");

    const result = await startNativeDarkHallBrowserPage({ root, databaseExecutor });

    expect(result).toMatchObject({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "page-database-start-failed",
        detail: expect.stringContaining("execution-admission-unavailable") as unknown as string,
      },
    });
    expect(root.mount.attributes.get("data-pwa-status")).toBe("backpressured");
    expect(root.serviceWorker.registrations).toHaveLength(0);
  });

  test("drains a peer invalidation queued while startup hydration is still running", async () => {
    const root = new NativeBrowserRoot();
    const requests: ZetaDbTickRequest[] = [];
    const hydrationGate: { release?: () => void } = {};
    const starting = startNativeDarkHallBrowserPage({
      root,
      databaseIntentOutbox: databaseIntentOutbox(),
      databaseReceiptArchive: databaseReceiptArchive(),
      databaseExecutor: (request) => {
        requests.push(request);
        if (requests.length > 1) {
          return Promise.resolve({ ok: true, value: databaseReadout(request, 9, "9010") });
        }
        return new Promise((resolve) => {
          hydrationGate.release = () => {
            resolve({ ok: true, value: databaseReadout(request) });
          };
        });
      },
    });
    while (hydrationGate.release === undefined) await Promise.resolve();

    root.serviceWorker.dispatch({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: "zeta-darkhall-browser-node",
      kind: "database-invalidated",
      invalidation: {
        sourceTabId: "tab-b",
        databaseNodeId: "zeta-darkhall-browser-node:database",
        revision: 9,
      },
    });
    hydrationGate.release();

    const started = await starting;
    expect(started).toMatchObject({ ok: true, value: {} });
    expect(requests).toHaveLength(2);
    expect(requests[1]?.deltas).toEqual([]);
    if (started.ok) {
      expect(started.value.read()).toMatchObject({
        status: "live",
        database: { revision: 9, executorId: "tab-a", rows: [{ payload: "9010" }] },
      });
      expect(started.value.stop().ok).toBe(true);
    }
  });

  test("keeps signed submission on the explicit control while lifecycle events only poll acceptance", async () => {
    const root = new NativeBrowserRoot();
    const sync = databaseReceiptSync();
    const started = await startNativeDarkHallBrowserPage({
      root,
      databaseIntentOutbox: databaseIntentOutbox(),
      databaseReceiptArchive: databaseReceiptArchive(),
      databaseReceiptSync: sync.runtime,
      databaseExecutor,
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    await waitFor(() => sync.calls.polls === 1);
    expect(sync.calls).toEqual({ submissions: 0, polls: 1 });
    expect(started.value.read()).toMatchObject({
      receiptHandoff: null,
      receiptSync: {
        status: "live",
        polls: 1,
        submissions: 0,
        synchronization: { status: "pending", receiptCount: 2 },
        last: { operation: "poll", trigger: "startup" },
      },
    });

    root.receiptSync.click();
    await waitFor(() => sync.calls.submissions === 1);
    expect(sync.calls).toEqual({ submissions: 1, polls: 1 });
    expect(root.receiptSync.attributes.get("data-receipt-sync-trigger")).toBe("user-activation");

    root.emitDocument("visibilitychange", {});
    await waitFor(() => sync.calls.polls === 2);
    expect(sync.calls).toEqual({ submissions: 1, polls: 2 });
    expect(root.receiptSync.attributes.get("data-receipt-sync-trigger")).toBe("visibilitychange");
    expect(started.value.stop().ok).toBe(true);
  });

  test("selects the source-owned native receipt synchronization path when the browser supports every edge", async () => {
    const root = new NativeBrowserRoot();
    const fetches: { readonly input: string; readonly init: RequestInit }[] = [];
    enableNativeReceiptSync(root, (input, init) => {
      fetches.push({ input: input.toString(), init: init ?? {} });
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const maintenance: BrowserDatabaseReceiptArchiveMaintenancePort = {
      read: () =>
        Promise.resolve({
          ok: true,
          value: {
            schema: "zeta.browser-database-receipt-archive-snapshot.v1",
            databaseNodeId: "zeta-darkhall-browser-node:database",
            archiveNodeId: "zeta-darkhall-browser-node:database:receipts",
            archiveRevision: 1,
            receiptPayloadBytes: 64,
            limits: { maxDeltas: 1, maxEntries: 8, maxCheckpointBytes: 32 * 1024 },
            receipts: [
              {
                schema: "zeta.browser-database-execution-receipt.v1",
                databaseNodeId: "zeta-darkhall-browser-node:database",
                intentId: "event/0",
                sequence: 0,
                status: "settled",
                executorId: "tab-a",
                executorKind: "browser-tab",
                revision: 1,
                accepted: 1,
                duplicates: 0,
                deltaCount: 1,
              },
            ],
            generation: null,
          },
        }),
      compactGeneration: () => Promise.reject(new Error("an absent accepted record must not compact")),
    };
    const started = await startNativeDarkHallBrowserPage({
      root,
      databaseIntentOutbox: databaseIntentOutbox(),
      databaseReceiptArchive: databaseReceiptArchive(),
      databaseReceiptArchiveMaintenance: maintenance,
      databaseReceiptHandoffLimits: { minimumReceipts: 1, maxReceipts: 8, maxBatchBytes: 32 * 1024 },
      databaseExecutor,
    });

    expect(started.ok).toBe(true);
    if (!started.ok) return;
    await waitFor(() => started.value.read().receiptSync?.last !== null);
    expect(started.value.read()).toMatchObject({
      receiptHandoff: null,
      receiptSync: {
        status: "live",
        synchronization: { status: "pending", receiptCount: 1 },
        last: { operation: "poll", trigger: "startup", outcome: "complete" },
      },
    });
    expect(fetches[0]).toMatchObject({
      input: "https://lucent-financial-group.github.io/Zeta/hall/room/data/browser-receipts/index.json",
      init: { method: "GET", credentials: "omit", cache: "no-store", redirect: "error" },
    });
    root.receiptSync.click("enroll");
    await waitFor(() => started.value.read().receiptSync?.enrollments === 1);
    expect(started.value.read().receiptSync).toMatchObject({
      enrollments: 1,
      enrollment: {
        schema: "zeta.proposal-passkey-enrollment.v1",
        credentialId: Buffer.from([7, 8, 9]).toString("base64url"),
      },
      last: { operation: "enroll", trigger: "user-activation", outcome: "complete" },
    });
    expect(root.receiptSync.enrollmentOutput.textContent).toContain('"schema": "zeta.proposal-passkey-enrollment.v1"');
    expect(started.value.stop().ok).toBe(true);
  });

  test("refuses signed synchronization beside the legacy direct handoff", async () => {
    const root = new NativeBrowserRoot();
    const sync = databaseReceiptSync();
    const result = await startNativeDarkHallBrowserPage({
      root,
      databaseIntentOutbox: databaseIntentOutbox(),
      databaseReceiptArchive: databaseReceiptArchive(),
      databaseReceiptSync: sync.runtime,
      databaseReceiptHandoff: {
        read: () => ({
          schema: "zeta.browser-database-receipt-handoff-readout.v1",
          status: "idle",
          databaseNodeId: "db",
          archiveNodeId: "archive",
          targetNodeId: "target",
          archiveRevision: 0,
          retainedReceipts: 0,
          releasedReceipts: 0,
          receiptPayloadBytes: 0,
          highWaterSequence: null,
          contentHash: null,
          disposition: null,
          feedback: null,
        }),
        handoff: () => Promise.reject(new Error("must not run")),
      },
      databaseExecutor,
    });

    expect(result).toMatchObject({
      ok: false,
      feedback: {
        code: "page-configuration-invalid",
        detail: "Signed receipt synchronization cannot share the page with a direct receipt handoff or receipt peer.",
      },
    });
    expect(sync.calls).toEqual({ submissions: 0, polls: 0 });
  });

  test("refuses invalid page configuration before registering a worker", async () => {
    const root = new NativeBrowserRoot();
    root.location.search = "?tab=tab-a&sequence=-1";

    const result = await startNativeDarkHallBrowserPage({ root });
    expect(result).toMatchObject({
      ok: false,
      feedback: { code: "page-configuration-invalid" },
    });
    expect(root.serviceWorker.registrations).toHaveLength(0);
    expect(root.mount.innerHTML).toBe("standing room");
  });

  test("refuses a receipt peer that aliases the local tab", async () => {
    const root = new NativeBrowserRoot();
    root.location.search = "?tab=tab-a&sequence=12&receipt-peer=tab-a";

    const result = await startNativeDarkHallBrowserPage({
      root,
      databaseIntentOutbox: databaseIntentOutbox(),
      databaseReceiptArchive: databaseReceiptArchive(),
      databaseExecutor,
    });

    expect(result).toMatchObject({
      ok: false,
      feedback: {
        code: "page-configuration-invalid",
        detail: "A browser receipt peer must differ from the local tab identity.",
      },
    });
  });

  test("ACCEPTS an explicit sequence of 0 — the boundary the other cases step over", async () => {
    // `initialSequence` guards with `sequence >= 0`, and 0 is the only value that separates
    // that from `> 0`. The suite exercised 12 (accepted) and -1 (refused), both of which stay
    // on the same side under either guard; omitting the query parameter does not reach the
    // check at all, since a null value returns 0 early. So a fresh page — sequence 0 is the
    // legitimate STARTING value — could have been rejected as "not a non-negative safe
    // integer" with nothing to notice. Found by the mutation runner (gte-to-gt, tick 11223).
    const root = new NativeBrowserRoot();
    root.location.search = "?tab=tab-a&sequence=0";

    const result = await startNativeDarkHallBrowserPage({
      root,
      databaseIntentOutbox: databaseIntentOutbox(),
      databaseReceiptArchive: databaseReceiptArchive(),
      databaseExecutor,
    });
    expect(result.ok).toBe(true);
    expect(root.serviceWorker.messages.filter((message) => message.kind === "presence")).toContainEqual({
      schema: BROWSER_TAB_COORDINATOR_SCHEMA,
      nodeId: "zeta-darkhall-browser-node",
      kind: "presence",
      presence: { tabId: "tab-a", sequence: 0, state: "foreground" },
    });
    if (result.ok) expect(result.value.stop().ok).toBe(true);
  });

  test("refuses a missing mount without touching the worker edge", async () => {
    const root = new NativeBrowserRoot();

    const result = await startNativeDarkHallBrowserPage({ root, mountId: "missing" });
    expect(result).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "page-mount-unavailable",
        detail: "The active browser page is missing mount #missing.",
      },
    });
    expect(root.serviceWorker.registrations).toHaveLength(0);
  });

  test("refuses a missing row command editor before touching the worker edge", async () => {
    const root = new NativeBrowserRoot();
    root.editorAvailable = false;

    const result = await startNativeDarkHallBrowserPage({ root });
    expect(result).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "page-editor-start-failed",
        detail: "The active browser page is missing row command editor #darkhall-row-command-editor.",
      },
    });
    expect(root.serviceWorker.registrations).toHaveLength(0);
  });

  test("renders a manifest-owned active document with only an external module", () => {
    const document = renderDarkHallBrowserNodeDocument();

    expect(document).toContain('<link rel="manifest" href="./manifest.webmanifest">');
    expect(document).toContain('<section id="darkhall-receipt-sync" class="zeta-receipt-sync"');
    expect(document).toContain("data-receipt-sync-enroll");
    expect(document).toContain("data-receipt-sync-submit");
    expect(document).toContain('<section id="darkhall-row-command-editor" class="zeta-row-command-editor"');
    expect(document).toContain("data-row-command-key");
    expect(document).toContain("data-row-command-payload");
    expect(document).toContain("data-row-command-magnitude");
    expect(document).toContain('<main id="darkhall-room" data-pwa-status="starting"');
    expect(document).toContain('class="zeta-room-heat" data-empty="true"');
    expect(document).toContain('<p class="zeta-room-cold">cold</p>');
    expect(document).toContain('<script type="module" src="./darkhall-browser-page.js"></script>');
    expect(document).toContain('href="./">&larr; static room</a>');
    expect(document).not.toMatch(/<script(?! type="module" src="\.\/darkhall-browser-page\.js")/u);
    expect(document).not.toMatch(/setInterval|requestAnimationFrame|performance\.now|Date\./u);
  });

  test("renders database actions in the canonical universal controller slots", () => {
    const document = renderDarkHallBrowserNodeDocument();

    expect(document).toContain(`data-cell="${SLOT.ACCEPT.toString()}"`);
    expect(document).toContain("darkhall.database.emit");
    expect(document).toContain(`data-cell="${SLOT.INSPECT.toString()}"`);
    expect(document).toContain("darkhall.database.inspect");
    expect(document).toContain(`data-cell="${SLOT.UNDO_RETRACT.toString()}"`);
    expect(document).toContain("darkhall.database.retract");
    expect(document).toContain(`data-cell="${SLOT.EDIT_GRAMMAR.toString()}"`);
    expect(document).toContain("darkhall.database.replace");
    expect(document).toContain(`data-cell="${SLOT.REFRESH.toString()}"`);
    expect(document).toContain("darkhall.database.refresh");
    expect(document).toContain('class="zeta-room-cell-input"');
    expect(document).toContain('data-controller-cell="6"');
    expect(document).toContain('aria-keyshortcuts="C"');
  });
});
