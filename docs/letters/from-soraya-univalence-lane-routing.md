# From Soraya — univalence lane routing (BP-16 portfolio call)

*Tool-portfolio / lane-routing decision for `docs/letters/to-soraya-provided-view-univalence-obligation.md`.
Not a proof — a routing call. Shadow lands it.*

*Shadow catcher's note (verified before landing): (1) The load-bearing crux — Lean's definitional proof
irrelevance ⇒ UIP ⇒ the univalence β-rule `transport (ua f) = f` is inconsistent (not merely non-computing) — is
a standard, well-established type-theory result (Hofmann–Streicher; it is the reason HoTT requires cubical). Sound.
(2) The infra spec mirrors real surfaces: `tools/setup/manifests/from-elan` uses the exact
`<tool> <url> sha256=<hex> commit=<sha>` content-pin-pair format; `ace-mechanism-pointers.json` carries
`opt_in: ["ZETA_INSTALL_FULL=1"]` with `realizer`/`manifest` fields; `tools/setup/common/tlaps.sh` is the
heavy-build-gated-idempotent shape. Soraya's `from-ghcup` + `agda-cubical.sh` are faithful mirrors, gated
opt-in — Aaron's declarative-ACE / cross-OS constraint satisfied.*

## Decision: **(b), scoped** — wire a cubical Agda lane; descope item (2) to the concrete rotor instance

Not (a) Lean: the Lean partial result is worse than the tasking assumed — item (1) is an axiom restatement (zero
ΔU), and items (2)/(3) are not merely non-computational, their coherence form is **inconsistent** with Lean's
kernel. Landing (a) puts an `axiom`-as-proof in the portfolio numerator — the false-green failure mode. Not (c):
two of three items are cubical-library one-liners once the lane exists, so the infra cost buys immediate,
computing, machine-checked discharge of (1) and (3); the lane pays for itself on landing day.

## The crux — what Lean 4 + Mathlib actually gets you (the (a)-vs-(b) adjudication)

- **Genuinely provable in Lean:** the set-level `Equiv` algebra — construct `f : A₁ ≃ A₂` from chart
  compatibility (`e₂ ∘ f = e₁`), Mathlib `Equiv` composition; also `Equiv.cast : α = β → α ≃ β` (the converse).
  Keep this as a legitimate set-level cross-check leg.
- **Item (1) in Lean:** `(A ≃ B) → A = B` is independent — the "proof" is adding the axiom. Consistent to add,
  but content-free (you *state* `ua`, you don't *derive* it).
- **Items (2)/(3) — the sharp fact:** Lean's `Eq` is Prop-valued with definitional proof irrelevance ⇒ UIP. UIP
  makes the transport-coherence rule `cast (ua f) = f` **inconsistent**: `ua not` and `rfl : Bool = Bool` are
  proof-irrelevantly equal, so `cast (ua not) = id`, and the β-rule would give `not = id → False`. So in Lean you
  cannot even soundly *axiomatize* what (2)/(3) claim; under UIP they collapse to triviality. `Quotient`/`Trunc`
  are set-level/UIP-compatible — no help. Lean-4 HoTT niche libs (Ground Zero) are non-computing, discipline-
  enforced — not a BP-16 leg. **Cubical is genuinely required — for the statements to be non-vacuous at all.**

## Per-item verdict

| Item | Cubical Agda | Lean 4 + Mathlib |
|---|---|---|
| (1) `(A₁≃A₂) → A₁=A₂`, path produced | **Library lemma** — `ua`, `Cubical.Foundations.Univalence`. One line. | Axiom only; content-free |
| (2) Rotor deformation = the univalent path | **The one real theorem** (descoped, below) | Unstatable non-vacuously (UIP kills coherence) |
| (3) Transport coherence, computing | **Library lemmas** — `subst`/`transport` + `uaβ`; they reduce | Vacuous under UIP |
| Chart-compat ⇒ equivalence (the `Σ`-setup) | Provable | **Provable — keep as the set-level cross-check leg** |

**Descope on (2), binding:** general `Spin(n)` in cubical is a research project (no Clifford/Spin in the cubical
library). Route the **concrete instance matching `src/Core/Cl3.fs`** — one explicit rotor path (Spin(3) /
unit-quaternion action, or the finite `𝔽₂⁸` byte-chart instance) proving `pathToEquiv q ≡ f` for that family.
General Spin(n) stays a **named open residual** — not hidden, not claimed.

**BP-16 cross-check (two independent legs):** leg 1 = the cubical proofs; leg 2 = Adaeze FsCheck property on the
F# runtime (rotor-conjugation view roundtrip / chart-compatibility on the concrete instance,
`tests/Tests.FSharp/Formal/`); optional leg 3 = the Lean set-level `Equiv` lemma. Single-lane cubical alone would
not satisfy BP-16 for a load-bearing claim feeding the Don Syme pitch.

## Infra spec for Dejan — declarative ACE desired-state (Aaron's hard constraint carried)

Mirrors `from-elan` (pinned bootstrap) + `tlaps.sh` / `from-opam-git` (heavy pinned build, gated). Never
imperative.

1. **`tools/setup/manifests/from-ghcup`** (new; format mirrors `from-elan`):
   `ghcup  https://raw.githubusercontent.com/haskell/ghcup-hs/<commit>/scripts/bootstrap/bootstrap-haskell  sha256=<hex>  commit=<sha>`.
   Realizer `src/Core.TypeScript/ace/setup-realizers/from-ghcup.ts` (clone of `from-elan.ts`). ghcup pins
   `ghc=9.6.6 cabal=3.12.1.0` (same key=value style as `from-opam-git`).
2. **`tools/setup/common/agda-cubical.sh`** (new; mirrors `tlaps.sh` — idempotency guard, inline pins, invoked by
   `macos.sh`/`linux.sh` only under `ZETA_INSTALL_FULL=1`; dev-container inherits via `linux.sh`):
   - `AGDA_VERSION="2.7.0.1"` via `cabal install Agda-${AGDA_VERSION}` (heavy Haskell build — the gate's purpose).
   - `CUBICAL_TAG="v0.8"` `CUBICAL_COMMIT=<sha>` — clone `agda/cubical` at the pinned commit; idempotent append to
     `~/.agda/libraries`.
   - **Pin-pair discipline:** Agda version ↔ cubical release are a content-pin pair (like `from-elan`'s
     URL+sha256) — bump together only; confirm the compatible pair from the cubical release README at wiring
     (v0.8 targets the Agda 2.7.0.x line; verify).
   - Verify step: typecheck a one-module `{-# OPTIONS --cubical #-}` hello importing `Cubical.Foundations.Prelude`.
3. **`ace-mechanism-pointers.json`** — new entry: `ecosystem: from-ghcup` + the agda/cubical dependency,
   `update: pinned`, `opt_in: ["ZETA_INSTALL_FULL=1"]` (same as the tlapm entry). `doctor.sh` gets an
   `agda --version` check with the "optional; build with ZETA_INSTALL_FULL=1" warn shape.
4. **Lighter path to evaluate at wiring:** if upstream Agda ships pinned official binaries for all three targets
   (macOS-arm64, linux-x64, linux-arm64), a `from-url` entry with sha256 pins replaces the cabal build — Dejan's
   call; the manifest surface is identical either way.
5. **Named debt (tlaps/Isabelle precedent):** `install.ps1` / Windows parity deferred; `linux.sh` covers CI +
   dev-container.
6. **Proof home:** `src/Core.Agda/ProvidedView/Univalence.agda` + an `.agda-lib` declaring `depend: cubical`
   (placement is Kenji's call; routing only). Mint the workitem ZetaId at dispatch per `workitems-mint-with-zetaid`.

## Summary for Aaron

The univalence obligation splits cleanly: two of three items are cubical-library one-liners and the third is one
real theorem — but **none survive in Lean**. Lean's proof irrelevance gives UIP, which makes the
transport-coherence half of the claim *inconsistent* to even axiomatize, so a "Lean partial result" would be an
axiom wearing a proof's clothes: false-green. Routing **(b)**: wire cubical Agda as a declarative ACE lane —
pinned ghcup bootstrap manifest mirroring `from-elan`, plus `agda-cubical.sh` mirroring `tlaps.sh`, gated behind
`ZETA_INSTALL_FULL=1`, pin-pair Agda 2.7.0.1 ↔ cubical v0.8 — and descope item (2) from general Spin(n) (a
research project) to the concrete `Cl3.fs` rotor instance, general case a named residual. BP-16 cross-check:
cubical lemma + Adaeze FsCheck on the F# side, with the small genuinely-Lean-provable `Equiv` lemma as a set-level
third leg. The lane discharges (1) and (3) the day it lands; the infra spec is ready for Dejan.

## Cross-links

`docs/letters/to-soraya-provided-view-univalence-obligation.md` (the obligation) · `tools/setup/manifests/from-elan`
and `tools/setup/common/tlaps.sh` (the two install patterns mirrored) · `tools/setup/ace-mechanism-pointers.json`
(new entry home, opt-in gate) · `src/Core/Cl3.fs` (the concrete rotor instance item (2) descopes to).
