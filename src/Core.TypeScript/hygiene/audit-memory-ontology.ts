#!/usr/bin/env bun
// audit-memory-ontology.ts — detect memory files where the filename
// prefix (feedback_, user_, project_, reference_) disagrees with the
// YAML frontmatter `type:` field.
//
// The frontmatter `type:` is the source of truth. When it disagrees
// with the filename prefix, the file should be renamed so the prefix
// matches the type.
//
// TypeScript per Rule 0 (no .sh files except install-graph).
//
// Usage:
//   bun tools/hygiene/audit-memory-ontology.ts
//   bun tools/hygiene/audit-memory-ontology.ts --memory-dir /path/to/memory
//   bun tools/hygiene/audit-memory-ontology.ts --json          # machine-readable output
//   bun tools/hygiene/audit-memory-ontology.ts --fix           # rename mismatched files
//   bun tools/hygiene/audit-memory-ontology.ts --fix --limit 20  # fix only the first N
//
// Exit codes:
//   0 — audit clean
//   1 — mismatches, missing_type, or read_errors found (report or fix mode)
//   2 — errors during fix operations
//   64 — argument error

import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MismatchEntry {
  readonly file: string;
  readonly prefix: string;
  readonly type: string;
  readonly suggestedName: string;
  readonly error?: string;
}

interface AuditResult {
  readonly total: number;
  readonly matched: number;
  readonly mismatched: readonly MismatchEntry[];
  readonly missing_type: readonly string[];
  readonly read_errors: readonly string[];
  readonly byPrefix: Record<string, number>;
  readonly byType: Record<string, number>;
}

interface Args {
  readonly memoryDir: string;
  readonly json: boolean;
  readonly fix: boolean;
  readonly limit: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SKIP_FILES: ReadonlySet<string> = new Set([
  "MEMORY.md",
  "README.md",
]);

const VALID_TYPES: ReadonlySet<string> = new Set([
  "feedback",
  "user",
  "project",
  "reference",
]);

const DEFAULT_MEMORY_DIR = (() => {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  return `${home}/.claude/projects/-Users-acehack-Documents-src-repos-Zeta/memory`;
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let memoryDir = DEFAULT_MEMORY_DIR;
  let json = false;
  let fix = false;
  let limit = Infinity;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--memory-dir" && i + 1 < args.length) {
      memoryDir = args[++i]!;
    } else if (arg === "--json") {
      json = true;
    } else if (arg === "--fix") {
      fix = true;
    } else if (arg === "--limit" && i + 1 < args.length) {
      const n = parseInt(args[++i]!, 10);
      if (isNaN(n) || n < 1) {
        console.error("error: --limit must be a positive integer");
        process.exit(64);
      }
      limit = n;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: bun tools/hygiene/audit-memory-ontology.ts [OPTIONS]

Options:
  --memory-dir DIR   Path to memory directory (default: user-scope Zeta memory)
  --json             Output machine-readable JSON
  --fix              Rename mismatched files (prefix -> type)
  --limit N          When --fix, only fix the first N mismatches
  -h, --help         Show this help`);
      process.exit(0);
    } else {
      console.error(`error: unknown argument '${arg}'`);
      process.exit(64);
    }
  }

  return { memoryDir, json, fix, limit };
}

/**
 * Extract the prefix from a memory filename.
 * e.g. "feedback_some_topic.md" -> "feedback"
 *      "user_aaron.md"          -> "user"
 */
function extractPrefix(filename: string): string | null {
  const match = filename.match(/^(feedback|user|project|reference)_/);
  return match ? match[1]! : null;
}

/**
 * Parse YAML frontmatter from a file's content and extract the `type:` field.
 */
function extractType(content: string): string | null {
  // Frontmatter is delimited by --- on its own line
  if (!content.startsWith("---")) return null;
  const endIdx = content.indexOf("\n---", 3);
  if (endIdx === -1) return null;

  const frontmatter = content.slice(4, endIdx);
  // Simple regex extraction — no YAML parser dependency needed
  const typeMatch = frontmatter.match(/^type:\s*(.+)$/m);
  if (!typeMatch) return null;

  return typeMatch[1]!.trim();
}

/**
 * Compute the suggested filename when the type differs from the prefix.
 * Replaces the prefix portion with the correct type.
 */
function suggestRename(filename: string, currentPrefix: string, correctType: string): string {
  // Replace the prefix part of the filename
  return correctType + filename.slice(currentPrefix.length);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function audit(memoryDir: string): AuditResult {
  const files = readdirSync(memoryDir)
    .filter((f) => f.endsWith(".md"))
    .filter((f) => !SKIP_FILES.has(f))
    .filter((f) => !f.startsWith("CURRENT-"))
    .sort();

  const mismatched: MismatchEntry[] = [];
  const missing_type: string[] = [];
  const read_errors: string[] = [];
  let matched = 0;
  const byPrefix: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const file of files) {
    const prefix = extractPrefix(file);
    if (!prefix) {
      // Files without a recognized prefix (e.g. persona dirs) — skip
      continue;
    }
    byPrefix[prefix] = (byPrefix[prefix] ?? 0) + 1;

    const filepath = join(memoryDir, file);
    let content: string;
    try {
      content = readFileSync(filepath, "utf-8");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      read_errors.push(`${file}: ${msg}`);
      continue;
    }

    const type = extractType(content);
    if (!type) {
      missing_type.push(file);
      continue;
    }

    byType[type] = (byType[type] ?? 0) + 1;

    if (type === prefix) {
      matched++;
    } else if (!VALID_TYPES.has(type)) {
      // Type from frontmatter is not in the allowed ontology — flag as error
      mismatched.push({
        file,
        prefix,
        type,
        suggestedName: file, // no rename — type is invalid
        error: `Invalid type '${type}' in frontmatter (allowed: ${[...VALID_TYPES].join(", ")})`,
      });
    } else {
      mismatched.push({
        file,
        prefix,
        type,
        suggestedName: suggestRename(file, prefix, type),
      });
    }
  }

  return {
    total: files.filter((f) => extractPrefix(f) !== null).length,
    matched,
    mismatched,
    missing_type,
    read_errors,
    byPrefix,
    byType,
  };
}

function applyFixes(
  memoryDir: string,
  mismatches: readonly MismatchEntry[],
  limit: number,
): { fixed: string[]; errors: string[] } {
  const toFix = mismatches.slice(0, limit);
  const fixed: string[] = [];
  const errors: string[] = [];

  // Detect duplicate suggestedName values in the fix set
  const suggestedNameCounts = new Map<string, number>();
  for (const entry of toFix) {
    if (entry.error) continue; // skip entries with invalid types
    suggestedNameCounts.set(
      entry.suggestedName,
      (suggestedNameCounts.get(entry.suggestedName) ?? 0) + 1,
    );
  }

  for (const entry of toFix) {
    // Skip entries with invalid type (no valid rename target)
    if (entry.error) {
      errors.push(`Skipped ${entry.file}: ${entry.error}`);
      continue;
    }

    // Skip if multiple files would rename to the same target
    if ((suggestedNameCounts.get(entry.suggestedName) ?? 0) > 1) {
      errors.push(
        `Skipped ${entry.file}: duplicate target '${entry.suggestedName}' (${suggestedNameCounts.get(entry.suggestedName)} files would collide)`,
      );
      continue;
    }

    const oldPath = join(memoryDir, entry.file);
    const newPath = join(memoryDir, entry.suggestedName);

    // Check for destination file collision
    if (existsSync(newPath)) {
      errors.push(
        `Skipped ${entry.file}: destination '${entry.suggestedName}' already exists`,
      );
      continue;
    }

    try {
      renameSync(oldPath, newPath);
      fixed.push(`${entry.file} -> ${entry.suggestedName}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Failed to rename ${entry.file}: ${msg}`);
    }
  }

  // Update MEMORY.md index — only for files that actually renamed
  // Build a map from old name -> new name for successfully renamed files only
  const renamedMap = new Map<string, string>();
  for (const line of fixed) {
    const parts = line.split(" -> ");
    if (parts.length === 2) {
      renamedMap.set(parts[0]!, parts[1]!);
    }
  }

  if (renamedMap.size > 0) {
    const memoryMdPath = join(memoryDir, "MEMORY.md");
    try {
      let memoryMd = readFileSync(memoryMdPath, "utf-8");
      let updated = false;
      for (const [oldName, newName] of renamedMap) {
        if (memoryMd.includes(oldName)) {
          memoryMd = memoryMd.replaceAll(oldName, newName);
          updated = true;
        }
      }
      if (updated) {
        writeFileSync(memoryMdPath, memoryMd, "utf-8");
        fixed.push("MEMORY.md index updated");
      }
    } catch (e: unknown) {
      // MEMORY.md not existing is fine; other I/O errors should be surfaced
      const code = (e as NodeJS.ErrnoException)?.code;
      if (code !== "ENOENT") {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Failed to update MEMORY.md: ${msg}`);
      }
    }
  }

  return { fixed, errors };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const args = parseArgs();
const result = audit(args.memoryDir);

if (args.json && !args.fix) {
  console.log(JSON.stringify(result, null, 2));
} else if (!args.fix) {
  console.log(`Memory ontology audit — ${args.memoryDir}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Total files scanned:  ${result.total}`);
  console.log(`Prefix matches type:  ${result.matched}`);
  console.log(`Mismatched:           ${result.mismatched.length}`);
  console.log(`Missing type field:   ${result.missing_type.length}`);
  console.log();
  console.log("By prefix:", result.byPrefix);
  console.log("By type:  ", result.byType);

  if (result.mismatched.length > 0) {
    console.log();
    console.log("Mismatches (prefix != type):");
    for (const m of result.mismatched) {
      console.log(`  ${m.file}`);
      console.log(`    prefix=${m.prefix}  type=${m.type}  -> ${m.suggestedName}`);
    }
  }

  if (result.missing_type.length > 0) {
    console.log();
    console.log("Missing type field:");
    for (const f of result.missing_type) {
      console.log(`  ${f}`);
    }
  }

  if (result.read_errors.length > 0) {
    console.log();
    console.log("Read errors:");
    for (const e of result.read_errors) {
      console.log(`  ${e}`);
    }
  }
}

if (args.fix) {
  const { fixed, errors } = applyFixes(args.memoryDir, result.mismatched, args.limit);
  if (args.json) {
    console.log(JSON.stringify({ ...result, fixed, errors }, null, 2));
    if (errors.length > 0) {
      process.exit(2);
    }
    if (result.missing_type.length > 0 || result.read_errors.length > 0) {
      process.exit(1);
    }
  } else {
    console.log();
    console.log(`Fixed ${fixed.length} files:`);
    for (const f of fixed) {
      console.log(`  ${f}`);
    }
    if (errors.length > 0) {
      console.log();
      console.log(`Errors (${errors.length}):`);
      for (const e of errors) {
        console.log(`  ${e}`);
      }
      process.exit(2);
    }
    if (result.missing_type.length > 0 || result.read_errors.length > 0) {
      if (result.missing_type.length > 0) {
        console.log();
        console.log(`Warning: ${result.missing_type.length} file(s) with missing type field remain (cannot auto-fix)`);
      }
      if (result.read_errors.length > 0) {
        console.log();
        console.log(`Warning: ${result.read_errors.length} file(s) could not be read`);
      }
      process.exit(1);
    }
  }
} else if (result.mismatched.length > 0 || result.missing_type.length > 0 || result.read_errors.length > 0) {
  process.exit(1);
}
