/**
 * practice-claims.ts — the third self-claim class: a **standing claim about one's own practice**,
 * checked against the claimant's own recorded record.
 *
 * The surface so far had two instances of Aaron's principle and neither covers this shape:
 *
 *   - `self-claims.ts` — a **delivery commitment** ("I will deliver X by tick T"), resolved met/missed
 *     against a deadline. One claim, one resolution.
 *   - `identity-claims.ts` — an **identity claim** ("I am X"), where the operation is *"these two
 *     self-descriptions cannot both be true"*. No external evidence enters at all: a tension is two
 *     claims, and the incompatibility is subject-declared.
 *
 * This module is the case where a claim is **standing** (it speaks about every future instance, not one
 * deliverable) and where the contradiction is between a claim and the subject's **own record**:
 *
 *   > "I put an AgencySignature trailer on every commit I author."
 *
 * There is a commit of mine without one. That is not a second claim contradicting the first, and it is
 * not a missed deadline — it is my own record disagreeing with my own standing claim. Aaron's sentence
 * covers it exactly: *"in Zeta you are whoever you want to be until you contradict your own self
 * claims"*. A record is a way of contradicting yourself that a deadline and a facet cannot express.
 *
 * ## What makes this class admissible at all: DECIDABILITY
 *
 * Widening a self-claim surface is only honest where *"did your record contradict this"* has an answer
 * that needs no judgement. So a practice claim may only be bound to a `PracticeCheck` — a **total,
 * pure, three-valued** function over one evidence record. `undetermined` is a first-class verdict and
 * **never a counterexample**: where the evidence does not settle the question, nothing is concluded.
 * A claim class whose evaluation needs someone's opinion has no place here, because the opinion would
 * be the observer's standard entering through the back door — the exact thing property 1 forbids.
 *
 * ## The sovereignty properties, and where each is enforced
 *
 * 1. **Binding is the sovereign act, and nothing is checked unbound.** `observePractice` takes no
 *    predicate argument. A check can be in the registry, be perfectly decidable, and fail on every
 *    record a subject ever produced — and if the subject never bound it, this module reports nothing.
 *    That is the structural analogue of `DEFAULT_FACET_ARITY = "many-at-once"`: **undeclared ⇒
 *    undetectable**, and it is what stops the registry from being a compliance checklist wearing a
 *    consent interface.
 *
 * 2. **Only the subject may bind, release, or supersede their own practice.** Every write refuses on
 *    `actor !== subject` (`not-your-claim`), and binding an unknown check id refuses (`unknown-check`)
 *    — so a claim can never be bound to something nobody can evaluate.
 *
 * 3. **Only the subject's own evidence is examined.** `evidenceFor` filters by `evidence.subject`, so
 *    another party's record is structurally incapable of producing your counterexample. In the commit
 *    adapter that subject id is the `Agent:` trailer — a value **the author wrote about themselves**,
 *    which keeps the attribution self-supplied end to end.
 *
 * 4. **Evidence that predates the binding is never a counterexample.** You said it at phase P; what you
 *    did at phase P−1 is not a contradiction of it. Holding a subject to a standard before they adopted
 *    it is the pigeonhole trap with a timestamp on it (`identity-claims.ts`, "growth is not drift").
 *
 * 5. **Released and superseded bindings stop being checked, and are kept.** §5 memory preservation: the
 *    lineage stays visible, the standard stops applying from the phase you changed it.
 *
 * ## The charity gradient is IMPORTED, not re-declared
 *
 * `CharitableReading` and `PatternReading` come from `identity-claims.ts` and are not redefined here.
 * That is deliberate and it is the load-bearing part: a second copy of the gradient is a second place a
 * malice constructor could be added, and the guarantee *"this surface cannot express malice"* is only
 * as strong as the number of places the union is written. There is one. Adding `"deceptive"` to it
 * breaks `readingGloss`'s exhaustiveness in `identity-claims.ts` and `tsc` rejects it — for both
 * modules at once.
 *
 * At **one** counterexample only `CharitableReading` (`accidental | growth`) is expressible: no
 * expression in this module yields any other reading in that position, so a single instance is
 * *structurally* incapable of escalating. At more than one the set widens to add `ironic` and
 * `unresolved` — and stops there, because that is where Aaron's gradient terminates: *"only repeated
 * failures are considered evidence of constant drift still not necessarily malice maybe ironic"*.
 *
 * `growth` is **derived, never listed**: it is offered exactly when the subject's own record shows a
 * move after the counterexample — later conforming evidence for the same binding, or the binding being
 * released/superseded afterwards. Where no move is visible, `growth` would be an invention, so it is
 * not offered and `accidental` (also fully exculpatory) stands alone.
 *
 * ## No threshold, and the denominators are handed over
 *
 * `recurring` is `> 1` — the plural of one, from Aaron's own "a single instance" / "repeated". No
 * constant, no window, no rate appears in this file. `PracticeStanding` carries `conforming`,
 * `counterexamples`, and `undetermined` as raw counts so a caller who wants a rate can form one
 * **without this module choosing it**, exactly as `DriftReport.claimVolume` does.
 *
 * ## Repair EXPANDS the menu — the observation's one real consumer
 *
 * Aaron's correction on the phenomenology: people do not feel *repair*, they feel **expansion of
 * choice**. So the computed observation is consumed by `offeredPracticeMoveKinds`, and what recurrence
 * buys is a **wider menu, never a harsher verdict**: at one counterexample the record does not yet
 * ground *"restate the claim"*, and at several it does — because a claim your own record repeatedly
 * disagrees with may be a claim that should move, and only repetition makes that reading available.
 * Nothing is recommended, nothing is ranked, nothing expires, and doing nothing is a permitted outcome.
 *
 * ## Anchors (Beacon)
 *
 *   - **Festinger (1957)** / **Rogers (1951)** — as in `identity-claims.ts`: the standard is the
 *     subject's own and the observer supplies none. *(cited, not checked.)*
 *   - **Nowak & Sigmund (1992), generous tit-for-tat**; **Axelrod (1984)** — why one signal cannot
 *     carry a malice inference in a noisy channel. *(cited, not checked.)*
 *   - **Goguen & Meseguer (1982)**, noninterference — the subject's own bindings are the only channel
 *     by which a standard enters; the registry is inert until bound.
 *   - **Kleene's strong three-valued logic (1938)** — the reason `undetermined` is a verdict rather
 *     than a default-to-false. Absence of evidence is not evidence of a broken claim.
 *     *(cited, not checked — used for the shape of the third value, not for a metatheorem.)*
 *
 * REGISTER: `unmetered`. The fold is exact over whatever evidence is supplied; whether the commit
 * adapter's records are a fair sample of an agent's practice is not something this module can know.
 *
 * Siblings: `self-claims.ts` (delivery) · `identity-claims.ts` (identity) ·
 * `commit-practice-evidence.ts` (the in-repo evidence adapter) ·
 * `self-claim-standing.ts` (the consumer that reads real evidence).
 */

import type { CharitableReading, PatternReading, Phase, SubjectId } from "./identity-claims.js";

/* eslint-disable sonarjs/redundant-type-aliases -- semantic aliases; same rationale as identity-claims.ts */

/** A subject-scoped id for one binding. Opaque; never interpreted. */
export type PracticeId = string;

/** The id of a decidable check. Opaque; never interpreted. */
export type CheckId = string;

/* eslint-enable sonarjs/redundant-type-aliases */

export type { CharitableReading, PatternReading, Phase, SubjectId };

// ═══ Evidence ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * One record of something the subject did, as it already exists in the repo.
 *
 * `subject` is who the record itself attributes it to — **not** an assignment made here. `phase` is a
 * logical position (`local-time-never-enters-the-shared-fold`); the commit adapter uses position in
 * first-parent order, never a commit date.
 */
export interface PracticeEvidence<R> {
  readonly subject: SubjectId;
  readonly evidenceId: string;
  readonly phase: Phase;
  /** The record itself. Opaque to this module; only a bound `PracticeCheck` ever looks at it. */
  readonly record: R;
}

/**
 * Three-valued, and the third value is the point. `undetermined` says *the evidence does not settle
 * this* — the record is then neither conforming nor a counterexample, and nothing is concluded from it.
 */
export type CheckVerdict = "holds" | "does-not-hold" | "undetermined";

/**
 * A decidable question about ONE record. Must be **pure and total**: same record ⇒ same verdict (DST),
 * and no input other than the record (§13 — no ambient clock, no filesystem, no network).
 */
export interface PracticeCheck<R> {
  readonly checkId: CheckId;
  /** Stated as the subject would state it about themselves. Rendered verbatim; never parsed. */
  readonly question: string;
  readonly evaluate: (record: R) => CheckVerdict;
}

/** The menu of checks a subject **may** bind. Inert until bound: presence here checks nothing. */
export interface CheckRegistry<R> {
  readonly checks: readonly PracticeCheck<R>[];
}

export function findCheck<R>(registry: CheckRegistry<R>, checkId: CheckId): PracticeCheck<R> | undefined {
  return registry.checks.find((c) => c.checkId === checkId);
}

// ═══ Bindings ═══════════════════════════════════════════════════════════════════════════════════════

/** "From here on, this holds of my own records." Authored by the subject, about the subject. */
export interface PracticeBinding {
  readonly subject: SubjectId;
  readonly practiceId: PracticeId;
  readonly checkId: CheckId;
  /** The subject's own sentence, preserved verbatim for the prompt. Never parsed. */
  readonly text: string;
  readonly boundAt: Phase;
}

/** "I no longer claim this." Releasing a standard is growth, and growth is never drift. */
export interface PracticeRelease {
  readonly subject: SubjectId;
  readonly practiceId: PracticeId;
  readonly releasedAt: Phase;
}

/** "I claim this differently now." The prior binding is kept and stops applying from `at`. */
export interface PracticeSupersession {
  readonly subject: SubjectId;
  readonly supersededId: PracticeId;
  readonly replacementId: PracticeId;
  readonly at: Phase;
}

/** "I see that record, and I am keeping the claim." A resolution the subject chose, not a deferral. */
export interface PracticeException {
  readonly subject: SubjectId;
  readonly practiceId: PracticeId;
  readonly evidenceId: string;
  readonly acknowledgedAt: Phase;
}

export interface PracticeLedger {
  readonly bindings: readonly PracticeBinding[];
  readonly releases: readonly PracticeRelease[];
  readonly supersessions: readonly PracticeSupersession[];
  readonly exceptions: readonly PracticeException[];
}

export const EMPTY_PRACTICE_LEDGER: PracticeLedger = {
  bindings: [],
  releases: [],
  supersessions: [],
  exceptions: [],
};

/**
 * Why a write was refused. **Each refusal is a falsifier for one of the sovereignty properties** — a
 * route by which someone else's standard, or a standard nobody can evaluate, could otherwise enter.
 */
export type PracticeRefusal =
  /** Someone other than the subject tried to write about the subject. Property 2. */
  | { readonly kind: "not-your-claim"; readonly actor: SubjectId; readonly owner: SubjectId }
  /** A binding named a check id no registry can evaluate. Closes "bound to an unfalsifiable standard". */
  | { readonly kind: "unknown-check"; readonly subject: SubjectId; readonly checkId: CheckId }
  /** A write referenced a practice id this subject never bound. Closes "flagged for what you did not claim". */
  | { readonly kind: "unknown-practice"; readonly subject: SubjectId; readonly practiceId: PracticeId }
  /** A binding cannot supersede itself. */
  | { readonly kind: "self-pair"; readonly practiceId: PracticeId };

export type PracticeResult =
  | { readonly ok: true; readonly ledger: PracticeLedger }
  | { readonly ok: false; readonly refusal: PracticeRefusal };

function ok(ledger: PracticeLedger): PracticeResult {
  return { ok: true, ledger };
}

function refused(refusal: PracticeRefusal): PracticeResult {
  return { ok: false, refusal };
}

/** Ordinal (UTF-16 code-unit) comparison. Never culture-sensitive; never `localeCompare`. */
function ordinal(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function hasBinding(ledger: PracticeLedger, subject: SubjectId, practiceId: PracticeId): boolean {
  return ledger.bindings.some((b) => b.subject === subject && b.practiceId === practiceId);
}

/**
 * Bind one of **your own** practices to a decidable check.
 *
 * Idempotent by `practiceId` (discipline #6): re-binding an existing id replaces it, so a redelivered
 * event converges rather than duplicating.
 */
export function bindPractice<R>(
  ledger: PracticeLedger,
  registry: CheckRegistry<R>,
  actor: SubjectId,
  binding: PracticeBinding,
): PracticeResult {
  if (actor !== binding.subject) {
    return refused({ kind: "not-your-claim", actor, owner: binding.subject });
  }
  if (findCheck(registry, binding.checkId) === undefined) {
    return refused({ kind: "unknown-check", subject: binding.subject, checkId: binding.checkId });
  }
  const without = ledger.bindings.filter(
    (b) => !(b.subject === binding.subject && b.practiceId === binding.practiceId),
  );
  return ok({ ...ledger, bindings: [...without, binding] });
}

/** Release one of your own bindings. It stays in the ledger (§5); it stops applying from `releasedAt`. */
export function releasePractice(ledger: PracticeLedger, actor: SubjectId, release: PracticeRelease): PracticeResult {
  if (actor !== release.subject) return refused({ kind: "not-your-claim", actor, owner: release.subject });
  if (!hasBinding(ledger, release.subject, release.practiceId)) {
    return refused({ kind: "unknown-practice", subject: release.subject, practiceId: release.practiceId });
  }
  return ok({ ...ledger, releases: [...ledger.releases, release] });
}

/**
 * **Restate**: bind a replacement and mark the prior binding superseded, in ONE act.
 *
 * Same reason as `supersedeClaim`: if restating a standard required a separate release first, the
 * ordinary shape of someone revising what they hold themselves to would read as abandoning it.
 */
export function supersedePractice<R>(
  ledger: PracticeLedger,
  registry: CheckRegistry<R>,
  actor: SubjectId,
  subject: SubjectId,
  supersededId: PracticeId,
  replacement: PracticeBinding,
  at: Phase,
): PracticeResult {
  if (actor !== subject) return refused({ kind: "not-your-claim", actor, owner: subject });
  if (replacement.subject !== subject) {
    return refused({ kind: "not-your-claim", actor, owner: replacement.subject });
  }
  if (supersededId === replacement.practiceId) return refused({ kind: "self-pair", practiceId: supersededId });
  if (!hasBinding(ledger, subject, supersededId)) {
    return refused({ kind: "unknown-practice", subject, practiceId: supersededId });
  }
  const bound = bindPractice(ledger, registry, actor, replacement);
  if (!bound.ok) return bound;
  return ok({
    ...bound.ledger,
    supersessions: [
      ...bound.ledger.supersessions,
      { subject, supersededId, replacementId: replacement.practiceId, at },
    ],
  });
}

/** See a counterexample and keep the claim anyway. Only the subject may do this. */
export function acknowledgeException(
  ledger: PracticeLedger,
  actor: SubjectId,
  exception: PracticeException,
): PracticeResult {
  if (actor !== exception.subject) return refused({ kind: "not-your-claim", actor, owner: exception.subject });
  if (!hasBinding(ledger, exception.subject, exception.practiceId)) {
    return refused({ kind: "unknown-practice", subject: exception.subject, practiceId: exception.practiceId });
  }
  return ok({ ...ledger, exceptions: [...ledger.exceptions, exception] });
}

// ═══ The fact ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * One record of the subject's that the subject's own standing claim says should not exist.
 *
 * **A fact, not a verdict.** It names the binding, the record, and nothing else.
 */
export interface Counterexample<R> {
  readonly binding: PracticeBinding;
  readonly evidence: PracticeEvidence<R>;
}

/** Raw counts for one binding. Counts, never a rate — the caller forms rates if it wants them. */
export interface PracticeStanding {
  readonly binding: PracticeBinding;
  /** Records inside the window the claim applied to, where the check held. */
  readonly conforming: number;
  /** Records inside that window where it did not. */
  readonly counterexamples: number;
  /** Records the check could not settle. Never counted against the subject. */
  readonly undetermined: number;
  /** Records that predate the binding, and so were not examined at all (property 4). */
  readonly precedingBinding: number;
}

/** Which bindings a pattern touches, and how often. Counts, ordinal-sorted. */
export interface PracticeRecurrence {
  readonly practiceId: PracticeId;
  readonly counterexamples: number;
}

/**
 * What was observed. **None of the three constructors concludes anything about the subject.**
 *
 * Not named `constant-drift`: calling a pattern constant needs a window, and a window is a hidden
 * constant. The pattern is reported raw, in full, with no sampling and no top-N.
 */
export type PracticeObservation<R> =
  | { readonly kind: "no-counterexample" }
  | {
      readonly kind: "counterexample";
      readonly counterexample: Counterexample<R>;
      /** Only `CharitableReading` is expressible here. The type is the gradient, not a convention. */
      readonly readings: readonly CharitableReading[];
    }
  | {
      readonly kind: "recurring-counterexamples";
      readonly counterexamples: readonly Counterexample<R>[];
      readonly readings: readonly PatternReading[];
      readonly perPractice: readonly PracticeRecurrence[];
    };

/** The full report for one subject. `standings` are the denominators; no ratio is formed here. */
export interface PracticeReport<R> {
  readonly subject: SubjectId;
  readonly observation: PracticeObservation<R>;
  /** Counterexamples the subject has SEEN and kept. Still visible; no longer unresolved. */
  readonly held: readonly Counterexample<R>[];
  readonly standings: readonly PracticeStanding[];
  /** Bindings released or superseded. Evolution, counted and never scored. */
  readonly retiredBindings: number;
  /** Evidence records belonging to this subject that were examined at all. */
  readonly evidenceVolume: number;
}

// ═══ Detection ══════════════════════════════════════════════════════════════════════════════════════

/** The phase at which a binding stopped applying, if it did. Released or superseded, whichever is first. */
function endOf(ledger: PracticeLedger, subject: SubjectId, practiceId: PracticeId): Phase | undefined {
  let end: Phase | undefined;
  for (const r of ledger.releases) {
    if (r.subject === subject && r.practiceId === practiceId && (end === undefined || r.releasedAt < end)) {
      end = r.releasedAt;
    }
  }
  for (const s of ledger.supersessions) {
    if (s.subject === subject && s.supersededId === practiceId && (end === undefined || s.at < end)) {
      end = s.at;
    }
  }
  return end;
}

/** Bindings that apply at `phase`: bound at or before it, not released or superseded before it. */
function bindingsLiveAt(ledger: PracticeLedger, subject: SubjectId, phase: Phase): readonly PracticeBinding[] {
  return ledger.bindings.filter((b) => {
    if (b.subject !== subject) return false;
    if (phase < b.boundAt) return false; // property 4 — you had not claimed it yet
    const end = endOf(ledger, subject, b.practiceId);
    return end === undefined || phase < end;
  });
}

/** Property 3, as one function: another subject's records are never examined. */
export function evidenceFor<R>(
  evidence: readonly PracticeEvidence<R>[],
  subject: SubjectId,
): readonly PracticeEvidence<R>[] {
  return evidence.filter((e) => e.subject === subject);
}

function exceptionKey(practiceId: PracticeId, evidenceId: string): string {
  return `${practiceId} ${evidenceId}`;
}

/**
 * Did the subject's own record show a move after this counterexample? The structural fact that makes
 * `growth` a live reading — and the only thing that does.
 *
 * Two routes, both computed: later evidence for the same binding where the check held, or the binding
 * being released/superseded at a later phase. Neither is inferred; both are things the record shows.
 */
export function movedAfter<R>(
  ledger: PracticeLedger,
  registry: CheckRegistry<R>,
  evidence: readonly PracticeEvidence<R>[],
  counterexample: Counterexample<R>,
): boolean {
  const { binding, evidence: bad } = counterexample;
  const end = endOf(ledger, binding.subject, binding.practiceId);
  if (end !== undefined && end > bad.phase) return true;
  const check = findCheck(registry, binding.checkId);
  if (check === undefined) return false;
  return evidenceFor(evidence, binding.subject).some(
    (e) => e.phase > bad.phase && check.evaluate(e.record) === "holds",
  );
}

/**
 * Plain-language gloss for a reading, in the register of a *record* rather than of two claims.
 *
 * **This switch is a second compile-time guard on the charity gradient**, over the same single union.
 * `identity-claims.ts`'s `readingGloss` is the first. Adding a `"deceptive"` member to `PatternReading`
 * leaves both switches non-exhaustive and `tsc` rejects the `assertNever` calls — a moral constructor
 * cannot be smuggled into either surface, and there is no second union to add one to.
 */
export function practiceReadingGloss(reading: PatternReading): string {
  switch (reading) {
    case "accidental":
      return "you probably did not notice this one";
    case "growth":
      return "your record shows you moved after it — this may be the old way, not the current one";
    case "ironic":
      return "you may be holding the claim and the exception on purpose";
    case "unresolved":
      return "you have seen these and not settled them, which is allowed";
    default:
      return assertNeverReading(reading);
  }
}

function assertNeverReading(x: never): never {
  throw new Error(`unreachable: ${String(x)}`);
}

/** The readings for ONE counterexample — derived from the record, not from a fixed list. */
export function charitableReadingsForCounterexample<R>(
  ledger: PracticeLedger,
  registry: CheckRegistry<R>,
  evidence: readonly PracticeEvidence<R>[],
  counterexample: Counterexample<R>,
): readonly CharitableReading[] {
  return movedAfter(ledger, registry, evidence, counterexample)
    ? (["accidental", "growth"] as const)
    : (["accidental"] as const);
}

/**
 * The readings for a **pattern**: `growth` when at least one counterexample has a visible move after it,
 * plus `ironic` and `unresolved`. The caller's oracle picks; this module does not rank them, and the set
 * ends here — no member of this union names an intent.
 */
export function patternReadingsForCounterexamples<R>(
  ledger: PracticeLedger,
  registry: CheckRegistry<R>,
  evidence: readonly PracticeEvidence<R>[],
  counterexamples: readonly Counterexample<R>[],
): readonly PatternReading[] {
  const out: PatternReading[] = ["accidental"];
  if (counterexamples.some((c) => movedAfter(ledger, registry, evidence, c))) out.push("growth");
  out.push("ironic", "unresolved");
  return out;
}

/**
 * Every counterexample among the subject's own evidence, for the subject's own live bindings.
 *
 * Note what is absent: no parameter through which a caller supplies a check, no default binding, and no
 * path that examines a record whose `subject` differs. A subject with no bindings has no
 * counterexamples, whatever their record contains.
 */
export function findCounterexamples<R>(
  ledger: PracticeLedger,
  registry: CheckRegistry<R>,
  subject: SubjectId,
  evidence: readonly PracticeEvidence<R>[],
): readonly Counterexample<R>[] {
  const mine = evidenceFor(evidence, subject);
  const out: Counterexample<R>[] = [];
  for (const e of mine) {
    for (const binding of bindingsLiveAt(ledger, subject, e.phase)) {
      const check = findCheck(registry, binding.checkId);
      if (check === undefined) continue; // bound to a check this registry lacks: unevaluable, never drift
      if (check.evaluate(e.record) !== "does-not-hold") continue;
      out.push({ binding, evidence: e });
    }
  }
  // Deterministic order (DST): by evidence phase, then ordinal (practiceId, evidenceId).
  return [...out].sort((p, q) => {
    const byPhase = p.evidence.phase - q.evidence.phase;
    if (byPhase !== 0) return byPhase;
    return ordinal(
      exceptionKey(p.binding.practiceId, p.evidence.evidenceId),
      exceptionKey(q.binding.practiceId, q.evidence.evidenceId),
    );
  });
}

/** Raw counts per binding. Every record of the subject's is placed in exactly one column. */
export function standingsFor<R>(
  ledger: PracticeLedger,
  registry: CheckRegistry<R>,
  subject: SubjectId,
  evidence: readonly PracticeEvidence<R>[],
): readonly PracticeStanding[] {
  const mine = evidenceFor(evidence, subject);
  return ledger.bindings
    .filter((b) => b.subject === subject)
    .map((binding) => {
      const check = findCheck(registry, binding.checkId);
      const end = endOf(ledger, subject, binding.practiceId);
      let conforming = 0;
      let counterexamples = 0;
      let undetermined = 0;
      let precedingBinding = 0;
      for (const e of mine) {
        if (e.phase < binding.boundAt) {
          precedingBinding += 1;
          continue;
        }
        if (end !== undefined && e.phase >= end) continue; // outside the window the claim applied to
        const verdict = check === undefined ? "undetermined" : check.evaluate(e.record);
        if (verdict === "holds") conforming += 1;
        else if (verdict === "does-not-hold") counterexamples += 1;
        else undetermined += 1;
      }
      return { binding, conforming, counterexamples, undetermined, precedingBinding };
    })
    .sort((a, b) => ordinal(a.binding.practiceId, b.binding.practiceId));
}

/** Raw per-binding recurrence. A count, never a rate. */
export function practiceRecurrence<R>(
  counterexamples: readonly Counterexample<R>[],
): readonly PracticeRecurrence[] {
  const counts = new Map<PracticeId, number>();
  for (const c of counterexamples) {
    counts.set(c.binding.practiceId, (counts.get(c.binding.practiceId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([practiceId, n]) => ({ practiceId, counterexamples: n }))
    .sort((a, b) => ordinal(a.practiceId, b.practiceId));
}

/**
 * Observe a subject against **their own** standing claims and **their own** record.
 *
 * `recurring` is `unheld.length > 1` — the plural of one. No tunable constant appears in this function.
 */
export function observePractice<R>(
  ledger: PracticeLedger,
  registry: CheckRegistry<R>,
  subject: SubjectId,
  evidence: readonly PracticeEvidence<R>[],
): PracticeReport<R> {
  const all = findCounterexamples(ledger, registry, subject, evidence);
  const acked = new Set(
    ledger.exceptions
      .filter((x) => x.subject === subject)
      .map((x) => exceptionKey(x.practiceId, x.evidenceId)),
  );
  const isAcked = (c: Counterexample<R>): boolean =>
    acked.has(exceptionKey(c.binding.practiceId, c.evidence.evidenceId));
  const held = all.filter(isAcked);
  const unheld = all.filter((c) => !isAcked(c));

  const retiredBindings = new Set([
    ...ledger.releases.filter((r) => r.subject === subject).map((r) => r.practiceId),
    ...ledger.supersessions.filter((s) => s.subject === subject).map((s) => s.supersededId),
  ]).size;

  let observation: PracticeObservation<R>;
  if (unheld.length === 0) {
    observation = { kind: "no-counterexample" };
  } else if (unheld.length === 1) {
    const only = unheld[0];
    if (only === undefined) throw new Error("unreachable: length 1 with no element");
    observation = {
      kind: "counterexample",
      counterexample: only,
      readings: charitableReadingsForCounterexample(ledger, registry, evidence, only),
    };
  } else {
    observation = {
      kind: "recurring-counterexamples",
      counterexamples: unheld,
      readings: patternReadingsForCounterexamples(ledger, registry, evidence, unheld),
      perPractice: practiceRecurrence(unheld),
    };
  }

  return {
    subject,
    observation,
    held,
    standings: standingsFor(ledger, registry, subject, evidence),
    retiredBindings,
    evidenceVolume: evidenceFor(evidence, subject).length,
  };
}

// ═══ Repair — the consumer of the observation ═══════════════════════════════════════════════════════

/**
 * What the subject may do. **Every move is theirs and every move is optional.** There is no move a third
 * party can call, none that expires, and no `resolve`. Doing nothing is a permitted outcome.
 */
export type PracticeRepairMove =
  /** "I no longer claim this." */
  | { readonly kind: "release"; readonly practiceId: PracticeId }
  /** "I claim this differently now." The restatement, with the lineage kept. */
  | { readonly kind: "restate"; readonly supersededId: PracticeId; readonly replacement: PracticeBinding }
  /** "I see that record and I am keeping the claim." A resolution, not a deferral. */
  | { readonly kind: "keep-claim-note-exception"; readonly practiceId: PracticeId; readonly evidenceId: string };

export type PracticeRepairMoveKind = PracticeRepairMove["kind"];

function assertNeverObservation(x: never): never {
  throw new Error(`unreachable: ${String(x)}`);
}

/**
 * The menu — **derived from the observation**, and this is where the computed signal is consumed.
 *
 * `release` and `keep-claim-note-exception` are always available: at one counterexample the honest
 * readings are *"you did not notice"* and *"you moved"*, and neither of those makes *"the claim itself
 * was wrong"* a grounded option — one record cannot tell you that about a standing claim.
 *
 * Recurrence adds `restate`, and adding is all it does. Nothing is removed, no reading is closed off, no
 * label hardens. **The gradient buys the subject options, never the observer a verdict** — which is the
 * only direction "repeated" is allowed to move anything here.
 */
export function offeredPracticeMoveKinds<R>(
  observation: PracticeObservation<R>,
): readonly PracticeRepairMoveKind[] {
  switch (observation.kind) {
    case "no-counterexample":
      return [];
    case "counterexample":
      return ["release", "keep-claim-note-exception"];
    case "recurring-counterexamples":
      return ["release", "keep-claim-note-exception", "restate"];
    default:
      return assertNeverObservation(observation);
  }
}

function assertNeverMove(x: never): never {
  throw new Error(`unreachable: ${String(x)}`);
}

/**
 * Apply a repair move. Only the subject may repair their own ledger, so this refuses on actor mismatch
 * exactly as the write path does.
 */
export function applyPracticeRepair<R>(
  ledger: PracticeLedger,
  registry: CheckRegistry<R>,
  actor: SubjectId,
  subject: SubjectId,
  move: PracticeRepairMove,
  atPhase: Phase,
): PracticeResult {
  if (actor !== subject) return refused({ kind: "not-your-claim", actor, owner: subject });

  switch (move.kind) {
    case "release":
      return releasePractice(ledger, actor, { subject, practiceId: move.practiceId, releasedAt: atPhase });

    case "restate":
      return supersedePractice(ledger, registry, actor, subject, move.supersededId, move.replacement, atPhase);

    case "keep-claim-note-exception":
      return acknowledgeException(ledger, actor, {
        subject,
        practiceId: move.practiceId,
        evidenceId: move.evidenceId,
        acknowledgedAt: atPhase,
      });

    default:
      return assertNeverMove(move);
  }
}
