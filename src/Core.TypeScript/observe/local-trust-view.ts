/**
 * local-trust-view.ts — every node computes its own verdict.
 *
 * Trajectory: `docs/trajectories/local-trust-view-decentralized-identity/RESUME.md`, slices 1 + 1b.
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
 * **Precisely what is claimed (corrected after review):** the *verdict* is a pure function
 * of `(held-at-construction, subject, claimedChain)`. It is NOT true that nothing in the
 * call graph touches ambient state — `verifyFromAnchor` builds a clock, and
 * `createPhaseClock` reads `new Date()` for a `wallClockAt` field. That value never reaches
 * a `TrustSignal`, so the output is unaffected; but the earlier wording ("reads only its
 * arguments") described the call graph and was false. Stating the narrower true claim.
 *
 * ## What this deliberately does NOT do
 *
 * - **No `Friend` / `Enemy` verdict.** It reports facts and leaves the reading to the
 *   caller's oracle. Reunion, sybil and deanonymisation are three readings of one
 *   observation (`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`).
 * - **No authentication.** A shared anchor proves shared *history*, not identity. The chain
 *   is verifiable but NOT secret, so this resists cheap *fabrication* (participation cannot
 *   be minted) but not *theft*. Signatures over the stamp are slice 3.
 * - **No enumeration.** No `allSubjects()`, and — after review — `diffTrustView` takes
 *   per-subject stamps rather than a peer's whole cross-subject anchor set, so the API
 *   cannot be used to assemble one.
 */

import type { PhaseState } from "./phase-clock";
import { firstBrokenLink, verifyFromAnchor } from "./phase-erasure";

/**
 * An **open** identifier. Any string a node can mint locally — a ZetaId, a public-key
 * fingerprint, an anchor digest. Deliberately NOT `PersonaId`: that closed enum is an
 * honest measure of today's known personas, not an issuer, and a subject with no label is
 * a first-class participant here.
 */
export type SubjectId = string;

/** A stamp this node holds about a subject and vouches for having witnessed. */
export interface HeldAnchor {
  readonly subject: SubjectId;
  readonly stamp: PhaseState;
}

/**
 * A neutral fact. Never a judgement.
 *
 * `depth` is **how much has happened since the shared anchor**, measured against the claim
 * presented: `newestClaimedPhase − anchorPhase`. Larger means staler — more has occurred
 * that neither party witnessed together.
 *
 * The exhaustive kind list is the type-level guarantee that no verdict is emitted. Adding
 * a judgement here would require changing this union, which is the falsifier the tests
 * assert against.
 */
export type TrustSignal =
  | { readonly kind: "shared-anchor"; readonly depth: number; readonly atPhase: number }
  | { readonly kind: "chain-verified"; readonly span: number; readonly links: number }
  | {
      readonly kind: "chain-broken";
      readonly reason: "non-monotonic" | "span-exceeded" | "malformed" | "seed-mismatch";
      readonly atIndex: number;
    }
  | { readonly kind: "no-evidence" };

/** Every legal `TrustSignal.kind`, exported so tests can assert exhaustiveness. */
export const TRUST_SIGNAL_KINDS = [
  "shared-anchor",
  "chain-verified",
  "chain-broken",
  "no-evidence",
] as const;

/**
 * The verdict is a **spectrum** — an ordered list of facts, not a score and not a boolean.
 * Collapsing to a number forces a threshold nobody can justify; collapsing to a boolean
 * forces the mechanism to choose a reading.
 */
export interface TrustVerdict {
  readonly subject: SubjectId;
  readonly signals: readonly TrustSignal[];
}

export interface TrustView {
  /** This node's verdict about one subject, given a claimed chain it was handed. */
  about(subject: SubjectId, claimedChain: readonly PhaseState[]): TrustVerdict;
}

const isSaneStamp = (s: PhaseState): boolean =>
  Number.isSafeInteger(s.phase) && s.phase >= 0 && Number.isSafeInteger(s.seed);

/**
 * Deepest anchor held about `subject`. Ties on phase break by seed so the result cannot
 * depend on array order — two nodes holding the same anchors in different order must reach
 * the same verdict (idempotency / DST).
 */
function latestHeldFor(
  held: readonly HeldAnchor[],
  subject: SubjectId,
): PhaseState | undefined {
  let best: PhaseState | undefined;
  for (const a of held) {
    if (a.subject !== subject || !isSaneStamp(a.stamp)) continue;
    if (!best || a.stamp.phase > best.phase || (a.stamp.phase === best.phase && a.stamp.seed > best.seed)) {
      best = a.stamp;
    }
  }
  return best;
}

export function createTrustView(held: readonly HeldAnchor[]): TrustView {
  // Snapshot at construction so later mutation of the caller's array cannot retroactively
  // change verdicts. `HeldAnchor` is readonly, so a typed caller cannot mutate at all; this
  // is the second line of defence for untyped callers.
  const snapshot: readonly HeldAnchor[] = held.map((a) => ({ ...a, stamp: { ...a.stamp } }));

  return {
    about(subject, claimedChain) {
      const anchor = latestHeldFor(snapshot, subject);
      if (!anchor) {
        // Absence of evidence, reported as such. NOT distrust: a brand-new honest
        // participant and a fabricated identity are indistinguishable here, and saying so
        // is more useful than guessing.
        return { subject, signals: [{ kind: "no-evidence" }] };
      }

      // Only well-formed stamps at or after the anchor can bear on the claim.
      const forward = claimedChain
        .filter((s) => isSaneStamp(s) && s.phase >= anchor.phase)
        .sort((a, b) => a.phase - b.phase || a.seed - b.seed);

      // A claim presenting NOTHING at or beyond our anchor tells us nothing.
      //
      // This branch used to fall through to `depth: 0`, which made an empty, truncated, or
      // forged-at-anchor claim look *fresher* than an honest one — a claimant improved its
      // apparent standing by presenting LESS (Kira, P0). Absence must not read as recency.
      if (forward.length === 0) {
        return { subject, signals: [{ kind: "no-evidence" }] };
      }

      const newest = forward[forward.length - 1]!;
      const signals: TrustSignal[] = [
        { kind: "shared-anchor", depth: newest.phase - anchor.phase, atPhase: anchor.phase },
      ];

      // Verify the WHOLE presented chain, link by link, anchored to what we hold.
      //
      // Previously this compared only anchor -> newest, so a tampered middle stamp still
      // reported `chain-verified` (Kira, P0). The signal named the chain while the code
      // checked the endpoints. `firstBrokenLink` was named in the spec and imported nowhere.
      //
      // A claimed stamp AT our anchor's phase is the subtle case: it must be compared to
      // what we hold, not substituted for it. Dropping it in as the chain head let a forged
      // stamp at the anchor phase pass with no seed comparison at all — the same
      // "presenting less looks better" family as the empty-claim bug.
      if (forward[0]!.phase === anchor.phase && forward[0]!.seed !== anchor.seed) {
        return {
          subject,
          signals: [
            signals[0]!,
            { kind: "chain-broken", reason: "seed-mismatch", atIndex: 0 },
          ],
        };
      }
      const tail = forward[0]!.phase === anchor.phase ? forward.slice(1) : forward;
      const linked: PhaseState[] = [anchor, ...tail];
      const brokenAt = firstBrokenLink(linked);
      if (brokenAt >= 0) {
        const v = verifyFromAnchor(linked[brokenAt - 1]!, linked[brokenAt]!);
        signals.push({ kind: "chain-broken", reason: v.reason ?? "seed-mismatch", atIndex: brokenAt });
      } else if (linked.length > 1) {
        signals.push({
          kind: "chain-verified",
          span: newest.phase - anchor.phase,
          links: linked.length - 1,
        });
      }
      return { subject, signals };
    },
  };
}

/**
 * Slice 1b — **the disagreement IS the product.**
 *
 * Returns which stamps each side holds that the other does not. NOT a merged score:
 * averaging destroys the information, while the divergence *localises* what one node could
 * go learn. Knight & Leveson (1986) applied to trust — independently developed views fail
 * in correlated ways, so voting buys little and the value is in reading the divergence.
 *
 * **Asymmetric on purpose:** `diff(a,b)` and `diff(b,a)` answer different questions, and a
 * symmetric distance would discard the direction that tells you what to fetch.
 *
 * **Takes per-subject stamps, not anchor sets.** Requiring a peer's whole cross-subject
 * `HeldAnchor[]` to answer about ONE subject would make a global graph assemblable from
 * the API — the trajectory's own falsifier #3 (Kira, P1). The signature now forbids it.
 *
 * **Keyed by (phase, seed), not phase alone.** Two conflicting stamps at the same phase is
 * a fork or a tamper — the single highest-value divergence this primitive exists to
 * surface — and keying on phase reported "nothing to learn" for exactly that case.
 */
export interface TrustDiff {
  readonly subject: SubjectId;
  /** Stamps the OTHER side holds that we do not — what we could go learn. */
  readonly theyKnowWeDoNot: readonly PhaseState[];
  /** Stamps WE hold that they do not. */
  readonly weKnowTheyDoNot: readonly PhaseState[];
}

export function diffTrustView(
  subject: SubjectId,
  mine: readonly PhaseState[],
  theirs: readonly PhaseState[],
): TrustDiff {
  const key = (s: PhaseState) => `${s.phase}:${s.seed}`;
  const keysOf = (xs: readonly PhaseState[]) => new Set(xs.map(key));
  const a = keysOf(mine);
  const b = keysOf(theirs);
  const bySort = (x: PhaseState, y: PhaseState) => x.phase - y.phase || x.seed - y.seed;
  return {
    subject,
    theyKnowWeDoNot: theirs.filter((s) => !a.has(key(s))).sort(bySort),
    weKnowTheyDoNot: mine.filter((s) => !b.has(key(s))).sort(bySort),
  };
}
