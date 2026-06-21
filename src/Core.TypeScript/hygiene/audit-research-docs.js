#!/usr/bin/env bun
// audit-research-docs.ts - report docs/research files missing memory-substrate references.
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, "..", "..", "..");
const RESEARCH_DIR = join(REPO_ROOT, "docs", "research");
const MEMORY_DIR = join(REPO_ROOT, "memory");
const DEFAULT_ROOTS = {
    repoRoot: REPO_ROOT,
    researchDir: RESEARCH_DIR,
    memoryDir: MEMORY_DIR,
};
const RESEARCH_LABEL = "docs/research";
const MEMORY_LABEL = "memory";
const UNINDEXED_RATIONALE_RE = /\b(?:unindexed[_ -]?rationale|explicit unindexed rationale)\b/i;
function normalizePath(path) {
    return path.replaceAll("\\", "/");
}
function repoRelative(path, repoRoot) {
    return normalizePath(relative(repoRoot, path));
}
function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function hasPathReference(content, candidate) {
    const escaped = escapeRegExp(candidate);
    const pathChar = String.raw `A-Za-z0-9._~/-`;
    return new RegExp(String.raw `(^|[^${pathChar}])(?:\.\./)*${escaped}($|[^${pathChar}])`).test(content);
}
async function listFiles(root) {
    const entries = await readdir(root, { withFileTypes: true });
    const paths = await Promise.all(entries.map(async (entry) => {
        const path = join(root, entry.name);
        if (entry.isDirectory()) {
            return listFiles(path);
        }
        if (entry.isFile()) {
            return [path];
        }
        return [];
    }));
    return paths.flat().sort((a, b) => a.localeCompare(b));
}
function isReferenced(path, content, roots) {
    const absolute = normalizePath(path);
    const normalized = repoRelative(path, roots.repoRoot);
    const researchRelative = normalizePath(relative(roots.researchDir, path));
    return (hasPathReference(content, absolute) ||
        hasPathReference(content, normalized) ||
        hasPathReference(content, researchRelative));
}
async function hasExplicitUnindexedRationale(path) {
    const content = await readFile(path, "utf8");
    return UNINDEXED_RATIONALE_RE.test(content);
}
export async function auditResearchDocs() {
    return auditResearchDocsInRoots(DEFAULT_ROOTS);
}
export async function auditResearchDocsInRoots(roots) {
    const [researchFiles, allMemoryFiles] = await Promise.all([
        listFiles(roots.researchDir),
        listFiles(roots.memoryDir),
    ]);
    const memoryFiles = allMemoryFiles.filter((path) => path.endsWith(".md"));
    const memoryContents = await Promise.all(memoryFiles.map(async (path) => readFile(path, "utf8")));
    const combinedMemoryContent = memoryContents.join("\n");
    const referenced = [];
    const explicitlyUnindexed = [];
    const unreferenced = [];
    for (const file of researchFiles) {
        if (isReferenced(file, combinedMemoryContent, roots)) {
            referenced.push(repoRelative(file, roots.repoRoot));
        }
        else if (await hasExplicitUnindexedRationale(file)) {
            explicitlyUnindexed.push(repoRelative(file, roots.repoRoot));
        }
        else {
            unreferenced.push(repoRelative(file, roots.repoRoot));
        }
    }
    return {
        researchFiles: researchFiles.map((path) => repoRelative(path, roots.repoRoot)),
        memoryFiles: memoryFiles.map((path) => repoRelative(path, roots.repoRoot)),
        referenced,
        explicitlyUnindexed,
        unreferenced,
    };
}
function describeIoError(err) {
    if (err instanceof Error) {
        const code = "code" in err && typeof err.code === "string"
            ? err.code
            : undefined;
        return code !== undefined ? `${code}: ${err.message}` : err.message;
    }
    return String(err);
}
export async function main() {
    let result;
    try {
        result = await auditResearchDocs();
    }
    catch (err) {
        process.stderr.write(`error: failed to audit research docs (${describeIoError(err)})\n`);
        return 64;
    }
    process.stderr.write(`research-doc audit on ${RESEARCH_LABEL} against ${MEMORY_LABEL}/**/*\n`);
    process.stderr.write(`  research docs: ${String(result.researchFiles.length)}\n`);
    process.stderr.write(`  memory docs:   ${String(result.memoryFiles.length)}\n`);
    process.stderr.write(`  referenced:    ${String(result.referenced.length)}\n`);
    process.stderr.write(`  unindexed rationale: ${String(result.explicitlyUnindexed.length)}\n`);
    process.stderr.write(`  unreferenced:  ${String(result.unreferenced.length)}\n`);
    if (result.unreferenced.length === 0) {
        process.stderr.write("\nall research docs are referenced from memory substrate or carry explicit unindexed rationale\n");
        return 0;
    }
    process.stderr.write("\nunreferenced research docs:\n\n");
    for (const file of result.unreferenced) {
        process.stderr.write(`  ${file}\n`);
    }
    process.stderr.write("\n");
    process.stderr.write("Add a memory-substrate reference or record an explicit unindexed rationale.\n");
    return 2;
}
if (import.meta.main) {
    void main()
        .then((code) => process.exit(code))
        .catch((err) => {
        process.stderr.write(`error: unhandled research-doc audit failure (${describeIoError(err)})\n`);
        process.exit(1);
    });
}
