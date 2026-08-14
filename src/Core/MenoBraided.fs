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
/// Naturality reduces to centrality in Bₙ because `Hom_{⟨V⟩}(V^n, V^n) = ρ(Bₙ)` and ρ is faithful;
/// `Z(Bₙ) = ⟨Δ²⟩` for n ≥ 3 (Chow 1948). CHECKED for all m+n ≤ 7 by two independent implementations of
/// Artin's action (the shipped `Braid.equal` plus an independent re-implementation), with four planted
/// mutants — θ=id, θ=Δ, θ=Δ⁴, and a single block-swap — all REJECTED, so the check is not vacuous.
/// General-n Lean certificate: work-item 081KZZVC3DD087G0R0035SZN58.
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
/// **What is NOT here yet (deferred, per spec):** the associator α + unitors (ZSet tuples are non-strict,
/// so the two hexagons can't even be *stated* without α — the sleeper prerequisite), the full FsCheck
/// hexagon suite, and the Lean4 abstract R-matrix certificate. This increment lands the genuine braiding
/// itself + its two earned tripwires (σ²≠id, realizes-Braid-σ). Work-item 081KYWEM90908QG0R002NHEMZE.
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

    /// The n-strand braiding representation ρ : Bₙ → Aut(V^⊗n), with V^⊗n modeled as a `V list` of length
    /// n. ρ(σᵢ) = R at position i; a braid word composes its crossings left-to-right. Because R IS Braid's
    /// crossing, ρ realizes Bₙ FAITHFULLY (`ρ-equal ⟺ Braid.equal`, P5c), satisfies the Yang–Baxter /
    /// Artin relation (P5a), far strands commute (P5b), and σ²≠id (P4). This is the "⟨V⟩ realizes Bₙ" claim.
    let rep (braid: int list) : Meno.Arrow<V list, V list> =
        Meno.arr (fun strands -> braid |> List.fold (fun s c -> crossingOnList c s) strands)
