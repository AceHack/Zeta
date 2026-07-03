#!/usr/bin/env bun
// llmtv-root-site-reader -- static website reader for the LLMTV replay ledger.
//
// Live mesh writers produce data/llmtv-live.replay.json. The browser should not poll
// GitHub, GraphQL, or a forge-host API in its frame loop, so this adapter rebuilds the
// zero-JS hall/tv/index.html artifact from the same-origin ledger and makes absence,
// staleness, invalid bytes, and replay heat visible instead of pretending to be live.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  renderLlmtvDocument,
  type LlmtvReadoutStatus,
  type LlmtvTranscript,
  type RenderDocumentOptions,
} from "../darkhall-ui/darkhall-tv";
import { heatSignalsFromKinds } from "../darkhall-ui/heat";
import { decodeReplayArtifact, foldReplayArtifact, type ReplayArtifact, type ReplayStats } from "./llmtv-replay";
import {
  ROOT_SITE_LLMTV_HTML_RELATIVE_PATH,
  ROOT_SITE_LLMTV_REPLAY_RELATIVE_PATH,
  ROOT_SITE_LLMTV_TITLE,
  rootSiteLlmtvPaths,
} from "./llmtv-root-site-readout";

export const ROOT_SITE_LLMTV_READER_GENERATED_BY = "llmtv-root-site-reader";
export const DEFAULT_ROOT_SITE_LLMTV_STALE_AFTER_MS = 5 * 60 * 1000;

export type RootSiteLlmtvReaderStatusKind = LlmtvReadoutStatus["kind"];

export interface RootSiteLlmtvReaderIo {
  readonly readText: (path: string) => string;
  readonly writeText: (path: string, text: string) => void;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export interface RootSiteLlmtvReaderOptions {
  readonly rootDir: string;
  readonly nowMs: number;
  readonly staleAfterMs?: number;
  readonly title?: string;
  readonly seed?: string;
}

export type RootSiteLlmtvArtifactInput =
  | { readonly kind: "present"; readonly text: string }
  | { readonly kind: "missing"; readonly error: string };

export interface RootSiteLlmtvReaderSummary {
  readonly status: RootSiteLlmtvReaderStatusKind;
  readonly reason: string;
  readonly replayPath: string;
  readonly htmlPath: string;
  readonly frames: number;
  readonly dwellers: number;
  readonly stats: ReplayStats;
  readonly lastFrameAgeMs?: number;
}

export interface RootSiteLlmtvReaderResult {
  readonly html: string;
  readonly status: LlmtvReadoutStatus;
  readonly summary: RootSiteLlmtvReaderSummary;
}

type RenderRequest = {
  readonly kind: "render";
  readonly rootDir: string;
  readonly nowMs?: number;
  readonly staleAfterMs?: number;
  readonly title?: string;
};

type HelpRequest = { readonly kind: "help" };

type ParseResult =
  | { readonly ok: true; readonly request: RenderRequest | HelpRequest }
  | { readonly ok: false; readonly error: string };

const ZERO_STATS: ReplayStats = { accepted: 0, rejected: 0, expired: 0 };

const USAGE = [
  "Usage:",
  "  bun src/Core.TypeScript/discovery/llmtv-root-site-reader.ts --root-site <dir> [--now-ms <n>] [--stale-after-ms <n>] [--title <title>]",
  "",
  "Reads data/llmtv-live.replay.json and writes hall/tv/index.html as a zero-JS LLMTV page.",
  "Missing, empty, invalid, stale, and heaty ledgers are rendered honestly as site state.",
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

export function parseRootSiteLlmtvReaderArgs(argv: readonly string[]): ParseResult {
  let rootDir: string | undefined;
  let nowMs: number | undefined;
  let staleAfterMs: number | undefined;
  let title: string | undefined;
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "--help" || arg === "-h") {
      return { ok: true, request: { kind: "help" } };
    }
    if (arg === "--root-site" || arg === "--root-dir") {
      const taken = takeValue(argv, i, arg);
      if (!taken.ok) return taken;
      rootDir = taken.value;
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
    if (arg.startsWith("-")) {
      return { ok: false, error: `unknown option: ${arg}` };
    }
    positional.push(arg);
  }

  if (rootDir === undefined) rootDir = positional[0];
  if (rootDir === undefined || positional.length > 1) {
    return { ok: false, error: `root-site directory is required\n\n${USAGE}` };
  }

  const base = { kind: "render" as const, rootDir };
  const withNow = nowMs === undefined ? base : { ...base, nowMs };
  const withStale = staleAfterMs === undefined ? withNow : { ...withNow, staleAfterMs };
  return title === undefined ? { ok: true, request: withStale } : { ok: true, request: { ...withStale, title } };
}

function emptyTranscript(seed: string): LlmtvTranscript {
  return {
    schema: "zeta.darkhall.llmtv.v1",
    seed,
    generatedBy: ROOT_SITE_LLMTV_READER_GENERATED_BY,
    dwellers: [],
  };
}

function markLive(transcript: LlmtvTranscript, live: boolean): LlmtvTranscript {
  return {
    ...transcript,
    generatedBy: ROOT_SITE_LLMTV_READER_GENERATED_BY,
    dwellers: transcript.dwellers.map((dweller) => ({ ...dweller, live })),
  };
}

function maxFrameMs(artifact: ReplayArtifact): number | undefined {
  let max: number | undefined;
  for (const frame of artifact.frames) {
    max = max === undefined ? frame.receivedAtMs : Math.max(max, frame.receivedAtMs);
  }
  return max;
}

function ageText(ageMs: number | undefined): string {
  if (ageMs === undefined) return "n/a";
  const clamped = Math.max(0, Math.trunc(ageMs));
  if (clamped < 1000) return `${clamped.toString()}ms`;
  return `${(clamped / 1000).toFixed(1)}s`;
}

function metrics(
  frames: number,
  dwellers: number,
  stats: ReplayStats,
  lastFrameAgeMs: number | undefined,
): LlmtvReadoutStatus["metrics"] {
  return [
    { label: "frames", value: frames },
    { label: "dwellers", value: dwellers },
    { label: "accepted", value: stats.accepted },
    { label: "rejected", value: stats.rejected },
    { label: "expired", value: stats.expired },
    { label: "age", value: ageText(lastFrameAgeMs) },
  ];
}

function status(
  kind: RootSiteLlmtvReaderStatusKind,
  label: string,
  detail: string,
  frames: number,
  dwellers: number,
  stats: ReplayStats,
  lastFrameAgeMs: number | undefined,
  heatKinds: readonly string[] = [],
): LlmtvReadoutStatus {
  return {
    kind,
    label,
    detail,
    source: ROOT_SITE_LLMTV_REPLAY_RELATIVE_PATH,
    metrics: metrics(frames, dwellers, stats, lastFrameAgeMs),
    heatSignals: heatSignalsFromKinds(heatKinds),
  };
}

function renderResult(
  transcript: LlmtvTranscript,
  readoutStatus: LlmtvReadoutStatus,
  summary: RootSiteLlmtvReaderSummary,
  title: string | undefined,
): RootSiteLlmtvReaderResult {
  const options: RenderDocumentOptions = { readoutStatus, title: title ?? ROOT_SITE_LLMTV_TITLE };
  return {
    html: renderLlmtvDocument(transcript, options),
    status: readoutStatus,
    summary,
  };
}

function summarize(
  readoutStatus: LlmtvReadoutStatus,
  reason: string,
  replayPath: string,
  htmlPath: string,
  frames: number,
  dwellers: number,
  stats: ReplayStats,
  lastFrameAgeMs: number | undefined,
): RootSiteLlmtvReaderSummary {
  const base = {
    status: readoutStatus.kind,
    reason,
    replayPath,
    htmlPath,
    frames,
    dwellers,
    stats,
  };
  return lastFrameAgeMs === undefined ? base : { ...base, lastFrameAgeMs };
}

export function renderRootSiteLlmtvReadout(
  input: RootSiteLlmtvArtifactInput,
  options: RootSiteLlmtvReaderOptions,
): RootSiteLlmtvReaderResult {
  const paths = rootSiteLlmtvPaths(options.rootDir);
  const staleAfterMs = options.staleAfterMs ?? DEFAULT_ROOT_SITE_LLMTV_STALE_AFTER_MS;
  const seed = options.seed ?? "offline";

  if (input.kind === "missing") {
    const readoutStatus = status(
      "cold",
      "offline · replay missing",
      `${ROOT_SITE_LLMTV_REPLAY_RELATIVE_PATH} was not readable, so the standing view refuses to mint a fake live frame.`,
      0,
      0,
      ZERO_STATS,
      undefined,
    );
    return renderResult(
      emptyTranscript(seed),
      readoutStatus,
      summarize(readoutStatus, input.error, paths.replayPath, paths.htmlPath, 0, 0, ZERO_STATS, undefined),
      options.title,
    );
  }

  const artifact = decodeReplayArtifact(input.text);
  if (artifact === null) {
    const readoutStatus = status(
      "heat",
      "heat · invalid replay",
      "The same-origin replay ledger did not decode as zeta.llmtv.replay.v1. The page renders this as heat instead of silently falling back.",
      0,
      0,
      ZERO_STATS,
      undefined,
      ["llmtv.replay.invalid"],
    );
    return renderResult(
      emptyTranscript(seed),
      readoutStatus,
      summarize(readoutStatus, "invalid-artifact", paths.replayPath, paths.htmlPath, 0, 0, ZERO_STATS, undefined),
      options.title,
    );
  }

  const folded = foldReplayArtifact(artifact);
  const lastFrameMs = maxFrameMs(artifact);
  const lastFrameAgeMs = lastFrameMs === undefined ? undefined : Math.max(0, options.nowMs - lastFrameMs);
  const frames = artifact.frames.length;
  const dwellers = folded.transcript.dwellers.length;
  const stats = folded.stats;

  if (stats.rejected > 0 || stats.expired > 0) {
    const heatKinds = [
      ...(stats.rejected > 0 ? ["llmtv.replay.rejected"] : []),
      ...(stats.expired > 0 ? ["llmtv.replay.expired"] : []),
    ];
    const readoutStatus = status(
      "heat",
      "heat · replay loss",
      "The ledger folded with rejected or expired frames. The surviving rows are shown, but the readout is marked hot for investigation.",
      frames,
      dwellers,
      stats,
      lastFrameAgeMs,
      heatKinds,
    );
    return renderResult(
      markLive(folded.transcript, false),
      readoutStatus,
      summarize(
        readoutStatus,
        "replay-heat",
        paths.replayPath,
        paths.htmlPath,
        frames,
        dwellers,
        stats,
        lastFrameAgeMs,
      ),
      options.title,
    );
  }

  if (frames === 0 || dwellers === 0) {
    const readoutStatus = status(
      "cold",
      "cold · no channels",
      "The replay ledger is valid but has no live channels to tile. This is a typed cold state, not heat.",
      frames,
      dwellers,
      stats,
      lastFrameAgeMs,
    );
    return renderResult(
      markLive(folded.transcript, false),
      readoutStatus,
      summarize(readoutStatus, "empty", paths.replayPath, paths.htmlPath, frames, dwellers, stats, lastFrameAgeMs),
      options.title,
    );
  }

  if (lastFrameAgeMs !== undefined && lastFrameAgeMs > staleAfterMs) {
    const readoutStatus = status(
      "stale",
      "stale · no fresh frame",
      "The latest frame is older than the readout budget. The page keeps the rows visible but demotes them from live.",
      frames,
      dwellers,
      stats,
      lastFrameAgeMs,
      ["llmtv.replay.stale"],
    );
    return renderResult(
      markLive(folded.transcript, false),
      readoutStatus,
      summarize(readoutStatus, "stale", paths.replayPath, paths.htmlPath, frames, dwellers, stats, lastFrameAgeMs),
      options.title,
    );
  }

  const readoutStatus = status(
    "live",
    "live · same-origin replay",
    "The standing view was rebuilt from the committed replay ledger. No browser API loop is required.",
    frames,
    dwellers,
    stats,
    lastFrameAgeMs,
  );
  return renderResult(
    markLive(folded.transcript, true),
    readoutStatus,
    summarize(readoutStatus, "live", paths.replayPath, paths.htmlPath, frames, dwellers, stats, lastFrameAgeMs),
    options.title,
  );
}

function readArtifact(rootDir: string, io: RootSiteLlmtvReaderIo): RootSiteLlmtvArtifactInput {
  const { replayPath } = rootSiteLlmtvPaths(rootDir);
  try {
    return { kind: "present", text: io.readText(replayPath) };
  } catch (error) {
    return { kind: "missing", error: message(error) };
  }
}

export function runRootSiteLlmtvReaderCli(argv: readonly string[], io: RootSiteLlmtvReaderIo): number {
  const parsed = parseRootSiteLlmtvReaderArgs(argv);
  if (!parsed.ok) {
    io.stderr(`${parsed.error}\n`);
    return 1;
  }

  if (parsed.request.kind === "help") {
    io.stdout(`${USAGE}\n`);
    return 0;
  }

  const nowMs = parsed.request.nowMs ?? Date.now();
  const options = {
    rootDir: parsed.request.rootDir,
    nowMs,
    ...(parsed.request.staleAfterMs === undefined ? {} : { staleAfterMs: parsed.request.staleAfterMs }),
    ...(parsed.request.title === undefined ? {} : { title: parsed.request.title }),
  } satisfies RootSiteLlmtvReaderOptions;
  const input = readArtifact(parsed.request.rootDir, io);
  const rendered = renderRootSiteLlmtvReadout(input, options);

  try {
    io.writeText(rendered.summary.htmlPath, `${rendered.html}\n`);
  } catch (error) {
    io.stderr(`failed to write ${rendered.summary.htmlPath}: ${message(error)}\n`);
    return 1;
  }

  io.stdout(
    [
      `wrote ${ROOT_SITE_LLMTV_HTML_RELATIVE_PATH}`,
      `from=${ROOT_SITE_LLMTV_REPLAY_RELATIVE_PATH}`,
      `status=${rendered.summary.status}`,
      `reason=${rendered.summary.reason}`,
      `dwellers=${rendered.summary.dwellers.toString()}`,
      `frames=${rendered.summary.frames.toString()}`,
    ].join(" ") + "\n",
  );
  return 0;
}

const systemIo: RootSiteLlmtvReaderIo = {
  readText: (path) => readFileSync(path, "utf8"),
  writeText: (path, text) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, "utf8");
  },
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

if (import.meta.main) {
  process.exit(runRootSiteLlmtvReaderCli(process.argv.slice(2), systemIo));
}
