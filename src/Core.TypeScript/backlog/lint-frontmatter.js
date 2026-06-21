#!/usr/bin/env bun
// lint-frontmatter.ts - pre-push frontmatter discipline lint for docs/backlog rows.
//
// Catches 4 classes of recurring reviewer findings BEFORE PR opens:
//
//   1. Wrong relative-path prefix (same-dir vs cross-dir confusion)
//   2. composes_with completeness (body cites B-XXXX not in frontmatter)
//   3. Non-schema frontmatter keys (typos / unknown)
//   4. Redundant depends_on/composes_with edges
//
// Usage:
//   bun tools/backlog/lint-frontmatter.ts                # lint all backlog rows
//   bun tools/backlog/lint-frontmatter.ts --file <path>  # lint specific file
//   bun tools/backlog/lint-frontmatter.ts --strict       # exit 1 on findings
//   bun tools/backlog/lint-frontmatter.ts --check 1,3    # only run checks 1 and 3
//
// Closes B-0663 (mechanizes batch-7 recurring reviewer findings).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
// Permissive schema — includes all keys observed in active use across docs/backlog/**
// (audit: 2026-05-18 scan). Tool intentionally errs on the side of permissive to avoid
// spurious findings on legitimate factory variation; if a typo'd key is genuinely
// non-schema, it'll be a singleton occurrence that stands out in review.
const SCHEMA_KEYS = new Set([
    // Canonical schema (tools/backlog/README.md)
    "id", "priority", "status", "title",
    "zetaid", // B-0956: the 128-bit ZetaId alias backfilled into legacy rows (B-NNNN stays the slug/id)
    "tier", "effort", "ask", "type",
    "created", "last_updated",
    "depends_on", "decomposition", "composes_with", "tags",
    // Renumber / supersession breadcrumbs
    "renumbered_from", "renumbered_per", "renumbered_reason",
    "superseded_by", "sharpened_by", "extended_by",
    "closed_by", "closed_by_pr", "closed_in",
    "closed_at", "closed_reason", "closed", "completed", "completed_by",
    // Decomposition family
    "parent", "children", "child_rows", "decomposed", "decomposed_by",
    "decomposed_into",
    // Provenance + governance
    "authors", "owners", "filed_by", "origin",
    "claim_branch", "claimed_by", "decided_by",
    "resolved", "resolved_by", "resolved_note",
    "pr", "trigger", "like",
    // Classification
    "class", "classification", "description", "name", "metadata",
    // Skill-style breadcrumbs (rare in backlog but observed)
    "record_source", "load_datetime", "bp_rules_cited",
]);
function parseArgs(argv) {
    const args = {
        files: [],
        strict: false,
        checks: new Set([1, 2, 3, 4]),
        baseDir: "docs/backlog",
        schemaOnly: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = argv[i + 1];
        if (a === "--file" && next) {
            args.files.push(next);
            i++;
        }
        else if (a === "--strict") {
            args.strict = true;
        }
        else if (a === "--schema-only") {
            args.schemaOnly = true;
        }
        else if (a === "--check" && next) {
            args.checks = new Set(next.split(",").map(Number).filter(n => n >= 1 && n <= 5));
            i++;
        }
        else if (a === "--base-dir" && next) {
            args.baseDir = next;
            i++;
        }
        else if (a === "--help" || a === "-h") {
            process.stdout.write("Usage: bun src/Core.TypeScript/backlog/lint-frontmatter.ts [--file PATH] [--strict] [--check 1,2,3,4,5]\n" +
                "       --schema-only   CI gate: only the index-poisoning checks (missing frontmatter +\n" +
                "                       required id/status/title + id-matches-filename); ALWAYS exits 1 on findings.\n");
            process.exit(0);
        }
        else {
            process.stderr.write("unknown arg: " + a + "\n");
            process.exit(2);
        }
    }
    return args;
}
function parseFrontmatter(path) {
    const content = readFileSync(path, "utf8");
    const lines = content.split("\n");
    if (lines[0] !== "---")
        return null;
    let endIdx = -1;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i] === "---") {
            endIdx = i;
            break;
        }
    }
    if (endIdx < 0)
        return null;
    const fm = {
        depends_on: [],
        composes_with: [],
        rawLines: lines.slice(0, endIdx + 1),
        headerEnd: endIdx,
        keys: new Set(),
    };
    for (let i = 1; i < endIdx; i++) {
        const line = lines[i];
        if (line === undefined)
            continue;
        const m = /^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/.exec(line);
        if (!m)
            continue;
        const key = m[1];
        const value = m[2].trim();
        fm.keys.add(key);
        if (key === "id")
            fm.id = value.replace(/^["']|["']$/g, "");
        else if (key === "priority")
            fm.priority = value;
        else if (key === "status")
            fm.status = value;
        else if (key === "title")
            fm.title = value;
        else if (key === "depends_on")
            fm.depends_on = parseBList(value, lines, i, endIdx);
        else if (key === "composes_with")
            fm.composes_with = parseBList(value, lines, i, endIdx);
    }
    return fm;
}
function parseBList(value, allLines, startIdx, endIdx) {
    // Inline form: `[B-0001, B-0002, B-0170.4]`
    const inline = /^\[(.*)\]$/.exec(value);
    if (inline) {
        return inline[1]
            .split(",")
            .map(s => s.trim())
            .filter(s => /^B-\d{4}(\.\d+)?$/.test(s));
    }
    // Empty inline `[]` (no IDs)
    if (value === "[]")
        return [];
    // Block form: subsequent lines `  - B-XXXX` until next non-indented key or frontmatter end
    if ((value === "" || value === ">") && allLines && startIdx !== undefined && endIdx !== undefined) {
        const ids = [];
        for (let j = startIdx + 1; j < endIdx; j++) {
            const next = allLines[j];
            if (next === undefined)
                continue;
            // Block-list item: `  - B-XXXX` (any indent)
            const itemMatch = /^\s+-\s+(B-\d{4}(?:\.\d+)?)\s*$/.exec(next);
            if (itemMatch) {
                ids.push(itemMatch[1]);
                continue;
            }
            // Non-list, non-empty line at the same or lower indent ends the block
            if (next.trim() !== "" && /^[a-zA-Z_]/.test(next))
                break;
        }
        return ids;
    }
    return [];
}
function extractBodyBLinks(path, headerEnd) {
    const content = readFileSync(path, "utf8");
    const lines = content.split("\n");
    const refs = [];
    const re = /\[(B-\d{4}(?:\.\d+)?)\]\(([^)]+)\)/g;
    for (let i = headerEnd + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined)
            continue;
        let m;
        while ((m = re.exec(line)) !== null) {
            refs.push({ id: m[1], href: m[2], line: i + 1, col: m.index + 1 });
        }
    }
    return refs;
}
function fileDir(path) {
    const m = /docs\/backlog\/(P[0-3])\//.exec(path);
    return m ? m[1] : null;
}
function pathDirForRef(href) {
    if (/^\.\.\/(P[0-3])\//.test(href)) {
        const m = /^\.\.\/(P[0-3])\//.exec(href);
        return m ? m[1] : null;
    }
    if (/^B-\d{4}(\.\d+)?-[^/]+\.md$/.test(href))
        return "SAME";
    return null;
}
function check1_pathPrefix(path, _fm, refs) {
    const findings = [];
    const fileP = fileDir(path);
    if (!fileP)
        return findings;
    for (const ref of refs) {
        const refDir = pathDirForRef(ref.href);
        if (refDir === null || refDir === "SAME")
            continue;
        if (refDir === fileP) {
            findings.push({
                file: path,
                line: ref.line,
                col: ref.col,
                priority: "P1",
                check: 1,
                message: "[" + ref.id + "] link uses '../" + refDir + "/' prefix but target is in same directory (" + fileP + "); should be bare filename",
            });
        }
    }
    return findings;
}
function check2_composesCompleteness(path, fm, refs) {
    const findings = [];
    const composesSet = new Set(fm.composes_with);
    const dependsSet = new Set(fm.depends_on);
    const ownId = fm.id;
    const bodyIds = new Set();
    for (const ref of refs) {
        if (ref.id === ownId)
            continue;
        if (dependsSet.has(ref.id))
            continue;
        bodyIds.add(ref.id);
    }
    const missing = [...bodyIds].filter(id => !composesSet.has(id));
    if (missing.length > 0) {
        findings.push({
            file: path,
            line: fm.headerEnd + 1,
            col: 1,
            priority: "P2",
            check: 2,
            message: "composes_with omits " + missing.length + " ID(s) cited in body: " + missing.sort().join(", "),
        });
    }
    return findings;
}
function check3_nonSchemaKeys(path, fm) {
    const findings = [];
    for (const key of fm.keys) {
        if (!SCHEMA_KEYS.has(key)) {
            const lineIdx = fm.rawLines.findIndex(l => l.startsWith(key + ":"));
            findings.push({
                file: path,
                line: lineIdx >= 0 ? lineIdx + 1 : 1,
                col: 1,
                priority: "P1",
                check: 3,
                message: "Non-schema frontmatter key '" + key + "' (typo? See src/Core.TypeScript/backlog/README.md for schema)",
            });
        }
    }
    return findings;
}
function check4_redundantEdges(path, fm) {
    const findings = [];
    const dependsSet = new Set(fm.depends_on);
    const redundant = fm.composes_with.filter(id => dependsSet.has(id));
    if (redundant.length > 0) {
        const lineIdx = fm.rawLines.findIndex(l => l.startsWith("composes_with:"));
        findings.push({
            file: path,
            line: lineIdx >= 0 ? lineIdx + 1 : 1,
            col: 1,
            priority: "P2",
            check: 4,
            message: "Redundant composes_with entries (already in depends_on; depends_on is stronger): " + redundant.sort().join(", "),
        });
    }
    return findings;
}
// check 5 — REQUIRED schema fields the index generator depends on. This is the
// recurrence guard for the chronic backlog-index-integrity red (2026-06-06): a row
// missing id/status/title (or with an id that disagrees with its filename) makes
// generate-index.ts emit an empty/garbled row and lose hand-written descriptions on
// regen. P0; fatal under --schema-only.
function check5_requiredFields(path, fm) {
    const findings = [];
    const fileName = path.split("/").pop() ?? path;
    const push = (message) => findings.push({ file: path, line: 1, col: 1, priority: "P0", check: 5, message });
    if (!fm.id || fm.id.trim() === "")
        push("missing or empty `id:` (generate-index emits an empty link)");
    else if (!fileName.startsWith(fm.id + "-"))
        push(`id '${fm.id}' does not match filename prefix (cross-refs + index break)`);
    if (!fm.status || fm.status.trim() === "")
        push("missing or empty `status:` (generate-index can't set the checkbox)");
    if (!fm.title || fm.title.trim() === "")
        push("missing or empty `title:` (generate-index emits an empty title — description lost on regen)");
    return findings;
}
function walkBacklog(baseDir) {
    const out = [];
    function recurse(dir) {
        for (const entry of readdirSync(dir)) {
            const p = join(dir, entry);
            const st = statSync(p);
            if (st.isDirectory())
                recurse(p);
            // Match both B-NNNN-... and dotted B-NNNN.M-... (subdecimal rows per tools/backlog/README.md)
            else if (entry.endsWith(".md") && /^B-\d{4}(\.\d+)?-/.test(entry))
                out.push(p);
        }
    }
    try {
        if (statSync(baseDir).isDirectory())
            recurse(baseDir);
    }
    catch (e) {
        process.stderr.write("error: --base-dir '" + baseDir + "' not found or not a directory\n");
        process.exit(2);
    }
    return out;
}
function main() {
    const args = parseArgs(process.argv.slice(2));
    const files = args.files.length > 0 ? args.files : walkBacklog(args.baseDir);
    const allFindings = [];
    for (const path of files) {
        const fm = parseFrontmatter(path);
        if (!fm) {
            allFindings.push({
                file: path, line: 1, col: 1, priority: "P0", check: 0,
                message: "Failed to parse frontmatter (missing --- delimiters?)",
            });
            continue;
        }
        if (args.schemaOnly) {
            // CI recurrence-guard mode: ONLY the index-poisoning checks (0 above + 5).
            allFindings.push(...check5_requiredFields(path, fm));
            continue;
        }
        const refs = extractBodyBLinks(path, fm.headerEnd);
        if (args.checks.has(1))
            allFindings.push(...check1_pathPrefix(path, fm, refs));
        if (args.checks.has(2))
            allFindings.push(...check2_composesCompleteness(path, fm, refs));
        if (args.checks.has(3))
            allFindings.push(...check3_nonSchemaKeys(path, fm));
        if (args.checks.has(4))
            allFindings.push(...check4_redundantEdges(path, fm));
        if (args.checks.has(5))
            allFindings.push(...check5_requiredFields(path, fm));
    }
    if (allFindings.length === 0) {
        process.stdout.write("OK: 0 findings across " + files.length + " files\n");
        process.exit(0);
    }
    const byFile = new Map();
    for (const f of allFindings) {
        if (!byFile.has(f.file))
            byFile.set(f.file, []);
        byFile.get(f.file).push(f);
    }
    for (const [file, findings] of byFile) {
        process.stdout.write("\n" + file + ":\n");
        for (const f of findings) {
            process.stdout.write("  " + f.line + ":" + f.col + " [" + f.priority + "] check " + f.check + ": " + f.message + "\n");
        }
    }
    process.stdout.write("\nTotal: " + allFindings.length + " finding(s) across " + byFile.size + " file(s) (of " + files.length + " scanned)\n");
    // --schema-only is a CI gate: the index-poisoning checks are ALWAYS fatal.
    if (args.strict || args.schemaOnly)
        process.exit(1);
    process.exit(0);
}
main();
