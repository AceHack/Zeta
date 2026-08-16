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
//   bun src/Core.TypeScript/backlog/lint-frontmatter.ts                # lint all backlog rows
//   bun src/Core.TypeScript/backlog/lint-frontmatter.ts --file <path>  # lint specific file
//   bun src/Core.TypeScript/backlog/lint-frontmatter.ts --strict       # exit 1 on findings
//   bun src/Core.TypeScript/backlog/lint-frontmatter.ts --check 1,3    # only run checks 1 and 3
//
// Closes 081KRW63S0008QG0R000488SY1 (mechanizes batch-7 recurring reviewer findings).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

interface Args {
    files: string[];
    strict: boolean;
    checks: Set<number>;
    baseDir: string;
    schemaOnly: boolean;
}

interface Finding {
    file: string;
    line: number;
    col: number;
    priority: "P0" | "P1" | "P2";
    check: number;
    message: string;
}

interface Frontmatter {
    id?: string;
    priority?: string;
    status?: string;
    title?: string;
    depends_on: string[];
    composes_with: string[];
    rawLines: string[];
    headerEnd: number;
    keys: Set<string>;
}

// Permissive schema — includes all keys observed in active use across docs/backlog/**
// (audit: 2026-05-18 scan). Tool intentionally errs on the side of permissive to avoid
// spurious findings on legitimate factory variation; if a typo'd key is genuinely
// non-schema, it'll be a singleton occurrence that stands out in review.
const SCHEMA_KEYS = new Set([
    // Canonical schema (src/Core.TypeScript/backlog/README.md)
    "id", "priority", "status", "title",
    "zetaid", // 081KSXN940008QG0R002FWR9B2: the 128-bit ZetaId alias backfilled into legacy rows (B-NNNN stays the slug/id)
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

const ZETA_ID_PREFIX = "[0-9][0-9A-HJKMNP-TV-Z]{25}";
const LEGACY_B_ID_PREFIX = "B-\\d{4}(?:\\.\\d+)?";
const ROW_ID_PREFIX = `(?:${ZETA_ID_PREFIX}|${LEGACY_B_ID_PREFIX})`;
const ROW_ID = new RegExp(`^${ROW_ID_PREFIX}$`);
const ROW_ID_LIST_ITEM = new RegExp(`^\\s+-\\s+(${ROW_ID_PREFIX})\\s*$`);
const BODY_ROW_LINK = new RegExp(`\\[(${ROW_ID_PREFIX})\\]\\(([^)]+)\\)`, "g");
const BACKLOG_ROW_FILE = new RegExp(`^${ROW_ID_PREFIX}-[^/]+\\.md$`);
const SAME_DIR_ROW_HREF = new RegExp(`^${ROW_ID_PREFIX}-[^/]+\\.md$`);
const FRONTMATTER_KEY = /^[A-Za-z_]\w*$/;
// ORDINAL, as the name says. `localeCompare` is culture-SENSITIVE: its result depends on the
// runtime locale and ICU build, so the same input can sort differently on two machines. Both
// call sites below order ZetaId row-ids whose sorted output is compared across runs, so a
// locale-dependent order is a determinism bug waiting for a different ICU build. `<`/`>` on
// strings is UTF-16 code-unit order — ordinal, and identical everywhere.
// See `.claude/rules/culture-invariant-by-default.md`.
const SORT_ORDINAL = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function requireArg(argv: string[], index: number, flag: string): string {
    const value = argv[index + 1];
    if (value !== undefined) return value;
    process.stderr.write(`missing value for ${flag}\n`);
    process.exit(2);
}

function parseCheckSet(raw: string): Set<number> {
    return new Set(raw.split(",").map(Number).filter(n => n >= 1 && n <= 5));
}

function printHelpAndExit(): never {
    process.stdout.write(
        "Usage: bun src/Core.TypeScript/backlog/lint-frontmatter.ts [--file PATH] [--strict] [--check 1,2,3,4,5]\n" +
        "       --schema-only   CI gate: only the index-poisoning checks (missing frontmatter +\n" +
        "                       required id/status/title + id-matches-filename); ALWAYS exits 1 on findings.\n",
    );
    process.exit(0);
}

function failUnknownArg(arg: string): never {
    process.stderr.write(`unknown arg: ${arg}\n`);
    process.exit(2);
}

function parseArgs(argv: string[]): Args {
    const args: Args = {
        files: [],
        strict: false,
        checks: new Set([1, 2, 3, 4]),
        baseDir: "docs/backlog",
        schemaOnly: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--file") { args.files.push(requireArg(argv, i, a)); i++; }
        else if (a === "--strict") { args.strict = true; }
        else if (a === "--schema-only") { args.schemaOnly = true; }
        else if (a === "--check") {
            args.checks = parseCheckSet(requireArg(argv, i, a));
            i++;
        }
        else if (a === "--base-dir") { args.baseDir = requireArg(argv, i, a); i++; }
        else if (a === "--help" || a === "-h") printHelpAndExit();
        else failUnknownArg(a ?? "(missing)");
    }
    return args;
}

function parseFrontmatterLine(line: string): [string, string] | null {
    const colon = line.indexOf(":");
    if (colon <= 0) return null;

    const key = line.slice(0, colon);
    if (!FRONTMATTER_KEY.test(key)) return null;

    return [key, line.slice(colon + 1).trim()];
}

function applyFrontmatterField(fm: Frontmatter, key: string, value: string, lines: string[], lineIndex: number, endIdx: number): void {
    fm.keys.add(key);
    switch (key) {
        case "id":
            fm.id = value.replace(/^["']|["']$/g, "");
            break;
        case "priority":
            fm.priority = value;
            break;
        case "status":
            fm.status = value;
            break;
        case "title":
            fm.title = value;
            break;
        case "depends_on":
            fm.depends_on = parseBList(value, lines, lineIndex, endIdx);
            break;
        case "composes_with":
            fm.composes_with = parseBList(value, lines, lineIndex, endIdx);
            break;
    }
}

function parseFrontmatter(path: string): Frontmatter | null {
    const content = readFileSync(path, "utf8");
    const lines = content.split("\n");
    if (lines[0] !== "---") return null;
    let endIdx = -1;
    for (let i = 1; i < lines.length; i++) {
        if (lines[i] === "---") { endIdx = i; break; }
    }
    if (endIdx < 0) return null;

    const fm: Frontmatter = {
        depends_on: [],
        composes_with: [],
        rawLines: lines.slice(0, endIdx + 1),
        headerEnd: endIdx,
        keys: new Set(),
    };

    for (let i = 1; i < endIdx; i++) {
        const line = lines[i];
        if (line === undefined) continue;
        const parsed = parseFrontmatterLine(line);
        if (parsed === null) continue;
        const [key, value] = parsed;
        applyFrontmatterField(fm, key, value, lines, i, endIdx);
    }
    return fm;
}

function parseInlineRowIdList(value: string): string[] | null {
    // Inline form: `[081KPYCJH0008QG0R003MDS51N, 081KQ0YZ80008QG0R002T6TM7Z, 081KQNJ500008QG0R003SCWBDV.4]`
    const inline = /^\[(.*)\]$/.exec(value);
    if (!inline) return null;
    const body = inline[1] ?? "";
    return body.split(",").map(s => s.trim()).filter(s => ROW_ID.test(s));
}

function parseBlockRowIdList(allLines: string[], startIdx: number, endIdx: number): string[] {
    const ids: string[] = [];
    for (let j = startIdx + 1; j < endIdx; j++) {
        const next = allLines[j];
        if (next === undefined) continue;

        const itemMatch = ROW_ID_LIST_ITEM.exec(next);
        const id = itemMatch?.[1];
        if (id !== undefined) {
            ids.push(id);
            continue;
        }

        if (next.trim() !== "" && /^[A-Za-z_]/.test(next)) break;
    }
    return ids;
}

function parseBList(value: string, allLines?: string[], startIdx?: number, endIdx?: number): string[] {
    const inline = parseInlineRowIdList(value);
    if (inline !== null) return inline;

    // Empty inline `[]` (no IDs)
    if (value === "[]") return [];
    // Block form: subsequent lines `  - B-XXXX` until next non-indented key or frontmatter end
    if ((value === "" || value === ">") && allLines && startIdx !== undefined && endIdx !== undefined) {
        return parseBlockRowIdList(allLines, startIdx, endIdx);
    }
    return [];
}

interface BodyRef {
    id: string;
    href: string;
    line: number;
    col: number;
}

function extractBodyBLinks(path: string, headerEnd: number): BodyRef[] {
    const content = readFileSync(path, "utf8");
    const lines = content.split("\n");
    const refs: BodyRef[] = [];
    for (let i = headerEnd + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line === undefined) continue;
        let m: RegExpExecArray | null;
        while ((m = BODY_ROW_LINK.exec(line)) !== null) {
            const id = m[1];
            const href = m[2];
            if (id !== undefined && href !== undefined) {
                refs.push({ id, href, line: i + 1, col: m.index + 1 });
            }
        }
    }
    return refs;
}

function fileDir(path: string): string | null {
    const m = /docs\/backlog\/(P[0-3])\//.exec(path);
    return m?.[1] ?? null;
}

function pathDirForRef(href: string): string | null {
    const parentDir = /^\.\.\/(P[0-3])\//.exec(href)?.[1];
    if (parentDir !== undefined) return parentDir;
    if (SAME_DIR_ROW_HREF.test(href)) return "SAME";
    return null;
}

function check1_pathPrefix(path: string, _fm: Frontmatter, refs: ReturnType<typeof extractBodyBLinks>): Finding[] {
    const findings: Finding[] = [];
    const fileP = fileDir(path);
    if (!fileP) return findings;

    for (const ref of refs) {
        const refDir = pathDirForRef(ref.href);
        if (refDir === null || refDir === "SAME") continue;
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

function check2_composesCompleteness(path: string, fm: Frontmatter, refs: ReturnType<typeof extractBodyBLinks>): Finding[] {
    const findings: Finding[] = [];
    const composesSet = new Set(fm.composes_with);
    const dependsSet = new Set(fm.depends_on);
    const ownId = fm.id;
    const bodyIds = new Set<string>();
    for (const ref of refs) {
        if (ref.id === ownId) continue;
        if (dependsSet.has(ref.id)) continue;
        bodyIds.add(ref.id);
    }
    const missing = [...bodyIds].filter(id => !composesSet.has(id));
    if (missing.length > 0) {
        const sortedMissing = missing.toSorted(SORT_ORDINAL);
        findings.push({
            file: path,
            line: fm.headerEnd + 1,
            col: 1,
            priority: "P2",
            check: 2,
            message: `composes_with omits ${missing.length.toString()} ID(s) cited in body: ${sortedMissing.join(", ")}`,
        });
    }
    return findings;
}

function check3_nonSchemaKeys(path: string, fm: Frontmatter): Finding[] {
    const findings: Finding[] = [];
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

function check4_redundantEdges(path: string, fm: Frontmatter): Finding[] {
    const findings: Finding[] = [];
    const dependsSet = new Set(fm.depends_on);
    const redundant = fm.composes_with.filter(id => dependsSet.has(id));
    if (redundant.length > 0) {
        const sortedRedundant = redundant.toSorted(SORT_ORDINAL);
        const lineIdx = fm.rawLines.findIndex(l => l.startsWith("composes_with:"));
        findings.push({
            file: path,
            line: lineIdx >= 0 ? lineIdx + 1 : 1,
            col: 1,
            priority: "P2",
            check: 4,
            message: `Redundant composes_with entries (already in depends_on; depends_on is stronger): ${sortedRedundant.join(", ")}`,
        });
    }
    return findings;
}

// check 5 — REQUIRED schema fields the index generator depends on. This is the
// recurrence guard for the chronic backlog-index-integrity red (2026-06-06): a row
// missing id/status/title (or with an id that disagrees with its filename) makes
// generate-index.ts emit an empty/garbled row and lose hand-written descriptions on
// regen. P0; fatal under --schema-only.
function check5_requiredFields(path: string, fm: Frontmatter): Finding[] {
    const findings: Finding[] = [];
    const fileName = path.split("/").pop() ?? path;
    const push = (message: string) =>
        findings.push({ file: path, line: 1, col: 1, priority: "P0", check: 5, message });

    if (!fm.id || fm.id.trim() === "") push("missing or empty `id:` (generate-index emits an empty link)");
    else if (!fileName.startsWith(fm.id + "-")) push(`id '${fm.id}' does not match filename prefix (cross-refs + index break)`);
    if (!fm.status || fm.status.trim() === "") push("missing or empty `status:` (generate-index can't set the checkbox)");
    if (!fm.title || fm.title.trim() === "") push("missing or empty `title:` (generate-index emits an empty title — description lost on regen)");
    return findings;
}

function walkBacklog(baseDir: string): string[] {
    const out: string[] = [];
    function recurse(dir: string): void {
        for (const entry of readdirSync(dir)) {
            const p = join(dir, entry);
            const st = statSync(p);
            if (st.isDirectory()) recurse(p);
            // Match current ZetaId rows plus legacy B-NNNN rows during cleanup.
            else if (BACKLOG_ROW_FILE.test(entry)) out.push(p);
        }
    }
    try {
        if (statSync(baseDir).isDirectory()) recurse(baseDir);
    } catch {
        process.stderr.write(`error: --base-dir '${baseDir}' not found or not a directory\n`);
        process.exit(2);
    }
    return out;
}

function addFinding(byFile: Map<string, Finding[]>, finding: Finding): void {
    const existing = byFile.get(finding.file);
    if (existing !== undefined) existing.push(finding);
    else byFile.set(finding.file, [finding]);
}

function missingFrontmatterFinding(path: string): Finding {
    return {
        file: path, line: 1, col: 1, priority: "P0", check: 0,
        message: "Failed to parse frontmatter (missing --- delimiters?)",
    };
}

function lintParsedFile(path: string, fm: Frontmatter, args: Args): Finding[] {
    if (args.schemaOnly) {
        // CI recurrence-guard mode: ONLY the index-poisoning checks (0 above + 5).
        return check5_requiredFields(path, fm);
    }

    const refs = extractBodyBLinks(path, fm.headerEnd);
    const findings: Finding[] = [];
    if (args.checks.has(1)) findings.push(...check1_pathPrefix(path, fm, refs));
    if (args.checks.has(2)) findings.push(...check2_composesCompleteness(path, fm, refs));
    if (args.checks.has(3)) findings.push(...check3_nonSchemaKeys(path, fm));
    if (args.checks.has(4)) findings.push(...check4_redundantEdges(path, fm));
    if (args.checks.has(5)) findings.push(...check5_requiredFields(path, fm));
    return findings;
}

function collectFindings(files: string[], args: Args): Finding[] {
    return files.flatMap(path => {
        const fm = parseFrontmatter(path);
        return fm === null ? [missingFrontmatterFinding(path)] : lintParsedFile(path, fm, args);
    });
}

function groupFindings(allFindings: Finding[]): Map<string, Finding[]> {
    const byFile = new Map<string, Finding[]>();
    for (const f of allFindings) addFinding(byFile, f);
    return byFile;
}

function printFindings(allFindings: Finding[], files: string[]): void {
    const byFile = groupFindings(allFindings);
    for (const [file, findings] of byFile) {
        process.stdout.write(`\n${file}:\n`);
        for (const f of findings) {
            process.stdout.write(`  ${f.line.toString()}:${f.col.toString()} [${f.priority}] check ${f.check.toString()}: ${f.message}\n`);
        }
    }
    process.stdout.write(`\nTotal: ${allFindings.length.toString()} finding(s) across ${byFile.size.toString()} file(s) (of ${files.length.toString()} scanned)\n`);
}

function main(): void {
    const args = parseArgs(process.argv.slice(2));
    const files = args.files.length > 0 ? args.files : walkBacklog(args.baseDir);
    const allFindings = collectFindings(files, args);

    if (allFindings.length === 0) {
        process.stdout.write(`OK: 0 findings across ${files.length.toString()} files\n`);
        process.exit(0);
    }

    printFindings(allFindings, files);

    // --schema-only is a CI gate: the index-poisoning checks are ALWAYS fatal.
    if (args.strict || args.schemaOnly) process.exit(1);
    process.exit(0);
}

main();
