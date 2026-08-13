#!/usr/bin/env bun

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import type { BrowserLifecycleHostReadout } from "./browser-lifecycle-host";
import type { BrowserServiceWorkerRegistrationReadout } from "./browser-service-worker-registration";
import type { BrowserTabTransportReadout } from "./browser-tab-channel-selector";
import type { BrowserDatabaseReceiptHandoffReadout } from "./browser-database-receipt-handoff";
import type {
  BrowserDatabaseReceiptBroadcastReadout,
  BrowserDatabaseReceiptBroadcastReceiverHost,
} from "./browser-database-receipt-broadcast-channel";
import { buildBrowserPwaAssets } from "./browser-pwa-build";
import type { DarkHallDatabaseReadout } from "../darkhall-ui/darkhall-database-readout";
import type { DarkHallBrowserDatabaseControllerReadout } from "../darkhall-ui/darkhall-browser-database-controller";
import type { DarkHallBrowserControllerInputReadout } from "../darkhall-ui/darkhall-browser-controller-input";
import type { DarkHallBrowserDatabaseRowSelectionReadout } from "../darkhall-ui/darkhall-browser-database-row-selection";
import type { DarkHallBrowserRowCommandEditorReadout } from "../darkhall-ui/darkhall-browser-row-command-editor";

export const BROWSER_PWA_SMOKE_SCHEMA = "zeta.browser-pwa-smoke.v8" as const;

interface BrowserPwaPageReadout {
  readonly registration: BrowserServiceWorkerRegistrationReadout;
  readonly transport: BrowserTabTransportReadout;
  readonly host: BrowserLifecycleHostReadout;
  readonly database: DarkHallDatabaseReadout;
  readonly receiptHandoff: BrowserDatabaseReceiptHandoffReadout | null;
  readonly editor: DarkHallBrowserRowCommandEditorReadout;
  readonly selection: DarkHallBrowserDatabaseRowSelectionReadout;
  readonly input: DarkHallBrowserControllerInputReadout;
  readonly renderedTransport: string | null;
  readonly renderedDatabaseRevision: string | null;
  readonly renderedDatabaseRows: readonly {
    readonly rowKey: string | null;
    readonly payload: string | null;
    readonly weight: string | null;
  }[];
}

interface BrowserPwaPageGlobal {
  readonly __zetaDarkHallPage?:
    | {
        readonly ok: true;
        readonly value: {
          read(): {
            readonly registration: BrowserServiceWorkerRegistrationReadout;
            readonly transport: BrowserTabTransportReadout;
            readonly host: BrowserLifecycleHostReadout;
            readonly database: DarkHallDatabaseReadout;
            readonly receiptHandoff: BrowserDatabaseReceiptHandoffReadout | null;
            readonly controller: DarkHallBrowserDatabaseControllerReadout | null;
            readonly editor: DarkHallBrowserRowCommandEditorReadout;
            readonly selection: DarkHallBrowserDatabaseRowSelectionReadout;
            readonly input: DarkHallBrowserControllerInputReadout;
          };
          dispatchController(command: {
            readonly kind: "emit";
            readonly eventId: string;
            readonly rowKey: string;
            readonly payload: string;
          }): Promise<{ readonly ok: boolean; readonly feedback?: { readonly detail: string } }>;
          stop(): unknown;
        };
      }
    | { readonly ok: false; readonly feedback: { readonly detail: string } };
}

interface BrowserReceiptBroadcastGlobal {
  readonly __zetaReceiptBroadcastReceiver?: BrowserDatabaseReceiptBroadcastReceiverHost;
}

export interface BrowserPwaSmokeTranscript {
  readonly schema: typeof BROWSER_PWA_SMOKE_SCHEMA;
  readonly beforeStop: {
    readonly pageA: BrowserPwaPageReadout;
    readonly pageB: BrowserPwaPageReadout;
  };
  readonly afterStop: {
    readonly pageA: BrowserPwaPageReadout;
  };
  readonly database: {
    readonly writerCommand: DarkHallBrowserDatabaseControllerReadout;
    readonly retractionCommand: DarkHallBrowserDatabaseControllerReadout;
    readonly writerEditor: DarkHallBrowserRowCommandEditorReadout;
    readonly writerSelection: DarkHallBrowserDatabaseRowSelectionReadout;
    readonly peerAfterWrite: BrowserPwaPageReadout;
    readonly freshPage: BrowserPwaPageReadout;
    readonly completedReceiptHandoff: BrowserDatabaseReceiptHandoffReadout;
    readonly successorReceiptHandoff: BrowserDatabaseReceiptHandoffReadout;
  };
  readonly controllerInput: {
    readonly pointer: DarkHallBrowserControllerInputReadout;
    readonly keyboard: DarkHallBrowserControllerInputReadout;
  };
  readonly receiptBroadcast: {
    readonly response: readonly number[];
    readonly sender: BrowserDatabaseReceiptBroadcastReadout;
    readonly receiver: BrowserDatabaseReceiptBroadcastReadout;
  };
}

export interface BrowserPwaSmokeFeedback {
  readonly severity: "heat";
  readonly code: "build-failed" | "browser-launch-failed" | "smoke-failed" | "assertion-failed";
  readonly detail: string;
}

export type BrowserPwaSmokeResult =
  | { readonly ok: true; readonly value: BrowserPwaSmokeTranscript }
  | { readonly ok: false; readonly feedback: BrowserPwaSmokeFeedback };

type BrowserPwaSmokeFailure = Extract<BrowserPwaSmokeResult, { readonly ok: false }>;

const timeoutMs = 10_000;

function failed(code: BrowserPwaSmokeFeedback["code"], detail: string): BrowserPwaSmokeFailure {
  return { ok: false, feedback: { severity: "heat", code, detail } };
}

function detail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function response(body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      "cache-control": "no-store",
      "content-type": contentType,
      "service-worker-allowed": "/",
    },
  });
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      if (started?.ok !== true) return false;
      const readout = started.value.read();
      return (
        readout.registration.status === "controlled" &&
        readout.transport.selected === "service-worker" &&
        readout.database.revision >= 0
      );
    },
    undefined,
    { timeout: timeoutMs },
  );
}

async function waitForDatabase(page: Page, revision: number, payload: string): Promise<void> {
  await page.waitForFunction(
    ([expectedRevision, expectedPayload]) => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      if (started?.ok !== true) return false;
      const database = started.value.read().database;
      return (
        database.revision === expectedRevision &&
        database.rows.some((row) => row.rowKey === "game/score" && row.payload === expectedPayload && row.weight === 1)
      );
    },
    [revision, payload],
    { timeout: timeoutMs },
  );
}

async function waitForDatabaseRevision(page: Page, revision: number): Promise<void> {
  await page.waitForFunction(
    (expectedRevision) => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      return started?.ok === true && started.value.read().database.revision === expectedRevision;
    },
    revision,
    { timeout: timeoutMs },
  );
}

async function waitForDatabaseWithoutScore(page: Page, revision: number): Promise<void> {
  await page.waitForFunction(
    (expectedRevision) => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      if (started?.ok !== true) return false;
      const database = started.value.read().database;
      return database.revision === expectedRevision && !database.rows.some((row) => row.rowKey === "game/score");
    },
    revision,
    { timeout: timeoutMs },
  );
}

async function completeReceiptGeneration(page: Page, firstRevision: number, finalRevision: number): Promise<void> {
  await page.evaluate(
    async ({ first, final }: { readonly first: number; readonly final: number }) => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      if (started?.ok !== true) throw new Error("The page did not expose its active runtime.");
      for (let revision = first; revision <= final; revision += 1) {
        const result = await started.value.dispatchController({
          kind: "emit",
          eventId: `browser-smoke/receipt-handoff/${revision.toString()}`,
          rowKey: "game/score",
          payload: "9000",
        });
        if (!result.ok)
          throw new Error(result.feedback?.detail ?? `Receipt generation failed at ${revision.toString()}.`);
      }
    },
    { first: firstRevision, final: finalRevision },
  );
  await page.waitForFunction(
    (revision) => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      if (started?.ok !== true) return false;
      const readout = started.value.read();
      return (
        readout.database.revision === revision &&
        readout.receiptHandoff?.status === "complete" &&
        readout.receiptHandoff.releasedReceipts === revision &&
        readout.receiptHandoff.retainedReceipts === 0
      );
    },
    finalRevision,
    { timeout: timeoutMs },
  );
}

async function waitForTwoTabs(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      return (
        started?.ok === true && started.value.read().host.coordinator.liveness.liveTabIds.join(",") === "tab-a,tab-b"
      );
    },
    undefined,
    { timeout: timeoutMs },
  );
}

async function waitForSurvivor(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      return (
        started?.ok === true &&
        started.value.read().host.coordinator.liveness.liveTabIds.join(",") === "tab-a" &&
        started.value.read().host.coordinator.liveness.darkTabIds.includes("tab-b")
      );
    },
    undefined,
    { timeout: timeoutMs },
  );
}

async function waitForControllerInput(page: Page, source: "keyboard" | "pointer", cell: number): Promise<void> {
  await page.waitForFunction(
    ([expectedSource, expectedCell]) => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      if (started?.ok !== true) return false;
      const input = started.value.read().input;
      const last = input.last;
      return input.accepted >= 1 && last !== null && last.source === expectedSource && last.cell === expectedCell;
    },
    [source, cell],
    { timeout: timeoutMs },
  );
}

async function readControllerInput(page: Page, pageName: string): Promise<DarkHallBrowserControllerInputReadout> {
  return page.evaluate((name) => {
    const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
    if (started?.ok !== true) throw new Error(`${name} did not expose its active runtime.`);
    return started.value.read().input;
  }, pageName);
}

async function waitForRowCommand(
  page: Page,
  kind: "emit" | "retract",
  revision: number,
  resolved: number,
): Promise<void> {
  await page.waitForFunction(
    ([expectedKind, expectedRevision, expectedResolved]) => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      if (started?.ok !== true) return false;
      const readout = started.value.read();
      const controller = readout.controller;
      return (
        controller !== null &&
        controller.kind === expectedKind &&
        controller.database.revision === expectedRevision &&
        readout.editor.resolved === expectedResolved &&
        readout.input.inFlight === 0
      );
    },
    [kind, revision, resolved],
    { timeout: timeoutMs },
  );
}

async function waitForRowSelection(page: Page, rowKey: string, selected: number): Promise<void> {
  await page.waitForFunction(
    ({ expectedRowKey, expectedSelected }: { readonly expectedRowKey: string; readonly expectedSelected: number }) => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      if (started?.ok !== true) return false;
      const readout = started.value.read();
      return (
        readout.selection.selected === expectedSelected &&
        readout.selection.selectedRowKey === expectedRowKey &&
        readout.editor.rowKey === expectedRowKey &&
        readout.editor.loadedRowKey === expectedRowKey &&
        readout.editor.validity === "ready"
      );
    },
    { expectedRowKey: rowKey, expectedSelected: selected },
    { timeout: timeoutMs },
  );
}

async function observe(page: Page, pageName: string): Promise<BrowserPwaPageReadout> {
  const observation = await page.evaluate(() => {
    const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
    if (started === undefined) {
      return {
        location: globalThis.location.href,
        readyState: globalThis.document.readyState,
        readout: null,
      };
    }
    if (!started.ok) {
      return {
        location: globalThis.location.href,
        readyState: globalThis.document.readyState,
        readout: started,
      };
    }
    const readout = started.value.read();
    return {
      location: globalThis.location.href,
      readyState: globalThis.document.readyState,
      readout: {
        ok: true as const,
        value: {
          registration: readout.registration,
          transport: readout.transport,
          host: readout.host,
          database: readout.database,
          receiptHandoff: readout.receiptHandoff,
          editor: readout.editor,
          selection: readout.selection,
          input: readout.input,
          renderedTransport:
            globalThis.document.querySelector("[data-browser-transport]")?.getAttribute("data-browser-transport") ??
            null,
          renderedDatabaseRevision:
            globalThis.document.querySelector(".zeta-room-database")?.getAttribute("data-database-revision") ?? null,
          renderedDatabaseRows: [...globalThis.document.querySelectorAll(".zeta-database-row")].map((row) => ({
            rowKey: row.getAttribute("data-row-key"),
            payload: row.querySelector(".zeta-database-row-payload")?.textContent ?? null,
            weight: row.getAttribute("data-row-weight"),
          })),
        },
      },
    };
  });
  const readout = observation.readout;
  if (readout === null) {
    throw new Error(
      `${pageName} did not expose its PWA readout at ${observation.location} (${observation.readyState}).`,
    );
  }
  if (!readout.ok) throw new Error(readout.feedback.detail);
  return readout.value;
}

function validateStartingPage(pageName: string, page: BrowserPwaPageReadout, failures: string[]): void {
  if (page.registration.status !== "controlled") failures.push(`${pageName} was not worker-controlled`);
  if (page.transport.selected !== "service-worker") failures.push(`${pageName} did not select the worker channel`);
  if (page.renderedTransport !== "service-worker") failures.push(`${pageName} did not render its transport`);
  if (page.database.revision !== 0 || page.database.rows.length !== 0) {
    failures.push(`${pageName} did not start from the empty database image`);
  }
  if (page.renderedDatabaseRevision !== "0") failures.push(`${pageName} did not render startup hydration`);
  if (page.editor.status !== "live" || page.editor.validity !== "incomplete") {
    failures.push(`${pageName} did not expose a cold live row command editor`);
  }
  if (page.selection.status !== "live" || page.selection.selected !== 0) {
    failures.push(`${pageName} did not expose a cold live row selection surface`);
  }
  if (page.host.coordinator.liveness.liveTabIds.join(",") !== "tab-a,tab-b") {
    failures.push(`${pageName} did not observe both tabs`);
  }
}

function validateStartingPages(transcript: BrowserPwaSmokeTranscript, failures: string[]): void {
  validateStartingPage("page A", transcript.beforeStop.pageA, failures);
  validateStartingPage("page B", transcript.beforeStop.pageB, failures);
}

function validateContinuityAndInput(transcript: BrowserPwaSmokeTranscript, failures: string[]): void {
  if (transcript.afterStop.pageA.host.coordinator.liveness.liveTabIds.join(",") !== "tab-a") {
    failures.push(
      `page A did not remain live after page B stopped: ${transcript.afterStop.pageA.host.coordinator.liveness.liveTabIds.join(",")}`,
    );
  }
  if (
    transcript.controllerInput.pointer.last?.source !== "pointer" ||
    transcript.controllerInput.pointer.last.cell !== 6 ||
    transcript.controllerInput.pointer.last.actionId !== "darkhall.database.inspect" ||
    transcript.controllerInput.pointer.last.outcome !== "accepted"
  ) {
    failures.push(
      `page B did not route pointer activation through controller cell 6: ${JSON.stringify(transcript.controllerInput.pointer.last)}`,
    );
  }
  if (
    transcript.controllerInput.keyboard.last?.source !== "keyboard" ||
    transcript.controllerInput.keyboard.last.cell !== 12 ||
    transcript.controllerInput.keyboard.last.actionId !== "darkhall.database.refresh" ||
    transcript.controllerInput.keyboard.last.outcome !== "accepted"
  ) {
    failures.push(
      `page A did not route keyboard KeyC through controller cell 12: ${JSON.stringify(transcript.controllerInput.keyboard.last)}`,
    );
  }
  if (!transcript.afterStop.pageA.host.coordinator.liveness.darkTabIds.includes("tab-b")) {
    failures.push(
      `page A did not retain page B's stopped state: ${transcript.afterStop.pageA.host.coordinator.liveness.darkTabIds.join(",")}`,
    );
  }
}

function validateDatabaseCommands(transcript: BrowserPwaSmokeTranscript, failures: string[]): void {
  if (
    transcript.database.writerCommand.kind !== "emit" ||
    transcript.database.writerCommand.signedWeight !== 1 ||
    transcript.database.writerCommand.database.revision !== 3 ||
    transcript.database.writerCommand.database.accepted !== 1
  ) {
    failures.push(
      `page B did not route its final editor emit through the controller boundary: ${JSON.stringify(transcript.database.writerCommand)}`,
    );
  }
  if (
    transcript.database.retractionCommand.kind !== "retract" ||
    transcript.database.retractionCommand.signedWeight !== -1 ||
    transcript.database.retractionCommand.database.revision !== 2 ||
    transcript.database.retractionCommand.database.rows.some((row) => row.rowKey === "game/score")
  ) {
    failures.push(
      `page B did not route editor retraction through the controller boundary: ${JSON.stringify(transcript.database.retractionCommand)}`,
    );
  }
  if (
    transcript.database.writerEditor.validity !== "ready" ||
    transcript.database.writerEditor.resolved !== 3 ||
    transcript.database.writerEditor.loaded !== 1 ||
    transcript.database.writerEditor.loadedRowKey !== "game/score" ||
    transcript.database.writerEditor.nextEventSequence !== 3 ||
    transcript.database.writerEditor.last?.eventId !== "tab-b/row-command/2"
  ) {
    failures.push("page B did not retain deterministic row-command editor sequencing");
  }
  if (
    transcript.database.writerSelection.selected !== 1 ||
    transcript.database.writerSelection.selectedRowKey !== "game/score" ||
    transcript.database.writerSelection.last?.source !== "pointer" ||
    transcript.database.writerSelection.last.outcome !== "selected"
  ) {
    failures.push(
      `page B did not preload the editor from a typed materialized row: ${JSON.stringify(transcript.database.writerSelection)}`,
    );
  }
}

function validateHydration(transcript: BrowserPwaSmokeTranscript, failures: string[]): void {
  for (const [pageName, page, executorId] of [
    ["peer page A", transcript.database.peerAfterWrite, "tab-a"],
    ["fresh page C", transcript.database.freshPage, "tab-c"],
  ] as const) {
    if (page.database.revision !== 3 || page.database.executorId !== executorId) {
      failures.push(
        `${pageName} did not read revision 3 through its own browser-tab executor: ${JSON.stringify(page.database)}`,
      );
    }
    if (!page.database.rows.some((row) => row.rowKey === "game/score" && row.payload === "9000" && row.weight === 1)) {
      failures.push(`${pageName} did not reconstruct the persisted score row: ${JSON.stringify(page.database.rows)}`);
    }
    if (page.renderedDatabaseRevision !== "3" || page.renderedDatabaseRows[0]?.payload !== "9000") {
      failures.push(
        `${pageName} did not render the reconstructed database row: revision=${String(page.renderedDatabaseRevision)} rows=${JSON.stringify(page.renderedDatabaseRows)}`,
      );
    }
  }
  if (transcript.database.freshPage.host.coordinator.liveness.liveTabIds.join(",") !== "tab-c") {
    failures.push("fresh page C was not the only live page during startup hydration");
  }
}

function validateReceiptHandoff(transcript: BrowserPwaSmokeTranscript, failures: string[]): void {
  const completed = transcript.database.completedReceiptHandoff;
  if (
    completed.status !== "complete" ||
    completed.releasedReceipts !== 64 ||
    completed.retainedReceipts !== 0 ||
    completed.highWaterSequence !== 63 ||
    completed.disposition !== "stored" ||
    !/^blake3:[0-9a-f]{64}$/.test(completed.contentHash ?? "")
  ) {
    failures.push(`the browser did not complete one content-addressed receipt handoff: ${JSON.stringify(completed)}`);
  }
  const successor = transcript.database.successorReceiptHandoff;
  if (successor.status !== "idle" || successor.retainedReceipts !== 0 || successor.releasedReceipts !== 0) {
    failures.push(`a successor page did not observe an empty local receipt archive: ${JSON.stringify(successor)}`);
  }
}

function validateReceiptBroadcast(transcript: BrowserPwaSmokeTranscript, failures: string[]): void {
  if (
    transcript.receiptBroadcast.response.join(",") !== "3,2,1" ||
    transcript.receiptBroadcast.sender.status !== "complete" ||
    transcript.receiptBroadcast.sender.lastSequence !== 900 ||
    transcript.receiptBroadcast.sender.inFlight !== 0 ||
    transcript.receiptBroadcast.receiver.status !== "complete" ||
    transcript.receiptBroadcast.receiver.lastSequence !== 900 ||
    transcript.receiptBroadcast.receiver.inFlight !== 0
  ) {
    failures.push(
      `two Chromium pages did not complete the native receipt byte exchange: ${JSON.stringify(transcript.receiptBroadcast)}`,
    );
  }
}

function validate(transcript: BrowserPwaSmokeTranscript): readonly string[] {
  const failures: string[] = [];
  validateStartingPages(transcript, failures);
  validateContinuityAndInput(transcript, failures);
  validateDatabaseCommands(transcript, failures);
  validateHydration(transcript, failures);
  validateReceiptHandoff(transcript, failures);
  validateReceiptBroadcast(transcript, failures);
  return failures;
}

/** Exercise peer propagation and fresh-page recovery through the emitted Chromium runtime. */
export async function runBrowserPwaSmoke(): Promise<BrowserPwaSmokeResult> {
  const outDir = mkdtempSync(join(tmpdir(), "zeta-browser-pwa-smoke-"));
  let browser: Browser | null = null;
  let server: ReturnType<typeof Bun.serve> | null = null;
  let stage = "build production assets";
  try {
    const built = await buildBrowserPwaAssets({ outDir });
    if (!built.ok) return failed("build-failed", built.error);
    const [workerSource, runtimeSource, pageEntrySource, pageHtml, manifest, stylesheet] = await Promise.all([
      Bun.file(built.value.workerPath).text(),
      Bun.file(built.value.runtimePath).text(),
      Bun.file(built.value.pageEntryPath).text(),
      Bun.file(built.value.pagePath).text(),
      Bun.file(built.value.manifestPath).text(),
      Bun.file(built.value.stylesheetPath).text(),
    ]);
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        const pathname = new URL(request.url).pathname;
        if (pathname === "/" || pathname === "/node.html") return response(pageHtml, "text/html; charset=utf-8");
        if (pathname === "/darkhall-browser-page.js")
          return response(pageEntrySource, "text/javascript; charset=utf-8");
        if (pathname === "/darkhall-browser-pwa.js") return response(runtimeSource, "text/javascript; charset=utf-8");
        if (pathname === "/sw.js") return response(workerSource, "text/javascript; charset=utf-8");
        if (pathname === "/room.css") return response(stylesheet, "text/css; charset=utf-8");
        if (pathname === "/manifest.webmanifest") return response(manifest, "application/manifest+json");
        return new Response("Not found", { status: 404 });
      },
    });

    try {
      browser = await chromium.launch({ headless: true });
    } catch (error) {
      return failed(
        "browser-launch-failed",
        `${detail(error)} Install the pinned browser with: bun run install:browser-smoke`,
      );
    }

    stage = "start controlled pages";
    const context = await browser.newContext();
    const [pageA, pageB] = await Promise.all([context.newPage(), context.newPage()]);
    const baseUrl = `http://127.0.0.1:${String(server.port)}/node.html`;
    await Promise.all([
      pageA.goto(`${baseUrl}?tab=tab-a&sequence=100`),
      pageB.goto(`${baseUrl}?tab=tab-b&sequence=200`),
    ]);
    await Promise.all([waitForReady(pageA), waitForReady(pageB)]);

    stage = "converge pages";
    await pageA.evaluate(() => {
      dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    await pageB.evaluate(() => {
      dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    await Promise.all([waitForTwoTabs(pageA), waitForTwoTabs(pageB)]);

    stage = "exchange receipt bytes over native BroadcastChannel";
    await pageA.evaluate(async () => {
      const modulePath = "./darkhall-browser-pwa.js";
      const api = (await import(modulePath)) as typeof import("../darkhall-ui/darkhall-browser-pwa");
      const created = api.createNativeBrowserDatabaseReceiptBroadcastReceiver({
        root: globalThis,
        channelName: "zeta.receipts.chromium-smoke",
        peerId: "browser/tab-a",
        sourcePeerId: "browser/tab-b",
        receiver: {
          receive: (payload) => Promise.resolve({ ok: true, value: new Uint8Array([...payload].reverse()) }),
          read: () => {
            throw new Error("The Chromium byte fixture has no protocol readout.");
          },
        },
        limits: { maxRequestPayloadBytes: 1024, maxResponsePayloadBytes: 1024, maxInFlight: 1 },
      });
      if (!created.ok) throw new Error(`${created.feedback.code}: ${created.feedback.detail}`);
      Reflect.set(globalThis, "__zetaReceiptBroadcastReceiver", created.value);
    });
    const receiptBroadcastSender = await pageB.evaluate(async () => {
      const modulePath = "./darkhall-browser-pwa.js";
      const api = (await import(modulePath)) as typeof import("../darkhall-ui/darkhall-browser-pwa");
      const created = api.createNativeBrowserDatabaseReceiptBroadcastTransport({
        root: globalThis,
        channelName: "zeta.receipts.chromium-smoke",
        sourcePeerId: "browser/tab-b",
        targetPeerId: "browser/tab-a",
        initialSequence: 900,
        limits: { maxRequestPayloadBytes: 1024, maxResponsePayloadBytes: 1024, maxInFlight: 1 },
      });
      if (!created.ok) throw new Error(`${created.feedback.code}: ${created.feedback.detail}`);
      const exchanged = await created.value.exchange(new Uint8Array([1, 2, 3]));
      if (!exchanged.ok) throw new Error(`${exchanged.feedback.code}: ${exchanged.feedback.detail}`);
      const sender = created.value.read();
      const closed = created.value.close();
      if (!closed.ok) throw new Error(`${closed.feedback.code}: ${closed.feedback.detail}`);
      return { response: Array.from(exchanged.value), sender };
    });
    const receiptBroadcastReceiver = await pageA.evaluate(() => {
      const host = (globalThis as unknown as BrowserReceiptBroadcastGlobal).__zetaReceiptBroadcastReceiver;
      if (host === undefined) throw new Error("Page A did not retain its receipt BroadcastChannel host.");
      const receiver = host.read();
      const closed = host.close();
      if (!closed.ok) throw new Error(`${closed.feedback.code}: ${closed.feedback.detail}`);
      return receiver;
    });

    stage = "route pointer and keyboard controller input";
    await pageB.click('[data-action-id="darkhall.database.inspect"]');
    await waitForControllerInput(pageB, "pointer", 6);
    const pointerInput = await readControllerInput(pageB, "page B");
    await pageA.keyboard.press("KeyC");
    await waitForControllerInput(pageA, "keyboard", 12);
    const keyboardInput = await readControllerInput(pageA, "page A");
    const [beforeA, beforeB] = await Promise.all([observe(pageA, "page A"), observe(pageB, "page B")]);

    stage = "edit, emit, select, retract, and re-emit database row";
    await pageB.fill("[data-row-command-key]", "game/score");
    await pageB.fill("[data-row-command-payload]", "9000");
    await pageB.fill("[data-row-command-magnitude]", "1");
    await pageB.waitForFunction(
      () => {
        const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
        return started?.ok === true && started.value.read().editor.validity === "ready";
      },
      undefined,
      { timeout: timeoutMs },
    );

    await pageB.click('[data-action-id="darkhall.database.emit"]');
    await waitForDatabase(pageB, 1, "9000");
    await waitForRowCommand(pageB, "emit", 1, 1);
    await pageB.fill("[data-row-command-key]", "");
    await pageB.fill("[data-row-command-payload]", "unselected");
    await pageB.fill("[data-row-command-magnitude]", "7");
    await pageB.waitForFunction(
      () => {
        const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
        return started?.ok === true && started.value.read().editor.validity === "incomplete";
      },
      undefined,
      { timeout: timeoutMs },
    );
    await pageB.click('.zeta-database-row-select[data-row-key="game/score"]');
    await waitForRowSelection(pageB, "game/score", 1);
    await pageB.click('[data-action-id="darkhall.database.retract"]');
    await waitForDatabaseWithoutScore(pageB, 2);
    await waitForRowCommand(pageB, "retract", 2, 2);
    const retractionCommand = await pageB.evaluate(() => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      if (started?.ok !== true) throw new Error("Page B did not expose its active runtime.");
      const controller = started.value.read().controller;
      if (controller === null) throw new Error("Page B did not expose its retraction readout.");
      return controller;
    });

    await pageB.click('[data-action-id="darkhall.database.emit"]');
    await waitForDatabase(pageB, 3, "9000");
    await waitForRowCommand(pageB, "emit", 3, 3);
    const writerState = await pageB.evaluate(() => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      if (started?.ok !== true) throw new Error("Page B did not expose its active runtime.");
      const readout = started.value.read();
      if (readout.controller === null) throw new Error("Page B did not expose its final emit readout.");
      return { controller: readout.controller, editor: readout.editor, selection: readout.selection };
    });
    await waitForDatabase(pageA, 3, "9000");
    const peerAfterWrite = await observe(pageA, "page A after peer database write");

    stage = "stop second page";
    const pageBShutdown = await pageB.evaluate(() => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      return started?.ok === true ? { before: started.value.read(), stopped: started.value.stop() } : null;
    });
    if (
      pageBShutdown === null ||
      typeof pageBShutdown.stopped !== "object" ||
      pageBShutdown.stopped === null ||
      !("ok" in pageBShutdown.stopped) ||
      !pageBShutdown.stopped.ok
    ) {
      throw new Error(`Page B refused typed shutdown: ${JSON.stringify(pageBShutdown)}`);
    }
    await waitForSurvivor(pageA);
    const survivor = await observe(pageA, "page A after stop");

    stage = "stop existing pages before fresh hydration";
    await pageA.evaluate(() => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      if (started?.ok === true) started.value.stop();
    });
    await Promise.all([pageA.close(), pageB.close()]);

    stage = "hydrate a fresh page from IndexedDB";
    const pageC = await context.newPage();
    await pageC.goto(`${baseUrl}?tab=tab-c&sequence=300`);
    await waitForReady(pageC);
    await waitForDatabase(pageC, 3, "9000");
    const freshPage = await observe(pageC, "fresh page C");

    stage = "complete one bounded receipt generation";
    await completeReceiptGeneration(pageC, 4, 64);
    const completedReceiptHandoff = await pageC.evaluate(() => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      if (started?.ok !== true) throw new Error("Page C did not expose its active runtime.");
      const readout = started.value.read().receiptHandoff;
      if (readout === null) throw new Error("Page C did not expose receipt handoff pressure.");
      return readout;
    });
    await pageC.evaluate(() => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      if (started?.ok === true) started.value.stop();
    });
    await pageC.close();

    stage = "verify receipt archive reclamation from a successor page";
    const pageD = await context.newPage();
    await pageD.goto(`${baseUrl}?tab=tab-d&sequence=400`);
    await waitForReady(pageD);
    await waitForDatabaseRevision(pageD, 64);
    const successorReceiptHandoff = await pageD.evaluate(() => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      if (started?.ok !== true) throw new Error("Page D did not expose its active runtime.");
      const readout = started.value.read().receiptHandoff;
      if (readout === null) throw new Error("Page D did not expose receipt handoff pressure.");
      return readout;
    });

    const transcript: BrowserPwaSmokeTranscript = {
      schema: BROWSER_PWA_SMOKE_SCHEMA,
      beforeStop: { pageA: beforeA, pageB: beforeB },
      afterStop: { pageA: survivor },
      database: {
        writerCommand: writerState.controller,
        retractionCommand,
        writerEditor: writerState.editor,
        writerSelection: writerState.selection,
        peerAfterWrite,
        freshPage,
        completedReceiptHandoff,
        successorReceiptHandoff,
      },
      controllerInput: { pointer: pointerInput, keyboard: keyboardInput },
      receiptBroadcast: {
        response: receiptBroadcastSender.response,
        sender: receiptBroadcastSender.sender,
        receiver: receiptBroadcastReceiver,
      },
    };
    const failures = validate(transcript);
    if (failures.length > 0) return failed("assertion-failed", failures.join("; "));
    await pageD.evaluate(() => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      if (started?.ok === true) started.value.stop();
    });
    return { ok: true, value: transcript };
  } catch (error) {
    return failed("smoke-failed", `${stage}: ${detail(error)}`);
  } finally {
    if (browser !== null) await browser.close().catch(() => undefined);
    if (server !== null) await server.stop(true);
    rmSync(outDir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const result = await runBrowserPwaSmoke();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
