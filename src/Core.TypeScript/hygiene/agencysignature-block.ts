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
  "The ten required fields, contiguous (no blank line inside the block). Layout is " +
  "otherwise free: the block need NOT be the final paragraph, and text after it — an " +
  "IDE tagline, a forge footer, a `Co-authored-by:` the forge re-emitted — is fine. " +
  "When a message carries several complete blocks the LAST one is authoritative, and " +
  "blocks that disagree on a governance-critical field are an error, not a pick — except " +
  "`Action-Mode`, which describes ONE COMMIT rather than the change and is resolved to the " +
  "weakest claim present, never the strongest, and never to a claim of human involvement.";

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

/**
 * `Credential-Mode` — WHOSE credential performed the act.
 *
 *   shared             a credential more than one actor may use (a human's, used by an agent)
 *   dedicated-agent    a credential belonging to one automated actor (`*[bot]`)
 *   human-only         a human acted directly; no agent involved
 *   operator-delegated an agent acting under an operator's EXPLICIT delegation (added
 *                      2026-08-17, maintainer-authorized). Narrower than `shared`: shared
 *                      says only that the credential is not agent-exclusive, while this
 *                      says the operator deliberately handed it over for this class of act.
 *   unknown            not determined — the honest floor, never a default to hide behind
 *
 * `Action-Mode` — HOW MUCH human direction the act carried, and what it does on error.
 *
 *   autonomous-fail-open    autonomous; on error it PROCEEDS (degrades, keeps going)
 *   autonomous-fail-closed  autonomous; on error it STOPS (added 2026-08-17,
 *                           maintainer-authorized). Strictly SAFER than fail-open, and the
 *                           distinction is load-bearing: an autonomous actor that halts on
 *                           error claims less reach than one that continues past it, and a
 *                           vocabulary that cannot say so forces the safer actor to
 *                           overstate itself.
 *   human-directed          a human asked for this specific change
 *   supervised              a human watched it happen
 *
 * WHY THESE TWO WERE ADDED RATHER THAN THE PRODUCERS BENT TO FIT. Two independent authors
 * — `.github/workflows/zetadb-scheduled-node.yml` and the shadow lane by hand — reached for
 * `autonomous-fail-closed`, and a third for `operator-delegated`, before either existed
 * here. Coinage arrived at independently, twice, is evidence the vocabulary was missing a
 * distinction its users needed, not that its users were careless. Mapping them onto the
 * nearest legal value would have recorded something FALSE: `operator-delegated` collapsed
 * to `shared` loses the delegation, and `autonomous-fail-closed` collapsed to
 * `autonomous-fail-open` claims a reach on error the actor does not take.
 *
 * These are ADDITIONS, never renames. Every previously-valid block stays valid, so nothing
 * on main is invalidated by this change.
 */
export const ENUMS: readonly {
  readonly key: string;
  readonly allowed: readonly string[];
}[] = [
  { key: "Agency-Signature-Version", allowed: ["1", "2"] },
  {
    key: "Credential-Mode",
    allowed: ["shared", "dedicated-agent", "operator-delegated", "human-only", "unknown"],
  },
  { key: "Human-Review", allowed: ["explicit", "not-implied-by-credential", "none"] },
  {
    key: "Human-Review-Evidence",
    allowed: ["chat", "pr-review", "pr-comment", "signed-policy", "none"],
  },
  {
    key: "Action-Mode",
    allowed: [
      "autonomous-fail-open",
      "autonomous-fail-closed",
      "human-directed",
      "supervised",
    ],
  },
];

const BLANK_LINE_RE = /^[\t ]*$/;
const PLACEHOLDER_RE = /^<.*>$/;
const PLACEHOLDER_TASK_RE = /^(?:<[^>]*>|todo|tbd|xxx+|task|placeholder|fixme|n\/a|-+)$/i;
const ZETA_ID = "[0-9][0-9A-HJKMNP-TV-Z]{25}";
const TASK_RE = new RegExp(
  `^(?:none|${ZETA_ID}|task-#?\\d+|#?\\d+|[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+)$`,
);
const MISSPELLED_VERSION_RE = /^Agent-Signature-Version:\s*\d/im;

/**
 * Normalize the transport-level line ending before parsing semantic trailers.
 * Browser form submission may carry CRLF while GitHub API callers ordinarily
 * carry LF. The distinction is transport encoding, not AgencySignature value
 * data; preserving a trailing `\r` turns valid enum `1` into invalid `1\r`.
 */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

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
  for (const line of normalizeLineEndings(blockText).split("\n")) {
    if (!line.toLowerCase().startsWith(prefix)) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    return trimSpaceTab(line.slice(idx + 1));
  }
  return "";
}

/** Required keys absent from a newline-joined run of trailer lines. */
export function missingRequiredKeys(blockText: string): readonly string[] {
  const lines = normalizeLineEndings(blockText).split("\n");
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
 * MULTI-BLOCK RESOLUTION — settled 2026-08-16 (Aaron: *"yes this sounds good"*).
 * A multi-commit squash concatenates each commit's message, so one message can
 * carry SEVERAL complete blocks. This returns the **LAST**, and the reason is
 * specifically that trailing text is now legal:
 *
 *   * appended taglines land AFTER the real block (an IDE's `Made with Cursor`,
 *     a forge footer) — the author cannot prevent them;
 *   * quoted examples land BEFORE it (a doc PR showing the template, a PR whose
 *     subject IS the block format).
 *
 * So last-wins is correct *precisely because* trailing text is legal: taking the
 * first would let a quoted example outrank the signature it is quoting. The two
 * decisions are one decision and must not be separated.
 *
 * Measured before changing it (this repo, post-v1-ship commits on `main`,
 * 2026-08-16): 154 commits carry more than one complete block; 47 of those
 * disagree between first and last on some field; 30 disagree on a
 * GOVERNANCE-critical field. Those 30 do not silently flip — they now raise
 * `block-disagreement` (see `detectBlockDisagreement`), because a squash whose
 * constituents claim `Human-Review: none` and `Human-Review: explicit` cannot be
 * resolved by a parser preferring one end of the message.
 *
 * ONE governance key is resolved rather than refused — `Action-Mode`, and NOT by
 * last-wins. See the RECONCILABLE section above `GOVERNANCE_KEYS`: it is ordered
 * by claimed human authority and the MINIMUM wins, so the resolution can only
 * weaken a claim. Last-wins is still forbidden for it, precisely because it would
 * let commit ordering decide whether a squash reads as human-directed.
 */
export function findSignatureBlock(text: string): readonly string[] | null {
  const all = findAllSignatureBlocks(text);
  return all.length === 0 ? null : (all[all.length - 1] ?? null);
}

/**
 * Every complete block in the text, in document order.
 *
 * Contiguity is still required INSIDE each run for the reason given above; what
 * changed is only WHICH complete run is authoritative, and that several may
 * exist at all.
 */
export function findAllSignatureBlocks(text: string): readonly (readonly string[])[] {
  const lines = normalizeLineEndings(text).split("\n");
  const found: (readonly string[])[] = [];
  let i = 0;
  while (i < lines.length) {
    if (BLANK_LINE_RE.test(lines[i] ?? "")) {
      i++;
      continue;
    }
    let j = i;
    while (j < lines.length && !BLANK_LINE_RE.test(lines[j] ?? "")) j++;
    const paragraph = lines.slice(i, j);
    if (missingRequiredKeys(paragraph.join("\n")).length === 0) found.push(paragraph);
    i = j;
  }
  return found;
}

// ---------------------------------------------------------------------------
// GOVERNANCE-CRITICAL vs INCIDENTAL fields
// ---------------------------------------------------------------------------
// The split is not "important vs unimportant" — every required field is
// required, and `missingRequiredKeys` is unchanged. It answers one narrow
// question: WHEN TWO BLOCKS IN ONE SQUASH DISAGREE, is that a contradiction or
// just two true statements about different constituent commits?
//
// The discriminator is ESCALATION, which is `.claude/rules/no-directives.md`'s
// line applied to a parser: the shadow may inherit authority, never extend it.
//
//   GOVERNANCE-CRITICAL — the value is a claim about how much AUTHORITY this
//   change carries. Silently picking one manufactures authorization nobody gave.
//   Measured live on `main`: c417b28c6357 has `Human-Review: none` in its first
//   block and `explicit` in its last; 620a1729cb5f goes `pending` -> `explicit`.
//   Last-wins there would RECORD A HUMAN REVIEW THAT THE OTHER BLOCK DENIES.
//   That is the privilege-escalation shape, so it must be loud, not resolved.
//
//   INCIDENTAL — two different values are both TRUE, of different constituent
//   commits, and neither grants anything. A squash of work by two agents
//   honestly has two `Agent:` values; a squash spanning two work-items honestly
//   has two `Task:` values (28 of the 47 disagreements are `Task:` alone —
//   erroring on those would be 28 false alarms teaching people to ignore the
//   check). `Credential-Identity` is here for a stated reason rather than by
//   feel: spec Section 7.5's Identity Demarcation Rule already forbids using an
//   identity field as proof of human action, so it cannot escalate by itself.
//
// Consequence, stated so the tradeoff is visible: a disagreement confined to
// incidental fields is ACCEPTED and the last block wins. That loses the other
// constituents' attribution detail. It is the right trade only because the
// alternative — erroring on every multi-author squash — makes the check useless.

// ---------------------------------------------------------------------------
// THE THIRD CASE: RECONCILABLE (added 2026-08-23, Aaron: *"accept the mixed
// Action-Mode (shadow*)"*)
// ---------------------------------------------------------------------------
// The two-way split above is not exhaustive, and the gap was found by the PRs it
// blocked for something that is not a contradiction. PR #14251 (a .NET SDK roll
// closing 10 CVEs) carries six commits at `Action-Mode: human-directed` and one
// LATER maintenance commit at `autonomous-fail-open` — an agent fixing a
// check-then-use race the PR itself had introduced. PR #14430 has the same shape
// with `autonomous-fail-closed`. In #14251 every other governance field agrees
// across all seven blocks; the squash is red on `Action-Mode` alone.
//
// `Human-Review` and `Action-Mode` are DIFFERENT IN KIND, and the split above
// treated them as one thing. The rationale written for the split is entirely
// about the first:
//
//   `Human-Review` is a claim about THE CHANGE — who is accountable for what
//   lands. One change cannot have been both reviewed and not reviewed, so two
//   values are a genuine contradiction and no parser may pick between them.
//
//   `Action-Mode` is a claim about HOW ONE COMMIT WAS MADE. Six commits a human
//   asked for plus one autonomous maintenance fix is not a contradiction — each
//   value is TRUE OF ITS OWN COMMIT, in exactly the sense that makes `Agent:` and
//   `Task:` incidental. What the squash still needs is a single answer for the
//   whole, and unlike `Human-Review` there is a defensible one.
//
// SO `Action-Mode` STAYS A GOVERNANCE KEY AND IS RECONCILED TO THE WEAKEST CLAIM,
// NEVER THE STRONGEST. Dropping it from `GOVERNANCE_KEYS` would be the easy
// change and the wrong one: it would make `human-directed` vs `autonomous-*`
// resolve by last-wins, so a squash whose final commit happened to be the
// human-directed one would RECORD human direction on autonomous work — the
// escalation shape, reintroduced through the back door. Ordering the vocabulary
// by how much human authority it claims and taking the MINIMUM inverts the
// failure mode: mixing can lose a claim of human direction and can never
// acquire one.
//
// WHY THIS CANNOT BE USED TO MANUFACTURE AUTHORITY. Four properties, each with a
// falsifier in `agencysignature-block.test.ts` §ACTION-MODE RECONCILIATION —
// this is the whole of what separates a reconciliation from a waiver:
//
//   1. The resolved value is always one a constituent commit ACTUALLY WROTE.
//      The reconciliation only ever DISCARDS values; it never invents one.
//   2. The resolved value is always the LEAST human-backed of the values present.
//      `min` is the entire mechanism, and it is the reason the error can only
//      ever run in the understating direction.
//   3. Reconciliation is REFUSED unless the result claims no human involvement at
//      all. `supervised` and `human-directed` are claims of PRESENCE — that a
//      human watched, that a human asked — and neither is implied by the other,
//      so a set holding only those two has no resolution some constituent does
//      not deny. That set stays LOUD. Only the `autonomous-*` values are claims
//      of ABSENCE, and a claim of absence is the one thing a parser may assert on
//      an author's behalf. It is the same move as the house rule that a block
//      degrades to `unknown` rather than assert a convenient value.
//   4. A value outside the enum has no rank, so it is not ordered and not
//      reconciled. 58 commits on `main` carry the retired `autonomous` /
//      `agent-chosen` spellings; an unknown vocabulary stays loud rather than
//      being guessed into position.
//
// WHAT IS GIVEN UP — real, and not small, so it is stated rather than implied.
// A squash mixing human-directed work with one autonomous maintenance commit is
// now READ as `autonomous-*` for the whole. Aaron's six human-directed commits in
// #14251 land under an authoritative reading that says no human directed them.
// That understates the human involvement in the change, permanently, and there is
// no per-commit attribution left to recover it from — the squash discards the
// constituents' authority exactly the way incidental last-wins already discards
// the other authors' `Agent:` values.
//
// It is accepted for the reason the incidental case was accepted, one line up in
// this file: the alternative is a check that fires on correct work. The two exits
// available to an author facing that red are force-pushing the branch to re-sign
// it (a separately gated class) or writing a value nobody earned — and a check
// whose only exits are "rewrite history" or "lie" does not protect the invariant,
// it prices it. Dejan, holding this exact red on #14251: *"I'd rather leave this
// red and visible than have a green build that records a human direction nobody
// gave."* That instinct is the one preserved here; what changes is that the
// honest reading is now available without a force-push.
//
// The DIRECTION of the loss is the whole justification. The record may understate
// human backing. It may never overstate it.

export const GOVERNANCE_KEYS: readonly string[] = [
  "Agency-Signature-Version", // schema discriminator: changes how all the rest is read
  "Credential-Mode", // whether the credential implies a human at all
  "Human-Review", // THE accountability claim
  "Human-Review-Evidence", // where that claim's evidence lives (spec Section 5.3)
  "Action-Mode", // autonomous vs supervised vs human-directed — RECONCILABLE, see above
];

/**
 * The `Action-Mode` vocabulary ordered by HOW MUCH HUMAN AUTHORITY IT CLAIMS,
 * weakest first. The order is not a ranking of quality; it answers one question —
 * *which of these is the safest thing to record about a squash that contains
 * several of them?*
 *
 *   0 `autonomous-fail-open`    no human, and it PROCEEDS past error — the widest
 *                               machine reach the vocabulary can express, so it is
 *                               the floor. Recording it can never flatter anyone.
 *   1 `autonomous-fail-closed`  no human, and it HALTS at error. Above fail-open
 *                               because it claims strictly less reach (the reason
 *                               the value was added at all, see ENUMS above), and
 *                               taking the min therefore never lets a squash
 *                               containing a fail-open commit read as the safer
 *                               fail-closed.
 *   2 `supervised`              a human was PRESENT.
 *   3 `human-directed`          a human ASKED for this specific change.
 *
 * 2 and 3 are both claims of presence and neither implies the other, which is why
 * `reconcileActionMode` refuses to resolve a set that contains only those two
 * rather than picking the smaller index. The order is total; the reconciliation
 * deliberately is not.
 */
export const ACTION_MODE_BY_HUMAN_AUTHORITY: readonly string[] = [
  "autonomous-fail-open",
  "autonomous-fail-closed",
  "supervised",
  "human-directed",
];

/**
 * The first rank that asserts a human was involved at all. Everything BELOW this
 * is a claim of absence and may be asserted on an author's behalf; everything at
 * or above it is a claim of presence and may not be.
 */
const FIRST_HUMAN_CLAIMING_RANK = ACTION_MODE_BY_HUMAN_AUTHORITY.indexOf("supervised");

/**
 * Resolve several `Action-Mode` values to the single weakest claim, or `null` when
 * they cannot be resolved without manufacturing one.
 *
 * Returns `null` — meaning "stay loud" — when:
 *   * any value is outside the enum (no rank, so no order);
 *   * the weakest value present still claims a human was involved (`supervised` /
 *     `human-directed` only), because resolving that set would assert of the whole
 *     squash something one of its own commits does not say.
 *
 * Never returns a value that was not in `values`. Never returns a value ranked
 * above the minimum of `values`. Both are pinned by falsifiers.
 */
export function reconcileActionMode(values: readonly string[]): string | null {
  const distinct = [...new Set(values)];
  if (distinct.length === 0) return null;
  if (distinct.length === 1) return distinct[0] ?? null;
  const ranks = distinct.map((v) => ACTION_MODE_BY_HUMAN_AUTHORITY.indexOf(v));
  if (ranks.some((r) => r < 0)) return null;
  const min = Math.min(...ranks);
  if (min >= FIRST_HUMAN_CLAIMING_RANK) return null;
  return ACTION_MODE_BY_HUMAN_AUTHORITY[min] ?? null;
}

/** A governance key whose differing values were resolved rather than refused. */
export interface Reconciliation {
  readonly key: string;
  /** The single value the squash is read as carrying. */
  readonly resolved: string;
  /** Every distinct value the constituent blocks carried, in document order. */
  readonly from: readonly string[];
}

/**
 * The reconciliations applied to a text, so the instruments can PRINT what the
 * squash is being read as instead of quietly reporting the last block's value.
 *
 * `Action-Mode` is the only reconcilable key and is named literally rather than
 * looked up in a table. A table is an invitation: the next key added to it would
 * inherit this exemption without inheriting the argument for it, and the argument
 * is specific to a field that describes a COMMIT rather than THE CHANGE.
 */
export function detectReconciliations(text: string): readonly Reconciliation[] {
  const blocks = findAllSignatureBlocks(text);
  if (blocks.length < 2) return [];
  const values = [...new Set(blocks.map((b) => blockValue(b.join("\n"), "Action-Mode")))];
  if (values.length < 2) return [];
  const resolved = reconcileActionMode(values);
  return resolved === null ? [] : [{ key: "Action-Mode", resolved, from: values }];
}

export const INCIDENTAL_KEYS: readonly string[] = REQUIRED_KEYS.filter(
  (k) => !GOVERNANCE_KEYS.includes(k),
);

export interface BlockDisagreement {
  /** Governance-critical keys whose values differ across the blocks. */
  readonly keys: readonly string[];
  /** `key: 'a' | 'b'` for each disagreeing key, for the error message. */
  readonly details: readonly string[];
  readonly blockCount: number;
}

/**
 * Detect a governance-critical disagreement among the complete blocks.
 *
 * Compares ALL blocks pairwise-by-key rather than only first vs last: with three
 * blocks, a contradiction between #1 and #2 is just as real as one between #1
 * and #3, and comparing only the ends would miss it.
 *
 * Returns `null` when there are fewer than two blocks, or when they agree on
 * every governance key — the ordinary multi-author squash, which stays quiet.
 */
export function detectBlockDisagreement(text: string): BlockDisagreement | null {
  const blocks = findAllSignatureBlocks(text);
  if (blocks.length < 2) return null;
  const keys: string[] = [];
  const details: string[] = [];
  for (const key of GOVERNANCE_KEYS) {
    const values = [...new Set(blocks.map((b) => blockValue(b.join("\n"), key)))];
    if (values.length <= 1) continue;
    // The ONE reconcilable key. Everything else here is untouched: a differing
    // `Human-Review`, `Human-Review-Evidence`, `Credential-Mode` or
    // `Agency-Signature-Version` is still an error, and `reconcileActionMode`
    // itself refuses the sets that would manufacture a claim.
    if (key === "Action-Mode" && reconcileActionMode(values) !== null) continue;
    keys.push(key);
    const quoted = values.map((v) => "'" + v + "'").join(" vs ");
    details.push(`${key}: ${quoted}`);
  }
  if (keys.length === 0) return null;
  return { keys, details, blockCount: blocks.length };
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
    | "v2-invalid-cell"
    | "block-disagreement";
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

export interface TextVerdict {
  /** The authoritative block (the LAST complete one), or `null` if none exists. */
  readonly block: readonly string[] | null;
  /** Violations of the authoritative block, plus any `block-disagreement`. */
  readonly violations: readonly Violation[];
  /** How many complete blocks the text carried. */
  readonly blockCount: number;
  /**
   * Governance keys resolved rather than refused (today: `Action-Mode` only).
   *
   * Carried on the verdict, not left to each caller to recompute, because the
   * authoritative BLOCK still literally contains whatever the last commit wrote.
   * An instrument that printed `verdict.block`'s `Action-Mode` for a reconciled
   * squash would report `human-directed` for a squash this module resolved as
   * autonomous — the manufacture the reconciliation exists to prevent, leaking
   * back in through the report. Callers print `resolved`.
   */
  readonly reconciliations: readonly Reconciliation[];
}

/**
 * THE whole-message entry point. Both instruments call this, so last-wins and
 * the disagreement check cannot be implemented once and forgotten once.
 *
 * Order is load-bearing: DISAGREEMENT IS CHECKED BEFORE the block is validated.
 * A squash whose constituents contradict each other on `Human-Review` must not
 * be able to come out clean merely because the block that happened to be last
 * is internally well-formed — that would be the contradiction hiding behind a
 * green check, which is the shape this whole module exists to remove.
 */
export function validateText(text: string): TextVerdict {
  const blocks = findAllSignatureBlocks(text);
  const block = blocks.length === 0 ? null : (blocks[blocks.length - 1] ?? null);
  const reconciliations = detectReconciliations(text);
  const disagreement = detectBlockDisagreement(text);
  if (disagreement !== null) {
    return {
      block,
      blockCount: blocks.length,
      reconciliations,
      violations: [
        {
          code: "block-disagreement",
          key: disagreement.keys.join(" "),
          found: disagreement.details.join("; "),
          message:
            `${String(disagreement.blockCount)} complete AgencySignature blocks disagree on a ` +
            `governance-critical field — ${disagreement.details.join("; ")}. These are ` +
            "mutually exclusive claims about the authority behind ONE change, so no " +
            "parser may pick between them; the squash must state a single answer.",
        },
      ],
    };
  }
  if (block === null) return { block: null, blockCount: 0, violations: [], reconciliations };
  return {
    block,
    blockCount: blocks.length,
    reconciliations,
    violations: validateBlock(block.join("\n")),
  };
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
    return !normalizeLineEndings(blockText)
      .split("\n")
      .some((l) => l.toLowerCase().startsWith(prefix));
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
