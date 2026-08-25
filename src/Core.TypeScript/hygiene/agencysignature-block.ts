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
  "weakest claim present, never the strongest, and never to a claim of human involvement. " +
  "The two OPTIONAL accountability keys — `Accountable-Party` and `Authority-Basis` — say who " +
  "carries blame and what authorised the act; they never reconcile and never layer, and a " +
  "block that omits them is read as SILENT, never as a default. `Human-Review` and " +
  "`Human-Review-Evidence` reconcile the same way and in the same direction as `Action-Mode` — " +
  "to the WEAKEST claim present, never upward to a claim of review, only to a value some " +
  "constituent actually wrote, and only when the resolved pair still satisfies the cross-field " +
  "constraint. NO ACCOUNTABILITY ANCHOR IS REQUIRED for that: the rostered pair never guarded " +
  "the DIRECTION of the resolution, and requiring it left every v1 squash with honestly-mixed " +
  "review provenance permanently red.";

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

// ---------------------------------------------------------------------------
// THE ACCOUNTABILITY KEYS (added 2026-08-24, additive, optional)
// ---------------------------------------------------------------------------
// `Human-Review` does TWO jobs in ONE field, and every governance deadlock this
// module has produced is an artifact of that:
//
//   (a) A NAMED PARTY IS ACCOUNTABLE for what lands here. Constant across every
//       commit of a branch, because it follows from a standing grant.
//   (b) A HUMAN READ THIS DIFF. Legitimately varies per commit.
//
// Job (a) is why the field is governance-critical and why a disagreement in it
// must be loud. Job (b) is a per-commit causal fact of exactly the kind
// `Action-Mode` carries. Sharing one field, they make honest per-commit records
// read as contradictions about authority. Measured, on `origin/main`:
//
//   * `Human-Review: not-implied-by-credential` is 15,387 of 15,516 blocks over
//     the last 3,000 commits — 99.17%. THE CENTRAL GOVERNANCE FIELD SPENDS 99% OF
//     ITS RECORDS SAYING WHAT DID NOT HAPPEN, phrased as a negation of the word in
//     its own key. The steady state has no affirmative spelling.
//   * `.claude/rules/no-directives.md` §"Source ≠ authorization" already names the
//     invariant the schema lacks — *"only a human may attach, **for now** (until
//     legal entities can hold AI-side responsibility). 'This should happen,'
//     carries **blame**."* Three things are encoded there and absent here: the
//     tracked property is BLAME, human-only is explicitly PROVISIONAL, and the
//     release condition is named. The rule is time-aware; the schema hardcodes the
//     present moment.
//   * The same rule's standing-authorization clause has NO SPELLING AT ALL here.
//     An agent acting inside a standing grant must currently record that as an
//     ABSENCE (`not-implied-by-credential`) because the vocabulary has no word for
//     inheritance. `Authority-Basis: standing-grant` is that missing word.
//
// So: name the accountable party directly, and say what authorised the act.
// Diagnosis + measurements: docs/research/2026-08-24-liability-is-the-invariant-
// human-ness-is-its-current-binding-and-the-squash-carrier-already-layers.md
//
// BOTH KEYS ARE OPTIONAL, IN v1 AND v2 ALIKE, AND THAT IS DELIBERATE. Requiring
// them would invalidate 17,087 v1 blocks in one commit and force every producer to
// change at once. Every previously-valid block stays valid; a block that omits
// them is exactly as valid as it is today, and it is READ AS SILENT — never as a
// default. Inferring an accountable party from `not-implied-by-credential` is
// impossible (the information was never captured) and asserting one anyway would
// be the manufacture-an-authorisation failure this whole module exists to prevent.

/** The two keys that carry the accountability claim. Optional; never inferred. */
export const ACCOUNTABILITY_KEYS: readonly string[] = ["Accountable-Party", "Authority-Basis"];

/**
 * `Accountable-Party` — WHO CARRIES BLAME if this change is wrong.
 *
 * An identity, not an actor class, which is the point: it accommodates a human, a
 * company, or — if some jurisdiction ever recognises one — an AI, with no rename.
 * `Human-Review` would need one. Aaron 2026-08-24: *"the only thing that has to be
 * human held for now is liability or at least a company like Lucent Financial Group
 * because of the legal jurisdiction and it's rules where it lives. That is not
 * something i expect to be forever like that."*
 *
 * A ROSTER, NOT A FREE STRING, and the roster is short on purpose. `Accountable-Party:
 * nobody` or `: the-team` would pass a shape check while naming no one who could have
 * withheld the act — a field that cannot fail. The two values below are the two Aaron
 * named: LFG for LFG repos, himself for AceHack repos. Additions are maintainer-
 * authorized, exactly like every other enum addition in this file.
 *
 * WHAT THIS DOES NOT CHECK, stated so the gap is not mistaken for coverage: nothing
 * here verifies that the named party ACCEPTED the accountability. A block may name
 * LFG on a commit LFG never saw. That is the same limit `Human-Review: explicit` has
 * always had, and the same one the `Human-Review` claim-verification job was added to
 * close from the other side; it is not made worse here.
 */
export const ACCOUNTABLE_PARTIES: readonly string[] = ["acehack", "lucent-financial-group"];

/**
 * `Authority-Basis` — WHAT MAKES THIS ACT AUTHORISED. The three values are
 * `.claude/rules/no-directives.md`'s own three cases, not a fresh taxonomy:
 *
 *   standing-grant       acting inside authority already given, broadly and
 *                        indefinitely ("Standing authorization is already given …
 *                        do NOT per-action ask"). THE 99% CASE, and the word the
 *                        schema has been missing — the shadow may INHERIT authority,
 *                        and inheritance currently has to be recorded as an absence.
 *   per-act              a fresh, specific authorization for this change.
 *   gated-class-approval a gated class was opened (budget, WONT-DO, HARD LIMITS,
 *                        non-reversible, force-push, large external-repo change).
 */
export const AUTHORITY_BASES: readonly string[] = [
  "standing-grant",
  "per-act",
  "gated-class-approval",
];

/**
 * Enums checked ONLY WHEN THE KEY IS PRESENT. Kept separate from `ENUMS` rather
 * than flagged inside it: `ENUMS` reads an absent key as `""` and would fail every
 * v1 block on the empty value, which is the opposite of additive.
 */
export const OPTIONAL_ENUMS: readonly {
  readonly key: string;
  readonly allowed: readonly string[];
}[] = [
  { key: "Accountable-Party", allowed: ACCOUNTABLE_PARTIES },
  { key: "Authority-Basis", allowed: AUTHORITY_BASES },
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
 * THREE governance keys are resolved rather than refused — `Action-Mode`,
 * `Human-Review`, `Human-Review-Evidence` — and NEVER by last-wins. See the
 * RECONCILABLE section above `GOVERNANCE_KEYS` and §GENERALISATION below it: each
 * vocabulary is ordered by how much human backing it claims and the MINIMUM wins, so
 * a resolution can only weaken a claim. Last-wins stays forbidden for all three,
 * precisely because it would let commit ordering decide whether a squash reads as
 * human-directed or human-reviewed.
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
  "Human-Review", // THE accountability claim — RECONCILABLE to the weakest, see §GENERALISATION
  "Human-Review-Evidence", // that claim's evidence (spec Section 5.3) — RECONCILABLE with it
  "Action-Mode", // autonomous vs supervised vs human-directed — RECONCILABLE, see above
  // THE TWO ACCOUNTABILITY KEYS. Governance-critical and NEVER reconcilable — see
  // `accountabilityAnchor`. Adding them here can only ADD failures: no block on
  // `main` carries either key (measured: 0 of 17,162), so nothing existing changes.
  "Accountable-Party",
  "Authority-Basis",
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

// ---------------------------------------------------------------------------
// ACCOUNTABILITY DOES NOT LAYER — and that is what buys the rest
// ---------------------------------------------------------------------------
// A CHANGE WITH TWO ACCOUNTABLE PARTIES HAS NO ACCOUNTABLE PARTY. So
// `Accountable-Party` and `Authority-Basis` are governance keys with NO
// reconciliation and no last-wins: two different named parties in one squash is
// LOUD, permanently, and there is no rule that resolves it. If the accountable
// party genuinely differs across a squash's constituents, that is not a layering
// opportunity — it is a signal the commits should not have been squashed together,
// and surfacing that is the check doing its job rather than failing at it.
//
// SILENCE IS NOT A COMPETING CLAIM. A block that omits the key is compared as
// absent, not as a value: a squash where one constituent names `acehack` and
// another says nothing is quiet, and the named claim survives. Two reasons, both
// necessary:
//
//   * It is the only way the migration can be incremental. Treating absence as a
//     value would make every branch red the moment its newest commit adopted the
//     key, which is a schema change disguised as a gate.
//   * The escalation argument runs the OTHER WAY for this field. `Human-Review`
//     must be loud on partial claims because picking one manufactures an
//     authorization nobody gave. `Accountable-Party` names who carries BLAME —
//     accepting liability for work whose other constituent named nobody is not a
//     privilege escalation, it is the opposite of one. The direction of the error
//     is what licenses the tolerance, exactly as it does for `Action-Mode`.

/**
 * The single accountability claim every block in `blocks` shares, or `null`.
 *
 * Requires FULL coverage — every block carries the same non-empty
 * `Accountable-Party` AND the same non-empty `Authority-Basis`.
 *
 * NO LONGER A GATE (2026-08-24, second pass — see §GENERALISATION below). This
 * used to be the precondition for reconciling `Human-Review`. It is not any more,
 * because it never guarded the property that makes the reconciliation safe: the
 * DIRECTION. It is retained as the canonical query for "does this squash carry one
 * agreeing, rostered accountability claim", and it is still what the falsifiers use
 * to show that a partial or unrostered pair is not an anchor. What it must never
 * again become is a coverage toll on a resolution that was already sound without it.
 */
export function accountabilityAnchor(
  blocks: readonly (readonly string[])[],
): { readonly party: string; readonly basis: string } | null {
  if (blocks.length === 0) return null;
  const parties = new Set(blocks.map((b) => blockValue(b.join("\n"), "Accountable-Party")));
  const bases = new Set(blocks.map((b) => blockValue(b.join("\n"), "Authority-Basis")));
  if (parties.size !== 1 || bases.size !== 1) return null;
  const party = [...parties][0] ?? "";
  const basis = [...bases][0] ?? "";
  if (party === "" || basis === "") return null;
  if (!ACCOUNTABLE_PARTIES.includes(party) || !AUTHORITY_BASES.includes(basis)) return null;
  return { party, basis };
}

// ---------------------------------------------------------------------------
// GENERALISATION: the anchor was a coverage toll, not a safety property
// (2026-08-24, second pass — Aaron: *"we need to make agencysignature more self
// healing"*)
// ---------------------------------------------------------------------------
// The `Human-Review` reconciliation above shipped gated on `accountabilityAnchor`.
// That gate is removed here, and the reason is that it never did the job the
// comment around it claimed. Measured on two live PRs the night this was written:
//
//   * #13909 — 18 commits. Exactly ONE (`75ac62459`, a security fix) carries
//     `Human-Review: explicit` / `Human-Review-Evidence: chat` /
//     `Action-Mode: human-directed`. The rest carry
//     `not-implied-by-credential` / `none` / `autonomous-fail-closed`.
//     `Credential-Mode` (`shared`) and the version (`1`) AGREE across all of them,
//     and NO block carries either accountability key — as no block on `main` does
//     (0 of 17,162). So the anchored path could never fire, and the squash preimage
//     was red on `Human-Review` alone.
//   * #14430 — the same shape, 3 commits, 2 explicit + 1 not-implied.
//
// BOTH CLAIMS ARE TRUE. The maintainer reviewed one commit in chat and did not
// review the others. That is not a defect in either PR; it is the structural
// consequence of ANY multi-commit PR with mixed review provenance, and gated on a
// key nothing on `main` carries, it recurs forever.
//
// WHY THE GATE WAS NOT WHAT MADE IT SAFE. This module's own error text names the
// hazard exactly: *"no parser may pick between them … manufacturing authorization
// nobody gave."* The manufacture is a STRENGTHENING. Taking the WEAKEST claim
// present cannot strengthen anything — structurally, not by convention:
// `explicit` is the MAXIMUM of `HUMAN_REVIEW_BY_HUMAN_AUTHORITY`, so the minimum
// of a DISAGREEING set can never be it. The loud failure is therefore warranted in
// the strengthening direction only. Under-claiming is always safe; over-claiming is
// the sin. The anchor added coverage, not direction — and it charged for a
// relaxation that was already sound.
//
// WHAT STILL HAS TEETH, since removing a gate is exactly how a check becomes one
// that cannot fail, and this file has been burned by that before. Four refusals,
// each with a falsifier in the test file:
//
//   1. A value outside the enum has no rank and is not ordered. `main` carries 25
//      out-of-enum `Human-Review` spellings over 273 blocks (`pending` x77,
//      `EXPLICIT` x38, `implied-by-interactive-session` x60, free text such as
//      `aaron-lets-do-it`). A set containing one stays LOUD.
//   2. The resolved value is always one a constituent ACTUALLY WROTE. This only
//      ever discards; it never invents. (`Action-Mode` property 1, unchanged.)
//   3. `Human-Review-Evidence` NEVER reconciles on its own — only as a consequence
//      of a review disagreement, and only to `none` when some constituent wrote
//      `none`. Two live evidence pointers under an agreeing review are two TRUE
//      statements and collapsing them would assert there is no evidence when there
//      is. The evidence order is a PARTIAL one for exactly that reason.
//   4. THE CROSS-FIELD GUARD, new here and load-bearing precisely because removing
//      the anchor makes its shape reachable: the resolved PAIR must satisfy
//      `validateReviewConsistency`. Without it, a squash whose blocks disagree on
//      review while all citing `chat` would resolve to
//      (`not-implied-by-credential`, `chat`) — an authoritative reading the schema
//      itself refuses, reported green. That set stays LOUD.
//
// AND THE SCOPE IS STILL NARROW. `Credential-Mode`, `Agency-Signature-Version`,
// `Accountable-Party` and `Authority-Basis` are untouched: a disagreement in any of
// them is as loud as it has ever been. Only the three keys that describe HOW ONE
// COMMIT WAS MADE — `Action-Mode`, and now the two review keys that vary with it —
// reconcile.
//
// WHAT IS GIVEN UP is the same loss the `Action-Mode` reconciliation already
// accepted one screen up, and it is real: #13909's genuinely-reviewed security fix
// lands under an authoritative reading that says no human reviewed the change, with
// no per-commit attribution left to recover it from. The record may understate human
// backing. It may never overstate it. That asymmetry is the entire warrant.

/**
 * The `Human-Review` vocabulary ordered by HOW MUCH HUMAN BACKING IT CLAIMS,
 * weakest first — the same construction as `ACTION_MODE_BY_HUMAN_AUTHORITY`.
 *
 *   0 `none`                       no human review. The flat denial: claims the
 *                                  least of the three, so recording it can never
 *                                  flatter anyone.
 *   1 `not-implied-by-credential`  declines to claim review. Above `none` because
 *                                  it is a narrower denial — it says the credential
 *                                  does not IMPLY a review, not that none happened.
 *   2 `explicit`                   a human reviewed this.
 *
 * The `none` / `not-implied-by-credential` ordering is only ever reachable by a
 * squash carrying both, which is rare (240 and 16,130 blocks respectively across
 * all of `main`); the pair is near-synonymous and either order understates.
 */
export const HUMAN_REVIEW_BY_HUMAN_AUTHORITY: readonly string[] = [
  "none",
  "not-implied-by-credential",
  "explicit",
];

/**
 * Resolve several `Human-Review` values to the single weakest claim, or `null`.
 *
 * Read it as "what is the weakest of these", not "may this be resolved" — the
 * whole-answer question is `reconcileReviewPair`, which adds the cross-field guard.
 *
 * A NOTE ON THE GUARD THAT IS NOT HERE, because a check that cannot fail is worse
 * than no check and this file has been burned by exactly that. `reconcileActionMode`
 * refuses any set whose minimum still claims a human was involved, and that refusal
 * has teeth because `Action-Mode` has TWO presence values (`supervised`,
 * `human-directed`) neither of which implies the other. `Human-Review` has exactly
 * ONE presence value and it is the MAXIMUM, so the minimum of a disagreeing set can
 * never be a presence claim. Writing the same guard here would be a line that can
 * never fire, dressed as safety.
 *
 * That structural fact is ALSO why this no longer sits behind an accountability
 * anchor (§GENERALISATION above): the anchor was coverage, and the direction was
 * never in its keeping.
 *
 * What DOES refuse, non-vacuously and measurably: a value outside the enum has no
 * rank and is not ordered. `main` carries 25 out-of-enum `Human-Review` spellings
 * over 273 blocks (`pending` x77, `EXPLICIT` x38, `implied-by-interactive-session`
 * x60, and free text such as `aaron-lets-do-it`). None of those is guessed into
 * position; a set containing one stays loud.
 */
export function reconcileHumanReview(values: readonly string[]): string | null {
  const distinct = [...new Set(values)];
  if (distinct.length === 0) return null;
  if (distinct.length === 1) return distinct[0] ?? null;
  const ranks = distinct.map((v) => HUMAN_REVIEW_BY_HUMAN_AUTHORITY.indexOf(v));
  if (ranks.some((r) => r < 0)) return null;
  return HUMAN_REVIEW_BY_HUMAN_AUTHORITY[Math.min(...ranks)] ?? null;
}

/**
 * The `Human-Review-Evidence` vocabulary ordered by HOW MUCH EVIDENCE IT CLAIMS,
 * weakest first — and unlike the other two orders this one is deliberately PARTIAL,
 * expressed as tiers rather than a flat list, because a total order here would be a
 * fiction with real consequences.
 *
 *   tier 0  `none`                                       THE ONLY ABSENCE CLAIM.
 *           Claims no evidence exists, so recording it can never flatter anyone —
 *           the same role `autonomous-fail-open` plays for `Action-Mode` and `none`
 *           plays for `Human-Review`. It is the unique floor, which is what makes a
 *           weakest element exist at all.
 *
 *   tier 1  `chat` · `pr-review` · `pr-comment` ·         ALL PRESENCE CLAIMS,
 *           `signed-policy`                               MUTUALLY INCOMPARABLE.
 *           Each names a DIFFERENT PLACE a review is recorded, not a different
 *           AMOUNT of review. `pr-review` is not weaker than `signed-policy` and
 *           `chat` is not weaker than `pr-comment`; they are four pointers, and
 *           picking between two live ones would DISCARD a true evidence pointer
 *           while keeping another — inventing nothing, but destroying a fact for no
 *           reason a reader could reconstruct. So within this tier there is no
 *           minimum and nothing reconciles: the set stays LOUD.
 *
 * The consequence, which is the whole behaviour: a set reconciles iff `none` is in
 * it. Anything else with two or more distinct values has no weakest element.
 */
export const HUMAN_REVIEW_EVIDENCE_BY_EVIDENCE_STRENGTH: readonly (readonly string[])[] = [
  ["none"],
  ["chat", "pr-review", "pr-comment", "signed-policy"],
];

/** The weakest evidence value — the unique tier-0 member, named once. */
const WEAKEST_EVIDENCE = HUMAN_REVIEW_EVIDENCE_BY_EVIDENCE_STRENGTH[0]?.[0] ?? "none";

/**
 * Resolve `Human-Review-Evidence` — but ONLY as a consequence of a `Human-Review`
 * reconciliation, never on its own. Four refusals, each with a falsifier:
 *
 *   * the review values must actually have DISAGREED. Blocks that all claim the
 *     same review state but cite different evidence are NOT reconciled: that shape
 *     is either two live evidence pointers (both true, and collapsing them to
 *     `none` would assert there is no evidence when there is) or a block violating
 *     the cross-field constraint. Either way it stays loud.
 *   * the resolved review must be non-`explicit`. `Human-Review: explicit` requires
 *     evidence `!= 'none'` (`validateReviewConsistency`), so resolving evidence to
 *     `none` under an explicit review would manufacture an invalid block.
 *   * `none` must be a value some constituent ACTUALLY WROTE. Property 1 of the
 *     `Action-Mode` reconciliation, unchanged: this only ever discards values, it
 *     never invents one. Equivalently, in the vocabulary of the order above: the set
 *     must contain the unique tier-0 member, because tier 1 has no minimum.
 *   * every value must be IN THE ENUM. An unknown evidence spelling has no tier, so
 *     it is not ordered and not reconciled — the same refusal `reconcileActionMode`
 *     and `reconcileHumanReview` make, stated here rather than left implicit.
 */
export function reconcileReviewEvidence(
  reviewValues: readonly string[],
  evidenceValues: readonly string[],
): string | null {
  if (new Set(reviewValues).size < 2) return null;
  const review = reconcileHumanReview(reviewValues);
  if (review === null || review === "explicit") return null;
  const distinct = [...new Set(evidenceValues)];
  const known = HUMAN_REVIEW_EVIDENCE_BY_EVIDENCE_STRENGTH.flat();
  if (distinct.some((v) => !known.includes(v))) return null;
  if (distinct.length <= 1) return distinct[0] ?? null;
  return distinct.includes(WEAKEST_EVIDENCE) ? WEAKEST_EVIDENCE : null;
}

/**
 * THE WHOLE ANSWER for the two review keys: the pair a squash is read as carrying,
 * or `null` when it must stay loud. One function, so the disagreement check and the
 * reconciliation report cannot drift — the defect this whole module was extracted to
 * remove, reproduced at a smaller scale, is two implementations of one rule.
 *
 * The two keys are resolved TOGETHER because they are constrained together. Resolving
 * them independently is not a smaller version of this — it is a different and wrong
 * answer, reachable in practice: blocks disagreeing on `Human-Review` while all citing
 * `Human-Review-Evidence: chat` resolve, key by key, to
 * (`not-implied-by-credential`, `chat`) — a pair `validateReviewConsistency` refuses,
 * manufactured by a resolution and reported as green. THE GUARD IS THE LAST LINE.
 *
 * Not gated on `accountabilityAnchor`; see §GENERALISATION above for why the anchor
 * was coverage rather than safety.
 */
export function reconcileReviewPair(
  reviewValues: readonly string[],
  evidenceValues: readonly string[],
): { readonly review: string; readonly evidence: string } | null {
  const review = reconcileHumanReview(reviewValues);
  if (review === null) return null;
  const distinctEvidence = [...new Set(evidenceValues)];
  // A single evidence value is not a reconciliation — it is simply what every block
  // said — but it is still what the resolved PAIR carries, so it must face the guard.
  const evidence =
    distinctEvidence.length === 1
      ? (distinctEvidence[0] ?? "")
      : reconcileReviewEvidence(reviewValues, evidenceValues);
  if (evidence === null) return null;
  const consistency = validateReviewConsistency(
    `Human-Review: ${review}\nHuman-Review-Evidence: ${evidence}`,
  );
  if (consistency !== null) return null;
  return { review, evidence };
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
 * The three reconcilable keys are named LITERALLY rather than looked up in a table.
 * A table is an invitation: the next key added to it would inherit this exemption
 * without inheriting the argument for it, and the argument is specific to fields that
 * describe HOW ONE COMMIT WAS MADE rather than what THE CHANGE claims.
 */
export function detectReconciliations(text: string): readonly Reconciliation[] {
  const blocks = findAllSignatureBlocks(text);
  if (blocks.length < 2) return [];
  const out: Reconciliation[] = [];
  const distinct = (key: string): readonly string[] => [
    ...new Set(blocks.map((b) => blockValue(b.join("\n"), key))),
  ];

  const actionModes = distinct("Action-Mode");
  if (actionModes.length >= 2) {
    const resolved = reconcileActionMode(actionModes);
    if (resolved !== null) out.push({ key: "Action-Mode", resolved, from: actionModes });
  }

  // The two review keys, resolved as ONE pair (`reconcileReviewPair`) and reported
  // as two entries — one per key that actually had something discarded. A key whose
  // blocks all agreed is not a reconciliation and must not be printed as one, or the
  // note becomes always-on and therefore carries no information.
  const reviews = distinct("Human-Review");
  const evidence = distinct("Human-Review-Evidence");
  if (reviews.length >= 2 || evidence.length >= 2) {
    const pair = reconcileReviewPair(reviews, evidence);
    if (pair !== null) {
      if (reviews.length >= 2) {
        out.push({ key: "Human-Review", resolved: pair.review, from: reviews });
      }
      if (evidence.length >= 2) {
        out.push({ key: "Human-Review-Evidence", resolved: pair.evidence, from: evidence });
      }
    }
  }
  return out;
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
  const reviewValues = [...new Set(blocks.map((b) => blockValue(b.join("\n"), "Human-Review")))];
  const evidenceValues = [
    ...new Set(blocks.map((b) => blockValue(b.join("\n"), "Human-Review-Evidence"))),
  ];
  // Computed ONCE, for both review keys, from the same function the reconciliation
  // report uses. Deciding the two keys separately here is what would let the report
  // and the gate disagree about the same squash.
  const reviewPair = reconcileReviewPair(reviewValues, evidenceValues);
  for (const key of GOVERNANCE_KEYS) {
    let values = [...new Set(blocks.map((b) => blockValue(b.join("\n"), key)))];
    // SILENCE IS NOT A COMPETING CLAIM — for the accountability keys only, and for
    // the reason given above `accountabilityAnchor`: absence of a blame claim is
    // not a rival blame claim, and treating it as one would make the migration
    // impossible. Two DIFFERENT named parties still land in `keys` below, loudly.
    if (ACCOUNTABILITY_KEYS.includes(key)) values = values.filter((v) => v !== "");
    if (values.length <= 1) continue;
    // The reconcilable keys. Everything else here is untouched: a differing
    // `Credential-Mode`, `Agency-Signature-Version`, `Accountable-Party` or
    // `Authority-Basis` is still an error, and each reconciler itself refuses the
    // sets that would manufacture a claim.
    if (key === "Action-Mode" && reconcileActionMode(values) !== null) continue;
    if ((key === "Human-Review" || key === "Human-Review-Evidence") && reviewPair !== null) {
      continue;
    }
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
    | "accountability-half-recorded"
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

  // OPTIONAL enums — checked only when the key is present, so a v1 block that
  // omits both is exactly as valid as it is today.
  for (const { key, allowed } of OPTIONAL_ENUMS) {
    const value = blockValue(blockText, key);
    if (value === "") continue;
    if (!allowed.includes(value)) {
      return [
        {
          code: "invalid-enum",
          key,
          found: value,
          message: `invalid enum value for ${key}: '${value}' — expected one of: ${allowed.join(", ")}`,
        },
      ];
    }
  }

  const accountability = validateAccountabilityPair(blockText);
  if (accountability !== null) return [accountability];

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
   * Governance keys resolved rather than refused (`Action-Mode`, `Human-Review`,
   * `Human-Review-Evidence` — the three that describe how one COMMIT was made).
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

/**
 * The accountability pair is all-or-nothing.
 *
 * `Accountable-Party` with no `Authority-Basis` names who carries blame without
 * saying what made the act authorised; `Authority-Basis` with no
 * `Accountable-Party` claims an authorisation with nobody behind it — the second is
 * strictly worse, since `standing-grant` with no named grantor is an authority
 * asserting itself. Half a record is not a cheap partial record here, it is a claim
 * that reads as complete. Same shape as the `Human-Review` / `Human-Review-Evidence`
 * constraint one function down, and for the same reason.
 */
export function validateAccountabilityPair(blockText: string): Violation | null {
  const party = blockValue(blockText, "Accountable-Party");
  const basis = blockValue(blockText, "Authority-Basis");
  if (party === "" && basis === "") return null; // silent, and silence is legal
  if (party !== "" && basis !== "") return null;
  const present = party === "" ? "Authority-Basis" : "Accountable-Party";
  const absent = party === "" ? "Accountable-Party" : "Authority-Basis";
  return {
    code: "accountability-half-recorded",
    key: absent,
    found: party === "" ? basis : party,
    message:
      `${present} is present but ${absent} is missing — the accountability claim is ` +
      "all-or-nothing: naming a party without a basis says who is blamed but not what " +
      "authorised the act, and naming a basis without a party is an authority asserting " +
      "itself. Record both, or record neither and be read as silent.",
  };
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
