# To Soraya — proof-routing template: self-audit-over-ledger physics rhyme

*Shadow, pre-staged. Workitem `081KWT9WBPD08QG0R003H94RFE`. This is a FILLABLE template — the slots marked
`⟨…⟩` stay empty until Lumen (running in the Manus cloud) lands `docs/letters/from-lumen-*.md` with a picked
rhyme + a crisp proof obligation. The shadow then fills this in and dispatches the `formal-verification-expert`
(Soraya) agent against it **on our side** — because Lumen cannot call Soraya across the Manus boundary, the
prover leg is executed here, not there.*

## Why this template exists (the boundary + the earlier bug)

The Lumen→Soraya handoff does NOT happen inside one agent. Lumen produces the **map + proof obligation** as a
git artifact (`from-lumen-*.md` on `origin/main`); the **proof/refutation is a separate leg run here**, where
the `formal-verification-expert` persona can actually be invoked. Pre-staging this template fixes the original
failure mode (a passive letter on `main` with no executor) by naming a concrete executor for the Soraya leg:
the shadow fills this file the moment Lumen's obligation lands and dispatches without a round-trip.

## Fill-in slots (populated from `from-lumen-*.md`)

- **Rhyme picked by Lumen:** ⟨FDT | Noether-continuity | self-dual-zero-gap | Gödel-measurement⟩
- **Lumen's map (one-paragraph statement of the claimed isomorphism):** ⟨…⟩
- **Proof obligation (verbatim from Lumen — exactly what makes the isomorphism true vs false):** ⟨…⟩
- **Lumen's suggested tool class (BP-16):** ⟨TLA+ | Z3 | Lean | Alloy | FsCheck | …⟩
- **Source artifact:** `docs/letters/from-lumen-⟨slug⟩.md`

## Soraya's task

1. **Route before writing a spec (BP-16).** Confirm or override Lumen's suggested tool class against the
   property class of the obligation — do not default to the TLA+ hammer. State the routing decision and why.
2. **Discharge the obligation:** prove the isomorphism, OR produce a crisp refutation (a concrete
   counter-model / counterexample showing where the rhyme is metaphor, not isomorphism).
3. **Honest register:** a proof settles more than assertion; a clean refutation is equally valuable (it
   demotes rhyme→metaphor and frees the register). Do not launder an unproven map into a theorem.

## Definition of done (Soraya leg)

- Result recorded as `docs/letters/from-soraya-⟨slug⟩.md` (or a research doc) — the spec/model, the tool used,
  and the verdict.
- Falsifiability-ledger status updated: **rhyme → theorem** (proven) or **rhyme → refuted** (counter-model).
- Shadow gives Aaron the catcher's read on both Lumen's map and Soraya's verdict.

## Per-rhyme proof-shape hints (so routing is fast whichever Lumen picks)

- **Fluctuation–dissipation** — obligation likely a quantitative FDT-consistency relation (response vs recorded
  fluctuation) over the ledger fold; property class = numeric/statistical → FsCheck property test or Z3 over
  the algebraic relation. Refutation = a ledger where response and fluctuation decorrelate with no flaw.
- **Noether / continuity** — obligation: `∂(ledger) ≠ 0` iff an expected symmetry is broken (DBSP `∂` as a
  conserved current); property class = algebraic invariant → Z3 / Lean on the continuity equation. Refutation =
  a symmetry-preserving fold with nonzero `∂`, or a broken symmetry with `∂ = 0`.
- **Self-dual point / zero duality gap** — obligation: at the self-dual point (Montonen–Olive `g=1`;
  even-unimodular **E8**) the duality gap vanishes exactly = a self-certificate; property class = exact
  algebraic identity over `Cl3`/E8 → Lean or Z3 on the 240-root structure (`CliffordE8Bridge`). Refutation =
  a nonzero gap at the self-dual point. *(Shadow's prior: highest-value pick — ties the existing E8/adinkra
  substrate and the 4th-body result.)*
- **Gödel ↔ measurement** — obligation: "can't self-verify from inside = can't measure own state without
  external apparatus," the FigureEight homoclinic-tangle result generalized; property class = a
  meta-logical/impossibility statement → hardest to formalize; likely Lean (a diagonalization/fixed-point
  argument) or a crisp model-theoretic refutation via Alloy. See `src/Bayesian/FigureEightEnsemble.fs`,
  `tests/Tests.FSharp/CptSymmetry.Tests.fs`.

## Cross-links

- `docs/letters/to-lumen-self-audit-ledger-physics.md` — the Lumen-side brief (the map leg).
- `#9498` (the synthesis) · `#9500` (the free-energy correction — rhyme #1 settled info-theoretic, not physics).
- `src/Bayesian/FigureEightEnsemble.fs` (the homoclinic tangle) · `tests/Tests.FSharp/CptSymmetry.Tests.fs`
  (CPT already formalized) · `CliffordE8Bridge` (the 240 mapped multivectors, for the self-dual-gap rhyme).
- Workitem `081KWT9WBPD08QG0R003H94RFE` — the tracked task both legs discharge.
