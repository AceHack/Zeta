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
//     | bun src/Core.TypeScript/hygiene/validate-agencysignature-pr-body.ts \
//         [--pr-created-at ISO] [--grandfather-cutover ISO] [--author-identity ID]
//
// Exit codes:
//   0 — all required trailers present and enums valid, OR the author is a
//       rostered external actor carrying a repo-asserted attribution
//   1 — validation failed (specific failure printed)
//   2 — tooling / input error
//
// SOVEREIGN-MODE SEAM (Aaron 2026-08-15: "we want all their checks to be able to
// run anywhere on our git-native / ZetaDB-native stuff … GitHub's dependabot is
// temporary"). Nothing GitHub-shaped lives below this comment. The decision this
// file makes is: GIVEN A PROPOSAL BODY AND AN AUTHOR IDENTITY, is the attribution
// present or excused? Both inputs are plain strings — the body on stdin, the
// author via --author-identity — so the GitHub plumbing (`github.event.
// pull_request.user.login`, the Actions yaml) stays at the edge in
// .github/workflows/agencysignature-enforcement.yml, and a ZetaDB-native
// proposal lane calls the same binary with the same two strings. No portability
// framework was built for this; the seam already existed and the author identity
// just had to stop being implicit.

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
/**
 * What may name the work a commit belongs to.
 *
 * WIDENED 2026-08-14, from measurement rather than taste. The previous pattern was
 * `^(?:none|Otto-\d+|task-#?\d+|#?\d+|[A-Za-z][A-Za-z0-9]*-\d+)$` — ticket-shaped ids only,
 * written before this repo retired sequential `B-NNNN` ids for ZetaIds. Counted over every
 * `Task:` value in the last 300 commits on `main` (363 values):
 *
 *   143  passed the old pattern
 *    12  were bare ZetaIds — the repo's OWN canonical work-item key, which the pattern could
 *        not express at all (26 chars, Crockford base32, digit-initial, no dash)
 *   208  were slugs naming the work, or a ZetaId joined to one
 *
 * So it rejected 57% of established practice, including the id format
 * `.claude/rules/workitems-mint-with-zetaid.md` mandates. Wired to CI unchanged (#10594) it
 * would have reddened the majority of correct commits at the cutover — and a gate that fires
 * mostly on correct work gets switched off, which is strictly worse than no gate, because a
 * disabled check still occupies the slot where a real one would go.
 *
 * The field's job is to NAME the work, so a slug always was a legitimate name; shape was
 * never the property worth enforcing. What must stay caught is the UNFILLED TEMPLATE, and
 * that is now `PLACEHOLDER_TASK_RE` below — so widening the shape does not widen the escape.
 *
 * The dashed alternative is case-INSENSITIVE deliberately: the commonest real form is a
 * ZetaId joined to a slug (`081KZZYWBN2087G0R003NAQQAF-exact-cyclotomic-amplitude-carrier`,
 * and the reverse order too), and a lowercase-only slug rule rejected all 23 of those.
 */
const ZETA_ID = "[0-9][0-9A-HJKMNP-TV-Z]{25}";
const TASK_RE = new RegExp(
  `^(?:none|${ZETA_ID}|task-#?\\d+|#?\\d+|[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)$`,
);

/**
 * The unfilled template, which must stay rejected however the shape widens.
 *
 * Complements `PLACEHOLDER_RE` below rather than duplicating it: that one catches the
 * angle-bracket skeleton `<task>` across every required key, while these are the words a
 * human or agent types when they have not decided yet — `TODO`, `tbd`, `task` — none of
 * which contain angle brackets and all of which would satisfy the widened shape.
 */
const PLACEHOLDER_TASK_RE = /^(?:<[^>]*>|todo|tbd|xxx+|task|placeholder|fixme|n\/a|-+)$/i;

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

/**
 * `--no-divider` is LOAD-BEARING. Read this before removing it.
 *
 * `git interpret-trailers` reads stdin as a commit message with a PATCH POSSIBLY
 * APPENDED (that is what it is for — `git commit --verbose` templates). So by
 * default it treats a line that is `---`, or begins `--- `, as the diff boundary
 * and DISCARDS EVERYTHING AFTER IT. A PR body is not a commit message with a
 * patch appended, so here that rule is pure artifact: one ordinary markdown
 * horizontal rule anywhere above the block made a perfectly well-formed trailer
 * block invisible, and this validator then blamed blank-line discipline —
 * pointing a hundred lines away from the actual cause. Nobody diagnoses that.
 *
 * MEASURED 2026-08-15 across the open PR set: nine bodies carried a bare `---`,
 * including all five dependabot PRs (it is in their template footer). Confirmed
 * at the shell — `printf 'B\n\n---\n\nAgency-Signature-Version: 1\n' |
 * git interpret-trailers --parse` prints nothing; adding `--no-divider` prints
 * the block.
 *
 * AND IT IS THE RIGHT FIX RATHER THAN A LOOSENING, because of PARITY with the
 * post-merge side — which was measured, not assumed. In a scratch repo the same
 * day, a commit whose message contains a bare `---` above the block still yields
 * the whole block from `git log -1 --pretty='%(trailers)'`: git does NOT apply
 * the divider rule to a stored commit message, only to interpret-trailers'
 * stdin. So the strict behaviour was the pre-merge gate predicting a post-merge
 * failure that does not occur — rejecting bodies whose trailers the auditor
 * reads without complaint. `--no-divider` makes the paired instruments agree,
 * which is the only property this gate has to offer.
 *
 * Requires git >= 2.24 (when the flag landed). An older git exits non-zero,
 * which the status check below reports as a TOOLING error (exit 2) instead of
 * silently reading as "this PR body has no trailers".
 */
const TRAILER_PARSE_ARGS: readonly string[] = [
  "interpret-trailers",
  "--no-divider",
  "--parse",
];

type TrailerParse =
  | { readonly ok: true; readonly trailers: string }
  | { readonly ok: false; readonly stderr: string };

function parseTrailers(stripped: string): TrailerParse {
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const result = spawnSync("git", [...TRAILER_PARSE_ARGS], {
    encoding: "utf8",
    maxBuffer: SPAWN_MAX_BUFFER,
    input: stripped,
  });
  // git interpret-trailers exits 0 with EMPTY OUTPUT when it finds no trailers.
  // A NON-zero status is a categorically different event — unsupported flag,
  // missing git, spawn failure — and the old code, which took `result.stdout`
  // unconditionally, reported a broken tool as a broken PR body.
  if (result.status !== 0) {
    return { ok: false, stderr: (result.stderr ?? "").trim() };
  }
  return { ok: true, trailers: result.stdout };
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

/** The last contiguous run of non-blank lines — the paragraph git reads trailers from. */
export function finalParagraph(text: string): readonly string[] {
  const lines = text.split("\n");
  let end = lines.length;
  while (end > 0 && BLANK_RE.test(lines[end - 1] ?? "")) end--;
  let start = end;
  while (start > 0 && !BLANK_RE.test(lines[start - 1] ?? "")) start--;
  return lines.slice(start, end);
}

export interface ParseFailureDiagnosis {
  /** `absent` — no version key anywhere. `unreadable` — the key is there and still did not parse. */
  readonly cause: "absent" | "unreadable";
  /** 1-indexed line of the version key, 0 when absent. */
  readonly keyLine: number;
  /** What git actually looked at. */
  readonly finalParagraph: readonly string[];
}

/**
 * Name the REAL cause of a parse failure instead of guessing one.
 *
 * The previous message asserted "trailer block missing OR blank-line discipline
 * broken" unconditionally — a fixed sentence that was wrong at least as often as
 * it was right, and (before `--no-divider`) was wrong in the single commonest
 * case, where the block was flawless and a `---` a hundred lines up had eaten it.
 * A diagnosis nobody can act on is a failure the author works around rather than
 * fixes.
 *
 * Pure, so it has falsifiers; it does not guess beyond what it can see, which is
 * why the two cases are `absent` and `unreadable` rather than a list of hunches.
 */
export function diagnoseParseFailure(stripped: string): ParseFailureDiagnosis {
  const lines = stripped.split("\n");
  const needle = `${CANONICAL_VERSION_KEY.toLowerCase()}:`;
  let keyLine = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if ((lines[i] ?? "").trim().toLowerCase().startsWith(needle)) {
      keyLine = i + 1;
      break;
    }
  }
  return {
    cause: keyLine === 0 ? "absent" : "unreadable",
    keyLine,
    finalParagraph: finalParagraph(stripped),
  };
}

function emitParseFailure(stripped: string): ExitCode {
  const d = diagnoseParseFailure(stripped);
  process.stdout.write("FAIL: no parseable git trailers found in PR body\n");
  process.stdout.write("  Class:  Trailer Contiguity Survival Failure\n");
  if (d.cause === "absent") {
    process.stdout.write(
      `  Cause:  the body carries no '${CANONICAL_VERSION_KEY}:' line at all — the\n`,
    );
    process.stdout.write(
      "          AgencySignature block was never added. This is not a formatting\n",
    );
    process.stdout.write("          problem; the attribution is simply absent.\n");
    process.stdout.write(
      "  Fix:    append the 10-trailer block (see .github/PULL_REQUEST_TEMPLATE.md)\n",
    );
    process.stdout.write("          at the very bottom of the PR body.\n");
  } else {
    process.stdout.write(
      `  Cause:  '${CANONICAL_VERSION_KEY}:' IS present, at line ${String(d.keyLine)} of the\n`,
    );
    process.stdout.write(
      "          body — so this is a PLACEMENT problem, not a missing block. git\n",
    );
    process.stdout.write(
      "          reads trailers only from the FINAL paragraph, and the final\n",
    );
    process.stdout.write("          paragraph of this body is:\n");
    for (const line of d.finalParagraph.slice(0, 5)) {
      process.stdout.write(`            | ${line}\n`);
    }
    if (d.finalParagraph.length > 5) {
      process.stdout.write(
        `            | ... (${String(d.finalParagraph.length - 5)} more line(s))\n`,
      );
    }
    process.stdout.write(
      "  Fix:    move the block so it IS the final paragraph — one blank line\n",
    );
    process.stdout.write(
      "          before it, zero blank lines inside it, nothing after it.\n",
    );
    process.stdout.write(
      "  Note:   a markdown `---` rule above the block is NOT a cause any more.\n",
    );
    process.stdout.write(
      "          This validator passes --no-divider; see TRAILER_PARSE_ARGS.\n",
    );
  }
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

function emitToolingParseFailure(stderr: string): ExitCode {
  process.stderr.write("error: `git interpret-trailers` failed\n");
  process.stderr.write(`  git said: ${stderr === "" ? "(nothing)" : stderr}\n`);
  process.stderr.write(
    "  This validator passes --no-divider, which requires git >= 2.24.\n",
  );
  process.stderr.write(
    "  Reported as a TOOLING error, never as a PR-body failure: a check that\n",
  );
  process.stderr.write(
    "  could not run must not be reported as one that ran and found nothing.\n",
  );
  return 2;
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
  // Placeholder first, and independently of shape: `task` and `todo` both satisfy the widened
  // pattern, and an unfilled template passing validation is the exact defect this validator
  // exists to catch — attribution to nobody, wearing a green check.
  if (PLACEHOLDER_TASK_RE.test(value)) {
    process.stdout.write("FAIL: Task is an unfilled placeholder\n");
    process.stdout.write(`  Found:    '${value}'\n`);
    process.stdout.write("  Expected: the work this commit belongs to, or the literal 'none'\n");
    process.stdout.write(`  Spec:     ${SPEC_DOC} Section 9.2 (Task: none fallback)\n`);
    return 1;
  }
  if (TASK_RE.test(value)) return null;
  process.stdout.write("FAIL: invalid Task value\n");
  process.stdout.write(`  Found:    '${value}'\n`);
  process.stdout.write(
    "  Expected: a ZetaId work-item key (26 chars, e.g. 081M0085XQT087G0R003W4KFS4),\n",
  );
  process.stdout.write("            a slug naming the work (e.g. fix-merge-duty-ordering),\n");
  process.stdout.write("            a ticket-id (Otto-NN, task-#NNN, #NNN, FOO-NN),\n");
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

// ---------------------------------------------------------------------------
// External actors: a record the repo keeps ABOUT an actor, never a trailer
// forged to look like one FROM it.
// ---------------------------------------------------------------------------
//
// THE PROBLEM. Some proposal authors structurally cannot comply. There are two
// classes and they want OPPOSITE remedies, so the first job is to separate them:
//
//   OUR OWN AUTOMATION opens PRs with no trailer because we never taught it to.
//   That is a bug in the workflow, and the fix is to make the workflow SIGN —
//   its self-attestation is real, we run it. Fixed for pr-archive-on-merge.yml
//   in #10764 and for merge-heartbeats-to-main.ts in this change. Surveyed
//   2026-08-15 (`grep -rl 'pr create|create-pull-request|pulls.create'
//   .github/workflows/`): those are the only two PR-opening lanes we own.
//
//   THIRD-PARTY BOTS cannot be fixed that way. dependabot is GitHub's service;
//   we cannot change a byte of what it writes.
//
// WHY NOT SYNTHESISE A TRAILER FOR THEM. Because a trailer is a SELF-attestation
// — "I am this agent, this model, under this credential, with this much human
// review" — and writing one that claims to come FROM dependabot is forging an
// attestation inside an attestation convention. It would make every trailer in
// the repo mean less, which is the entire asset. `.claude/rules/no-directives.md`
// draws the same line for authority: anyone may attach a SOURCE, only the
// principal may attach the thing that carries blame.
//
// WHAT IS DONE INSTEAD, and why it is more truthful than a bare skip. Three
// options were on the table:
//
//   1. NAMED EXEMPTION — roster of actors the gate skips. Honest and simple; the
//      cost is that an exemption list is a place things hide: a row costs one
//      line, says nothing, and nothing downstream can tell an exempt PR from an
//      unattributed one.
//   2. REPO-ASSERTED ATTRIBUTION — the roster row carries the actor's KNOWN
//      agency profile, and the gate prints it, marked unambiguously as asserted
//      BY THE REPO. Coverage is preserved: every proposal has an attribution,
//      some self-asserted, some repo-asserted, and which is which is never in
//      doubt because the repo-asserted ones never appear as trailers.
//   3. Have a workflow EDIT the third party's PR body to add a block. Rejected:
//      that is option-1 dishonesty with extra steps — the block would land in
//      the squash commit indistinguishable from a self-attestation. It is the
//      forgery, merely committed by a robot.
//
// Chosen: 2. The differences from 1 that pay for it: adding an actor COSTS you
// stating its profile and the evidence for it (`profileEvidence`), the profile
// is diffable text in git so the row is attributable to whoever merged it, and
// the gate output says what it knows rather than only that it declined to look.
//
// WHAT IT DOES NOT DO, stated so nobody mistakes the scope: this is the
// PRE-merge instrument. The post-merge auditor is untouched, and a merged
// dependabot commit will classify UNSIGNED there. That is deliberate — measured
// 2026-08-15, zero dependabot commits exist in the last 800 on `main`, so what
// identity such a commit carries after squash-merge is unmeasured, and a roster
// row written from a guess is exactly the kind of exemption this file's own note
// warns about. A loud false regression on the first one is the correct outcome.

const ROSTER_FILENAME = "agency-signature-identity-roster.json";

export interface RepoAssertedActor {
  readonly actor: string;
  readonly name: string;
  readonly why: string;
  readonly repoAssertedProfile: Readonly<Record<string, string>>;
  readonly profileEvidence: string;
}

/**
 * Parse the `externalActors` section of the shared identity roster.
 *
 * STRICT, and throws rather than degrading: a roster that cannot be read is a
 * tooling error, never an empty roster. Note the asymmetry that makes this safe
 * — an empty external-actor list exempts NOBODY, so the failure direction of a
 * missing/mangled section is more enforcement, not less. `externalActors` is
 * OPTIONAL for that reason (absent ⇒ empty ⇒ everyone must sign), while a
 * present-but-malformed section throws, because that is somebody's edit going
 * wrong and it must be loud.
 */
export function parseExternalActors(json: string): readonly RepoAssertedActor[] {
  const raw = JSON.parse(json) as { externalActors?: unknown };
  if (raw.externalActors === undefined) return [];
  if (!Array.isArray(raw.externalActors)) {
    throw new TypeError(`${ROSTER_FILENAME}: 'externalActors' must be an array`);
  }
  return raw.externalActors.map((row: unknown, i: number) => {
    const r = row as Partial<RepoAssertedActor>;
    for (const field of ["actor", "name", "why", "profileEvidence"] as const) {
      if (typeof r[field] !== "string" || r[field].trim() === "") {
        throw new TypeError(
          `${ROSTER_FILENAME}: externalActors[${String(i)}] needs a non-empty '${field}'`,
        );
      }
    }
    const profile = r.repoAssertedProfile;
    if (typeof profile !== "object" || profile === null) {
      throw new TypeError(
        `${ROSTER_FILENAME}: externalActors[${String(i)}] needs a 'repoAssertedProfile' object`,
      );
    }
    // The profile stands in for a trailer block, so it must carry the same ten
    // fields. A row that omits half of them would buy an exemption while
    // asserting nothing — option 1 wearing option 2's clothes.
    const missing = REQUIRED_KEYS.filter(
      (k) => k !== CANONICAL_VERSION_KEY && typeof profile[k] !== "string",
    );
    if (missing.length > 0) {
      throw new TypeError(
        `${ROSTER_FILENAME}: externalActors[${String(i)}].repoAssertedProfile is missing ${missing.join(" ")}`,
      );
    }
    return {
      actor: r.actor as string,
      name: r.name as string,
      why: r.why as string,
      repoAssertedProfile: profile as Readonly<Record<string, string>>,
      profileEvidence: r.profileEvidence as string,
    };
  });
}

function loadExternalActors(): readonly RepoAssertedActor[] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const path = require("node:path") as typeof import("node:path");
  return parseExternalActors(
    fs.readFileSync(path.join(import.meta.dir, ROSTER_FILENAME), "utf8"),
  );
}

/**
 * THE PORTABLE DECISION. Given a proposal's author identity and the roster, is
 * there a repo-asserted attribution for it? Pure — no forge, no network, no
 * environment. GitHub supplies the string at the edge (the workflow reads
 * `github.event.pull_request.user.login`); nothing GitHub-shaped reaches here,
 * so the same call answers the same question over a ZetaDB-native proposal.
 *
 * EXACT equality on the trimmed, lowercased actor, and nothing else. No prefix
 * match, no glob, no `endsWith("[bot]")` — every one of those is how an
 * exemption list quietly grows to cover everybody, which is the vacuity class
 * this whole instrument exists to avoid. An empty or whitespace actor matches
 * nothing: an unknown author must sign.
 */
export function repoAssertedAttribution(
  authorIdentity: string,
  roster: readonly RepoAssertedActor[],
): RepoAssertedActor | null {
  const wanted = authorIdentity.trim().toLowerCase();
  if (wanted === "") return null;
  return roster.find((row) => row.actor.trim().toLowerCase() === wanted) ?? null;
}

function emitRepoAssertedAttribution(row: RepoAssertedActor): ExitCode {
  process.stdout.write(
    `REPO-ASSERTED ATTRIBUTION: '${row.actor}' is a known external actor.\n`,
  );
  process.stdout.write(
    "  This PR carries NO trailer block, and is not required to. Read the next\n",
  );
  process.stdout.write("  three lines before reading the profile below them.\n");
  process.stdout.write(
    "    * The profile is ASSERTED BY THIS REPOSITORY, not by the actor.\n",
  );
  process.stdout.write(
    "    * It is NOT a trailer and is NOT written into the commit. Nothing here\n",
  );
  process.stdout.write("      claims to be a self-attestation by the actor.\n");
  process.stdout.write(
    `    * Its source is ${ROSTER_FILENAME}, in git, changed by review.\n`,
  );
  process.stdout.write(`  Actor:  ${row.name} (${row.actor})\n`);
  process.stdout.write(`  Why:    ${row.why}\n`);
  process.stdout.write("  Repo-asserted profile:\n");
  for (const key of REQUIRED_KEYS) {
    const value = row.repoAssertedProfile[key];
    if (value === undefined) continue;
    process.stdout.write(`    ${key.padEnd(24)}${value}\n`);
  }
  process.stdout.write(`  Evidence: ${row.profileEvidence}\n`);
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
  /** The proposal AUTHOR's identity. Forge-agnostic string; empty means unknown. */
  readonly authorIdentity: string;
}

function parseOptions(argv: readonly string[]): ValidatorOptions | null {
  let createdAt = "";
  let cutover = "";
  let authorIdentity = "";
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
    } else if (arg === "--author-identity") {
      if (next === undefined) return null;
      authorIdentity = next;
      i++;
    } else {
      return null;
    }
  }
  return { createdAt, cutover, authorIdentity };
}

/**
 * @param body - the proposal body. Omitted in production, where it is read from
 *   stdin; supplied by the tests so they can exercise this exact wiring without
 *   a subprocess per case. (Measured 2026-08-15: a spawn-per-case test file made
 *   an unrelated real-git test's 5s `beforeEach` hook time out in 2 of 6
 *   full-directory runs, against 0 of 6 before. Shipping a new flake to test a
 *   fix is not a trade worth making, and one CLI smoke test still covers the
 *   process boundary.)
 */
export function main(argv: readonly string[] = [], body?: string): ExitCode {
  if (!gitAvailable()) {
    process.stderr.write("error: git not found on PATH\n");
    return 2;
  }
  const options = parseOptions(argv);
  if (options === null) {
    process.stderr.write(
      "usage: ... | validate-agencysignature-pr-body.ts [--pr-created-at ISO] [--grandfather-cutover ISO] [--author-identity ID]\n",
    );
    return 2;
  }
  // Before the grandfather window and before stdin: a known external actor's
  // proposal never had a block to read, whenever it was opened.
  const external = repoAssertedAttribution(
    options.authorIdentity,
    loadExternalActors(),
  );
  if (external !== null) return emitRepoAssertedAttribution(external);
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
  const input = body ?? readStdin();
  if (input === "") {
    process.stderr.write("error: no input on stdin\n");
    process.stderr.write(
      "usage: gh pr view N --json body --jq '.body' | bun src/Core.TypeScript/hygiene/validate-agencysignature-pr-body.ts\n",
    );
    return 2;
  }
  const stripped = stripCodeFences(input);
  const parsed = parseTrailers(stripped);
  if (!parsed.ok) return emitToolingParseFailure(parsed.stderr);
  const trailers = parsed.trailers;
  if (trailers === "") return emitParseFailure(stripped);

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
