#!/usr/bin/env bun

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import type { BrowserLifecycleHostReadout } from "./browser-lifecycle-host";
import type { BrowserServiceWorkerRegistrationReadout } from "./browser-service-worker-registration";
import type { BrowserTabTransportReadout } from "./browser-tab-channel-selector";
import { buildBrowserPwaAssets } from "./browser-pwa-build";
import type { DarkHallDatabaseReadout } from "../darkhall-ui/darkhall-database-readout";
import type {
  DarkHallBrowserDatabaseCommand,
  DarkHallBrowserDatabaseControllerReadout,
} from "../darkhall-ui/darkhall-browser-database-controller";

export const BROWSER_PWA_SMOKE_SCHEMA = "zeta.browser-pwa-smoke.v3" as const;

interface BrowserPwaPageReadout {
  readonly registration: BrowserServiceWorkerRegistrationReadout;
  readonly transport: BrowserTabTransportReadout;
  readonly host: BrowserLifecycleHostReadout;
  readonly database: DarkHallDatabaseReadout;
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
          };
          dispatchController(
            command: DarkHallBrowserDatabaseCommand,
          ): Promise<
            | { readonly ok: true; readonly value: DarkHallBrowserDatabaseControllerReadout }
            | { readonly ok: false; readonly feedback: { readonly detail: string } }
          >;
          stop(): unknown;
        };
      }
    | { readonly ok: false; readonly feedback: { readonly detail: string } };
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
    readonly peerAfterWrite: BrowserPwaPageReadout;
    readonly freshPage: BrowserPwaPageReadout;
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
    `() => {
      const started = globalThis.__zetaDarkHallPage;
      if (started?.ok !== true) return false;
      const readout = started.value.read();
      return readout.registration.status === "controlled" &&
        readout.transport.selected === "service-worker" &&
        readout.database.revision >= 0;
    }`,
    undefined,
    { timeout: timeoutMs },
  );
}

async function waitForDatabase(page: Page, revision: number, payload: string): Promise<void> {
  await page.waitForFunction(
    `([expectedRevision, expectedPayload]) => {
      const started = globalThis.__zetaDarkHallPage;
      if (started?.ok !== true) return false;
      const database = started.value.read().database;
      return database.revision === expectedRevision &&
        database.rows.some((row) => row.rowKey === "game/score" && row.payload === expectedPayload && row.weight === 1);
    }`,
    [revision, payload],
    { timeout: timeoutMs },
  );
}

async function waitForTwoTabs(page: Page): Promise<void> {
  await page.waitForFunction(
    `() => {
      const started = globalThis.__zetaDarkHallPage;
      return started?.ok === true &&
        started.value.read().host.coordinator.liveness.liveTabIds.join(",") === "tab-a,tab-b";
    }`,
    undefined,
    { timeout: timeoutMs },
  );
}

async function waitForSurvivor(page: Page): Promise<void> {
  await page.waitForFunction(
    `() => {
      const started = globalThis.__zetaDarkHallPage;
      return started?.ok === true &&
        started.value.read().host.coordinator.liveness.liveTabIds.join(",") === "tab-a" &&
        started.value.read().host.coordinator.liveness.darkTabIds.includes("tab-b");
    }`,
    undefined,
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

function validate(transcript: BrowserPwaSmokeTranscript): readonly string[] {
  const failures: string[] = [];
  for (const [pageName, page] of [
    ["page A", transcript.beforeStop.pageA],
    ["page B", transcript.beforeStop.pageB],
  ] as const) {
    if (page.registration.status !== "controlled") failures.push(`${pageName} was not worker-controlled`);
    if (page.transport.selected !== "service-worker") failures.push(`${pageName} did not select the worker channel`);
    if (page.renderedTransport !== "service-worker") failures.push(`${pageName} did not render its transport`);
    if (page.database.revision !== 0 || page.database.rows.length !== 0) {
      failures.push(`${pageName} did not start from the empty database image`);
    }
    if (page.renderedDatabaseRevision !== "0") failures.push(`${pageName} did not render startup hydration`);
    if (page.host.coordinator.liveness.liveTabIds.join(",") !== "tab-a,tab-b") {
      failures.push(`${pageName} did not observe both tabs`);
    }
  }
  if (transcript.afterStop.pageA.host.coordinator.liveness.liveTabIds.join(",") !== "tab-a") {
    failures.push("page A did not remain live after page B stopped");
  }
  if (!transcript.afterStop.pageA.host.coordinator.liveness.darkTabIds.includes("tab-b")) {
    failures.push("page A did not retain page B's stopped state");
  }
  if (
    transcript.database.writerCommand.kind !== "emit" ||
    transcript.database.writerCommand.signedWeight !== 1 ||
    transcript.database.writerCommand.database.revision !== 1 ||
    transcript.database.writerCommand.database.accepted !== 1
  ) {
    failures.push("page B did not route one emit through the controller boundary");
  }
  for (const [pageName, page, executorId] of [
    ["peer page A", transcript.database.peerAfterWrite, "tab-a"],
    ["fresh page C", transcript.database.freshPage, "tab-c"],
  ] as const) {
    if (page.database.revision !== 1 || page.database.executorId !== executorId) {
      failures.push(`${pageName} did not read revision 1 through its own browser-tab executor`);
    }
    if (!page.database.rows.some((row) => row.rowKey === "game/score" && row.payload === "9000" && row.weight === 1)) {
      failures.push(`${pageName} did not reconstruct the persisted score row`);
    }
    if (page.renderedDatabaseRevision !== "1" || page.renderedDatabaseRows[0]?.payload !== "9000") {
      failures.push(`${pageName} did not render the reconstructed database row`);
    }
  }
  if (transcript.database.freshPage.host.coordinator.liveness.liveTabIds.join(",") !== "tab-c") {
    failures.push("fresh page C was not the only live page during startup hydration");
  }
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
    const [workerSource, pageEntrySource, pageHtml, manifest, stylesheet] = await Promise.all([
      Bun.file(built.value.workerPath).text(),
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
    const [beforeA, beforeB] = await Promise.all([observe(pageA, "page A"), observe(pageB, "page B")]);

    stage = "write and propagate database row";
    const writerResult = await pageB.evaluate(async () => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      if (started?.ok !== true) throw new Error("Page B did not expose its active runtime.");
      return started.value.dispatchController({
        kind: "emit",
        eventId: "pwa-score-9000",
        rowKey: "game/score",
        payload: "9000",
      });
    });
    if (!writerResult.ok) throw new Error(writerResult.feedback.detail);
    await waitForDatabase(pageA, 1, "9000");
    const peerAfterWrite = await observe(pageA, "page A after peer database write");

    stage = "stop second page";
    await pageB.evaluate(() => {
      const started = (globalThis as unknown as BrowserPwaPageGlobal).__zetaDarkHallPage;
      if (started?.ok === true) started.value.stop();
    });
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
    await waitForDatabase(pageC, 1, "9000");
    const freshPage = await observe(pageC, "fresh page C");

    const transcript: BrowserPwaSmokeTranscript = {
      schema: BROWSER_PWA_SMOKE_SCHEMA,
      beforeStop: { pageA: beforeA, pageB: beforeB },
      afterStop: { pageA: survivor },
      database: {
        writerCommand: writerResult.value,
        peerAfterWrite,
        freshPage,
      },
    };
    const failures = validate(transcript);
    if (failures.length > 0) return failed("assertion-failed", failures.join("; "));
    await pageC.evaluate(() => {
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
