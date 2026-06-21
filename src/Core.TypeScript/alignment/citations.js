#!/usr/bin/env bun
// citations.ts — Phase-0 citations-graph prototype.
//
// TypeScript+Bun port of citations.sh, slice 4 of the TS+Bun
// migration. See docs/best-practices/repo-scripting.md.
//
// READ-ONLY. Parses prose cross-references from markdown surfaces
// in the repo and emits Graphviz DOT and/or JSON.
//
// Phase-0 scope (deliberately minimal):
//   - Scan: docs/**, .claude/skills/**, .claude/agents/**,
//     memory/<persona>/**, openspec/**, AGENTS.md, CLAUDE.md,
//     GOVERNANCE.md, README.md
//   - Pattern A: markdown link [text](path) where path resolves.
//   - Pattern B: backtick file ref `path/to/file.ext` where
//     path resolves.
//   - Default relation = "see-also" (Phase-0 has no inference).
//   - External URLs counted but not emitted in DOT.
//
// Usage:
//   bun src/Core.TypeScript/alignment/citations.ts                 # summary
//   bun src/Core.TypeScript/alignment/citations.ts --json
//   bun src/Core.TypeScript/alignment/citations.ts --dot
//   bun src/Core.TypeScript/alignment/citations.ts --out DIR
//
// Exit codes: 0 clean / 2 script error / bad args.
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync, } from "node:child_process";
const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;
const TOP_LEVEL_DOCS = ["AGENTS.md", "CLAUDE.md", "GOVERNANCE.md", "README.md"];
const SCAN_DIRS = ["docs", ".claude/skills", ".claude/agents", "memory", "openspec"];
const BACKTICK_EXTENSIONS = "(md|fs|cs|fsproj|yml|yaml|json|toml|sh|py|tla|lean|als|ipynb|csproj|props|targets)";
// eslint-disable-next-line sonarjs/slow-regex -- bounded by line length; matches bash original's grep -oE pattern.
const MARKDOWN_LINK_RE = /\[[^\]]+\]\(([^)]+)\)/g;
const BACKTICK_REF_RE = new RegExp("`([^`]+\\." + BACKTICK_EXTENSIONS + ")`", "g");
const EXTERNAL_RE = /^(https?:|mailto:|ftp:|javascript:)/;
const GLOB_RE = /[*?<>]/;
const PUNCT_NON_PATH_RE = /[ @=]/;
function classifyFailure(cmd, args, result) {
    if (result.error) {
        return `Failed to start '${cmd} ${args.join(" ")}': ${result.error.message}`;
    }
    if (result.status === null) {
        return `'${cmd} ${args.join(" ")}' terminated before reporting an exit code`;
    }
    return null;
}
function repoRoot() {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
        encoding: "utf8",
        maxBuffer: SPAWN_MAX_BUFFER,
    });
    const failure = classifyFailure("git", ["rev-parse"], result);
    if (failure !== null)
        throw new Error(failure);
    return result.stdout.trim();
}
function reduceFlag(arg, next, state) {
    if (arg === "--json") {
        state.emitJson = true;
        return { ok: true, consumed: 1 };
    }
    if (arg === "--dot") {
        state.emitDot = true;
        return { ok: true, consumed: 1 };
    }
    if (arg === "--out") {
        if (next === undefined) {
            return { ok: false, message: "citations.ts: --out requires a directory" };
        }
        state.outDir = next;
        return { ok: true, consumed: 2 };
    }
    return { ok: false, message: `citations.sh: unknown arg: ${arg}` };
}
function parseArgs(argv) {
    const state = { emitJson: false, emitDot: false, outDir: null };
    let i = 0;
    while (i < argv.length) {
        const arg = argv[i] ?? "";
        if (arg === "-h" || arg === "--help")
            return { kind: "help" };
        const r = reduceFlag(arg, argv[i + 1], state);
        if (!r.ok)
            return { kind: "error", message: r.message };
        i += r.consumed;
    }
    return { kind: "args", args: { emitJson: state.emitJson, emitDot: state.emitDot, outDir: state.outDir } };
}
function listMarkdownRecursive(dir) {
    const out = [];
    const stack = [dir];
    while (stack.length > 0) {
        const cur = stack.pop();
        if (cur === undefined)
            continue;
        let entries;
        try {
            entries = readdirSync(cur, { withFileTypes: true });
        }
        catch {
            continue;
        }
        for (const e of entries) {
            const full = join(cur, e.name);
            if (e.isDirectory())
                stack.push(full);
            else if (e.isFile() && e.name.endsWith(".md"))
                out.push(full);
        }
    }
    return out;
}
function scanFiles() {
    const set = new Set();
    for (const f of TOP_LEVEL_DOCS) {
        if (existsSync(f))
            set.add(f);
    }
    for (const d of SCAN_DIRS) {
        if (existsSync(d)) {
            for (const f of listMarkdownRecursive(d))
                set.add(f);
        }
    }
    return [...set].sort(byteCompare);
}
function byteCompare(a, b) {
    if (a < b)
        return -1;
    if (a > b)
        return 1;
    return 0;
}
// Bash 3.2-compatible normalize: collapse `./` and resolve `..`.
function normalizePath(p) {
    const stack = [];
    for (const part of p.split("/")) {
        if (part === "" || part === ".")
            continue;
        if (part === "..") {
            if (stack.length > 0)
                stack.pop();
            continue;
        }
        stack.push(part);
    }
    return stack.join("/");
}
function rejectTarget(target) {
    if (target === "")
        return true;
    if (EXTERNAL_RE.test(target))
        return true;
    if (GLOB_RE.test(target))
        return true;
    if (target === "~" || target.startsWith("~/"))
        return true;
    return false;
}
function stripFragmentAndQuery(target) {
    let s = target;
    const h = s.indexOf("#");
    if (h >= 0)
        s = s.slice(0, h);
    const q = s.indexOf("?");
    if (q >= 0)
        s = s.slice(0, q);
    return s;
}
function escapeUp(p) {
    return p === ".." || p.startsWith("../") ? "" : p;
}
function candidatePaths(stripped, subjectFile) {
    if (stripped.startsWith("/")) {
        return { subjectRel: "", repoRoot: escapeUp(normalizePath(stripped.slice(1))) };
    }
    const subjectDir = dirname(subjectFile);
    if (subjectDir === ".") {
        const v = escapeUp(normalizePath(stripped));
        return { subjectRel: v, repoRoot: v };
    }
    return {
        subjectRel: escapeUp(normalizePath(`${subjectDir}/${stripped}`)),
        repoRoot: escapeUp(normalizePath(stripped)),
    };
}
function resolveTarget(target, ctx, root) {
    const stripped = stripFragmentAndQuery(target);
    if (rejectTarget(stripped))
        return "";
    const { subjectRel, repoRoot: rr } = candidatePaths(stripped, ctx.subjectFile);
    const first = ctx.mode === "backtick" ? rr : subjectRel;
    const second = ctx.mode === "backtick" ? subjectRel : rr;
    if (first !== "" && existsSync(join(root, first)))
        return first;
    if (second !== "" && second !== first && existsSync(join(root, second)))
        return second;
    return "";
}
function isPathLike(target) {
    if (PUNCT_NON_PATH_RE.test(target))
        return false;
    return target.includes("/") || target.includes(".");
}
function extractMarkdownLinks(subject, content, root, acc) {
    // bash uses grep -oE per-line; mirror that to avoid matching across newlines.
    for (const line of content.split("\n")) {
        for (const m of line.matchAll(MARKDOWN_LINK_RE)) {
            const target = m[1];
            if (target === undefined || target === "")
                continue;
            if (EXTERNAL_RE.test(target)) {
                acc.externalCount += 1;
                continue;
            }
            const resolved = resolveTarget(target, { subjectFile: subject, mode: "markdown" }, root);
            if (resolved !== "") {
                acc.internal.push({ subject, object: resolved, relation: "see-also" });
            }
            else if (isPathLike(target)) {
                acc.broken.push({ subject, object: target });
            }
        }
    }
}
function extractBacktickRefs(subject, content, root, acc) {
    for (const line of content.split("\n")) {
        for (const m of line.matchAll(BACKTICK_REF_RE)) {
            const target = m[1];
            if (target?.includes("/") !== true)
                continue;
            const resolved = resolveTarget(target, { subjectFile: subject, mode: "backtick" }, root);
            if (resolved !== "") {
                acc.internal.push({ subject, object: resolved, relation: "see-also" });
            }
        }
    }
}
function dedupCiteTuples(items, keyFn) {
    const seen = new Set();
    const out = [];
    for (const item of items) {
        const k = keyFn(item);
        if (seen.has(k))
            continue;
        seen.add(k);
        out.push(item);
    }
    return out;
}
export function audit() {
    const root = repoRoot();
    process.chdir(root);
    const acc = { internal: [], broken: [], externalCount: 0 };
    const files = scanFiles();
    for (const f of files) {
        let content;
        try {
            content = readFileSync(f, "utf8");
        }
        catch {
            continue;
        }
        extractMarkdownLinks(f, content, root, acc);
        extractBacktickRefs(f, content, root, acc);
    }
    const internal = dedupCiteTuples(acc.internal, (c) => `${c.subject}\t${c.object}\t${c.relation}`);
    const broken = dedupCiteTuples(acc.broken, (c) => `${c.subject}\t${c.object}`);
    // Sort byte-order for deterministic output.
    const sortedInternal = [...internal].sort((a, b) => {
        const k1 = `${a.subject}\t${a.object}\t${a.relation}`;
        const k2 = `${b.subject}\t${b.object}\t${b.relation}`;
        return byteCompare(k1, k2);
    });
    const sortedBroken = [...broken].sort((a, b) => byteCompare(`${a.subject}\t${a.object}`, `${b.subject}\t${b.object}`));
    return {
        filesScanned: files.length,
        internal: sortedInternal,
        broken: sortedBroken,
        externalCount: acc.externalCount,
    };
}
function emitSummary(r) {
    return [
        "citations.sh — Phase-0 prototype",
        `  files scanned:    ${String(r.filesScanned)}`,
        `  internal edges:   ${String(r.internal.length)}  (subject → object, relation=see-also)`,
        `  broken candidates: ${String(r.broken.length)}  (path-like, target missing)`,
        `  external refs:    ${String(r.externalCount)}  (http/https/mailto — not emitted in DOT)`,
        "",
        "  schema: citations-graph-v0 (see docs/research/citations-as-first-class.md §4)",
    ].join("\n");
}
function emitJson(r) {
    const lines = [];
    lines.push("{");
    lines.push(`  "schema": "citations-graph-v0",`);
    lines.push(`  "files_scanned": ${String(r.filesScanned)},`);
    lines.push(`  "internal_edges": ${String(r.internal.length)},`);
    lines.push(`  "broken_candidates": ${String(r.broken.length)},`);
    lines.push(`  "external_refs": ${String(r.externalCount)},`);
    lines.push(`  "edges": [`);
    const edges = r.internal.map((c) => `    {"subject": "${c.subject}", "object": "${c.object}", "relation": "${c.relation}"}`);
    if (edges.length > 0)
        lines.push(edges.join(",\n"));
    lines.push(`  ],`);
    lines.push(`  "broken": [`);
    const brokens = r.broken.map((c) => `    {"subject": "${c.subject}", "object": "${c.object}"}`);
    if (brokens.length > 0)
        lines.push(brokens.join(",\n"));
    lines.push(`  ]`);
    lines.push("}");
    return `${lines.join("\n")}\n`;
}
function emitDot(r) {
    const lines = [];
    lines.push("// Generated by src/Core.TypeScript/alignment/citations.ts (Phase-0 prototype).");
    lines.push("// Schema: citations-graph-v0");
    lines.push("// Render: dot -Tsvg citations.dot -o citations.svg");
    lines.push("digraph citations {");
    lines.push("  rankdir=LR;");
    lines.push(`  node [shape=box, fontname="monospace", fontsize=10];`);
    lines.push(`  edge [fontname="monospace", fontsize=8, color="#888888"];`);
    lines.push("");
    for (const c of r.internal) {
        lines.push(`  "${c.subject}" -> "${c.object}" [label="${c.relation}"];`);
    }
    lines.push("}");
    return `${lines.join("\n")}\n`;
}
export function main(argv) {
    const parsed = parseArgs(argv);
    if (parsed.kind === "help") {
        process.stdout.write("Usage: citations.ts [--json | --dot | --out DIR]\n");
        return 0;
    }
    if (parsed.kind === "error") {
        process.stderr.write(`${parsed.message}\n`);
        return 2;
    }
    const { args } = parsed;
    const r = audit();
    if (args.outDir !== null) {
        mkdirSync(args.outDir, { recursive: true });
        writeFileSync(join(args.outDir, "citations.json"), emitJson(r));
        writeFileSync(join(args.outDir, "citations.dot"), emitDot(r));
        process.stdout.write(`${emitSummary(r)}\n`);
        process.stdout.write("\n");
        process.stdout.write(`  wrote: ${args.outDir}/citations.json\n`);
        process.stdout.write(`  wrote: ${args.outDir}/citations.dot\n`);
    }
    else if (args.emitJson) {
        process.stdout.write(emitJson(r));
    }
    else if (args.emitDot) {
        process.stdout.write(emitDot(r));
    }
    else {
        process.stdout.write(`${emitSummary(r)}\n`);
    }
    return 0;
}
if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}
