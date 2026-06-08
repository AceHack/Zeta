# The reorder "loophole" is bounded by commutativity — non-reversible claims need saga or real consensus

**Aaron, 2026-06-08 (#7072):**

> "that's a loophole — can I do anything with it? Can I abuse the inconsistency between the [diverging
> orders] to make anything asymmetric other than ordered canonical history within a traveler-relative
> frame? What if that ordered difference was non-reversible — like a claim on land in the real world? We'd
> have a saga for this, but an old conflict like Israel/Palestine would not."

Important question. **The answer is that the loophole is self-limiting: it exists *exactly and only* where
operations commute, and commuting operations carry no asymmetric advantage.** The boundary is the point.

## Why there's no abusable asymmetry inside the commutative region

The lossless past-compression (#7071, Mazurkiewicz traces) works **iff the events commute**. For commuting
events, *every* linearization yields the **same future** (the fold is invariant). So:

- You can reorder them freely — but **there is nothing to win**: A-before-B and B-before-A produce the
  identical state. Asymmetry requires the order to *matter*; commuting means it doesn't.
- So inside the reorderable region you **cannot** manufacture an asymmetric outcome. The "loophole" grants
  only what's already semantically free (canonical history within a frame). No abuse is possible there.

## The real boundary: non-commutative / non-reversible / contested-exclusive ops

The moment an operation is **non-commutative** — order is observable, futures differ — it is **outside the
trace's equivalence class**. You **cannot** swap or compress it. Examples: a **land claim** (first-claim-
wins on an exclusive resource), a **mutex**, allocating a **unique** id, spending a **single** coin. These
are **non-monotone**: granting to A *removes* B's possibility.

This is precisely the **CALM boundary** (Hellerstein/Ameloot): monotone ⇒ coordination-free (CRDT
merge/fold works); **non-monotone ⇒ coordination/consensus is *required*.** A contested-exclusive claim is
non-monotone, so the symmetric fold / CRDT merge **does not apply** — there is no order-independent answer,
because the order *is* the answer.

## The abuse vector is real and named: double-spend / partition attack

What Aaron is probing *is* a known attack: in a divergent frame (before convergence), make **conflicting
exclusive claims** in two frames — claim the same land twice, spend the same coin twice. This is the
**double-spend / partition attack**. The defense is exactly the CALM rule:

- **Non-monotone (exclusive) ops must NOT commit independently in divergent frames.** They need
  **consensus-before-commit** (Paxos/Raft/BFT — a total order *agreed*, not merged), or an **escrow /
  reservation** that makes the claim provisional until confirmed.
- At convergence, conflicting exclusive claims are **detected and one is rejected**. If the op was
  *reversible*, fine. If *non-reversible*, the rejected party suffers a real loss — which is why such ops
  must be gated by consensus *up front*, not reconciled after.

## Zeta's handling of the non-reversible

- **Compensable non-reversible → a saga** (Garcia-Molina & Salem; `DurableSaga` #6996): the action has a
  *compensating* action (release the reservation, refund), so a contested claim can be backed out. This is
  Aaron's "we'd have a saga for this."
- **Genuinely non-compensable & contested-exclusive (zero-sum land; Israel/Palestine) → no saga, no
  merge.** There is *no* commutative fold and *no* compensation that dissolves a true zero-sum conflict.
  The system MUST:
  1. **Refuse to silently merge it** — never pretend a non-monotone conflict folded cleanly (that would be
     the actual bug: laundering a real conflict through a CRDT join).
  2. **Surface it as a genuine conflict** (a P0: "non-commutative claim collision; cannot auto-resolve").
  3. **Route to real consensus / a chosen oracle / jurisdiction** — the Multi-Oracle Principle (manifesto
     §11: no single mandatory morality; pick an oracle), jurisdiction-relative resolution (#7064), and on
     deadlock **the human decides** (`docs/CONFLICT-RESOLUTION.md`). The fold cannot adjudicate a zero-sum
     moral conflict; claiming it can is out of scope by design.

## The clean statement

> **Commutative ops: reorder freely, no asymmetry to abuse (the loophole gives nothing).
> Non-commutative ops: order is real, the fold/merge does NOT apply (CALM non-monotone) — gate with
> consensus up front; if non-reversible, use a saga (if compensable) or escalate to an oracle/human (if
> not). The system must refuse to launder a genuine zero-sum conflict through a merge.**

So no, you can't abuse the reorder freedom to forge a non-reversible asymmetric claim: such a claim is
*by definition* non-commutative and therefore not in the reorderable region. The danger isn't the
loophole; it's **mis-classifying a non-monotone op as monotone** and letting it merge — that's the bug to
guard against (a type-level / op-classification discipline: every op declares monotone vs non-monotone;
non-monotone ones are consensus-gated).

## Honest scope (peel) + routing

A boundary/positioning analysis (no code). It identifies a **security-relevant invariant**: non-monotone
ops must be consensus-gated, never silently merged (double-spend defense). Recommend routing the threat
angle to **Aminata** (threat-model-critic) / **Mateo** (security-researcher) and the op-classification
(monotone vs non-monotone, saga-vs-consensus) to the architect when the cross-repo weave (#6993) is built —
that's the moment this stops being theory. The "refuse to merge a non-monotone conflict" rule belongs in
the consensus/Loom layer (#6980) as a hard check.

## Anchors (Beacon)

- **Monotone vs non-monotone / coordination boundary:** CALM theorem (Hellerstein & Ameloot) — the exact
  line where CRDT/fold stops and consensus starts.
- **Double-spend / partition attack:** Bitcoin/blockchain double-spend; CAP/partition; Byzantine agreement.
- **Sagas / compensation:** Garcia-Molina & Salem 1987; `DurableSaga` (#6996).
- **Consensus for exclusive resources:** Paxos/Raft/BFT (agreed total order, not merge).
- **Zero-sum conflict → arbitration:** Multi-Oracle Principle (manifesto §11); jurisdiction-relative
  (#7064); `docs/CONFLICT-RESOLUTION.md` (human decides on deadlock).
- Internal: #7071 (Mazurkiewicz lossless compression — *commutative only*), #7065 (symmetric Bayesian
  fold — *commutative*), #6993 (zip-over-two-CRDTs), #6980 (Loom/consensus layer), manifesto §11.
