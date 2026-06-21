#!/usr/bin/env bun
// audit_external_anchors.ts — B-0311
// Per-concept external anchor coverage scanner.
//
// Loads the concept registry (B-0310), locates each concept in its
// source surface, and extracts external URLs from the surrounding
// context window. Emits a coverage report mapping each concept to
// its anchors or an "anchor-pending" marker.
//
// Usage:
//   bun tools/alignment/audit_external_anchors.ts
//   bun tools/alignment/audit_external_anchors.ts --json
//   bun tools/alignment/audit_external_anchors.ts --md
//   bun tools/alignment/audit_external_anchors.ts --out DIR
//
// Exit codes:
//   0  Clean run
//   2  Script error / bad args
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { buildRegistry } from "./concept_registry.js";
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
function domainOf(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, "");
    }
    catch {
        return "";
    }
}
export function classifyUrl(url) {
    const host = domainOf(url);
    if (host === "")
        return "other";
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
// Matches [title](https://...) — captures title and URL.
const MARKDOWN_LINK_RE = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
// Matches bare https?://... not already inside a markdown link.
const BARE_URL_RE = /(?<!\()https?:\/\/[^\s),\]"'`>]+/g;
export function extractUrlsFromWindow(content, conceptId, windowLines = 20) {
    const lines = content.split("\n");
    // Find the first line that contains the concept ID as a token.
    const idPattern = new RegExp(`\\b${escapeRegex(conceptId)}\\b`);
    const anchorIdx = lines.findIndex((l) => idPattern.test(l));
    if (anchorIdx < 0)
        return [];
    const start = Math.max(0, anchorIdx - windowLines);
    const end = Math.min(lines.length, anchorIdx + windowLines + 1);
    const window = lines.slice(start, end).join("\n");
    const seen = new Set();
    const entries = [];
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
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const REPO_ROOT = resolve(import.meta.dir, "../../..");
function readSource(rel) {
    const abs = join(REPO_ROOT, rel);
    return existsSync(abs) ? readFileSync(abs, "utf8") : "";
}
export function audit() {
    const registry = buildRegistry();
    const concepts = [];
    for (const concept of registry.concepts) {
        const content = readSource(concept.source);
        const anchors = extractUrlsFromWindow(content, concept.id, 20);
        const status = anchors.length > 0 ? "anchored" : "anchor-pending";
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
function emitJson(r) {
    return `${JSON.stringify(r, null, 2)}\n`;
}
function emitMd(r) {
    const lines = [];
    lines.push("# External-anchor coverage audit");
    lines.push("");
    lines.push(`Schema: \`${r.schema}\`. Generated: ${r.generated}.`);
    lines.push("");
    lines.push(`Concepts: **${String(r.totalConcepts)}** — ` +
        `anchored: **${String(r.anchored)}**, anchor-pending: **${String(r.pending)}**.`);
    lines.push("");
    lines.push("| Concept | Class | Source | Status | Anchor URLs |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const c of r.concepts) {
        const urlCells = c.anchors.length > 0
            ? c.anchors
                .map((a) => (a.title !== "" ? `[${a.title}](${a.url}) \`${a.kind}\`` : `${a.url} \`${a.kind}\``))
                .join("<br>")
            : "(none)";
        lines.push(`| \`${c.id}\` | ${c.conceptClass} | ${c.source} | **${c.status}** | ${urlCells} |`);
    }
    lines.push("");
    return lines.join("\n");
}
function emitHumanSummary(r) {
    const lines = [];
    lines.push(`external-anchor-coverage: ${String(r.totalConcepts)} concepts, ` +
        `${String(r.anchored)} anchored, ${String(r.pending)} anchor-pending`);
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
function parseArgs(argv) {
    const state = {
        json: false,
        md: false,
        outDir: null,
    };
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i] ?? "";
        if (arg === "-h" || arg === "--help")
            return { kind: "help" };
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
function repoRoot() {
    const result = spawnSync("git", // eslint-disable-line sonarjs/no-os-command-from-path
    ["rev-parse", "--show-toplevel"], { encoding: "utf8" });
    if (result.error)
        throw new Error(`git rev-parse failed: ${result.error.message}`);
    if (result.status !== 0)
        throw new Error(`git rev-parse exited with status ${String(result.status)}`);
    return result.stdout.trim();
}
export function main(argv) {
    const parsed = parseArgs(argv);
    if (parsed.kind === "help") {
        process.stdout.write("Usage: audit_external_anchors.ts [--json | --md] [--out DIR]\n");
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
        process.stdout.write(`audit_external_anchors: wrote ${args.outDir}/external-anchors.{json,md}\n`);
    }
    else if (args.json) {
        process.stdout.write(emitJson(result));
    }
    else if (args.md) {
        process.stdout.write(emitMd(result));
    }
    else {
        process.stdout.write(`${emitHumanSummary(result)}\n`);
    }
    return 0;
}
if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}
