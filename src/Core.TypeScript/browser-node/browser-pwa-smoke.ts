#!/usr/bin/env bun

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// @ts-ignore -- Playwright owns its browser binary outside the TypeScript build.
import { chromium, type Browser, type Page } from "playwright";
import type { BrowserLifecycleHostReadout } from "./browser-lifecycle-host";
import type { BrowserServiceWorkerRegistrationReadout } from "./browser-service-worker-registration";
import type { BrowserTabTransportReadout } from "./browser-tab-channel-selector";
import { buildBrowserPwaAssets } from "./browser-pwa-build";

export const BROWSER_PWA_SMOKE_SCHEMA = "zeta.browser-pwa-smoke.v1" as const;

interface BrowserPwaPageReadout {
  readonly registration: BrowserServiceWorkerRegistrationReadout;
  readonly transport: BrowserTabTransportReadout;
  readonly host: BrowserLifecycleHostReadout;
  readonly renderedTransport: string | null;
}

interface BrowserPwaPageApi {
  read():
    | { readonly ok: true; readonly value: BrowserPwaPageReadout }
    | { readonly ok: false; readonly feedback: { readonly detail: string } };
  pulse(): void;
  stop(): unknown;
}

interface BrowserPwaPageGlobal {
  readonly __zetaPwaSmoke?: BrowserPwaPageApi;
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

function htmlDocument(): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Zeta browser PWA smoke</title></head>
<body>
  <main id="darkhall-room"></main>
  <script type="module" src="/browser-pwa-fixture.js"></script>
</body>
</html>`;
}

function fixtureSource(): string {
  return `import { startNativeDarkHallPwa } from "/darkhall-browser-pwa.js";

const parameters = new URLSearchParams(location.search);
const mount = document.getElementById("darkhall-room");
const tabId = parameters.get("tab") ?? "tab-unknown";
const started = await startNativeDarkHallPwa({
  mount,
  transcript: {
    schema: "zeta.darkhall.room-ui.v1",
    roomName: "production-pwa-smoke",
    seed: "real-worker-real-runtime",
    controller: [],
    ticks: [],
    heatRows: [],
  },
  channelName: "zeta-production-pwa-smoke",
  nodeId: "llmtv-production-pwa-smoke",
  tabId,
  initialSequence: Number(parameters.get("sequence") ?? "0"),
  maxTrackedTabs: 4,
  maxFeedback: 8,
  capabilities: ["css", "javascript", "service-worker", "broadcast-channel"],
  checkpoint: "none",
  serviceWorker: { scriptUrl: "/sw.js", scope: "/" },
});

if (!started.ok) {
  globalThis.__zetaPwaSmoke = {
    read: () => started,
    pulse: () => undefined,
    stop: () => started,
  };
} else {
  const runtime = started.value;
  globalThis.__zetaPwaSmoke = {
    read: () => ({
      ok: true,
      value: {
        registration: runtime.registration,
        transport: runtime.browser.transport,
        host: runtime.browser.host.read(),
        renderedTransport:
          mount?.querySelector("[data-browser-transport]")?.getAttribute("data-browser-transport") ?? null,
      },
    }),
    pulse: () => {
      dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
      dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    },
    stop: () => runtime.browser.host.stop(),
  };
}`;
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
      const readout = globalThis.__zetaPwaSmoke?.read();
      return readout?.ok === true &&
        readout.value.registration.status === "controlled" &&
        readout.value.transport.selected === "service-worker";
    }`,
    undefined,
    { timeout: timeoutMs },
  );
}

async function waitForTwoTabs(page: Page): Promise<void> {
  await page.waitForFunction(
    `() => {
      const readout = globalThis.__zetaPwaSmoke?.read();
      return readout?.ok === true &&
        readout.value.host.coordinator.liveness.liveTabIds.join(",") === "tab-a,tab-b";
    }`,
    undefined,
    { timeout: timeoutMs },
  );
}

async function waitForSurvivor(page: Page): Promise<void> {
  await page.waitForFunction(
    `() => {
      const readout = globalThis.__zetaPwaSmoke?.read();
      return readout?.ok === true &&
        readout.value.host.coordinator.liveness.liveTabIds.join(",") === "tab-a" &&
        readout.value.host.coordinator.liveness.darkTabIds.includes("tab-b");
    }`,
    undefined,
    { timeout: timeoutMs },
  );
}

async function observe(page: Page, pageName: string): Promise<BrowserPwaPageReadout> {
  const observation = await page.evaluate(() => {
    const api = (globalThis as unknown as BrowserPwaPageGlobal).__zetaPwaSmoke;
    return {
      location: globalThis.location.href,
      readyState: globalThis.document.readyState,
      readout: api?.read() ?? null,
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
  return failures;
}

/** Exercise the emitted runtime and worker together in two real Chromium pages. */
export async function runBrowserPwaSmoke(): Promise<BrowserPwaSmokeResult> {
  const outDir = mkdtempSync(join(tmpdir(), "zeta-browser-pwa-smoke-"));
  let browser: Browser | null = null;
  let server: ReturnType<typeof Bun.serve> | null = null;
  let stage = "build production assets";
  try {
    const built = await buildBrowserPwaAssets({ outDir });
    if (!built.ok) return failed("build-failed", built.error);
    const [workerSource, runtimeSource] = await Promise.all([
      Bun.file(built.value.workerPath).text(),
      Bun.file(built.value.runtimePath).text(),
    ]);
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        const pathname = new URL(request.url).pathname;
        if (pathname === "/") return response(htmlDocument(), "text/html; charset=utf-8");
        if (pathname === "/browser-pwa-fixture.js") return response(fixtureSource(), "text/javascript; charset=utf-8");
        if (pathname === "/darkhall-browser-pwa.js") return response(runtimeSource, "text/javascript; charset=utf-8");
        if (pathname === "/sw.js") return response(workerSource, "text/javascript; charset=utf-8");
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
    const baseUrl = `http://127.0.0.1:${String(server.port)}/`;
    await Promise.all([
      pageA.goto(`${baseUrl}?tab=tab-a&sequence=100`),
      pageB.goto(`${baseUrl}?tab=tab-b&sequence=200`),
    ]);
    await Promise.all([waitForReady(pageA), waitForReady(pageB)]);

    stage = "converge pages";
    await pageA.evaluate(() => {
      (globalThis as unknown as BrowserPwaPageGlobal).__zetaPwaSmoke?.pulse();
    });
    await pageB.evaluate(() => {
      (globalThis as unknown as BrowserPwaPageGlobal).__zetaPwaSmoke?.pulse();
    });
    await Promise.all([waitForTwoTabs(pageA), waitForTwoTabs(pageB)]);
    const [beforeA, beforeB] = await Promise.all([observe(pageA, "page A"), observe(pageB, "page B")]);

    stage = "stop second page";
    await pageB.evaluate(() => (globalThis as unknown as BrowserPwaPageGlobal).__zetaPwaSmoke?.stop());
    await waitForSurvivor(pageA);
    const transcript: BrowserPwaSmokeTranscript = {
      schema: BROWSER_PWA_SMOKE_SCHEMA,
      beforeStop: { pageA: beforeA, pageB: beforeB },
      afterStop: { pageA: await observe(pageA, "page A after stop") },
    };
    const failures = validate(transcript);
    if (failures.length > 0) return failed("assertion-failed", failures.join("; "));
    await pageA.evaluate(() => (globalThis as unknown as BrowserPwaPageGlobal).__zetaPwaSmoke?.stop());
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
