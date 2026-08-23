#!/usr/bin/env bun
// llmtv-pages-static-export -- build the static Pages artifact and refresh the
// LLMTV standing readout from its same-origin replay ledger.

import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { runHallLlmtvStatusCardCli, type HallLlmtvStatusCardIo } from "./llmtv-hall-status-card";
import { runRootSiteLlmtvReaderCli, type RootSiteLlmtvReaderIo } from "./llmtv-root-site-reader";

export const PAGES_STATIC_EXPORT_GENERATED_BY = "llmtv-pages-static-export";

export const PAGES_STATIC_FILE_ROOTS = [
  "_config.yml",
  "index.html",
  "robots.txt",
  "sitemap.xml",
  "ai.txt",
  "README.md",
] as const;

export const PAGES_STATIC_DIRECTORY_ROOTS = [
  "demo",
  "genesis",
  "hall",
  "inventory",
  "maintainers",
  "docs",
  "data",
] as const;

export interface PagesStaticExportOptions {
  readonly sourceDir: string;
  readonly outDir: string;
  readonly nowMs?: number;
  readonly staleAfterMs?: number;
  readonly title?: string;
}

export interface PagesStaticExportIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export interface PagesStaticExportSummary {
  readonly sourceDir: string;
  readonly outDir: string;
  readonly copiedRoots: readonly string[];
  readonly skippedRoots: readonly string[];
  readonly llmtvReaderExitCode: number;
  readonly llmtvReaderStdout: readonly string[];
  readonly llmtvReaderStderr: readonly string[];
  readonly llmtvStatusCardExitCode: number;
  readonly llmtvStatusCardStdout: readonly string[];
  readonly llmtvStatusCardStderr: readonly string[];
}

type ExportRequest = { readonly kind: "export"; readonly options: PagesStaticExportOptions };
type HelpRequest = { readonly kind: "help" };

type ParseResult =
  | { readonly ok: true; readonly request: ExportRequest | HelpRequest }
  | { readonly ok: false; readonly error: string };

const USAGE = [
  "Usage:",
  "  bun src/Core.TypeScript/discovery/llmtv-pages-static-export.ts [--source-dir <repo>] [--out-dir <dist>] [--now-ms <n>] [--stale-after-ms <n>] [--title <title>]",
  "",
  "Copies the repo's static Pages roots into the artifact directory, then runs",
  "llmtv-root-site-reader over that artifact so hall/tv/index.html reflects",
  "data/llmtv-live.replay.json as live, stale, cold, or heat, then updates",
  "hall/index.html from data/llmtv-live.status.json.",
].join("\n");

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function takeValue(
  argv: readonly string[],
  index: number,
  flag: string,
): { readonly ok: true; readonly value: string } | { readonly ok: false; readonly error: string } {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("-")) {
    return { ok: false, error: `${flag} requires a value` };
  }
  return { ok: true, value };
}

function parseNumber(
  value: string,
  flag: string,
): { readonly ok: true; readonly value: number } | { readonly ok: false; readonly error: string } {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return { ok: false, error: `${flag} must be a non-negative finite number` };
  }
  return { ok: true, value: parsed };
}

export function parsePagesStaticExportArgs(argv: readonly string[]): ParseResult {
  let sourceDir = ".";
  let outDir = "dist";
  let nowMs: number | undefined;
  let staleAfterMs: number | undefined;
  let title: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "--help" || arg === "-h") {
      return { ok: true, request: { kind: "help" } };
    }
    if (arg === "--source-dir") {
      const taken = takeValue(argv, i, arg);
      if (!taken.ok) return taken;
      sourceDir = taken.value;
      i++;
      continue;
    }
    if (arg === "--out-dir" || arg === "--dist") {
      const taken = takeValue(argv, i, arg);
      if (!taken.ok) return taken;
      outDir = taken.value;
      i++;
      continue;
    }
    if (arg === "--now-ms") {
      const taken = takeValue(argv, i, arg);
      if (!taken.ok) return taken;
      const parsed = parseNumber(taken.value, arg);
      if (!parsed.ok) return parsed;
      nowMs = parsed.value;
      i++;
      continue;
    }
    if (arg === "--stale-after-ms") {
      const taken = takeValue(argv, i, arg);
      if (!taken.ok) return taken;
      const parsed = parseNumber(taken.value, arg);
      if (!parsed.ok) return parsed;
      staleAfterMs = parsed.value;
      i++;
      continue;
    }
    if (arg === "--title") {
      const taken = takeValue(argv, i, arg);
      if (!taken.ok) return taken;
      title = taken.value;
      i++;
      continue;
    }
    return { ok: false, error: `unknown option: ${arg}` };
  }

  const base = { sourceDir, outDir };
  const withNow = nowMs === undefined ? base : { ...base, nowMs };
  const withStale = staleAfterMs === undefined ? withNow : { ...withNow, staleAfterMs };
  const options = title === undefined ? withStale : { ...withStale, title };
  return { ok: true, request: { kind: "export", options } };
}

function ensureSafeOutput(
  sourceDir: string,
  outDir: string,
): { readonly ok: true } | { readonly ok: false; readonly error: string } {
  const source = resolve(sourceDir);
  const out = resolve(outDir);
  if (source === out) {
    return { ok: false, error: "out-dir must be different from source-dir" };
  }
  if (out === sep) {
    return { ok: false, error: "out-dir must not be the filesystem root" };
  }
  return { ok: true };
}

function copyFile(sourcePath: string, outPath: string): void {
  mkdirSync(dirname(outPath), { recursive: true });
  copyFileSync(sourcePath, outPath);
}

function copyDirectory(sourcePath: string, outPath: string): void {
  mkdirSync(outPath, { recursive: true });
  for (const name of readdirSync(sourcePath)) {
    const sourceChild = join(sourcePath, name);
    if (name === ".git" || name === "node_modules") continue;
    const outChild = join(outPath, name);
    const stat = lstatSync(sourceChild);
    if (stat.isDirectory()) {
      copyDirectory(sourceChild, outChild);
      continue;
    }
    if (stat.isFile()) {
      copyFile(sourceChild, outChild);
    }
  }
}

function copyRoot(sourceDir: string, outDir: string, root: string): "copied" | "skipped" {
  const sourcePath = join(sourceDir, root);
  const outPath = join(outDir, root);
  if (!existsSync(sourcePath)) return "skipped";

  const stat = lstatSync(sourcePath);
  if (stat.isDirectory()) {
    copyDirectory(sourcePath, outPath);
    return "copied";
  }
  if (stat.isFile()) {
    copyFile(sourcePath, outPath);
    return "copied";
  }
  return "skipped";
}

function writeNoJekyll(outDir: string): void {
  writeFileSync(join(outDir, ".nojekyll"), "", "utf8");
}

function readerArgs(options: PagesStaticExportOptions, outDir: string): string[] {
  const args = ["--root-site", outDir];
  if (options.nowMs !== undefined) args.push("--now-ms", options.nowMs.toString());
  if (options.staleAfterMs !== undefined) args.push("--stale-after-ms", options.staleAfterMs.toString());
  if (options.title !== undefined) args.push("--title", options.title);
  return args;
}

function readerIo(stdout: string[], stderr: string[]): RootSiteLlmtvReaderIo {
  return {
    readText: (path) => readFileSync(path, "utf8"),
    writeText: (path, text) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text, "utf8");
    },
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
  };
}

function statusCardIo(stdout: string[], stderr: string[]): HallLlmtvStatusCardIo {
  return {
    readText: (path) => readFileSync(path, "utf8"),
    writeText: (path, text) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text, "utf8");
    },
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
  };
}

export function buildPagesStaticArtifact(options: PagesStaticExportOptions): PagesStaticExportSummary {
  const sourceDir = resolve(options.sourceDir);
  const outDir = resolve(options.outDir);
  const safe = ensureSafeOutput(sourceDir, outDir);
  if (!safe.ok) throw new Error(safe.error);

  mkdirSync(outDir, { recursive: true });

  const copiedRoots: string[] = [];
  const skippedRoots: string[] = [];
  for (const root of [...PAGES_STATIC_FILE_ROOTS, ...PAGES_STATIC_DIRECTORY_ROOTS]) {
    const result = copyRoot(sourceDir, outDir, root);
    if (result === "copied") copiedRoots.push(root);
    else skippedRoots.push(root);
  }

  writeNoJekyll(outDir);

  const llmtvReaderStdout: string[] = [];
  const llmtvReaderStderr: string[] = [];
  const llmtvReaderExitCode = runRootSiteLlmtvReaderCli(
    readerArgs(options, outDir),
    readerIo(llmtvReaderStdout, llmtvReaderStderr),
  );
  const llmtvStatusCardStdout: string[] = [];
  const llmtvStatusCardStderr: string[] = [];
  const llmtvStatusCardExitCode =
    llmtvReaderExitCode === 0
      ? runHallLlmtvStatusCardCli(["--root-site", outDir], statusCardIo(llmtvStatusCardStdout, llmtvStatusCardStderr))
      : 1;

  return {
    sourceDir,
    outDir,
    copiedRoots,
    skippedRoots,
    llmtvReaderExitCode,
    llmtvReaderStdout,
    llmtvReaderStderr,
    llmtvStatusCardExitCode,
    llmtvStatusCardStdout,
    llmtvStatusCardStderr,
  };
}

function summarize(summary: PagesStaticExportSummary): string {
  const llmtvLine = summary.llmtvReaderStdout.join("").trim();
  const cardLine = summary.llmtvStatusCardStdout.join("").trim();
  return [
    `pages-static-export source=${relative(process.cwd(), summary.sourceDir) || "."}`,
    `out=${relative(process.cwd(), summary.outDir) || "."}`,
    `copied=${summary.copiedRoots.length.toString()}`,
    `skipped=${summary.skippedRoots.length.toString()}`,
    `llmtvExit=${summary.llmtvReaderExitCode.toString()}`,
    `statusCardExit=${summary.llmtvStatusCardExitCode.toString()}`,
    llmtvLine.length === 0 ? "llmtv=quiet" : `llmtv=${llmtvLine}`,
    cardLine.length === 0 ? "statusCard=quiet" : `statusCard=${cardLine}`,
  ].join(" ");
}

export function runPagesStaticExportCli(argv: readonly string[], io: PagesStaticExportIo): number {
  const parsed = parsePagesStaticExportArgs(argv);
  if (!parsed.ok) {
    io.stderr(`${parsed.error}\n`);
    return 1;
  }
  if (parsed.request.kind === "help") {
    io.stdout(`${USAGE}\n`);
    return 0;
  }

  try {
    const summary = buildPagesStaticArtifact(parsed.request.options);
    for (const text of summary.llmtvReaderStderr) io.stderr(text);
    for (const text of summary.llmtvStatusCardStderr) io.stderr(text);
    io.stdout(`${summarize(summary)}\n`);
    return summary.llmtvReaderExitCode === 0 && summary.llmtvStatusCardExitCode === 0 ? 0 : 1;
  } catch (error) {
    io.stderr(`${PAGES_STATIC_EXPORT_GENERATED_BY} failed: ${message(error)}\n`);
    return 1;
  }
}

const systemIo: PagesStaticExportIo = {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

if (import.meta.main) {
  process.exit(runPagesStaticExportCli(process.argv.slice(2), systemIo));
}
