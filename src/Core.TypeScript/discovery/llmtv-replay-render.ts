#!/usr/bin/env bun
// llmtv-replay-render -- file/artifact bridge for the zero-JS LLMTV page.
//
// Live UDP/Reticulum runners own sockets. This adapter stays on the artifact side:
// read a captured zeta.llmtv.replay.v1 JSON file, fold it through the pure replay
// core, and write the same darkhall-tv HTML document the browser can display.

import { readFileSync, writeFileSync } from "node:fs";
import { renderLlmtvDocument, type RenderDocumentOptions } from "../darkhall-ui/darkhall-tv";
import { decodeReplayArtifact, foldReplayArtifact, type ReplayStats } from "./llmtv-replay";

export interface ReplayRenderIo {
  readonly readText: (path: string) => string;
  readonly writeText: (path: string, text: string) => void;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export interface ReplayRenderSummary {
  readonly inputPath: string;
  readonly outputPath: string;
  readonly dwellers: number;
  readonly stats: ReplayStats;
}

type RenderRequest = {
  readonly kind: "render";
  readonly inputPath: string;
  readonly outputPath: string;
  readonly title?: string;
};

type HelpRequest = { readonly kind: "help" };

type ParseResult =
  | { readonly ok: true; readonly request: RenderRequest | HelpRequest }
  | { readonly ok: false; readonly error: string };

export type ReplayRenderResult =
  | { readonly ok: true; readonly html: string; readonly summary: ReplayRenderSummary }
  | { readonly ok: false; readonly error: string };

const USAGE = [
  "Usage:",
  "  bun src/Core.TypeScript/discovery/llmtv-replay-render.ts <replay.json> <out.html> [--title <title>]",
  "  bun src/Core.TypeScript/discovery/llmtv-replay-render.ts --input <replay.json> --out <out.html> [--title <title>]",
  "",
  "Renders a zeta.llmtv.replay.v1 artifact into the zero-JS Dark Hall LLMTV document.",
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

export function parseReplayRenderArgs(argv: readonly string[]): ParseResult {
  let inputPath: string | undefined;
  let outputPath: string | undefined;
  let title: string | undefined;
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "--help" || arg === "-h") {
      return { ok: true, request: { kind: "help" } };
    }
    if (arg === "--input") {
      const taken = takeValue(argv, i, arg);
      if (!taken.ok) return taken;
      inputPath = taken.value;
      i++;
      continue;
    }
    if (arg === "--out" || arg === "--output" || arg === "-o") {
      const taken = takeValue(argv, i, arg);
      if (!taken.ok) return taken;
      outputPath = taken.value;
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
    if (arg.startsWith("-")) {
      return { ok: false, error: `unknown option: ${arg}` };
    }
    positional.push(arg);
  }

  if (inputPath === undefined) inputPath = positional[0];
  if (outputPath === undefined) outputPath = positional[1];

  if (inputPath === undefined || outputPath === undefined) {
    return { ok: false, error: `input and output paths are required\n\n${USAGE}` };
  }
  if (positional.length > 2) {
    return { ok: false, error: `unexpected positional argument: ${positional[2]}` };
  }

  const base = { kind: "render" as const, inputPath, outputPath };
  return title === undefined ? { ok: true, request: base } : { ok: true, request: { ...base, title } };
}

export function renderReplayArtifactText(
  text: string,
  inputPath: string,
  outputPath: string,
  options: RenderDocumentOptions = {},
): ReplayRenderResult {
  const artifact = decodeReplayArtifact(text);
  if (artifact === null) {
    return { ok: false, error: `invalid LLMTV replay artifact: ${inputPath}` };
  }

  const result = foldReplayArtifact(artifact);
  return {
    ok: true,
    html: renderLlmtvDocument(result.transcript, options),
    summary: {
      inputPath,
      outputPath,
      dwellers: result.transcript.dwellers.length,
      stats: result.stats,
    },
  };
}

export function runReplayRenderCli(argv: readonly string[], io: ReplayRenderIo): number {
  const parsed = parseReplayRenderArgs(argv);
  if (!parsed.ok) {
    io.stderr(`${parsed.error}\n`);
    return 1;
  }

  if (parsed.request.kind === "help") {
    io.stdout(`${USAGE}\n`);
    return 0;
  }

  let text: string;
  try {
    text = io.readText(parsed.request.inputPath);
  } catch (error: unknown) {
    io.stderr(`failed to read ${parsed.request.inputPath}: ${message(error)}\n`);
    return 1;
  }

  const options = parsed.request.title === undefined ? {} : { title: parsed.request.title };
  const rendered = renderReplayArtifactText(text, parsed.request.inputPath, parsed.request.outputPath, options);
  if (!rendered.ok) {
    io.stderr(`${rendered.error}\n`);
    return 1;
  }

  try {
    io.writeText(parsed.request.outputPath, `${rendered.html}\n`);
  } catch (error: unknown) {
    io.stderr(`failed to write ${parsed.request.outputPath}: ${message(error)}\n`);
    return 1;
  }

  const { stats } = rendered.summary;
  io.stdout(
    [
      `rendered ${rendered.summary.outputPath}`,
      `from=${rendered.summary.inputPath}`,
      `dwellers=${rendered.summary.dwellers.toString()}`,
      `accepted=${stats.accepted.toString()}`,
      `rejected=${stats.rejected.toString()}`,
      `expired=${stats.expired.toString()}`,
    ].join(" ") + "\n",
  );
  return 0;
}

const systemIo: ReplayRenderIo = {
  readText: (path) => readFileSync(path, "utf8"),
  writeText: (path, text) => writeFileSync(path, text, "utf8"),
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

if (import.meta.main) {
  process.exit(runReplayRenderCli(process.argv.slice(2), systemIo));
}
