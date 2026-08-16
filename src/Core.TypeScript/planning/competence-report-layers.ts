/**
 * competence-report-layers.ts — the report → label → determination layer stack.
 *
 * Companion to `competence-attribution.ts` (the treatment graph + posteriors). Separate
 * module because it changes at a different rate and answers a different question: that one
 * asks *"whose claim about a change was vindicated?"*, this one asks *"was this report a
 * real bug, and how good is this reporter?"* (DV2.0 — partition by change rate).
 *
 * ── Why the label is not the artifact ──────────────────────────────────────────────
 *
 * Aaron 2026-08-16: *"we don't assume their labels are correct, we just listen to the use
 * case and why they were trying to accomplish and then make the determination."*
 *
 * So three records, and only the first is an original:
 *
 *   1. `ReportRecord`      — INTENT + OBSERVATION: *"I was trying to X and got Y."*
 *                            An observation. Durable, never mutated, survives every
 *                            disagreement about what it means.
 *   2. `LabelRecord`       — *"this is a bug"*: an attributed CLAIM, an enrichment layer
 *                            on top of the report, never an edit to it.
 *   3. `DeterminationRecord` — the VERDICT, by a different party: bug / expected /
 *                            undetermined. Also a layer. A re-determination ADDS a layer;
 *                            it never overwrites one, so the trail is the artifact
 *                            (`memory/feedback_preserve_original_and_every_transformation.md`).
 *
 * This is the defence against a flood of low-quality reports, human or AI: labels are never
 * taken as truth, so bad labels cannot corrupt the ledger. A reporter repeatedly not upheld
 * simply accumulates a low competence **in that area** — a filter that earns its way in
 * rather than a gate at the door, and no report is ever rejected or its author judged.
 *
 * ── Why the recursion terminates ───────────────────────────────────────────────────
 *
 * Measuring the labeler could regress forever. It does not, because the roles are split and
 * each is measured EXACTLY ONCE:
 *
 *   - the reporter supplies intent + observation — evidence;
 *   - the determiner supplies the verdict — a judgment, by a DIFFERENT party;
 *   - reporter competence = how often their reports are determined to be real bugs, per
 *     (reporter, jurisdiction) — never globally.
 *
 * The determiner's own quality is where Shepard's stops and where this stops: editorial
 * standards plus treatments that are VISIBLE and CHALLENGEABLE. `determiner` is recorded on
 * every determination precisely so a future challenge is possible. There is no third
 * measurement layer, deliberately.
 *
 * ── What this module does not do ───────────────────────────────────────────────────
 *
 * REGISTER: `unmetered`, store ships EMPTY, nothing is wired into any aggregation.
 * A `bug` determination is what LICENSES a `defect-in-use` outcome in
 * `competence-attribution.ts`, and that outcome's `labeler` is the DETERMINER — not the
 * reporter, whose report is evidence rather than a verdict.
 */

import { createHash } from "node:crypto";

import { stringCompare } from "../collation/collation";
import {
  MIN_PERSUASIVE_WEIGHT,
  canonicalOrder,
  dedupeByAddress,
  persuasiveWeight,
  seedBelief,
  temperedUpdate,
  type AgreementPrior,
  type CompetenceReading,
  type Jurisdiction,
} from "./competence-attribution";
import { SIGMA_0, trustBand } from "./traveler-rank-ledger";

const ISO_MS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function sha256Of(canonical: string): string {
  return createHash("sha256").update(canonical).digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// The three layers
// ─────────────────────────────────────────────────────────────────────────────

/** The unmutated original: what the user was trying to do, and what happened. */
export interface ReportRecord {
  readonly reportId: string;
  readonly reporter: string;
  /** What they were trying to accomplish. The use case — the durable half. */
  readonly intent: string;
  /** What actually happened. An observation, not a diagnosis. */
  readonly observed: string;
  /** The scope the report is made in. */
  readonly jurisdiction: Jurisdiction;
  /** ISO-8601 timestamp OF THE REPORT, never a recording wall clock. */
  readonly at: string;
  readonly address: string;
}

/** An attributed claim about a report. A layer, never an edit. */
export interface LabelRecord {
  readonly reportId: string;
  readonly labeler: string;
  readonly claim: "bug" | "not-a-bug";
  readonly jurisdiction: Jurisdiction;
  readonly at: string;
  readonly address: string;
}

export type Verdict = "bug" | "expected-behaviour" | "undetermined";

/** The verdict layer. Re-determination appends another; nothing is overwritten. */
export interface DeterminationRecord {
  readonly reportId: string;
  readonly determiner: string;
  readonly verdict: Verdict;
  /** The subject the bug was determined to be in, when known — the join to the treatment graph. */
  readonly subjectRef?: string;
  readonly jurisdiction: Jurisdiction;
  readonly at: string;
  readonly address: string;
}

export type Admission<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly reason: string };

export function reportAddress(r: Omit<ReportRecord, "address">): string {
  return sha256Of(JSON.stringify([r.reportId, r.reporter, r.intent, r.observed, r.jurisdiction, r.at]));
}

export function labelAddress(l: Omit<LabelRecord, "address">): string {
  return sha256Of(JSON.stringify([l.reportId, l.labeler, l.claim, l.jurisdiction, l.at]));
}

export function determinationAddress(d: Omit<DeterminationRecord, "address">): string {
  return sha256Of(
    JSON.stringify([d.reportId, d.determiner, d.verdict, d.subjectRef ?? "", d.jurisdiction, d.at]),
  );
}

export function makeReport(r: Omit<ReportRecord, "address">): Admission<ReportRecord> {
  if (!ISO_MS.test(r.at)) return { ok: false, reason: `non-canonical timestamp ${JSON.stringify(r.at)}` };
  if (r.reporter.length === 0) return { ok: false, reason: "unattributed report: reporter is required" };
  if (r.intent.length === 0) return { ok: false, reason: "a report without intent is a label, not an observation" };
  if (r.observed.length === 0) return { ok: false, reason: "empty observation" };
  if (r.jurisdiction.length === 0) return { ok: false, reason: "empty jurisdiction" };
  return { ok: true, value: { ...r, address: reportAddress(r) } };
}

export function makeLabel(l: Omit<LabelRecord, "address">): Admission<LabelRecord> {
  if (!ISO_MS.test(l.at)) return { ok: false, reason: `non-canonical timestamp ${JSON.stringify(l.at)}` };
  if (l.labeler.length === 0) return { ok: false, reason: "unattributed label: labeler is required" };
  if (l.jurisdiction.length === 0) return { ok: false, reason: "empty jurisdiction" };
  return { ok: true, value: { ...l, address: labelAddress(l) } };
}

export function makeDetermination(d: Omit<DeterminationRecord, "address">): Admission<DeterminationRecord> {
  if (!ISO_MS.test(d.at)) return { ok: false, reason: `non-canonical timestamp ${JSON.stringify(d.at)}` };
  if (d.determiner.length === 0) return { ok: false, reason: "unattributed determination: determiner is required" };
  if (d.jurisdiction.length === 0) return { ok: false, reason: "empty jurisdiction" };
  return { ok: true, value: { ...d, address: determinationAddress(d) } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Reading the stack — latest determination wins, every layer preserved
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The current verdict for a report: the LAST determination in canonical order. Earlier
 * determinations are not deleted and remain readable — a re-determination is a new layer,
 * so the history of the disagreement survives.
 */
export function currentVerdict(
  reportId: string,
  determinations: readonly DeterminationRecord[],
): DeterminationRecord | undefined {
  const forReport = dedupeByAddress(determinations).filter((d) => stringCompare(d.reportId, reportId) === 0);
  const ordered = canonicalOrder(forReport);
  return ordered.length === 0 ? undefined : ordered[ordered.length - 1];
}

/** Why a report produced no reporter observation. Mechanism coverage, never a clean record. */
export type ReportNoUpdateReason =
  /** No determination yet — the verdict has not been made. */
  | "undetermined"
  /** The determiner is the reporter: self-determination cannot settle a reporter's claim. */
  | "self-determined"
  /** Out of scope beyond MIN_PERSUASIVE_WEIGHT for the jurisdiction being read. */
  | "scoped-out";

export interface ReporterAttribution {
  readonly observations: readonly { readonly hit: boolean; readonly weight: number; readonly at: string }[];
  readonly noUpdate: readonly { readonly reportId: string; readonly reason: ReportNoUpdateReason }[];
}

/**
 * Settle a reporter's reports against determinations, read from one jurisdiction.
 *
 * A report is a stance-bearing claim (*"something is wrong here"*), so `hit` is
 * `verdict === "bug"`. The independence guard is the same one the treatment graph uses,
 * narrowed to this pair: **the determiner must not be the reporter.**
 */
export function attributeReporter(
  reports: readonly ReportRecord[],
  determinations: readonly DeterminationRecord[],
  reporter: string,
  readingJurisdiction: Jurisdiction,
): ReporterAttribution {
  const observations: { hit: boolean; weight: number; at: string }[] = [];
  const noUpdate: { reportId: string; reason: ReportNoUpdateReason }[] = [];

  for (const r of canonicalOrder(dedupeByAddress(reports).filter((x) => stringCompare(x.reporter, reporter) === 0))) {
    const verdict = currentVerdict(r.reportId, determinations);
    if (verdict === undefined || verdict.verdict === "undetermined") {
      noUpdate.push({ reportId: r.reportId, reason: "undetermined" });
      continue;
    }
    if (stringCompare(verdict.determiner, r.reporter) === 0) {
      noUpdate.push({ reportId: r.reportId, reason: "self-determined" });
      continue;
    }
    const weight = persuasiveWeight(verdict.jurisdiction, readingJurisdiction);
    if (weight < MIN_PERSUASIVE_WEIGHT) {
      noUpdate.push({ reportId: r.reportId, reason: "scoped-out" });
      continue;
    }
    observations.push({ hit: verdict.verdict === "bug", weight, at: verdict.at });
  }
  return { observations, noUpdate };
}

/**
 * Reporter competence per (reporter, jurisdiction): how often this reporter's reports are
 * determined to be real bugs, in this scope.
 *
 * Same estimator, same `prior-only` honesty, same partial-pooling weights as the treatment
 * graph — one machinery, two questions.
 */
export function readReporterCompetence(
  reports: readonly ReportRecord[],
  determinations: readonly DeterminationRecord[],
  reporter: string,
  readingJurisdiction: Jurisdiction,
  prior?: AgreementPrior,
): CompetenceReading {
  const { observations, noUpdate } = attributeReporter(reports, determinations, reporter, readingJurisdiction);
  const mechanismSeen = noUpdate.length;

  if (observations.length === 0) {
    return {
      kind: "prior-only",
      agentId: reporter,
      hatDomain: "reporter",
      jurisdiction: readingJurisdiction,
      series: "use-defect",
      ruleId: "reporter-upheld@v1",
      obsCount: 0,
      priorShare: 1,
      mechanismSeen,
      note: "no determined reports — a statement about ignorance, not about the reporter",
    };
  }

  let belief = seedBelief(prior);
  let bindingCount = 0;
  for (const o of observations) {
    belief = temperedUpdate(o.hit, belief, o.weight);
    if (o.weight === 1) bindingCount += 1;
  }

  return {
    kind: "observed",
    agentId: reporter,
    hatDomain: "reporter",
    jurisdiction: readingJurisdiction,
    series: "use-defect",
    ruleId: "reporter-upheld@v1",
    obsCount: belief.obsCount,
    bindingCount,
    mu: belief.mu,
    sigma2: belief.sigma2,
    trustBand: trustBand(belief),
    priorShare: belief.sigma2 / (SIGMA_0 * SIGMA_0),
    mechanismSeen,
  };
}
