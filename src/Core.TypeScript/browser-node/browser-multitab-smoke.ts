import { resolve } from "node:path";
// @ts-ignore -- playwright is dynamically installed for browser smoke runner
import { chromium, type Browser, type Page } from "playwright";
import type { DarkHallBrowserDurableFeedback } from "../darkhall-ui/darkhall-browser-durable-runtime";
import type { BrowserLifecycleHostReadout } from "./browser-lifecycle-host";
import type { BrowserMultitabFixtureApi, BrowserMultitabFixtureReadout } from "./browser-multitab-fixture";

export const BROWSER_MULTITAB_SMOKE_SCHEMA = "zeta.browser-multitab-smoke.v5" as const;

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

export interface BrowserMultitabPageObservation {
  readonly source: BrowserMultitabFixtureReadout;
  readonly iris: IrisMeshReadout;
  readonly rendered: {
    readonly sourceTabs: readonly {
      readonly tabId: string;
      readonly state: string;
    }[];
    readonly sourceLocalState: string;
    readonly irisLabel: string;
  };
}

export interface BrowserMultitabSmokeTranscript {
  readonly schema: typeof BROWSER_MULTITAB_SMOKE_SCHEMA;
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
  readonly stoppedPageA: BrowserLifecycleHostReadout;
  readonly afterRestart: {
    readonly pageC: BrowserMultitabPageObservation;
  };
  readonly retraction: {
    readonly staleDelete: DarkHallBrowserDurableFeedback;
    readonly removed: boolean;
  };
  readonly afterRetraction: {
    readonly pageD: BrowserMultitabPageObservation;
  };
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
  <script>
    navigator.serviceWorker.register("/browser-service-worker.js", { type: "module" })
      .then(() => navigator.serviceWorker.ready)
      .then(() => navigator.serviceWorker.controller
        ? undefined
        : new Promise(resolve => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true })))
      .then(() => {
        const fixture = document.createElement("script");
        fixture.type = "module";
        fixture.src = "/browser-fixture.js";
        document.body.append(fixture);
      });
  </script>
</body>
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
        irisLabel: irisLabel?.textContent?.trim() ?? "",
      },
    };
  });
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction("() => Boolean(globalThis.__zetaBrowserSmoke && globalThis.ZetaMesh)", undefined, {
    timeout: timeoutMs,
  });
}

async function waitForTwoPages(page: Page): Promise<void> {
  await page.waitForFunction(
    `() => {
      const source = globalThis.__zetaBrowserSmoke?.read();
      const iris = globalThis.ZetaMesh?.snapshot();
      return source?.ok === true &&
        source.value.host.coordinator.liveness.liveTabIds.length === 2 &&
        iris?.tabs === 2;
    }`,
    undefined,
    { timeout: timeoutMs },
  );
}

async function waitForSurvivor(page: Page): Promise<void> {
  await page.waitForFunction(
    `() => {
      const source = globalThis.__zetaBrowserSmoke?.read();
      const iris = globalThis.ZetaMesh?.snapshot();
      return source?.ok === true &&
        source.value.host.coordinator.liveness.liveTabIds.join(",") === "tab-a" &&
        source.value.host.coordinator.liveness.darkTabIds.includes("tab-b") &&
        iris?.tabs === 1;
    }`,
    undefined,
    { timeout: timeoutMs },
  );
}

async function waitForCheckpoint(page: Page, revision: number | null): Promise<void> {
  await page.waitForFunction(
    `() => {
      const source = globalThis.__zetaBrowserSmoke?.read();
      return source?.ok === true &&
        source.value.checkpoint.currentRevision === ${revision === null ? "null" : String(revision)} &&
        source.value.host.coordinator.liveness.checkpoint === ${JSON.stringify(revision === null ? "none" : "durable")};
    }`,
    undefined,
    { timeout: timeoutMs },
  );
}

async function waitForSinglePage(page: Page, tabId: string): Promise<void> {
  await page.waitForFunction(
    `() => {
      const source = globalThis.__zetaBrowserSmoke?.read();
      const iris = globalThis.ZetaMesh?.snapshot();
      return source?.ok === true &&
        source.value.host.coordinator.liveness.liveTabIds.join(",") === ${JSON.stringify(tabId)} &&
        source.value.host.coordinator.tabs.length === 1 &&
        iris?.tabs === 1;
    }`,
    undefined,
    { timeout: timeoutMs },
  );
}

function sourceHost(observation: BrowserMultitabPageObservation): BrowserLifecycleHostReadout | null {
  return observation.source.ok ? observation.source.value.host : null;
}

function validateTranscript(transcript: BrowserMultitabSmokeTranscript): readonly string[] {
  const beforeA = sourceHost(transcript.beforeStop.pageA);
  const beforeB = sourceHost(transcript.beforeStop.pageB);
  const afterA = sourceHost(transcript.afterStop.pageA);
  const failures: string[] = [];

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
  if (afterA?.coordinator.liveness.continuity !== "single-tab" || afterA.coordinator.liveness.zetaAlive !== true) {
    failures.push("source page A did not remain live as a single tab");
  }
  if (!afterA?.coordinator.liveness.darkTabIds.includes("tab-b"))
    failures.push("source page A did not retain tab B's dark observation");
  if (!transcript.afterStop.pageA.rendered.sourceTabs.some((tab) => tab.tabId === "tab-b" && tab.state === "dark"))
    failures.push("page A did not render source tab B as dark");
  if (transcript.afterStop.pageA.iris.tabs !== 1) failures.push("Iris page A did not remove stopped page B");
  if (!transcript.afterStop.pageA.rendered.irisLabel.includes("1 tab"))
    failures.push("page A did not render the Iris one-tab label");
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
    if (restarted.host.coordinator.tabs.map((tab) => tab.tabId).join(",") !== "tab-d")
      failures.push("page D restored obsolete tab-presence state");
  } else {
    failures.push("page D did not start after checkpoint retraction");
  }

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
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        const pathname = new URL(request.url).pathname;
        if (pathname === "/") return response(html, "text/html; charset=utf-8");
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

    stage = "open initial pages";
    const context = await browser.newContext();
    const pageA = await context.newPage();
    const pageB = await context.newPage();
    await pageA.addInitScript(initIrisId("iris-a"));
    await pageB.addInitScript(initIrisId("iris-b"));

    const baseUrl = `http://127.0.0.1:${String(server.port)}/`;
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
    const pageAAfterStop = await observe(pageA);
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
    const pageC = await context.newPage();
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
      const removed = await root.__zetaBrowserSmoke.removeCheckpoint(300);
      if (!removed.ok) return removed;
      return {
        ok: true as const,
        value: { staleDelete: stale.feedback, removed: removed.value },
      };
    });
    if (!retraction.ok) return failed("smoke-failed", retraction.feedback.detail);

    await pageC.evaluate(() => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      root.__zetaBrowserSmoke.stop();
      root.ZetaMesh.destroy();
    });
    await pageC.close();
    const pageD = await context.newPage();
    await pageD.addInitScript(initIrisId("iris-d"));
    await pageD.goto(`${baseUrl}?tab=tab-d&sequence=500`);
    await waitForReady(pageD);
    await pageD.evaluate("globalThis.ZetaMesh.announce()");
    await waitForSinglePage(pageD, "tab-d");

    stage = "validate final cold restart";
    const transcript: BrowserMultitabSmokeTranscript = {
      schema: BROWSER_MULTITAB_SMOKE_SCHEMA,
      beforeStop: { pageA: pageAFirst, pageB: pageBFirst },
      crossTabCheckpoint: {
        savedRevision: crossTabSave.value.revision,
        pageBAfterSave: pageBAfterCrossTabSave,
        removed: crossTabRemoval.value,
        pageAAfterRemoval: pageAAfterCrossTabRemoval,
      },
      stoppedPageB: stopped.value,
      afterStop: { pageA: pageAAfterStop },
      checkpoint: { ...checkpoint.value, room: checkpointRoom },
      stoppedPageA: stoppedA.value,
      afterRestart: { pageC: pageCAfterRestart },
      retraction: retraction.value,
      afterRetraction: { pageD: await observe(pageD) },
    };
    const failures = validateTranscript(transcript);
    if (failures.length > 0) return failed("assertion-failed", failures.join("; "));
    await pageD.evaluate(() => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      root.__zetaBrowserSmoke.stop();
      root.ZetaMesh.destroy();
    });
    await pageD.close();
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
