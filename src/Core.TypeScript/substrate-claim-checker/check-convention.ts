#!/usr/bin/env bun
/**
 * substrate-claim-checker / check-convention.ts (v0.9.0)
 *
 * Convention-drift sub-class checker. Smallest v0.9 slice: ADR
 * supersession claims must be reciprocal. When a current ADR says it
 * supersedes an earlier ADR, the earlier ADR must carry a top-of-file
 * "Superseded by" marker that names the superseding ADR.
 */

import { readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, basename } from "node:path";

interface Finding {
  file: string;
  line: number;
  target: string;
  reason: string;
}

interface SupersessionClaim {
  line: number;
  target: string;
  raw: string;
}

interface SearchLine {
  line: number;
  text: string;
}

interface FenceState {
  char: "`" | "~" | null;
  len: number;
}

interface CheckResult {
  findings: Finding[];
  ok: boolean;
}

function statExists(p: string): boolean {
  try {
    statSync(p);
    return true;
  } catch {
    return false;
  }
}

function findRepoRoot(startPath: string): string {
  let cur = isAbsolute(startPath) ? startPath : resolve(startPath);
  try {
    if (statSync(cur).isFile()) cur = dirname(cur);
  } catch {
    cur = dirname(cur);
  }
  while (cur !== "/" && cur !== "") {
    const gitPath = join(cur, ".git");
    if (statExists(gitPath)) return cur;
    const parent = dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return process.cwd();
}

function normalizeTarget(target: string): string {
  let result = stripMarkdownLinkTitle(target);
  if (result.startsWith("<") && result.endsWith(">")) {
    result = result.slice(1, -1);
  }
  const queryAt = result.indexOf("?");
  const anchorAt = result.indexOf("#");
  const cutPoints = [queryAt, anchorAt].filter((n) => n >= 0);
  if (cutPoints.length > 0) {
    result = result.slice(0, Math.min(...cutPoints));
  }
  return result;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripMarkdownLinkTitle(target: string): string {
  const result = target.trim();
  if (result.startsWith("<")) {
    const closeAt = result.indexOf(">");
    if (closeAt >= 0) return result.slice(1, closeAt);
  }

  const titleMarkers = [' "', " '", " ("];
  const cutPoints = titleMarkers
    .map((marker) => result.indexOf(marker))
    .filter((n) => n >= 0);
  if (cutPoints.length === 0) return result;
  return result.slice(0, Math.min(...cutPoints)).trimEnd();
}

function isRepoRelativeTarget(target: string): boolean {
  if (target.length === 0) return false;
  if (isAbsolute(target)) return false;
  if (/^[A-Za-z]:[\\/]/.test(target)) return false;
  if (target.startsWith("\\\\")) return false;
  if (target.startsWith("//")) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(target)) return false;
  return true;
}

function isInsideRepo(candidate: string, repoRoot: string): boolean {
  const rel = relative(repoRoot, candidate);
  return rel.length === 0 || (!rel.startsWith("..") && !isAbsolute(rel));
}

function updateFenceState(
  line: string,
  state: FenceState,
): void {
  const trimmed = line.trimStart();
  const first = trimmed.at(0);
  if (first !== "`" && first !== "~") return;

  let len = 0;
  while (trimmed.at(len) === first) len++;
  if (len < 3) return;

  const ch = first === "`" ? "`" : "~";
  const isCloser = trimmed.slice(len).trim().length === 0;
  if (state.char === null) {
    state.char = ch;
    state.len = len;
    return;
  }
  if (isCloser && ch === state.char && len >= state.len) {
    state.char = null;
    state.len = 0;
  }
}

function startsFenceDelimiter(line: string): boolean {
  const trimmed = line.trimStart();
  const first = trimmed.at(0);
  if (first !== "`" && first !== "~") return false;

  let len = 0;
  while (trimmed.at(len) === first) len++;
  return len >= 3;
}

function stripMarkdownStructuralPrefix(text: string): string {
  return text.replace(/^(?:(?:>\s*)+|[-*+]\s+|\d+[.)]\s+)/, "").trimStart();
}

function stripBlockquotePrefix(text: string): string {
  return text.trimStart().replace(/^(?:>\s*)+/, "").trimStart();
}

function isBlockquoteLine(text: string): boolean {
  return text.trimStart().startsWith(">");
}

function isSupersededByMarkerLine(text: string): boolean {
  return /^\*\*Superseded by\*\*(?:\s|$)/i.test(stripBlockquotePrefix(text));
}

function pushUnique(
  claims: SupersessionClaim[],
  seen: Set<string>,
  claim: SupersessionClaim,
): void {
  const key = `${String(claim.line)}\0${claim.target}`;
  if (seen.has(key)) return;
  seen.add(key);
  claims.push(claim);
}

function pushMatchesForLine(
  regex: RegExp,
  line: string,
  lineNumber: number,
  claims: SupersessionClaim[],
  seen: Set<string>,
): void {
  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    const matchedTarget = match[1];
    if (matchedTarget === undefined) continue;
    const target = normalizeTarget(matchedTarget);
    if (!isRepoRelativeTarget(target)) continue;
    pushUnique(claims, seen, {
      line: lineNumber,
      target,
      raw: match[0],
    });
  }
}

function logicalSearchLines(lines: string[]): SearchLine[] {
  const searchLines: SearchLine[] = [];
  const fence: FenceState = { char: null, len: 0 };
  const physicalLines: SearchLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (startsFenceDelimiter(line)) {
      updateFenceState(line, fence);
      continue;
    }
    if (fence.char !== null) {
      updateFenceState(line, fence);
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.length > 0) physicalLines.push({ line: i + 1, text: trimmed });
  }

  searchLines.push(...physicalLines);

  const wrapPrefixRe = /\bSupersedes(?:\s+ADR)?\s*$/i;
  for (let i = 0; i < physicalLines.length - 1; i++) {
    const current = physicalLines[i];
    const next = physicalLines[i + 1];
    if (current === undefined || next === undefined) continue;
    if (next.line !== current.line + 1) continue;
    if (!wrapPrefixRe.test(current.text)) continue;
    searchLines.push({ line: current.line, text: `${current.text} ${stripMarkdownStructuralPrefix(next.text)}` });
  }

  return searchLines;
}

function findSupersessionClaims(lines: string[]): SupersessionClaim[] {
  const claims: SupersessionClaim[] = [];
  const seen = new Set<string>();
  const backtickRe = /\bSupersedes(?:\s+ADR)?\s+`([^`\n]+?\.md(?:[?#][^`\n]*)?)`/gi;
  const linkRe =
    /\bSupersedes(?:\s+ADR)?\s+\[[^\]\n]+?\]\(((?:[^()\n]|\([^()\n]*\))+)\)/gi;

  for (const searchLine of logicalSearchLines(lines)) {
    pushMatchesForLine(backtickRe, searchLine.text, searchLine.line, claims, seen);
    pushMatchesForLine(linkRe, searchLine.text, searchLine.line, claims, seen);
  }

  return claims;
}

function resolveTarget(
  target: string,
  fileDir: string,
  fileParentDir: string,
  repoRoot: string,
): string | null {
  if (!isRepoRelativeTarget(target)) return null;
  const candidateRoots = [fileDir, fileParentDir, repoRoot];
  for (const root of candidateRoots) {
    const candidate = resolve(root, target);
    if (!isInsideRepo(candidate, repoRoot)) continue;
    if (statExists(candidate)) return candidate;
  }
  return null;
}

function supersededByMarkerLines(targetContent: string): string[] {
  const lines = targetContent.split("\n").slice(0, 25);
  const markerLines: string[] = [];
  const fence: FenceState = { char: null, len: 0 };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (startsFenceDelimiter(line)) {
      updateFenceState(line, fence);
      continue;
    }
    if (fence.char !== null) {
      updateFenceState(line, fence);
      continue;
    }
    if (!isSupersededByMarkerLine(line)) continue;

    const parts = [stripBlockquotePrefix(line)];
    const next = lines[i + 1] ?? "";
    if (isBlockquoteLine(line) && isBlockquoteLine(next)) {
      const continuation = stripBlockquotePrefix(next);
      if (continuation.length > 0) parts.push(continuation);
    }
    markerLines.push(parts.join(" "));
  }

  return markerLines;
}

function markerNamesSupersedingAdr(markerLines: string[], supersedingFile: string): boolean {
  const supersedingBase = basename(supersedingFile);
  const tokenRe = new RegExp(
    `(^|[^A-Za-z0-9._-])${escapeRegExp(supersedingBase)}($|[^A-Za-z0-9._-])`,
  );
  return markerLines.some((line) => tokenRe.test(line));
}

function readFile(filePath: string): { content: string; ok: true } | { ok: false } {
  try {
    return { content: readFileSync(filePath, "utf8"), ok: true };
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      console.error(`error: file not found: ${filePath}`);
    } else if (err.code === "EISDIR") {
      console.error(`error: not a regular file (directory): ${filePath}`);
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`error: read failed for ${filePath}: ${msg}`);
    }
    return { ok: false };
  }
}

function checkFile(filePath: string): CheckResult {
  const input = readFile(filePath);
  if (!input.ok) return { findings: [], ok: false };

  const lines = input.content.split("\n");
  const claims = findSupersessionClaims(lines);
  const repoRoot = findRepoRoot(filePath);
  const fileDir = isAbsolute(filePath)
    ? dirname(filePath)
    : resolve(dirname(filePath));
  const fileParentDir = dirname(fileDir);
  const findings: Finding[] = [];
  let hadTargetErrors = false;

  for (const claim of claims) {
    const resolved = resolveTarget(claim.target, fileDir, fileParentDir, repoRoot);
    if (resolved === null) continue; // existence drift belongs to check-existence.ts

    const target = readFile(resolved);
    if (!target.ok) {
      hadTargetErrors = true;
      continue;
    }

    const markerLines = supersededByMarkerLines(target.content);
    const targetDisplay = relative(repoRoot, resolved);
    if (markerLines.length === 0) {
      findings.push({
        file: filePath,
        line: claim.line,
        target: targetDisplay,
        reason: `ADR supersession claim "${claim.raw}" is not reciprocated by a top-of-file "Superseded by" marker in ${targetDisplay}`,
      });
      continue;
    }

    if (!markerNamesSupersedingAdr(markerLines, filePath)) {
      findings.push({
        file: filePath,
        line: claim.line,
        target: targetDisplay,
        reason: `ADR supersession marker in ${targetDisplay} does not name ${basename(filePath)}`,
      });
    }
  }

  return { findings, ok: !hadTargetErrors };
}

export { checkFile, findSupersessionClaims };
export type { Finding, SupersessionClaim };

export function main(): number {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      "usage: bun tools/substrate-claim-checker/check-convention.ts <file> [<file> ...]",
    );
    return 1;
  }

  let totalFindings = 0;
  let inputErrors = 0;

  for (const arg of args) {
    const { findings, ok } = checkFile(arg);
    if (!ok) inputErrors++;
    for (const f of findings) {
      console.log(
        `${f.file}:${String(f.line)}: convention drift — ${f.reason}`,
      );
      totalFindings++;
    }
  }

  if (inputErrors > 0) {
    console.error(`\n${String(inputErrors)} input error(s).`);
    return 1;
  }
  if (totalFindings > 0) {
    console.log(`\n${String(totalFindings)} convention-drift finding(s).`);
    return 1;
  }
  console.log("no convention drift detected.");
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
