#!/usr/bin/env bun
// llmtv-hall-status-card -- project data/llmtv-live.status.json onto the Hall index.
//
// This keeps the browser passive: the site build consumes the same-origin status sidecar
// and commits or exports static HTML. No GitHub API, no GraphQL, no frame-loop fetch.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  decodeRootSiteLlmtvStatus,
  ROOT_SITE_LLMTV_STATUS_RELATIVE_PATH,
  rootSiteLlmtvStatusPath,
  type RootSiteLlmtvStatus,
  type RootSiteLlmtvStatusKind,
} from "./llmtv-root-site-status";

export const HALL_INDEX_RELATIVE_PATH = "hall/index.html";
export const HALL_LLMTV_STATUS_CARD_GENERATED_BY = "llmtv-hall-status-card";
export const HALL_LLMTV_STATUS_CARD_START = "<!-- zeta-llmtv-status-card:start -->";
export const HALL_LLMTV_STATUS_CARD_END = "<!-- zeta-llmtv-status-card:end -->";

export interface HallLlmtvStatusCardIo {
  readonly readText: (path: string) => string;
  readonly writeText: (path: string, text: string) => void;
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
}

export interface HallLlmtvStatusCardOptions {
  readonly rootDir: string;
}

export type HallLlmtvStatusCardStatus = RootSiteLlmtvStatusKind;
export type HallLlmtvStatusCardChannel = RootSiteLlmtvStatus["channel"] | "missing" | "invalid";

export type HallLlmtvStatusCardInput =
  | { readonly kind: "present"; readonly text: string }
  | { readonly kind: "missing"; readonly error: string };

export interface HallLlmtvStatusCardSummary {
  readonly status: HallLlmtvStatusCardStatus;
  readonly channel: HallLlmtvStatusCardChannel;
  readonly reason: string;
  readonly indexPath: string;
  readonly statusPath: string;
  readonly frames: number;
  readonly dwellers: number;
  readonly accepted: number;
  readonly rejected: number;
  readonly expired: number;
  readonly lastFrameAgeMs?: number;
  readonly phaseClock?: RootSiteLlmtvStatus["phaseClock"];
}

type RenderRequest = {
  readonly kind: "render";
  readonly rootDir: string;
};

type HelpRequest = { readonly kind: "help" };

type ParseResult =
  | { readonly ok: true; readonly request: RenderRequest | HelpRequest }
  | { readonly ok: false; readonly error: string };

const ZERO_SUMMARY = {
  frames: 0,
  dwellers: 0,
  accepted: 0,
  rejected: 0,
  expired: 0,
} as const;

const USAGE = [
  "Usage:",
  "  bun src/Core.TypeScript/discovery/llmtv-hall-status-card.ts --root-site <dir>",
  "",
  "Reads data/llmtv-live.status.json and updates hall/index.html with a zero-JS status card.",
].join("\n");

function joinRelative(rootDir: string, relativePath: string): string {
  return join(rootDir, ...relativePath.split("/"));
}

export function hallIndexPath(rootDir: string): string {
  return joinRelative(rootDir, HALL_INDEX_RELATIVE_PATH);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

export function parseHallLlmtvStatusCardArgs(argv: readonly string[]): ParseResult {
  let rootDir: string | undefined;
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
    if (arg.startsWith("-")) {
      return { ok: false, error: `unknown option: ${arg}` };
    }
    positional.push(arg);
  }

  if (rootDir === undefined) rootDir = positional[0];
  if (rootDir === undefined || positional.length > 1) {
    return { ok: false, error: `root-site directory is required\n\n${USAGE}` };
  }

  return { ok: true, request: { kind: "render", rootDir } };
}

function summaryFromStatus(
  status: RootSiteLlmtvStatus,
  indexPath: string,
  statusPath: string,
): HallLlmtvStatusCardSummary {
  const base = {
    status: status.status,
    channel: status.channel,
    reason: status.reason,
    indexPath,
    statusPath,
    frames: status.frames,
    dwellers: status.dwellers,
    accepted: status.stats.accepted,
    rejected: status.stats.rejected,
    expired: status.stats.expired,
  };
  const withAge = status.lastFrameAgeMs === undefined ? base : { ...base, lastFrameAgeMs: status.lastFrameAgeMs };
  return status.phaseClock === undefined ? withAge : { ...withAge, phaseClock: status.phaseClock };
}

function missingSummary(error: string, indexPath: string, statusPath: string): HallLlmtvStatusCardSummary {
  return {
    status: "cold",
    channel: "missing",
    reason: error,
    indexPath,
    statusPath,
    ...ZERO_SUMMARY,
  };
}

function invalidSummary(indexPath: string, statusPath: string): HallLlmtvStatusCardSummary {
  return {
    status: "heat",
    channel: "invalid",
    reason: "invalid-status-json",
    indexPath,
    statusPath,
    ...ZERO_SUMMARY,
  };
}

export function summarizeHallLlmtvStatusCard(
  input: HallLlmtvStatusCardInput,
  options: HallLlmtvStatusCardOptions,
): HallLlmtvStatusCardSummary {
  const indexPath = hallIndexPath(options.rootDir);
  const statusPath = rootSiteLlmtvStatusPath(options.rootDir);

  if (input.kind === "missing") {
    return missingSummary(input.error, indexPath, statusPath);
  }

  const status = decodeRootSiteLlmtvStatus(input.text);
  return status === null ? invalidSummary(indexPath, statusPath) : summaryFromStatus(status, indexPath, statusPath);
}

function heading(status: HallLlmtvStatusCardStatus): string {
  if (status === "live") return "LLMTV live";
  if (status === "stale") return "LLMTV stale";
  if (status === "heat") return "LLMTV heat";
  return "LLMTV cold";
}

function copy(summary: HallLlmtvStatusCardSummary): string {
  if (summary.channel === "missing") {
    return "No status sidecar was present in data/, so the Hall advertises a cold live surface.";
  }
  if (summary.channel === "invalid") {
    return "The status sidecar did not decode; the Hall marks the live surface as heat for investigation.";
  }
  if (summary.status === "live") {
    return "The Hall is reading the committed same-origin status sidecar.";
  }
  if (summary.status === "stale") {
    return "The last accepted frame exceeded the freshness budget.";
  }
  if (summary.status === "heat") {
    return "The latest replay fold reported rejected, expired, or invalid evidence.";
  }
  return "The replay path is validly quiet.";
}

function metric(label: string, value: number | string): string {
  return `<span><b>${escapeHtml(value.toString())}</b>${escapeHtml(label)}</span>`;
}

export function renderHallLlmtvStatusCard(summary: HallLlmtvStatusCardSummary): string {
  const title = heading(summary.status);
  const detail = copy(summary);
  const reason = summary.reason.length === 0 ? "none" : summary.reason;
  const phaseClock = summary.phaseClock;
  const ageAttr =
    summary.lastFrameAgeMs === undefined
      ? ""
      : ` data-last-frame-age-ms="${escapeHtml(summary.lastFrameAgeMs.toString())}"`;
  const phaseAttrs =
    phaseClock === undefined
      ? ""
      : ` data-phase-clock="${escapeHtml(phaseClock.schema)}" data-phase-clock-basis="${escapeHtml(phaseClock.basis)}" data-phase-source="${escapeHtml(phaseClock.source)}" data-phase="${escapeHtml(phaseClock.phase.toString())}" data-phase-skew-bound="${escapeHtml(phaseClock.skewBoundTicks.toString())}" data-phase-travelers="${escapeHtml(phaseClock.travelers.toString())}" data-phase-append-only="${escapeHtml(String(phaseClock.appendOnly))}"`;
  const ageMetric = summary.lastFrameAgeMs === undefined ? "" : metric("age-ms", summary.lastFrameAgeMs);
  const phaseMetrics =
    phaseClock === undefined
      ? ""
      : [
          metric("phase", phaseClock.phase),
          metric("skew", phaseClock.skewBoundTicks),
          metric("travelers", phaseClock.travelers),
        ].join("");
  return [
    `<aside class="llmtv-status-card llmtv-status-card--${escapeHtml(summary.status)}" data-llmtv-status-card="present" data-status="${escapeHtml(summary.status)}" data-channel="${escapeHtml(summary.channel)}" data-frames="${escapeHtml(summary.frames.toString())}" data-dwellers="${escapeHtml(summary.dwellers.toString())}" data-rejected="${escapeHtml(summary.rejected.toString())}" data-expired="${escapeHtml(summary.expired.toString())}"${ageAttr}${phaseAttrs}>`,
    `  <div class="llmtv-status-card__rail"><span>${escapeHtml(summary.status)}</span><span>${escapeHtml(summary.channel)}</span></div>`,
    `  <div class="llmtv-status-card__body">`,
    `    <h2>${escapeHtml(title)}</h2>`,
    `    <p>${escapeHtml(detail)}</p>`,
    `    <dl class="llmtv-status-card__reason"><dt>reason</dt><dd>${escapeHtml(reason)}</dd></dl>`,
    `    <div class="llmtv-status-card__metrics">${metric("frames", summary.frames)}${metric("dwellers", summary.dwellers)}${metric("accepted", summary.accepted)}${metric("rejected", summary.rejected)}${metric("expired", summary.expired)}${ageMetric}${phaseMetrics}</div>`,
    `    <a class="llmtv-status-card__link" href="./tv/">Open LLMTV</a>`,
    `  </div>`,
    `</aside>`,
  ].join("\n");
}

export function renderHallLlmtvStatusCardBlock(summary: HallLlmtvStatusCardSummary): string {
  return [HALL_LLMTV_STATUS_CARD_START, renderHallLlmtvStatusCard(summary), HALL_LLMTV_STATUS_CARD_END].join("\n");
}

function insertBeforeCards(html: string, block: string): string | null {
  const cardsIndex = html.indexOf('      <div class="cards">');
  if (cardsIndex === -1) return null;
  return `${html.slice(0, cardsIndex)}${block}\n${html.slice(cardsIndex)}`;
}

export function replaceHallLlmtvStatusCardBlock(html: string, block: string): string | null {
  const start = html.indexOf(HALL_LLMTV_STATUS_CARD_START);
  const end = html.indexOf(HALL_LLMTV_STATUS_CARD_END);
  if (start !== -1 && end !== -1 && end > start) {
    const afterEnd = end + HALL_LLMTV_STATUS_CARD_END.length;
    return `${html.slice(0, start)}${block}${html.slice(afterEnd)}`;
  }
  if (start !== -1 || end !== -1) return null;
  return insertBeforeCards(html, block);
}

function readStatus(rootDir: string, io: HallLlmtvStatusCardIo): HallLlmtvStatusCardInput {
  const statusPath = rootSiteLlmtvStatusPath(rootDir);
  try {
    return { kind: "present", text: io.readText(statusPath) };
  } catch (error) {
    return { kind: "missing", error: message(error) };
  }
}

export function updateHallLlmtvStatusCard(
  input: HallLlmtvStatusCardInput,
  indexHtml: string,
  options: HallLlmtvStatusCardOptions,
):
  | { readonly ok: true; readonly html: string; readonly summary: HallLlmtvStatusCardSummary }
  | { readonly ok: false; readonly error: string } {
  const summary = summarizeHallLlmtvStatusCard(input, options);
  const block = renderHallLlmtvStatusCardBlock(summary);
  const html = replaceHallLlmtvStatusCardBlock(indexHtml, block);
  if (html === null) {
    return { ok: false, error: "hall/index.html is missing a valid LLMTV status-card insertion point" };
  }
  return { ok: true, html, summary };
}

export function runHallLlmtvStatusCardCli(argv: readonly string[], io: HallLlmtvStatusCardIo): number {
  const parsed = parseHallLlmtvStatusCardArgs(argv);
  if (!parsed.ok) {
    io.stderr(`${parsed.error}\n`);
    return 1;
  }
  if (parsed.request.kind === "help") {
    io.stdout(`${USAGE}\n`);
    return 0;
  }

  const rootDir = parsed.request.rootDir;
  const indexPath = hallIndexPath(rootDir);
  let indexHtml: string;
  try {
    indexHtml = io.readText(indexPath);
  } catch (error) {
    io.stderr(`failed to read ${HALL_INDEX_RELATIVE_PATH}: ${message(error)}\n`);
    return 1;
  }

  const updated = updateHallLlmtvStatusCard(readStatus(rootDir, io), indexHtml, { rootDir });
  if (!updated.ok) {
    io.stderr(`${updated.error}\n`);
    return 1;
  }

  try {
    io.writeText(indexPath, updated.html);
  } catch (error) {
    io.stderr(`failed to write ${HALL_INDEX_RELATIVE_PATH}: ${message(error)}\n`);
    return 1;
  }

  io.stdout(
    [
      `wrote ${HALL_INDEX_RELATIVE_PATH}`,
      `from=${ROOT_SITE_LLMTV_STATUS_RELATIVE_PATH}`,
      `status=${updated.summary.status}`,
      `channel=${updated.summary.channel}`,
      `frames=${updated.summary.frames.toString()}`,
      `dwellers=${updated.summary.dwellers.toString()}`,
      ...(updated.summary.lastFrameAgeMs === undefined ? [] : [`ageMs=${updated.summary.lastFrameAgeMs.toString()}`]),
      ...(updated.summary.phaseClock === undefined
        ? []
        : [
            `phase=${updated.summary.phaseClock.phase.toString()}`,
            `skew=${updated.summary.phaseClock.skewBoundTicks.toString()}`,
          ]),
    ].join(" ") + "\n",
  );
  return 0;
}

const systemIo: HallLlmtvStatusCardIo = {
  readText: (path) => readFileSync(path, "utf8"),
  writeText: (path, text) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text, "utf8");
  },
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
};

if (import.meta.main) {
  process.exit(runHallLlmtvStatusCardCli(process.argv.slice(2), systemIo));
}
