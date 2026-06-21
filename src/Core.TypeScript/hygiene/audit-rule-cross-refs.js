#!/usr/bin/env bun
// audit-rule-cross-refs.ts — detect stale-pointer candidates in `.claude/rules/*.md`
//
// Mechanizes the razor-cadence item 4 (composes-with audit) work that landed
// manually across 12 ticks on 2026-05-14 (50/50 rules, 217/218 LIVE, 1 finding
// captured by B-0514). See the cumulative final shard at
// `docs/hygiene-history/ticks/2026/05/14/1920Z.md` for context.
//
// Scope (first slice — mechanical Layer A only):
//
//   - Scan all `.claude/rules/*.md` files
//   - Pull backtick'd path references (`<path>.md`, `<path>.ts`, etc.)
//   - Pull backlog ID references (B-NNNN)
//   - Test existence via direct path + glob + per-row backlog file lookup
//   - Report stale-pointer CANDIDATES (failed existence)
//
// Out of scope (Layer B — semantic classification):
//
//   The 9-variant reference-classification taxonomy from the 12-batch manual
//   audit (concrete | glob | template-path | backlog-ID | legacy-noted |
//   transient | anti-pattern | conditional | alternative-location) requires
//   reading the rule's prose context around each reference. ~5% of MISSes are
//   rule-acknowledged-not-exists (healthy). This tool produces the *candidate
//   list* — human / Otto judgment classifies each candidate's variant.
//
//   See `docs/hygiene-history/ticks/2026/05/14/1920Z.md` for the full taxonomy.
//
// Usage:
//
//   bun tools/hygiene/audit-rule-cross-refs.ts                # detect-only, exit 0 always
//   bun tools/hygiene/audit-rule-cross-refs.ts --report PATH  # write markdown report
//
// Exit codes:
//
//   0   always (detect-only; no enforcement; humans triage stale-pointer candidates)
//   64  argument error
//
// DST-friendliness:
//
//   Read-only audit. The "Generated" timestamp in markdown reports is the only
//   non-deterministic surface. Per `typescript.md` universal-DST gate.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const RULES_DIR = ".claude/rules";
const BACKLOG_DIR = "docs/backlog";
function parseArgs(argv) {
    let report = null;
    let i = 0;
    while (i < argv.length) {
        const a = argv[i];
        if (a === "--report") {
            const next = argv[i + 1];
            if (!next)
                return { kind: "error", message: "--report requires a path" };
            report = next;
            i += 2;
        }
        else {
            return { kind: "error", message: `Unknown argument: ${a}` };
        }
    }
    return { kind: "args", args: { report } };
}
function pullRefs(content, ruleFile) {
    const refs = [];
    // Backtick'd path references
    const pathPattern = /`([^`]+\.(md|ts|sh|fs|fsi|cs|yml|json))`/g;
    let m;
    while ((m = pathPattern.exec(content)) !== null) {
        const raw = m[1];
        if (raw.includes("<") || raw.includes("$"))
            continue;
        refs.push({ fromRule: ruleFile, raw, kind: "path" });
    }
    // Backlog ID references (B-NNNN)
    const idPattern = /\bB-([0-9]{4})\b/g;
    while ((m = idPattern.exec(content)) !== null) {
        refs.push({ fromRule: ruleFile, raw: `B-${m[1]}`, kind: "backlog-id" });
    }
    // Dedup
    const seen = new Set();
    return refs.filter((r) => {
        const key = `${r.kind}:${r.raw}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
// Escape regex metacharacters except `*`, which we replace with `.*` afterwards.
// Explicitly escapes backslash too (per CodeQL 81 finding).
function escapeForGlobRegex(s) {
    return s.replace(/[\\^$+?.()|[\]{}]/g, "\\$&").replace(/\*/g, ".*");
}
// Expand bash-style brace globs (`{a,b,c}` → 3 alternatives). Caught by Codex
// P2 thread on PR #3202: rules like lost-files-surface.md use brace-expansion
// patterns (e.g., `feedback_rule_number_{one,two,three}_*aaron_*.md`) that
// don't match if `{` and `}` are escaped literally.
//
// Expands the FIRST brace group encountered, then recurses on each expansion.
// Most patterns have only one brace group; nested braces are uncommon in
// practice.
function expandBraces(pattern) {
    const idx = pattern.indexOf("{");
    if (idx === -1)
        return [pattern];
    let depth = 0;
    let close = -1;
    for (let i = idx; i < pattern.length; i++) {
        if (pattern[i] === "{")
            depth++;
        else if (pattern[i] === "}") {
            depth--;
            if (depth === 0) {
                close = i;
                break;
            }
        }
    }
    if (close === -1)
        return [pattern];
    const before = pattern.slice(0, idx);
    const after = pattern.slice(close + 1);
    const body = pattern.slice(idx + 1, close);
    const alternatives = body.split(",");
    const results = [];
    for (const alt of alternatives) {
        const expanded = before + alt + after;
        for (const sub of expandBraces(expanded))
            results.push(sub);
    }
    return results;
}
// Resolve a path that may contain `*` wildcards in any segment (not only the
// last). Walks segment-by-segment from the leftmost directory: wildcards in
// earlier segments expand to directory listings, wildcards in the final segment
// match file basenames. Caught by Codex P2 thread on PR #3202. Brace-glob
// support added in second iteration per Codex re-review.
function globResolvesSingle(pattern) {
    const segments = pattern.split("/");
    let candidates = pattern.startsWith("/") ? ["/"] : ["."];
    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (i === 0 && pattern.startsWith("/"))
            continue;
        if (seg === "")
            continue;
        const isLast = i === segments.length - 1;
        const hasWild = seg.includes("*");
        const next = [];
        for (const base of candidates) {
            if (!hasWild) {
                const child = base === "." ? seg : `${base}/${seg}`;
                if (isLast) {
                    if (existsSync(child))
                        return true;
                }
                else if (existsSync(child) && statSync(child).isDirectory()) {
                    next.push(child);
                }
                continue;
            }
            if (!existsSync(base) || !statSync(base).isDirectory())
                continue;
            const regex = new RegExp("^" + escapeForGlobRegex(seg) + "$");
            let entries;
            try {
                entries = readdirSync(base);
            }
            catch {
                continue;
            }
            for (const entry of entries) {
                if (!regex.test(entry))
                    continue;
                const child = base === "." ? entry : `${base}/${entry}`;
                if (isLast) {
                    if (existsSync(child))
                        return true;
                }
                else if (existsSync(child) && statSync(child).isDirectory()) {
                    next.push(child);
                }
            }
        }
        candidates = next;
        if (candidates.length === 0 && !isLast)
            return false;
    }
    return false;
}
// Public globResolves: expand braces first, then check each expansion via the
// star-only single resolver. Returns true if ANY expansion has a match.
function globResolves(pattern) {
    for (const expanded of expandBraces(pattern)) {
        if (existsSync(expanded))
            return true;
        if (expanded.includes("*") && globResolvesSingle(expanded))
            return true;
    }
    return false;
}
let cachedBacklogIds = null;
function refExists(ref) {
    if (ref.kind === "path") {
        // Template-placeholder patterns: rule-acknowledged-transient per
        // B-0708 / 9-variant taxonomy. The `...` ellipsis is the canonical
        // template-path marker (e.g., `docs/.../0603Z.md`, `B-0613-...md`,
        // `~/.claude/projects/.../memory/*.md`). The placeholder `YYYY/MM/DD`
        // is the canonical date-template marker. Skip existence check.
        if (ref.raw.includes("...") || ref.raw.includes("YYYY"))
            return true;
        // Command-snippet detection: when the audit captures a backtick
        // span containing a shell command rather than a path (e.g.,
        // `BACKLOG_WRITE_FORCE=1 bun tools/.../generate-index.ts`,
        // `bun tools/github/poll-pr-gate.ts`, `git add docs/...`), check
        // the embedded path-fragment rather than the literal raw.
        if (/\s/.test(ref.raw)) {
            const tokens = ref.raw.split(/\s+/);
            for (const t of tokens) {
                if ((t.endsWith(".ts") || t.endsWith(".sh") || t.endsWith(".md")) && existsSync(t)) {
                    return true;
                }
            }
        }
        if (existsSync(ref.raw))
            return true;
        if (ref.raw.includes("*") || ref.raw.includes("{"))
            return globResolves(ref.raw);
        // Sibling-rule resolution: bare `<filename>.md` references inside
        // `.claude/rules/*.md` typically point to other rules in the same
        // directory. Resolve them via `.claude/rules/<basename>` before
        // declaring stale. Major false-positive class caught by B-0708
        // razor-cadence pass (2026-05-23).
        if (ref.raw.endsWith(".md") && !ref.raw.includes("/")) {
            if (existsSync(join(RULES_DIR, ref.raw)))
                return true;
        }
        // Peer-call wrapper resolution: bare `<name>.ts` references in
        // agent-roster-reference-card.md and similar rules typically point
        // to `tools/peer-call/<name>` per the established peer-call wrapper
        // convention.
        if (ref.raw.endsWith(".ts") && !ref.raw.includes("/")) {
            if (existsSync(join("src/Core.TypeScript/peer-call", ref.raw)))
                return true;
        }
        // src/Core.TypeScript/hygiene/ fallback for bare `.ts`/`.sh` references in
        // hygiene-related rules (backlog-item-start-gate.md, rule-0-no-sh-
        // files.md, etc.)
        if ((ref.raw.endsWith(".ts") || ref.raw.endsWith(".sh")) && !ref.raw.includes("/")) {
            if (existsSync(join("src/Core.TypeScript/hygiene", ref.raw)))
                return true;
        }
        // src/Core.TypeScript/github/ fallback for bare `.ts` references in
        // GitHub/PR-tooling-related rules (refresh-before-decide.md cites
        // `poll-pr-gate-batch.ts` etc.)
        if (ref.raw.endsWith(".ts") && !ref.raw.includes("/")) {
            if (existsSync(join("src/Core.TypeScript/github", ref.raw)))
                return true;
        }
        // memory/ fallback for bare MEMORY.md (the canonical memory-index)
        if (ref.raw === "MEMORY.md") {
            if (existsSync(join("memory", "MEMORY.md")))
                return true;
        }
        return false;
    }
    if (ref.kind === "backlog-id") {
        if (!existsSync(BACKLOG_DIR))
            return false;
        if (cachedBacklogIds === null) {
            cachedBacklogIds = new Set();
            for (const p of ["P0", "P1", "P2", "P3"]) {
                const dir = join(BACKLOG_DIR, p);
                if (!existsSync(dir))
                    continue;
                let files;
                try {
                    files = readdirSync(dir);
                }
                catch {
                    continue;
                }
                for (const f of files) {
                    if (!f.endsWith(".md"))
                        continue;
                    const path = join(dir, f);
                    try {
                        const content = readFileSync(path, "utf8");
                        const idMatch = content.match(/^id:\s*(B-\d{4})\b/m);
                        if (idMatch && idMatch[1]) {
                            cachedBacklogIds.add(idMatch[1]);
                        }
                    }
                    catch {
                        // ignore read errors
                    }
                }
            }
        }
        return cachedBacklogIds.has(ref.raw);
    }
    return false;
}
function audit(rulesDir) {
    if (!existsSync(rulesDir)) {
        return { rulesScanned: 0, refsFound: 0, candidatesStale: [], resolvedCount: 0 };
    }
    const ruleFiles = readdirSync(rulesDir)
        .filter((f) => f.endsWith(".md"))
        .sort();
    let refsFound = 0;
    let resolvedCount = 0;
    const candidatesStale = [];
    for (const ruleFile of ruleFiles) {
        const content = readFileSync(join(rulesDir, ruleFile), "utf8");
        const refs = pullRefs(content, ruleFile);
        refsFound += refs.length;
        for (const ref of refs) {
            if (refExists(ref)) {
                resolvedCount++;
            }
            else {
                candidatesStale.push(ref);
            }
        }
    }
    return {
        rulesScanned: ruleFiles.length,
        refsFound,
        candidatesStale,
        resolvedCount,
    };
}
function renderReport(result, now) {
    const lines = [];
    lines.push("# `.claude/rules/` cross-reference audit");
    lines.push("");
    lines.push(`Generated: ${now.toISOString()}`);
    lines.push("");
    lines.push("## Summary");
    lines.push("");
    lines.push(`- Rules scanned: ${result.rulesScanned}`);
    lines.push(`- References pulled: ${result.refsFound}`);
    lines.push(`- Resolved: ${result.resolvedCount}`);
    lines.push(`- Stale-pointer candidates: ${result.candidatesStale.length}`);
    lines.push("");
    lines.push("## 9-variant taxonomy reminder");
    lines.push("");
    lines.push("Candidates listed below failed direct path / glob / backlog-row lookup. Apply the");
    lines.push("9-variant taxonomy from `docs/hygiene-history/ticks/2026/05/14/1920Z.md` to classify");
    lines.push("each candidate before fixing — ~5% are healthy MISSes (rule-acknowledged-transient,");
    lines.push("conditional, alternative-location, legacy-noted, anti-pattern).");
    lines.push("");
    lines.push("## Candidates");
    lines.push("");
    if (result.candidatesStale.length === 0) {
        lines.push("_None — all references resolve._");
    }
    else {
        lines.push("| Rule | Kind | Reference |");
        lines.push("|------|------|-----------|");
        for (const c of result.candidatesStale) {
            lines.push(`| \`${c.fromRule}\` | ${c.kind} | \`${c.raw}\` |`);
        }
    }
    lines.push("");
    return lines.join("\n");
}
function main(argv) {
    const parsed = parseArgs(argv);
    if (parsed.kind === "error") {
        console.error(`error: ${parsed.message}`);
        return 64;
    }
    const result = audit(RULES_DIR);
    const report = renderReport(result, new Date());
    if (parsed.args.report) {
        writeFileSync(parsed.args.report, report);
        console.log(`wrote ${parsed.args.report}`);
    }
    else {
        console.log(report);
    }
    return 0;
}
if (import.meta.main) {
    process.exit(main(process.argv.slice(2)));
}
export { audit, globResolves, pullRefs, refExists, renderReport };
