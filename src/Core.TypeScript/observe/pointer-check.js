#!/usr/bin/env bun
// pointer-check.ts — count pointers per file and find broken ones (081KT7YW00008QG0R002T1XNWT pointer
// hygiene). A carved-sentence surface is "carved sentence + POINTERS"; a pointer
// to a doc/memory/rule that no longer exists is the discipline's failure mode
// (the detail moved one hop away to NOWHERE). This counts pointers per file and
// reports which resolve vs which are broken.
//
//   default   report per-file pointer count + broken list over the manifest.
//   --check   exit non-zero if any pointer is broken (the local gate).
//   args      explicit file globs to check instead of the default surfaces.
//
// NCI: reads only.
import { Glob } from "bun";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
/** Extract pointer targets: markdown links + backtick paths that look like files. */
export function extractTargets(text) {
    const out = [];
    for (const m of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g))
        out.push(m[1].trim());
    for (const m of text.matchAll(/`([a-zA-Z0-9_./-]+\.[a-z]{2,4})`/g)) {
        const t = m[1];
        if (t.includes("/") || t.endsWith(".md"))
            out.push(t);
    }
    return [...new Set(out)];
}
/** Classify + resolve a single target relative to its file and the repo root. */
export function resolveTarget(target, fromFile, repoRoot) {
    if (/^(https?:|mailto:|#)/.test(target)) {
        return { target, kind: target.startsWith("#") ? "anchor" : "external", resolved: true };
    }
    const path = target.split("#")[0].trim();
    if (path === "")
        return { target, kind: "anchor", resolved: true };
    const candidates = [join(dirname(fromFile), path), join(repoRoot, path), normalize(path)];
    return { target: path, kind: "file", resolved: candidates.some((c) => existsSync(c)) };
}
/** Count + check every pointer in one file (pure given fs via resolveTarget). */
export function checkFile(path, text, repoRoot) {
    const targets = extractTargets(text);
    const results = targets.map((t) => resolveTarget(t, path, repoRoot));
    const fileKind = results.filter((r) => r.kind === "file");
    return {
        path,
        total: targets.length,
        checked: fileKind.length,
        broken: fileKind.filter((r) => !r.resolved),
    };
}
// ── CLI ───────────────────────────────────────────────────────────────────────
const DEFAULT_MANIFEST = ["CLAUDE.md", ".claude/rules/*.md"];
if (import.meta.main) {
    const args = Bun.argv.slice(2);
    const flags = new Set(args.filter((a) => a.startsWith("--")));
    const globs = args.filter((a) => !a.startsWith("--"));
    const manifest = globs.length > 0 ? globs : DEFAULT_MANIFEST;
    const repoRoot = ".";
    const paths = manifest
        .flatMap((g) => (g.includes("*") ? [...new Glob(g).scanSync({ cwd: ".", dot: true })] : existsSync(g) ? [g] : []))
        .sort();
    let totalPtrs = 0;
    let totalBroken = 0;
    for (const p of paths) {
        const fp = checkFile(p, readFileSync(p, "utf8"), repoRoot);
        totalPtrs += fp.total;
        totalBroken += fp.broken.length;
        const mark = fp.broken.length === 0 ? "✓" : "✗";
        console.log(`${mark} ${p}: ${fp.total} pointers (${fp.checked} file, ${fp.broken.length} broken)`);
        for (const b of fp.broken)
            console.log(`    BROKEN → ${b.target}`);
    }
    console.log(`\n${paths.length} files, ${totalPtrs} pointers, ${totalBroken} broken.`);
    if (flags.has("--check") && totalBroken > 0)
        process.exit(1);
    process.exit(0);
}
