/**
 * verdict-vault.ts — persistent disagreement is HELD DECORRELATION, stored as a
 * Data Vault 2.0 **Raw Vault**.
 *
 * Aaron 2026-08-20: *"yes persistent disagreement is our uncertainty/held
 * decorrelation, this is like raw vault from dv2.0"*.
 *
 * Two nodes holding different verdicts about a third is **not an error state**.
 * It is a measurement — the thing this substrate exists to preserve — and
 * collapsing it destroys a real signal. So the store here does what a Raw Vault
 * does: **load the facts as they arrive, with their record source, and never
 * conform at load time.** A single version of the FACTS; never a single version
 * of the truth (Linstedt & Olschimke, *Building a Scalable Data Warehouse with
 * Data Vault 2.0*, 2015 — the raw/business split and the load-time
 * no-conformance rule are theirs, and the entailment is exact: conforming at
 * load is irreversible, so the evidence you would need to change your mind is
 * gone before you know you need it).
 *
 * The formal name for the legitimate persistent disagreement is **monodromy** —
 * see `docs/research/2026-08-20-harmonious-division-is-our-unorthodox-division-pole-erasure-superposition-over-rungs-and-what-survives-the-climb.md`,
 * where the same argument is made about analytic continuation along different
 * paths: the disagreement measures the monodromy, and forcing agreement erases
 * the measurement.
 *
 * ── WHAT IS DELIBERATELY ABSENT ──────────────────────────────────────────────
 *
 * There is no `reconcile()`, no `consensusVerdict()`, no `resolve()`, and no
 * last-writer-wins. Their absence is the design. Anything that turned N verdicts
 * into 1 stored verdict would be the collapse operation, and it would look like
 * a feature.
 *
 * What replaces them is `deriveActionableView` — a **Business Vault** query:
 * computed at the point of action, BY THE PARTY ACTING, over evidence it does
 * not modify. Two parties running it over the same vault with different policies
 * legitimately get different answers, and the vault is unchanged by either.
 *
 * ── AND THE PAYMENT CONSEQUENCE, WHICH IS THE PRACTICAL ONE ──────────────────
 * A payment does not require global agreement. It requires that **the two
 * parties to that payment** each independently accept the other. A third node's
 * disagreement is legal, is retained, and simply does not participate. That is
 * pairwise-never-global again, restated where it would be most tempting to reach
 * for consensus.
 *
 * REGISTER: `unmetered`. The store is append-only and the derived view is pure;
 * both are tested including the discriminating case (two sources, opposite
 * verdicts, both retained, two policies produce two different actions from the
 * same vault). Nothing here is measured against a real deployment.
 */

import { ordinalCompare, type Phase } from "./ports.ts";

/**
 * One recorded verdict. Immutable. The DV2.0 satellite shape: business key
 * (`subject`), the fast-changing attribute (`verdict`), and — mandatory —
 * `recordSource` and load phase.
 */
export interface RecordedVerdict {
  /** What the verdict is ABOUT — a trust domain, a key id, a SPIFFE ID. */
  readonly subject: string;
  /** WHO reached it. Never merged away; it is half the meaning of the row. */
  readonly observerTrustDomain: string;
  readonly verdict: "accept" | "reject" | "conflict" | "unknown";
  /** The observer's own stated reason, verbatim. Not normalized. */
  readonly reason: string;
  /** Agreed phase at which the observer reached it. */
  readonly observedAtPhase: Phase;
  /** DV2.0 record source: the channel this node learned it through. */
  readonly recordSource: string;
}

/**
 * Append-only. A `readonly` array rather than a map keyed by subject, because a
 * map keyed by `(subject)` would overwrite and a map keyed by
 * `(subject, observer)` would still overwrite an observer's earlier verdict —
 * and an observer that CHANGED ITS MIND is exactly the history worth keeping.
 */
export type VerdictVault = readonly RecordedVerdict[];

export const EMPTY_VAULT: VerdictVault = [];

/**
 * Load a fact. No conformance, no dedup by subject, no overwrite.
 *
 * Exact-duplicate rows ARE dropped, and that is not conformance: an identical
 * row carries no additional information, and admitting it would make the vault's
 * contents depend on delivery count (idempotency, discipline #6). A row differing
 * in ANY field — including phase or record source — is a different observation
 * and is kept.
 */
export function loadVerdict(vault: VerdictVault, row: RecordedVerdict): VerdictVault {
  const key = verdictRowKey(row);
  if (vault.some((r) => verdictRowKey(r) === key)) return vault;
  return [...vault, row];
}

function verdictRowKey(r: RecordedVerdict): string {
  return [r.subject, r.observerTrustDomain, r.verdict, r.reason, String(r.observedAtPhase), r.recordSource].join(
    "\u0000",
  );
}

/** Every row about a subject, in load order. Plural by construction. */
export function verdictsAbout(vault: VerdictVault, subject: string): VerdictVault {
  return vault.filter((r) => r.subject === subject);
}

/** Distinct observers who have said anything about a subject. */
export function observersOf(vault: VerdictVault, subject: string): readonly string[] {
  return [...new Set(verdictsAbout(vault, subject).map((r) => r.observerTrustDomain))].sort(ordinalCompare);
}

/**
 * Is there held decorrelation about this subject — i.e. do two observers'
 * LATEST verdicts differ?
 *
 * Reported as a NEUTRAL FACT (`.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`):
 * this says "the observers differ", never "someone is wrong". The reading —
 * one of them is compromised, or they legitimately traversed different paths —
 * belongs to the caller's oracle, and the substrate is not allowed to hold it.
 */
export function decorrelation(
  vault: VerdictVault,
  subject: string,
): {
  readonly divergent: boolean;
  readonly byObserver: ReadonlyMap<string, RecordedVerdict>;
  readonly reason: string;
} {
  const latest = new Map<string, RecordedVerdict>();
  for (const row of verdictsAbout(vault, subject)) {
    const held = latest.get(row.observerTrustDomain);
    if (held === undefined || row.observedAtPhase > held.observedAtPhase) latest.set(row.observerTrustDomain, row);
  }
  const distinct = new Set([...latest.values()].map((r) => r.verdict));
  return {
    divergent: distinct.size > 1,
    byObserver: latest,
    reason:
      distinct.size > 1
        ? `${String(latest.size)} observers hold ${String(distinct.size)} different verdicts about '${subject}' — this is held decorrelation and is retained, not reconciled`
        : `${String(latest.size)} observer(s) about '${subject}', ${String(distinct.size)} distinct verdict(s)`,
  };
}

/**
 * The Business Vault half: a DERIVED view, computed at the point of action by
 * the party acting, over evidence it does not touch.
 *
 * `actingObserver` is required and is the whole point. A node acts on ITS OWN
 * verdict. Other observers' rows are context a policy may consult; they are
 * never authority, and there is no path here by which a majority of foreign
 * observers overrides the acting node's own view.
 */
export interface ActionableView {
  readonly act: boolean;
  readonly reason: string;
  readonly ownVerdict?: RecordedVerdict;
  readonly dissentingObservers: readonly string[];
}

export type CorroborationPolicy =
  /** Act on your own verdict alone. Others' disagreement is recorded, not binding. */
  | { readonly kind: "own-verdict-only" }
  /** Act only if your own verdict is accept AND no accepted peer says reject. */
  | { readonly kind: "own-verdict-and-no-dissent" }
  /** Act only if your own verdict is accept AND at least N named peers agree. */
  | {
      readonly kind: "own-verdict-and-corroboration";
      readonly minAgreeingPeers: number;
      readonly consultOnly: readonly string[];
    };

/**
 * Derive. Pure, and it returns the dissent alongside the answer — a view that
 * hid the disagreement it overrode would be conforming at read time, which is
 * the same erasure one layer later.
 */
export function deriveActionableView(params: {
  readonly vault: VerdictVault;
  readonly subject: string;
  readonly actingObserver: string;
  readonly policy: CorroborationPolicy;
}): ActionableView {
  const { vault, subject, actingObserver, policy } = params;
  const { byObserver } = decorrelation(vault, subject);
  const own = byObserver.get(actingObserver);
  const dissenting = [...byObserver.entries()]
    .filter(([obs, row]) => obs !== actingObserver && row.verdict !== "accept")
    .map(([obs]) => obs)
    .sort(ordinalCompare);

  if (own === undefined) {
    return {
      act: false,
      dissentingObservers: dissenting,
      reason: `'${actingObserver}' holds no verdict about '${subject}'; acting on someone else's verdict would be deferring to an authority it did not choose`,
    };
  }
  if (own.verdict !== "accept") {
    return {
      act: false,
      ownVerdict: own,
      dissentingObservers: dissenting,
      reason: `own verdict is '${own.verdict}': ${own.reason}`,
    };
  }

  switch (policy.kind) {
    case "own-verdict-only":
      return {
        act: true,
        ownVerdict: own,
        dissentingObservers: dissenting,
        reason:
          `'${actingObserver}' accepts '${subject}' and acts on its own verdict` +
          (dissenting.length > 0
            ? `; ${String(dissenting.length)} peer(s) disagree (${dissenting.join(", ")}) and that disagreement is retained, not overridden`
            : ""),
      };
    case "own-verdict-and-no-dissent":
      if (dissenting.length > 0) {
        return {
          act: false,
          ownVerdict: own,
          dissentingObservers: dissenting,
          reason: `own verdict accepts, but this node's policy declines to act while ${dissenting.join(", ")} disagree`,
        };
      }
      return {
        act: true,
        ownVerdict: own,
        dissentingObservers: dissenting,
        reason: `'${actingObserver}' accepts '${subject}' and no observed peer dissents`,
      };
    case "own-verdict-and-corroboration": {
      const agreeing = policy.consultOnly.filter((peer) => byObserver.get(peer)?.verdict === "accept");
      if (agreeing.length < policy.minAgreeingPeers) {
        return {
          act: false,
          ownVerdict: own,
          dissentingObservers: dissenting,
          reason: `own verdict accepts, but only ${String(agreeing.length)} of the ${String(policy.minAgreeingPeers)} required peers from this node's own consult list agree`,
        };
      }
      return {
        act: true,
        ownVerdict: own,
        dissentingObservers: dissenting,
        reason: `'${actingObserver}' accepts '${subject}', corroborated by ${agreeing.join(", ")}`,
      };
    }
  }
}
