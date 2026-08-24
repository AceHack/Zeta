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
//         --source pr-body \
//         [--pr-created-at ISO] [--grandfather-cutover ISO] [--author-identity ID]
//
// `--source` is REQUIRED at the command line (pr-body | commit-messages). This
// one binary is run against two OPPOSITE artifacts — the PR description and the
// concatenated commit messages — and until 2026-08-18 it could not tell them
// apart, so its parse-failure text hardcoded one provenance and was false
// whenever the other job emitted it. Measured cost: a correct PR closed and its
// branch rebuilt (#11707 -> #11710) chasing a commit-side defect that was not
// there, and a second agent caught by the same sentence within the hour
// (#11712). Work item 081M092W2E7087G0R000KDKHWS.
//
// Exit codes:
//   0 — all required trailers present and enums valid, OR the author is a
//       rostered external actor carrying a repo-asserted attribution
//   1 — validation failed (specific failure printed)
//   2 — tooling / input error
//   3 — REFUSED, UNMEASURED: the commit list handed in does not cover the whole
//       proposal (or its size could not be established), so a PASS would be a
//       claim about text nobody read. Distinct from 1 on purpose — "your block
//       is wrong" and "I could not see all of it" are different sentences, and
//       collapsing them is how an underscan gets filed as a normal failure and
//       worked around. See agencysignature-commit-coverage.ts for the measured
//       defect (PR #11528: 475 commits, 250 readable).
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

// THE canonical rule — one implementation, two call sites (this pre-merge gate
// and the post-merge auditor). Before 2026-08-16 each file carried its own copy
// of REQUIRED_KEYS / ENUMS / the cross-field constraint, and they DIVERGED: this
// validator rejected `Human-Review: not-implied-by-credential` +
// `Human-Review-Evidence: chat` while the auditor accepted it, so a block was
// invalid at PR time and valid on main. Making them agree once would not have
// fixed that, because two implementations of one rule drift again — which is how
// the divergence arose. Now there is no second opinion to hold.
import {
  commitCoverage,
  refusesPass,
  renderRefusal,
  resolveCoverageFacts,
  type CoverageEnv,
} from "./agencysignature-commit-coverage.ts";
import {
  ACCOUNTABILITY_KEYS,
  CANONICAL_VERSION_KEY,
  ENUMS,
  MISSPELLED_VERSION_KEY,
  REQUIRED_KEYS,
  blockValue as getValue,
  hasMisspelledVersionKey,
  isUnfilledPlaceholder,
  validateText,
  type Reconciliation,
  type Violation,
} from "./agencysignature-block.ts";

// Re-exported so this module's public surface is unchanged by the extraction.
// The existing test-suite imports these from here; they now resolve to the
// SHARED implementations, which is itself a small proof that the delegation is
// real rather than a parallel copy left behind.
export { hasMisspelledVersionKey, isUnfilledPlaceholder };

type ExitCode = 0 | 1 | 2 | 3;

const SPEC_DOC =
  "docs/research/2026-04-26-gemini-deep-think-agencysignature-commit-attribution-convention-validation-and-refinement.md";
const ADR_DOC =
  "docs/DECISIONS/2026-07-03-persona-cell-identity-unification.md";

const FENCE_RE = /^[\t ]*```[A-Za-z]*[\t ]*$/;
const BLANK_RE = /^[\t ]*$/;
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

function stripCodeFences(input: string): string {
  return input
    .split("\n")
    .filter((line) => !FENCE_RE.test(line))
    .join("\n");
}

// An UNFILLED TEMPLATE PLACEHOLDER, e.g. `Agent: <persona>`. The PR template
// ships the trailer block pre-populated so the block survives squash-merge —
// which means the easy failure is now shipping the SKELETON. A block that
// validates while saying `Agent: <persona>` is attribution to nobody: the
// enforcement passes and the provenance is still absent, which is the same
// silent-green shape as the audit that exempted the whole fleet (#10564).
// `Agency-Signature-Version` is the canonical key (REQUIRED_KEYS above, the
// spec doc, the post-merge auditor, the four cadence workflows that echo it).
// `Agent-Signature-Version` is a hand-composition slip that reached main three
// times on 2026-08-13/14 — and because the post-merge auditor used to exempt
// anything it did not recognise, such a commit was unsigned AND exempt at once.
// Say the misspelling out loud here so the pre-merge side names it too.
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

/**
 * WHICH ARTIFACT THE CALLER PIPED IN.
 *
 * The workflow runs this ONE binary over two opposite texts -- the PR
 * description (`printf` of the PR body) and the squash preimage (the PR's
 * commit messages, from the forge API) -- and stdin cannot say which it is.
 * Naming it is therefore the caller's job, and the caller must actually do it.
 *
 * `unspecified` is a REGISTER, not a reading: it means "nobody declared this",
 * and the text it produces names NEITHER artifact rather than guessing one. It
 * is reachable only from in-process callers (`main([])`, e.g. the coverage
 * suite); at the command line an absent `--source` is a usage error -- see the
 * `import.meta.main` block at the bottom of this file for why the two levels
 * differ.
 */
export type TrailerSource = "pr-body" | "commit-messages" | "unspecified";

/** The values a caller may state. `unspecified` is a register, never an input. */
const SOURCE_VALUES: readonly string[] = ["pr-body", "commit-messages"];

/**
 * How each artifact is NAMED and REMEDIED, as data rather than as branches, so
 * that "the message names the artifact it was handed" is one lookup with no
 * path that can fall through to the other artifact's prose.
 *
 * The two `absentFix` texts are deliberately DISJOINT -- the pr-body remedy is
 * a description edit and never mentions the commit, the commit-messages remedy
 * is a push and never mentions the description edit -- which is what makes the
 * falsifier in the test suite possible: before this change both invocations
 * emitted byte-identical output, so a test asserting each names its own remedy
 * and not the other's cannot pass without it.
 */
interface SourceProse {
  /** Names the artifact in the FAIL headline. */
  readonly artifact: string;
  /** The `Cause:` lines for the `absent` diagnosis. */
  readonly absentCause: readonly string[];
  /** The `Fix:` lines for the `absent` diagnosis. */
  readonly absentFix: readonly string[];
  /** Short noun phrase for the missing-keys diagnosis. */
  readonly shortName: string;
  /** Where a missing trailer gets added, per artifact. */
  readonly addWhere: string;
}

const SOURCE_PROSE: Readonly<Record<TrailerSource, SourceProse>> = {
  "pr-body": {
    artifact: "the PR DESCRIPTION",
    absentCause: [
      `the PR DESCRIPTION carries no '${CANONICAL_VERSION_KEY}:' line. This job`,
      "read the PR DESCRIPTION and nothing else. The squash preimage is judged",
      "by a SEPARATE job in the same workflow; BOTH are required, and this one",
      "is not satisfied by a block that exists only on the commit.",
    ],
    absentFix: [
      "add the 10-trailer block (see .github/PULL_REQUEST_TEMPLATE.md) at the",
      "bottom of the PR DESCRIPTION -- `gh pr edit <N> --body-file <file>`.",
      "No push, no rebase, no rebuilt branch: editing the description is the",
      "whole remedy for THIS job.",
    ],
    shortName: "the PR description",
    addWhere: "the bottom of the PR description",
  },
  "commit-messages": {
    artifact: "the PR's COMMIT MESSAGES",
    absentCause: [
      `no commit on this PR carries a '${CANONICAL_VERSION_KEY}:' line. This job`,
      "read the COMMIT MESSAGES and nothing else -- they are what the forge",
      "squashes into the landed commit. The PR description is judged by a",
      "SEPARATE job in the same workflow; BOTH are required, and this one is",
      "not satisfied by a block that exists only in the description.",
    ],
    absentFix: [
      "append the 10-trailer block (see .github/PULL_REQUEST_TEMPLATE.md) as the",
      "FINAL trailer paragraph of the commit message, then push. Verify first:",
      "`git log -1 --format='%B' | git interpret-trailers --parse` must print",
      "all 11 lines -- one blank line inside the block ends the paragraph and",
      "silently degrades the rest to prose.",
    ],
    shortName: "the commit messages",
    addWhere: "the end of the commit message's final trailer paragraph",
  },
  unspecified: {
    artifact: "the text this check was handed",
    absentCause: [
      `the input carries no '${CANONICAL_VERSION_KEY}:' line. The caller did NOT`,
      "declare which artifact this was (no `--source`), so this message names",
      "neither: it may have been the PR description or the commit messages.",
    ],
    absentFix: [
      "the block is required in BOTH places, so satisfy both: the bottom of the",
      "PR description, AND the final trailer paragraph of the commit message.",
      "Re-run with `--source pr-body` or `--source commit-messages` for the",
      "artifact-specific remedy.",
    ],
    shortName: "the input",
    addWhere: "the bottom of the block in whichever artifact was checked",
  },
};

function emitParseFailure(stripped: string, source: TrailerSource): ExitCode {
  const d = diagnoseParseFailure(stripped);
  const prose = SOURCE_PROSE[source];
  process.stdout.write(
    `FAIL: no parseable git trailers found in ${prose.artifact}\n`,
  );
  process.stdout.write("  Class:  Trailer Contiguity Survival Failure\n");
  if (d.cause === "absent") {
    // The artifact is NAMED, from the caller's declaration, never assumed. Until
    // 2026-08-18 these lines asserted COMMIT MESSAGES unconditionally, so the PR
    // body job emitted a paragraph in which every sentence was false for the
    // text it had actually read -- and it denied the one fix that worked.
    process.stdout.write(`  Cause:  ${prose.absentCause[0] ?? ""}\n`);
    for (const line of prose.absentCause.slice(1)) {
      process.stdout.write(`          ${line}\n`);
    }
    process.stdout.write(`  Fix:    ${prose.absentFix[0] ?? ""}\n`);
    for (const line of prose.absentFix.slice(1)) {
      process.stdout.write(`          ${line}\n`);
    }
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

function emitMissingKeys(
  missing: readonly string[],
  body = "",
  source: TrailerSource = "unspecified",
): ExitCode {
  const prose = SOURCE_PROSE[source];
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
    `  Cause:    the block in ${prose.shortName} is incomplete OR a blank line\n`,
  );
  process.stdout.write(
    "            splits it such that only the final contiguous group parses\n",
  );
  process.stdout.write(
    `  Fix:      add the missing trailers at ${prose.addWhere}\n`,
  );
  process.stdout.write(
    "            OR remove the blank line that splits the contiguous block\n",
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

/**
 * Render ONE violation decided by the shared rule. This file no longer decides
 * *whether* a block is valid — `validateBlock` does, and the auditor calls the
 * same function — it decides only how the failure READS. Keeping the rich
 * diagnostics is the point of a renderer: the two instruments must agree on the
 * verdict, not on the prose.
 */
function emitViolation(v: Violation, body: string, source: TrailerSource): ExitCode {
  if (v.code === "missing-keys") return emitMissingKeys(v.key.split(" "), body, source);
  if (v.code === "invalid-enum") {
    const spec = ENUMS.find((e) => e.key === v.key);
    return emitEnumFailure(v.key, v.found, spec?.allowed ?? []);
  }
  if (v.code === "placeholder-value") {
    process.stdout.write(
      `FAIL: AgencySignature trailer values are still template placeholders: ${v.key}\n`,
    );
    process.stdout.write(`  ${v.key}: ${v.found}\n`);
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
  if (v.code === "placeholder-task" || v.code === "invalid-task") {
    process.stdout.write(
      v.code === "placeholder-task"
        ? "FAIL: Task is an unfilled placeholder\n"
        : "FAIL: invalid Task value\n",
    );
    process.stdout.write(`  Found:    '${v.found}'\n`);
    process.stdout.write(
      "  Expected: a ZetaId work-item key (26 chars, e.g. 081M0085XQT087G0R003W4KFS4),\n",
    );
    process.stdout.write("            a slug naming the work (e.g. fix-merge-duty-ordering),\n");
    process.stdout.write("            a ticket-id (Otto-NN, task-#NNN, #NNN, FOO-NN),\n");
    process.stdout.write("            or the literal 'none' fallback\n");
    process.stdout.write(`  Spec:     ${SPEC_DOC} Section 9.2 (Task: none fallback)\n`);
    return 1;
  }
  if (
    v.code === "review-evidence-without-explicit" ||
    v.code === "explicit-without-evidence"
  ) {
    process.stdout.write(`FAIL: ${v.message}\n`);
    process.stdout.write(
      "  Fix:    set Human-Review-Evidence to 'none', or set Human-Review to 'explicit'\n",
    );
    process.stdout.write("          and cite chat | pr-review | pr-comment | signed-policy\n");
    process.stdout.write(`  Spec:   ${SPEC_DOC} Section 5.3 / 7.6\n`);
    return 1;
  }
  if (v.code === "block-disagreement") {
    process.stdout.write("FAIL: AgencySignature blocks disagree on a governance-critical field\n");
    process.stdout.write(`  Fields:   ${v.key}\n`);
    process.stdout.write(`  Values:   ${v.found}\n`);
    process.stdout.write(
      "  Cause:    this body carries more than one complete block (a multi-commit\n",
    );
    process.stdout.write(
      "            squash concatenates each commit's message) and they make\n",
    );
    process.stdout.write("            MUTUALLY EXCLUSIVE claims about the same change.\n");
    process.stdout.write(
      "  Why not just pick one: these fields decide how much AUTHORITY the change\n",
    );
    process.stdout.write(
      "            carries. Silently taking either end can record a human review that\n",
    );
    process.stdout.write(
      "            the other block denies — manufacturing authorization nobody gave.\n",
    );
    process.stdout.write(
      "            Disagreement on incidental fields (Agent, Task, ...) is accepted\n",
    );
    process.stdout.write("            silently; these are not those.\n");
    process.stdout.write(
      "  Fix:      make the blocks agree on the fields above, or leave ONE block.\n",
    );
    // The non-authoring maintainer's case, spelled out because the obvious two
    // "fixes" available to them are both dishonest — copy the branch's block, or
    // overwrite your own values with the branch's — and a diagnostic that stops
    // at "make them agree" reads as an instruction to do exactly that.
    process.stdout.write(
      "  If you are MAINTAINING SOMEONE ELSE'S BRANCH (merging main in, rebasing):\n",
    );
    process.stdout.write(
      "            * Carry NO block. A commit that makes no content decision asserts\n",
    );
    process.stdout.write(
      "              nothing, contributes no block, and cannot disagree. Git's default\n",
    );
    process.stdout.write(
      "              `Merge branch 'main' into X` message already passes this check.\n",
    );
    process.stdout.write(
      "            * Do NOT copy the branch's block. Nothing here can tell a copied\n",
    );
    process.stdout.write(
      "              attestation from an earned one — a copy is byte-identical — so the\n",
    );
    process.stdout.write("              only thing stopping it is you.\n");
    process.stdout.write(
      "            * If you DID decide content (resolved a conflict, fixed a lint), sign\n",
    );
    process.stdout.write(
      "              as YOURSELF with your own honest values; and if that honest block\n",
    );
    process.stdout.write(
      "              disagrees with the branch's, the disagreement is TRUE — hand the PR\n",
    );
    process.stdout.write(
      "              back to its owner rather than editing either block to match.\n",
    );
    process.stdout.write(
      "  Rule:     .claude/rules/maintenance-commit-on-another-agents-branch-carries-no-block.md\n",
    );
    process.stdout.write(`  Spec:     ${SPEC_DOC} Section 5.3 / 7.6\n`);
    return 1;
  }
  // v2-*: missing Cell, Persona mismatch, unparseable Agent/Cell pair.
  process.stdout.write(`FAIL: ${v.message}\n`);
  process.stdout.write(
    "  Law:    treaty Article 1 — projections are produced/parsed by exactly one module\n",
  );
  process.stdout.write(`  Spec:   ${ADR_DOC} phase 4\n`);
  return 1;
}

/**
 * THE PASS REPORT.
 *
 * `reconciliations` is threaded in rather than read off `trailers` for the reason
 * stated on `TextVerdict.reconciliations`: for a squash whose constituents mixed
 * `Action-Mode`, the authoritative block still literally carries whatever the LAST
 * commit wrote. Printing that value would report `human-directed` for a squash the
 * canonical rule resolved as autonomous — the manufacture the reconciliation
 * exists to prevent, re-entering through the report. The resolved value is printed
 * instead, and the values it was resolved FROM are printed beside it so the reader
 * can see that something was discarded and what.
 */
function emitPass(
  trailers: string,
  reconciliations: readonly Reconciliation[] = [],
): ExitCode {
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
  // EVERY reconcilable key reports its RESOLVED value, not the last block's — the
  // #14594 lesson, which generalises the moment a second key becomes reconcilable.
  // Printing `trailers`' own `Human-Review` for an anchored squash would report
  // `explicit` for a change the canonical rule resolved as unreviewed: the exact
  // manufacture the reconciliation exists to prevent, re-entering through the report.
  const reconciled = (key: string): Reconciliation | undefined =>
    reconciliations.find((r) => r.key === key);
  const note = (r: Reconciliation | undefined): void => {
    if (r === undefined) return;
    process.stdout.write(
      `    RECONCILED from ${r.from.map((v) => `'${v}'`).join(" + ")} to the WEAKEST ` +
        "claim present. The squash mixes commits made different ways; the value reported above is " +
        "the one reading that cannot overstate human involvement.\n",
    );
  };
  const humanReview = reconciled("Human-Review");
  const reviewEvidence = reconciled("Human-Review-Evidence");
  const actionMode = reconciled("Action-Mode");
  process.stdout.write(
    `  Human-Review:             ${humanReview?.resolved ?? getValue(trailers, "Human-Review")}\n`,
  );
  note(humanReview);
  process.stdout.write(
    `  Human-Review-Evidence:    ${reviewEvidence?.resolved ?? getValue(trailers, "Human-Review-Evidence")}\n`,
  );
  note(reviewEvidence);
  process.stdout.write(
    `  Action-Mode:              ${actionMode?.resolved ?? getValue(trailers, "Action-Mode")}\n`,
  );
  note(actionMode);
  process.stdout.write(`  Task:                     ${getValue(trailers, "Task")}\n`);
  // Optional; printed only when recorded, because printing `Accountable-Party: ` on
  // a v1 block would render silence as an empty answer to a question that was asked.
  for (const key of ACCOUNTABILITY_KEYS) {
    const value = getValue(trailers, key);
    if (value !== "") {
      process.stdout.write(`  ${key}:${" ".repeat(Math.max(1, 25 - key.length))}${value}\n`);
    }
  }
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
  /** Commits the forge says the proposal has. `null` = not stated on the command line. */
  readonly commitTotal: number | null;
  /** Commit messages the caller actually piped in. `null` = the caller cannot say. */
  readonly commitsSupplied: number | null;
  /**
   * WHICH artifact was piped in, as declared by the caller. `unspecified` when
   * `--source` was omitted -- which the CLI refuses outright, and which
   * in-process callers get as a message that names no artifact at all.
   */
  readonly source: TrailerSource;
}

/** A non-negative integer, or `null` if the text is not one. */
function parseCount(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const n = Number.parseInt(text, 10);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Every flag this tool takes carries exactly one value, so the parse is a table
 * walk rather than a chain of branches — one row per flag, and an unknown flag
 * or a missing value is a usage error.
 *
 * A malformed COUNT is a usage error too, never a silently-ignored flag:
 * `--commit-total ""` degrading to "no coverage claim was made" would be an
 * underscan you could buy with a typo.
 */
function parseOptions(argv: readonly string[]): ValidatorOptions | null {
  const text = new Map<string, string>([
    ["--pr-created-at", ""],
    ["--grandfather-cutover", ""],
    ["--author-identity", ""],
  ]);
  // An ENUM flag, validated here: `--source prbody` is a usage error, never a
  // silent fall-back to "unspecified". A typo that degraded to the neutral
  // register would be this bug's shape again -- a provenance claim decided by
  // something other than the caller's statement.
  let source: TrailerSource = "unspecified";
  const counts = new Map<string, number | null>([
    ["--commit-total", null],
    ["--commits-supplied", null],
  ]);
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i] ?? "";
    const value = argv[i + 1];
    if (value === undefined) return null;
    if (flag === "--source") {
      if (!SOURCE_VALUES.includes(value)) return null;
      source = value as TrailerSource;
      continue;
    }
    if (text.has(flag)) {
      text.set(flag, value);
      continue;
    }
    if (!counts.has(flag)) return null;
    const count = parseCount(value);
    if (count === null) return null;
    counts.set(flag, count);
  }
  return {
    createdAt: text.get("--pr-created-at") ?? "",
    cutover: text.get("--grandfather-cutover") ?? "",
    authorIdentity: text.get("--author-identity") ?? "",
    commitTotal: counts.get("--commit-total") ?? null,
    commitsSupplied: counts.get("--commits-supplied") ?? null,
    source,
  };
}

/** Ambient process environment, read ONCE and only here (noninterference §13). */
function processEnv(): CoverageEnv {
  return {
    vars: process.env,
    readFile: (path: string): string => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("node:fs") as typeof import("node:fs");
      return fs.readFileSync(path, "utf8");
    },
  };
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
export function main(
  argv: readonly string[] = [],
  body?: string,
  env: CoverageEnv = processEnv(),
): ExitCode {
  const options = parseOptions(argv);
  if (options === null) {
    process.stderr.write(
      "usage: ... | validate-agencysignature-pr-body.ts --source pr-body|commit-messages [--pr-created-at ISO] [--grandfather-cutover ISO] [--author-identity ID] [--commit-total N] [--commits-supplied N]\n",
    );
    return 2;
  }
  // Before the grandfather window and before stdin: a known external actor's
  // proposal never had a block to read, whenever it was opened.
  const external = repoAssertedAttribution(
    options.authorIdentity,
    loadExternalActors(),
  );
  // DRAIN STDIN BEFORE ANY EARLY RETURN. The caller pipes a producer into this tool
  // (`gh api ... | bun this`). Returning without reading closes the read end, the
  // producer dies of SIGPIPE, and under `set -o pipefail` the STEP exits 141 — even
  // though this validator succeeded and printed GRANDFATHERED. Measured: every
  // pre-cutover PR (e.g. #10717, #10741, both created 2026-08-14) failed that way,
  // so the grandfather clause — which exists precisely so old PRs are NOT blocked —
  // was blocking them. A guard that fails the thing it exempts is worse than no guard.
  // Only drain when stdin is actually the source; `--body` callers pipe nothing.
  const stdinText = body === undefined ? readStdin() : "";
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
  const input = body ?? stdinText;
  if (input === "") {
    process.stderr.write("error: no input on stdin\n");
    process.stderr.write(
      "usage: gh pr view N --json body --jq '.body' | bun src/Core.TypeScript/hygiene/validate-agencysignature-pr-body.ts\n",
    );
    return 2;
  }
  const stripped = stripCodeFences(input);

  // ---------------------------------------------------------------------
  // LAYOUT TOLERANCE (Aaron 2026-08-16: *"any layout is fine with me, as long as
  // we have the needed fields is what matters most"* / *"yes this sounds good"*).
  //
  // The block no longer has to be the final paragraph, and text after it is
  // legal. The forcing case is that THE AUTHOR CANNOT PREVENT THE APPEND: an IDE
  // adds `Made with [Cursor](https://cursor.com)` below the body (Riven's PRs,
  // and Aaron's own #10949 hit it), and the forge re-emits `Co-authored-by:`
  // after a blank line. Failing a PR for a tagline it did not write is a gate
  // firing on correct work, which gets the gate switched off.
  //
  // What is NOT relaxed: the ten fields are still required, contiguity INSIDE
  // the block is still required, and every value rule still applies. This is
  // layout tolerance, not field tolerance.
  //
  // `validateText` is the one entry point — it takes the LAST complete block
  // (taglines append after the real block; quoted examples appear before it) and
  // raises `block-disagreement` before validating anything.
  // ---------------------------------------------------------------------
  const verdict = validateText(stripped);
  if (verdict.block === null) return emitParseFailure(stripped, options.source);

  const first = verdict.violations[0];
  if (first !== undefined) return emitViolation(first, stripped, options.source);

  // ---------------------------------------------------------------------
  // COVERAGE — the last gate, and it guards exactly ONE outcome: the PASS.
  //
  // Everything above judges the text that arrived. This asks whether the text
  // that arrived is all of it. Measured 2026-08-17 on PR #11528, the squash
  // preimage step handed this validator the oldest 250 of 475 commit messages
  // and got the ordinary verdict back — a check that did not fully run,
  // reported as one that passed.
  //
  // Placed HERE, after validation, on purpose:
  //   * a FAIL over a truncated prefix is SOUND (the violating commit is really
  //     in the PR), so it is still reported as a FAIL and keeps its diagnosis;
  //   * the GRANDFATHERED and REPO-ASSERTED exits above are declared exemptions
  //     that measure nothing and say so loudly — they are not passes;
  //   * only the PASS makes the claim "every block in this proposal is valid",
  //     and only that claim needs the whole proposal to have been read.
  // ---------------------------------------------------------------------
  const coverage = commitCoverage(
    resolveCoverageFacts(
      { commitTotal: options.commitTotal, commitsSupplied: options.commitsSupplied },
      input,
      env,
    ),
  );
  if (refusesPass(coverage)) {
    process.stdout.write(renderRefusal(coverage));
    return 3;
  }

  return emitPass(verdict.block.join("\n"), verdict.reconciliations);
}

/**
 * THE CLI BOUNDARY FAILS CLOSED ON AN OMITTED `--source`.
 *
 * Stated deliberately, because "what happens when nobody says" is the whole
 * defect (work item 081M092W2E7087G0R000KDKHWS): the old code had exactly one
 * answer baked in, was right for one caller and false for the other, and cost a
 * closed PR and a rebuilt branch.
 *
 * Two levels, two answers, both explicit:
 *
 *   * COMMAND LINE (here) -- `--source` is REQUIRED. Exit 2, "tooling / input
 *     error", before a byte of stdin is judged. A CI step that forgets the flag
 *     goes red immediately and loudly; it can never emit an undeclared-provenance
 *     diagnostic that a reader might act on. This is the level the bug lived at,
 *     so this is the level that refuses.
 *   * IN-PROCESS `main([])` -- allowed, and registers as `unspecified`, whose
 *     text names NEITHER artifact and prescribes both remedies. Callers like the
 *     commit-coverage suite genuinely have no artifact to declare; forcing them
 *     to invent one would manufacture the false provenance this fix removes.
 *
 * The exit code is 2 rather than 1 on purpose: this is not "your block is
 * wrong", it is "this invocation is not answerable".
 */
if (import.meta.main) {
  const argv = process.argv.slice(2);
  if (!argv.includes("--source")) {
    process.stderr.write(
      "error: --source is required (pr-body | commit-messages)\n",
    );
    process.stderr.write(
      "  This one validator is run against two opposite artifacts, and its failure\n",
    );
    process.stderr.write(
      "  text names the artifact it was handed. Undeclared, it would have to guess,\n",
    );
    process.stderr.write(
      "  and a guess printed as a diagnosis is what work item\n",
    );
    process.stderr.write(
      "  081M092W2E7087G0R000KDKHWS was filed about. Declare it.\n",
    );
    process.exit(2);
  }
  process.exit(main(argv));
}
