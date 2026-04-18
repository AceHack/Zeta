# Retraction-safe semi-naïve evaluation for `Zeta.Core`

**Context.** `RecursiveSemiNaive` (`src/Core/Recursive.fs` lines 101–147) implements Bancilhon–Ramakrishnan: `total` grows monotonically with the previous iteration's `Δ`. Under DBSP retractions, `total` never decrements and retracted derivations leak forever. `ClosureTable` was reverted to the O(|C|·iter) `Recursive` combinator in round-17 to restore correctness; the O(|Δ|) win is lost. The user's instinct — "let the feedback value dip, then recover" — points at the literature surveyed below.

## 1. Differential Dataflow (DD)

**Cite.** Abadi, McSherry, Murray, Isaacs, Isard. *Naiad*, SOSP 2013. McSherry et al. *Differential Dataflow*, CIDR 2013. Materialize *Compute/Arrangements* docs.

**Idea.** Collections are `(data, time, diff)` with `time` a *partially-ordered* coordinate (outer tick × iter × …) and `diff` a signed Z-weight. `Variable`/`Iterate` advances the inner coord; a retraction is a new tuple at a strictly later lattice-time, processed exactly once as a delta.

**Complexity.** Retraction O(|affected derivations|·log|arrangement|), same as insert.

**Adoption.** High cost. Requires lattice-ordered time in `Spine`/`BalancedSpine`/`Circuit`/`NestedCircuit` (currently flat `int`). **Needs TLA+** — frontier/partial-order composition (Naiad §3) is subtle.

**Effort.** 25–40 days core combinator + 15 days to retrofit arrangements.

## 2. Differential Datalog (DDlog)

**Cite.** Ryzhyk & Budiu. *Differential Datalog*, Datalog-2.0 / VLDB 2019.

**Idea.** Compiles Datalog rules to DD using the translation in Ryzhyk-Budiu §4. Retractions on EDB propagate via negative diffs through the standard fixpoint operator.

**Complexity.** O(|Δ_effective|), where Δ_effective = IDB tuples whose derivation trees changed.

**Adoption.** No direct reuse (Rust/OCaml compiler). The translation recipe sits on top of option 1. No extra TLA+.

**Effort.** Subsumed by option 1.

## 3. DRed (Delete-and-Re-derive)

**Cite.** Gupta, Mumick, Subrahmanian. *Maintaining Views Incrementally*, SIGMOD 1993. Staudt & Jarke DRed<sub>C</sub>, VLDB 1996.

**Idea.** Overdelete every IDB tuple with a derivation through the retracted EDB fact; rederive tuples with surviving alternate derivations; reinsert survivors.

**Complexity.** O(|overdelete closure|) per retraction. One closure-edge retraction can overdelete O(|V|²) then rederive them all (Motik et al. AAAI 2015 §6).

**Adoption.** Two extra LFP passes per retraction-carrying tick on top of current `Recursive`. **TLA+ recommended** for termination of overdelete→rederive. Can regress below the `Recursive`-clamp baseline on retraction-heavy workloads.

**Effort.** 6–10 days.

## 4. Counting algorithm

**Cite.** Gupta-Mumick-Subrahmanian SIGMOD 1993 §4; survey in IEEE Data Eng. Bull. 18(2), 1995.

**Idea.** Store `c(t) ≥ 1` per IDB tuple; insert increments, retract decrements, tuple dies at 0. In DBSP this *is* the Z-weight — modulo `Distinct`, which clamps to `{0,1}` and loses the count. If we clamp to `[0,∞)` instead we get counting for free.

**Complexity.** O(|tuples whose count changes|) per retract. Strictly better than DRed when derivations are shared (closure, path-count).

**Adoption.** `CountingRecursive` combinator skips outer `Distinct`, carries multiplicity. Needs feedback-decrement (option 7) for semi-naïve.

**TLA+.** Short spec: "count reaches zero iff all derivations retracted".

**Effort.** 8–12 days. Strong building block for option 7.

## 5. Provenance semirings

**Cite.** Green, Karvounarakis, Tannen. *Provenance Semirings*, PODS 2007. Köhler-Ludäscher-Zinn, ICDE 2013. Deutch et al. *Circuits for Datalog Provenance*, ICDT 2014.

**Idea.** Annotate each tuple with a polynomial in ℕ[X]/ℤ[X] over EDB variables. Retract `x` by algebraic evaluation; tuple dies iff polynomial = 0.

**Complexity.** Polynomial size can be exponential in query depth; PSPACE-hard to minimise. Recursive fixpoints need ω-continuous Kleene semirings.

**Adoption.** Overkill for the blocker, useful later if we want *explanation queries*. Requires TLA+.

**Effort.** 30+ days; defer.

## 6. Recent work (2020+)

- Motik, Nenov, Piro, Horrocks. *Maintenance of Datalog Materialisations Revisited*, AIJ 2019 — FBF, DRed<sub>o</sub>; shows DRed<sub>o</sub> ≤ FBF ≤ counting in most workloads.
- Hu, Vansummeren et al. *Dyn: An Incremental Datalog Engine*, SIGMOD 2022 — shared-memory semi-naïve with a per-iteration *signed* delta (essentially option 7).
- **Feldera / Rust DBSP.** Budiu, McSherry, Ryzhyk, Tannen et al. *DBSP: Automatic IVM for Rich Query Languages*, VLDB 2023. §6.3: `nested_integrate_trace` carries a *signed delta feedback* and applies `Distinct` only after the fixpoint converges (not between iterations). Confirmed in `feldera/feldera` `dbsp/src/circuit/operator/recursive.rs` v0.50 (2025).

## 7. "Gap-monotone" / signed-delta semi-naïve — the user's proposal

**Idea.** Drop the "`total` only grows" invariant. `Δ` is *signed*; the feedback cell is a **signed trace** `Σ Δ_i`; convergence is *"signed Δ = 0 after `Distinct`"*, not *"Δ empty"*. `Distinct` is applied at the outer boundary only, once per tick.

Works because body is a *semiring homomorphism* on linear operators: `body(a+b) = body(a) + body(b)`. Feeding a negative Δ through body produces the correct retraction of IDB tuples derived from the retracted inputs. Exactly-zero derivation counts become deletions via outer `Distinct`, no tombstone pass.

**Complexity.** O(|signed-Δ|) per iteration — matches insertion, matches DD for linear Datalog.

**Precondition.** Body must be **Z-linear** (distributes over `+`). Our `Plus`, `IndexedJoin`, `Map` are linear; `Distinct` is not — so `Distinct` is forbidden inside body.

**TLA+.** Needed: (a) termination when Δ oscillates in sign, (b) equivalence to `Recursive`'s LFP on positive inputs, (c) correctness under interleaved insert/retract. ~200 lines, comparable to `tools/tla/specs/DbspSpec.tla`.

**Effort.** 10–14 days including spec + 20 property tests using `Recursive` as oracle.

---

## Recommendation

**Top 1 — Option 7 (signed-delta semi-naïve).** Lowest effort, direct fix, matches Feldera's production behaviour.

*Plan.*
1. Draft `tools/tla/specs/SignedDeltaSemiNaive.tla`: body as Z-linear operator; invariants `LFP(signed) = LFP(clamped)` on positive inputs and `Σ signed-Δ = 0 ⇒ converged`.
2. TLC model-check at N≤4 EDB tuples, depth≤3, with insert/retract mixes.
3. Implement `RecursiveSignedSemiNaive` in `Recursive.fs` paralleling the current combinator — un-`Distinct`ed signed Z-set feedback; body runs on raw delta; outer `Distinct` only on the exposed stream.
4. Force Z-linearity at compile time (phantom type) or runtime (reject `Distinct` in the body op-graph).
5. Regression-test against `Recursive` on transitive closure, same-generation, reachability, and the Hierarchy round-17 retraction fixture.

**Top 2 — Option 4 (counting), delivered in parallel.** A `CountingClosureTable` that bypasses `Distinct` and exposes multiplicity. Simpler correctness proof (each tuple's count is a commutative counter), useful standalone for path-counting and provenance-weight queries. Shares roughly half its code with option 7.

Options 1 (full DD) and 5 (provenance) are deferred — each 25–40 days, and option 7 removes the blocker without a lattice-time rewrite.
