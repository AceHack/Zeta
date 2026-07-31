namespace Zeta.Core

/// **`MenoBraided` — the GENUINE (non-symmetric) braiding for Meno: the conjugation-rack Yang–Baxter
/// operator, the ℤ-linear shadow of Braid's Artin action (shadow*, per Soraya's spec 2026-07-31).**
///
/// `Meno.tensor` makes the category SYMMETRIC monoidal (a Cartesian/Kronecker ⊗ is forced-symmetric by a
/// theorem), so `Meno.braid` (the tuple swap) is a *correct symmetric* braiding — σ²=id. It is NOT
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
