#!/usr/bin/env bun
// llmtv-room-root-site-readout -- publish room transcripts to the standing LLMTV site.
//
// Live mesh runners can write the same replay ledger through llmtv-root-site-readout.
// This adapter is the static/sim side: one or more RoomRunTranscript JSON files become
// data/llmtv-live.replay.json plus the zero-JS hall/tv/index.html page.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { RoomRunTranscript } from "../darkhall-ui/darkhall-room";
import { encodeReplayArtifact } from "./llmtv-replay";
import { roomTranscriptsToReplayArtifact, type RoomTranscriptReplayEntry } from "./llmtv-room-replay";
import {
  renderRootSiteLlmtvReadout,
  type RootSiteLlmtvReaderIo,
  type RootSiteLlmtvReaderResult,
} from "./llmtv-root-site-reader";
import {
  ROOT_SITE_LLMTV_REPLAY_RELATIVE_PATH,
  ROOT_SITE_LLMTV_TITLE,
  rootSiteLlmtvPaths,
} from "./llmtv-root-site-readout";

export const ROOT_SITE_ROOM_LLMTV_GENERATED_BY = "llmtv-room-root-site-readout";

export interface RootSiteRoomLlmtvIo extends RootSiteLlmtvReaderIo {}

export interface RootSiteRoomLlmtvOptions {
  readonly rootDir: string;
  readonly nowMs: number;
  readonly staleAfterMs?: number;
  readonly expireTtlMs?: number;
  readonly title?: string;
  readonly seed?: string;
  readonly generatedBy?: string;
}

export interface RootSiteRoomLlmtvSummary {
  readonly replayPath: string;
  readonly htmlPath: string;
  readonly transcripts: number;
  readonly frames: number;
  readonly dwellers: number;
  readonly status: RootSiteLlmtvReaderResult["summary"]["status"];
  readonly reason: RootSiteLlmtvReaderResult["summary"]["reason"];
}

export type RootSiteRoomLlmtvResult =
  | { readonly ok: true; readonly summary: RootSiteRoomLlmtvSummary; readonly replayText: string; readonly html: string }
  | { readonly ok: false; readonly error: string };

type PublishRequest = {
  readonly kind: "publish";
  readonly rootDir: string;
  readonly transcriptPaths: readonly string[];
  readonly nowMs?: number;
  readonly staleAfterMs?: number;
  readonly expireTtlMs?: number;
  readonly title?: string;
  readonly seed?: string;
};

type HelpRequest = { readonly kind: "help" };

type ParseResult =
  | { readonly ok: true; readonly request: PublishRequest | HelpRequest }
  | { readonly ok: false; readonly error: string };

const USAGE = [
  "Usage:",
  "  bun src/Core.TypeScript/discovery/llmtv-room-root-site-readout.ts --root-site <dir> --room <room.json> [--room <room2.json> ...] [--now-ms <n>] [--stale-after-ms <n>] [--expire-ttl-ms <n>] [--title <title>] [--seed <seed>]",
  "",
  "Writes data/llmtv-live.replay.json and hall/tv/index.html from zeta.darkhall.room-ui.v1 transcripts.",
].join("\n");

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
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

export function parseRootSiteRoomLlmtvArgs(argv: readonly string[]): ParseResult {
  let rootDir: string | undefined;
  let nowMs: number | undefined;
  let staleAfterMs: number | undefined;
  let expireTtlMs: number | undefined;
  let title: string | undefined;
  let seed: string | undefined;
  const transcriptPaths: string[] = [];
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) continue;
    if (arg === "--help" || arg === "-h") return { ok: true, request: { kind: "help" } };
    if (arg === "--root-site" || arg === "--root-dir") {
      const taken = takeValue(argv, i, arg);
      if (!taken.ok) return taken;
      rootDir = taken.value;
      i++;
      continue;
    }
    if (arg === "--room" || arg === "--transcript") {
      const taken = takeValue(argv, i, arg);
      if (!taken.ok) return taken;
      transcriptPaths.push(taken.value);
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
    if (arg === "--expire-ttl-ms") {
      const taken = takeValue(argv, i, arg);
      if (!taken.ok) return taken;
      const parsed = parseNumber(taken.value, arg);
      if (!parsed.ok) return parsed;
      expireTtlMs = parsed.value;
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
    if (arg === "--seed") {
      const taken = takeValue(argv, i, arg);
      if (!taken.ok) return taken;
      seed = taken.value;
      i++;
      continue;
    }
    if (arg.startsWith("-")) return { ok: false, error: `unknown option: ${arg}` };
    positional.push(arg);
  }

  if (rootDir === undefined) rootDir = positional[0];
  const positionalRooms = rootDir === positional[0] ? positional.slice(1) : positional;
  transcriptPaths.push(...positionalRooms);

  if (rootDir === undefined || transcriptPaths.length === 0) {
    return { ok: false, error: `root-site and at least one room transcript are required\n\n${USAGE}` };
  }

  const base = { kind: "publish" as const, rootDir, transcriptPaths };
  const withNow = nowMs === undefined ? base : { ...base, nowMs };
  const withStale = staleAfterMs === undefined ? withNow : { ...withNow, staleAfterMs };
  const withExpire = expireTtlMs === undefined ? withStale : { ...withStale, expireTtlMs };
  const withTitle = title === undefined ? withExpire : { ...withExpire, title };
  return seed === undefined ? { ok: true, request: withTitle } : { ok: true, request: { ...withTitle, seed } };
}

export function decodeRoomRunTranscript(text: string): RoomRunTranscript | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  const record = asRecord(parsed);
  if (
    record === null ||
    record.schema !== "zeta.darkhall.room-ui.v1" ||
    typeof record.roomName !== "string" ||
    typeof record.seed !== "string" ||
    !Array.isArray(record.controller) ||
    !Array.isArray(record.ticks) ||
    !Array.isArray(record.heatRows)
  ) {
    return null;
  }

  return parsed as RoomRunTranscript;
}

function sourceZid(transcript: RoomRunTranscript): string {
  return `room:${transcript.roomName}:${transcript.seed}`;
}

function replayEntries(transcripts: readonly RoomRunTranscript[]): readonly RoomTranscriptReplayEntry[] {
  return transcripts.map((transcript) => ({
    transcript,
    sourceZid: sourceZid(transcript),
    sourceName: transcript.roomName,
    from: "room-root-site",
  }));
}

export function publishRoomTranscriptsToRootSiteLlmtv(
  transcripts: readonly RoomRunTranscript[],
  io: RootSiteRoomLlmtvIo,
  options: RootSiteRoomLlmtvOptions,
): RootSiteRoomLlmtvResult {
  if (transcripts.length === 0) {
    return { ok: false, error: "at least one room transcript is required" };
  }

  const paths = rootSiteLlmtvPaths(options.rootDir);
  const firstSeed = transcripts[0]?.seed ?? "room-replay";
  const expire = options.expireTtlMs === undefined ? undefined : { nowMs: options.nowMs, ttlMs: options.expireTtlMs };
  const artifact = roomTranscriptsToReplayArtifact(replayEntries(transcripts), {
    seed: options.seed ?? firstSeed,
    generatedBy: options.generatedBy ?? ROOT_SITE_ROOM_LLMTV_GENERATED_BY,
    ...(expire === undefined ? {} : { expire }),
  });
  const replayText = encodeReplayArtifact(artifact);
  const rendered = renderRootSiteLlmtvReadout(
    { kind: "present", text: replayText },
    {
      rootDir: options.rootDir,
      nowMs: options.nowMs,
      ...(options.staleAfterMs === undefined ? {} : { staleAfterMs: options.staleAfterMs }),
      title: options.title ?? ROOT_SITE_LLMTV_TITLE,
      seed: artifact.seed,
    },
  );

  try {
    io.writeText(paths.replayPath, replayText);
    io.writeText(paths.htmlPath, `${rendered.html}\n`);
  } catch (error) {
    return { ok: false, error: `failed to write root-site LLMTV readout: ${message(error)}` };
  }

  return {
    ok: true,
    replayText,
    html: rendered.html,
    summary: {
      replayPath: paths.replayPath,
      htmlPath: paths.htmlPath,
      transcripts: transcripts.length,
      frames: rendered.summary.frames,
      dwellers: rendered.summary.dwellers,
      status: rendered.summary.status,
      reason: rendered.summary.reason,
    },
  };
}

function readTranscripts(
  paths: readonly string[],
  io: RootSiteRoomLlmtvIo,
): { readonly ok: true; readonly transcripts: readonly RoomRunTranscript[] } | { readonly ok: false; readonly error: string } {
  const transcripts: RoomRunTranscript[] = [];
  for (const path of paths) {
    let text: string;
    try {
      text = io.readText(path);
    } catch (error) {
      return { ok: false, error: `failed to read ${path}: ${message(error)}` };
    }
    const transcript = decodeRoomRunTranscript(text);
    if (transcript === null) {
      return { ok: false, error: `invalid room transcript: ${path}` };
    }
    transcripts.push(transcript);
  }
  return { ok: true, transcripts };
}

export function runRootSiteRoomLlmtvCli(argv: readonly string[], io: RootSiteRoomLlmtvIo): number {
  const parsed = parseRootSiteRoomLlmtvArgs(argv);
  if (!parsed.ok) {
    io.stderr(`${parsed.error}\n`);
    return 1;
  }
  if (parsed.request.kind === "help") {
    io.stdout(`${USAGE}\n`);
    return 0;
  }

  const loaded = readTranscripts(parsed.request.transcriptPaths, io);
  if (!loaded.ok) {
    io.stderr(`${loaded.error}\n`);
    return 1;
  }

  const nowMs = parsed.request.nowMs ?? Date.now();
  const result = publishRoomTranscriptsToRootSiteLlmtv(loaded.transcripts, io, {
    rootDir: parsed.request.rootDir,
    nowMs,
    ...(parsed.request.staleAfterMs === undefined ? {} : { staleAfterMs: parsed.request.staleAfterMs }),
    ...(parsed.request.expireTtlMs === undefined ? {} : { expireTtlMs: parsed.request.expireTtlMs }),
    ...(parsed.request.title === undefined ? {} : { title: parsed.request.title }),
    ...(parsed.request.seed === undefined ? {} : { seed: parsed.request.seed }),
  });

  if (!result.ok) {
    io.stderr(`${result.error}\n`);
    return 1;
  }

  io.stdout(
    [
      `wrote ${ROOT_SITE_LLMTV_REPLAY_RELATIVE_PATH}`,
      `html=hall/tv/index.html`,
      `status=${result.summary.status}`,
      `reason=${result.summary.reason}`,
      `transcripts=${result.summary.transcripts.toString()}`,
      `dwellers=${result.summary.dwellers.toString()}`,
      `frames=${result.summary.frames.toString()}`,
    ].join(" ") + "\n",
  );
  return 0;
}

const systemIo: RootSiteRoomLlmtvIo = {
  readText: (path) => readFileSync(path, "utf8"),
  writeText: (path, text) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, "utf8");
  },
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

if (import.meta.main) {
  process.exit(runRootSiteRoomLlmtvCli(process.argv.slice(2), systemIo));
}
