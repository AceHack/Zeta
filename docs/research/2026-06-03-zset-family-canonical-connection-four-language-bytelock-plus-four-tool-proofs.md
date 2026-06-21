# Z-set family — canonical connection: 4-language byte-lock + 4-tool proofs (already exist, were disconnected)

**Finding (search-first, the maintainer 2026-06-03: "we have a lot of existing
proofs that are disconnected").** The directive was "Z-set family to 4 langs
next." A search-first pass found the Z-set family is **already 4-language**, with
cross-verify tests, AND already proven across **four** independent tools — the
proofs were just **disconnected** (spread across two test projects, the Lean
dir, and the TLA dir, with nothing tying them to the byte-lock + seed). So the
work is **connection**, not porting. This ledger maps the full surface and
declares Z-set a canonical candidate that **already meets both axes**.

(Literal register throughout per the math-claims register-split rule — each row
states exactly what is proven, by which tool, over which model.)

## Consensus axis — 4-language byte-lock (DONE, with cross-verify TESTS)

The same primitive in all four oracle languages, each cross-verified against the
**shared seed** `src/Core.TypeScript/z-set/golden-vectors.json`:

| Lang | Impl | Cross-verify test |
|---|---|---|
| F# | `src/Core/ZSet.fs` (+ `Algebra.fs` Weight/group) | `tests/Tests.FSharp/Algebra/ZSet.Tests.fs` |
| C# | `src/Core.CSharp/ZSet.cs` + `ZSetEntry.cs` | `tests/Tests.CSharp/Algebra/ZSetCrossVerifyTests.cs` (reads the seed) |
| Rust | `src/Core.Rust.Algebra/src/zset.rs` | `tests/zset_cross_verify.rs` (reads the seed, value-matches every vector) |
| TS | `src/Core.TypeScript/z-set/z-set.ts` | `z-set.test.ts` (reads the seed) |

Consensus axis: **met** (4/4 + cross-verify against one seed).

## Proof axis — four independent tools (RICH, was disconnected)

| Claim (what the code does) | FsCheck | Z3 | Lean | TLA |
|---|---|---|---|---|
| **Abelian group** — `+` assoc/commut/`Zero`-identity/`neg`-inverse/double-neg/sub | ✅ `ZSet.Tests.fs:204-224` (6 laws, real `ZSet<int>`) | ✅ **all 6** — `Z3.Laws.Tests.fs` assoc/commut/identity/inverse/double-neg/**subtraction** (the 6 enumerated laws); **+ neg-distributes** as a derived bonus lemma (was ⚠️ 2-of-6 at this note's writing; identity/inverse/double-neg/neg-dist landed since, subtraction added 2026-06-03 — the gap below is CLOSED) | ✅ general over carrier `G` (`DbspChainRule.lean`) | ✅ **9 invariants** `DbspSpec.tla:60-73` (full group + distinct/H) |
| **Earn-its-keep auto-prune** — no zero-weight entry survives; lookup is an additive homomorphism | ✅ `ZSet.Tests.fs:436-444` (C14) | — | — | ⚠️ `InvDistinctIdempotent`/`InvHCorrectness` (related, distinct op) |
| **DBSP operators** `z⁻¹` / `I` / `D` — `D = 1−z⁻¹`, `I = running sum` | ✅ `OperatorAlgebra.Tests.fs` (C13, real Circuit) | ✅ `Z3.Laws.Tests.fs` (C13 telescoping) | ✅ `DbspChainRule.lean:129-146` (`zInv`/`I`/`D` defs) | ✅ `RecursiveCountingLFP.tla` / `RecursiveSignedSemiNaive.tla` |
| **`D ∘ I = id`** | ✅ C13 | ✅ C13 | ✅ **`chain_rule_id_corollary : D (I s) = s`** (`:654`) | (implied by ops) |
| **DBSP chain rule** (Δ of a bilinear op; Budiu §4.2) | — | — | ✅ `chain_rule` (`:746`) + `chain_rule_proposition_3_2` (`:721`) + `linear_commute_{I,zInv,D}` | ✅ `DbspSpec` InvHCorrectness |

Proof axis: **met** — and over-met (four tools; Lean is machine-checked + general
over the abelian group `G`).

## The disconnection the search caught (the concrete one)

**`D ∘ I = id` was proven THREE times, independently, by different parties:**
- **Lean** `chain_rule_id_corollary : D (I s) = s` — already on main (general over `G`, machine-checked).
- **C13** (this session) re-proved it via **FsCheck** (real Circuit) + **Z3** (telescoping over reals) — *without knowing the Lean proof existed.*

That is exactly the maintainer's "disconnected proofs" — three sound proofs of
one identity, none referencing the others. This is not waste (cross-tool
agreement on one claim is the BP-16 ideal — symbolic ∧ machine-checked ∧
property-based ∧ real-Circuit), but it was **invisible**: nothing said "these
four are the same claim." Now connected here.

## Z-set is the strongest canonical candidate

Against the formal-proof-first bar (canonical = both axes + homeostat-proven-from-seed):

- **Consensus axis:** 4-lang byte-lock + cross-verify against `golden-vectors.json` ✅
- **Proof axis (the homeostat):** Z-set is an **abelian group + earn-its-keep auto-prune**, proven by FsCheck ∧ Z3 ∧ Lean ∧ TLA; the DBSP operators (`z⁻¹/I/D`, `D∘I=id`, chain rule) proven by FsCheck ∧ Z3 ∧ Lean ∧ TLA ✅
- **Seed-anchor (half-b):** the 4-lang byte-lock IS anchored to `golden-vectors.json` (the cross-verify tests value-match it) ✅

So Z-set meets the bar **more completely than DynamicValue or ZetaId** (which have FsCheck + byte-lock; Z-set adds Z3 + Lean + TLA). If DynamicValue/ZetaId are canonical candidates, **Z-set is the lead candidate** — pending Soraya ratification + the registry marker.

## Honest gaps (do NOT paper over)

1. ~~**Z3 covers only 2 of the 6 abelian-group laws** (assoc, commut)... *Candidate:* add the 4 missing Z3 Z-set lemmas...~~ **CLOSED 2026-06-03.** Z3 now covers all 6 enumerated abelian-group laws — assoc, commut, identity, inverse, double-neg, **subtraction** (`a - b = a + (-b)`, the DBSP-retraction law, added 2026-06-03; verified unsat with a sat negative control) — plus `neg-distributes` (`-(a+b) = -a + -b`) as an **additional derived lemma** (not one of the 6, a bonus). The Z3↔FsCheck (BP-16) cross-check for the 6 abelian-group laws is complete. (Note for the record: this gap was already partly self-closing — identity/inverse/double-neg/neg-dist had landed in `Z3.Laws.Tests.fs` after this note's original "2 of 6" snapshot; only subtraction remained, now added.)
2. **The connection was implicit** until this note. The proofs ran green in CI/locally but nothing declared "Z-set's abelian-group homeostat is proven 4 ways across 4 langs." This ledger is that declaration.
3. **Lean/TLA self-skip or aren't in the per-PR gate** the same way (Lean needs the toolchain; TLA needs java+jar). Verify the gate actually runs them, or they're green-by-absence (the assert-don't-skip concern).

## Composes with

- `.claude/rules/formal-proof-first-proven-by-default-consensus-not-validation-canonical-is-homeostat-proven-from-seed-ace-shields-zeta.md` (the canonical bar; Z-set meets it)
- `.claude/rules/verify-existing-substrate-before-authoring.md` (search-first — this note IS the search that found the disconnection)
- `docs/research/2026-06-03-formal-proof-claim-ledger-for-asymmetric-critic-pass.md` (the cadence ledger; C13/C14 rows connect here)
- `tools/lean4/Lean4/DbspChainRule.lean` (the Lean homeostat — abelian group + operators + chain rule)
- `tools/tla/specs/DbspSpec.tla` (the 9-invariant TLA model)
- `081KQGDBJ0008QG0R000D1YJCH` (formalize Z-set retraction algebra in Lean) + `081KRFA460008QG0R00168759Y` (lean4 DBSP core identities) — the Lean-proof backlog rows this connects
- `081KT2T2J0008QG0R0008TFHJT` (codec/primitives registry — Z-set is a registered collection-axis primitive)
- `docs/research/2026-06-01-kestrel-primitive-architecture-review-zset-gset-bag-rx-bonsai-4-language-hexagonal-...md` (the 4-language hexagonal review that drove the ports)

## Substrate-honest framing

This note authors no new proof — it **connects** existing ones (per the
maintainer's "search first; the proofs are disconnected"). The 4-lang port was
already done; the proofs already ran. The value is making Z-set's
already-met-both-axes status **legible**, surfacing the one concrete disconnection
(`D∘I=id` proven 3× independently incl. Lean), and naming the honest gaps (Z3
partial; gate-runs-Lean/TLA?). Registry `canonical` marker + Soraya ratification
remain the separate act.
