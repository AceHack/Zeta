import { resolve } from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import type { BrowserLifecycleHostReadout } from "./browser-lifecycle-host";
import type { BrowserMultitabFixtureApi, BrowserMultitabFixtureReadout } from "./browser-multitab-fixture";

export const BROWSER_MULTITAB_SMOKE_SCHEMA = "zeta.browser-multitab-smoke.v1" as const;

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
  readonly stoppedPageB: BrowserLifecycleHostReadout;
  readonly afterStop: {
    readonly pageA: BrowserMultitabPageObservation;
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

const timeoutMs = 10_000;
const fixturePath = resolve(import.meta.dir, "browser-multitab-fixture.ts");
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

function failed(code: BrowserMultitabSmokeFeedback["code"], detail: string): BrowserMultitabSmokeResult {
  return { ok: false, feedback: { severity: "heat", code, detail } };
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function buildFixture(): Promise<{ readonly ok: true; readonly source: string } | BrowserMultitabSmokeResult> {
  const built = await Bun.build({ entrypoints: [fixturePath], target: "browser", format: "esm" });
  const output = built.outputs.at(0);
  if (!built.success || output === undefined) {
    const detail = built.logs.map((entry) => entry.message).join(" | ") || "The browser fixture produced no output.";
    return failed("bundle-failed", detail);
  }
  return { ok: true, source: await output.text() };
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

  return failures;
}

function initIrisId(id: string): string {
  return `sessionStorage.setItem("zeta-edge-nodeid", ${JSON.stringify(id)});`;
}

export async function runBrowserMultitabSmoke(): Promise<BrowserMultitabSmokeResult> {
  const fixture = await buildFixture();
  if (!("source" in fixture)) return fixture;

  let browser: Browser | null = null;
  let server: ReturnType<typeof Bun.serve> | null = null;
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
        if (pathname === "/browser-fixture.js") return response(fixture.source, "text/javascript; charset=utf-8");
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

    const [pageAFirst, pageBFirst] = await Promise.all([observe(pageA), observe(pageB)]);
    const stopped = await pageB.evaluate(() => {
      const root = globalThis as unknown as BrowserSmokeGlobal;
      const result = root.__zetaBrowserSmoke.stop();
      root.ZetaMesh.destroy();
      return result;
    });
    if (!stopped.ok) return failed("smoke-failed", `Page B stop failed: ${stopped.feedback.detail}`);

    await waitForSurvivor(pageA);
    const transcript: BrowserMultitabSmokeTranscript = {
      schema: BROWSER_MULTITAB_SMOKE_SCHEMA,
      beforeStop: { pageA: pageAFirst, pageB: pageBFirst },
      stoppedPageB: stopped.value,
      afterStop: { pageA: await observe(pageA) },
    };
    const failures = validateTranscript(transcript);
    if (failures.length > 0) return failed("assertion-failed", failures.join("; "));
    await pageB.close();
    return { ok: true, value: transcript };
  } catch (error) {
    return failed("smoke-failed", errorDetail(error));
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
