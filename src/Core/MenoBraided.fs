namespace Zeta.Core

/// **`MenoBraided` — the GENUINE (non-symmetric) braiding for Meno: the conjugation-rack Yang–Baxter
/// operator, the ℤ-linear shadow of Braid's Artin action (shadow*, per Soraya's spec 2026-07-31).**
///
/// `Meno.tensor` equips the category with a symmetric structure via the tuple swap — but NOT because a
/// theorem forces it. CORRECTED 2026-08-13: `⊗_Kronecker` is **not cartesian**, so Mathlib's
/// `Subsingleton (SymmetricCategory C)` (which requires `CartesianMonoidalCategory`) does not apply and
/// the category admits many braidings. Two independent refutations: (1) `⊗` is not the categorical
/// product — in Mod_ℤ that is the biproduct `⊕ = ℤ[X ⊔ Y]` of rank |X|+|Y|, while `Meno.tensor` gives
/// `ℤ[X × Y]` of rank |X|·|Y| (|X|=|Y|=1: 1 vs 2). (2) `unitObject` is not terminal —
/// `Hom(ℤ[X], ℤ) = ℤ^X`, a singleton only when X is empty. See `Meno.fs:34`, which already said this
/// ("CD category, NOT cartesian") while four other comments in the same file contradicted it.
///
/// So `Meno.braid` (the tuple swap) is a *correct symmetric* braiding — σ²=id. It is NOT
/// "unearned braiding"; it is genuinely the symmetry. A genuine BRAID needs EXTRA DATA the tensor cannot
/// supply: a Yang–Baxter operator R with **R²≠id**. Over the free-group-word object V = ℤ[Fₙ]
/// (`Braid.Word`), the integer / float-free / byte-lockable choice is the **conjugation-rack** solution
///
///     R(x ⊗ y) = (x·y·x⁻¹) ⊗ x        R⁻¹(u ⊗ v) = v ⊗ (v⁻¹·u·v)
///
/// This is EXACTLY `Braid.applyCrossing`'s σᵢ at the ℤ-linear level — `braidR` on `(x₀, x₁)` equals
/// `(Braid.act [1] x₀, Braid.act [1] x₁)`, i.e. the R-matrix *realizes the braid generator σ₀*. So the
/// n-strand representation ρ factors through Braid's FAITHFUL group action, giving `ρ-equal ⟺
/// Braid.equal` (the P5c tripwire). And R²≠id in a non-abelian free group, so this earns **braided**, not
/// symmetric (the P4 tripwire). Scope earned (Soraya): *"V is a braided object; the subcategory ⟨V⟩ it
/// generates is braided monoidal and realizes Bₙ"* — NOT "all of Meno is braided" (that needs a full
/// quasi-triangular R). This module claims the first only.
///
/// **BALANCED — the rung above braided, settled 2026-08-14 (Soraya).** `⟨V⟩` **is** balanced, and the
/// balanced structure is **unique**: the twist is the Garside full twist `θ_{V^n} = ρ(Δₙ²)`, where
/// `Δₙ = (σ₁)(σ₂σ₁)…(σₙ₋₁…σ₁)`. Note `θ_V = ρ(Δ₁²) = id` — that is FORCED (B₁ is trivial) and it is
/// NOT a contradiction: the balanced axiom is `θ_{A⊗B} = (θ_A ⊗ θ_B) ∘ c_{B,A} ∘ c_{A,B}`, **not**
/// `θ_{A⊗B} = θ_A ⊗ θ_B`, so `θ_V = id` forces `θ_{V⊗V} = c² = σ₁²` rather than `c² = id`. (Two earlier
/// reviews made exactly that misreading and concluded Meno was provably NOT balanced. It is balanced.)
/// Naturality reduces to centrality in Bₙ because `Hom_{⟨V⟩}(V^n, V^n) = ρ(Bₙ)` and ρ is faithful.
/// CITATION CORRECTED 2026-08-15: this needs only `Δₙ² ∈ Z(Bₙ)` — elementary from `ΔσᵢΔ⁻¹ = σₙ₋ᵢ` —
/// and NOT Chow 1948's strictly stronger `Z(Bₙ) = ⟨Δ²⟩`, which was cited here for a fact the proof does
/// not use (and whose generation half is false at n = 2, where `Z(B₂) = B₂ = ⟨Δ₂⟩ ⊋ Δ₂²`). Better still,
/// centrality need not be ASSUMED at all: `MenoTwistCentrality.PreTwist.natural_of_mem` DERIVES it from
/// the balanced axiom via the hexagons, for all n. CHECKED for all m+n ≤ 7 by two independent
/// implementations of Artin's action (the shipped `Braid.equal` plus an independent re-implementation),
/// with four planted mutants — θ=id, θ=Δ, θ=Δ⁴, and a single block-swap — all REJECTED, so the check is
/// not vacuous. General-n Lean certificate: work-item 081KZZVC3DD087G0R0035SZN58 (landed); the derived
/// naturality + the non-symmetric witness: 081M00EZXN2087G0R003AY3WSJ.
///
/// **Why `⟨V⟩` must never admit copy Δ or discard ε.** A *cartesian* monoidal category has a **unique
/// braiding**, and it is the swap — stronger than Mathlib's `Subsingleton (SymmetricCategory C)`, which
/// only pins the *symmetric* structure. (I is terminal, so naturality against `!_A : A → I` forces
/// `π₁∘c = π_B` and `π₂∘c = π_A`; the product's universal property then pins `c = swap`.) `Meno.fs:38`
/// records that the DETERMINISTIC subcategory — the `arr f` arrows — IS cartesian (Fox 1976), and
/// `braidR` below is built with `Meno.arr`. What keeps `⟨V⟩` honest is that every one of its morphisms
/// is a **basis bijection** (`braidR`/`braidRinv` are mutually inverse; ⊗ and ∘ preserve bijections),
/// while Δ : V → V⊗V is not surjective on basis and ε : V → I is not injective — so neither can enter,
/// and by Fox `⟨V⟩` is not cartesian. Nothing new needs constructing: the "minimal non-cartesian ⊗ on
/// ⟨V⟩" is the ambient Kronecker ⊗ under a **hom-restriction**, and `rep` below IS that restriction.
/// Regression guard: work-item 081KZZVC6SE087G0R001SXE8BV.
///
/// **Where the ladder stops, and why.** Ribbon is blocked at the OBJECT, not merely unproven: V = ℤ[Fₙ]
/// is free of infinite rank and in Mod_ℤ dualizable ⟺ finitely generated projective, so V has no dual.
/// Modular tensor is false, not open (infinitely many simples). Anchors: Joyal–Street 1993 (braided /
/// balanced); Garside 1969 (Δ, the full twist Δ²); Chow 1948 (Z(Bₙ)); Fox 1976 (cartesian ⟺ natural
/// comonoid); Artin 1925 (faithfulness).
///
/// **What is NOT here yet — CORRECTED 2026-08-15.** The previous text listed three deferrals; two of
/// them had already shipped and the paragraph had gone stale, which is exactly the failure this file's
/// Part 4 note warns about (a name standing in for a check).
///  * ~~associator α + unitors~~ — **shipped**: `Meno.associator` / `associatorInv` / `leftUnitor` /
///    `rightUnitor` (`Meno.fs`), pentagon + triangle at `MENO-8`/`MENO-9`. The claim "the hexagons can't
///    even be *stated* without α" is correct and is a **typing** fact — without α the two sides of a
///    hexagon do not have the same type — but α was never the blocker; it was already there.
///  * ~~Lean4 abstract R-matrix certificate~~ — **shipped**: `src/Core.Lean4/Lean4/MenoBraidedRMatrix.lean`.
///  * **the two hexagons themselves** — the genuine gap, and the one the deferral note obscured. Now
///    discharged in Lean: `src/Core.Lean4/Lean4/MenoMonoidalHexagons.lean` proves both hexagons in the
///    non-strict (tuple) model at the generating triple AND in the strict (list) model at all block
///    sizes, with negative controls showing they are independent of Yang–Baxter and of σ²≠id.
/// Still open: the FsCheck hexagon suite on the F# side (the Lean file is the certificate, not the
/// property test). Work-item 081KYWEM90908QG0R002NHEMZE.
///
/// Anchors: Joyal–Street 1993 (braided monoidal categories, the hexagons); Yang 1967 / Baxter 1972 (YBE);
/// Joyce 1982 / Fenn–Rourke 1992 (racks/quandles as set-theoretic YB solutions); Kassel *Quantum Groups*.
[<RequireQualifiedAccess>]
module MenoBraided =

    /// The braided object V = ℤ[Fₙ] — the free-group words `Braid` already ships.
    type V = Braid.Word

    /// The genuine braiding c = R : V⊗V → V⊗V — the conjugation-rack Yang–Baxter operator.
    /// `R(x,y) = (x·y·x⁻¹, x)`. σ²≠id (non-symmetric) ⇒ this is braided, not the swap. It realizes the
    /// braid generator σ₀ (see the module doc / the MENO-BRAID tests).
    let braidR : Meno.Arrow<V * V, V * V> =
        Meno.arr (fun (x, y) -> (Braid.mul (Braid.mul x y) (Braid.inv x), x))

    /// The inverse braiding R⁻¹ : `R⁻¹(u,v) = (v, v⁻¹·u·v)`. `braidRinv ∘ braidR = id`.
    let braidRinv : Meno.Arrow<V * V, V * V> =
        Meno.arr (fun (u, v) -> (v, Braid.mul (Braid.mul (Braid.inv v) u) v))

    /// Apply R (c>0) or R⁻¹ (c<0) at strand position |c|-1 of a strand-word list — one braid crossing.
    /// Positions out of range pass straight (a no-op crossing).
    let private crossingOnList (c: int) (strands: V list) : V list =
        let i = abs c - 1
        let a = List.toArray strands
        if i >= 0 && i + 1 < a.Length then
            let x, y = a.[i], a.[i + 1]
            if c > 0 then
                a.[i] <- Braid.mul (Braid.mul x y) (Braid.inv x)      // R:   x·y·x⁻¹
                a.[i + 1] <- x                                        //      x
            else
                a.[i] <- y                                            // R⁻¹: y
                a.[i + 1] <- Braid.mul (Braid.mul (Braid.inv y) x) y  //      y⁻¹·x·y
        List.ofArray a

    /// **`Hom` — the type of a ⟨V⟩ morphism. Copy `Δ` and discard `ε` are UNREPRESENTABLE here, and
    /// that is the guard** (work-item 081KZZVC6SE087G0R001SXE8BV; rung 1 of the externalization ladder).
    ///
    /// A ⟨V⟩ hom is a **braid word, not a function**. There is no constructor anywhere in this module
    /// that turns a `V list -> V list` into a `Hom` — the case is `private`, so the *only* inhabitants
    /// are the ones `Hom`'s generators build out of `σᵢ^±1`. (Checked in the emitted IL, not assumed:
    /// the type is `NestedPublic` but `NewBraidHom` / `.ctor` / `get_Item` / `get_Tag` are all
    /// `Assembly`-scoped, so the guard holds for C# and every other consumer of `Zeta.Core.dll`, not
    /// only for F#. An external attempt to write `MenoBraided.BraidHom [1]` is `error FS1093`.)
    /// Every letter's interpretation
    /// (`crossingOnList c`) is invertible with inverse `crossingOnList (-c)` — in range because R and
    /// R⁻¹ are mutually inverse, out of range because both are the identity — so `Hom.inverse` is
    /// **TOTAL**, `Hom` is a *group*, and every `Hom` interprets to a basis bijection.
    ///
    /// That is what keeps ⟨V⟩ non-cartesian, and it is load-bearing: a cartesian monoidal category has a
    /// **unique braiding** (the swap), so if `Δ : V → V⊗V` or `ε : V → I` ever entered ⟨V⟩, `braidR`
    /// would be forced to the swap and the machine-checked `braidR_not_symmetric_perm3` would be false.
    /// `Δ` is not surjective on basis and `ε` is not injective, so neither can be a `Hom` — and by Fox
    /// 1976 (cartesian ⟺ natural comonoid) ⟨V⟩ carries no comonoid and stays genuinely braided.
    ///
    /// **`toArrow` is a one-way door.** It interprets a ⟨V⟩ hom into the *ambient* category, where `Δ`
    /// and `ε` do exist and are perfectly legitimate (Meno is a CD category — `Meno.fs:38`). There is no
    /// way back: an arbitrary `Meno.Arrow` cannot be re-typed as a `Hom`. Anything in ⟨V⟩ must therefore
    /// be *built* here, from these generators, never lifted in from a hand-written function.
    ///
    /// Falsifier: `tests/Tests.FSharp/Formal/MenoBraidedBasisBijection.Tests.fs` — exhaustive basis
    /// bijection check plus five negative controls (Δ, ε, the length-preserving copy Δ∘ε, a ℤ-linear
    /// sign flip, a weight doubling) that the checker must REJECT.
    type Hom = private BraidHom of int list

    /// The generators of ⟨V⟩'s hom-sets. These, and nothing else, build a `Hom`.
    [<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
    module Hom =

        /// The identity braid (the empty word) — `id_{V^n}` for every n.
        let identity : Hom = BraidHom []

        /// σᵢ — the positive crossing of strands i and i+1 (0-based). Out-of-range i is the identity.
        let sigma (i: int) : Hom = BraidHom [ i + 1 ]

        /// σᵢ⁻¹ — the negative crossing of strands i and i+1 (0-based).
        let sigmaInv (i: int) : Hom = BraidHom [ -(i + 1) ]

        /// A braid word as a ⟨V⟩ hom. The sign-carrying, 1-based convention `Braid.act` already uses:
        /// `+k` is σ_{k−1}, `−k` is σ_{k−1}⁻¹. Every `int list` names a braid, so this is total — and it
        /// is still not an escape hatch: the argument is a *word*, never a function.
        let ofWord (braid: int list) : Hom = BraidHom braid

        /// Composition in ⟨V⟩ — `compose a b` is "a, then b" (diagrammatic order, matching `rep`'s
        /// left-to-right fold). Word concatenation; closed on `Hom` by construction.
        let compose (a: Hom) (b: Hom) : Hom =
            let (BraidHom wa), (BraidHom wb) = a, b
            BraidHom(wa @ wb)

        /// **The bijection witness, and it is TOTAL** — every `Hom` has a two-sided inverse, because
        /// every letter does. Reverse the word and negate each crossing. This is why `Δ`/`ε` cannot be
        /// `Hom`s: neither has an inverse, and a type whose every inhabitant is invertible has no room
        /// for them. (Mutating this — dropping the `List.rev` or the negation — is what the test's
        /// mutation matrix kills.)
        let inverse (h: Hom) : Hom =
            let (BraidHom w) = h
            BraidHom(w |> List.rev |> List.map (fun c -> -c))

        /// `id_{V^k} ⊗ h` — shift every crossing k strands to the right (juxtaposition on the left).
        let shift (k: int) (h: Hom) : Hom =
            let (BraidHom w) = h
            BraidHom(w |> List.map (fun c -> if c > 0 then c + k else c - k))

        /// Observe the underlying braid word — the *only* projection out, and it is data, not authority.
        let word (h: Hom) : int list =
            let (BraidHom w) = h
            w

        /// The interpretation functor ⟨V⟩ ↪ Meno: ρ(h) : V^⊗n → V^⊗n, with V^⊗n modeled as a `V list`
        /// of length n. ρ(σᵢ) = R at position i; a braid word composes its crossings left-to-right.
        /// One-way — see the `Hom` doc.
        let toArrow (h: Hom) : Meno.Arrow<V list, V list> =
            let (BraidHom w) = h
            Meno.arr (fun strands -> w |> List.fold (fun s c -> crossingOnList c s) strands)

    /// The n-strand braiding representation ρ : Bₙ → Aut(V^⊗n), as a ⟨V⟩-typed hom. Because R IS Braid's
    /// crossing, ρ realizes Bₙ FAITHFULLY (`ρ-equal ⟺ Braid.equal`, P5c), satisfies the Yang–Baxter /
    /// Artin relation (P5a), far strands commute (P5b), and σ²≠id (P4). This is the "⟨V⟩ realizes Bₙ" claim.
    let repHom (braid: int list) : Hom = Hom.ofWord braid

    /// ρ interpreted into the ambient category — the arrow form, unchanged for callers.
    ///
    /// **Do NOT add a copy `Δ` or a discard `ε` beside this.** They are not merely unwanted here, they
    /// are inconsistent with the braiding: a cartesian monoidal category has a *unique* braiding (the
    /// swap), so admitting a natural comonoid into ⟨V⟩ (Fox 1976) would force `braidR` to be the swap
    /// and refute the machine-checked `braidR_not_symmetric_perm3`. The structural reason no such arrow
    /// can be in ⟨V⟩ is that every ⟨V⟩ hom is a **basis bijection**, and neither `Δ : V → V⊗V`
    /// (not surjective on basis) nor `ε : V → I` (not injective) is one. `rep` goes through `Hom`
    /// precisely so that route is the only route — see the `Hom` type above, and its falsifier
    /// `tests/Tests.FSharp/Formal/MenoBraidedBasisBijection.Tests.fs`.
    let rep (braid: int list) : Meno.Arrow<V list, V list> = braid |> Hom.ofWord |> Hom.toArrow
