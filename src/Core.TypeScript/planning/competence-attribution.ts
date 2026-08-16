/**
 * competence-attribution.ts — the EVENT SOURCE for per-(agent, hat, jurisdiction) competence.
 *
 * This module records outcomes and typed treatment edges. It does **not** estimate skill
 * and it is **not wired into any aggregation**. The estimator already exists —
 * `traveler-rank-ledger.ts` (ADF/TrueSkill probit posterior per (traveler, hat-domain),
 * the TS port of `src/Core/TravelerRankLedger.fs`) — and this module folds into it.
 * `calibration-ledger.ts` is the fast Beta(2,2) sibling; neither is re-derived here.
 *
 * REGISTER: `unmetered`, and the store ships EMPTY. Nothing here measures anyone until
 * real usage exists (Aaron 2026-08-16: competence is measured by *"use of the product …
 * the bugs discovered during use and how much it's used without issues"*, and *"once we
 * have more active use"*). A reading over an empty log is a statement about ignorance,
 * which is why `CompetenceReading` has a `prior-only` case a caller cannot mistake for a
 * measurement.
 *
 * ── 1. The edge is a TYPED, SIGNED TREATMENT (Shepard's / KeyCite) ─────────────────
 *
 * A later case does not merely *cite* an earlier one — it **follows**, **distinguishes**,
 * **limits**, **criticizes**, or **overrules** it, and "is this still good law?" is a
 * FOLD over those typed treatments, not a count of citations. That is this repo's
 * emit/retract algebra, in production and carrying legal liability since 1873. So an edge
 * here carries a treatment, never bare existence: untyped "agent X touched this" cannot
 * distinguish *authored* from *approved* from *warned-about-and-was-overruled* — and that
 * last is the strongest competence evidence there is (a lone correct finding, overruled by
 * quorum, vindicated by use).
 *
 * The consequence is the scoring rule, and it resolves attribution for anyone who took a
 * position: **each treatment is a falsifiable CLAIM about the subject, and reality settles
 * each claim separately.** An agent's observation is `stance === outcome`, not the outcome
 * itself. Nothing is divided, so no division rule is needed — the warner and the approver
 * of the same failed change get opposite observations from one event.
 *
 * ── 2. AGREEMENT IS THE PRIOR, USE IS THE LIKELIHOOD ───────────────────────────────
 *
 * Aaron 2026-08-16: *"we can use agree as a early indicator of correctness but only use is
 * the ultimate determinator."* Agreement seeds `SkillBelief.mu`; use-outcomes ADF-update
 * it; the two are never averaged. Every reading reports `priorShare = σ²/σ₀²`, so a number
 * still resting on agreement is legible as such. The prior is capped at |μ₀| ≤
 * `MAX_AGREEMENT_PRIOR_MU` = 1.0 because that is weak enough to be moved: measured under
 * this estimator (σ₀² = 1, β = 1), ONE contrary use-observation flips the sign of μ₀ ∈
 * {0.25, 0.5, 0.75} and two flip μ₀ = 1.0; priorShare falls to 0.27 at k=5, 0.15 at k=10.
 * An agreement prior may NEVER weight the aggregator that produced it —
 * `agreementPriorAdmissibleFor` refuses that loop by id.
 *
 * ── 3. INDEPENDENCE — two invariants, both mechanical ──────────────────────────────
 *
 *   (a) SERIES INDEPENDENCE. "Upheld" must never be defined by the board that aggregates,
 *       or a popular reviewer becomes competent by construction. Evidence is typed by
 *       independence class (`EVIDENCE_INDEPENDENCE`); a `review-derived` kind is
 *       inadmissible to any FOLDED series (`independenceViolations()`). Review-derived
 *       facts are still recorded — in `review-vote`, which is never folded.
 *
 *   (b) LABELER INDEPENDENCE. Labels are JUDGMENTS, not measurements: *"bugs are very
 *       subjective in their readings … it will be a human user or some agentic user that
 *       labels something as a bug"* (Aaron 2026-08-16). Subjectivity is not the defect —
 *       Shepard's treatments are editor-authored too. The defect is self-certification, so
 *       the invariant is narrow and checkable:
 *         **the labeler must not be the agent whose posterior the label updates.**
 *       A different party, later, with new information (it actually failed in use) is
 *       independent of the review vote even though it is a judgment. Enforced in
 *       `attribute`; self-labeled pairs are diverted to the mechanism bucket, never folded.
 *
 *   Recursion, named and deliberately not descended: if labels are authored, labeler
 *   judgment quality matters, and one could try to measure the labeler — recursively.
 *   Shepard's has the same structure and does not solve it by measuring its editors; it
 *   solves it with editorial standards and by making each treatment VISIBLE AND
 *   CHALLENGEABLE. So `OutcomeRecord.labeler` is required and recorded: an *unattributed*
 *   label is the thing refused, not a subjective one.
 *
 * ── 4. ATTRIBUTION IS A QUERY, NOT A WRITE ─────────────────────────────────────────
 *
 * Aaron's LexisNexis lineage: *"we used meta data to track the different contribution
 * layers instead of mutating the original source, so every layer survived and could be
 * pointed at as an attribution graph surface."* An `OutcomeRecord` carries no agent and no
 * blame — it is a fact about a SUBJECT. Edges are non-destructive metadata over it. Blame
 * is computed by `attribute(…, rule)` at read time under a NAMED rule whose id travels
 * with the reading, so changing the rule is a re-query, not a loss. Substrate: P1 umbrella
 * `081KSXN940008QG0R001YABTHH` (first-class labels/tags + scopes on every G-Set/Z-set
 * entity) — an edge is a facet on a Z-set entity, in that row's own vocabulary; DV2.0
 * hub/link/satellite (`.claude/rules/dv2-data-split-discipline-activated.md`); standing
 * rule `memory/feedback_preserve_original_and_every_transformation.md` — *"the final
 * output is not the artifact — the trail is the artifact."*
 *
 * ── 5. JURISDICTION — binding vs persuasive, i.e. partial pooling ──────────────────
 *
 * Aaron 2026-08-16: *"we also support jurisdictional awareness so these findings might be
 * true for one jurisdiction but not another."* A verdict carries its scope, so competence
 * is per (agent, hat, jurisdiction) — and label subjectivity is the SAME mechanism, not a
 * second one: two users disagreeing about whether something is a bug is usually *"a bug in
 * my context, not in yours."* Scoping alone would fragment the evidence into permanent
 * uncertainty, which is why Shepard's answer matters: an out-of-jurisdiction authority is
 * **persuasive, not binding** — evidence at reduced weight, never discarded. That is
 * hierarchical partial pooling under a legal name (Gelman & Hill 2007, ch. 12).
 * `persuasiveWeight` implements the discount; `temperedUpdate` applies it.
 *
 * The hierarchy is DERIVED, not invented: jurisdictions are slash-separated scope paths and
 * distance is measured on shared prefix, so the one real hierarchy in-tree today (the
 * per-language oracle lanes under `src/Core*`) works without inventing a courthouse.
 *
 * ── 6. UNATTRIBUTABLE ⇒ NO UPDATE, and it measures the MECHANISM ───────────────────
 *
 * Aaron 2026-08-16: *"this should mostly just not move weights of the team when this
 * happens but hopefully we have an escape hatch that lets us improve mechanism in these
 * cases."* A defect from an INTERACTION between treatments, or from an OMISSION no edge
 * contains, is **not an observation about any individual** — so no likelihood applies and
 * NO posterior moves. Smearing it across the team would be the unweighted-aggregation
 * defect (PR #10945, found live in PR #10955) reintroduced at the attribution layer.
 *
 * A no-update must not read as a clean record, so every reading carries `mechanismSeen`:
 * "we learned nothing about these agents" stays distinguishable from "they were fine".
 * The escape hatch is `mechanismCoverage` — unattributable, self-labeled and scoped-out
 * outcomes bank against the ATTRIBUTION MECHANISM rather than against an agent (keeping
 * `.claude/rules/every-bug-has-economic-value.md` whole: the ΔU is not destroyed, the
 * learner is the system). A rising rate means the graph is missing edges or the treatment
 * vocabulary is too coarse to express what happened.
 *
 * OPEN CASE, deliberately not decided (Aaron said *"mostly"*): an interaction foreseeable
 * by someone whose HAT covers integration may be attributable to a ROLE even when it is
 * attributable to no edge. Deciding that here would quietly re-enable blame for exactly the
 * class that produces no evidence, so it is flagged for the human maintainer.
 *
 * ── Storage ────────────────────────────────────────────────────────────────────────
 *
 * `db/competence-outcomes/{edges,outcomes}/<recorder>.jsonl` — append-only JSONL, one file
 * per recorder so concurrent writers never contend, deduplicated by content address on
 * read. Same pattern and reasoning as `db/mutation-findings/`. NOT `db/uncertainty/`: that
 * ledger is single-scoped to ΔU and commutative (`db/ledgers/README.md` — *"A ledger holds
 * exactly one scope"*), whereas ADF is order-DEPENDENT (measured: the multiset {3 hits, 2
 * misses} folds to μ = 0.2113 in one order and 0.1829 in another), so this store defines a
 * canonical order and cannot claim the uncertainty ledger's order-freedom.
 *
 * Timestamps are the timestamp OF THE FACT (the defect's opened-at, the commit's
 * committed-at), never a wall clock at recording time — a recorder's local clock must not
 * enter a shared fold (`.claude/rules/local-time-never-enters-the-shared-fold.md`), and a
 * derived timestamp is what makes re-import idempotent.
 *
 * Anchors: Shepard's Citations (1873) / KeyCite — typed, signed treatment folds over
 * precedent (published Beacon anchor; treatments are editor-authored judgments, and the
 * red/yellow/green flag is a confidence annotation on the fold); Aaron Stainback's
 * LexisNexis content-attribution-graph work (private lineage); Gelman & Hill 2007
 * (hierarchical partial pooling); Herbrich, Minka & Graepel 2006 (TrueSkill); Minka 2001
 * (EP/ADF); Forsgren, Humble & Kim 2018 (*Accelerate* — DORA).
 */

import { appendFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

import { stringCompare } from "../collation/collation";
import {
  BETA,
  MU_0,
  SIGMA_0,
  emptyLedger,
  recordOutcome,
  trustBand,
  updateBelief,
  type SkillBelief,
  type TravelerRankLedger,
} from "./traveler-rank-ledger";

// ─────────────────────────────────────────────────────────────────────────────
// Series — the slow determinator and the fast proxies are NEVER one number
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Outcome series. Each has its own posterior; they are never averaged, because they have
 * different independence properties and different lag.
 *
 * - `use-defect` — the determinator. Did the subject bite in use, or run clean?
 * - `proxy-acted-on` — fast, weak: the cited lines changed afterwards.
 * - `proxy-mutant-kill-prediction` — fast, mechanical (PR #10928 owns the task design;
 *   this module only carries settled outcomes).
 * - `review-vote` — recorded for the record, NEVER folded. This is where circularity would
 *   enter if it were foldable.
 */
export type CompetenceSeries =
  | "use-defect"
  | "proxy-acted-on"
  | "proxy-mutant-kill-prediction"
  | "review-vote";

/** The series that may be folded into a skill posterior. `review-vote` is absent BY DESIGN. */
export const FOLDED_SERIES: readonly CompetenceSeries[] = [
  "use-defect",
  "proxy-acted-on",
  "proxy-mutant-kill-prediction",
];

/** The one series Aaron named as the determinator; the rest are early indicators. */
export const DETERMINATOR_SERIES: CompetenceSeries = "use-defect";

// ─────────────────────────────────────────────────────────────────────────────
// Evidence — typed by INDEPENDENCE, which is the whole point
// ─────────────────────────────────────────────────────────────────────────────

export type EvidenceKind =
  /** A defect labeled against a subject that had shipped. */
  | "defect-in-use"
  /** A declared usage window over a shipped subject that produced no attributed defect. */
  | "clean-usage-window"
  /** A later commit changed the lines a finding cited. */
  | "fix-commit-touched-cited-lines"
  /** A regression test fails without the fix and passes with it. */
  | "regression-test-fails-without-fix"
  /** A mutant-kill prediction settled against an actual suite run. */
  | "mutant-kill-prediction-settled"
  /** A reviewer / pipeline stage requested changes. */
  | "review-changes-requested"
  /** A review thread was marked resolved. */
  | "review-thread-resolved"
  /** k-of-n reviewers agreed a finding was real. */
  | "reviewer-quorum-agreement";

/**
 * Where an evidence kind sits relative to the review vote. `review-derived` is the class
 * that must never define "upheld" for a folded series: it is produced by the same
 * population whose aggregation the resulting number would inform.
 */
export type EvidenceIndependence =
  | "downstream-of-use"
  | "downstream-of-code-change"
  | "review-derived";

export const EVIDENCE_INDEPENDENCE: Readonly<Record<EvidenceKind, EvidenceIndependence>> = {
  "defect-in-use": "downstream-of-use",
  "clean-usage-window": "downstream-of-use",
  "fix-commit-touched-cited-lines": "downstream-of-code-change",
  "regression-test-fails-without-fix": "downstream-of-code-change",
  "mutant-kill-prediction-settled": "downstream-of-code-change",
  "review-changes-requested": "review-derived",
  "review-thread-resolved": "review-derived",
  "reviewer-quorum-agreement": "review-derived",
};

/**
 * How a label came to exist. Both classes are legitimate; they are NOT interchangeable.
 * - `authored` — a human or agentic user judged it (a bug label on real use).
 * - `mechanical` — derived purely from events (a later commit changed these lines).
 */
export type LabelProvenance = "authored" | "mechanical";

export const EVIDENCE_LABEL_PROVENANCE: Readonly<Record<EvidenceKind, LabelProvenance>> = {
  "defect-in-use": "authored",
  "clean-usage-window": "authored",
  "fix-commit-touched-cited-lines": "mechanical",
  "regression-test-fails-without-fix": "mechanical",
  "mutant-kill-prediction-settled": "mechanical",
  "review-changes-requested": "authored",
  "review-thread-resolved": "authored",
  "reviewer-quorum-agreement": "authored",
};

/** Which evidence kinds each series admits. Editing this table is what the falsifier watches. */
export const SERIES_ADMITS: Readonly<Record<CompetenceSeries, readonly EvidenceKind[]>> = {
  "use-defect": ["defect-in-use", "clean-usage-window"],
  "proxy-acted-on": ["fix-commit-touched-cited-lines", "regression-test-fails-without-fix"],
  "proxy-mutant-kill-prediction": ["mutant-kill-prediction-settled"],
  "review-vote": ["review-changes-requested", "review-thread-resolved", "reviewer-quorum-agreement"],
};

/**
 * Invariant (a), stated mechanically: no FOLDED series may admit a `review-derived`
 * evidence kind. Returns the offending `series/evidence` pairs; empty means it holds. A
 * function rather than a comment, so an edit to `SERIES_ADMITS` fails a test instead of
 * silently closing the loop.
 */
export function independenceViolations(): readonly string[] {
  const out: string[] = [];
  for (const series of FOLDED_SERIES) {
    for (const evidence of SERIES_ADMITS[series]) {
      if (EVIDENCE_INDEPENDENCE[evidence] === "review-derived") {
        out.push(`${series}/${evidence}`);
      }
    }
  }
  return out.sort(stringCompare);
}

// ─────────────────────────────────────────────────────────────────────────────
// Treatments — the typed, signed edge (Shepard's, derivable subset)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How an agent treated a subject. Closed DU — the logic lives in the union, not in free
 * text.
 */
export type ContributionTreatment =
  /** Wrote the subject. An implicit assertion that it is sound. */
  | "authored"
  /** Reviewed and did not object. An explicit assertion that it is sound. (≈ *followed*.) */
  | "approved"
  /** Raised a blocking finding: an assertion the subject is NOT sound. (≈ *criticized*.) */
  | "warned"
  /** Warned, and the subject shipped with the cited lines unchanged. (≈ *criticized, not followed*.) */
  | "warned-overruled"
  /** Changed the subject after the fact — a claim about the REPAIR, not about the subject. */
  | "repaired";

export const CONTRIBUTION_TREATMENTS: readonly ContributionTreatment[] = [
  "authored",
  "approved",
  "warned",
  "warned-overruled",
  "repaired",
];

/**
 * The SIGN of the claim each treatment makes about the subject:
 *   `+1` asserts sound · `−1` asserts not sound · `0` takes no position (recorded, never folded).
 */
export type Stance = -1 | 0 | 1;

export const TREATMENT_STANCE: Readonly<Record<ContributionTreatment, Stance>> = {
  authored: 1,
  approved: 1,
  warned: -1,
  "warned-overruled": -1,
  repaired: 0,
};

/**
 * Legal treatments deliberately ABSENT: each needs a judgement about scope or reasoning
 * that no event in this substrate carries, and inventing a derivation would manufacture
 * signal — the failure this module exists to avoid. (If an authored labeler later supplies
 * them as judgments, they can be added with `authored` provenance; that is a decision for
 * the maintainer, not a silent extension.)
 */
export const NO_SOUND_MECHANICAL_ANALOGUE: readonly string[] = [
  "distinguished", // scope judgement: "applies there, not here"
  "limited", // narrowing judgement
  "harmonized", // reconciliation judgement
  "explained", // interpretive judgement
  "questioned", // doubt without a holding
];

// ─────────────────────────────────────────────────────────────────────────────
// Jurisdiction — scope paths, binding vs persuasive
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A scope path, slash-separated, most-general first — e.g. `"oracle/typescript"`,
 * `"oracle/fsharp"`, `"deploy/ci"`. Derived from structure that already exists (the
 * per-language oracle lanes); no hierarchy is invented here.
 */
// The alias is load-bearing documentation: a bare `string` at a call site cannot tell a
// scope path from a hat name, and every signature below distinguishes the two.
// eslint-disable-next-line sonarjs/redundant-type-aliases -- see above
export type Jurisdiction = string;

/** Segments of a jurisdiction path, empty segments dropped. */
function segmentsOf(j: Jurisdiction): readonly string[] {
  return j.split("/").filter((s) => s.length > 0);
}

/**
 * Distance between two jurisdictions: the number of segments not on the shared prefix,
 * summed over both. `0` = identical scope (binding).
 */
export function jurisdictionDistance(a: Jurisdiction, b: Jurisdiction): number {
  const sa = segmentsOf(a);
  const sb = segmentsOf(b);
  let shared = 0;
  for (;;) {
    const segA = sa[shared];
    const segB = sb[shared];
    if (segA === undefined || segB === undefined || stringCompare(segA, segB) !== 0) break;
    shared += 1;
  }
  return sa.length - shared + (sb.length - shared);
}

/**
 * Persuasive weight of evidence observed in `from` when reading competence in `to`.
 * `1` when binding (same scope); `1/(1+d)` otherwise.
 *
 * REGISTER: the shape (monotone decreasing, 1 at distance 0) is the anchored part;
 * the exact discount is a CHOSEN constant awaiting calibration against real data, and is
 * `unmetered`. Partial pooling is the anchor (Gelman & Hill 2007); the rate is not.
 */
export function persuasiveWeight(from: Jurisdiction, to: Jurisdiction): number {
  return 1 / (1 + jurisdictionDistance(from, to));
}

/**
 * Below this weight an observation is treated as out of scope: it does NOT update the
 * posterior and it is counted by `mechanismCoverage` instead. The guard exists so that
 * scoping cannot become a way to make inconvenient evidence disappear — evidence scoped so
 * narrowly that it updates nobody is the unattributable case in disguise, and it must
 * surface as mechanism coverage rather than vanish.
 */
export const MIN_PERSUASIVE_WEIGHT = 0.1;

// ─────────────────────────────────────────────────────────────────────────────
// Records
// ─────────────────────────────────────────────────────────────────────────────

/** One agent's typed treatment of one subject. Non-destructive: the subject is never rewritten. */
export interface TreatmentEdge {
  /** What was treated — a commit sha, changeSetId, workItemId. Opaque here. */
  readonly subjectRef: string;
  readonly agentId: string;
  readonly hatDomain: string;
  readonly treatment: ContributionTreatment;
  /** ISO-8601 timestamp OF THE TREATMENT, never a recording wall clock. */
  readonly at: string;
  /** Content address of the fields above — the natural key that makes append idempotent. */
  readonly address: string;
}

/**
 * One outcome about a subject. Carries NO agent-under-measurement and no blame: that is the
 * point of the graph. It does carry its LABELER (so a judgment is challengeable) and its
 * JURISDICTION (so a verdict carries its scope).
 */
export interface OutcomeRecord {
  readonly subjectRef: string;
  readonly series: CompetenceSeries;
  readonly evidence: EvidenceKind;
  /** `true` = the subject held up (clean window, prediction correct); `false` = it did not. */
  readonly hit: boolean;
  /** Who judged this — a human or agentic user. Required: an unattributed label is refused. */
  readonly labeler: string;
  /** The scope in which this verdict holds. */
  readonly jurisdiction: Jurisdiction;
  /** ISO-8601 timestamp OF THE FACT, never a recording wall clock. */
  readonly at: string;
  readonly address: string;
}

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;
const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function sha256Of(canonical: string): string {
  return createHash("sha256").update(canonical).digest("hex");
}

export function edgeAddress(e: Omit<TreatmentEdge, "address">): string {
  // Field ORDER is the contract: reorder and every previously recorded address changes meaning.
  return sha256Of(JSON.stringify([e.subjectRef, e.agentId, e.hatDomain, e.treatment, e.at]));
}

export function outcomeAddress(o: Omit<OutcomeRecord, "address">): string {
  return sha256Of(
    JSON.stringify([o.subjectRef, o.series, o.evidence, o.hit, o.labeler, o.jurisdiction, o.at]),
  );
}

/** Admission result — a `Result`, never an exception on the hot path. */
export type Admission<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string };

export function makeEdge(e: Omit<TreatmentEdge, "address">): Admission<TreatmentEdge> {
  if (!ISO_MS.test(e.at)) return { ok: false, reason: `non-canonical timestamp ${JSON.stringify(e.at)}` };
  if (e.subjectRef.length === 0) return { ok: false, reason: "empty subjectRef" };
  if (e.agentId.length === 0) return { ok: false, reason: "empty agentId" };
  if (!CONTRIBUTION_TREATMENTS.includes(e.treatment)) {
    return { ok: false, reason: `unknown treatment ${JSON.stringify(e.treatment)}` };
  }
  return { ok: true, value: { ...e, address: edgeAddress(e) } };
}

/**
 * Values may arrive from JSON, so these lookups take a bare `string` and report absence —
 * schema-on-read, not schema-on-faith. (Indexing the `Record` directly would let the type
 * system assert a key that the file on disk may not have.)
 */
function admittedEvidence(series: string): readonly EvidenceKind[] | undefined {
  return Object.hasOwn(SERIES_ADMITS, series) ? SERIES_ADMITS[series as CompetenceSeries] : undefined;
}

function independenceOf(evidence: string): EvidenceIndependence | undefined {
  return Object.hasOwn(EVIDENCE_INDEPENDENCE, evidence)
    ? EVIDENCE_INDEPENDENCE[evidence as EvidenceKind]
    : undefined;
}

/**
 * Admit an outcome — the write-time gates. Refuses evidence the series does not admit
 * (invariant a) and refuses an unattributed label (the precondition for invariant b: a
 * label with no labeler cannot be checked for self-certification, nor challenged later).
 */
export function admitOutcome(o: Omit<OutcomeRecord, "address">): Admission<OutcomeRecord> {
  if (!ISO_MS.test(o.at)) return { ok: false, reason: `non-canonical timestamp ${JSON.stringify(o.at)}` };
  if (o.subjectRef.length === 0) return { ok: false, reason: "empty subjectRef" };
  if (o.labeler.length === 0) return { ok: false, reason: "unattributed label: labeler is required" };
  if (o.jurisdiction.length === 0) return { ok: false, reason: "empty jurisdiction: a verdict carries its scope" };
  const admitted = admittedEvidence(o.series);
  if (admitted === undefined) return { ok: false, reason: `unknown series ${JSON.stringify(o.series)}` };
  if (!admitted.includes(o.evidence)) {
    const cls = independenceOf(o.evidence) ?? "unknown";
    return { ok: false, reason: `series ${o.series} does not admit ${o.evidence} (independence class: ${cls})` };
  }
  return { ok: true, value: { ...o, address: outcomeAddress(o) } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical order — required because ADF is order-DEPENDENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Canonical fold order: `(at, address)` under the codepoint-ordinal treaty comparator
 * (`collation/collation.ts` — never `localeCompare`).
 *
 * Load-bearing, not cosmetic: unlike a Beta-Bernoulli count, the ADF posterior is a
 * function of the ORDER of observations, so two nodes folding the same set in different
 * receive orders would otherwise disagree.
 */
export function canonicalOrder<T extends { at: string; address: string }>(records: readonly T[]): readonly T[] {
  return [...records].sort((a, b) => {
    const byAt = stringCompare(a.at, b.at);
    return byAt !== 0 ? byAt : stringCompare(a.address, b.address);
  });
}

/** Deduplicate by content address, keeping canonical order. Apply-N-times == apply-once (§12). */
export function dedupeByAddress<T extends { at: string; address: string }>(records: readonly T[]): readonly T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of canonicalOrder(records)) {
    if (seen.has(r.address)) continue;
    seen.add(r.address);
    out.push(r);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store — append-only JSONL, one file per recorder
// ─────────────────────────────────────────────────────────────────────────────

export const COMPETENCE_DIR = "db/competence-outcomes";
export const EDGES_SUBDIR = "edges";
export const OUTCOMES_SUBDIR = "outcomes";

function recorderPath(root: string, subdir: string, recorder: string): string {
  if (!SAFE_NAME.test(recorder)) {
    throw new Error(`competence-attribution: refusing unsafe recorder name ${JSON.stringify(recorder)}`);
  }
  return join(root, COMPETENCE_DIR, subdir, `${recorder}.jsonl`);
}

/**
 * Read a file that may not exist yet, without a check-then-use race.
 *
 * `existsSync` followed by `readFileSync` is a TOCTOU pattern (CodeQL `js/file-system-race`,
 * caught on PR #10976): the file can appear or vanish between the two calls. Attempting the
 * read and handling `ENOENT` is one syscall and has no window.
 */
function readIfPresent(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw err;
  }
}

/**
 * Append one JSONL line unless its content address is already recorded.
 *
 * The pre-read is a courtesy, not the guarantee: files are per-recorder (single writer), and
 * the real idempotency guard is `dedupeByAddress` on read, so a duplicate that slipped through
 * a concurrent append still folds exactly once.
 */
function appendJsonl(path: string, line: string, address: string): boolean {
  mkdirSync(join(path, ".."), { recursive: true });
  if (readIfPresent(path).includes(address)) return false;
  appendFileSync(path, `${line}\n`, "utf8");
  return true;
}

/** Append a treatment edge. Returns `false` when the address is already present (idempotent). */
export function appendEdge(root: string, recorder: string, edge: TreatmentEdge): boolean {
  return appendJsonl(recorderPath(root, EDGES_SUBDIR, recorder), JSON.stringify(edge), edge.address);
}

/** Append an outcome. Returns `false` when the address is already present (idempotent). */
export function appendOutcome(root: string, recorder: string, record: OutcomeRecord): boolean {
  return appendJsonl(recorderPath(root, OUTCOMES_SUBDIR, recorder), JSON.stringify(record), record.address);
}

function readJsonlDir<T>(root: string, subdir: string, isValid: (v: unknown) => v is T): readonly T[] {
  const dir = join(root, COMPETENCE_DIR, subdir);
  // Attempt-and-handle rather than check-then-use: an absent directory is an empty ledger,
  // and testing for it first would be the same TOCTOU shape as the append path.
  let names: readonly string[];
  try {
    names = readdirSync(dir).sort(stringCompare);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
  const out: T[] = [];
  for (const name of names) {
    if (!name.endsWith(".jsonl")) continue;
    out.push(...parseJsonlLines(readIfPresent(join(dir, name)), isValid));
  }
  return out;
}

/** Schema-on-read: a malformed line is skipped, never allowed to fail the whole fold. */
function parseJsonlLines<T>(text: string, isValid: (v: unknown) => v is T): T[] {
  const out: T[] = [];
  for (const line of text.split("\n")) {
    if (line.length === 0) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (isValid(parsed)) out.push(parsed);
    } catch {
      // malformed line — skip
    }
  }
  return out;
}

function isTreatmentEdge(v: unknown): v is TreatmentEdge {
  if (!v || typeof v !== "object") return false;
  const e = v as TreatmentEdge;
  return (
    typeof e.subjectRef === "string" &&
    typeof e.agentId === "string" &&
    typeof e.hatDomain === "string" &&
    typeof e.address === "string" &&
    typeof e.at === "string" &&
    ISO_MS.test(e.at) &&
    CONTRIBUTION_TREATMENTS.includes(e.treatment)
  );
}

function isOutcomeRecord(v: unknown): v is OutcomeRecord {
  if (!v || typeof v !== "object") return false;
  const o = v as OutcomeRecord;
  return (
    typeof o.subjectRef === "string" &&
    typeof o.hit === "boolean" &&
    typeof o.address === "string" &&
    typeof o.labeler === "string" &&
    o.labeler.length > 0 &&
    typeof o.jurisdiction === "string" &&
    o.jurisdiction.length > 0 &&
    typeof o.at === "string" &&
    ISO_MS.test(o.at) &&
    (admittedEvidence(o.series)?.includes(o.evidence) ?? false)
  );
}

export function readEdges(root: string): readonly TreatmentEdge[] {
  return dedupeByAddress(readJsonlDir(root, EDGES_SUBDIR, isTreatmentEdge));
}

export function readOutcomes(root: string): readonly OutcomeRecord[] {
  return dedupeByAddress(readJsonlDir(root, OUTCOMES_SUBDIR, isOutcomeRecord));
}

// ─────────────────────────────────────────────────────────────────────────────
// Attribution — a revisable QUERY over the treatment graph
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A named attribution rule. The id travels with every reading, so a number can always be
 * traced to the rule that produced it and re-queried under another.
 */
export interface AttributionRule {
  readonly id: string;
  readonly foldedTreatments: readonly ContributionTreatment[];
}

/**
 * The default: every treatment that took a POSITION on the subject. Principled without a
 * team model, because each stance is a separate falsifiable claim settled by reality —
 * nothing is divided, so nothing needs a division rule.
 */
export const STANCE_BEARING: AttributionRule = {
  id: "stance-bearing@v1",
  foldedTreatments: ["authored", "approved", "warned", "warned-overruled"],
};

/** The conservative alternative: only the author's implicit claim. */
export const AUTHOR_ONLY: AttributionRule = { id: "author-only@v1", foldedTreatments: ["authored"] };

/*
 * Equal weight over all contributors is deliberately NOT offered: it is the
 * unweighted-aggregation defect (PR #10945, found live in #10955) moved to the attribution
 * layer, where it would charge a warner and an approver identically for one failure.
 */

/** Why an outcome moved no posterior. Each is mechanism coverage, never a clean record. */
export type NoUpdateReason =
  /** No folded, stance-bearing treatment covers the subject — interaction or omission. */
  | "unattributable"
  /** The labeler is the agent the label would have updated (invariant b). */
  | "self-labeled"
  /** Out-of-scope beyond MIN_PERSUASIVE_WEIGHT — scoped so narrowly it updates nobody. */
  | "scoped-out";

export interface NoUpdateRecord {
  readonly outcome: OutcomeRecord;
  readonly reason: NoUpdateReason;
  /** The agent that would have been updated, when the reason is agent-specific. */
  readonly agentId?: string;
}

/** One attributed observation: a claim, settled by the subject's outcome, at a scope weight. */
export interface AttributedObservation {
  readonly agentId: string;
  readonly hatDomain: string;
  readonly treatment: ContributionTreatment;
  readonly stance: Stance;
  /** `true` iff the agent's stance agreed with what actually happened. */
  readonly hit: boolean;
  /** Partial-pooling weight: 1 when binding, `persuasiveWeight` otherwise. */
  readonly weight: number;
  readonly labeler: string;
  readonly jurisdiction: Jurisdiction;
  readonly at: string;
  readonly address: string;
  readonly subjectRef: string;
  readonly series: CompetenceSeries;
}

export interface AttributionResult {
  readonly ruleId: string;
  readonly observations: readonly AttributedObservation[];
  /**
   * Outcomes that moved no posterior, with the reason. Reported, never spread over whoever
   * is nearby: a defect can arise from an INTERACTION between treatments or from an
   * OMISSION, and an omission is in no edge's record. This is the graph's own statement of
   * what it cannot see — and the escape hatch for improving the mechanism.
   */
  readonly noUpdate: readonly NoUpdateRecord[];
}

/**
 * Whether a stance was vindicated by an outcome.
 * `+1` (asserted sound) is right when the subject held up; `−1` when it did not.
 */
export function stanceAgrees(stance: Stance, subjectHeldUp: boolean): boolean {
  return stance > 0 ? subjectHeldUp : !subjectHeldUp;
}

/**
 * Attribute outcomes of one series to (agent, hat-domain) pairs under a rule, read from a
 * given jurisdiction. Pure — the store is read elsewhere — so this is DST-replayable.
 *
 * `readingJurisdiction` is the scope the caller is asking about; evidence from elsewhere
 * enters at persuasive weight, and evidence below `MIN_PERSUASIVE_WEIGHT` enters not at
 * all (and is reported as `scoped-out`, never dropped).
 */
export function attribute(
  outcomes: readonly OutcomeRecord[],
  edges: readonly TreatmentEdge[],
  series: CompetenceSeries,
  readingJurisdiction: Jurisdiction,
  rule: AttributionRule = STANCE_BEARING,
): AttributionResult {
  const bySubject = new Map<string, TreatmentEdge[]>();
  for (const e of edges) {
    if (!rule.foldedTreatments.includes(e.treatment)) continue;
    if (TREATMENT_STANCE[e.treatment] === 0) continue; // takes no position on the subject
    const list = bySubject.get(e.subjectRef);
    if (list) list.push(e);
    else bySubject.set(e.subjectRef, [e]);
  }

  const observations: AttributedObservation[] = [];
  const noUpdate: NoUpdateRecord[] = [];
  for (const o of canonicalOrder(outcomes.filter((x) => x.series === series))) {
    const settled = settleOne(o, bySubject.get(o.subjectRef) ?? [], readingJurisdiction);
    observations.push(...settled.observations);
    noUpdate.push(...settled.noUpdate);
  }
  return { ruleId: rule.id, observations, noUpdate };
}

/** Settle one outcome against the treatments covering its subject. Extracted for legibility. */
function settleOne(
  o: OutcomeRecord,
  treatments: readonly TreatmentEdge[],
  readingJurisdiction: Jurisdiction,
): { observations: AttributedObservation[]; noUpdate: NoUpdateRecord[] } {
  if (treatments.length === 0) {
    return { observations: [], noUpdate: [{ outcome: o, reason: "unattributable" }] };
  }
  const weight = persuasiveWeight(o.jurisdiction, readingJurisdiction);
  if (weight < MIN_PERSUASIVE_WEIGHT) {
    return { observations: [], noUpdate: [{ outcome: o, reason: "scoped-out" }] };
  }

  const observations: AttributedObservation[] = [];
  const noUpdate: NoUpdateRecord[] = [];
  for (const e of canonicalOrder(treatments)) {
    if (stringCompare(o.labeler, e.agentId) === 0) {
      // Invariant (b): the labeler must not be the agent the label would update.
      noUpdate.push({ outcome: o, reason: "self-labeled", agentId: e.agentId });
      continue;
    }
    const stance = TREATMENT_STANCE[e.treatment];
    observations.push({
      agentId: e.agentId,
      hatDomain: e.hatDomain,
      treatment: e.treatment,
      stance,
      hit: stanceAgrees(stance, o.hit),
      weight,
      labeler: o.labeler,
      jurisdiction: o.jurisdiction,
      at: o.at,
      address: o.address,
      subjectRef: o.subjectRef,
      series: o.series,
    });
  }
  return { observations, noUpdate };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mechanism coverage — the escape hatch: unattributable ΔU banks against the SYSTEM
// ─────────────────────────────────────────────────────────────────────────────

export interface MechanismCoverage {
  readonly outcomesSeen: number;
  readonly updatesApplied: number;
  readonly unattributable: number;
  readonly selfLabeled: number;
  readonly scopedOut: number;
  /** Share of outcomes that moved no posterior. Rising ⇒ the mechanism needs work. */
  readonly noUpdateRate: number;
  /** What a rising rate implies, per reason — the improvement trigger, stated. */
  readonly triggers: readonly string[];
}

/**
 * Score the ATTRIBUTION MECHANISM, not the agents. An unattributable defect still carries
 * ΔU (`.claude/rules/every-bug-has-economic-value.md`); this is where it banks. The
 * triggers name what to extend when a bucket grows, so the readout is actionable rather
 * than merely honest.
 */
export function mechanismCoverage(result: AttributionResult): MechanismCoverage {
  const unattributable = result.noUpdate.filter((n) => n.reason === "unattributable").length;
  const selfLabeled = result.noUpdate.filter((n) => n.reason === "self-labeled").length;
  const scopedOut = result.noUpdate.filter((n) => n.reason === "scoped-out").length;
  const outcomesSeen = result.observations.length + result.noUpdate.length;
  const triggers: string[] = [];
  if (unattributable > 0) {
    triggers.push("unattributable: the graph is missing edges, or the treatment vocabulary is too coarse");
  }
  if (selfLabeled > 0) {
    triggers.push("self-labeled: an independent labeler is needed for these subjects");
  }
  if (scopedOut > 0) {
    triggers.push("scoped-out: jurisdictions are too fine, or the scope hierarchy needs a shared parent");
  }
  return {
    outcomesSeen,
    updatesApplied: result.observations.length,
    unattributable,
    selfLabeled,
    scopedOut,
    noUpdateRate: outcomesSeen === 0 ? 0 : result.noUpdate.length / outcomesSeen,
    triggers,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Agreement as PRIOR — never as likelihood, never weighting its own source
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cap on the agreement-derived prior mean: |μ₀| ≤ 1.0 = one prior σ.
 *
 * Justified against expected event counts, not taste: measured under this estimator
 * (σ₀² = 1, β = 1), ONE contrary use-observation drives μ₀ ∈ {0.25, 0.5, 0.75} negative and
 * TWO drive μ₀ = 1.0 negative. Change failures are rare, so a prior needing dozens of
 * observations to wash out would make agreement the determinator in practice while the
 * design claimed use was.
 */
export const MAX_AGREEMENT_PRIOR_MU = 1.0;

/** An agreement-derived prior, tagged with the aggregator that produced it. */
export interface AgreementPrior {
  /** The aggregator whose agreement produced this — e.g. a review board's id. */
  readonly sourceAggregatorId: string;
  readonly agentId: string;
  readonly hatDomain: string;
  /** Prior mean; clamped to ±MAX_AGREEMENT_PRIOR_MU by `makeAgreementPrior`. */
  readonly mu: number;
}

export function makeAgreementPrior(p: AgreementPrior): AgreementPrior {
  return { ...p, mu: Math.min(MAX_AGREEMENT_PRIOR_MU, Math.max(-MAX_AGREEMENT_PRIOR_MU, p.mu)) };
}

/**
 * THE ANTI-CIRCULARITY GATE.
 *
 * An agreement prior may inform routing, prioritisation, or a DIFFERENT aggregation — never
 * the aggregator whose own agreement produced it. Wiring a board's agreement back in as
 * that board's weights closes the loop and makes popular reviewers competent by
 * construction. Returns `false` when `consumerAggregatorId` is the prior's own source.
 */
export function agreementPriorAdmissibleFor(prior: AgreementPrior, consumerAggregatorId: string): boolean {
  return stringCompare(prior.sourceAggregatorId, consumerAggregatorId) !== 0;
}

/** The starting belief for a fold: the honest prior, or an agreement-seeded one. */
export function seedBelief(prior?: AgreementPrior): SkillBelief {
  const mu = prior === undefined ? MU_0 : makeAgreementPrior(prior).mu;
  return { mu, sigma2: SIGMA_0 * SIGMA_0, obsCount: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tempered update — partial pooling on an estimator that has no weight parameter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply one observation at partial weight `w ∈ (0, 1]`.
 *
 * `updateBelief` (ADF) has no weight parameter, so persuasive-weight evidence cannot be
 * expressed by the estimator as it stands. This interpolates in NATURAL parameters between
 * the current belief and the full ADF posterior:
 *
 *   τ = 1/σ², η = μ/σ²;  τ′ = τ₀ + w(τ₁ − τ₀);  η′ = η₀ + w(η₁ − η₀)
 *
 * `w = 1` reproduces the exact ADF step; `w → 0` leaves the belief unmoved. It is an
 * APPROXIMATION of a tempered (power) likelihood, not exact hierarchical pooling — the
 * exact form needs a hierarchical model the ledger does not have, and adding one is an
 * extension to `TravelerRankLedger` on both oracles rather than a unilateral change here.
 * REGISTER: `unmetered`.
 */
export function temperedUpdate(hit: boolean, belief: SkillBelief, w: number): SkillBelief {
  const weight = Math.min(1, Math.max(0, w));
  if (weight === 0) return belief;
  const full = updateBelief(hit, belief);
  if (weight === 1) return full;
  const tau0 = 1 / belief.sigma2;
  const eta0 = belief.mu / belief.sigma2;
  const tau1 = 1 / full.sigma2;
  const eta1 = full.mu / full.sigma2;
  const tau = tau0 + weight * (tau1 - tau0);
  const eta = eta0 + weight * (eta1 - eta0);
  return { mu: eta / tau, sigma2: 1 / tau, obsCount: belief.obsCount + 1 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading — a measurement, or an explicit statement of ignorance
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `prior-only` is a distinct case so an empty or unattributed log CANNOT be read as a
 * measurement of anyone: a caller must destructure `kind` to reach a number. Both cases
 * carry `mechanismSeen`, so "we learned nothing about this agent" never reads as "clean
 * record".
 */
export type CompetenceReading =
  | {
      readonly kind: "prior-only";
      readonly agentId: string;
      readonly hatDomain: string;
      readonly jurisdiction: Jurisdiction;
      readonly series: CompetenceSeries;
      readonly ruleId: string;
      readonly obsCount: 0;
      /** 1 — the belief is entirely prior. */
      readonly priorShare: 1;
      /** Outcomes seen that moved nothing. Non-zero here is a MECHANISM finding, not a clean record. */
      readonly mechanismSeen: number;
      readonly note: string;
    }
  | {
      readonly kind: "observed";
      readonly agentId: string;
      readonly hatDomain: string;
      readonly jurisdiction: Jurisdiction;
      readonly series: CompetenceSeries;
      readonly ruleId: string;
      readonly obsCount: number;
      /** Of `obsCount`, how many were binding (same-jurisdiction, full weight). */
      readonly bindingCount: number;
      readonly mu: number;
      readonly sigma2: number;
      readonly trustBand: number;
      /**
       * σ²/σ₀² — the share of the belief's precision still coming from the prior. 1 = pure
       * prior; measured 0.27 at k=5 and 0.15 at k=10 under this estimator. A reading resting
       * mostly on an agreement prior must be legible as such.
       */
      readonly priorShare: number;
      readonly mechanismSeen: number;
    };

/**
 * Fold one series for one (agent, hat-domain), read from one jurisdiction.
 *
 * Note what this does NOT do: it does not combine series, and it returns no weight for any
 * aggregation. Weights go live only after the ledger has data and has been validated, and
 * that is the human maintainer's call.
 */
export function readCompetence(
  outcomes: readonly OutcomeRecord[],
  edges: readonly TreatmentEdge[],
  agentId: string,
  hatDomain: string,
  series: CompetenceSeries,
  readingJurisdiction: Jurisdiction,
  rule: AttributionRule = STANCE_BEARING,
  prior?: AgreementPrior,
): CompetenceReading {
  const result = attribute(outcomes, edges, series, readingJurisdiction, rule);
  const mine = result.observations.filter((o) => o.agentId === agentId && o.hatDomain === hatDomain);
  const mechanismSeen = result.noUpdate.filter((n) => n.agentId === undefined || n.agentId === agentId).length;

  if (mine.length === 0) {
    return {
      kind: "prior-only",
      agentId,
      hatDomain,
      jurisdiction: readingJurisdiction,
      series,
      ruleId: rule.id,
      obsCount: 0,
      priorShare: 1,
      mechanismSeen,
      note: "no attributed outcomes — a statement about ignorance, not about the agent",
    };
  }

  const sigma2Prior = SIGMA_0 * SIGMA_0;
  let belief = seedBelief(prior);
  let bindingCount = 0;
  for (const o of mine) {
    belief = temperedUpdate(o.hit, belief, o.weight);
    if (o.weight === 1) bindingCount += 1;
  }

  return {
    kind: "observed",
    agentId,
    hatDomain,
    jurisdiction: readingJurisdiction,
    series,
    ruleId: rule.id,
    obsCount: belief.obsCount,
    bindingCount,
    mu: belief.mu,
    sigma2: belief.sigma2,
    trustBand: trustBand(belief),
    priorShare: belief.sigma2 / sigma2Prior,
    mechanismSeen,
  };
}

/**
 * Fold one series into a `TravelerRankLedger` (the estimator's own type), for ONE
 * jurisdiction at full weight — the no-pooling mode the existing ledger supports, since its
 * key is `(travelerId, hatDomain)` with no third axis and its update takes no weight.
 * Partial pooling across jurisdictions lives in `readCompetence` until the ledger itself
 * gains a scope axis.
 *
 * One ledger PER SERIES — the determinator and the fast proxies are never merged.
 */
export function foldSeriesToLedger(
  outcomes: readonly OutcomeRecord[],
  edges: readonly TreatmentEdge[],
  series: CompetenceSeries,
  jurisdiction: Jurisdiction,
  rule: AttributionRule = STANCE_BEARING,
): TravelerRankLedger {
  if (!FOLDED_SERIES.includes(series)) {
    throw new Error(`competence-attribution: series ${JSON.stringify(series)} is recorded, never folded`);
  }
  const { observations } = attribute(outcomes, edges, series, jurisdiction, rule);
  let ledger: TravelerRankLedger = emptyLedger;
  for (const o of observations) {
    if (o.weight !== 1) continue; // binding only; persuasive evidence needs a weighted update
    ledger = recordOutcome(o.agentId, o.hatDomain, o.hit, ledger);
  }
  return ledger;
}

/** Re-exported so callers can see the estimator's noise scale without importing it twice. */
export const ESTIMATOR_BETA = BETA;
