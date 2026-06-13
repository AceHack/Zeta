#!/usr/bin/env bun
// validate-agencysignature-pr-body.ts — pre-merge validator for the
// AgencySignature Convention v1 trailer block in a PR description body.
//
// TypeScript+Bun port of validate-agencysignature-pr-body.sh, slice 9
// of the TS+Bun migration. See docs/best-practices/repo-scripting.md.
//
// Pairs with audit-agencysignature-main-tip.{sh,ts} (post-merge auditor)
// as the ferry-7 enforcement-instrument set ("stop designing, instrument
// enforcement").
//
// Spec source (the canonical convention):
//   docs/research/2026-04-26-gemini-deep-think-agencysignature-commit-
//   attribution-convention-validation-and-refinement.md Section 10
//
// Usage:
//   gh pr view <number> --json body --jq '.body' \
//     | bun tools/hygiene/validate-agencysignature-pr-body.ts
//
// Exit codes:
//   0 — all required trailers present and enums valid
//   1 — validation failed (specific failure printed)
//   2 — tooling / input error

import { spawnSync } from "node:child_process";

type ExitCode = 0 | 1 | 2;

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

const SPEC_DOC =
  "docs/research/2026-04-26-gemini-deep-think-agencysignature-commit-attribution-convention-validation-and-refinement.md";

const REQUIRED_KEYS: readonly string[] = [
  "Agency-Signature-Version",
  "Agent",
  "Agent-Runtime",
  "Agent-Model",
  "Credential-Identity",
  "Credential-Mode",
  "Human-Review",
  "Human-Review-Evidence",
  "Action-Mode",
  "Task",
];

const FENCE_RE = /^[\t ]*```[A-Za-z]*[\t ]*$/;
const BLANK_RE = /^[\t ]*$/;
const TASK_RE =
  /^(?:none|Otto-\d+|task-#?\d+|#?\d+|[A-Za-z][A-Za-z0-9]*-\d+)$/;

const ENUMS: readonly { readonly key: string; readonly allowed: readonly string[] }[] = [
  { key: "Agency-Signature-Version", allowed: ["1"] },
  { key: "Credential-Mode", allowed: ["shared", "dedicated-agent", "human-only", "unknown"] },
  { key: "Human-Review", allowed: ["explicit", "not-implied-by-credential", "none"] },
  { key: "Human-Review-Evidence", allowed: ["chat", "pr-review", "pr-comment", "signed-policy", "none"] },
  { key: "Action-Mode", allowed: ["autonomous-fail-open", "human-directed", "supervised"] },
];

function readStdin(): string {
  // Bun.stdin / process.stdin sync read via fd 0 + readFileSync.
  // node:fs readFileSync(0) is the canonical sync stdin read.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as typeof import("node:fs");
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function gitAvailable(): boolean {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["--version"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  return result.status === 0;
}

function stripCodeFences(input: string): string {
  return input
    .split("\n")
    .filter((line) => !FENCE_RE.test(line))
    .join("\n");
}

function parseTrailers(stripped: string): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", ["interpret-trailers", "--parse"], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
    input: stripped,
  });
  // git interpret-trailers exits 0 with empty output when no trailers found;
  // bash version uses `2>/dev/null || true` — just take the stdout.
  return result.stdout;
}

function lastNonBlankLine(text: string): string {
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i] ?? "";
    if (!BLANK_RE.test(line)) return line;
  }
  return "";
}

function findExactLineNumber(input: string, target: string): number {
  // 1-indexed line number of the LAST exact match in input. Returns 0 if not found.
  const lines = input.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i] === target) return i + 1;
  }
  return 0;
}

function findKeyPrefixLineNumber(input: string, key: string): number {
  // 1-indexed line number of the LAST line that starts (case-insensitive)
  // with `${key}:`. Returns 0 if not found.
  const prefix = `${key.toLowerCase()}:`;
  const lines = input.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i] ?? "";
    if (line.toLowerCase().startsWith(prefix)) return i + 1;
  }
  return 0;
}

function trailerLineKey(line: string): string {
  const idx = line.indexOf(":");
  if (idx <= 0) return "";
  return line.slice(0, idx);
}

function nonBlankLinesAfter(input: string, lineNum: number): readonly string[] {
  const lines = input.split("\n");
  return lines.slice(lineNum).filter((l) => !BLANK_RE.test(l));
}

function trimSpaceTab(s: string): string {
  let start = 0;
  while (start < s.length) {
    const c = s.charCodeAt(start);
    if (c !== 0x20 && c !== 0x09) break;
    start++;
  }
  let end = s.length;
  while (end > start) {
    const c = s.charCodeAt(end - 1);
    if (c !== 0x20 && c !== 0x09) break;
    end--;
  }
  return s.slice(start, end);
}

function getValue(trailers: string, key: string): string {
  const prefix = `${key.toLowerCase()}:`;
  for (const line of trailers.split("\n")) {
    if (!line.toLowerCase().startsWith(prefix)) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    return trimSpaceTab(line.slice(idx + 1));
  }
  return "";
}

function emitParseFailure(): ExitCode {
  process.stdout.write("FAIL: no parseable git trailers found in PR body\n");
  process.stdout.write(
    "  Class:  Trailer Contiguity Survival Failure\n",
  );
  process.stdout.write(
    "  Cause:  AgencySignature trailer block missing OR blank-line discipline broken\n",
  );
  process.stdout.write(
    "  Fix:    ensure the trailer block at PR body bottom has exactly ONE blank\n",
  );
  process.stdout.write(
    "          line preceding it and ZERO blank lines within it\n",
  );
  process.stdout.write(
    "  Maxim:  A governance convention is not shipped when humans can read it.\n",
  );
  process.stdout.write(
    "          It is shipped when the target substrate can parse it.\n",
  );
  process.stdout.write(
    `  Spec:   ${SPEC_DOC} Section 7.4 (canonical shape) + Section 4 (blank-line guardrail)\n`,
  );
  return 1;
}

function emitLookupFailure(): ExitCode {
  process.stdout.write(
    "FAIL: terminal-block check could not locate trailer tail in PR body\n",
  );
  process.stdout.write(
    "  Class:    Validator-Lookup Failure (fail-closed per codex P1 review on PR #24)\n",
  );
  process.stdout.write(
    "  Cause:    parsed trailer line did not match any stripped-input line\n",
  );
  process.stdout.write(
    "            via either exact-match or key-prefix-match strategy.\n",
  );
  process.stdout.write(
    "            Likely cause: parser normalized the trailer (multi-line\n",
  );
  process.stdout.write(
    "            continuation, non-ASCII whitespace, case-fold collision).\n",
  );
  process.stdout.write(
    "  Fix:      simplify PR-body trailer block (single-line trailers,\n",
  );
  process.stdout.write(
    "            literal Key: value, ASCII whitespace) OR extend this\n",
  );
  process.stdout.write(
    "            validator's lookup-fallback chain. Do NOT silently skip.\n",
  );
  return 1;
}

function emitNonTrailerAfterFailure(after: readonly string[]): ExitCode {
  process.stdout.write(
    "FAIL: non-trailer content found after the trailer block in PR body\n",
  );
  process.stdout.write(
    "  Class:    Trailer Contiguity Survival Failure (Substrate Truth Principle invariant)\n",
  );
  process.stdout.write(
    "  Cause:    text after the trailer block can push trailers out of the\n",
  );
  process.stdout.write(
    "            terminal-block position when GitHub squash-merge inherits\n",
  );
  process.stdout.write(
    "            the PR description as the squash commit body\n",
  );
  process.stdout.write(
    "  Fix:      move the trailer block to the very END of the PR body;\n",
  );
  process.stdout.write(
    "            no non-trailer non-whitespace content may follow it\n",
  );
  process.stdout.write("  Found after trailer block:\n");
  for (const line of after.slice(0, 5)) process.stdout.write(`    ${line}\n`);
  process.stdout.write("  Principle: Substrate Truth Principle\n");
  process.stdout.write(
    "             A governance convention has not shipped until the parser\n",
  );
  process.stdout.write(
    "             extracts the expected trailers as a contiguous terminal block.\n",
  );
  process.stdout.write(`  Spec:      ${SPEC_DOC} Section 7.5 (Squash-Merge Invariant)\n`);
  return 1;
}

function emitMissingKeys(missing: readonly string[]): ExitCode {
  process.stdout.write(
    `FAIL: missing required AgencySignature v1 trailer keys: ${missing.join(" ")}\n`,
  );
  process.stdout.write(
    "  Class:    Trailer Contiguity Survival Failure — likely cause\n",
  );
  process.stdout.write(
    "            when keys appear textually but blank-line breaks parsing\n",
  );
  process.stdout.write(
    "  Cause:    PR body trailer block is incomplete OR a blank line splits the\n",
  );
  process.stdout.write(
    "            block such that only the final contiguous group parses\n",
  );
  process.stdout.write(
    "  Fix:      add the missing trailers at the PR body bottom OR remove the\n",
  );
  process.stdout.write(
    "            blank line that splits the contiguous block\n",
  );
  process.stdout.write(
    "  Principle: Substrate Truth Principle — text presence is\n",
  );
  process.stdout.write(
    "             insufficient; the parser is the witness\n",
  );
  process.stdout.write(`  Spec:     ${SPEC_DOC} Section 7.4 (canonical 10-trailer block)\n`);
  return 1;
}

function emitEnumFailure(key: string, found: string, allowed: readonly string[]): ExitCode {
  process.stdout.write(`FAIL: invalid enum value for ${key}\n`);
  process.stdout.write(`  Found:    '${found}'\n`);
  process.stdout.write(`  Expected: one of: ${allowed.join(", ")}\n`);
  process.stdout.write(`  Spec:     ${SPEC_DOC} Section 7.6 (allowed enum values)\n`);
  return 1;
}

function checkTerminalBlock(stripped: string, trailers: string): ExitCode | null {
  const lastTrailer = lastNonBlankLine(trailers);
  if (lastTrailer === "") return null;

  let tailLine = findExactLineNumber(stripped, lastTrailer);
  if (tailLine === 0) {
    const key = trailerLineKey(lastTrailer);
    if (key !== "") tailLine = findKeyPrefixLineNumber(stripped, key);
  }
  if (tailLine === 0) return emitLookupFailure();

  const after = nonBlankLinesAfter(stripped, tailLine);
  if (after.length > 0) return emitNonTrailerAfterFailure(after);
  return null;
}

function checkRequiredKeys(trailers: string): ExitCode | null {
  const missing: string[] = [];
  for (const key of REQUIRED_KEYS) {
    const prefix = `${key.toLowerCase()}:`;
    const found = trailers
      .split("\n")
      .some((l) => l.toLowerCase().startsWith(prefix));
    if (!found) missing.push(key);
  }
  if (missing.length === 0) return null;
  return emitMissingKeys(missing);
}

function checkEnums(trailers: string): ExitCode | null {
  for (const { key, allowed } of ENUMS) {
    const value = getValue(trailers, key);
    if (!allowed.includes(value)) return emitEnumFailure(key, value, allowed);
  }
  return null;
}

function checkTaskPattern(trailers: string): ExitCode | null {
  const value = getValue(trailers, "Task");
  if (TASK_RE.test(value)) return null;
  process.stdout.write("FAIL: invalid Task value\n");
  process.stdout.write(`  Found:    '${value}'\n`);
  process.stdout.write(
    "  Expected: a ticket-id (e.g. Otto-NN, task-#NNN, #NNN, FOO-NN)\n",
  );
  process.stdout.write("            or the literal 'none' fallback\n");
  process.stdout.write(`  Spec:     ${SPEC_DOC} Section 9.2 (Task: none fallback)\n`);
  return 1;
}

function checkHumanReviewConsistency(trailers: string): ExitCode | null {
  const hr = getValue(trailers, "Human-Review");
  const hre = getValue(trailers, "Human-Review-Evidence");
  if (hr !== "explicit" && hre !== "none") {
    process.stdout.write(
      "FAIL: Human-Review-Evidence must be 'none' when Human-Review is not 'explicit'\n",
    );
    process.stdout.write(`  Human-Review:          '${hr}'\n`);
    process.stdout.write(`  Human-Review-Evidence: '${hre}'\n`);
    process.stdout.write(`  Spec:                  ${SPEC_DOC} Section 5.3 / 7.6\n`);
    process.stdout.write(
      "  Reason: the evidence pointer attaches to actual review claims;\n",
    );
    process.stdout.write(
      "          a non-explicit review state has no evidence to point at\n",
    );
    return 1;
  }
  if (hr === "explicit" && hre === "none") {
    process.stdout.write(
      "FAIL: Human-Review: explicit requires Human-Review-Evidence != 'none'\n",
    );
    process.stdout.write(
      "  Reason: an explicit review claim must cite where the evidence lives\n",
    );
    process.stdout.write(
      "  Fix:    set Human-Review-Evidence to chat | pr-review | pr-comment | signed-policy\n",
    );
    process.stdout.write(
      `  Spec:   ${SPEC_DOC} Section 5.3 (closes the 'explicit according to whom' gap)\n`,
    );
    return 1;
  }
  return null;
}

function emitPass(trailers: string): ExitCode {
  process.stdout.write("PASS: AgencySignature v1 trailer block valid\n");
  process.stdout.write(
    `  Agency-Signature-Version: ${getValue(trailers, "Agency-Signature-Version")}\n`,
  );
  process.stdout.write(`  Agent:                    ${getValue(trailers, "Agent")}\n`);
  process.stdout.write(
    `  Agent-Runtime:            ${getValue(trailers, "Agent-Runtime")}\n`,
  );
  process.stdout.write(
    `  Agent-Model:              ${getValue(trailers, "Agent-Model")}\n`,
  );
  process.stdout.write(
    `  Credential-Identity:      ${getValue(trailers, "Credential-Identity")}\n`,
  );
  process.stdout.write(
    `  Credential-Mode:          ${getValue(trailers, "Credential-Mode")}\n`,
  );
  process.stdout.write(
    `  Human-Review:             ${getValue(trailers, "Human-Review")}\n`,
  );
  process.stdout.write(
    `  Human-Review-Evidence:    ${getValue(trailers, "Human-Review-Evidence")}\n`,
  );
  process.stdout.write(
    `  Action-Mode:              ${getValue(trailers, "Action-Mode")}\n`,
  );
  process.stdout.write(`  Task:                     ${getValue(trailers, "Task")}\n`);
  return 0;
}

export function main(): ExitCode {
  if (!gitAvailable()) {
    process.stderr.write("error: git not found on PATH\n");
    return 2;
  }
  const input = readStdin();
  if (input === "") {
    process.stderr.write("error: no input on stdin\n");
    process.stderr.write(
      "usage: gh pr view N --json body --jq '.body' | bun tools/hygiene/validate-agencysignature-pr-body.ts\n",
    );
    return 2;
  }
  const stripped = stripCodeFences(input);
  const trailers = parseTrailers(stripped);
  if (trailers === "") return emitParseFailure();

  const terminalCheck = checkTerminalBlock(stripped, trailers);
  if (terminalCheck !== null) return terminalCheck;

  const requiredCheck = checkRequiredKeys(trailers);
  if (requiredCheck !== null) return requiredCheck;

  const enumCheck = checkEnums(trailers);
  if (enumCheck !== null) return enumCheck;

  const taskCheck = checkTaskPattern(trailers);
  if (taskCheck !== null) return taskCheck;

  const consistencyCheck = checkHumanReviewConsistency(trailers);
  if (consistencyCheck !== null) return consistencyCheck;

  return emitPass(trailers);
}

if (import.meta.main) {
  process.exit(main());
}
