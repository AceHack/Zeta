import { resolve } from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import type { DarkHallBrowserDurableFeedback } from "../darkhall-ui/darkhall-browser-durable-runtime";
import type { DarkHallDatabaseReadout } from "../darkhall-ui/darkhall-database-readout";
import type { BrowserLifecycleHostReadout } from "./browser-lifecycle-host";
import type {
  BrowserMultitabCausalReadout,
  BrowserMultitabFixtureApi,
  BrowserMultitabFixtureReadout,
} from "./browser-multitab-fixture";
import type { ZetaDbTickReadout } from "../zetadb/zeta-db-node";
import type { BrowserDatabaseIntentReadout } from "./browser-database-intent-outbox";

export const BROWSER_MULTITAB_SMOKE_SCHEMA = "zeta.browser-multitab-smoke.v17" as const;

interface IrisPeerReadout {
  readonly id: string;
  readonly page: string;
  readonly via: string;
}

interface IrisMeshReadout {
  readonly id: string;
  readonly alive: boolean;
  readonly tabs: number;
  readonly peers: readonly IrisPeerReadout[];
  readonly wsStatus: string;
}

interface IrisMeshApi {
  snapshot(): IrisMeshReadout;
  announce(): void;
  destroy(): void;
}

interface BrowserElementLike {
  readonly textContent: string | null;
  getAttribute(name: string): string | null;
  querySelector(selector: string): BrowserElementLike | null;
}

interface BrowserDocumentLike {
  querySelector(selector: string): BrowserElementLike | null;
  querySelectorAll(selector: string): ArrayLike<BrowserElementLike>;
}

interface BrowserSmokeGlobal {
  readonly __zetaBrowserSmoke: BrowserMultitabFixtureApi;
  readonly ZetaMesh: IrisMeshApi;
  readonly document: BrowserDocumentLike;
}

interface BrowserServiceWorkerBootstrapGlobal {
  readonly navigator: {
    readonly serviceWorker: {
      readonly controller?: unknown;
      readonly ready: Promise<{ readonly active?: unknown }>;
      register(url: string, options: { readonly type: "module" }): Promise<unknown>;
      addEventListener(type: "controllerchange", listener: () => void, options: { readonly once: true }): void;
    };
  };
}

export interface BrowserMultitabPageObservation {
  readonly source: BrowserMultitabFixtureReadout;
  readonly iris: IrisMeshReadout;
  readonly rendered: {
    readonly sourceTabs: readonly {
      readonly tabId: string;
      readonly state: string;
    }[];
    readonly sourceLocalState: string;
    readonly causalHandoff: {
      readonly schema: string;
      readonly status: string;
      readonly direction: string;
      readonly handoffId: string;
      readonly peerTabId: string;
      readonly pendingHandoffs: string;
      readonly maxPendingHandoffs: string;
      readonly text: string;
    };
    readonly irisLabel: string;
    readonly databaseExecutor: string;
    readonly databaseRevision: string;
    readonly databaseRows: readonly {
      readonly rowKey: string;
      readonly weight: string;
      readonly payload: string;
    }[];
  };
}

export interface BrowserMultitabIntentRecoveryTranscript {
  readonly heldExecution: ZetaDbTickReadout | null;
  readonly beforeCrashRead: ZetaDbTickReadout;
  readonly recovered: DarkHallDatabaseReadout;
  readonly secondRecovery: null;
  readonly outbox: BrowserDatabaseIntentReadout;
  readonly archive: ZetaDbTickReadout;
  readonly finalRead: ZetaDbTickReadout;
}

export interface BrowserMultitabSmokeTranscript {
  readonly schema: typeof BROWSER_MULTITAB_SMOKE_SCHEMA;
  readonly transport: {
    readonly kind: "service-worker";
    readonly controlledBeforeRooms: true;
  };
  readonly beforeStop: {
    readonly pageA: BrowserMultitabPageObservation;
    readonly pageB: BrowserMultitabPageObservation;
  };
  readonly crossTabCheckpoint: {
    readonly savedRevision: number;
    readonly pageBAfterSave: BrowserMultitabPageObservation;
    readonly removed: boolean;
    readonly pageAAfterRemoval: BrowserMultitabPageObservation;
  };
  readonly stoppedPageB: BrowserLifecycleHostReadout;
  readonly databaseHandoff: {
    readonly writer: ZetaDbTickReadout;
    readonly pageBAfterWrite: BrowserMultitabPageObservation;
    readonly survivor: ZetaDbTickReadout;
  };
  readonly afterStop: {
    readonly pageA: BrowserMultitabPageObservation;
  };
  readonly checkpoint: {
    readonly savedRevision: number;
    readonly payloadBytes: number;
    readonly room: {
      readonly roomName: string;
      readonly seed: string;
      readonly latestTick: number | null;
      readonly continuationToken: string | null;
    };
    readonly staleWrite: DarkHallBrowserDurableFeedback;
  };
  readonly causalCheckpoint: BrowserMultitabCausalReadout;
  readonly stoppedPageA: BrowserLifecycleHostReadout;
  readonly afterRestart: {
    readonly pageC: BrowserMultitabPageObservation;
  };
  readonly retraction: {
    readonly staleDelete: DarkHallBrowserDurableFeedback;
    readonly removed: boolean;
  };
  readonly afterRetraction: {
    readonly pendingHandoffCheckpoint: BrowserMultitabCausalReadout;
    readonly pageCWhilePending: BrowserMultitabPageObservation;
    readonly pageCAfterPendingReload: BrowserMultitabPageObservation;
    readonly pageCAfterFirstAcknowledgement: BrowserMultitabPageObservation;
    readonly pageC: BrowserMultitabPageObservation;
    readonly pageD: BrowserMultitabPageObservation;
    readonly pageE: BrowserMultitabPageObservation;
    readonly finalHandoffCheckpoint: BrowserMultitabCausalReadout;
  };
  readonly intentRecovery: BrowserMultitabIntentRecoveryTranscript;
  readonly committedIntentRecovery: BrowserMultitabIntentRecoveryTranscript;
}

export interface BrowserMultitabSmokeFeedback {
  readonly severity: "heat";
  readonly code: "bundle-failed" | "browser-launch-failed" | "smoke-failed" | "assertion-failed";
  readonly detail: string;
}

export type BrowserMultitabSmokeResult =
  | { readonly ok: true; readonly value: BrowserMultitabSmokeTranscript }
  | { readonly ok: false; readonly feedback: BrowserMultitabSmokeFeedback };

type BrowserMultitabSmokeFailure = Extract<BrowserMultitabSmokeResult, { readonly ok: false }>;

const timeoutMs = 10_000;
const fixturePath = resolve(import.meta.dir, "browser-multitab-fixture.ts");
const serviceWorkerFixturePath = resolve(import.meta.dir, "browser-service-worker-fixture.ts");
const irisMeshPath = resolve(
  import.meta.dir,
  "..",
  "..",
  "..",
  "docs",
  "design",
  "root-site-iris",
  "edge",
  "zeta-mesh.js",
);

function failed(code: BrowserMultitabSmokeFeedback["code"], detail: string): BrowserMultitabSmokeFailure {
  return { ok: false, feedback: { severity: "heat", code, detail } };
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseJsonRecord(payload: string | undefined): Readonly<Record<string, unknown>> | null {
  if (payload === undefined) return null;
  try {
    const parsed: unknown = JSON.parse(payload) as unknown;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Readonly<Record<string, unknown>>)
      : null;
  } catch {
    return null;
  }
}

async function buildFixture(): Promise<
  { readonly ok: true; readonly pageSource: string; readonly workerSource: string } | BrowserMultitabSmokeFailure
> {
  const [pageBuilt, workerBuilt] = await Promise.all([
    Bun.build({ entrypoints: [fixturePath], target: "browser", format: "esm" }),
    Bun.build({ entrypoints: [serviceWorkerFixturePath], target: "browser", format: "esm" }),
  ]);
  const pageOutput = pageBuilt.outputs.at(0);
  const workerOutput = workerBuilt.outputs.at(0);
  if (!pageBuilt.success || !workerBuilt.success || pageOutput === undefined || workerOutput === undefined) {
    const detail =
      [...pageBuilt.logs, ...workerBuilt.logs].map((entry) => entry.message).join(" | ") ||
      "The browser fixture produced no output.";
    return failed("bundle-failed", detail);
  }
  return { ok: true, pageSource: await pageOutput.text(), workerSource: await workerOutput.text() };
}

function htmlDocument(): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Zeta browser multi-tab smoke</title></head>
<body>
  <zeta-mesh-pip id="iris-mesh"></zeta-mesh-pip>
  <main id="darkhall-room"></main>
  <script src="/zeta-mesh.js"></script>
  <script type="module" src="/browser-fixture.js"></script>
</body>
</html>`;
}

function installerDocument(): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Zeta service-worker installer</title></head>
<body></body>
</html>`;
}

function response(body: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      "cache-control": "no-store",
      "content-type": contentType,
    },
  });
}

async function observe(page: Page): Promise<BrowserMultitabPageObservation> {
  return page.evaluate(() => {
    const root = globalThis as unknown as BrowserSmokeGlobal;
    const sourceElements = Array.from(root.document.querySelectorAll("[data-tab]"));
    const sourceRoot = root.document.querySelector("[data-browser-local-state]");
    const causalHandoff = root.document.querySelector(".zeta-causal-handoff");
    const databaseRoot = root.document.querySelector("[data-database-readout]");
    const databaseRows = Array.from(root.document.querySelectorAll(".zeta-database-row"));
    const irisLabel = root.document.querySelector("#iris-mesh button");
    const iris = root.ZetaMesh.snapshot();
    return {
      source: root.__zetaBrowserSmoke.read(),
      iris: {
        id: iris.id,
        alive: iris.alive,
        tabs: iris.tabs,
        peers: iris.peers.map((peer) => ({ id: peer.id, page: peer.page, via: peer.via })),
        wsStatus: iris.wsStatus,
      },
      rendered: {
        sourceTabs: sourceElements.map((element) => ({
          tabId: element.getAttribute("data-tab") ?? "",
          state: element.getAttribute("data-state") ?? "",
        })),
        sourceLocalState: sourceRoot?.getAttribute("data-browser-local-state") ?? "",
        causalHandoff: {
          schema: sourceRoot?.getAttribute("data-causal-handoff-readout") ?? "",
          status: sourceRoot?.getAttribute("data-causal-handoff-status") ?? "",
          direction: sourceRoot?.getAttribute("data-causal-handoff-direction") ?? "",
          handoffId: sourceRoot?.getAttribute("data-causal-handoff-id") ?? "",
          peerTabId: sourceRoot?.getAttribute("data-causal-handoff-peer") ?? "",
          pendingHandoffs: sourceRoot?.getAttribute("data-causal-handoff-pending") ?? "",
          maxPendingHandoffs: sourceRoot?.getAttribute("data-causal-handoff-capacity") ?? "",
          text: causalHandoff?.textContent?.trim() ?? "",
        },
        irisLabel: irisLabel?.textContent?.trim() ?? "",
        databaseExecutor: databaseRoot?.getAttribute("data-database-executor") ?? "",
        databaseRevision: databaseRoot?.getAttribute("data-database-revision") ?? "",
        databaseRows: databaseRows.map((row) => ({
          rowKey: row.getAttribute("data-row-key") ?? "",
          weight: row.getAttribute("data-row-weight") ?? "",
          payload: row.querySelector(".zeta-database-row-payload")?.textContent?.trim() ?? "",
        })),
      },
    };
  });
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const root = globalThis as unknown as Partial<BrowserSmokeGlobal>;
      return Boolean(root.__zetaBrowserSmoke && root.ZetaMesh && globalThis.navigator.serviceWorker.controller);
    },
    undefined,
    { timeout: timeoutMs },
  );
}

async function installServiceWorker(page: Page, url: string): Promise<true> {
  await page.goto(url);
  const result = await page.evaluate(async (controlTimeoutMs) => {
    const root = globalThis as unknown as BrowserServiceWorkerBootstrapGlobal;
    try {
      await root.navigator.serviceWorker.register("/browser-service-worker.js", { type: "module" });
      const registration = await root.navigator.serviceWorker.ready;
      if (!root.navigator.serviceWorker.controller) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Timed out waiting for service-worker control."));
          }, controlTimeoutMs);
          root.navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => {
              clearTimeout(timeout);
              resolve();
            },
            { once: true },
          );
        });
      }
      return {
        ok: true as const,
        controlled: Boolean(root.navigator.serviceWorker.controller),
        active: Boolean(registration.active),
      };
    } catch (error) {
      return { ok: false as const, detail: String(error), controlled: false, active: false };
    }
  }, timeoutMs);
  if (!result.ok || !result.controlled || !result.active) {
    throw new Error(result.ok ? "The installer page was not controlled by its service worker." : result.detail);
  }
  return true;
}

async function waitForTwoPages(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const root = globalThis as unknown as Partial<BrowserSmokeGlobal>;
      const source = root.__zetaBrowserSmoke?.read();
      const iris = root.ZetaMesh?.snapshot();
      return source?.ok === true && source.value.host.coordinator.liveness.liveTabIds.length === 2 && iris?.tabs === 2;
    },
    undefined,
    { timeout: timeoutMs },
  );
}

async function waitForThreePages(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const root = globalThis as unknown as Partial<BrowserSmokeGlobal>;
      const source = root.__zetaBrowserSmoke?.read();
      const iris = root.ZetaMesh?.snapshot();
      return source?.ok === true && source.value.host.coordinator.liveness.liveTabIds.length === 3 && iris?.tabs === 3;
    },
    undefined,
    { timeout: timeoutMs },
  );
}

async function waitForSurvivor(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const root = globalThis as unknown as Partial<BrowserSmokeGlobal>;
      const source = root.__zetaBrowserSmoke?.read();
      const iris = root.ZetaMesh?.snapshot();
      return (
        source?.ok === true &&
        source.value.host.coordinator.liveness.liveTabIds.join(",") === "tab-a" &&
        source.value.host.coordinator.liveness.darkTabIds.includes("tab-b") &&
        iris?.tabs === 1
      );
    },
    undefined,
    { timeout: timeoutMs },
  );
}

async function waitForCheckpoint(page: Page, revision: number | null): Promise<void> {
  await page.waitForFunction(
    (expectedRevision) => {
      const root = globalThis as unknown as Partial<BrowserSmokeGlobal>;
      const source = root.__zetaBrowserSmoke?.read();
      return (
        source?.ok === true &&
        source.value.checkpoint.currentRevision === expectedRevision &&
        source.value.host.coordinator.liveness.checkpoint === (expectedRevision === null ? "none" : "durable")
      );
    },
    revision,
    { timeout: timeoutMs },
  );
}

async function waitForDatabase(page: Page, executorId: string, revision: number): Promise<void> {
  await page.waitForFunction(
    (expected) => {
      const root = globalThis as unknown as Partial<BrowserSmokeGlobal>;
      const source = root.__zetaBrowserSmoke?.read();
      return (
        source?.ok === true &&
        source.value.database?.executorId === expected.executorId &&
        source.value.database.revision === expected.revision
      );
    },
    { executorId, revision },
    { timeout: timeoutMs },
  );
}

async function waitForSinglePage(page: Page, tabId: string): Promise<void> {
  await page.waitForFunction(
    (expectedTabId) => {
      const root = globalThis as unknown as Partial<BrowserSmokeGlobal>;
      const source = root.__zetaBrowserSmoke?.read();
      const iris = root.ZetaMesh?.snapshot();
      return (
        source?.ok === true &&
        source.value.host.coordinator.liveness.liveTabIds.join(",") === expectedTabId &&
        source.value.host.coordinator.tabs.length === 1 &&
        iris?.tabs === 1
      );
    },
    tabId,
    { timeout: timeoutMs },
  );
}

async function waitForCausalHandoff(
  page: Page,
  direction: "outbound" | "inbound",
  status: "offered" | "acknowledged" | "received" | "duplicate",
  peerTabId: string,
  pendingHandoffs?: number,
): Promise<void> {
  await page.waitForFunction(
    (expected) => {
      const root = globalThis as unknown as Partial<BrowserSmokeGlobal>;
      const source = root.__zetaBrowserSmoke?.read();
      const handoff = source?.ok === true ? source.value.causal.handoff : null;
      const room = root.document?.querySelector("[data-causal-handoff-readout]");
      return (
        handoff?.direction === expected.direction &&
        handoff.status === expected.status &&
        handoff.peerTabId === expected.peerTabId &&
        handoff.handoffId !== null &&
        (expected.pendingHandoffs === undefined || handoff.pendingHandoffs === expected.pendingHandoffs) &&
        room?.getAttribute("data-causal-handoff-direction") === expected.direction &&
        room.getAttribute("data-causal-handoff-status") === expected.status &&
        room.getAttribute("data-causal-handoff-id") === handoff.handoffId &&
        room.getAttribute("data-causal-handoff-peer") === expected.peerTabId
      );
    },
    { direction, status, peerTabId, pendingHandoffs },
    { timeout: timeoutMs },
  );
}

async function waitForPendingCausalHandoffs(page: Page, pendingHandoffs: number): Promise<void> {
  await page.waitForFunction(
    (expectedPending) => {
      const root = globalThis as unknown as Partial<BrowserSmokeGlobal>;
      const source = root.__zetaBrowserSmoke?.read();
      const handoff = source?.ok === true ? source.value.causal.handoff : null;
      const room = root.document?.querySelector("[data-causal-handoff-readout]");
      return (
        handoff?.pendingHandoffs === expectedPending &&
        room?.getAttribute("data-causal-handoff-pending") === String(expectedPending)
      );
    },
    pendingHandoffs,
    { timeout: timeoutMs },
  );
}

async function waitForDatabaseOutboxRelease(page: Page): Promise<void> {
  let lastRead: BrowserDatabaseIntentReadout | null = null;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const read = await page.evaluate(async () => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      return root.__zetaBrowserSmoke.readDatabaseOutbox();
    });
    if (!read.ok) throw new Error(`Database outbox read failed: ${read.feedback.detail}`);
    lastRead = read.value;
    if (lastRead.intents.length === 0 && lastRead.receipts.length === 0) return;
    await page.waitForTimeout(25);
  }
  throw new Error(`Database outbox did not release its archived receipt: ${JSON.stringify(lastRead)}`);
}

async function runIntentRecoveryProof(
  context: BrowserContext,
  baseUrl: string,
  crashWindow: "before-commit" | "after-commit",
): Promise<BrowserMultitabIntentRecoveryTranscript> {
  const survivor = await context.newPage();
  const writer = await context.newPage();
  await survivor.addInitScript(initIrisId("iris-intent-survivor"));
  await writer.addInitScript(initIrisId("iris-intent-writer"));
  const nodeId = `intent-recovery-${crashWindow}`;
  const intentId = `${nodeId}/score`;
  const shared = `node=${nodeId}&channel=zeta-${nodeId}`;
  const holdParameter = crashWindow === "before-commit" ? "holdDatabase=1" : "holdDatabaseAfterCommit=1";
  await Promise.all([
    survivor.goto(`${baseUrl}?${shared}&tab=tab-a&sequence=600`),
    writer.goto(`${baseUrl}?${shared}&tab=tab-b&sequence=700&${holdParameter}`),
  ]);
  await Promise.all([waitForReady(survivor), waitForReady(writer)]);
  await Promise.all([
    survivor.evaluate("globalThis.ZetaMesh.announce()"),
    writer.evaluate("globalThis.ZetaMesh.announce()"),
  ]);
  await Promise.all([waitForTwoPages(survivor), waitForTwoPages(writer)]);

  await writer.evaluate(
    ({ eventId }) => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      void root.__zetaBrowserSmoke.databaseTick([{ eventId, rowKey: "game/score", payload: "42", weight: 1 }]);
    },
    { eventId: intentId },
  );
  await writer.waitForFunction(
    () => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      return root.__zetaBrowserSmoke.databaseExecutionHeld();
    },
    undefined,
    { timeout: timeoutMs },
  );
  const heldOutbox = await writer.evaluate(async () => {
    const root = globalThis as unknown as BrowserSmokeGlobal;
    return root.__zetaBrowserSmoke.readDatabaseOutbox();
  });
  if (!heldOutbox.ok || heldOutbox.value.executing !== 1 || heldOutbox.value.intents[0]?.intentId !== intentId) {
    throw new Error(`Held database intent was not durably executing: ${JSON.stringify(heldOutbox)}`);
  }

  const beforeCrashRead = await survivor.evaluate(async () => {
    const root = globalThis as unknown as BrowserSmokeGlobal;
    return root.__zetaBrowserSmoke.readDatabaseImage();
  });
  if (!beforeCrashRead.ok) throw new Error(`Pre-crash database read failed: ${beforeCrashRead.feedback.detail}`);
  const heldExecution = await writer.evaluate(() => {
    const root = globalThis as unknown as BrowserSmokeGlobal;
    return root.__zetaBrowserSmoke.databaseExecutionHeldReadout();
  });
  if (crashWindow === "after-commit" && heldExecution === null) {
    const holdMode = await writer.evaluate(() => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      return root.__zetaBrowserSmoke.databaseExecutionHoldMode();
    });
    throw new Error(`Post-commit hold stopped before execution completed: mode=${holdMode}; url=${writer.url()}`);
  }

  await writer.evaluate(() => {
    const root = globalThis as unknown as BrowserSmokeGlobal;
    root.ZetaMesh.destroy();
    globalThis.dispatchEvent(new Event("pagehide"));
  });
  await writer.close();
  await waitForSurvivor(survivor);
  try {
    await waitForDatabase(survivor, "tab-a", 1);
  } catch (error) {
    const diagnostic = await survivor.evaluate(async () => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      const lockManager = (
        globalThis as unknown as {
          readonly navigator: { readonly locks: { query(): Promise<unknown> } };
        }
      ).navigator.locks;
      return {
        page: root.__zetaBrowserSmoke.read(),
        outbox: await root.__zetaBrowserSmoke.readDatabaseOutbox(),
        locks: await lockManager.query(),
        recovery: root.document
          .querySelector("[data-database-outbox-recovery]")
          ?.getAttribute("data-database-outbox-recovery"),
      };
    });
    throw new Error(`${errorDetail(error)}; survivor=${JSON.stringify(diagnostic)}`, { cause: error });
  }
  await waitForDatabaseOutboxRelease(survivor);
  const recoverySnapshot = await survivor.evaluate(async () => {
    const root = globalThis as unknown as BrowserSmokeGlobal;
    const before = root.__zetaBrowserSmoke.read();
    const outbox = await root.__zetaBrowserSmoke.readDatabaseOutbox();
    const archive = await root.__zetaBrowserSmoke.readDatabaseReceiptArchive();
    const secondRecovery = await root.__zetaBrowserSmoke.recoverDatabaseIntents();
    const after = root.__zetaBrowserSmoke.read();
    return { before, outbox, archive, secondRecovery, after };
  });
  const recoveredReadout = recoverySnapshot.before;
  if (!recoveredReadout.ok) throw new Error(`Surviving intent recovery failed: ${recoveredReadout.feedback.detail}`);
  const recovered = recoveredReadout.value.database;
  if (recovered === null) {
    throw new Error(`Surviving intent recovery produced no database readout: ${JSON.stringify(recoverySnapshot)}`);
  }
  const { secondRecovery } = recoverySnapshot;
  if (!secondRecovery.ok) throw new Error(`Second intent recovery failed: ${secondRecovery.feedback.detail}`);
  if (secondRecovery.value !== null) throw new Error("Second intent recovery executed already-completed work.");
  const { outbox } = recoverySnapshot;
  if (!outbox.ok) throw new Error(`Intent outbox read failed: ${outbox.feedback.detail}`);
  const { archive } = recoverySnapshot;
  if (!archive.ok) throw new Error(`Receipt archive read failed: ${archive.feedback.detail}`);
  const finalRead = await survivor.evaluate(async () => {
    const root = globalThis as unknown as BrowserSmokeGlobal;
    return root.__zetaBrowserSmoke.databaseTick([]);
  });
  if (!finalRead.ok) throw new Error(`Recovered database read failed: ${finalRead.feedback.detail}`);

  await survivor.evaluate(() => {
    const root = globalThis as unknown as BrowserSmokeGlobal;
    root.__zetaBrowserSmoke.stop();
    root.ZetaMesh.destroy();
  });
  await survivor.close();
  return {
    heldExecution,
    beforeCrashRead: beforeCrashRead.value,
    recovered,
    secondRecovery: null,
    outbox: outbox.value,
    archive: archive.value,
    finalRead: finalRead.value,
  };
}

function sourceHost(observation: BrowserMultitabPageObservation): BrowserLifecycleHostReadout | null {
  return observation.source.ok ? observation.source.value.host : null;
}

function validateInitialPages(transcript: BrowserMultitabSmokeTranscript, failures: string[]): void {
  const beforeA = sourceHost(transcript.beforeStop.pageA);
  const beforeB = sourceHost(transcript.beforeStop.pageB);
  if (beforeA?.coordinator.liveness.continuity !== "multi-tab")
    failures.push("source page A did not see multi-tab continuity");
  if (beforeB?.coordinator.liveness.continuity !== "multi-tab")
    failures.push("source page B did not see multi-tab continuity");
  if (transcript.beforeStop.pageA.iris.tabs !== 2 || transcript.beforeStop.pageB.iris.tabs !== 2) {
    failures.push("Iris mesh did not discover both pages bilaterally");
  }
  if (!transcript.beforeStop.pageA.rendered.sourceTabs.some((tab) => tab.tabId === "tab-b"))
    failures.push("page A did not render source tab B");
  if (!transcript.beforeStop.pageB.rendered.sourceTabs.some((tab) => tab.tabId === "tab-a"))
    failures.push("page B did not render source tab A");
  if (!transcript.beforeStop.pageA.rendered.irisLabel.includes("2 tabs"))
    failures.push("page A did not render the Iris two-tab label");
  if (
    transcript.databaseHandoff.writer.executorId !== "tab-b" ||
    transcript.databaseHandoff.writer.revision !== 1 ||
    transcript.databaseHandoff.writer.rows.find((row) => row.rowKey === "game/score")?.payload !== "9000"
  ) {
    failures.push("page B did not commit the expected database row as the first executor");
  }
  if (
    !transcript.databaseHandoff.pageBAfterWrite.source.ok ||
    transcript.databaseHandoff.pageBAfterWrite.source.value.database?.executorId !== "tab-b" ||
    transcript.databaseHandoff.pageBAfterWrite.rendered.databaseExecutor !== "tab-b" ||
    transcript.databaseHandoff.pageBAfterWrite.rendered.databaseRows[0]?.rowKey !== "game/score"
  ) {
    failures.push("page B did not render its committed database readout");
  }
}

function validateCrossTabCheckpoint(transcript: BrowserMultitabSmokeTranscript, failures: string[]): void {
  if (transcript.crossTabCheckpoint.savedRevision !== 250)
    failures.push("page A did not persist cross-tab checkpoint revision 250");
  if (transcript.crossTabCheckpoint.pageBAfterSave.source.ok) {
    const peerCheckpoint = transcript.crossTabCheckpoint.pageBAfterSave.source.value;
    if (
      peerCheckpoint.checkpoint.currentRevision !== 250 ||
      peerCheckpoint.checkpoint.room?.latestTick !== 250 ||
      peerCheckpoint.host.coordinator.liveness.checkpoint !== "durable"
    ) {
      failures.push("page B did not reread revision 250 after the cross-tab invalidation");
    }
  } else {
    failures.push("page B failed while applying the cross-tab checkpoint invalidation");
  }
  if (!transcript.crossTabCheckpoint.removed) failures.push("page B did not retract cross-tab checkpoint 250");
  if (transcript.crossTabCheckpoint.pageAAfterRemoval.source.ok) {
    const peerRetraction = transcript.crossTabCheckpoint.pageAAfterRemoval.source.value;
    if (
      peerRetraction.checkpoint.currentRevision !== null ||
      peerRetraction.host.coordinator.liveness.checkpoint !== "none"
    ) {
      failures.push("page A did not reread storage after the cross-tab retraction");
    }
  } else {
    failures.push("page A failed while applying the cross-tab checkpoint retraction");
  }
  if (!transcript.stoppedPageB.stopped || transcript.stoppedPageB.state !== "dark")
    failures.push("page B source host did not stop dark");
}

function validateSurvivingPage(transcript: BrowserMultitabSmokeTranscript, failures: string[]): void {
  const afterA = sourceHost(transcript.afterStop.pageA);
  if (
    transcript.databaseHandoff.survivor.executorId !== "tab-a" ||
    transcript.databaseHandoff.survivor.revision !== 1 ||
    transcript.databaseHandoff.survivor.accepted !== 0 ||
    transcript.databaseHandoff.survivor.rows.find((row) => row.rowKey === "game/score")?.payload !== "9000"
  ) {
    failures.push("page A did not recover the database row after executor handoff");
  }
  if (afterA?.coordinator.liveness.continuity !== "single-tab" || !afterA.coordinator.liveness.zetaAlive) {
    failures.push("source page A did not remain live as a single tab");
  }
  if (!afterA?.coordinator.liveness.darkTabIds.includes("tab-b"))
    failures.push("source page A did not retain tab B's dark observation");
  if (!transcript.afterStop.pageA.rendered.sourceTabs.some((tab) => tab.tabId === "tab-b" && tab.state === "dark"))
    failures.push("page A did not render source tab B as dark");
  if (transcript.afterStop.pageA.iris.tabs !== 1) failures.push("Iris page A did not remove stopped page B");
  if (!transcript.afterStop.pageA.rendered.irisLabel.includes("1 tab"))
    failures.push("page A did not render the Iris one-tab label");
  if (
    !transcript.afterStop.pageA.source.ok ||
    transcript.afterStop.pageA.source.value.database?.executorId !== "tab-a" ||
    transcript.afterStop.pageA.rendered.databaseExecutor !== "tab-a" ||
    transcript.afterStop.pageA.rendered.databaseRevision !== "1" ||
    transcript.afterStop.pageA.rendered.databaseRows[0]?.payload !== "9000"
  ) {
    failures.push("page A did not render itself as the surviving database executor");
  }
}

function validateSavedCheckpoint(transcript: BrowserMultitabSmokeTranscript, failures: string[]): void {
  if (transcript.checkpoint.savedRevision !== 300) failures.push("page A did not persist checkpoint revision 300");
  if (transcript.checkpoint.payloadBytes <= 0) failures.push("page A persisted an empty room checkpoint payload");
  if (
    transcript.checkpoint.room.roomName !== "browser-smoke" ||
    transcript.checkpoint.room.seed !== "real-chromium-two-page" ||
    transcript.checkpoint.room.latestTick !== 300 ||
    transcript.checkpoint.room.continuationToken !== "resume:301"
  ) {
    failures.push("page A did not persist the expected semantic room state");
  }
  if (transcript.checkpoint.staleWrite.code !== "checkpoint-revision-conflict")
    failures.push("the checkpoint store did not reject a stale revision");
}

function validateCheckpointRestart(transcript: BrowserMultitabSmokeTranscript, failures: string[]): void {
  if (transcript.afterRestart.pageC.source.ok) {
    const recovered = transcript.afterRestart.pageC.source.value;
    if (recovered.checkpoint.recoveredRevision !== 300 || recovered.checkpoint.currentRevision !== 300)
      failures.push("page C did not recover checkpoint revision 300");
    if (recovered.host.coordinator.liveness.checkpoint !== "durable")
      failures.push("page C did not derive durable continuity from the recovered checkpoint");
    if (recovered.checkpoint.payloadBytes !== transcript.checkpoint.payloadBytes)
      failures.push("page C recovered a different checkpoint byte count");
    if (
      recovered.checkpoint.room?.roomName !== transcript.checkpoint.room.roomName ||
      recovered.checkpoint.room.seed !== transcript.checkpoint.room.seed ||
      recovered.checkpoint.room.latestTick !== transcript.checkpoint.room.latestTick ||
      recovered.checkpoint.room.continuationToken !== transcript.checkpoint.room.continuationToken
    ) {
      failures.push("page C did not decode the persisted semantic room state");
    }
    if (recovered.host.coordinator.tabs.map((tab) => tab.tabId).join(",") !== "tab-c")
      failures.push("page C restored obsolete tab-presence state");
  } else {
    failures.push("page C did not start after checkpoint recovery");
  }
  if (transcript.afterRestart.pageC.iris.tabs !== 1) failures.push("Iris page C did not restart as one live tab");
}

function validateCausalCheckpointRestart(transcript: BrowserMultitabSmokeTranscript, failures: string[]): void {
  const hasExpectedCorrection = (causal: BrowserMultitabCausalReadout): boolean => {
    const correction = causal.ledger.corrections[0];
    return (
      causal.ledger.corrections.length === 1 &&
      correction?.sourceTabId === "tab-a" &&
      correction.sequence === "300" &&
      correction.reinterpretsThrough === "250" &&
      correction.deltaRows === 2
    );
  };
  if (
    transcript.causalCheckpoint.checkpoint.state !== "saved" ||
    transcript.causalCheckpoint.checkpoint.recoveredRevision !== null ||
    transcript.causalCheckpoint.checkpoint.currentRevision !== 1 ||
    transcript.causalCheckpoint.checkpoint.payloadBytes === null ||
    transcript.causalCheckpoint.checkpoint.payloadBytes <= 0 ||
    !hasExpectedCorrection(transcript.causalCheckpoint)
  ) {
    failures.push("page A did not persist the exact causal correction checkpoint before shutdown");
  }

  for (const [label, observation] of [
    ["page C", transcript.afterRestart.pageC],
    ["page C after pending reload", transcript.afterRetraction.pageCAfterPendingReload],
    ["page D", transcript.afterRetraction.pageD],
    ["page E", transcript.afterRetraction.pageE],
  ] as const) {
    if (!observation.source.ok) {
      failures.push(`${label} did not start after causal checkpoint recovery`);
      continue;
    }
    const causal = observation.source.value.causal;
    if (
      causal.checkpoint.state !== "saved" ||
      causal.checkpoint.recoveredRevision !== 1 ||
      causal.checkpoint.currentRevision !== 1 ||
      causal.checkpoint.payloadBytes !== transcript.causalCheckpoint.checkpoint.payloadBytes ||
      !hasExpectedCorrection(causal)
    ) {
      failures.push(`${label} did not recover the exact independent causal correction checkpoint`);
    }
  }

  if (transcript.afterRetraction.pageCWhilePending.source.ok) {
    const pending = transcript.afterRetraction.pageCWhilePending.source.value.causal.handoff;
    if (
      pending.status !== "offered" ||
      pending.direction !== "outbound" ||
      pending.handoffId === null ||
      pending.correctionCount !== 1 ||
      pending.pendingHandoffs !== 2 ||
      pending.maxPendingHandoffs !== 7 ||
      pending.feedback !== null
    ) {
      failures.push("page C did not retain both concurrent causal offers before acknowledgement");
    }
    const rendered = transcript.afterRetraction.pageCWhilePending.rendered.causalHandoff;
    if (
      rendered.schema !== "zeta.darkhall.causal-handoff-readout.v3" ||
      rendered.status !== "offered" ||
      rendered.direction !== "outbound" ||
      rendered.handoffId !== pending.handoffId ||
      rendered.pendingHandoffs !== "2" ||
      rendered.maxPendingHandoffs !== "7" ||
      !rendered.text.includes("peer handoff") ||
      !rendered.text.includes("offered · outbound") ||
      !rendered.text.includes("2 / 7 pending")
    ) {
      failures.push("page C did not render both pending causal peer offers on the room surface");
    }
  } else {
    failures.push("page C failed while retaining concurrent causal peer offers");
  }

  const persistedHandoffs = transcript.afterRetraction.pendingHandoffCheckpoint;
  if (
    persistedHandoffs.handoffCheckpoint.state !== "saved" ||
    persistedHandoffs.handoffCheckpoint.currentRevision === null ||
    persistedHandoffs.handoffCheckpoint.payloadBytes === null ||
    persistedHandoffs.handoffCheckpoint.payloadBytes <= 0 ||
    persistedHandoffs.handoff.pendingHandoffs !== 2
  ) {
    failures.push("page C did not durably checkpoint both pending peer offers before reload");
  }
  if (transcript.afterRetraction.pageCAfterPendingReload.source.ok) {
    const recovered = transcript.afterRetraction.pageCAfterPendingReload.source.value.causal;
    if (
      recovered.handoff.pendingHandoffs !== 2 ||
      recovered.handoff.maxPendingHandoffs !== 7 ||
      recovered.handoffCheckpoint.state !== "saved" ||
      recovered.handoffCheckpoint.recoveredRevision !== persistedHandoffs.handoffCheckpoint.currentRevision ||
      recovered.handoffCheckpoint.currentRevision !== persistedHandoffs.handoffCheckpoint.currentRevision
    ) {
      failures.push("page C did not recover both identified peer offers after a real browser reload");
    }
  } else {
    failures.push("page C failed while reloading its pending peer handoff checkpoint");
  }

  if (transcript.afterRetraction.pageCAfterFirstAcknowledgement.source.ok) {
    const first = transcript.afterRetraction.pageCAfterFirstAcknowledgement.source.value.causal.handoff;
    if (
      first.status !== "duplicate" ||
      first.direction !== "outbound" ||
      first.peerTabId !== "tab-d" ||
      first.pendingHandoffs !== 1 ||
      first.maxPendingHandoffs !== 7
    ) {
      failures.push("page C did not retain page E while acknowledging page D");
    }
  } else {
    failures.push("page C failed after the first concurrent acknowledgement");
  }

  if (transcript.afterRetraction.pageC.source.ok) {
    const final = transcript.afterRetraction.pageC.source.value.causal.handoff;
    if (
      final.status !== "duplicate" ||
      final.direction !== "outbound" ||
      final.peerTabId !== "tab-e" ||
      final.pendingHandoffs !== 0 ||
      final.maxPendingHandoffs !== 7
    ) {
      failures.push("page C did not independently acknowledge both concurrent peer offers");
    }
    const rendered = transcript.afterRetraction.pageC.rendered.causalHandoff;
    if (
      rendered.status !== "duplicate" ||
      rendered.direction !== "outbound" ||
      rendered.peerTabId !== "tab-e" ||
      rendered.pendingHandoffs !== "0" ||
      !rendered.text.includes("0 / 7 pending")
    ) {
      failures.push("page C did not render completion of both concurrent peer acknowledgements");
    }
  } else {
    failures.push("page C failed after the final concurrent acknowledgement");
  }
  if (
    transcript.afterRetraction.finalHandoffCheckpoint.handoff.pendingHandoffs !== 0 ||
    transcript.afterRetraction.finalHandoffCheckpoint.handoffCheckpoint.state !== "saved" ||
    transcript.afterRetraction.finalHandoffCheckpoint.handoffCheckpoint.currentRevision === null
  ) {
    failures.push("page C did not durably remove both acknowledged peer offers");
  }
}

function validateCheckpointRetraction(transcript: BrowserMultitabSmokeTranscript, failures: string[]): void {
  if (transcript.retraction.staleDelete.code !== "checkpoint-revision-conflict")
    failures.push("the checkpoint store did not reject a stale removal revision");
  if (!transcript.retraction.removed) failures.push("the checkpoint store did not retract revision 300");
  if (transcript.afterRetraction.pageD.source.ok) {
    const restarted = transcript.afterRetraction.pageD.source.value;
    if (restarted.checkpoint.recoveredRevision !== null || restarted.checkpoint.currentRevision !== null)
      failures.push("page D recovered a checkpoint after its bounded retraction");
    if (restarted.checkpoint.payloadBytes !== null || restarted.checkpoint.room !== null)
      failures.push("page D retained semantic room checkpoint state after retraction");
    if (restarted.host.coordinator.liveness.checkpoint !== "none")
      failures.push("page D reported durable continuity after checkpoint retraction");
    if (restarted.host.coordinator.liveness.liveTabIds.join(",") !== "tab-c,tab-d,tab-e")
      failures.push("page D did not distinguish its live peers from obsolete tab-presence state");
  } else {
    failures.push("page D did not start after checkpoint retraction");
  }
}

function validateIntentRecoveryCase(
  label: string,
  nodeId: string,
  recovery: BrowserMultitabIntentRecoveryTranscript,
  expectedBeforeRevision: number,
  expectedAccepted: number,
  expectedDuplicates: number,
  failures: string[],
): void {
  const beforeScore = recovery.beforeCrashRead.rows.find((row) => row.rowKey === "game/score");
  if (
    (expectedBeforeRevision === 0
      ? recovery.heldExecution !== null
      : recovery.heldExecution?.accepted !== 1 ||
        recovery.heldExecution.duplicates !== 0 ||
        recovery.heldExecution.revision !== 1) ||
    recovery.beforeCrashRead.nodeId !== `${nodeId}:database` ||
    recovery.beforeCrashRead.revision !== expectedBeforeRevision ||
    recovery.beforeCrashRead.accepted !== 0 ||
    recovery.beforeCrashRead.duplicates !== 0 ||
    (expectedBeforeRevision === 0 ? beforeScore !== undefined : beforeScore?.payload !== "42")
  ) {
    failures.push(
      `${label} did not expose the expected durable database image before the writer closed: ${JSON.stringify({
        nodeId: recovery.beforeCrashRead.nodeId,
        revision: recovery.beforeCrashRead.revision,
        accepted: recovery.beforeCrashRead.accepted,
        duplicates: recovery.beforeCrashRead.duplicates,
        score: beforeScore ?? null,
        heldExecution: recovery.heldExecution,
      })}`,
    );
  }
  if (
    recovery.recovered.executorId !== "tab-a" ||
    recovery.recovered.revision !== 1 ||
    recovery.recovered.accepted !== expectedAccepted ||
    recovery.recovered.duplicates !== expectedDuplicates ||
    recovery.recovered.rows.find((row) => row.rowKey === "game/score")?.payload !== "42"
  ) {
    failures.push(
      `${label} did not recover the persisted writer intent with the expected disposition: ${JSON.stringify(recovery.recovered)}`,
    );
  }
  if (
    recovery.outbox.queued !== 0 ||
    recovery.outbox.executing !== 0 ||
    recovery.outbox.settled !== 0 ||
    recovery.outbox.refused !== 0 ||
    recovery.outbox.intents.length !== 0 ||
    recovery.outbox.receipts.length !== 0
  ) {
    failures.push(`${label} did not release the locally archived execution receipt`);
  }
  const archiveRow = recovery.archive.rows.find((row) => row.rowKey === "execution-receipt/0");
  const archivedReceipt = parseJsonRecord(archiveRow?.payload);
  if (
    recovery.archive.nodeId !== `${nodeId}:database:receipts` ||
    recovery.archive.revision !== 1 ||
    archiveRow?.weight !== 1 ||
    archivedReceipt?.databaseNodeId !== `${nodeId}:database` ||
    archivedReceipt.intentId !== `${nodeId}/score` ||
    archivedReceipt.revision !== 1 ||
    archivedReceipt.accepted !== expectedAccepted ||
    archivedReceipt.duplicates !== expectedDuplicates
  ) {
    failures.push(
      `${label} did not retain the exact execution receipt in its archive node: ${JSON.stringify({ archive: recovery.archive, receipt: archivedReceipt })}`,
    );
  }
  if (
    recovery.finalRead.revision !== 1 ||
    recovery.finalRead.accepted !== 0 ||
    recovery.finalRead.rows.find((row) => row.rowKey === "game/score")?.payload !== "42"
  ) {
    failures.push(`${label} did not retain exactly one committed revision after recovery`);
  }
}

function validateIntentRecovery(transcript: BrowserMultitabSmokeTranscript, failures: string[]): void {
  validateIntentRecoveryCase(
    "pre-commit crash recovery",
    "intent-recovery-before-commit",
    transcript.intentRecovery,
    0,
    1,
    0,
    failures,
  );
  validateIntentRecoveryCase(
    "post-commit crash recovery",
    "intent-recovery-after-commit",
    transcript.committedIntentRecovery,
    1,
    0,
    1,
    failures,
  );
}

function validateTranscript(transcript: BrowserMultitabSmokeTranscript): readonly string[] {
  const failures: string[] = [];
  validateInitialPages(transcript, failures);
  validateCrossTabCheckpoint(transcript, failures);
  validateSurvivingPage(transcript, failures);
  validateSavedCheckpoint(transcript, failures);
  validateCheckpointRestart(transcript, failures);
  validateCausalCheckpointRestart(transcript, failures);
  validateCheckpointRetraction(transcript, failures);
  validateIntentRecovery(transcript, failures);
  return failures;
}

function initIrisId(id: string): string {
  return `sessionStorage.setItem("zeta-edge-nodeid", ${JSON.stringify(id)});`;
}

export async function runBrowserMultitabSmoke(): Promise<BrowserMultitabSmokeResult> {
  const fixture = await buildFixture();
  if (!fixture.ok) return fixture;

  let browser: Browser | null = null;
  let server: ReturnType<typeof Bun.serve> | null = null;
  let stage = "startup";
  try {
    const irisMesh = await Bun.file(irisMeshPath).text();
    const html = htmlDocument();
    const installer = installerDocument();
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        const pathname = new URL(request.url).pathname;
        if (pathname === "/") return response(html, "text/html; charset=utf-8");
        if (pathname === "/install") return response(installer, "text/html; charset=utf-8");
        if (pathname === "/zeta-mesh.js") return response(irisMesh, "text/javascript; charset=utf-8");
        if (pathname === "/browser-fixture.js") return response(fixture.pageSource, "text/javascript; charset=utf-8");
        if (pathname === "/browser-service-worker.js")
          return response(fixture.workerSource, "text/javascript; charset=utf-8");
        return new Response("Not found", { status: 404 });
      },
    });

    try {
      browser = await chromium.launch({ headless: true });
    } catch (error) {
      return failed(
        "browser-launch-failed",
        `${errorDetail(error)} Install the pinned browser with: bun run install:browser-smoke`,
      );
    }

    stage = "install service worker";
    const context = await browser.newContext();
    const installerPage = await context.newPage();
    const baseUrl = `http://127.0.0.1:${String(server.port)}/`;
    const controlledBeforeRooms = await installServiceWorker(installerPage, `${baseUrl}install`);
    await installerPage.close();

    stage = "open initial pages";
    const pageA = await context.newPage();
    const pageB = await context.newPage();
    await pageA.addInitScript(initIrisId("iris-a"));
    await pageB.addInitScript(initIrisId("iris-b"));

    await Promise.all([
      pageA.goto(`${baseUrl}?tab=tab-a&sequence=100`),
      pageB.goto(`${baseUrl}?tab=tab-b&sequence=200`),
    ]);
    await Promise.all([waitForReady(pageA), waitForReady(pageB)]);
    await Promise.all([
      pageA.evaluate("globalThis.ZetaMesh.announce()"),
      pageB.evaluate("globalThis.ZetaMesh.announce()"),
    ]);
    await Promise.all([waitForTwoPages(pageA), waitForTwoPages(pageB)]);

    stage = "observe initial pages";
    const [pageAFirst, pageBFirst] = await Promise.all([observe(pageA), observe(pageB)]);
    stage = "write database row from second page";
    const databaseWriter = await pageB.evaluate(async () => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      return root.__zetaBrowserSmoke.databaseTick([
        { eventId: "score-9000", rowKey: "game/score", payload: "9000", weight: 1 },
      ]);
    });
    if (!databaseWriter.ok) return failed("smoke-failed", databaseWriter.feedback.detail);
    const pageBAfterDatabaseWrite = await observe(pageB);
    await waitForDatabase(pageA, "tab-a", 1);
    stage = "cross-tab checkpoint save";
    const crossTabSave = await pageA.evaluate(async () => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      return root.__zetaBrowserSmoke.checkpoint(250);
    });
    if (!crossTabSave.ok) return failed("smoke-failed", crossTabSave.feedback.detail);
    await waitForCheckpoint(pageB, 250);
    const pageBAfterCrossTabSave = await observe(pageB);
    stage = "cross-tab checkpoint removal";
    const crossTabRemoval = await pageB.evaluate(async () => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      return root.__zetaBrowserSmoke.removeCheckpoint(250);
    });
    if (!crossTabRemoval.ok) return failed("smoke-failed", crossTabRemoval.feedback.detail);
    await waitForCheckpoint(pageA, null);
    const pageAAfterCrossTabRemoval = await observe(pageA);

    stage = "stop second page";
    const stopped = await pageB.evaluate(() => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      const result = root.__zetaBrowserSmoke.stop();
      root.ZetaMesh.destroy();
      return result;
    });
    if (!stopped.ok) return failed("smoke-failed", `Page B stop failed: ${stopped.feedback.detail}`);

    await waitForSurvivor(pageA);
    stage = "read automatic peer database wake from surviving page";
    const databaseSurvivor = await pageA.evaluate(async () => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      return root.__zetaBrowserSmoke.drainDatabaseInvalidations();
    });
    if (!databaseSurvivor.ok) return failed("smoke-failed", databaseSurvivor.feedback.detail);
    const pageAAfterStop = await observe(pageA);
    stage = "persist causal correction checkpoint";
    const causalCheckpoint = await pageA.evaluate(async () => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      const published = root.__zetaBrowserSmoke.publishCausalCorrection({
        sequence: "300",
        reinterpretsThrough: "250",
        deltaRows: 2,
      });
      if (!published.ok) return published;
      return root.__zetaBrowserSmoke.drainCausalCorrectionCheckpoint();
    });
    if (!causalCheckpoint.ok) return failed("smoke-failed", causalCheckpoint.feedback.detail);
    stage = "persist restart checkpoint";
    const checkpoint = await pageA.evaluate(async () => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      const saved = await root.__zetaBrowserSmoke.checkpoint(300);
      if (!saved.ok) return saved;
      const stale = await root.__zetaBrowserSmoke.checkpoint(299);
      if (stale.ok) {
        return {
          ok: false as const,
          feedback: {
            severity: "heat" as const,
            code: "smoke-failed" as const,
            detail: "IndexedDB admitted stale checkpoint revision 299.",
          },
        };
      }
      if (!("source" in stale.feedback)) {
        return {
          ok: false as const,
          feedback: {
            severity: "heat" as const,
            code: "smoke-failed" as const,
            detail: `Checkpoint revision rejection returned ${stale.feedback.code}.`,
          },
        };
      }
      const readout = root.__zetaBrowserSmoke.read();
      return {
        ok: true as const,
        value: {
          savedRevision: saved.value.revision,
          payloadBytes: saved.value.payload.byteLength,
          room: readout.ok ? readout.value.checkpoint.room : null,
          staleWrite: stale.feedback,
        },
      };
    });
    if (!checkpoint.ok) return failed("smoke-failed", checkpoint.feedback.detail);
    const checkpointRoom = checkpoint.value.room;
    if (checkpointRoom === null) return failed("smoke-failed", "Checkpoint room readout was unavailable.");

    const stoppedA = await pageA.evaluate(() => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      const result = root.__zetaBrowserSmoke.stop();
      root.ZetaMesh.destroy();
      return result;
    });
    if (!stoppedA.ok) return failed("smoke-failed", `Page A stop failed: ${stoppedA.feedback.detail}`);

    stage = "restart from durable checkpoint";
    await Promise.all([pageA.close(), pageB.close()]);
    let pageC = await context.newPage();
    await pageC.addInitScript(initIrisId("iris-c"));
    await pageC.goto(`${baseUrl}?tab=tab-c&sequence=400`);
    await waitForReady(pageC);
    await pageC.evaluate("globalThis.ZetaMesh.announce()");
    await waitForSinglePage(pageC, "tab-c");
    const pageCAfterRestart = await observe(pageC);
    stage = "retract durable checkpoint";
    const retraction = await pageC.evaluate(async () => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      const stale = await root.__zetaBrowserSmoke.removeCheckpoint(299);
      if (stale.ok) {
        return {
          ok: false as const,
          feedback: {
            severity: "heat" as const,
            code: "smoke-failed" as const,
            detail: "IndexedDB admitted stale checkpoint removal revision 299.",
          },
        };
      }
      if (!("source" in stale.feedback)) {
        return {
          ok: false as const,
          feedback: {
            severity: "heat" as const,
            code: "smoke-failed" as const,
            detail: `Checkpoint removal rejection returned ${stale.feedback.code}.`,
          },
        };
      }
      const removed = await root.__zetaBrowserSmoke.removeCheckpoint(300);
      if (!removed.ok) return removed;
      return {
        ok: true as const,
        value: { staleDelete: stale.feedback, removed: removed.value },
      };
    });
    if (!retraction.ok) return failed("smoke-failed", retraction.feedback.detail);

    stage = "open concurrent causal replay peers";
    const pageD = await context.newPage();
    const pageE = await context.newPage();
    await pageD.addInitScript(initIrisId("iris-d"));
    await pageE.addInitScript(initIrisId("iris-e"));
    await Promise.all([
      pageD.goto(`${baseUrl}?tab=tab-d&sequence=500&holdCausalAcksFor=tab-c`),
      pageE.goto(`${baseUrl}?tab=tab-e&sequence=600&holdCausalAcksFor=tab-c`),
    ]);
    stage = "wait for concurrent causal replay peers";
    await Promise.all([waitForReady(pageD), waitForReady(pageE)]);
    await Promise.all([
      pageD.evaluate("globalThis.ZetaMesh.announce()"),
      pageE.evaluate("globalThis.ZetaMesh.announce()"),
    ]);
    await Promise.all([waitForThreePages(pageC), waitForThreePages(pageD), waitForThreePages(pageE)]);
    stage = "wait for two held causal replay acknowledgements";
    await waitForPendingCausalHandoffs(pageC, 2);
    const pageCWhilePending = await observe(pageC);

    stage = "persist pending causal handoffs before reload";
    const pendingHandoffCheckpoint = await pageC.evaluate(async () => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      return root.__zetaBrowserSmoke.drainCausalHandoffCheckpoint();
    });
    if (!pendingHandoffCheckpoint.ok) {
      return failed("smoke-failed", pendingHandoffCheckpoint.feedback.detail);
    }
    stage = "reload the pending causal handoff owner";
    const stoppedPendingOwner = await pageC.evaluate(() => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      const result = root.__zetaBrowserSmoke.stop();
      root.ZetaMesh.destroy();
      return result;
    });
    if (!stoppedPendingOwner.ok) {
      return failed("smoke-failed", `Pending handoff owner stop failed: ${stoppedPendingOwner.feedback.detail}`);
    }
    await pageC.close();
    stage = "open reloaded causal handoff owner";
    pageC = await context.newPage();
    await pageC.addInitScript(initIrisId("iris-c"));
    await pageC.goto(`${baseUrl}?tab=tab-c&sequence=700`);
    stage = "wait for reloaded causal handoff owner";
    await waitForReady(pageC);
    await pageC.evaluate("globalThis.ZetaMesh.announce()");
    stage = "reconverge three pages after causal handoff owner reload";
    await Promise.all([waitForThreePages(pageC), waitForThreePages(pageD), waitForThreePages(pageE)]);
    stage = "recover pending causal handoffs after owner reload";
    const recoveredPendingReadout = await pageC.evaluate(() => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      return root.__zetaBrowserSmoke.read();
    });
    if (!recoveredPendingReadout.ok || recoveredPendingReadout.value.causal.handoff.pendingHandoffs !== 2) {
      return failed(
        "smoke-failed",
        `Reloaded handoff owner did not recover two offers: ${JSON.stringify(recoveredPendingReadout)}.`,
      );
    }
    const pageCAfterPendingReload = await observe(pageC);
    const pageDAfterRetraction = await observe(pageD);
    const pageEAfterRetraction = await observe(pageE);

    stage = "release first held causal replay acknowledgement";
    const releasedD = await pageD.evaluate(() => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      return root.__zetaBrowserSmoke.releaseCausalReplayAcknowledgements();
    });
    if (!releasedD.ok || releasedD.value !== 1) {
      return failed("smoke-failed", "Page D did not release exactly one held causal replay acknowledgement.");
    }
    await waitForCausalHandoff(pageC, "outbound", "duplicate", "tab-d", 1);
    const pageCAfterFirstAcknowledgement = await observe(pageC);

    stage = "release second held causal replay acknowledgement";
    const releasedE = await pageE.evaluate(() => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      return root.__zetaBrowserSmoke.releaseCausalReplayAcknowledgements();
    });
    if (!releasedE.ok || releasedE.value !== 1) {
      return failed("smoke-failed", "Page E did not release exactly one held causal replay acknowledgement.");
    }
    await waitForCausalHandoff(pageC, "outbound", "duplicate", "tab-e", 0);

    stage = "persist acknowledged causal handoff removals";
    const finalHandoffCheckpoint = await pageC.evaluate(async () => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      return root.__zetaBrowserSmoke.drainCausalHandoffCheckpoint();
    });
    if (!finalHandoffCheckpoint.ok) {
      return failed("smoke-failed", finalHandoffCheckpoint.feedback.detail);
    }

    stage = "observe final peer handoff after room retraction";
    const pageCAfterPeerHandoff = await observe(pageC);
    await Promise.all(
      [pageC, pageD, pageE].map((page) =>
        page.evaluate(() => {
          const root = globalThis as unknown as BrowserSmokeGlobal;
          root.__zetaBrowserSmoke.stop();
          root.ZetaMesh.destroy();
        }),
      ),
    );
    await Promise.all([pageC.close(), pageD.close(), pageE.close()]);

    stage = "recover persisted intent interrupted before database commit";
    const intentRecovery = await runIntentRecoveryProof(context, baseUrl, "before-commit");
    stage = "recover persisted intent interrupted after database commit";
    const committedIntentRecovery = await runIntentRecoveryProof(context, baseUrl, "after-commit");
    stage = "validate final transcript";
    const transcript: BrowserMultitabSmokeTranscript = {
      schema: BROWSER_MULTITAB_SMOKE_SCHEMA,
      transport: { kind: "service-worker", controlledBeforeRooms },
      beforeStop: { pageA: pageAFirst, pageB: pageBFirst },
      crossTabCheckpoint: {
        savedRevision: crossTabSave.value.revision,
        pageBAfterSave: pageBAfterCrossTabSave,
        removed: crossTabRemoval.value,
        pageAAfterRemoval: pageAAfterCrossTabRemoval,
      },
      stoppedPageB: stopped.value,
      databaseHandoff: {
        writer: databaseWriter.value,
        pageBAfterWrite: pageBAfterDatabaseWrite,
        survivor: databaseSurvivor.value,
      },
      afterStop: { pageA: pageAAfterStop },
      checkpoint: { ...checkpoint.value, room: checkpointRoom },
      causalCheckpoint: causalCheckpoint.value,
      stoppedPageA: stoppedA.value,
      afterRestart: { pageC: pageCAfterRestart },
      retraction: retraction.value,
      afterRetraction: {
        pendingHandoffCheckpoint: pendingHandoffCheckpoint.value,
        pageCWhilePending,
        pageCAfterPendingReload,
        pageCAfterFirstAcknowledgement,
        pageC: pageCAfterPeerHandoff,
        pageD: pageDAfterRetraction,
        pageE: pageEAfterRetraction,
        finalHandoffCheckpoint: finalHandoffCheckpoint.value,
      },
      intentRecovery,
      committedIntentRecovery,
    };
    const failures = validateTranscript(transcript);
    if (failures.length > 0) return failed("assertion-failed", failures.join("; "));
    return { ok: true, value: transcript };
  } catch (error) {
    return failed("smoke-failed", `${stage}: ${errorDetail(error)}`);
  } finally {
    if (browser !== null) await browser.close().catch(() => undefined);
    if (server !== null) await server.stop(true);
  }
}

if (import.meta.main) {
  const result = await runBrowserMultitabSmoke();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
