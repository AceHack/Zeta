#!/usr/bin/env bun
// Repair a Claude Code session JSONL corrupted by oversize image attachments.
//
// Pasted images that exceed the harness session-load limit (commonly ~10 MB
// per JSONL line once base64-encoded) prevent the session from reopening.
// This script identifies the offending lines, strips only the image blocks
// (preserving line UUIDs + text content so the conversation graph stays
// intact), and refuses to write if any post-edit line fails to parse.
//
// Usage:
//   bun src/Core.TypeScript/claude-code-recovery/repair-jsonl-strip-images.ts --scan
//   bun src/Core.TypeScript/claude-code-recovery/repair-jsonl-strip-images.ts --session <uuid>
//   bun src/Core.TypeScript/claude-code-recovery/repair-jsonl-strip-images.ts --session <uuid> --apply
//
// Flags:
//   --scan                   Scan every session in the project dir, report
//                            any with lines exceeding --max-line-bytes.
//                            Mutually exclusive with --session.
//   --session <uuid>         Target one session JSONL. Required unless --scan.
//   --slug <project-slug>    Defaults to current Zeta project slug.
//                            (~/.claude/projects/<slug>/<session>.jsonl)
//   --projects-dir <path>    Defaults to ~/.claude/projects.
//   --max-line-bytes <N>     Lines longer than this are inspected. Default
//                            10_000_000 (10 MB) — matches the empirical
//                            corruption threshold observed 2026-05-25.
//   --max-image-bytes <N>    Individual images whose base64 length exceeds
//                            this get stripped. Default = same as
//                            --max-line-bytes. Small images on an oversize
//                            line are PRESERVED; only the oversize image(s)
//                            that pushed the line past the harness limit
//                            are removed.
//   --apply                  Without this flag the script is dry-run only.
//                            With this flag, makes a timestamped .bak and
//                            writes the cleaned JSONL in place.
//   --help                   Print this usage and exit.

import {
  readFileSync,
  writeFileSync,
  renameSync,
  statSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_MAX_LINE_BYTES = 10_000_000;

/**
 * Claude Code identifies each project by `~/.claude/projects/<slug>/`
 * where `<slug>` is the project's absolute path with `/` replaced by
 * `-`. Derive the slug from the current working directory so the
 * default works for any operator without machine-specific hardcoding.
 */
function deriveDefaultSlug(): string {
  return process.cwd().replace(/\//g, "-");
}

type Block = {
  type?: string;
  text?: string;
  source?: { data?: string };
} & Record<string, unknown>;

type Args = {
  scan: boolean;
  session: string | undefined;
  slug: string;
  projectsDir: string;
  maxLineBytes: number;
  maxImageBytes: number;
  apply: boolean;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsageAndExit(0);
  }
  const get = (flag: string, fallback?: string): string | undefined => {
    const i = argv.indexOf(flag);
    if (i === -1) return fallback;
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) {
      console.error(`flag ${flag} requires a value`);
      printUsageAndExit(64);
    }
    return v;
  };
  const parseNonNegativeNumber = (flag: string, raw: string): number => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      console.error(`${flag} must be a non-negative number; got '${raw}'`);
      printUsageAndExit(64);
    }
    return n;
  };
  const scan = argv.includes("--scan");
  const session = get("--session");
  if (!scan && !session) {
    console.error("required: --scan OR --session <uuid>");
    printUsageAndExit(64);
  }
  if (scan && session) {
    console.error("--scan and --session are mutually exclusive");
    printUsageAndExit(64);
  }
  const maxLineBytes = parseNonNegativeNumber(
    "--max-line-bytes",
    get("--max-line-bytes", String(DEFAULT_MAX_LINE_BYTES))!,
  );
  const maxImageBytes = parseNonNegativeNumber(
    "--max-image-bytes",
    get("--max-image-bytes", String(maxLineBytes))!,
  );
  return {
    scan,
    session,
    slug: get("--slug", deriveDefaultSlug())!,
    projectsDir: get("--projects-dir", join(homedir(), ".claude", "projects"))!,
    maxLineBytes,
    maxImageBytes,
    apply: argv.includes("--apply"),
  };
}

function printUsageAndExit(code: number): never {
  const me = "bun src/Core.TypeScript/claude-code-recovery/repair-jsonl-strip-images.ts";
  console.error(`Usage:
  ${me} --scan
  ${me} --session <uuid>
  ${me} --session <uuid> --apply

Flags:
  --scan                   Scan all sessions in the project dir
  --session <uuid>         Target one session (without --apply, dry-run only)
  --slug <project-slug>    Override project slug (default: derived from cwd —
                           absolute path with '/' replaced by '-')
  --projects-dir <path>    Override projects dir (default ~/.claude/projects)
  --max-line-bytes <N>     Inspect-line threshold in bytes (default ${DEFAULT_MAX_LINE_BYTES.toLocaleString()})
  --max-image-bytes <N>    Strip-image threshold in bytes (default = --max-line-bytes)
                           Only images with base64 length above this are stripped;
                           smaller images on the same line are preserved.
  --apply                  Write the edit (default: dry-run)
  --help                   Print this usage`);
  process.exit(code);
}

function scrub(
  blocks: unknown,
  maxImageBytes: number,
): {
  kept: Block[];
  droppedCount: number;
  keptImageCount: number;
  freedBytes: number;
  droppedSizes: number[];
} | null {
  if (!Array.isArray(blocks)) return null;
  let droppedCount = 0;
  let keptImageCount = 0;
  let freedBytes = 0;
  const droppedSizes: number[] = [];
  const kept: Block[] = [];
  for (const b of blocks as Block[]) {
    if (b && typeof b === "object" && b.type === "image") {
      const dataLen = (b.source?.data ?? "").length;
      if (dataLen > maxImageBytes) {
        freedBytes += dataLen;
        droppedCount++;
        droppedSizes.push(dataLen);
        continue;
      }
      keptImageCount++;
    }
    kept.push(b);
  }
  return { kept, droppedCount, keptImageCount, freedBytes, droppedSizes };
}

function annotate(
  container: Block[],
  stamp: string,
  dropped: number,
  bytes: number,
): void {
  const tag = ` [${dropped} image(s) stripped ${stamp}: ~${Math.round(
    bytes / 1024,
  ).toLocaleString()} KB base64 removed to recover session]`;
  for (const b of container) {
    if (b?.type === "text") {
      b.text = (b.text ?? "") + tag;
      return;
    }
  }
  // No text block to attach to — append a synthetic text block so the
  // strip remains traceable when the session is reloaded.
  container.push({ type: "text", text: tag.trimStart() });
}

function processLine(
  raw: string,
  stamp: string,
  maxImageBytes: number,
): {
  line: string;
  drops: number;
  bytes: number;
  keptImages: number;
  droppedSizes: number[];
} {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw);
  } catch {
    return { line: raw, drops: 0, bytes: 0, keptImages: 0, droppedSizes: [] };
  }
  let drops = 0;
  let bytes = 0;
  let keptImages = 0;
  const droppedSizes: number[] = [];
  let firstModified: Block[] | undefined; // track which container actually lost images
  const apply = (container: Block[] | undefined): void => {
    if (!container) return;
    const r = scrub(container, maxImageBytes);
    if (!r) return;
    keptImages += r.keptImageCount;
    if (r.droppedCount === 0) return;
    container.length = 0;
    container.push(...r.kept);
    drops += r.droppedCount;
    bytes += r.freedBytes;
    droppedSizes.push(...r.droppedSizes);
    if (!firstModified) firstModified = container;
  };
  // Pattern 1: attachment.prompt[] (queued_command shape)
  const att = obj.attachment as { prompt?: Block[] } | undefined;
  if (att?.prompt && Array.isArray(att.prompt)) {
    apply(att.prompt);
  }
  // Pattern 2: message.content[] (Anthropic user-turn shape)
  const msg = obj.message as { content?: Block[] } | undefined;
  if (msg?.content && Array.isArray(msg.content)) {
    apply(msg.content);
  }
  // Pattern 3: top-level content[] (tool_result shape)
  if (Array.isArray(obj.content)) {
    apply(obj.content as Block[]);
  }
  if (drops === 0) {
    return { line: raw, drops: 0, bytes: 0, keptImages, droppedSizes: [] };
  }
  // Annotate the container that actually lost images (not just the
  // first container that exists). Prior code annotated att.prompt
  // whenever it existed even if drops happened in msg.content or
  // top-level content — added a synthetic text block to the wrong
  // surface and left the modified container untraceable.
  if (firstModified) {
    annotate(firstModified, stamp, drops, bytes);
  }
  return { line: JSON.stringify(obj), drops, bytes, keptImages, droppedSizes };
}

function scanFile(
  path: string,
  maxLineBytes: number,
): { lineNo: number; length: number }[] {
  const flagged: { lineNo: number; length: number }[] = [];
  // Read as Buffer (no encoding) so byte counts are accurate for
  // non-ASCII content — the thresholds are documented in bytes,
  // and string `.length` would give UTF-16 code units.
  const buf = readFileSync(path);
  let start = 0;
  let lineNo = 0;
  for (let i = 0; i <= buf.length; i++) {
    if (i === buf.length || buf[i] === 0x0a) {
      lineNo++;
      const len = i - start;
      if (len > maxLineBytes) flagged.push({ lineNo, length: len });
      start = i + 1;
    }
  }
  return flagged;
}

function runScan(args: Args): number {
  const dir = join(args.projectsDir, args.slug);
  if (!existsSync(dir)) {
    console.error(`projects dir not found: ${dir}`);
    return 66;
  }
  const sessions = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  console.log(
    `scanning ${sessions.length} session(s) in ${dir} (threshold ${args.maxLineBytes.toLocaleString()} bytes)`,
  );
  let anyFlagged = 0;
  for (const f of sessions) {
    const path = join(dir, f);
    const flagged = scanFile(path, args.maxLineBytes);
    if (flagged.length === 0) continue;
    anyFlagged++;
    const size = statSync(path).size;
    console.log(`\n  ${f}  (${size.toLocaleString()} bytes)`);
    for (const { lineNo, length } of flagged) {
      console.log(
        `    line ${lineNo}: ${length.toLocaleString()} bytes (~${Math.round(length / 1024 / 1024)} MB)`,
      );
    }
    console.log(
      `    repair: bun src/Core.TypeScript/claude-code-recovery/repair-jsonl-strip-images.ts --session ${f.replace(/\.jsonl$/, "")} --apply`,
    );
  }
  if (anyFlagged === 0) {
    console.log("no sessions with oversize lines found");
  } else {
    console.log(`\n${anyFlagged} session(s) flagged. Run with --session <uuid> --apply to repair.`);
  }
  return 0;
}

function runRepair(args: Args): number {
  const path = join(args.projectsDir, args.slug, `${args.session!}.jsonl`);
  // Single readFileSync — no check-then-read pattern (eliminates
  // CWE-367 surface). Compute file size from the returned Buffer's
  // length rather than a separate statSync call.
  let buf: Buffer;
  try {
    buf = readFileSync(path);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      console.error(`not found: ${path}`);
      return 66;
    }
    throw e;
  }
  const sizeBefore = buf.length;
  const raw = buf.toString("utf8");
  const stamp = new Date().toISOString().slice(0, 10);
  const lines = raw.split("\n");
  const out: string[] = [];
  type Report = {
    lineNo: number;
    drops: number;
    bytes: number;
    keptImages: number;
    droppedSizes: number[];
  };
  const reports: Report[] = [];
  let linesInspected = 0;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i] ?? "";
    // Threshold is consistent with --scan: lines whose UTF-8 byte
    // length > maxLineBytes are inspected; at-or-below is left alone.
    // Buffer.byteLength gives true UTF-8 bytes (string `.length` is
    // UTF-16 code units, which under-counts multi-byte content).
    if (Buffer.byteLength(ln, "utf8") <= args.maxLineBytes) {
      out.push(ln);
      continue;
    }
    linesInspected++;
    const result = processLine(ln, stamp, args.maxImageBytes);
    out.push(result.line);
    if (result.drops > 0) {
      reports.push({
        lineNo: i + 1,
        drops: result.drops,
        bytes: result.bytes,
        keptImages: result.keptImages,
        droppedSizes: result.droppedSizes,
      });
    }
  }
  if (reports.length === 0) {
    console.log(
      `no oversize images found in ${linesInspected} oversize line(s) (line threshold ${args.maxLineBytes.toLocaleString()} bytes, image threshold ${args.maxImageBytes.toLocaleString()} bytes)`,
    );
    return 0;
  }
  console.log(
    `${args.apply ? "stripping" : "would strip"} from ${reports.length} line(s) (image threshold ${args.maxImageBytes.toLocaleString()} bytes):`,
  );
  for (const r of reports) {
    const sizesMb = r.droppedSizes
      .map((b) => `${Math.round(b / 1024 / 1024)}MB`)
      .join(", ");
    const keptNote = r.keptImages > 0 ? `, preserved ${r.keptImages} smaller image(s)` : "";
    console.log(
      `  line ${r.lineNo}: dropped ${r.drops} oversize image(s) [${sizesMb}], ~${Math.round(r.bytes / 1024).toLocaleString()} KB freed${keptNote}`,
    );
  }
  // Validate every line still parses before promising the write
  let bad = 0;
  for (let i = 0; i < out.length; i++) {
    const ln = out[i] ?? "";
    if (ln.length === 0) continue;
    try {
      JSON.parse(ln);
    } catch (e) {
      bad++;
      console.error(`BAD line ${i + 1} after edit: ${(e as Error).message.slice(0, 100)}`);
    }
  }
  if (bad > 0) {
    console.error(`refusing to apply: ${bad} unparseable line(s) post-edit`);
    return 70;
  }
  const newContent = out.join("\n");
  const newSize = Buffer.byteLength(newContent, "utf8");
  console.log(
    `size: ${sizeBefore.toLocaleString()} → ${newSize.toLocaleString()} bytes (saves ${(sizeBefore - newSize).toLocaleString()})`,
  );
  if (!args.apply) {
    console.log("dry-run (pass --apply to write)");
    return 0;
  }
  const backup = `${path}.bak-${stamp}-${Date.now()}`;
  // Backup: write from the in-memory buffer we already read above.
  // Avoids a second fs read against `path` (CWE-367).
  writeFileSync(backup, buf);
  // Atomic in-place replace: write to a temp file in the same
  // directory, then renameSync. POSIX rename is atomic — a crash
  // mid-write leaves either the original file or the new file
  // intact, never a truncated half-write.
  const tmpPath = `${path}.tmp-${Date.now()}`;
  writeFileSync(tmpPath, newContent);
  renameSync(tmpPath, path);
  console.log(`backup: ${backup}`);
  console.log("applied. reload the session in Claude Code.");
  return 0;
}

function main(): void {
  const args = parseArgs();
  const code = args.scan ? runScan(args) : runRepair(args);
  process.exit(code);
}

// Per repo convention (tools/ scripts): only auto-run when invoked as
// entrypoint, not when imported for testing/reuse.
if (import.meta.main) main();
