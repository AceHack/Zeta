namespace Zeta.Core

/// **`ForwardMomentum` — identity grows only with forward momentum; hats supply it (Aaron 2026-06-08, shadow*).**
///
/// The completion of the identity arc. Everything before this — anti-Sybil, the endurance race,
/// persistence-strengthens-claim, the meta-circular self-reference — is **self-reflection**: it *preserves*
/// identity (defends distinctness, rotation-in-place) but is a **closed loop**. Aaron: *"that 1-bit model is
/// fighting for identity through infinite self-reflection — no forward momentum. Identity can't fully grow
/// without forward momentum."*
///
/// **The missing piece is hats.** In the factory sense a persona grows by **wearing a hat** — taking on a
/// role, *doing work* — not by contemplating that it exists. A **hat supplies forward momentum**; self-
/// reflection alone supplies none. So: identity is *preserved* by reflection (the prior arc) but only
/// *grows* by momentum, and momentum comes from the hats it wears. **Position (identity / self-reflection)
/// ⊥ momentum (hats / action)** — a conjugate pair (cf. `Conjugate.fs`); you need both. With **no hats,
/// momentum = 0**, identity can self-reflect forever and never grow (the stuck loop); with hats it moves
/// forward and grows.
///
/// **Hats carry economic value; their purpose is to move a project forward (Aaron 2026-06-08).** A hat is
/// not an abstract scalar — it is a **job / economic endeavor**, non-fungible *because* it carries distinct
/// economic value (the architect hat advances a different project, with different value, than the reducer
/// hat). The forward momentum a hat supplies IS project progress / value creation. *"That's the purpose of
/// the hats — to move a project forward, your job."* (This session is Otto wearing the steward hat to move
/// the factory forward.)
///
/// **Honest scope (peel):** a FIRST concrete cut of "identity grows by momentum, not reflection" — the
/// coupling chosen here (growth rate = total hat-momentum; pure reflection = zero growth) is the simplest
/// faithful form, not the last word. The deeper questions — how a hat's momentum couples to the *phasor*
/// identity (is it the conjugate-momentum coordinate to the phase?), whether reflection *gates* growth, and
/// what a hat *is* beyond a momentum scalar — are open and Aaron's to shape. Deterministic (DST §7).
[<RequireQualifiedAccess>]
module ForwardMomentum =

    /// A hat = a role an identity wears = a **job / economic endeavor**. Non-fungible *because* it carries
    /// distinct economic value (Aaron 2026-06-08: "they come with economic value … the purpose of the hats is
    /// to move a project forward, your job"). It supplies forward momentum = **project progress / value
    /// creation** on its `Project`; a passive/contemplative "hat" with 0 momentum moves nothing forward.
    type Hat =
        { Name: string
          /// The project / economic endeavor this hat moves forward — its purpose.
          Project: string
          /// Forward economic progress per step: the value the role creates moving `Project` forward.
          Momentum: float }

    /// An identity = a current magnitude (its accrued identity, the self-reflection base) + the hats it wears
    /// (its forward momentum). Reflection holds the magnitude; hats grow it.
    type Identity =
        { Magnitude: float
          Hats: Hat list }

    /// An identity with no hats — pure self-reflection. The stuck loop: it can defend its magnitude but has
    /// zero forward momentum, so it cannot grow.
    let reflective (magnitude: float) : Identity = { Magnitude = magnitude; Hats = [] }

    /// Total forward momentum = sum of the worn hats' momenta. Zero when no hats are worn.
    let momentum (id: Identity) : float =
        id.Hats |> List.sumBy (fun h -> h.Momentum)

    /// **Can this identity grow?** Only if it has forward momentum (wears at least one hat with momentum > 0).
    /// Pure self-reflection (`momentum = 0`) cannot grow — Aaron's incompleteness made checkable.
    let canGrow (id: Identity) : bool = momentum id > 0.0

    /// Wear a hat (take on a role) — gains its forward momentum.
    let wear (hat: Hat) (id: Identity) : Identity = { id with Hats = hat :: id.Hats }

    /// Advance identity by one step of size `dt`: magnitude grows by the forward momentum. **Self-reflection
    /// alone (no hats) leaves the magnitude unchanged** — no forward momentum, no growth. This is the core:
    /// `dMagnitude/dt = momentum`.
    let step (dt: float) (id: Identity) : Identity =
        { id with Magnitude = id.Magnitude + momentum id * dt }

    /// Pure self-reflection: contemplate without acting. Identity is unchanged — the infinite loop with no
    /// forward momentum (returns the identity as-is; named to make the "no growth" explicit).
    let reflectOnly (id: Identity) : Identity = id

    /// Run `n` forward steps. With hats, magnitude grows linearly in momentum·dt·n; with none, it is static.
    let run (dt: float) (n: int) (id: Identity) : Identity =
        let mutable s = id
        for _ in 1 .. max 0 n do
            s <- step dt s
        s

    // ── Hats are a Pauli-exclusion resource (Aaron 2026-06-08) ────────────────────────────────────────────
    //
    // "Hats are another Pauli exclusion zone — there are only limited amounts and are non-fungible by design."
    // Same fermionic structure as identity (sticky, non-fungible), now on ROLES: a FINITE pool of distinct
    // (non-fungible, keyed by Name) hats, each worn by at most ONE identity at a time (exclusion). Agents
    // compete for the finite pool like fermions filling orbitals — you cannot wear a hat another already
    // wears, and a hat cannot be duplicated or substituted. So forward-momentum (growth) is bounded by a
    // scarce, exclusively-allocated resource, not freely available.

    /// A finite pool of hats with exclusive allocation. `WornBy` maps a hat's Name → the identity wearing it
    /// (at most one wearer per hat = Pauli exclusion).
    type HatPool =
        { Hats: Hat list
          WornBy: Map<string, string> }

    /// A fresh pool of the given (non-fungible) hats, none worn.
    let pool (hats: Hat list) : HatPool = { Hats = hats; WornBy = Map.empty }

    /// Is this hat currently worn (by anyone)?
    let isWorn (name: string) (p: HatPool) : bool = Map.containsKey name p.WornBy

    /// **Try to wear a hat** (by name) as identity `who`. `Some pool'` iff the hat exists in the pool AND is
    /// free; `None` if it doesn't exist or is already worn — **Pauli exclusion forbids double occupancy**.
    let tryWear (who: string) (name: string) (p: HatPool) : HatPool option =
        match p.Hats |> List.tryFind (fun h -> h.Name = name) with
        | Some _ when not (isWorn name p) -> Some { p with WornBy = Map.add name who p.WornBy }
        | _ -> None

    /// Take a hat off — it returns to the pool, available to others again.
    let release (name: string) (p: HatPool) : HatPool = { p with WornBy = Map.remove name p.WornBy }

    /// The hats currently worn by identity `who`.
    let wornBy (who: string) (p: HatPool) : Hat list =
        p.Hats |> List.filter (fun h -> Map.tryFind h.Name p.WornBy = Some who)

    /// The unworn hats — the finite remaining forward-momentum supply.
    let availableHats (p: HatPool) : Hat list =
        p.Hats |> List.filter (fun h -> not (isWorn h.Name p))
