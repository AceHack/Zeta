/**
 * local-trust-view.ts — every node computes its own verdict.
 *
 * Trajectory: `docs/trajectories/local-trust-view-decentralized-identity/RESUME.md`, slice 1.
 *
 * ## The carved sentence
 *
 * **Freedom is choosing who you trust without accidental interference.** A node's trust
 * verdict is a **pure function of what that node holds** — its own anchors, nothing else.
 * No registry consulted, no global graph assembled, no ambient input. Two nodes with
 * different histories may reach **different verdicts about the same subject, and both are
 * correct**.
 *
 * ## Why purity is the freedom guarantee, not a style preference
 *
 * §13 noninterference: influence enters only through declared, metered channels. A verdict
 * contaminated by *ambient* state — a global registry, a shared graph, someone else's
 * oracle consulted by default — has taken influence through an undeclared channel, and it
 * is *accidental* precisely because nobody chose it; it arrived by architecture.
 *
 * A function that reads only its arguments **cannot** be steered by a party the node did
 * not choose to consult. That is checkable rather than promised, which is the entire
 * point.
 *
 * ## What this deliberately does NOT do
 *
 * - **No `Friend` / `Enemy` verdict.** It reports the FACT (`SharedAnchor(depth)`,
 *   `ChainVerified`, `ChainBroken`) and leaves the reading to the caller's oracle.
 *   Reunion, sybil, and deanonymisation are three readings of one observation
 *   (`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`); a mechanism that
 *   picked one would smuggle in a morality the substrate is not allowed to hold.
 * - **No authentication.** A shared anchor proves shared *history*, not identity. The
 *   phase chain is verifiable but NOT secret, so anyone holding an anchor can produce
 *   valid continuations — this resists cheap *fabrication* (you cannot mint participation)
 *   but not *theft*. Closing that needs signatures over the stamp
 *   (`MultiSignatureVerification`), which is slice 3.
 * - **No enumeration.** There is no `allSubjects()` and no way to ask for "everyone's"
 *   view. A global graph that exists can leave; the only protection against a reading you
 *   do not control is that the object was never assembled.
 */

import type { PhaseState } from "./phase-clock";
import { verifyFromAnchor, type ChainVerdict } from "./phase-erasure";

/**
 * An **open** identifier. Any string a node can mint locally — a ZetaId, a public-key
 * fingerprint, an anchor digest.
 *
 * Deliberately NOT `PersonaId`. That registry is a closed generated enum of known factory
 * personas: an honest measure of today's head of a power-law distribution, and useful for
 * DST-deterministic exhaustive matching. It is not an issuer, and it must not become one —
 * a subject with no persona label is a first-class participant here, not an error case.
 */
export type SubjectId = string;

/** A stamp this node holds about a subject, and vouches for having witnessed. */
export interface HeldAnchor {
  readonly subject: SubjectId;
  readonly stamp: PhaseState;
}

/**
 * A neutral fact. Never a judgement.
 *
 * `depth` is the distance from the node's most recent knowledge back to the shared anchor:
 * **0 means the anchor is the latest thing this node holds about the subject**, and larger
 * is staler. Recency is the strength measure — a common anchor from 3 phases ago is worth
 * more than one from 300, because more has happened since that neither party witnessed.
 */
export type TrustSignal =
  | { readonly kind: "shared-anchor"; readonly depth: number; readonly atPhase: number }
  | { readonly kind: "chain-verified"; readonly span: number }
  | { readonly kind: "chain-broken"; readonly reason: NonNullable<ChainVerdict["reason"]>; readonly span: number }
  | { readonly kind: "no-evidence" };

/**
 * The verdict is a **spectrum**: an ordered list of facts, not a score and not a boolean.
 *
 * Collapsing to a number would force a threshold nobody can justify, and collapsing to a
 * boolean would force the mechanism to choose a reading. Both are the failure this module
 * exists to avoid.
 */
export interface TrustVerdict {
  readonly subject: SubjectId;
  readonly signals: readonly TrustSignal[];
}

/**
 * A node's own view. Constructed from what it holds; queryable only per-subject.
 *
 * Note the shape: `about()` takes the claim as an ARGUMENT. Evidence a node chose to fetch
 * and can inspect is legitimate input; the same evidence arriving because the function
 * reached out for it would be the ambient channel §13 forbids. The distinction is visible
 * in the signature, which is where it belongs.
 */
export interface TrustView {
  /** This node's verdict about one subject, given a claimed chain it was handed. */
  about(subject: SubjectId, claimedChain: readonly PhaseState[]): TrustVerdict;
}

/**
 * Deepest anchor this node holds about `subject`, by phase. Local, private, no enumeration
 * of subjects is exposed.
 */
function latestHeldFor(
  held: readonly HeldAnchor[],
  subject: SubjectId,
): PhaseState | undefined {
  let best: PhaseState | undefined;
  for (const a of held) {
    if (a.subject !== subject) continue;
    if (!best || a.stamp.phase > best.phase) best = a.stamp;
  }
  return best;
}

export function createTrustView(held: readonly HeldAnchor[]): TrustView {
  // Copy at construction so a later mutation of the caller's array cannot retroactively
  // change verdicts. Purity is only real if the inputs cannot move underneath it.
  const snapshot: readonly HeldAnchor[] = held.map((a) => ({ ...a, stamp: { ...a.stamp } }));

  return {
    about(subject, claimedChain) {
      const signals: TrustSignal[] = [];
      const anchor = latestHeldFor(snapshot, subject);

      if (!anchor) {
        // No shared history. NOT "untrusted" — the absence of evidence, reported as such.
        // A brand-new honest participant and a fabricated identity are indistinguishable
        // here, and saying so is more useful than guessing.
        return { subject, signals: [{ kind: "no-evidence" }] };
      }

      // Which claimed stamps sit at or beyond what we already know?
      const forward = claimedChain.filter((s) => s.phase >= anchor.phase);
      const newest = forward.reduce<PhaseState | undefined>(
        (acc, s) => (!acc || s.phase > acc.phase ? s : acc),
        undefined,
      );

      // Depth: how stale is the shared anchor relative to the claim we were handed.
      const depth = newest ? newest.phase - anchor.phase : 0;
      signals.push({ kind: "shared-anchor", depth, atPhase: anchor.phase });

      if (newest && newest.phase > anchor.phase) {
        const v = verifyFromAnchor(anchor, newest);
        signals.push(
          v.ok
            ? { kind: "chain-verified", span: v.span }
            : { kind: "chain-broken", reason: v.reason!, span: v.span },
        );
      }

      return { subject, signals };
    },
  };
}

/**
 * Slice 1b — **the disagreement IS the product.**
 *
 * Returns which anchors each side holds that the other does not, for one subject. NOT a
 * merged score: averaging destroys the information, while the divergence *localises* what
 * one node knows that the other does not. Knight & Leveson (1986) applied to trust —
 * independently developed views fail in correlated ways, so voting buys little and the
 * value is in reading the divergence.
 *
 * **Asymmetric on purpose.** `diff(a,b)` and `diff(b,a)` answer different questions, and
 * collapsing them into a symmetric distance would discard the direction that tells you
 * what to go learn.
 *
 * Pairwise and initiated by a party who already holds one side — never a broadcast, so the
 * no-global-graph constraint survives.
 */
export interface TrustDiff {
  readonly subject: SubjectId;
  /** Phases the OTHER side holds that we do not — i.e. what we could go learn. */
  readonly theyKnowWeDoNot: readonly number[];
  /** Phases WE hold that they do not. */
  readonly weKnowTheyDoNot: readonly number[];
}

export function diffTrustView(
  mine: readonly HeldAnchor[],
  theirs: readonly HeldAnchor[],
  subject: SubjectId,
): TrustDiff {
  const phasesOf = (xs: readonly HeldAnchor[]) =>
    new Set(xs.filter((a) => a.subject === subject).map((a) => a.stamp.phase));
  const a = phasesOf(mine);
  const b = phasesOf(theirs);
  return {
    subject,
    theyKnowWeDoNot: [...b].filter((p) => !a.has(p)).sort((x, y) => x - y),
    weKnowTheyDoNot: [...a].filter((p) => !b.has(p)).sort((x, y) => x - y),
  };
}
