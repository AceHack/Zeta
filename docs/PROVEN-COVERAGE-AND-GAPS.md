# Proven coverage & gaps — full 4-lang × 4-serializer × proof-leg audit

*For Kestrel (gap-review). Generated 2026-06-05 by Otto from a content-verified source audit +
`docs/PROVEN-CORE-MAP.md`. Honest by construction: premise-conditional legs are NAMED, not hidden;
"seed" = built-but-not-yet-4-lang. Languages: **F# · C# · Rust · TypeScript**.*

---

## 1. The floor — 6/6 FULL PROVEN (`PROVEN ⟺ math ∧ 4-lang ∧ 4-ser ∧ Bonsai ∧ Arrow ∧ homeostat`)

| # | Primitive | math | 4-lang | 4-ser | Bonsai | Arrow | homeostat-tie | verdict |
|---|-----------|:----:|:------:|:-----:|:------:|:-----:|---------------|---------|
| 1 | **CRDT merge / G-Set** | ✓ | ✓ | ✓ | ✓ | ✓ | semilattice → converge-to-LUB | ✅ FULL |
| 2 | **Identity / ZetaId** (local-handle) | ✓ | ✓ | ✓ | ✓ | ✓ | dedup (injective + idempotent) | ✅ FULL |
| 3 | **Merkle integrity** | ✓ *(crypto premise named)* | ✓ | ✓ | ✓ | ✓ | integrity → verify converged state | ✅ FULL |
| 4 | **Clock / Versionstamp** | ✓ | ✓ | ✓ | ✓ | ✓ | semilattice → max-convergence | ✅ FULL |
| 5 | **Serialization-seed / ByteCost** | ✓ | ✓ | ✓ | ✓ | ✓ | commutative monoid → order-indep aggregate | ✅ FULL |
| 6 | **Metric / Bloom+CountMin** | ✓ *(uniform-hashing premise named; ε/δ Z3-verified)* | ✓ | ✓ | ✓ | ✓ | Bloom OR=semilattice, CMS add=monoid | ✅ FULL |

**Premise-conditional legs (not gaps — named premises, same status both):** Merkle tamper-evidence
holds *modulo* a crypto-strength hash (ships 128-bit XXH3, non-crypto); Metric ε/δ holds *modulo*
uniform/pairwise-independent hashing + Markov + row-independence (the standard CMS premises,
Z3-verified to *follow* from them). **Frontier (optional):** push either to unconditional (real-hash
analysis; Lean/Mathlib measure-theoretic Markov).

---

## 2. Serializer formats × 4 languages (the DynamicValue codec surface)

| format | F# | C# | Rust | TS | status |
|--------|:--:|:--:|:----:|:--:|--------|
| **JSON** (self-describing) | ✓ | ✓ | ✓ | ✓ | **4/4 byte-locked** (golden vectors) |
| **CBOR** (self-describing, total 8/8 shapes) | ✓ | ✓ | ✓ | ✓ | **4/4 byte-locked** |
| **XML** (typed-element) | ✓ | ✓ | ✓ | ✓ | **4/4 byte-locked** |
| **Arrow** (columnar) | ✓ | ✓ | ✗ | ✗ | **2/4 — F#+C# only** (shared .NET `Apache.Arrow`); Rust/TS held off (zero-dep) |
| **protobuf** (schema-REQUIRED) | ✗ | ✗ | ✗ | ✗ | **0/4 — not present** (the only schema-required format; needs the schema-registry) |

---

## 3. Supporting primitives × 4 languages

| primitive | F# | C# | Rust | TS | note |
|-----------|:--:|:--:|:----:|:--:|------|
| DynamicValue (carrier) | ✓ | ✓ | ✓ | ✓ | the universal value tree everything rides |
| TriBoolean (+ float) | ✓ | ✓ | ✓ | ✓ | 4/4 |
| Bonsai (reified computation) | ✓ | ✓ | ✓ | ✓ | 4/4 |
| Yaml · Sha256 · RangeSet | ✓ | ✓ | ✓ | ✓ | 4/4 |
| Observe · AceCanonical · Resume | ✓ | ✓ | ✓ | ✗ | **3/4 — no TS** |
| Algebra | ✓ | ✗ | ✓ | ✗ | **2/4 — F#+Rust** |

### New seeds (built, F#-only — 1/4)

| seed | langs | what it proves |
|------|-------|----------------|
| **Predicate3** (Kleene K3) | F# | three-valued predicate; UNKNOWN propagates, collapse only at the terminal filter |
| **SchemaEvolution** | F# | versioned migration over DynamicValue; forward/backward-compat (the B-0930 seed) |
| **SoftValue** | F# | calibrated value: never-falsely-certain `resolve`; **independent-evidence Bayesian `observe` COMMUTES** (the convergence-despite-reordering crux, for independent evidence) |

---

## 4. Homeostat chains — "does everything connect?"

**Mostly yes, by role — with honest distinctions.** There are FOUR demonstrated homeostat-tie
classes, and every floor primitive lands in one:

- **converge-to-LUB** (join-semilattice): G-Set (∪), Clock (max), Bloom (OR). Replicas converge to
  the least-upper-bound regardless of order + duplicates (idempotent CRDT merge).
- **order-independent aggregate** (commutative monoid, *not* idempotent): ByteCost (+), CountMin (+).
- **dedup** (injective + idempotent): Identity/ZetaId — distinct→distinct (no bad collapse) + re-observe = no-op.
- **verify the converged state** (integrity): Merkle — same converged leaves → same root; `LeafDiff`
  drives anti-entropy.

**How they chain (the curve, per PROVEN-CORE-MAP):** a grow-only **G-Set history** (append-only
samples) → a **curve** (∂ over the Clock x-axis) → a **replayable homeostat** that converges to a
fixpoint. Identity supplies the locality/neighborhood the merge converges over; Merkle verifies the
converged state; ByteCost/Metric aggregate it. So the converging primitives form one chain; the
others connect **by role**, not by being converging states themselves:

- **Carrier:** DynamicValue is the payload every homeostat exchanges (not a converging state — the medium).
- **Operation:** Bonsai is the reify/apply of each homeostat's merge (the Bonsai leg of every vertical).
- **Logic/value registers:** TriBoolean/Predicate3 (truth axis) + SoftValue (value axis) supply the
  *uncertainty* the homeostat carries; **SoftValue's `observe` commutes for independent evidence**,
  which is the homeostat-merge property pointed at *belief* convergence (the open convergence-despite-
  reordering question reduces to: is the uncertainty-merge a semilattice? — answered YES for independent
  evidence; the path-dependent case is the residual).
- **Identity-as-neighborhood:** per the perspectival model, identity defines the CRDT neighborhood the
  homeostat converges over (local → global without a coordinator).

**Honest gap in the chain:** SchemaEvolution's migrations are composable + idempotent-where-stated but
are **not** a convergence homeostat (they're a *directed* version-transform); they connect to the floor
via DynamicValue (carrier) + the never-collapse discipline, not via LUB-convergence. And the belief/
SoftValue homeostat is proven commutative only for *independent* evidence — the general (path-dependent)
Bayesian merge being a semilattice is **unproven** (the real open question for "everything converges").

---

## 5. GAP LIST (what to hand Kestrel to attack)

1. **Arrow in Rust + TS** (2/4 → 4/4) — needs an Arrow codec each; deliberate zero-dep deferral.
   *Decision: hexagonalize (vendored Arrow behind a port, swappable) — IN PROGRESS per Aaron 2026-06-05.*
2. **protobuf / gRPC** (0/4) — the only **schema-required** binary format; fits DynamicValue only via the
   **schema-registry** (schema-id → registry → shape). Its compat model *is* `SchemaEvolution`
   (add/remove/rename + unknown-field preservation). *Decision: pull in, hexagonal, build on the
   schema-registry slice — IN PROGRESS.*
3. **New seeds Predicate3 / SchemaEvolution / SoftValue: F#-only (1/4)** — port to C#/Rust/TS + byte-lock.
4. **Observe / AceCanonical / Resume: no TS (3/4)**; **Algebra: F#+Rust only (2/4)**.
5. **Belief/SoftValue convergence (general case):** is the *path-dependent* Bayesian uncertainty-merge a
   join-semilattice? (independent-evidence case proven commutative; general case open). Soraya/Kestrel call.
6. **Premise-unconditional formal legs:** Merkle real-hash analysis; Metric Lean/Mathlib Markov (frontier).
7. **B-1018 follow-ups:** cross-oracle **differential** fuzzing (mutate 4 langs toward disagreement) +
   coverage-guided out-of-process fuzzing (crash-isolated for the deep-nesting stack-overflow class).

**Bottom line for Kestrel:** the floor is 6/6 FULL PROVEN and the self-describing serializer surface
(JSON/CBOR/XML) is 4/4 byte-locked. The concrete gaps are (a) Arrow Rust/TS, (b) the schema-required
binary (protobuf) + its registry, (c) the three new F#-only seeds' 4-lang ports, and (d) the general
belief-convergence question. Items (a) and (b) are being built now (hexagonal, swappable deps).
