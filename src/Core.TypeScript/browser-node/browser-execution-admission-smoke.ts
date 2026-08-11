#!/usr/bin/env bun

import { chromium, type Browser, type Page } from "playwright";
import type { BrowserExecutionAdmissionResult } from "./browser-execution-admission";
import type {
  BrowserExecutionAdmissionFixtureApi,
  BrowserExecutionAdmissionFixtureReadout,
} from "./browser-execution-admission-fixture";

export const BROWSER_EXECUTION_ADMISSION_SMOKE_SCHEMA = "zeta.browser-execution-admission-smoke.v1" as const;

interface BrowserAdmissionSmokeGlobal {
  readonly __zetaBrowserExecutionAdmission?: BrowserExecutionAdmissionFixtureApi;
}

export interface BrowserExecutionAdmissionSmokeTranscript {
  readonly schema: typeof BROWSER_EXECUTION_ADMISSION_SMOKE_SCHEMA;
  readonly holder: BrowserExecutionAdmissionFixtureReadout;
  readonly contenderWhileHeld: BrowserExecutionAdmissionResult<string>;
  readonly contenderAfterClose: BrowserExecutionAdmissionResult<string>;
}

export interface BrowserExecutionAdmissionSmokeFeedback {
  readonly severity: "heat";
  readonly code: "bundle-failed" | "browser-launch-failed" | "smoke-failed" | "assertion-failed";
  readonly detail: string;
}

export type BrowserExecutionAdmissionSmokeResult =
  | { readonly ok: true; readonly value: BrowserExecutionAdmissionSmokeTranscript }
  | { readonly ok: false; readonly feedback: BrowserExecutionAdmissionSmokeFeedback };

const timeoutMs = 10_000;

function failed(
  code: BrowserExecutionAdmissionSmokeFeedback["code"],
  detail: string,
): { readonly ok: false; readonly feedback: BrowserExecutionAdmissionSmokeFeedback } {
  return { ok: false, feedback: { severity: "heat", code, detail } };
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function response(body: string, contentType: string): Response {
  return new Response(body, {
    headers: { "cache-control": "no-store", "content-type": contentType },
  });
}

function htmlDocument(): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Zeta browser execution admission smoke</title></head>
<body><main>browser execution admission</main><script type="module" src="/fixture.js"></script></body>
</html>`;
}

async function waitForReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      (globalThis as unknown as BrowserAdmissionSmokeGlobal).__zetaBrowserExecutionAdmission?.read().status === "ready",
    undefined,
    { timeout: timeoutMs },
  );
}

async function run(page: Page, value: string): Promise<BrowserExecutionAdmissionResult<string>> {
  return page.evaluate(async (nextValue) => {
    const api = (globalThis as unknown as BrowserAdmissionSmokeGlobal).__zetaBrowserExecutionAdmission;
    if (api === undefined) throw new Error("The browser admission fixture is unavailable.");
    return api.run(nextValue);
  }, value);
}

async function runAfterHandoff(page: Page): Promise<BrowserExecutionAdmissionResult<string>> {
  let latest: BrowserExecutionAdmissionResult<string> | null = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    latest = await run(page, "page-b-after-close");
    if (!latest.ok || latest.value.status === "admitted") return latest;
    await page.waitForTimeout(10);
  }
  throw new Error(`The browser admission handoff remained busy: ${JSON.stringify(latest)}`);
}

/** Prove that a closed holder tab releases its finite Web Lock to a surviving peer tab. */
export async function runBrowserExecutionAdmissionSmoke(): Promise<BrowserExecutionAdmissionSmokeResult> {
  let browser: Browser | null = null;
  let server: ReturnType<typeof Bun.serve> | null = null;
  let stage = "bundle browser admission fixture";
  try {
    const built = await Bun.build({
      entrypoints: [new URL("./browser-execution-admission-fixture.ts", import.meta.url).pathname],
      target: "browser",
      format: "esm",
    });
    const output = built.outputs.at(0);
    if (!built.success || output === undefined) {
      return failed("bundle-failed", built.logs.map((entry) => entry.message).join(" | ") || "No bundle output.");
    }
    const fixtureSource = await output.text();
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        const pathname = new URL(request.url).pathname;
        if (pathname === "/" || pathname === "/index.html") return response(htmlDocument(), "text/html; charset=utf-8");
        if (pathname === "/fixture.js") return response(fixtureSource, "text/javascript; charset=utf-8");
        return new Response("Not found", { status: 404 });
      },
    });

    stage = "launch Chromium";
    try {
      browser = await chromium.launch({ headless: true });
    } catch (error) {
      return failed(
        "browser-launch-failed",
        `${errorDetail(error)} Install the pinned browser with: bun run install:browser-smoke`,
      );
    }

    stage = "hold and contest one browser database resource";
    const context = await browser.newContext();
    const [pageA, pageB] = await Promise.all([context.newPage(), context.newPage()]);
    const url = `http://127.0.0.1:${String(server.port)}/index.html`;
    await Promise.all([pageA.goto(url), pageB.goto(url)]);
    await Promise.all([waitForReady(pageA), waitForReady(pageB)]);
    await pageA.evaluate(() => {
      const api = (globalThis as unknown as BrowserAdmissionSmokeGlobal).__zetaBrowserExecutionAdmission;
      if (api === undefined) throw new Error("The holder fixture is unavailable.");
      api.hold();
    });
    await pageA.waitForFunction(
      () =>
        (globalThis as unknown as BrowserAdmissionSmokeGlobal).__zetaBrowserExecutionAdmission?.read().status ===
        "holding",
      undefined,
      { timeout: timeoutMs },
    );
    const holder = await pageA.evaluate(() => {
      const api = (globalThis as unknown as BrowserAdmissionSmokeGlobal).__zetaBrowserExecutionAdmission;
      if (api === undefined) throw new Error("The holder fixture is unavailable.");
      return api.read();
    });
    const contenderWhileHeld = await run(pageB, "page-b-while-held");
    if (!contenderWhileHeld.ok || contenderWhileHeld.value.status !== "busy") {
      return failed(
        "assertion-failed",
        `The competing tab was not backpressured: ${JSON.stringify(contenderWhileHeld)}`,
      );
    }

    stage = "close holder and hand off to survivor";
    await pageA.close();
    const contenderAfterClose = await runAfterHandoff(pageB);
    if (
      !contenderAfterClose.ok ||
      contenderAfterClose.value.status !== "admitted" ||
      contenderAfterClose.value.value !== "page-b-after-close"
    ) {
      return failed(
        "assertion-failed",
        `The surviving tab did not acquire after close: ${JSON.stringify(contenderAfterClose)}`,
      );
    }

    return {
      ok: true,
      value: {
        schema: BROWSER_EXECUTION_ADMISSION_SMOKE_SCHEMA,
        holder,
        contenderWhileHeld,
        contenderAfterClose,
      },
    };
  } catch (error) {
    return failed("smoke-failed", `${stage}: ${errorDetail(error)}`);
  } finally {
    if (browser !== null) await browser.close().catch(() => undefined);
    if (server !== null) await server.stop(true);
  }
}

if (import.meta.main) {
  const result = await runBrowserExecutionAdmissionSmoke();
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
