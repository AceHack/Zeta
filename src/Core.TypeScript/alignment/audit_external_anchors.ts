#!/usr/bin/env bun
// audit_external_anchors.ts — 081KR2E4K0008QG0R001ZWARTN
// Per-concept external anchor coverage scanner.
//
// Loads the concept registry (081KR2E4K0008QG0R003DS2XHJ), locates each concept in its
// source surface, and extracts external URLs from the surrounding
// context window. Emits a coverage report mapping each concept to
// its anchors or an "anchor-pending" marker.
//
// Usage:
//   bun src/Core.TypeScript/alignment/audit_external_anchors.ts
//   bun src/Core.TypeScript/alignment/audit_external_anchors.ts --json
//   bun src/Core.TypeScript/alignment/audit_external_anchors.ts --md
//   bun src/Core.TypeScript/alignment/audit_external_anchors.ts --out DIR
//
// Exit codes:
//   0  Clean run
//   2  Script error / bad args

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { buildRegistry } from "./concept_registry.ts";

type AuditExitCode = 0 | 2;

// ── URL classification ───────────────────────────────────────────────────────

export type UrlKind = "paper" | "rfc" | "blog" | "so-se" | "talk" | "other";

const PAPER_DOMAINS = [
  "arxiv.org",
  "doi.org",
  "dl.acm.org",
  "semanticscholar.org",
  "jstor.org",
  "scholar.google.com",
  "springer.com",
  "nature.com",
  "ieee.org",
  "acm.org",
  "ncbi.nlm.nih.gov",
  "openreview.net",
  "proceedings.mlr.press",
  "papers.nips.cc",
  "aclanthology.org",
];

const RFC_DOMAINS = [
  "tools.ietf.org",
  "rfc-editor.org",
  "datatracker.ietf.org",
  "w3.org",
];

const SOSE_DOMAINS = [
  "stackoverflow.com",
  "stackexchange.com",
  "serverfault.com",
  "superuser.com",
  "askubuntu.com",
];

const TALK_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "slideshare.net",
  "speakerdeck.com",
  "loom.com",
];

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function classifyUrl(url: string): UrlKind {
  const host = domainOf(url);
  if (host === "") return "other";
  if (PAPER_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`)))
    return "paper";
  if (RFC_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`)))
    return "rfc";
  if (SOSE_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`)))
    return "so-se";
  if (TALK_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`)))
    return "talk";
  return "blog";
}

// ── URL extraction from a text window ────────────────────────────────────────

export interface AnchorEntry {
  readonly url: string;
  readonly kind: UrlKind;
  readonly title: string;
}

// Matches [title](https://...) — captures title and URL.
const MARKDOWN_LINK_RE = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
// Matches bare https?://... not already inside a markdown link.
const BARE_URL_RE = /(?<!\()https?:\/\/[^\s),\]"'`>]+/g;

export function extractUrlsFromWindow(
  content: string,
  conceptId: string,
  windowLines = 20,
): AnchorEntry[] {
  const lines = content.split("\n");
  // Find the first line that contains the concept ID as a token.
  const idPattern = new RegExp(`\\b${escapeRegex(conceptId)}\\b`);
  const anchorIdx = lines.findIndex((l) => idPattern.test(l));
  if (anchorIdx < 0) return [];

  const start = Math.max(0, anchorIdx - windowLines);
  const end = Math.min(lines.length, anchorIdx + windowLines + 1);
  const window = lines.slice(start, end).join("\n");

  const seen = new Set<string>();
  const entries: AnchorEntry[] = [];

  // Pass 1: markdown links (title available).
  for (const m of window.matchAll(MARKDOWN_LINK_RE)) {
    const title = m[1] ?? "";
    const url = m[2] ?? "";
    if (!seen.has(url)) {
      seen.add(url);
      entries.push({ url, kind: classifyUrl(url), title });
    }
  }

  // Pass 2: bare URLs not already captured.
  for (const m of window.matchAll(BARE_URL_RE)) {
    const url = m[0];
    if (!seen.has(url)) {
      seen.add(url);
      entries.push({ url, kind: classifyUrl(url), title: "" });
    }
  }

  return entries;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Audit ────────────────────────────────────────────────────────────────────

export type ConceptStatus = "anchored" | "anchor-pending";

export interface ConceptCoverage {
  readonly id: string;
  readonly conceptClass: string;
  readonly source: string;
  readonly status: ConceptStatus;
  readonly anchors: readonly AnchorEntry[];
}

export interface AuditResult {
  readonly schema: string;
  readonly generated: string;
  readonly totalConcepts: number;
  readonly anchored: number;
  readonly pending: number;
  readonly concepts: readonly ConceptCoverage[];
}

const REPO_ROOT = resolve(import.meta.dir, "../../..");

function readSource(rel: string): string {
  const abs = join(REPO_ROOT, rel);
  return existsSync(abs) ? readFileSync(abs, "utf8") : "";
}

export function audit(): AuditResult {
  const registry = buildRegistry();
  const concepts: ConceptCoverage[] = [];

  for (const concept of registry.concepts) {
    const content = readSource(concept.source);
    const anchors = extractUrlsFromWindow(content, concept.id, 20);
    const status: ConceptStatus = anchors.length > 0 ? "anchored" : "anchor-pending";
    concepts.push({
      id: concept.id,
      conceptClass: concept.conceptClass,
      source: concept.source,
      status,
      anchors,
    });
  }

  const anchoredCount = concepts.filter((c) => c.status === "anchored").length;

  return {
    schema: "external-anchor-coverage-v1",
    generated: new Date().toISOString(),
    totalConcepts: concepts.length,
    anchored: anchoredCount,
    pending: concepts.length - anchoredCount,
    concepts,
  };
}

// ── Emit helpers ─────────────────────────────────────────────────────────────

function emitJson(r: AuditResult): string {
  return `${JSON.stringify(r, null, 2)}\n`;
}

function emitMd(r: AuditResult): string {
  const lines: string[] = [];
  lines.push("# External-anchor coverage audit");
  lines.push("");
  lines.push(`Schema: \`${r.schema}\`. Generated: ${r.generated}.`);
  lines.push("");
  lines.push(
    `Concepts: **${String(r.totalConcepts)}** — ` +
      `anchored: **${String(r.anchored)}**, anchor-pending: **${String(r.pending)}**.`,
  );
  lines.push("");
  lines.push("| Concept | Class | Source | Status | Anchor URLs |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const c of r.concepts) {
    const urlCells =
      c.anchors.length > 0
        ? c.anchors
            .map((a) => (a.title !== "" ? `[${a.title}](${a.url}) \`${a.kind}\`` : `${a.url} \`${a.kind}\``))
            .join("<br>")
        : "(none)";
    lines.push(`| \`${c.id}\` | ${c.conceptClass} | ${c.source} | **${c.status}** | ${urlCells} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function emitHumanSummary(r: AuditResult): string {
  const lines: string[] = [];
  lines.push(
    `external-anchor-coverage: ${String(r.totalConcepts)} concepts, ` +
      `${String(r.anchored)} anchored, ${String(r.pending)} anchor-pending`,
  );
  lines.push("");

  const pending = r.concepts.filter((c) => c.status === "anchor-pending");
  if (pending.length > 0) {
    lines.push(`anchor-pending (${String(pending.length)}):`);
    for (const c of pending) {
      lines.push(`  [${c.conceptClass}] ${c.id}  (${c.source})`);
    }
    lines.push("");
  }

  const anchored = r.concepts.filter((c) => c.status === "anchored");
  if (anchored.length > 0) {
    lines.push(`anchored (${String(anchored.length)}):`);
    for (const c of anchored) {
      const firstUrl = c.anchors[0]?.url ?? "";
      lines.push(`  [${c.conceptClass}] ${c.id}  ${firstUrl}`);
    }
  }
  return lines.join("\n");
}

// ── CLI arg parsing ───────────────────────────────────────────────────────────

interface Args {
  readonly json: boolean;
  readonly md: boolean;
  readonly outDir: string | null;
}

type ParseResult =
  | { readonly kind: "args"; readonly args: Args }
  | { readonly kind: "help" }
  | { readonly kind: "error"; readonly message: string };

function parseArgs(argv: readonly string[]): ParseResult {
  const state: { json: boolean; md: boolean; outDir: string | null } = {
    json: false,
    md: false,
    outDir: null,
  };
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i] ?? "";
    if (arg === "-h" || arg === "--help") return { kind: "help" };
    if (arg === "--json") {
      state.json = true;
      i++;
      continue;
    }
    if (arg === "--md") {
      state.md = true;
      i++;
      continue;
    }
    if (arg === "--out") {
      const next = argv[i + 1];
      if (next === undefined)
        return { kind: "error", message: "audit_external_anchors.ts: --out requires a directory" };
      state.outDir = next;
      i += 2;
      continue;
    }
    return { kind: "error", message: `audit_external_anchors.ts: unknown arg: ${arg}` };
  }
  return { kind: "args", args: state };
}

function repoRoot(): string {
  const result = spawnSync(
    "git", // eslint-disable-line sonarjs/no-os-command-from-path
    ["rev-parse", "--show-toplevel"],
    { encoding: "utf8" },
  );
  if (result.error) throw new Error(`git rev-parse failed: ${result.error.message}`);
  if (result.status !== 0)
    throw new Error(`git rev-parse exited with status ${String(result.status)}`);
  return result.stdout.trim();
}

export function main(argv: readonly string[]): AuditExitCode {
  const parsed = parseArgs(argv);
  if (parsed.kind === "help") {
    process.stdout.write(
      "Usage: audit_external_anchors.ts [--json | --md] [--out DIR]\n",
    );
    return 0;
  }
  if (parsed.kind === "error") {
    process.stderr.write(`${parsed.message}\n`);
    return 2;
  }

  process.chdir(repoRoot());

  const { args } = parsed;
  const result = audit();

  if (args.outDir !== null) {
    mkdirSync(args.outDir, { recursive: true });
    writeFileSync(join(args.outDir, "external-anchors.json"), emitJson(result));
    writeFileSync(join(args.outDir, "external-anchors.md"), emitMd(result));
    process.stdout.write(
      `audit_external_anchors: wrote ${args.outDir}/external-anchors.{json,md}\n`,
    );
  } else if (args.json) {
    process.stdout.write(emitJson(result));
  } else if (args.md) {
    process.stdout.write(emitMd(result));
  } else {
    process.stdout.write(`${emitHumanSummary(result)}\n`);
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
