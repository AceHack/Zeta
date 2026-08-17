/**
 * identity-claims.ts — self-consistency over IDENTITY claims (Aaron 2026-08-17).
 *
 * `self-claims.ts` scores **delivery commitments** ("I will deliver X by tick T") met/missed. That is one
 * instance of the self-claim principle, not the principle. This module is the general case Aaron named:
 *
 *   > "in Zeta you are whoever you want to be until you contradict your own self claims then it will be
 *   > detected cause that's what we were designed to do, only detect self claim drift and help repair"
 *
 * Claims here are **identity** claims — *"I am X"*, *"I do not do Y"*, *"my purpose is Z"*. Met-or-missed
 * on a deadline is a different operation from *"these two self-descriptions cannot both be true."*
 *
 * ## The three properties, and where each is enforced
 *
 * 1. **The self-claim is sovereign.** The subject supplies the category; nothing assigns it. A `facet` is
 *    a name the subject chose, a `value` is a word the subject chose, and `text` is the subject's own
 *    sentence — this module never parses, embeds, normalises, or lower-cases any of them.
 *
 * 2. **ONLY self-consistency is checked.** There is no lexicon here, no antonym table, no "careful is the
 *    opposite of reckless". **This module cannot tell that two sentences disagree, and that is the
 *    design.** A tension exists only because the *subject themselves* supplied the incompatibility, by
 *    one of exactly two routes, both recorded with the phase at which the subject supplied them:
 *      - declaring a facet **one-at-a-time** (`declareFacetArity`), or
 *      - declaring two of their own claims incompatible (`declareIncompatible`).
 *    An undeclared facet is `many-at-once` and **can never produce a tension** — a person is plurally
 *    a parent and an engineer, and a detector that read that as drift would be imposing a standard.
 *    Every write refuses on subject mismatch and on unknown claim ids, so the structural claim
 *    *"this can never flag someone for something they did not claim"* is checked, not asserted.
 *
 * 3. **Humans and AI both.** A `SubjectId` is an opaque string. Nothing here assumes a model, a prompt, a
 *    process, or a tick source. `Phase` is a caller-supplied logical position, never a wall clock
 *    (`local-time-never-enters-the-shared-fold`) — so a human's journal and an agent's event log fold the
 *    same way.
 *
 * ## Growth is not drift — pigeonholing is the failure mode, not a fallback
 *
 * Aaron 2026-08-17, on the pigeonhole principle he can win arguments with and deliberately declines to use:
 *
 *   > "it gives people a chance to expand over time where pigeonhole traps them in the current now and
 *   > does not let them expand in the future"
 *
 * *"The subject supplies the category"* is only half of sovereignty. The other half is that **the category
 * stays revisable.** A detector that holds you to what you used to say is the pigeonhole weapon with a
 * friendly interface — and it has a sharp internal consequence: an **agent** is a persistent pattern that
 * propagates **but can evolve**, and a pattern that is frozen is an **actor**. So to pigeonhole an agent by
 * its past self-claims is to have mis-categorised it as the frozen thing. (That agent/actor definition is
 * Aaron's, same session. It is **not yet in the tree** — `docs/CONCEPT-REGISTRY.md` ends at §4 "Open
 * concerns" and has no §4.5 on `origin/main` as of this commit — so it is cited to him, not to a file.)
 *
 * Two mechanisms carry it, and both are structural rather than advisory:
 *
 *   - **Supersession is a first-class act.** `supersedeClaim` says *"this replaces that"* in ONE operation.
 *     Requiring a separate retirement before restating yourself would make the ordinary shape of a person
 *     changing — *"I now say Y"* — read as drift **by default**, which is exactly the trap. The lineage is
 *     kept (§5 memory preservation): what you used to say, and that you moved, both stay visible.
 *   - **`growth` is a representable reading whose availability is DERIVED, not listed.** Where a tension's
 *     two claims were asserted at *different* phases, one came after the other and *"this replaced that"*
 *     is a live reading, so `growth` is offered. Where they were asserted at the *same* phase they
 *     genuinely co-occur and nothing was replaced, so it is not. That is the distinction between *conflict
 *     at the same time* and *replaced over time*, computed from the evidence rather than asserted.
 *
 * It is **offered, never concluded**. Silently inferring supersession would erase a conflict the subject
 * may want to see — the same imposition in the opposite direction. Retired and superseded claims are never
 * evidence against you: tensions are computed over **live** claims only. Drift is two claims held **at
 * once** that the subject's own standard says cannot both hold.
 *
 * ## The charity gradient is in the TYPE (Aaron 2026-08-17)
 *
 *   > "we never see a single instance of self claim drift as malice only accidental, only repeated
 *   > failures are considered evidence of constant drift still not necessarily malice maybe ironic"
 *
 * And on why the gradient is shaped that way — *"this is how i turn tit for tat into lessor tat plus teach
 * and play"*. `teach` is the repair path; `play` is why irony had to be representable.
 *
 * At one tension only `CharitableReading` (`accidental | growth`) is **expressible** — no other reading
 * exists in that position, rather than being merely discouraged. At more than one, the set widens to add
 * `ironic` and `unresolved`, and **`Deceptive` / `Malicious` are members of neither union**, so the moral
 * reading cannot be returned by this module at all. `readingGloss` is exhaustive over `PatternReading`, so
 * widening the union to admit a malice constructor fails `tsc` rather than passing silently
 * (`dual-use-detection-is-neutral-oracle-decides`, manifesto §11 — the mechanism names the fact, the
 * caller's oracle attaches the meaning).
 *
 * ## No threshold — refusing one is the answer here, not merely the safe default
 *
 * *"Only repeated failures"* implies a count, and a bare `DRIFT_THRESHOLD = 3` deciding when a person is in
 * "constant drift" would be a hidden oracle in the most sensitive place available. This module has **no
 * constant, no window, and no rate.** Three reasons, in order of force:
 *
 *   1. **No count changes what may be concluded.** The gradient terminates at *"still not necessarily
 *      malice — maybe ironic"*. A threshold could only change a *label* while the permitted readings stay
 *      identical: decoration with an oracle inside it.
 *   2. **`1` vs `more than 1` is not a chosen constant.** It is the arity distinction in Aaron's own
 *      sentence ("a single instance" / "repeated"), and it is not tunable — there is no 2-vs-3 question,
 *      because "repeated" means "more than once". `2` never appears as a comparand here; `recurring` is
 *      `tensions.length > 1`, the plural of one.
 *   3. **"Constant" is refused outright.** Calling a pattern *constant* needs a window — how recent, over
 *      how many claims — and a window is a hidden constant wearing a different hat. So the report is named
 *      `recurring-drift`, gives the **raw pattern** (every tension, per-facet recurrence counts), and hands
 *      over `claimVolume` as the denominator so a caller who wants a rate has one **without this module
 *      choosing it**. Whether that is "constant" is the caller's judgement, and it is left to them.
 *
 * Precedent for reporting the statistic and returning no verdict: `src/Core.TypeScript/chip9/consult-census.ts`.
 *
 * ## Repair, not sanction
 *
 * Aaron: *"detect self claim drift and **help repair**"*. Every repair move belongs to the subject and
 * every one is optional; nothing is imposed and nothing expires. `supersede` is the move that respects
 * evolution and `hold-both` is a first-class outcome rather than a failure to resolve — an acknowledged
 * tension moves to `held`, stays visible forever (§5), and stops reading as unresolved. That is the
 * **kilesi** shape (`docs/CONCEPT-REGISTRY.md` §4.6): a distortion dissolved by being *seen*, never by force.
 *
 * ## Anchors (Beacon)
 *
 *   - **Festinger, *A Theory of Cognitive Dissonance* (1957)** — dissonance holds between two cognitions
 *     *the person holds*, and is resolved by the person, not by an observer. This module is that structure
 *     made mechanical: only self-held claims, only self-supplied incompatibility, only self-applied repair.
 *     *(cited, not checked — the entailment above is the standard reading, not a verified quotation.)*
 *   - **Rogers, *Client-Centered Therapy* (1951)** — incongruence is measured against the client's own
 *     self-concept and the therapist supplies no standard. Why property 2 is a *design* constraint rather
 *     than a nicety: a check against an external norm is a different, coercive instrument.
 *     *(cited, not checked.)*
 *   - **Nowak & Sigmund (1992), generous tit-for-tat**, with **Axelrod, *The Evolution of Cooperation*
 *     (1984)** as the parent result — GTFT beats strict reciprocity **under noise**, because strict TFT
 *     turns one accidental defection into a retaliation spiral. This is what makes the gradient *correct*
 *     rather than merely kind: in a noisy channel a single signal cannot carry a malice inference.
 *     *(cited, not checked — neither paper was opened for this commit.)*
 *   - **Goguen & Meseguer (1982)**, noninterference — the subject's own declarations are the only channel
 *     by which a standard may enter; an external lexicon would be exactly the ambient influence §13 forbids.
 *   - **Buddhaghosa, *Visuddhimagga*** (5th c. CE) — *kilesa*: distortion dissolved by clear seeing rather
 *     than by force. Named in `docs/CONCEPT-REGISTRY.md` §4.6; the repair affordance is that shape.
 *
 * ## Siblings
 *
 *   - `src/Core.TypeScript/observe/self-claims.ts` — the delivery-commitment instance (met/missed).
 *   - `src/Bayesian/KeptClaimOracle.fs` — `ClaimReading.SelfConflict`: the same refusal to auto-resolve a
 *     self-conflict, for the single binary kept/unkept predicate. This module is its general form.
 *   - `src/Core/DerivationProtocol.fs` — `ReductionKey = SelfClaimed | Inferred`; an inferred category is
 *     recorded and visible but inadmissible. Same rule, different surface.
 */

// ═══ Identity ═══════════════════════════════════════════════════════════════════════════════════════

/*
 * The four aliases below are structurally redundant and kept deliberately: each carries a constraint the
 * bare primitive does not. `Phase` in particular is the difference between a logical position and a wall
 * clock, which is the whole of `local-time-never-enters-the-shared-fold` at this surface, and `SubjectId`
 * being opaque is what keeps the module agnostic between a human and an agent. Collapsing them to
 * `string`/`number` would delete the documentation that makes the disciplines legible at the call site.
 */
/* eslint-disable sonarjs/redundant-type-aliases -- semantic aliases; see the note above */

/** An opaque subject id. A human, an agent, anything that can hold a claim — no runtime is assumed. */
export type SubjectId = string;

/** A subject-scoped claim id. Opaque; this module never interprets its shape. */
export type ClaimId = string;

/** A dimension name **chosen by the subject**. Never drawn from a registry, never normalised. */
export type FacetName = string;

/**
 * A logical position, supplied by the caller. **Not a wall clock.** Used only to order the subject's own
 * declarations relative to each other (`local-time-never-enters-the-shared-fold`).
 */
export type Phase = number;

/* eslint-enable sonarjs/redundant-type-aliases */

/** An identity claim: what the subject says they are. */
export interface IdentityClaim {
  readonly subject: SubjectId;
  readonly claimId: ClaimId;
  /** The subject's own name for the dimension this claim is about. */
  readonly facet: FacetName;
  /** The subject's own word for where they stand on that dimension. Compared only for exact equality. */
  readonly value: string;
  /** The subject's own sentence, preserved verbatim for the repair prompt. Never parsed. */
  readonly text: string;
  readonly assertedAt: Phase;
}

/**
 * Whether a facet admits one live value or many — **declared by the subject about their own facet**.
 * `many-at-once` is the default for any facet never declared, which is what makes the undeclared case
 * incapable of producing a tension.
 */
export type FacetArity = "one-at-a-time" | "many-at-once";

/** The default for an undeclared facet. Charitable by construction: no declaration ⇒ no detection. */
export const DEFAULT_FACET_ARITY: FacetArity = "many-at-once";

export interface FacetDeclaration {
  readonly subject: SubjectId;
  readonly facet: FacetName;
  readonly arity: FacetArity;
  readonly declaredAt: Phase;
}

/** "These two claims of mine cannot both be true." Authored by the subject, about the subject's own claims. */
export interface IncompatibilityDeclaration {
  readonly subject: SubjectId;
  readonly claimIdA: ClaimId;
  readonly claimIdB: ClaimId;
  readonly declaredAt: Phase;
}

/** A claim the subject no longer holds. Retiring is growth, and growth is never drift. */
export interface Retirement {
  readonly subject: SubjectId;
  readonly claimId: ClaimId;
  readonly retiredAt: Phase;
}

/**
 * "This claim of mine replaces that one." The lineage of a subject **evolving**, kept rather than erased:
 * the superseded claim stays in the ledger and stops being live, and the link records that a move happened.
 */
export interface Supersession {
  readonly subject: SubjectId;
  /** The claim being replaced. */
  readonly supersededId: ClaimId;
  /** The claim replacing it. */
  readonly replacementId: ClaimId;
  readonly at: Phase;
}

/** "I see it, and I am keeping both." Not a failure to resolve — a resolution the subject chose. */
export interface Acknowledgement {
  readonly subject: SubjectId;
  readonly claimIdA: ClaimId;
  readonly claimIdB: ClaimId;
  readonly acknowledgedAt: Phase;
}

// ═══ Ledger ═════════════════════════════════════════════════════════════════════════════════════════

/** Append-only; folded from an event log exactly like `ClaimsLedger`. */
export interface IdentityLedger {
  readonly claims: readonly IdentityClaim[];
  readonly facetDeclarations: readonly FacetDeclaration[];
  readonly incompatibilities: readonly IncompatibilityDeclaration[];
  readonly retirements: readonly Retirement[];
  readonly supersessions: readonly Supersession[];
  readonly acknowledgements: readonly Acknowledgement[];
}

export const EMPTY_IDENTITY_LEDGER: IdentityLedger = {
  claims: [],
  facetDeclarations: [],
  incompatibilities: [],
  retirements: [],
  supersessions: [],
  acknowledgements: [],
};

/**
 * Why a write was refused. **These refusals are the falsifiers for property 1 and property 2** — each one
 * is a route by which someone else's standard, or a claim never made, could otherwise have entered.
 */
export type Refusal =
  /** Someone other than the subject tried to write about the subject. The coercion vector, closed. */
  | { readonly kind: "not-your-claim"; readonly actor: SubjectId; readonly owner: SubjectId }
  /** A declaration referenced a claim id this subject never asserted. Closes "flagged for what you did not claim". */
  | { readonly kind: "unknown-claim"; readonly subject: SubjectId; readonly claimId: ClaimId }
  /** A claim cannot be incompatible with, or supersede, itself. */
  | { readonly kind: "self-pair"; readonly claimId: ClaimId };

export type LedgerResult =
  | { readonly ok: true; readonly ledger: IdentityLedger }
  | { readonly ok: false; readonly refusal: Refusal };

function ok(ledger: IdentityLedger): LedgerResult {
  return { ok: true, ledger };
}

function refused(refusal: Refusal): LedgerResult {
  return { ok: false, refusal };
}

/** Ordinal (UTF-16 code-unit) comparison. Never a culture-sensitive comparison — ordinal by default. */
function ordinal(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function hasClaim(ledger: IdentityLedger, subject: SubjectId, claimId: ClaimId): boolean {
  return ledger.claims.some((c) => c.subject === subject && c.claimId === claimId);
}

/**
 * Assert an identity claim. Idempotent by `claimId`: re-asserting an existing id **replaces** it rather
 * than appending a duplicate (discipline #6), so a fold that redelivers an event converges.
 *
 * `actor` is who is writing. It must equal `claim.subject`: nobody claims an identity on someone's behalf.
 */
export function assertClaim(ledger: IdentityLedger, actor: SubjectId, claim: IdentityClaim): LedgerResult {
  if (actor !== claim.subject) return refused({ kind: "not-your-claim", actor, owner: claim.subject });
  const without = ledger.claims.filter((c) => !(c.subject === claim.subject && c.claimId === claim.claimId));
  return ok({ ...ledger, claims: [...without, claim] });
}

/** Declare how many values one of **your own** facets admits at once. */
export function declareFacetArity(ledger: IdentityLedger, actor: SubjectId, decl: FacetDeclaration): LedgerResult {
  if (actor !== decl.subject) return refused({ kind: "not-your-claim", actor, owner: decl.subject });
  return ok({ ...ledger, facetDeclarations: [...ledger.facetDeclarations, decl] });
}

/**
 * Declare that two of **your own** claims cannot both be true.
 *
 * Both ids must already exist for this subject. Without that check a caller could name a claim the subject
 * never made and manufacture a tension out of nothing — the precise failure this design forbids.
 */
export function declareIncompatible(
  ledger: IdentityLedger,
  actor: SubjectId,
  decl: IncompatibilityDeclaration,
): LedgerResult {
  if (actor !== decl.subject) return refused({ kind: "not-your-claim", actor, owner: decl.subject });
  if (decl.claimIdA === decl.claimIdB) return refused({ kind: "self-pair", claimId: decl.claimIdA });
  if (!hasClaim(ledger, decl.subject, decl.claimIdA)) {
    return refused({ kind: "unknown-claim", subject: decl.subject, claimId: decl.claimIdA });
  }
  if (!hasClaim(ledger, decl.subject, decl.claimIdB)) {
    return refused({ kind: "unknown-claim", subject: decl.subject, claimId: decl.claimIdB });
  }
  return ok({ ...ledger, incompatibilities: [...ledger.incompatibilities, decl] });
}

/** Retire one of your own claims. The claim stays in the ledger (§5); it simply stops being live. */
export function retireClaim(ledger: IdentityLedger, actor: SubjectId, retirement: Retirement): LedgerResult {
  if (actor !== retirement.subject) return refused({ kind: "not-your-claim", actor, owner: retirement.subject });
  if (!hasClaim(ledger, retirement.subject, retirement.claimId)) {
    return refused({ kind: "unknown-claim", subject: retirement.subject, claimId: retirement.claimId });
  }
  return ok({ ...ledger, retirements: [...ledger.retirements, retirement] });
}

/**
 * **Evolve**: assert a replacement claim and mark the prior one superseded, in ONE act.
 *
 * This is the operation that keeps the category revisable. If restating yourself required a separate
 * retirement first, the ordinary shape of change would read as drift by default — the pigeonhole. The
 * superseded claim is preserved and the link is recorded, so the history shows a move rather than a gap.
 */
export function supersedeClaim(
  ledger: IdentityLedger,
  actor: SubjectId,
  subject: SubjectId,
  supersededId: ClaimId,
  replacement: IdentityClaim,
  at: Phase,
): LedgerResult {
  if (actor !== subject) return refused({ kind: "not-your-claim", actor, owner: subject });
  if (replacement.subject !== subject) {
    return refused({ kind: "not-your-claim", actor, owner: replacement.subject });
  }
  if (supersededId === replacement.claimId) return refused({ kind: "self-pair", claimId: supersededId });
  if (!hasClaim(ledger, subject, supersededId)) {
    return refused({ kind: "unknown-claim", subject, claimId: supersededId });
  }
  const asserted = assertClaim(ledger, actor, replacement);
  if (!asserted.ok) return asserted;
  return ok({
    ...asserted.ledger,
    supersessions: [
      ...asserted.ledger.supersessions,
      { subject, supersededId, replacementId: replacement.claimId, at },
    ],
  });
}

/** See a tension and choose to keep both sides of it. Only the subject may do this. */
export function acknowledgeTension(ledger: IdentityLedger, actor: SubjectId, ack: Acknowledgement): LedgerResult {
  if (actor !== ack.subject) return refused({ kind: "not-your-claim", actor, owner: ack.subject });
  if (!hasClaim(ledger, ack.subject, ack.claimIdA)) {
    return refused({ kind: "unknown-claim", subject: ack.subject, claimId: ack.claimIdA });
  }
  if (!hasClaim(ledger, ack.subject, ack.claimIdB)) {
    return refused({ kind: "unknown-claim", subject: ack.subject, claimId: ack.claimIdB });
  }
  return ok({ ...ledger, acknowledgements: [...ledger.acknowledgements, ack] });
}

// ═══ The fact ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Why two claims are in tension. **Every constructor carries the phase at which the SUBJECT supplied the
 * standard** — so a tension is always traceable to the subject's own declaration, and there is no third
 * constructor for "a standard from somewhere else".
 */
export type TensionGround =
  | { readonly kind: "one-at-a-time-facet"; readonly facet: FacetName; readonly declaredAt: Phase }
  | { readonly kind: "subject-declared-incompatible"; readonly declaredAt: Phase };

/**
 * Two live claims the subject's own standard says cannot both hold. **A fact, not a verdict** — it names
 * what was observed and carries no reading.
 */
export interface Tension {
  readonly subject: SubjectId;
  /** The earlier-asserted claim (ties broken by ordinal claim id, so the pair is deterministic). */
  readonly earlier: IdentityClaim;
  readonly later: IdentityClaim;
  /** Every route by which the subject made these incompatible. Plural: a pair can be both. */
  readonly grounds: readonly TensionGround[];
}

/**
 * Did one claim come after the other? The structural fact that makes `growth` a live reading.
 *
 * Same phase ⇒ the two genuinely co-occur, nothing was replaced, and "you evolved" is not on the table.
 */
export function spansPhases(tension: Tension): boolean {
  return tension.earlier.assertedAt !== tension.later.assertedAt;
}

// ═══ The permitted readings — the charity gradient, as types ════════════════════════════════════════

/**
 * The readings available at **one** tension. Both members are fully exculpatory.
 *
 * Malice is not discouraged here, it is **not a member of this type**: at a single drift there is no
 * expression in this module that yields any other reading.
 *
 * `growth` is the one the coordinator's correction added, and it is the one a naive detector destroys:
 * a contradiction between an old claim and a new one may be **development rather than drift at all**.
 */
export type CharitableReading = "accidental" | "growth";

/**
 * The readings available once there is a **pattern**. Note what is still absent: no `deceptive`, no
 * `malicious`, no `bad-faith`. The gradient's terminus is *"still not necessarily malice — maybe ironic"*,
 * so this is the widest set this module will ever return.
 *
 * `unresolved` is a fact about the *pair* (seen, not acknowledged, not repaired) — not about the person.
 */
export type PatternReading = CharitableReading | "ironic" | "unresolved";

function assertNever(x: never): never {
  throw new Error(`unreachable: ${String(x)}`);
}

/**
 * Plain-language gloss for a reading.
 *
 * **This switch is the compile-time guard on the charity gradient.** It is exhaustive over
 * `PatternReading`; adding a `"deceptive"` member to that union leaves this switch non-exhaustive and
 * `tsc` rejects the `assertNever` call. A moral constructor cannot be smuggled in silently.
 */
export function readingGloss(reading: PatternReading): string {
  switch (reading) {
    case "accidental":
      return "you probably did not notice these were both live";
    case "growth":
      return "the later one may simply have replaced the earlier — you changed";
    case "ironic":
      return "you may be holding both on purpose";
    case "unresolved":
      return "you have seen this and not settled it, which is allowed";
    default:
      return assertNever(reading);
  }
}

/**
 * The readings available for ONE tension — **derived from the tension, not from a fixed list**.
 *
 * `growth` appears exactly when the two claims were asserted at different phases, because only then is
 * "the later replaced the earlier" a thing that could have happened.
 */
export function charitableReadingsFor(tension: Tension): readonly CharitableReading[] {
  return spansPhases(tension) ? (["accidental", "growth"] as const) : (["accidental"] as const);
}

/**
 * The readings available for a **pattern**: every charitable reading that applies to at least one tension
 * in it, plus `ironic` and `unresolved`. The caller's oracle picks; this module does not rank them.
 */
export function patternReadingsFor(tensions: readonly Tension[]): readonly PatternReading[] {
  const out: PatternReading[] = ["accidental"];
  if (tensions.some(spansPhases)) out.push("growth");
  out.push("ironic", "unresolved");
  return out;
}

// ═══ The observation ════════════════════════════════════════════════════════════════════════════════

/** How often a facet recurs in the pattern. The raw counts, never a rate — the caller forms rates. */
export interface FacetRecurrence {
  readonly facet: FacetName;
  readonly tensions: number;
}

/**
 * What was observed. Three constructors, and **none of them concludes anything about the subject**.
 *
 * `recurring-drift` is *not* named `constant-drift`: calling a pattern constant needs a window (how
 * recent, over how many claims), and a window is a hidden constant. The pattern is reported raw.
 */
export type DriftObservation =
  | { readonly kind: "no-tension" }
  | {
      readonly kind: "drift-detected";
      readonly tension: Tension;
      /** Only `CharitableReading` is expressible here — the type, not a convention, is the gradient. */
      readonly readings: readonly CharitableReading[];
    }
  | {
      readonly kind: "recurring-drift";
      /** Every tension, in full. No sampling, no top-N, no summary that could hide one. */
      readonly tensions: readonly Tension[];
      readonly readings: readonly PatternReading[];
      readonly perFacet: readonly FacetRecurrence[];
    };

/**
 * The full report for one subject.
 *
 * `claimVolume` and `liveClaims` are the **denominators**: a caller who wants "drift per claim" has what
 * it needs, and this module still never forms the ratio or compares it to anything.
 */
export interface DriftReport {
  readonly subject: SubjectId;
  readonly observation: DriftObservation;
  /** Tensions the subject has SEEN and chosen to keep. Still visible; no longer unresolved. */
  readonly held: readonly Tension[];
  /** Every claim this subject ever asserted — live, retired, or superseded. */
  readonly claimVolume: number;
  readonly liveClaims: number;
  /** How many of this subject's claims were superseded. Evolution, counted but never scored. */
  readonly supersededClaims: number;
}

// ═══ Detection ══════════════════════════════════════════════════════════════════════════════════════

function liveClaimsOf(ledger: IdentityLedger, subject: SubjectId): readonly IdentityClaim[] {
  const gone = new Set<ClaimId>();
  for (const r of ledger.retirements) if (r.subject === subject) gone.add(r.claimId);
  for (const s of ledger.supersessions) if (s.subject === subject) gone.add(s.supersededId);
  return ledger.claims.filter((c) => c.subject === subject && !gone.has(c.claimId));
}

/** The subject's latest declaration for a facet; `DEFAULT_FACET_ARITY` when they never declared one. */
function arityOf(ledger: IdentityLedger, subject: SubjectId, facet: FacetName): FacetDeclaration | undefined {
  let latest: FacetDeclaration | undefined;
  for (const d of ledger.facetDeclarations) {
    if (d.subject !== subject || d.facet !== facet) continue;
    if (latest === undefined || d.declaredAt >= latest.declaredAt) latest = d;
  }
  return latest;
}

/** Unordered pair key, ordinal-ordered so the key is stable regardless of argument order. */
function pairKey(a: ClaimId, b: ClaimId): string {
  return ordinal(a, b) <= 0 ? `${a} ${b}` : `${b} ${a}`;
}

/** Every unordered pair of live claims, once each. Extracted so `findTensions` reads as its two routes. */
function* livePairs(
  live: readonly IdentityClaim[],
): Generator<readonly [IdentityClaim, IdentityClaim]> {
  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const x = live[i];
      const y = live[j];
      if (x !== undefined && y !== undefined) yield [x, y];
    }
  }
}

/** Deterministic orientation of a pair: earlier phase first, ordinal claim id breaking ties. */
function orient(x: IdentityClaim, y: IdentityClaim): readonly [IdentityClaim, IdentityClaim] {
  if (x.assertedAt < y.assertedAt) return [x, y];
  if (y.assertedAt < x.assertedAt) return [y, x];
  return ordinal(x.claimId, y.claimId) <= 0 ? [x, y] : [y, x];
}

/**
 * Find every tension among a subject's live claims.
 *
 * Both routes are subject-supplied and there is no third. Note what is *absent*: no comparison of `text`,
 * no similarity, no negation detection, no lexicon. Two claims whose sentences read as opposite to any
 * human are **not** in tension here unless the subject said so — that is the non-coercion property, and it
 * is a property of what this function does not contain.
 *
 * Same-value claims on a one-at-a-time facet are not a tension: restating yourself is not drift.
 */
export function findTensions(ledger: IdentityLedger, subject: SubjectId): readonly Tension[] {
  const live = liveClaimsOf(ledger, subject);
  const byId = new Map<ClaimId, IdentityClaim>();
  for (const c of live) byId.set(c.claimId, c);

  const grounds = new Map<string, TensionGround[]>();
  const pairs = new Map<string, readonly [IdentityClaim, IdentityClaim]>();

  const add = (x: IdentityClaim, y: IdentityClaim, ground: TensionGround): void => {
    const key = pairKey(x.claimId, y.claimId);
    if (!pairs.has(key)) pairs.set(key, orient(x, y));
    const list = grounds.get(key);
    if (list === undefined) grounds.set(key, [ground]);
    else list.push(ground);
  };

  // Route 1 — a facet the subject declared one-at-a-time, holding two different values at once.
  for (const [x, y] of livePairs(live)) {
    if (x.facet !== y.facet) continue;
    if (x.value === y.value) continue; // restating yourself is not drift
    const decl = arityOf(ledger, subject, x.facet);
    if (decl?.arity !== "one-at-a-time") continue; // undeclared ⇒ many-at-once ⇒ never a tension
    add(x, y, { kind: "one-at-a-time-facet", facet: x.facet, declaredAt: decl.declaredAt });
  }

  // Route 2 — the subject declared these two of their own claims incompatible.
  for (const inc of ledger.incompatibilities) {
    if (inc.subject !== subject) continue;
    const x = byId.get(inc.claimIdA);
    const y = byId.get(inc.claimIdB);
    if (x === undefined || y === undefined) continue; // one side retired or superseded: not a live tension
    add(x, y, { kind: "subject-declared-incompatible", declaredAt: inc.declaredAt });
  }

  const out: Tension[] = [];
  for (const [key, oriented] of pairs) {
    out.push({ subject, earlier: oriented[0], later: oriented[1], grounds: grounds.get(key) ?? [] });
  }
  // Deterministic order (DST): by the later claim's phase, then ordinal pair key.
  out.sort((p, q) => {
    const byPhase = p.later.assertedAt - q.later.assertedAt;
    if (byPhase !== 0) return byPhase;
    return ordinal(pairKey(p.earlier.claimId, p.later.claimId), pairKey(q.earlier.claimId, q.later.claimId));
  });
  return out;
}

/**
 * Observe a subject against **their own** claims.
 *
 * `recurring` is `unheld.length > 1` — the plural of one, taken straight from Aaron's "a single instance"
 * vs "repeated". No tunable constant appears in this function, and `perFacet` hands over the raw counts so
 * that any sharper question ("is that constant?") is answerable by the caller and unanswered here.
 */
export function observeDrift(ledger: IdentityLedger, subject: SubjectId): DriftReport {
  const all = findTensions(ledger, subject);
  const acked = new Set(
    ledger.acknowledgements.filter((a) => a.subject === subject).map((a) => pairKey(a.claimIdA, a.claimIdB)),
  );
  const isAcked = (t: Tension): boolean => acked.has(pairKey(t.earlier.claimId, t.later.claimId));
  const held = all.filter(isAcked);
  const unheld = all.filter((t) => !isAcked(t));

  const claimVolume = ledger.claims.filter((c) => c.subject === subject).length;
  const liveClaims = liveClaimsOf(ledger, subject).length;
  const supersededClaims = ledger.supersessions.filter((s) => s.subject === subject).length;

  let observation: DriftObservation;
  if (unheld.length === 0) {
    observation = { kind: "no-tension" };
  } else if (unheld.length === 1) {
    const only = unheld[0];
    if (only === undefined) throw new Error("unreachable: length 1 with no element");
    observation = { kind: "drift-detected", tension: only, readings: charitableReadingsFor(only) };
  } else {
    observation = {
      kind: "recurring-drift",
      tensions: unheld,
      readings: patternReadingsFor(unheld),
      perFacet: facetRecurrence(unheld),
    };
  }

  return { subject, observation, held, claimVolume, liveClaims, supersededClaims };
}

/** Raw per-facet counts, ordinal-sorted. A count, never a rate. */
export function facetRecurrence(tensions: readonly Tension[]): readonly FacetRecurrence[] {
  const counts = new Map<FacetName, number>();
  for (const t of tensions) {
    for (const facet of new Set([t.earlier.facet, t.later.facet])) {
      counts.set(facet, (counts.get(facet) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([facet, n]) => ({ facet, tensions: n }))
    .sort((a, b) => ordinal(a.facet, b.facet));
}

// ═══ Repair ═════════════════════════════════════════════════════════════════════════════════════════

/**
 * What the subject may do about a tension. **Every move is theirs and every move is optional** — there is
 * no `resolve` a third party can call and no move that expires. Doing nothing is a permitted outcome.
 *
 * Two are load-bearing. `supersede` respects **evolution** — it is the move that lets the category stay
 * revisable instead of trapping the subject in the current now. `hold-both` keeps **plurality and irony**
 * from being failures; without it the instrument would demand resolution, reintroducing the coercion the
 * design forbids.
 *
 * The order below is not a ranking. Nothing here is recommended.
 */
export type RepairMove =
  /** "I no longer hold this." */
  | { readonly kind: "retire"; readonly claimId: ClaimId }
  /** "This replaces that." Growth, with the lineage kept. */
  | { readonly kind: "supersede"; readonly supersededId: ClaimId; readonly replacement: IdentityClaim }
  /** "I see it and I am keeping both." A resolution, not a deferral. */
  | { readonly kind: "hold-both"; readonly claimIdA: ClaimId; readonly claimIdB: ClaimId }
  /** "I was wrong that these conflict." The subject wrote the standard, so the subject may rewrite it. */
  | { readonly kind: "withdraw-incompatibility"; readonly claimIdA: ClaimId; readonly claimIdB: ClaimId }
  /** "This facet does admit several values at once after all." */
  | { readonly kind: "revise-facet-arity"; readonly facet: FacetName; readonly arity: FacetArity };

/**
 * The kinds of move offered for a tension — derived from the tension's own grounds, so the subject is only
 * offered moves that would actually bear on it. `supersede` and `refine` need a replacement claim only the
 * subject can write, so the menu names the *kind*; the subject supplies the content.
 */
export type RepairMoveKind = RepairMove["kind"];

export function offeredMoveKinds(tension: Tension): readonly RepairMoveKind[] {
  const kinds: RepairMoveKind[] = ["retire", "hold-both"];
  if (spansPhases(tension)) kinds.push("supersede"); // only meaningful when one came after the other
  for (const g of tension.grounds) {
    if (g.kind === "subject-declared-incompatible") kinds.push("withdraw-incompatibility");
    else kinds.push("revise-facet-arity");
  }
  return [...new Set(kinds)];
}

/**
 * What the subject sees: **their own two sentences, verbatim**, and the reason they are paired — which is
 * always something the subject themselves declared. No paraphrase, no diagnosis, no score.
 *
 * The kilesi shape: the whole repair is that the pair becomes visible. `readings` is passed through so the
 * prompt states what MAY be read and, by omission, what may not.
 */
export function repairPrompt(tension: Tension, readings: readonly PatternReading[]): string {
  const why = tension.grounds
    .map((g) =>
      g.kind === "one-at-a-time-facet"
        ? `you said "${g.facet}" holds one value at a time (phase ${String(g.declaredAt)})`
        : `you said these two cannot both be true (phase ${String(g.declaredAt)})`,
    )
    .join("; ");
  const line = (c: IdentityClaim): string =>
    `  · "${c.text}"  (${c.facet} = ${c.value}, phase ${String(c.assertedAt)})`;
  return [
    "Both of these are live at once:",
    line(tension.earlier),
    line(tension.later),
    `They are paired because ${why}.`,
    ...readings.map((r) => `  · ${r}: ${readingGloss(r)}`),
    "Nothing is required of you. You may let the later one replace the earlier, retire either, or keep both.",
  ].join("\n");
}

/**
 * Apply a repair move. Only the subject may repair their own ledger, so this refuses on actor mismatch
 * exactly as the write path does.
 */
export function applyRepair(
  ledger: IdentityLedger,
  actor: SubjectId,
  subject: SubjectId,
  move: RepairMove,
  atPhase: Phase,
): LedgerResult {
  if (actor !== subject) return refused({ kind: "not-your-claim", actor, owner: subject });

  switch (move.kind) {
    case "retire":
      return retireClaim(ledger, actor, { subject, claimId: move.claimId, retiredAt: atPhase });

    case "supersede":
      return supersedeClaim(ledger, actor, subject, move.supersededId, move.replacement, atPhase);

    case "hold-both":
      return acknowledgeTension(ledger, actor, {
        subject,
        claimIdA: move.claimIdA,
        claimIdB: move.claimIdB,
        acknowledgedAt: atPhase,
      });

    case "withdraw-incompatibility": {
      const key = pairKey(move.claimIdA, move.claimIdB);
      return ok({
        ...ledger,
        incompatibilities: ledger.incompatibilities.filter(
          (i) => !(i.subject === subject && pairKey(i.claimIdA, i.claimIdB) === key),
        ),
      });
    }

    case "revise-facet-arity":
      return declareFacetArity(ledger, actor, {
        subject,
        facet: move.facet,
        arity: move.arity,
        declaredAt: atPhase,
      });

    default:
      return assertNever(move);
  }
}
