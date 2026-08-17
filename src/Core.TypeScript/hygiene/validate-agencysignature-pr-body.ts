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
  CANONICAL_VERSION_KEY,
  ENUMS,
  MISSPELLED_VERSION_KEY,
  REQUIRED_KEYS,
  blockValue as getValue,
  hasMisspelledVersionKey,
  isUnfilledPlaceholder,
  validateText,
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

function emitParseFailure(stripped: string): ExitCode {
  const d = diagnoseParseFailure(stripped);
  process.stdout.write("FAIL: no parseable git trailers found in the PR's COMMIT MESSAGES\n");
  process.stdout.write("  Class:  Trailer Contiguity Survival Failure\n");
  if (d.cause === "absent") {
    process.stdout.write(
      `  Cause:  no commit on this PR carries a '${CANONICAL_VERSION_KEY}:' line. NOTE:\n`,
    );
    process.stdout.write(
      "          this check reads COMMIT MESSAGES, not the PR description — a perfect\n",
    );
    process.stdout.write("          block in the PR description does NOT satisfy it.\n");
    process.stdout.write(
      "  Fix:    append the 10-trailer block (see .github/PULL_REQUEST_TEMPLATE.md)\n",
    );
    process.stdout.write("          at the very bottom of the COMMIT MESSAGE (not the PR description).\n");
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

/**
 * Render ONE violation decided by the shared rule. This file no longer decides
 * *whether* a block is valid — `validateBlock` does, and the auditor calls the
 * same function — it decides only how the failure READS. Keeping the rich
 * diagnostics is the point of a renderer: the two instruments must agree on the
 * verdict, not on the prose.
 */
function emitViolation(v: Violation, body: string): ExitCode {
  if (v.code === "missing-keys") return emitMissingKeys(v.key.split(" "), body);
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
  /** Commits the forge says the proposal has. `null` = not stated on the command line. */
  readonly commitTotal: number | null;
  /** Commit messages the caller actually piped in. `null` = the caller cannot say. */
  readonly commitsSupplied: number | null;
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
  const counts = new Map<string, number | null>([
    ["--commit-total", null],
    ["--commits-supplied", null],
  ]);
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i] ?? "";
    const value = argv[i + 1];
    if (value === undefined) return null;
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
      "usage: ... | validate-agencysignature-pr-body.ts [--pr-created-at ISO] [--grandfather-cutover ISO] [--author-identity ID] [--commit-total N] [--commits-supplied N]\n",
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
  if (verdict.block === null) return emitParseFailure(stripped);

  const first = verdict.violations[0];
  if (first !== undefined) return emitViolation(first, stripped);

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

  return emitPass(verdict.block.join("\n"));
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
