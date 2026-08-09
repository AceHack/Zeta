#!/usr/bin/env bun

import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderDarkHallBrowserNodeDocument } from "../darkhall-ui/darkhall-browser-page";

export interface BrowserPwaBuildOptions {
  readonly outDir: string;
}

export interface BrowserPwaBuildSummary {
  readonly outDir: string;
  readonly workerPath: string;
  readonly runtimePath: string;
  readonly pageEntryPath: string;
  readonly pagePath: string;
  readonly manifestPath: string;
  readonly stylesheetPath: string;
}

export type BrowserPwaBuildResult =
  | { readonly ok: true; readonly value: BrowserPwaBuildSummary }
  | { readonly ok: false; readonly error: string };

type BundleResult = { readonly ok: true } | { readonly ok: false; readonly error: string };

const browserPwaManifest = {
  id: "./node.html",
  name: "Zeta Dark Hall Browser Node",
  short_name: "Zeta Room",
  description: "A bounded Dark Hall browser node.",
  start_url: "./node.html",
  scope: "./",
  display: "standalone",
  background_color: "#11110f",
  theme_color: "#11110f",
} as const;

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function bundle(entrypoint: string, outDir: string, naming: string): Promise<BundleResult> {
  try {
    const result = await Bun.build({
      entrypoints: [entrypoint],
      outdir: outDir,
      naming,
      target: "browser",
      format: "esm",
      minify: false,
      sourcemap: "none",
    });
    if (!result.success) {
      return { ok: false, error: result.logs.map((log) => log.message).join("\n") || `Failed to emit ${naming}.` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: message(error) };
  }
}

/** Emit the worker, importable runtime, and explicit active page. */
export async function buildBrowserPwaAssets(options: BrowserPwaBuildOptions): Promise<BrowserPwaBuildResult> {
  if (options.outDir.length === 0) return { ok: false, error: "out-dir must be a non-empty path" };
  let outDir: string;
  try {
    outDir = resolve(options.outDir);
    mkdirSync(outDir, { recursive: true });
  } catch (error) {
    return { ok: false, error: message(error) };
  }

  const worker = await bundle(join(import.meta.dir, "browser-service-worker-entry.ts"), outDir, "sw.js");
  if (!worker.ok) return worker;
  const runtime = await bundle(
    join(import.meta.dir, "..", "darkhall-ui", "darkhall-browser-pwa.ts"),
    outDir,
    "darkhall-browser-pwa.js",
  );
  if (!runtime.ok) return runtime;
  const pageEntry = await bundle(
    join(import.meta.dir, "..", "darkhall-ui", "darkhall-browser-page-entry.ts"),
    outDir,
    "darkhall-browser-page.js",
  );
  if (!pageEntry.ok) return pageEntry;

  const pagePath = join(outDir, "node.html");
  const manifestPath = join(outDir, "manifest.webmanifest");
  const stylesheetPath = join(outDir, "room.css");
  try {
    writeFileSync(pagePath, `${renderDarkHallBrowserNodeDocument()}\n`, "utf8");
    writeFileSync(manifestPath, `${JSON.stringify(browserPwaManifest, null, 2)}\n`, "utf8");
    copyFileSync(join(import.meta.dir, "..", "darkhall-ui", "darkhall-room.css"), stylesheetPath);
  } catch (error) {
    return { ok: false, error: message(error) };
  }
  return {
    ok: true,
    value: {
      outDir,
      workerPath: join(outDir, "sw.js"),
      runtimePath: join(outDir, "darkhall-browser-pwa.js"),
      pageEntryPath: join(outDir, "darkhall-browser-page.js"),
      pagePath,
      manifestPath,
      stylesheetPath,
    },
  };
}

async function main(argv: readonly string[]): Promise<number> {
  if (argv.length !== 2 || argv[0] !== "--out-dir" || argv[1] === undefined) {
    process.stderr.write("Usage: bun browser-pwa-build.ts --out-dir <directory>\n");
    return 1;
  }
  const result = await buildBrowserPwaAssets({ outDir: argv[1] });
  if (!result.ok) {
    process.stderr.write(`${result.error}\n`);
    return 1;
  }
  process.stdout.write(`wrote ${result.value.workerPath}, ${result.value.runtimePath}, and ${result.value.pagePath}\n`);
  return 0;
}

if (import.meta.main) process.exitCode = await main(process.argv.slice(2));
