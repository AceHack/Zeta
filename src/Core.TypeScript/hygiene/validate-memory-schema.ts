#!/usr/bin/env bun
// validate-memory-schema.ts — B-0335
// Enforces the memory-file format standard (B-0330) mechanically.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

function getDefaultMemoryDir(): string {
    try {
        const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
        return join(repoRoot, "memory");
    } catch {
        throw new Error("Not a git repository or git is unavailable. Pass --memory-dir to specify the memory directory explicitly.");
    }
}

const VALID_TYPES = ["feedback", "user", "project", "reference"] as const;
type MemoryType = (typeof VALID_TYPES)[number];

const PREFIX_TO_TYPE: Record<string, MemoryType> = {
    feedback_: "feedback",
    user_: "user",
    project_: "project",
    reference_: "reference",
};

// Per B-0330: feedback and project files require Why + How-to-apply.
const REQUIRED_BODY_MARKERS: Partial<Record<MemoryType, string[]>> = {
    feedback: ["Why:", "How to apply:"],
    project: ["Why:", "How to apply:"],
};

const SPECIAL_FILES = new Set([
    "MEMORY.md",
    "README.md",
    "MEMORY-AUTHOR-TEMPLATE.md",
]);

interface Violation {
    file: string;
    check: string;
    severity: "error" | "warning";
    message: string;
    fixable: boolean;
}

interface ValidateResult {
    totalFiles: number;
    checkedFiles: number;
    violations: Violation[];
    errorCount: number;
    warningCount: number;
    coverageGap: { inMemoryNotIndex: string[]; inIndexNotMemory: string[] };
}

function parseFrontmatter(content: string): { fields: Record<string, string>; bodyStart: number } | null {
    if (!content.startsWith("---")) return null;
    const endIdx = content.indexOf("\n---", 3);
    if (endIdx === -1) return null;

    const yaml = content.slice(4, endIdx);
    const fields: Record<string, string> = {};
    for (const line of yaml.split("\n")) {
        const match = line.match(/^(\w[\w-]*):\s*(.*)/);
        if (match) {
            fields[match[1]!] = match[2]!.replace(/^["']|["']$/g, "").trim();
        }
    }
    return { fields, bodyStart: endIdx + 4 };
}

function extractPrefix(filename: string): string | null {
    for (const prefix of Object.keys(PREFIX_TO_TYPE)) {
        if (filename.startsWith(prefix)) return prefix;
    }
    return null;
}

function isSpecialFile(filename: string): boolean {
    if (SPECIAL_FILES.has(filename)) return true;
    if (filename.startsWith("CURRENT-")) return true;
    if (filename.startsWith("INDEX-")) return true;
    return false;
}

function parseMemoryIndex(memoryDir: string): Set<string> {
    let content: string;
    try {
        content = readFileSync(join(memoryDir, "MEMORY.md"), "utf8");
    } catch {
        return new Set();
    }
    const linked = new Set<string>();
    const linkPattern = /\]\(([^)]+\.md)\)/g;
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(content)) !== null) {
        const target = match[1]!;
        // Only count flat filenames (no path separators) as memory-file index entries.
        // MEMORY.md also links to subdirectories (e.g. architectural-intent-guesses/README.md)
        // and external paths (../docs/research/...) — those are not memory files.
        if (!target.includes("/")) {
            linked.add(target);
        }
    }
    return linked;
}

function checkSectionMarkers(body: string, fileType: MemoryType): string[] {
    const required = REQUIRED_BODY_MARKERS[fileType] ?? [];
    return required.filter((marker) => !body.toLowerCase().includes(marker.toLowerCase()));
}

function checkLinkIntegrity(body: string, allFiles: Set<string>): string[] {
    const broken: string[] = [];
    const linkPattern = /\]\(([^)]+\.md)\)/g;
    let match: RegExpExecArray | null;
    while ((match = linkPattern.exec(body)) !== null) {
        const target = match[1]!;
        // Only validate flat memory-file links (no path separators).
        if (!target.includes("/") && !allFiles.has(target)) {
            broken.push(target);
        }
    }
    return broken;
}

function applyFixes(file: string, content: string, violations: Violation[]): string {
    const fixable = violations.filter((v) => v.file === file && v.fixable);
    if (fixable.length === 0) return content;

    let fixed = content;
    for (const v of fixable) {
        if (v.check === "prefix-type-mismatch" || v.check === "frontmatter-type") {
            const prefix = extractPrefix(file);
            if (!prefix) continue;
            const expectedType = PREFIX_TO_TYPE[prefix];
            if (!expectedType) continue;
            // Restrict replacement to the frontmatter block (before the closing \n---).
            // Replacing in the full file can accidentally rewrite a `type:` occurrence in
            // the body (e.g., in code examples) while leaving the frontmatter unchanged.
            const fmEnd = fixed.indexOf("\n---", 3);
            if (fmEnd === -1) continue;
            const fm = fixed.slice(0, fmEnd);
            const rest = fixed.slice(fmEnd);
            if (fm.includes("\ntype:")) {
                fixed = fm.replace(/\ntype:[^\n]*/, `\ntype: ${expectedType}`) + rest;
            } else {
                fixed = fm + `\ntype: ${expectedType}` + rest;
            }
        }
    }
    return fixed;
}

function validate(memoryDir: string): ValidateResult {
    const allEntries = readdirSync(memoryDir).filter((f) => f.endsWith(".md"));
    const allFilesSet = new Set(allEntries);
    const regularFiles = allEntries.filter((f) => !isSpecialFile(f));
    const violations: Violation[] = [];

    for (const file of regularFiles) {
        let content: string;
        try {
            content = readFileSync(join(memoryDir, file), "utf8");
        } catch (e) {
            violations.push({ file, check: "read-error", severity: "error", message: `Could not read file: ${e}`, fixable: false });
            continue;
        }
        const prefix = extractPrefix(file);

        if (!prefix) {
            violations.push({
                file, check: "filename-prefix", severity: "error",
                message: `Filename does not start with a valid type prefix (${VALID_TYPES.join("/")}_)`,
                fixable: false,
            });
        }

        if (file.includes(" ")) {
            violations.push({
                file, check: "filename-spaces", severity: "error",
                message: "Filename contains spaces (use underscores)", fixable: false,
            });
        }

        const fm = parseFrontmatter(content);
        if (!fm) {
            violations.push({
                file, check: "frontmatter-missing", severity: "error",
                message: "No YAML frontmatter block found", fixable: false,
            });
            continue;
        }

        if (!fm.fields["name"]) {
            violations.push({
                file, check: "frontmatter-name", severity: "error",
                message: "Missing required field: name", fixable: false,
            });
        }

        if (!fm.fields["description"]) {
            violations.push({
                file, check: "frontmatter-description", severity: "error",
                message: "Missing required field: description", fixable: false,
            });
        }

        if (!fm.fields["type"]) {
            violations.push({
                file, check: "frontmatter-type", severity: "error",
                message: "Missing required field: type", fixable: true,
            });
        } else if (!VALID_TYPES.includes(fm.fields["type"] as MemoryType)) {
            violations.push({
                file, check: "frontmatter-type-invalid", severity: "error",
                message: `Invalid type: "${fm.fields["type"]}" (must be ${VALID_TYPES.join("|")})`, fixable: false,
            });
        }

        if (prefix && fm.fields["type"]) {
            const expectedType = PREFIX_TO_TYPE[prefix];
            if (expectedType && fm.fields["type"] !== expectedType) {
                violations.push({
                    file, check: "prefix-type-mismatch", severity: "error",
                    message: `Filename prefix "${prefix}" implies type "${expectedType}" but frontmatter says "${fm.fields["type"]}"`,
                    fixable: true,
                });
            }
        }

        const fileType = (fm.fields["type"] as MemoryType | undefined) ??
            (prefix ? PREFIX_TO_TYPE[prefix] : undefined);
        const body = content.slice(fm.bodyStart);

        if (fileType) {
            for (const marker of checkSectionMarkers(body, fileType)) {
                violations.push({
                    file, check: "section-marker-missing", severity: "warning",
                    message: `Missing required body marker: "${marker}" (per B-0330 ${fileType} format)`,
                    fixable: false,
                });
            }
        }

        for (const link of checkLinkIntegrity(body, allFilesSet)) {
            violations.push({
                file, check: "link-integrity", severity: "warning",
                message: `Link target not found in memory dir: ${link}`, fixable: false,
            });
        }
    }

    const indexedFiles = parseMemoryIndex(memoryDir);
    const inMemoryNotIndex = regularFiles.filter((f) => !indexedFiles.has(f));
    const inIndexNotMemory = [...indexedFiles].filter(
        (f) => !allEntries.includes(f) && !isSpecialFile(f),
    );

    const errorCount = violations.filter((v) => v.severity === "error").length;
    const warningCount = violations.filter((v) => v.severity === "warning").length;

    return {
        totalFiles: allEntries.length,
        checkedFiles: regularFiles.length,
        violations,
        errorCount,
        warningCount,
        coverageGap: { inMemoryNotIndex, inIndexNotMemory },
    };
}

function main(argv: string[] = process.argv): number {
    let memoryDir: string | undefined;
    const jsonOutput = argv.includes("--json");
    const enforce = argv.includes("--enforce");
    const fix = argv.includes("--fix");

    for (let i = 2; i < argv.length; i++) {
        if (argv[i] === "--memory-dir" && argv[i + 1]) {
            memoryDir = argv[++i]!;
        }
    }

    if (!memoryDir) {
        try {
            memoryDir = getDefaultMemoryDir();
        } catch (e) {
            console.error(String(e));
            return 1;
        }
    }

    let result: ValidateResult;
    try {
        result = validate(memoryDir);
    } catch (e) {
        console.error(`Error reading memory directory "${memoryDir}": ${e}`);
        console.error("Pass --memory-dir to specify a valid directory.");
        return 1;
    }

    if (fix) {
        const fixableFiles = new Set(
            result.violations.filter((v) => v.fixable).map((v) => v.file),
        );
        for (const file of fixableFiles) {
            const filePath = join(memoryDir, file);
            let content: string;
            try {
                content = readFileSync(filePath, "utf8");
            } catch {
                continue;
            }
            const fixed = applyFixes(file, content, result.violations);
            if (fixed !== content) {
                writeFileSync(filePath, fixed, "utf8");
                if (!jsonOutput) console.log(`Fixed: ${file}`);
            }
        }
        // Re-validate so output and --enforce reflect the post-fix state.
        try {
            result = validate(memoryDir);
        } catch {
            // If re-validate fails unexpectedly, fall through with the pre-fix result.
        }
    }

    if (jsonOutput) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        console.log("\n=== Memory Schema Validation ===\n");
        console.log(`Memory dir: ${memoryDir}`);
        console.log(`Total files: ${result.totalFiles}`);
        console.log(`Checked (regular memory files): ${result.checkedFiles}`);
        console.log(`Errors: ${result.errorCount}`);
        console.log(`Warnings: ${result.warningCount}`);

        if (result.violations.length > 0) {
            console.log(`\n--- Violations (first 30) ---\n`);
            for (const v of result.violations.slice(0, 30)) {
                const sev = v.severity === "error" ? "ERR" : "WRN";
                console.log(`  [${sev}] ${v.file}`);
                console.log(`        ${v.check}: ${v.message}`);
            }
            if (result.violations.length > 30) {
                console.log(`  ... and ${result.violations.length - 30} more`);
            }
        }

        const { inMemoryNotIndex, inIndexNotMemory } = result.coverageGap;
        if (inMemoryNotIndex.length > 0 || inIndexNotMemory.length > 0) {
            console.log(`\n--- MEMORY.md coverage ---\n`);
            console.log(`  Files not in MEMORY.md index: ${inMemoryNotIndex.length}`);
            console.log(`  Index entries with no file: ${inIndexNotMemory.length}`);
            if (inIndexNotMemory.length > 0) {
                for (const f of inIndexNotMemory.slice(0, 10)) {
                    console.log(`    ORPHAN INDEX: ${f}`);
                }
            }
        }
    }

    if (enforce && result.errorCount > 0) {
        return 2;
    }
    return 0;
}

if (import.meta.main) {
    process.exit(main());
}

export { validate, parseFrontmatter, extractPrefix };
