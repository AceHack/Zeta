// agencysignature-block.ts — THE canonical definition of an AgencySignature
// block. One implementation, two call sites.
//
// ---------------------------------------------------------------------------
// WHY THIS MODULE EXISTS (2026-08-16)
// ---------------------------------------------------------------------------
// The convention had TWO hand-maintained implementations — the pre-merge
// `validate-agencysignature-pr-body.ts` and the post-merge
// `audit-agencysignature-main-tip.ts` — and they disagreed about what a valid
// block is. Measured, not theorised:
//
//   * CONTIGUITY. A blank line between the block and a trailing
//     `Co-authored-by:` makes git parse ONLY the `Co-authored-by:` as the
//     trailer block, so all ten keys go invisible. 551 commits on `main` carry
//     exactly that shape; 716 carry a complete 10-key block git cannot parse at
//     all; a further 976 were reported CORRECT on the strength of the version
//     key alone, with no complete block anywhere. The auditor recovered all of
//     them silently and reported `CORRECT`.
//   * CROSS-FIELD VALIDITY. The PR-body validator enforces the enum set and the
//     `Human-Review` ⇄ `Human-Review-Evidence` constraint. The auditor enforced
//     NEITHER — it only ever regex-matched the version key. So `Human-Review:
//     not-implied-by-credential` + `Human-Review-Evidence: chat` is rejected at
//     PR time and accepted on main; 420 commits on `main` carry field
//     combinations the pre-merge gate would refuse.
//
// Both are the same defect: **a governance convention whose meaning depends on
// which parser reads it.** Making the two agree once does not fix it, because
// two implementations of one rule drift again — that is how this arose. So the
// rule lives here exactly once and both instruments call it. They cannot
// disagree, because there is no second opinion to hold.
//
// (Aaron 2026-08-16: *"we just need to get the design locked down now so its
// consistent in the future, parsing and or correcting old bad data is a nice to
// have bonus not necessary."* This module is the lock. Recovery of the old
// malformed records is built, reported as its own outcome, and deliberately
// NON-blocking by default — the bonus, not the deliverable.)
//
// Spec: docs/research/2026-04-26-gemini-deep-think-agencysignature-commit-
// attribution-convention-validation-and-refinement.md Section 7.4 (canonical
// shape) + Section 3.4 / 7.6 (enums) + Section 5.3 (the evidence pointer).
//
// NOTE ON THE SPEC'S OWN GAP, found while doing this: Section 7.4's canonical
// block ENDS at `Task:` and never says where `Co-authored-by:` goes, while
// Section 7.5 says to keep it "for content/model attribution". The 551 commits
// that put it after a blank line are following the spec as written. The spec
// text is not changed here (it is a verbatim ferry record); `CANONICAL_SHAPE`
// below states the resolution the tooling enforces.

import { parse as parseActorRef } from "../identity/actor-ref.ts";

export const CANONICAL_VERSION_KEY = "Agency-Signature-Version";
export const MISSPELLED_VERSION_KEY = "Agent-Signature-Version";

/**
 * The resolution of the spec gap above, stated once so both instruments and any
 * future one quote the same sentence.
 */
export const CANONICAL_SHAPE =
  "Exactly one blank line BEFORE the block, ZERO blank lines anywhere inside it, " +
  "and `Co-authored-by:` (which is itself a trailer) INSIDE the same contiguous " +
  "run — not separated from it by a blank line. Nothing but trailers after it.";

/** The ten v1 keys, in canonical (spec Section 7.4) order. */
export const REQUIRED_KEYS: readonly string[] = [
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

/** v2 adds `Cell` (ADR docs/DECISIONS/2026-07-03-persona-cell-identity-unification.md phase 4). */
export const V2_REQUIRED_EXTRA: readonly string[] = ["Cell"];

export const ENUMS: readonly {
  readonly key: string;
  readonly allowed: readonly string[];
}[] = [
  { key: "Agency-Signature-Version", allowed: ["1", "2"] },
  { key: "Credential-Mode", allowed: ["shared", "dedicated-agent", "human-only", "unknown"] },
  { key: "Human-Review", allowed: ["explicit", "not-implied-by-credential", "none"] },
  {
    key: "Human-Review-Evidence",
    allowed: ["chat", "pr-review", "pr-comment", "signed-policy", "none"],
  },
  { key: "Action-Mode", allowed: ["autonomous-fail-open", "human-directed", "supervised"] },
];

const BLANK_LINE_RE = /^[\t ]*$/;
const PLACEHOLDER_RE = /^<.*>$/;
const PLACEHOLDER_TASK_RE = /^(?:<[^>]*>|todo|tbd|xxx+|task|placeholder|fixme|n\/a|-+)$/i;
const ZETA_ID = "[0-9][0-9A-HJKMNP-TV-Z]{25}";
const TASK_RE = new RegExp(
  `^(?:none|${ZETA_ID}|task-#?\\d+|#?\\d+|[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)$`,
);
const MISSPELLED_VERSION_RE = /^Agent-Signature-Version:\s*\d/im;

/** True when the misspelled `Agent-Signature-Version` key appears anywhere. */
export function hasMisspelledVersionKey(text: string): boolean {
  return MISSPELLED_VERSION_RE.test(text);
}

/** True when a required trailer's value is still an unfilled `<...>` placeholder. */
export function isUnfilledPlaceholder(value: string): boolean {
  return PLACEHOLDER_RE.test(value.trim());
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

/** The value of `key` in a newline-joined run of trailer lines, or `""`. */
export function blockValue(blockText: string, key: string): string {
  const prefix = `${key.toLowerCase()}:`;
  for (const line of blockText.split("\n")) {
    if (!line.toLowerCase().startsWith(prefix)) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    return trimSpaceTab(line.slice(idx + 1));
  }
  return "";
}

/** Required keys absent from a newline-joined run of trailer lines. */
export function missingRequiredKeys(blockText: string): readonly string[] {
  const lines = blockText.split("\n");
  return REQUIRED_KEYS.filter((key) => {
    const prefix = `${key.toLowerCase()}:`;
    return !lines.some((l) => l.toLowerCase().startsWith(prefix));
  });
}

/**
 * THE LENIENT SCAN — the recovery half, and the reason it is safe.
 *
 * Returns the first contiguous run of non-blank lines carrying all ten required
 * keys, or `null`. Contiguity is still required INSIDE the run: this recovers a
 * block that git missed because of what SURROUNDS it (a blank line then
 * `Co-authored-by:`; a squash that appended more sections after it), never one
 * whose keys are scattered across the message. A scan that assembled ten keys
 * from ten different paragraphs could "recover" a signature nobody wrote — a
 * worse failure than the one being fixed, and the precise way a fallback turns
 * into a gate that cannot fail.
 *
 * WHY THE SURROUNDINGS DRIFT — mechanism established 2026-08-16, 116/116 held-out
 * predictions, zero mispredictions. GitHub's squash-merge does not pass the message
 * through. It DELETES every `Co-authored-by:` line from the composed body,
 * recomputes the set of contributing identities MINUS the squash commit's own
 * author, and re-emits that set after a blank line — synthesizing lines the branch
 * never carried, and emitting nothing at all when the set comes out empty (which is
 * why some merged commits parse and others do not; they are not the same shape).
 * The blank line is produced by the forge from ACCOUNT TOPOLOGY, not by the author
 * from message text, so no authoring discipline can prevent it. This scan is
 * therefore the supported reader for merged commits, not a fallback for sloppy
 * authoring. Measured across 150 merged PRs, branch commit vs landed squash: all
 * ten field VALUES survived intact 150/150 and the block was recoverable 150/150 —
 * which is why no widening is needed here.
 * Evidence: docs/research/2026-08-16-the-forge-is-the-producer-squash-merge-recomputes-the-co-author-trailer-set-and-the-fields-always-survive.md
 *
 * KNOWN OPEN AMBIGUITY (named, not decided): a multi-commit squash concatenates
 * each commit's message, so one message can carry SEVERAL complete blocks. This
 * returns the FIRST. On `main` today 159 commits carry more than one complete
 * block, and 38 of those disagree between first and last on a governance field
 * (`Human-Review`, `Action-Mode`). Which of N signatures is THE signature of a
 * squashed commit is a real semantic question, and changing the pick would change
 * the recorded verdict on 38 landed commits — so it is left open rather than
 * settled by a parser detail.
 */
export function findSignatureBlock(text: string): readonly string[] | null {
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    if (BLANK_LINE_RE.test(lines[i] ?? "")) {
      i++;
      continue;
    }
    let j = i;
    while (j < lines.length && !BLANK_LINE_RE.test(lines[j] ?? "")) j++;
    const paragraph = lines.slice(i, j);
    if (missingRequiredKeys(paragraph.join("\n")).length === 0) return paragraph;
    i = j;
  }
  return null;
}

/** A single way a block fails the canonical rule. Data, not a printed message. */
export interface Violation {
  readonly code:
    | "missing-keys"
    | "placeholder-value"
    | "invalid-enum"
    | "invalid-task"
    | "placeholder-task"
    | "review-evidence-without-explicit"
    | "explicit-without-evidence"
    | "v2-missing-cell"
    | "v2-persona-mismatch"
    | "v2-invalid-cell";
  /** The key at fault, or `""` when the violation spans fields. */
  readonly key: string;
  readonly found: string;
  /** One-line human-readable statement of what is wrong. */
  readonly message: string;
}

/**
 * THE canonical validation. Pure: takes the block's text, returns violations in
 * a deterministic order. Prints nothing and decides no exit code — the two
 * instruments render and enforce, this decides *validity*.
 *
 * Order is deliberate and is part of the contract, because both call sites
 * report the FIRST violation and a differing order would make them disagree
 * about which failure a block has even while agreeing that it fails.
 */
export function validateBlock(blockText: string): readonly Violation[] {
  const violations: Violation[] = [];

  const missing = missingRequiredKeys(blockText);
  if (missing.length > 0) {
    violations.push({
      code: "missing-keys",
      key: missing.join(" "),
      found: "",
      message: `missing required AgencySignature trailer keys: ${missing.join(" ")}`,
    });
    // Everything below reads values that may not exist. Stop here: reporting an
    // "invalid enum ''" for a key that is simply absent is a second, false
    // finding for one real defect.
    return violations;
  }

  for (const key of REQUIRED_KEYS) {
    const value = blockValue(blockText, key);
    if (isUnfilledPlaceholder(value)) {
      violations.push({
        code: "placeholder-value",
        key,
        found: value,
        message: `${key} is still an unfilled template placeholder: ${value}`,
      });
    }
  }
  if (violations.length > 0) return violations;

  for (const { key, allowed } of ENUMS) {
    const value = blockValue(blockText, key);
    if (!allowed.includes(value)) {
      violations.push({
        code: "invalid-enum",
        key,
        found: value,
        message: `invalid enum value for ${key}: '${value}' — expected one of: ${allowed.join(", ")}`,
      });
      return violations;
    }
  }

  const v2 = validateV2(blockText);
  if (v2 !== null) return [v2];

  const task = blockValue(blockText, "Task");
  if (PLACEHOLDER_TASK_RE.test(task)) {
    return [
      {
        code: "placeholder-task",
        key: "Task",
        found: task,
        message: `Task is an unfilled placeholder: '${task}'`,
      },
    ];
  }
  if (!TASK_RE.test(task)) {
    return [
      {
        code: "invalid-task",
        key: "Task",
        found: task,
        message: `invalid Task value: '${task}'`,
      },
    ];
  }

  const crossField = validateReviewConsistency(blockText);
  if (crossField !== null) return [crossField];

  return violations;
}

/**
 * The cross-field constraint (spec Section 5.3) — the one the auditor did not
 * have and the PR-body gate did. Extracted so there is one statement of it.
 */
export function validateReviewConsistency(blockText: string): Violation | null {
  const hr = blockValue(blockText, "Human-Review");
  const hre = blockValue(blockText, "Human-Review-Evidence");
  if (hr !== "explicit" && hre !== "none") {
    return {
      code: "review-evidence-without-explicit",
      key: "Human-Review-Evidence",
      found: hre,
      message:
        `Human-Review-Evidence must be 'none' when Human-Review is not 'explicit' ` +
        `(Human-Review='${hr}', Human-Review-Evidence='${hre}') — the evidence pointer ` +
        "attaches to actual review claims; a non-explicit review state has nothing to point at",
    };
  }
  if (hr === "explicit" && hre === "none") {
    return {
      code: "explicit-without-evidence",
      key: "Human-Review-Evidence",
      found: hre,
      message:
        "Human-Review: explicit requires Human-Review-Evidence != 'none' — an explicit " +
        "review claim must cite where the evidence lives",
    };
  }
  return null;
}

function validateV2(blockText: string): Violation | null {
  if (blockValue(blockText, CANONICAL_VERSION_KEY) !== "2") return null; // v1: Cell ignored

  const missing = V2_REQUIRED_EXTRA.filter((key) => {
    const prefix = `${key.toLowerCase()}:`;
    return !blockText.split("\n").some((l) => l.toLowerCase().startsWith(prefix));
  });
  if (missing.length > 0) {
    return {
      code: "v2-missing-cell",
      key: missing.join(" "),
      found: "",
      message: `missing required AgencySignature v2 trailer keys: ${missing.join(" ")}`,
    };
  }

  const agent = blockValue(blockText, "Agent");
  const persona = blockValue(blockText, "Persona");
  if (persona !== "" && persona !== agent) {
    return {
      code: "v2-persona-mismatch",
      key: "Persona",
      found: persona,
      message: `Persona trailer must equal Agent when both are present (Agent='${agent}', Persona='${persona}')`,
    };
  }

  const cell = blockValue(blockText, "Cell");
  try {
    // THE one parser (treaty Article 1): validate by reconstructing the
    // canonical projection `<persona>/<cell>`. No local string surgery.
    parseActorRef(`${agent}/${cell}`);
  } catch (err) {
    return {
      code: "v2-invalid-cell",
      key: "Cell",
      found: cell,
      message: `invalid Agent/Cell pair: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  return null;
}
