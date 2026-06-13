/**
 * Mechanical authorization check — pace-instruction extractor (B-0306).
 *
 * Pure function: reads substrate surfaces, returns typed PaceInstruction[]
 * with source attribution. Does NOT determine rescind status — that is
 * the resolver's job (B-0307).
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

export interface PaceInstruction {
  source: string;
  timestamp: string | null;
  raw: string;
  file: string;
}

const PACE_PATTERNS = [
  /go\s+hard/i,
  /grind(?:ing)?\s+(?:through|the|on)/i,
  /keep\s+(?:working|grinding)/i,
  /really\s+look\s+at\s+the\s+backlog/i,
  /stop\s+grinding/i,
  /hold\s+the\s+line/i,
  /rest\s+now/i,
  /cooling\s+period/i,
  /take\s+it\s+easy/i,
  /don'?t\s+have\s+to\s+do\s+minimum/i,
  /you\s+(?:can|are)\s+(?:authorized|go)/i,
  /recommend\s+holding/i,
  /hold\s+until\s+maintainer/i,
];

const SOURCE_PATTERNS: [RegExp, string][] = [
  [/\bthe\s+human\s+maintainer\b/i, "aaron"],
  [/\bAaron\b/i, "aaron"],
  [/\bClaude(?:\.ai|ai)?\b/i, "claude.ai"],
  [/\bCodex\b/i, "codex"],
  [/\bAmara\b/i, "amara"],
  [/\bGemini\b/i, "gemini"],
  [/\bGrok\b/i, "grok"],
  [/\bAni\b/i, "ani"],
  [/\bRiven\b/i, "riven"],
];

const ISSUER_PATTERNS: [RegExp, string][] = [
  [/^(?:[-*>\s"']*)(?:the\s+human\s+maintainer)\b/i, "aaron"],
  [/^(?:[-*>\s"']*)Aaron\b/i, "aaron"],
  [/^(?:[-*>\s"']*)Claude(?:\.ai|ai)?\b/i, "claude.ai"],
  [/^(?:[-*>\s"']*)Codex\b/i, "codex"],
  [/^(?:[-*>\s"']*)Amara\b/i, "amara"],
  [/^(?:[-*>\s"']*)Gemini\b/i, "gemini"],
  [/^(?:[-*>\s"']*)Grok\b/i, "grok"],
  [/^(?:[-*>\s"']*)Ani\b/i, "ani"],
  [/^(?:[-*>\s"']*)Riven\b/i, "riven"],
];

const FILENAME_SOURCE_PATTERNS: [RegExp, string][] = [
  [/(?:^|[/_.-])aaron(?:[/_.-]|$)/i, "aaron"],
  [/(?:^|[/_.-])claude[_.-]?ai(?:[/_.-]|$)/i, "claude.ai"],
  [/(?:^|[/_.-])codex(?:[/_.-]|$)/i, "codex"],
  [/(?:^|[/_.-])amara(?:[/_.-]|$)/i, "amara"],
  [/(?:^|[/_.-])gemini(?:[/_.-]|$)/i, "gemini"],
  [/(?:^|[/_.-])grok(?:[/_.-]|$)/i, "grok"],
  [/(?:^|[/_.-])ani(?:[/_.-]|$)/i, "ani"],
  [/(?:^|[/_.-])riven(?:[/_.-]|$)/i, "riven"],
];

const DATE_RE = /\b(20\d{2}-\d{2}-\d{2})\b/;
const FILENAME_DATE_RE = /(\d{4})_(\d{2})_(\d{2})/;
const NON_EMPTY_RE = /\S/;
const MAX_ATTRIBUTION_LOOKBACK = 12;

function containsPaceInstruction(line: string): boolean {
  return PACE_PATTERNS.some((p) => p.test(line));
}

function inferSourceFromText(text: string): string {
  for (const [re, label] of SOURCE_PATTERNS) {
    if (re.test(text)) return label;
  }
  return "unknown";
}

function inferIssuerSource(text: string): string {
  for (const [re, label] of ISSUER_PATTERNS) {
    if (re.test(text)) return label;
  }
  return "unknown";
}

function inferSourceFromFilename(filename: string): string {
  for (const [re, label] of FILENAME_SOURCE_PATTERNS) {
    if (re.test(filename)) return label;
  }
  return "unknown";
}

function inferSource(
  raw: string,
  previousLine: string | null,
  filename: string,
): string {
  if (previousLine !== null) {
    const issuerSource = inferIssuerSource(previousLine);
    if (issuerSource !== "unknown") return issuerSource;
  }

  const filenameSource = inferSourceFromFilename(filename);
  if (filenameSource !== "unknown") return filenameSource;

  return inferSourceFromText(raw);
}

function extractInlineTimestamp(text: string): string | null {
  const inlineMatch = DATE_RE.exec(text);
  const inlineTimestamp = inlineMatch?.[1];
  if (inlineTimestamp !== undefined) return inlineTimestamp;
  return null;
}

function extractFilenameTimestamp(filename: string): string | null {
  const fnMatch = FILENAME_DATE_RE.exec(filename);
  const year = fnMatch?.[1];
  const month = fnMatch?.[2];
  const day = fnMatch?.[3];
  if (year !== undefined && month !== undefined && day !== undefined) {
    return `${year}-${month}-${day}`;
  }

  return null;
}

function extractTimestamp(
  raw: string,
  previousLine: string | null,
  filename: string,
): string | null {
  return (
    extractInlineTimestamp(raw) ??
    (previousLine === null ? null : extractInlineTimestamp(previousLine)) ??
    extractFilenameTimestamp(filename)
  );
}

function stripFrontmatter(content: string): string {
  if (!content.startsWith("---")) return content;
  const endIdx = content.indexOf("---", 3);
  if (endIdx === -1) return content;
  return content.slice(endIdx + 3);
}

function previousAttributionLine(
  lines: string[],
  beforeIndex: number,
): string | null {
  let seen = 0;
  for (
    let i = beforeIndex - 1;
    i >= 0 && seen < MAX_ATTRIBUTION_LOOKBACK;
    i -= 1
  ) {
    const candidate = lines[i]?.trim();
    if (candidate === undefined || !NON_EMPTY_RE.test(candidate)) continue;

    seen += 1;
    if (
      inferIssuerSource(candidate) !== "unknown" ||
      extractInlineTimestamp(candidate) !== null
    ) {
      return candidate;
    }
  }
  return null;
}

function extractFromFile(
  filePath: string,
  rootPath: string,
): PaceInstruction[] {
  if (!existsSync(filePath)) return [];

  const content = readFileSync(filePath, "utf-8");
  const body = stripFrontmatter(content);
  const relPath = relative(rootPath, filePath);
  const lines = body.split("\n");
  const instructions: PaceInstruction[] = [];

  for (const [index, line] of lines.entries()) {
    if (!containsPaceInstruction(line)) continue;

    const raw = line.trim().slice(0, 500);
    const previous = previousAttributionLine(lines, index);
    const source = inferSource(raw, previous, relPath);
    const timestamp = extractTimestamp(raw, previous, relPath);

    instructions.push({ source, timestamp, raw, file: relPath });
  }

  return instructions;
}

export async function extractPaceInstructions(
  rootPath: string,
): Promise<PaceInstruction[]> {
  const results: PaceInstruction[] = [];

  // Surface 1: CLAUDE.md
  results.push(...extractFromFile(join(rootPath, "CLAUDE.md"), rootPath));

  // Surface 2: memory/feedback_*.md files
  const memoryDir = join(rootPath, "memory");
  if (existsSync(memoryDir)) {
    const files = readdirSync(memoryDir).filter(
      (f) => f.startsWith("feedback_") && f.endsWith(".md"),
    );
    for (const f of files) {
      results.push(...extractFromFile(join(memoryDir, f), rootPath));
    }
  }

  // Surface 3: memory/CURRENT-aaron.md
  results.push(
    ...extractFromFile(join(rootPath, "memory", "CURRENT-aaron.md"), rootPath),
  );

  // Surface 4: docs/active-trajectory.md
  results.push(
    ...extractFromFile(
      join(rootPath, "docs", "active-trajectory.md"),
      rootPath,
    ),
  );

  // Sort chronologically (nulls last)
  results.sort((a, b) => {
    if (a.timestamp === b.timestamp) return 0;
    if (a.timestamp === null) return 1;
    if (b.timestamp === null) return -1;
    return a.timestamp.localeCompare(b.timestamp);
  });

  return results;
}
