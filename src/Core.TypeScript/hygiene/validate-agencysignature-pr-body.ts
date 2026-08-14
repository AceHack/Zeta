#!/usr/bin/env bun
// validate-agencysignature-pr-body.ts — pre-merge validator for the
// AgencySignature Convention v1|v2 trailer block in a PR description body.
//
// v2 (ADR docs/DECISIONS/2026-07-03-persona-cell-identity-unification.md phase 4;
// treaty docs/research/2026-07-03-persona-cell-identity-treaty-*.md Article 1):
// adds required `Cell:` trailer (canonical cell projection
// `<surface>[/<instance>][@<node>]`) + optional `Persona:` alias of `Agent`.
// Cell is validated through the ONE parser (identity/actor-ref.ts) by
// reconstructing the canonical `<persona>/<cell>` projection — this file
// never hand-parses persona-cell strings. Dual-accept: v1 stays valid
// until phase-8 contract; the auditor reports version share.
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
import { parse as parseActorRef } from "../identity/actor-ref.ts";

type ExitCode = 0 | 1 | 2;

const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

const SPEC_DOC =
  "docs/research/2026-04-26-gemini-deep-think-agencysignature-commit-attribution-convention-validation-and-refinement.md";
const ADR_DOC =
  "docs/DECISIONS/2026-07-03-persona-cell-identity-unification.md";

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
  { key: "Agency-Signature-Version", allowed: ["1", "2"] },
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

// An UNFILLED TEMPLATE PLACEHOLDER, e.g. `Agent: <persona>`. The PR template
// ships the trailer block pre-populated so the block survives squash-merge —
// which means the easy failure is now shipping the SKELETON. A block that
// validates while saying `Agent: <persona>` is attribution to nobody: the
// enforcement passes and the provenance is still absent, which is the same
// silent-green shape as the audit that exempted the whole fleet (#10564).
const PLACEHOLDER_RE = /^<.*>$/;

/** True when a required trailer's value is still an unfilled `<...>` placeholder. */
export function isUnfilledPlaceholder(value: string): boolean {
  return PLACEHOLDER_RE.test(value.trim());
}

function checkPlaceholders(trailers: string): ExitCode | null {
  const unfilled = REQUIRED_KEYS.filter((key) =>
    isUnfilledPlaceholder(getValue(trailers, key)),
  );
  if (unfilled.length === 0) return null;
  process.stdout.write(
    `FAIL: AgencySignature trailer values are still template placeholders: ${unfilled.join(" ")}\n`,
  );
  for (const key of unfilled) {
    process.stdout.write(`  ${key}: ${getValue(trailers, key)}\n`);
  }
  process.stdout.write(
    "  Cause:  the block was copied from .github/PULL_REQUEST_TEMPLATE.md and\n",
  );
  process.stdout.write(
    "          not filled in. A block that validates while saying `Agent: <persona>`\n",
  );
  process.stdout.write(
    "          is attribution to nobody — the check passes, the provenance is\n",
  );
  process.stdout.write("          still missing.\n");
  process.stdout.write(
    "  Fix:    replace every `<...>` with the real persona / runtime / model /\n",
  );
  process.stdout.write("          credential identity.\n");
  return 1;
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

// `Agency-Signature-Version` is the canonical key (REQUIRED_KEYS above, the
// spec doc, the post-merge auditor, the four cadence workflows that echo it).
// `Agent-Signature-Version` is a hand-composition slip that reached main three
// times on 2026-08-13/14 — and because the post-merge auditor used to exempt
// anything it did not recognise, such a commit was unsigned AND exempt at once.
// Say the misspelling out loud here so the pre-merge side names it too.
const MISSPELLED_VERSION_KEY = "Agent-Signature-Version";
const CANONICAL_VERSION_KEY = "Agency-Signature-Version";
const MISSPELLED_VERSION_RE = /^Agent-Signature-Version:\s*\d/im;

/** True when the PR body carries the misspelled version key. */
export function hasMisspelledVersionKey(body: string): boolean {
  return MISSPELLED_VERSION_RE.test(body);
}

function emitMissingKeys(missing: readonly string[], body = ""): ExitCode {
  process.stdout.write(
    `FAIL: missing required AgencySignature v1 trailer keys: ${missing.join(" ")}\n`,
  );
  if (missing.includes(CANONICAL_VERSION_KEY) && hasMisspelledVersionKey(body)) {
    process.stdout.write(
      `  WRONG KEY: the body carries '${MISSPELLED_VERSION_KEY}'. The canonical key is\n`,
    );
    process.stdout.write(
      `             '${CANONICAL_VERSION_KEY}' — Agency, not Agent. Every consumer\n`,
    );
    process.stdout.write(
      "             (this validator, the post-merge auditor, the cadence workflows)\n",
    );
    process.stdout.write("             reads the canonical spelling only.\n");
  }
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

function checkRequiredKeys(trailers: string, body = ""): ExitCode | null {
  const missing: string[] = [];
  for (const key of REQUIRED_KEYS) {
    const prefix = `${key.toLowerCase()}:`;
    const found = trailers
      .split("\n")
      .some((l) => l.toLowerCase().startsWith(prefix));
    if (!found) missing.push(key);
  }
  if (missing.length === 0) return null;
  return emitMissingKeys(missing, body);
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


const V2_REQUIRED_EXTRA: readonly string[] = ["Cell"];

function checkV2(trailers: string): ExitCode | null {
  const version = getValue(trailers, "Agency-Signature-Version");
  if (version !== "2") return null; // v1: Cell/Persona ignored (forward-compat)

  const missing = V2_REQUIRED_EXTRA.filter((key) => {
    const prefix = `${key.toLowerCase()}:`;
    return !trailers.split("\n").some((l) => l.toLowerCase().startsWith(prefix));
  });
  if (missing.length > 0) {
    process.stdout.write(`FAIL: missing required AgencySignature v2 trailer keys: ${missing.join(" ")}\n`);
    process.stdout.write("  Cause:  Agency-Signature-Version: 2 requires the Cell trailer\n");
    process.stdout.write("  Fix:    add `Cell: <surface>[/<instance>][@<node>]` (e.g. Cell: cowork/main@machine-a)\n");
    process.stdout.write(`  Spec:   ${ADR_DOC} phase 4\n`);
    return 1;
  }

  const agent = getValue(trailers, "Agent");
  const persona = getValue(trailers, "Persona");
  if (persona !== "" && persona !== agent) {
    process.stdout.write("FAIL: Persona trailer must equal Agent when both are present\n");
    process.stdout.write(`  Agent:   '${agent}'\n`);
    process.stdout.write(`  Persona: '${persona}'\n`);
    process.stdout.write("  Reason:  Persona is v2's explicit alias of v1's Agent key — one identity, two spellings\n");
    process.stdout.write(`  Spec:    ${ADR_DOC} phase 4\n`);
    return 1;
  }

  const cell = getValue(trailers, "Cell");
  try {
    // THE one parser (treaty Article 1): validate by reconstructing the
    // canonical projection `<persona>/<cell>`. No local string surgery.
    parseActorRef(`${agent}/${cell}`);
  } catch (err) {
    process.stdout.write("FAIL: invalid Agent/Cell pair for AgencySignature v2\n");
    process.stdout.write(`  Agent:  '${agent}' (must be a bare lowercase PersonaId from registry/personas.yaml)\n`);
    process.stdout.write(`  Cell:   '${cell}' (canonical cell projection: <surface>[/<instance>][@<node>])\n`);
    process.stdout.write(`  Parser: ${err instanceof Error ? err.message : String(err)}\n`);
    process.stdout.write("  Law:    treaty Article 1 — projections are produced/parsed by exactly one module\n");
    process.stdout.write(`  Spec:   ${ADR_DOC} phase 4\n`);
    return 1;
  }
  return null;
}

function emitPass(trailers: string): ExitCode {
  const version = getValue(trailers, "Agency-Signature-Version");
  process.stdout.write(`PASS: AgencySignature v${version} trailer block valid\n`);
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
  if (getValue(trailers, "Agency-Signature-Version") === "2") {
    const persona = getValue(trailers, "Persona");
    if (persona !== "") process.stdout.write(`  Persona:                  ${persona}\n`);
    process.stdout.write(`  Cell:                     ${getValue(trailers, "Cell")}\n`);
  }
  return 0;
}

/**
 * The grandfather decision, as a pure function so it can be falsified.
 *
 * It exists because MEASURED on 2026-08-14, 0 of 12 open PRs carried a valid
 * trailer block: turning a blocking validator on retroactively would red-X the
 * whole in-flight fleet for something they could not have known. So PRs created
 * before the stated cutover are exempt, and every PR from the cutover onward is
 * not. Deliberately NOT living in the CI yaml — untested yaml is how a check
 * that cannot fail gets written, which is the entire subject of this work.
 *
 * Fails CLOSED on an unparseable date: an unreadable timestamp must not buy an
 * exemption.
 */
export function isGrandfatheredPr(createdAt: string, cutover: string): boolean {
  const created = Date.parse(createdAt);
  const cut = Date.parse(cutover);
  if (Number.isNaN(created) || Number.isNaN(cut)) return false;
  return created < cut;
}

interface ValidatorOptions {
  readonly createdAt: string;
  readonly cutover: string;
}

function parseOptions(argv: readonly string[]): ValidatorOptions | null {
  let createdAt = "";
  let cutover = "";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    const next = argv[i + 1];
    if (arg === "--pr-created-at") {
      if (next === undefined) return null;
      createdAt = next;
      i++;
    } else if (arg === "--grandfather-cutover") {
      if (next === undefined) return null;
      cutover = next;
      i++;
    } else {
      return null;
    }
  }
  return { createdAt, cutover };
}

export function main(argv: readonly string[] = []): ExitCode {
  if (!gitAvailable()) {
    process.stderr.write("error: git not found on PATH\n");
    return 2;
  }
  const options = parseOptions(argv);
  if (options === null) {
    process.stderr.write(
      "usage: ... | validate-agencysignature-pr-body.ts [--pr-created-at ISO] [--grandfather-cutover ISO]\n",
    );
    return 2;
  }
  if (
    options.createdAt !== "" &&
    options.cutover !== "" &&
    isGrandfatheredPr(options.createdAt, options.cutover)
  ) {
    process.stdout.write(
      `GRANDFATHERED: PR created ${options.createdAt}, before the stated cutover ${options.cutover}.\n`,
    );
    process.stdout.write(
      "  The trailer block is not required on PRs opened before the cutover.\n",
    );
    process.stdout.write(
      "  Measured 2026-08-14: 0 of 12 open PRs carried one, so a retroactive\n",
    );
    process.stdout.write(
      "  block would have red-X'd the whole in-flight fleet. Every PR opened\n",
    );
    process.stdout.write("  from the cutover onward IS checked.\n");
    return 0;
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

  const requiredCheck = checkRequiredKeys(trailers, stripped);
  if (requiredCheck !== null) return requiredCheck;

  const placeholderCheck = checkPlaceholders(trailers);
  if (placeholderCheck !== null) return placeholderCheck;

  const enumCheck = checkEnums(trailers);
  if (enumCheck !== null) return enumCheck;

  const v2Check = checkV2(trailers);
  if (v2Check !== null) return v2Check;

  const taskCheck = checkTaskPattern(trailers);
  if (taskCheck !== null) return taskCheck;

  const consistencyCheck = checkHumanReviewConsistency(trailers);
  if (consistencyCheck !== null) return consistencyCheck;

  return emitPass(trailers);
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
