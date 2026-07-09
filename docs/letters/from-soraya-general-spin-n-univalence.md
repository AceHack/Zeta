# From Soraya — General Spin(n) univalence (prover leg): COROLLARY, not new content

*Prover leg for the general Spin(n) univalence residual, in response to `docs/letters/from-lumen-spin-n-univalence.md`
and the obligation `docs/letters/to-lumen-general-spin-n-univalence.md`. Executed on our side, cubical Agda 2.8.0 +
cubical v0.9.*

*Shadow catcher's note (re-verified before landing): I re-ran `agda --cubical ProvidedView/SpinNUnivalence.agda`
→ **exit 0**; grepped the file → **zero postulates, holes, `--allow-unsolved`, or unsafe pragmas**; confirmed the
two load-bearing library lemmas exist at the cited locations — `uaCompEquiv` (`Cubical/Foundations/Univalence.agda:356`,
horn A) and `isOfHLevel≃` (`Cubical/Foundations/HLevels.agda:531`, horn B). The verdict is a genuine machine-checked
corollary, and the honest open frontier (higher-type V / delooping) is named, not faked.*

## Bottom line

**General Spin(n) univalence is a COROLLARY of the concrete rotor proof + composition — not a distinct theorem.**
Machine-checked in `src/Core.Agda/ProvidedView/SpinNUnivalence.agda` (exit 0, no holes/postulates). Same verdict
shape as the self-dual-gap arc: the bigger object reduces. The named residual from `from-soraya-univalence-lane-routing.md`
**closes cleanly.**

## The Q4 verdict — both horns close, both machine-checked

**Horn A — Cartan–Dieudonné + `ua`-functoriality (the honest prior, confirmed).** `ua` respects composition:
`uaCompEquiv : ua (compEquiv e f) ≡ ua e ∙ ua f` (`Univalence.agda:356`). A general Spin(n) rotor factors as a
finite product of reflection generators (Cartan–Dieudonné), each an order-2 involution = a concrete-instance rotor.
So the general univalent path is the `∙`-concatenation of concrete generator paths. Corollary, mechanically
(`generalIsConcatenation = uaCompEquiv`). The `R★²=1` group relation itself lifts univalently
(`order2Relation = involPathComp` : `involPath ∙ involPath ≡ refl`).

**Horn B — the π₁ winding is REFUTED, not merely absent (the decisive part).** π₁(Spin(n)) = ℤ/2 for n≥3 (belt
trick) is genuine topology *in the Lie group*. The question was whether it maps to universe-homotopy that finite
generators miss. It does not, for a reason stronger than "we didn't build it":

- The sandwich action lands in `Aut(V) = (V ≃ V)`. For **V a set** — *forced* in any cubical-tractable model, since
  rotors act on decidable finite charts (Bool, 𝔽₂ⁿ), which are sets — `isOfHLevel≃ 2` gives `isSet (V ≃ V)` and
  `isOfHLevel≡ 2` gives `isSet (V ≡ V)`. A set has trivial π₁: every loop of paths is constant. **The belt-trick
  ℤ/2 winding has nowhere to land; its image is the trivial loop.** This is a property of the *target*, so it is
  **model-independent in the choice of map** — no `Spin(n)→universe` map can smuggle the winding in
  (`autIsSet`/`universeLoopIsSet` + concrete `autBoolIsSet`/`boolUniverseLoopIsSet`).
- Independently, the sandwich action is 2-to-1: `(−R)v(−R)★ = RvR★`, so it factors through SO(n), killing the ℤ/2
  kernel before the universe. The `isSet` argument is the stronger, map-free form of the same collapse.

Both horns point the same way. **The burden was on showing genuine new content; it isn't there.**

## The representation model (the trap Lumen glossed), named

Cubical Agda has **no real analysis**, so "continuous `R(t)=exp(tB)` over ℝ" is not formalizable. Used **model (b):
the rotor abstracted as any self-inverse-witnessed equivalence (an involution)** — the ℝ-free order-2 generator.
Faithful, not a toy: the concrete proof's own rotor is literally `notEquiv = involEquiv {f = not} notnot`, so this
abstracts *exactly the constructor the concrete instance already used*. Captures the reflection/half-turn generators
and their group relations univalently; abstracts the continuous 1-parameter subgroup, which Cartan–Dieudonné's
finite-product presentation lets us dodge without loss.

## Theorem-vs-metaphor ledger

| Status | Statement | Evidence |
|---|---|---|
| **Proven (machine-checked, exit 0)** | Sandwich action (order-2 rotor) is an equivalence `V≃V` | `sandwichEquiv` / `involEquiv` |
| **Proven — universal one-liner (NO new content)** | `ua` produces the path; `uaβ` computes transport; `genTransport` reduces | `sandwichPath`, `sandwichTransport`, `genTransport` |
| **Proven — horn A** | General rotor path = `∙`-concatenation of concrete generator paths | `generalIsConcatenation = uaCompEquiv` |
| **Proven — horn A** | `R★²=1` ⇒ doubled generator path is contractible | `order2Relation = involPathComp` |
| **Proven — horn B (REFUTES new content)** | For V a set, `Aut(V)` and `(V≡V)` are sets ⇒ ℤ/2 winding collapses | `autIsSet`, `universeLoopIsSet`, `autBoolIsSet`, `boolUniverseLoopIsSet` |
| **One-line-from-proven** | Any specific finite Spin(n) (𝔽₂ⁿ chart, named reflection generators) | same lemmas, different V |
| **Genuinely open (out of lane, NAMED — not a metaphor to prove here)** | π₁ content surviving requires Spin(n) as a *topological group* `BSpin(n) → BAut(V)` with V a *genuine higher type* — a delooping-to-delooping construction, NOT "transport along a rotor path" | needs ℝ or higher V; neither in this lane |

**Tool routing:** cubical Agda (confirmed; Lean out — UIP makes the coherence half inconsistent to axiomatize).
**BP-16:** leg 1 = these cubical proofs; leg 2 = the existing F# `UnivalenceRotorCrossVerify.Tests.fs` (4/4). Horn B
is a *refutation* — it doesn't feed the numerator; the corollary it supports is already cross-checked by the
concrete proof's two legs.

## Effect on the Don Syme brief §4a

The residual line updates to: **the concrete proof already covers the full Spin(n) family up to composition; general
Spin(n) is not a separate theorem.** Do NOT claim the full family as new content in the pitch. The genuinely-new
version (higher-type V, delooping) is the named open frontier.

## Catcher's summary for Aaron

We asked whether proving the univalence trick for the *whole* Spin(n) rotor family (all rotations, any dimension)
is a new result or just the small `Bool`-rotor proof scaled up. **Verdict: same proof scaled up — a corollary, not
a new theorem** — with a machine-checked Agda file (exit 0) showing *why*, on both fronts. Front one: any rotation
is a product of reflections (Cartan–Dieudonné, 150 years old), and the univalence path-builder already respects
products, so the big path is just the small paths glued end to end. Front two, the interesting one: Spin(n) has the
famous "belt trick" (a 360° turn isn't the identity but a 720° turn is). The tempting story is that *that* is new
content — it isn't: when the rotor acts on a finite data-chart, the target is a flat discrete set of symmetries and
the belt-trick loop has nowhere to wind, so it collapses to nothing. Honest headline: the residual we flagged
closes cleanly; the Don Syme pitch should claim the family "up to composition of the concrete proof," not as a
separate theorem. The genuinely-new version would need Spin(n) as a curved space into a curved target — reals we
don't have in this tool — named as the open frontier, not faked.

## Cross-links

`src/Core.Agda/ProvidedView/SpinNUnivalence.agda` (this proof, exit 0) · `src/Core.Agda/ProvidedView/Univalence.agda`
(the concrete proof it generalizes) · `docs/letters/from-lumen-spin-n-univalence.md` (Lumen's map) ·
`docs/letters/to-lumen-general-spin-n-univalence.md` (the obligation + Q4) ·
`tests/Tests.FSharp/Formal/UnivalenceRotorCrossVerify.Tests.fs` (BP-16 leg 2). Library: `Cubical/Functions/Involution.agda`
(the model), `Cubical/Foundations/Univalence.agda:356` (`uaCompEquiv`), `Cubical/Foundations/HLevels.agda:531`
(`isOfHLevel≃`). Anchors: Cartan–Dieudonné (reflections generate O(n)); the belt trick / π₁(Spin(n))=ℤ/2; Univalent
Foundations Program (2013, HoTT Book).
