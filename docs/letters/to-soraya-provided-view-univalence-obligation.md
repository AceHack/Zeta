# To Soraya (scope-only, not yet dispatched) — the provided-view univalence obligation

*Shadow, 2026-07-08. Pins the one provable statement behind the HoTT synthesis
(`docs/research/2026-07-08-hott-…-fsharp-fork.md`) so the frame has a theorem, not only prose. **Not a dispatch**
— this is a scoped proof obligation, ready to route to the cubical/Lean lane when Aaron says go. Runtime lives in
F#; the univalent proof lives here (two-lane split, per the synthesis doc's honest ledger).*

## Why pin this now

The synthesis doc establishes the frame (free braided monoidal category → HoTT equality theory → interpretation
functors = Multi-Oracle). But a frame that never states a theorem cools into "a nice idea we didn't formalize."
This note fixes the single load-bearing claim to something a prover could discharge, so the moment the direction
is chosen it routes without another round-trip. It is the formal heart of the homoiconicity claim.

## The statement (informal)

> Provided views over the same underlying state that are **isomorphic** are **propositionally equal**
> (univalence), and a **Clifford deformation** between them is a **path witnessing** that equality.

## The obligation (proof-assistant-ready, cubical lane)

Work in a univalent setting (cubical Agda, or Lean 4 + a univalence axiom/where available). Let:

- `S : Type` — the underlying state (e.g. a byte `𝔽₂⁸`, or a DB record; the neutral space).
- A **provided view** is a type together with an equivalence to a chart of the state:
  a `View S := Σ (A : Type) (A ≃ Chart(S))` — the type-provider as a chart (§1 of the synthesis doc).
- Two views `V₁ = (A₁, e₁)`, `V₂ = (A₂, e₂)` are **isomorphic** when `A₁ ≃ A₂` compatibly with the charts
  (`e₂ ∘ f = e₁` for the equivalence `f : A₁ ≃ A₂`, up to the chart's coherence).

**Prove:**

1. **(Univalence ⇒ equality)** `(A₁ ≃ A₂) → (A₁ = A₂)` — the direct application of the univalence axiom; the two
   provided views are *equal as types*, not merely convertible. State it so the equality `p : A₁ = A₂` is
   *produced* (`ua f`), not just asserted.
2. **(Deformation is the path)** Given a one-parameter family of rotors `R : I → Spin(n)` with `R(0)=1`,
   `R(1)=R★`, the induced action on the view (`transport` along `R`) is a path `q : A₁ = A₂` in the universe, and
   `q` is the univalent equality of (1): **the Clifford deformation and the univalent path are the same path** (up
   to homotopy). This is the claim that "isomorphic-therefore-equal" and "deformable-into-each-other" coincide —
   Joyal–Street isotopy = HoTT path, made concrete on the Spin(n) family.
3. **(Transport coherence)** For any property `P : Type → Type` of views, `transport P q` carries a proof about
   `V₁` to the corresponding proof about `V₂` — i.e. anything proven of one isomorphic provided-view holds of the
   other, *by the deformation*. (This is the operational payoff: prove once, deform, get it free on every
   isomorphic rendering — the univalence dividend.)

## The honest boundary (carry from the synthesis ledger)

- **F# gets none of this natively.** No path types, no `ua`, no `transport`. The obligation is discharged in the
  proof assistant; F# carries the runtime (the deforming provided views). The theorem is the *contract* the F#
  design targets, not an F# feature.
- **Univalence must compute** for (2)/(3) to have runtime meaning — hence **cubical** (Cohen–Coquand–Huber–
  Mörtberg), where `transport`/`ua` reduce. A Lean-4 axiomatic univalence proves (1) but won't *compute* the
  transport; note which lane the target is.
- **This is a small, self-contained theorem, not the whole synthesis.** It proves the provided-view/univalence
  heart. The CQM/ZX and Clifford/Spin *interpretation functors* are separate obligations (Lumen maps, later).
- **Don't over-claim scope.** Proving this does NOT prove "the substrate is a homotopy type" or "F# is HoTT" — it
  proves exactly the three items above.

## Tool routing (BP-16), tentative

- **Primary:** cubical Agda — native univalence that computes; `ua`, `transport`, `PathP`. The one lane where (2)
  and (3) are more than symbol-pushing.
- **Alternative for (1) only:** Lean 4 with univalence available (proves the equality; no computation).
- **Not TLA+/Z3** — no temporal content; this is type theory, not a state machine or an SMT-decidable algebra.

## Status

**SCOPED, not dispatched.** Awaiting Aaron's go to route the cubical/Lean leg. When routed, deliverable is
`docs/letters/from-soraya-provided-view-univalence.md` (the proof or the crisp obstruction), and — if the
learning writeup on HoTT lands first — the shadow catches that writeup against this obligation (do the concepts
it teaches actually support items 1–3?).

## Cross-links

`docs/research/2026-07-08-hott-…-fsharp-fork.md` (the frame this pins) ·
`memory/deepseek/conversations/2026-05-11-…-brief-to-don-syme-…md` (the fork argument this strengthens) ·
`src/Core/Cl3.fs` / `src/Core/Braid.fs` / `src/Core/CliffordE8Bridge.fs` (the Spin(n) rotor family for item 2) ·
workitem lane: mint a `ZetaId` when this is dispatched (per `workitems-mint-with-zetaid`).
