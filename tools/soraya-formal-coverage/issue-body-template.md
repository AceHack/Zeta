# Formal-coverage cadence (Soraya) — the standing math backlog

**Cadence fired TODAY_PLACEHOLDER (run RUN_ID_PLACEHOLDER).** This is the standing
tracking issue for the 081KT2T2J0008QG0R000YZ3NMY formal-coverage backlog. The repo is
**formal-proof-first**: cross-AI consensus is NOT validation; *canonical ⟺ homeostat
proven-from-seed* (see `.claude/rules/formal-proof-first-proven-by-default-consensus-not-validation-canonical-is-homeostat-proven-from-seed-ace-shields-zeta.md`).
We are far behind on the math — this cadence closes the gap, one proof at a time.

## How a wake-time agent works this issue

1. Pick the **next unchecked item in order** (strict P0 → P1 → P2; do not skip ahead).
2. **Dispatch Soraya** (`formal-verification-expert`) to author the proof + cross-check
   tool per BP-16; she returns the artefact (advisory — the architect lands it).
3. Land the proof as a PR; **CI runs FsCheck/Z3 = proof execution** (verify it does NOT
   self-skip — z3-in-CI is a known gap; run locally where z3 is present until CI installs it).
4. Tick the item here when **both tools land AND agree** (P0 needs ≥2 tools).
5. A proven law is only **validated** until a **hex/4×4 lineage edge** (081KT2T2J0008QG0R0019YVX8M Cl(1,3) /
   081KT2T2J0008QG0R003VK5GRX) connects it to the seed — that is the second half of *canonical* (081KT2T2J0008QG0R000YZ3NMY acc. 4).

## P0 — silent-corruption class (≥2 tools each; do first, in order)

- [x] **C1** — Gaussian product = abelian group, id=`One`(0,0), inv via `/` — **Z3 ∧ FsCheck** — *DONE (PR #6616: Z3 6 lemmas + FsCheck 6 props, verified locally 0-skipped)*
- [ ] **C2** — Beta product group on shifted naturals `(α−1,β−1)`, id=`Beta(1,1)` — **Z3 ∧ FsCheck** (anchor PRML ch.2)
- [ ] **C3** — Bernoulli product group via log-odds add, id=0.5 — **Z3 ∧ FsCheck** (Z3 over log-odds, finite only for p∈(0,1); FsCheck generates p strictly inside (0,1))
- [ ] **C11/C10** — Batch product = scalar element-wise; round-trip `ofMessages∘toMessages=id` — **FsCheck + prose fix** (`MessageBatch.fs` "bit-exact, proven in tests" is FALSE as written — example-tested; Bernoulli lossy at p→0/1)
- [ ] **C6** — NaN-safe `moved`/`distance`: divergent never reports converged — **Z3 ∧ FsCheck**

## P1 — primarily one tool (C13 cross-checks Z3 ∧ FsCheck; C12/C13/C14 unblock 081KT2T2J0008QG0R0008TFHJT registry promotion)

- [ ] **C5** — BP `runToFixpoint` exact-on-trees + termination — **TLA+/TLC** (3-var tree × bounded rounds — the one genuine fixpoint property; NOT hammer-bias)
- [ ] **C7** — EP probit moment-match accuracy — **FsCheck** (lift `Ep.Tests.fs` quadrature cross-check from 4 fixed points to generated cavities; keep quadrature as oracle)
- [ ] **C4** — `Message.marginal` = product-fold, generic; identity on empty — **FsCheck** (cheap once C1–C3 land)
- [ ] **C12** — Codec = invariant functor, `decode∘encode=id`, closed product/sum/id — **FsCheck** (writing this IS the 081KT2T2J0008QG0R0008TFHJT admission gate)
- [ ] **C13** — Tick = `(ℕ,+,0)` monoid + `z⁻¹/I/D` linear-operator algebra — **FsCheck ∧ Z3** (operator identities `I=Σz⁻ⁿ`, `D=1−z⁻¹`; **the Tick primitive cannot promote until this gate exists**)
- [ ] **C14** — ±1 Z-set abelian group + earn-its-keep auto-prune preserves semantics — **FsCheck** (Shapiro CRDTs 2011)

## P2 — accuracy-bound, documented (lowest urgency; bites only at extreme tails)

- [ ] **C8** — inverse-Mills asymptotic O(1/z⁵) error bound — **Z3/interval** or documented analytic bound + FsCheck band
- [ ] **C9** — v²-overflow safety in `vHat`: `v/(1+v)≤1` keeps intermediate finite ∀ valid v — **Z3** (QF_LRA)

## Standing operating rules (per Soraya's 081KT2T2J0008QG0R000YZ3NMY routing)

1. **Strict order within tier** — C1 is the foundation; every later item assumes the message group is sound.
2. **P0 is not "done" on one tool** — both the Z3 and FsCheck artefact must land AND agree. **Disagreement IS the finding** — escalate to the architect; do NOT relax the FsCheck tolerance to make them agree (BP-16).
3. **Trend > absolute** — each closed item updates the portfolio metric in `memory/persona/soraya/NOTEBOOK.md`. The audit notes the ratio *dropped* this engine-shipping round (denominator +7, numerator +0); the cadence's job is to reverse it.
4. **Canonical needs the second half** — track proof-closure here (acc. 1–3); the hex/4×4 lineage edge (acc. 4) is a paired sub-task routed to the algebra owner. Soraya flags when a proven item is lineage-edge-ready.
5. **Re-tier 081KT2T2J0008QG0R0008TFHJT on close** (acc. 5) — registry entries stay *validated / proof-owed* until their law closes AND connects to lineage.
6. **Wrong-tool guards** — do NOT TLA+ pointwise group laws (Z3); do NOT Lean 3-line identities (Z3, seconds vs human-weeks; Lean reserved for the C5 theorem only if paper-grade ever wanted); do NOT LiquidF# the refinements (TECH-RADAR Hold → FsCheck+Z3).
7. **z3-in-CI gap** (081KT2T2J0008QG0R001X9PWKR) — the `z3` CLI is **not installed in any workflow** (`Z3.Laws.Tests.fs` shells to the `z3` CLI; `Microsoft.Z3` NuGet 4.12.2 is pinned but the harness uses the CLI). So in `gate.yml` the Z3 proofs **self-skip** (green-by-skip; assert-don't-skip hole). Until z3 is added to the build-and-test job, **verify Z3 locally** where z3 is on PATH. Adding z3 to CI is the 081KT2T2J0008QG0R001X9PWKR follow-up.

Close this issue only when C1–C14 are all checked **and** their canonical lineage edges are authored.
