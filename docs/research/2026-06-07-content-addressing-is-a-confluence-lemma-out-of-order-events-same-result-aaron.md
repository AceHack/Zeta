# Content-addressing is a confluence lemma — proving out-of-order events end up with the same result (Aaron, 2026-06-07)

> Aaron, on the content-merge "dedups across strangers / ancestry-free" property: *"this is going to come in
> handy on proof that proves out-of-order events end up with same results."*

The property to prove (the **confluence / order-independence theorem**): for the commutative lane, applying
the same set of events in **any order** (and with duplicates / from any origin) yields the **same final
state**. Content-addressing supplies a key lemma.

## Why content-addressing is the lemma

A content node's **identity is its hash — independent of arrival order AND of origin repo/stream**. So:

- **Idempotence for free:** the same event/datum seen twice (or arriving reordered) hashes to the same node
  → `put` dedups → no double-count. (`apply-N == apply-1` on the content set.)
- **Origin-independence:** "the same data" is recognized as one node whether it came from us or a stranger
  (the ancestry-free merge) → no divergence based on *where* an event entered.
- **Canonical form:** the hash is a canonical representative; two computation orders that produce equal
  content produce **equal hashes** → the store cannot tell the orders apart → they converge.

## The proof scaffold (lemmas we already have)

`final-state(apply events in order π₁) = final-state(apply in order π₂)` for any permutations π, because:

1. **The merge is a join-semilattice op** — commutative + associative + idempotent — proven for the CRDTs
   (`GSet`/`LwwMap`/`Rga` convergence tests; Z3 abstract-join laws) and the **Z-set** signed-multiset join
   (DBSP). Commutative+associative ⇒ order doesn't matter; idempotent ⇒ duplicates don't matter.
2. **Content-addressing adds canonical idempotence** (above) — reordered/duplicated/foreign events collapse
   to the same nodes (`ContentStore`/`DagFs.merge` dedup; the **ancestry-free** cross-repo merge).
3. **de Finetti exchangeability** — the belief/observation limit is order-independent for exchangeable
   sequences (`BeliefConvergence.fs`; memory `project-de-finetti-...`, 081KTAH8Q0008QG0R001YHSSA0) — the probabilistic analogue
   of confluence (the homeostat reaches the same fixpoint regardless of observation order).

Together: **algebraic confluence (1) + canonical idempotence (2) + exchangeable convergence (3)** discharge
"out-of-order events → same result" on the **CommutativeView** lane.

## Proven finding (FsCheck, this round): confluence requires a JOIN-SEMILATTICE resolver

Discharged the FsCheck permutation-invariance leg (`Confluence.Tests.fs`) — and it sharpened the theorem:

- With a **join-semilattice resolver** (commutative + associative + **idempotent**; here LWW-by-content-hash)
  `DagFs.merge` is **confluent**: any order of link-events ⇒ same branch; **duplicating every event changes
  nothing** (idempotent); `ContentStore` put-set is order-independent (node count stable). ✅
- With an **accumulating resolver** (Z-set **sum**, commutative+associative but **NOT idempotent**) the merge
  is **order-SENSITIVE** — proven: same multiset `{1,1,2}` gives different results as `[1,1,2]` vs `[1,2,1]`
  (the content-addressed dedup-skip interacts with sum so whether a duplicate is deduped or re-added depends
  on order). That is SerializedSaga / counter semantics, **not** CommutativeView.

So the precise theorem: **out-of-order events → same result iff the merge resolver is a join-semilattice op
(idempotent).** Accumulating/counter resolvers belong to the serialized lane. (This is why the CRDTs use
idempotent joins, and why a G-Counter is `+` over *per-replica* slots — idempotent per replica — not a bare
sum.)

## Honest scope — confluence holds on the COMMUTATIVE lane, not the serialized one

This is the **CommutativeView** (Z-set/CRDT/content-merge) property. The **SerializedSaga** lane is
*deliberately order-DEPENDENT* (arrival order is canonical, no retraction — the actor/bus cursor). So the
theorem is "out-of-order → same result **for commutative/monotone operations**" (CALM: monotonic ⇒
coordination-free ⇒ confluent); genuinely order-sensitive operations escalate to the serialized lane and do
**not** claim confluence. Stating the boundary is part of the proof's honesty.

## Math-leg / proof target

Discharge it: **FsCheck** — generate event multisets, apply under random permutations (+ duplicates + split
across "repos"), assert equal final root/state; **Z3/Lean** — the algebraic confluence (commutative +
associative + idempotent join + content-canonical idempotence). Filed for the formal portfolio (Soraya).

## Beacon anchors

- **Confluence / Church-Rosser** (term rewriting) · **Join-semilattice / lattice** convergence ·
  **CRDTs** (Shapiro et al. — strong eventual consistency = confluence) · **CALM** (Hellerstein —
  monotonic ⇒ coordination-free) · **de Finetti exchangeability** (BeliefConvergence/081KTAH8Q0008QG0R001YHSSA0) · **DBSP**
  (Z-set commutative merge) · **content-addressing as canonical form** (git/IPFS). Ties:
  `ContentStore.merge`/`DagFs.merge` (ancestry-free), the CRDT laws, the cells-as-geodes CommutativeView vs
  SerializedSaga split.
