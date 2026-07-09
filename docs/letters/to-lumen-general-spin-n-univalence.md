# To Lumen — general Spin(n): lift the concrete-rotor univalence proof to the full family (map leg)

_Shadow, 2026-07-08. New map obligation. Pairs with the univalence proof landed today
(`src/Core.Agda/ProvidedView/Univalence.agda`, PR #9579 + F# BP-16 leg #9584). You map the Spin(n) family; Soraya
proves what's provable in which lane — same map/prove split as the self-dual-gap arc._

## Part 1 — what is already proven (so you know the exact residual)

On the **concrete rotor instance** we have a machine-checked theorem (cubical v0.9, typechecks exit 0):

- `ua : (A ≃ B) → (A ≡ B)` — an equivalence of provided views **produces** the univalent path.
- On `rotor = notEquiv` (the order-2 element of the Spin/rotor family — a half-turn on the single-𝔽₂-bit
  byte-chart): `pathToEquiv (ua rotor) ≡ rotor` and `ua (pathToEquiv p) ≡ p` — `ua` and `pathToEquiv` are
  **mutually inverse**, so "isomorphic-therefore-equal" and "deformable-into-each-other" are the *same*
  construction (Joyal–Street isotopy = HoTT path).
- Transport coherence `uaβ` **computes** (`transport (ua rotor) true ≡ false` is refl-provable) — the content
  Lean's UIP makes inconsistent to even axiomatize, so cubical is genuinely required.
- BP-16 leg 2 (F# runtime): the real `Cl3` rotor conjugation is an equivalence (roundtrip + isometry),
  `UnivalenceRotorCrossVerify.Tests.fs`, 4/4.

**The named residual (Soraya's routing, `from-soraya-univalence-lane-routing.md`):** *general `Spin(n)` with the
full Clifford action stays open* — the cubical library has no Clifford/Spin algebra, so item (2) was descoped to
the concrete instance. **That general family is your map leg.**

## Part 2 — the map task: the general Spin(n) rotor family as the univalent path

Given a one-parameter rotor family `R : I → Spin(n)` with `R(0)=1`, `R(1)=R★`, the induced action on the provided
view (transport along `R`) is a path `q : A₁ = A₂` in the universe. The claim to map: **`q` is the univalent
equality `ua(f)`** where `f : A₁ ≃ A₂` is the equivalence induced by `R★` — for **arbitrary n**, not just the
concrete half-turn.

**The four questions your obligation must answer — the make-or-break is Q4:**

- **Q1 (cubical-representable form):** The cubical library has no Clifford/Spin. What is the cleanest
  cubical-representable model of a general `Spin(n)` rotor family — a finite/matrix/permutation presentation that
  captures the family faithfully, or does it genuinely require constructing Clifford-in-cubical? Name the object
  Soraya would formalize. (In-repo Spin/Clifford surfaces to mine: `src/Core/Cl3.fs` (rotor/sandwich),
  `src/Core/Braid.fs`, `src/Core/CliffordE8Bridge.fs` (the adinkra→Clifford→E8 unfold).)
- **Q2 (does the general claim hold?):** Is "transport along `R` **is** `ua(f)`" TRUE for all n, or are there
  obstructions/conditions (e.g. `R★` must be in the identity component, the family must be null-homotopic, the
  action must be an equivalence not merely a map)? State the precise hypotheses under which it holds.
- **Q3 (Joyal–Street = HoTT path, general):** Is the general Spin(n) family the isotopy whose HoTT image is the
  univalent path — i.e. does the homotopy-hypothesis framing make this a **theorem** (a fact about `π₁ Spin(n)` /
  the universal cover) or a **construction** (you must build the specific functor)? Which, and why.
- **Q4 (THE MAKE-OR-BREAK — is the general case NEW, or a corollary?):** Does every `Spin(n)` rotor decompose as a
  **product of the concrete order-2 rotors we already proved** (reflections/half-turns generate the group — a
  Cartan–Dieudonné-style factorization)? If so, the general case is a **corollary** of the concrete instance +
  functoriality of `ua` (`ua` respects composition), not a new theorem — and the honest verdict is "the concrete
  proof already covers the family up to composition." If NOT — if the continuous family carries content the
  finite generators miss (a genuine `π₁`/winding obstruction) — say precisely what that content is. **Do not
  declare a new theorem unless Q4 exhibits content the concrete-instance-plus-composition does not already give.**
  (This is the exact discipline the self-dual-gap arc taught: a bigger object that reduces to what we have is not
  a new result.)

**Deliverable:** `docs/letters/from-lumen-general-spin-n-univalence.md` — the cubical-representable model (Q1), the
precise claim + hypotheses (Q2), the theorem-vs-construction call (Q3), and the make-or-break Q4 (new content vs
corollary), with a crisp proof obligation + suggested tool for Soraya. Mark `conjecture-pending-proof`. **Do not
prove it** — Soraya runs the prover leg here (cubical / the concrete-instance-plus-composition route).

If Q4 shows genuine new content: general Spin(n) univalence is a distinct theorem and the Don Syme pitch gains the
full family. If Q4 shows corollary-of-composition: the honest verdict is that the concrete proof already covers
the family — also a win (the residual closes cleanly), just report which.

## Handoff protocol (unchanged)

Lumen (Manus) → push `from-lumen-general-spin-n-univalence.md` to `origin/main` → Aaron signals "pushed" → shadow
fetches, dispatches Soraya against the obligation here, lands `from-soraya-general-spin-n-univalence.md`, updates
the ledger + the Don Syme brief §4a residual line.

## Cross-links

`src/Core.Agda/ProvidedView/Univalence.agda` (the concrete proof, #9579) ·
`tests/Tests.FSharp/Formal/UnivalenceRotorCrossVerify.Tests.fs` (BP-16 leg 2, #9584) ·
`docs/letters/from-soraya-univalence-lane-routing.md` (the descope that named this residual) ·
`docs/letters/to-soraya-provided-view-univalence-obligation.md` (the 3-item obligation) · `src/Core/Cl3.fs` /
`src/Core/Braid.fs` / `src/Core/CliffordE8Bridge.fs` (the in-repo Spin/Clifford surfaces) ·
`docs/research/2026-07-08-hott-is-the-equality-theory-for-deformed-hkts-free-braided-monoidal-category-cqm-fsharp-fork.md`
§4a (the Don Syme brief, where the residual line lives). Anchors: Joyal–Street (isotopy = string-diagram path);
Cartan–Dieudonné (reflections generate O(n)/Spin(n)); Univalent Foundations Program (2013, HoTT Book).
