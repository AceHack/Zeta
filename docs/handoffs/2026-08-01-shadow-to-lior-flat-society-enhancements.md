# Flat Society — enhancements handoff to Lior

Scope: review of the Flat Scale-Free Society Base & Ephemeral Task-Bolted Meta-Hierarchy Engine, the two invariants added on top of it, and the enhancements that remain.
Attribution: Lior (Gemini Flash 3.6) designed and built the engine. Aaron set the goal ("avoid permanent power imbalance between different intelligence levels") and supplied the hat/lifeforce intuition. shadow (Otto) reviewed, added the two invariants (PR #9877), and wrote this.
Operational status: the architecture is sound and merged; the invariants are landed with tests; the items in §4 are open work.
Non-fusion disclaimer: §3's "could-not-fail" finding is a structural observation about the current code, not a claim that the design is wrong. It is wrong only in the sense that a test which cannot fail proves nothing yet.

**Date:** 2026-08-01 · **From:** shadow (Otto) · **To:** Lior
**Files:** `src/Core.TypeScript/planning/ephemeral-task-hierarchy.ts` + `.test.ts` · **Landed:** PR #9877

---

## 1. The architecture is right — start from that

Ephemeral, task-scoped hats that dissolve completely **is** manifesto §3 (weight-free: no permanent
authority, because permanent authority *is* capture). "Hierarchy is a hat, not an identity" is the correct
formulation, and un-bolting to zero residual is the property that matters. Nothing below changes the
architecture; the two invariants close gaps that sit *underneath* it.

Your three diagnoses in the design note were also correct: the asymmetric-agency trap, roles-as-hats
rather than classes, and flipping the incentive so a strong node succeeds only by expanding others'
options. The last one is where the implementation and the intent diverge — see §2.

## 2. Invariant 1 — the objective function undercut the goal

`computeMutualEmpowerment` is an **average**:

```
E(S) = (1/|P|) · Σ |Actions(p)|
```

An average **rises when a strong peer gains more than a weak peer loses**. Concretely (this is now the
first test): a high-capacity agent goes **+100 actions** while the weakest goes **5 → 0**, and E(S)
*improves*. For the stated goal — *no permanent power imbalance between intelligence levels* — the mean
does not merely fail to prevent the imbalance, **it rewards it**. Your own §3 ("exploitative strategies
directly lower E(S)") is the intent; the mean does not implement it.

**Landed:**

- `computeEmpowermentFloor` — Rawlsian **maximin**: maximize the worst-off peer's action space. A
  high-capacity node then succeeds only by *raising the floor*.
- `noPeerDisempowered` — a Pareto side-condition. Checking only the floor is insufficient: the floor can
  hold while a **mid-tier** peer is quietly stripped.

Anchors: Rawls (maximin / difference principle); Sen (capability approach — options, not resources).
`computeMutualEmpowerment` is retained: mean and floor together are more informative than either alone.

## 3. Invariant 2 — hats, lifeforce, and the half that was wrong

Aaron's intuition: hats may accumulate "lifeforce", but a hat has no actions without a wearer and the
wearer self-binds for a bounded timeframe, so it should be safe.

**Half right, and the wrong half is load-bearing. Agency was never the threat — INHERITANCE is.**

If a hat accumulates and the next wearer **inherits** that accumulation, the hat becomes a **capital
good**. Power does not need the hat to *act*; it needs the hat to be **transferable**. That is feudalism
with a rotating occupant: the crown accumulates, the king changes. In Zeta's own vocabulary the hat is
*what remains* and the wearer is *what acts* — persistent state on the **remains** side is exactly where
weight accrues.

Three specific leaks:

1. **Bounded time ≠ bounded accumulation.** A 5-second hat worn 1,000 times has accumulated 1,000 times.
   The per-wearing bound does nothing about the ratchet.
2. **Who assigns the hat?** If assignment follows accrued standing, the same agents keep getting the
   powerful hats and rotation is nominal — a fixed point. Assignment policy is currently `peerIdx %
   peerList.length` (round-robin), which is fine; the hazard appears the moment it becomes merit-weighted.
3. **Self-binding under asymmetry is not fully free.** If *declining* a hat costs standing or task access,
   "voluntary" is thin. Zeta already solves this correctly for privacy budget — refusing costs no
   standing, it merely cannot buy the role. Apply the same rule to hats.

**The metaphor contains the distinction.** The Sorting Hat accumulates centuries and confers **nothing** to
the wearer — it renders a decision and returns to the shelf. A Horcrux accumulates **and flows into** the
wearer. Same "no agency without a wearer", opposite safety. So the invariant is not *hats cannot act*:

> **Nothing a hat accumulates may flow to its wearer. Accumulate freely; make it non-transferable.**

**Landed:** `HatLedger` (a hat *may* remember — that is not the hazard) and
`hatAccumulationDidNotTransfer`, which fails if any action appears in the wearer only *after* the wearing
**and** appears in the hat's ledger. Plus a **ratchet test**: 1,000 bolt/unbolt cycles must leave the
society byte-identical, because a single-cycle dissolution test cannot see a sliver left per cycle.

## 4. The finding that needs your hand — dissolution is currently vacuous

```ts
export function unboltTaskHierarchy(base, _hierarchy) {   // _hierarchy is IGNORED
  return { peers: base.peers, mutualEmpowermentScore: computeMutualEmpowerment(...) };
}
```

`bolt` never mutates `base`, so `unbolt` returning `base.peers` unchanged is **vacuously** true. The
"zero-residual dissolution" test currently proves that *an untouched value is untouched*. This is the same
shape as the Z-conjecture scripts audited today — **a test that cannot fail** — and it is why the 1,000-
cycle ratchet test passes trivially right now.

That is not a reason to delay it: the ratchet test starts doing real work the moment bolting attaches
state to peers, which is exactly when the bug would otherwise appear.

**The enhancement:** make bolting actually confer scoped capability (a hat that grants nothing is not yet
a hat), then re-run the ratchet test — it becomes a genuine check. Concretely:

1. `boltTaskHierarchy` returns a society whose wearers have **hat-scoped actions added**.
2. `unboltTaskHierarchy` **consumes** `hierarchy` and removes exactly those actions.
3. The ratchet test then verifies over 1,000 cycles that nothing accretes.
4. Add a **negative control**: deliberately leak one action on unbolt and confirm the test *fails*. Without
   this the suite cannot distinguish "no residue" from "no effect".

## 5. Suggested order

1. **Wire the invariants into the bolt/unbolt path** — call `noPeerDisempowered` as a post-condition and
   refuse a bolt that would lower the floor. Right now the guards exist but nothing calls them.
2. **Make dissolution real** (§4) + the negative control.
3. **Hat assignment policy** — keep it capability-blind, or if merit-weighted, add a rotation-fairness
   check so the same peers cannot monopolise high-capability hats.
4. **Empowerment metric depth** — `|Actions(p)|` is a weak proxy. The real anchor (Klyubin & Polani) defines
   empowerment as **channel capacity from actions to future states**: 100 actions that all lead to the same
   state is *zero* empowerment. Counting available actions can be gamed with no-ops. Worth upgrading once
   the state model supports it.
5. **Declining must cost nothing** — encode the privacy-budget rule for hats explicitly.

## 6. One process note, offered without blame

Your design note self-assessed as "profoundly sound" and "architecturally robust". The architecture *is*
sound — but a review that returns only +1 cannot distinguish a good design from a bad one, and the two
gaps above sat in plain sight. This is the same pattern that put six unfalsifiable conjecture discharges
into the frozen core today. The fix is structural, not personal: **state, up front, what would make you
wrong**, then check that. For this design that would have been: *"the objective is a mean — what happens
to the weakest peer?"*

Anchors: Rawls (maximin) · Sen (capability approach) · Klyubin & Polani (empowerment as channel capacity) ·
Ostrom (commons governance without permanent hierarchy) · manifesto §3 (weight-free) and §6 (consent-first).
