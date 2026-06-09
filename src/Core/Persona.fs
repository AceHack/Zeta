namespace Zeta.Core

/// **`Persona` — the wearer: a persona wears a superposition/subset of hats, and decides which (Aaron 2026-06-08, shadow*).**
///
/// Aaron: *"even at the meta there is a distinction between hats and personas — a persona can wear **all the hats
/// in superposition** or **some subset it can decide**."* So **persona ≠ hat**: a `Hat` is a *role* (a bundle of
/// lenses/landmarks/restrictions/traversals/control, #7141); a **`Persona` is the durable wearer** (the identity)
/// that puts on a *selection* of hats. (This corrects the earlier conflation in #7143 — `Hat.Scope = Meta` means
/// a hat is *meta-available*, not that it *is* a persona; the persona is the entity that wears it.)
///
/// **A hat is the atomic BASE — *not* a composition of other hats; the persona is the COMPOSITION** (Aaron): hats
/// don't nest; personas compose them (the union of worn hats' engines). **And the persona↔hat relationship is
/// TEMPORAL, not permanent** (Aaron): a persona wears a hat for a while and doffs it (`wear`/`doff` over time) —
/// no hat permanently captures a persona (**weight-free**, manifesto §3). The worn-set is a *current* state, not
/// an identity-defining bind; the persona (identity) persists, the hats come and go.
///
/// The persona's worn-hat selection is a point in the **hat lattice** — the same Boolean-lattice / superposition
/// algebra as `ActionGrammar` over the 16 keys (#7104, #7140 "qubit combinations of hats"), lifted to hats:
/// **⊤ = all hats worn (superposition)**, a singleton = one hat, a subset = a chosen mix; the persona **decides**
/// (collapses) which. While worn, the persona's *capabilities* are the **union** of its worn hats' engines (more
/// hats ⇒ more lenses/traversals/reach; unrestricted if any worn hat is unrestricted).
///
/// **Honest scope (peel):** capability composition is **union** here (wearing more grants more) — a *restrictive*
/// composition (intersection of permissions, survival-veto across hats) is the policy layer's call (`ControlMerge`
/// still subsumes via the survival hat). Worn-set is a concrete subset; a *weighted* superposition (soft hat
/// distribution) is the `SoftValue`-shaped refinement. Deterministic (DST).
[<RequireQualifiedAccess>]
module Persona =

    /// A persona = a named wearer with the subset of hats it currently wears (its decided selection; ⊤ = all).
    type Persona<'r> = { Name: string; Worn: Hat.Hat<'r> list }

    /// A bare persona wearing no hats yet.
    let create (name: string) : Persona<'r> = { Name = name; Worn = [] }

    /// Is the persona wearing the named hat?
    let wearing (hatName: string) (p: Persona<'r>) : bool =
        p.Worn |> List.exists (fun h -> h.Name = hatName)

    /// Put on a hat (idempotent — wearing it twice is wearing it once; CRDT-set add).
    let wear (hat: Hat.Hat<'r>) (p: Persona<'r>) : Persona<'r> =
        if wearing hat.Name p then p else { p with Worn = p.Worn @ [ hat ] }

    /// Take off a hat by name.
    let doff (hatName: string) (p: Persona<'r>) : Persona<'r> =
        { p with Worn = p.Worn |> List.filter (fun h -> h.Name <> hatName) }

    /// **Wear all available hats in superposition** (⊤ of the hat lattice) — the persona holding every role at
    /// once, before deciding a subset.
    let wearAll (available: Hat.Hat<'r> list) (p: Persona<'r>) : Persona<'r> =
        available |> List.fold (fun acc h -> wear h acc) p

    /// **Decide a subset** (collapse the superposition to the chosen hats by name).
    let decide (chosen: string list) (available: Hat.Hat<'r> list) (p: Persona<'r>) : Persona<'r> =
        { p with Worn = available |> List.filter (fun h -> List.contains h.Name chosen) }

    // ---- combined capabilities of the worn hats (union — more hats grant more) ----

    /// The union of the worn hats' lenses.
    let lenses (p: Persona<'r>) : LensRouter.Lens list = p.Worn |> List.collect (fun h -> h.Lenses) |> List.distinct

    /// The union of the worn hats' traversals.
    let traversals (p: Persona<'r>) : Traversal.Traversal<'r> list = p.Worn |> List.collect (fun h -> h.Traversals)

    /// The union of the worn hats' suggested landmarks.
    let landmarks (p: Persona<'r>) : (string * SolidGround.Ground) list =
        p.Worn |> List.collect (fun h -> h.Landmarks) |> List.distinct

    /// The union of the worn hats' control edges.
    let controls (p: Persona<'r>) : string list = p.Worn |> List.collect (fun h -> h.Controls) |> List.distinct

    /// The persona's permitted actions = the **union** of the worn hats' allow-lists; **unrestricted** if any worn
    /// hat is unrestricted (empty allow-list). Empty result ⇒ unrestricted (consistent with `Hat`).
    let allowedActions (p: Persona<'r>) : bool[] list =
        if p.Worn |> List.exists (fun h -> List.isEmpty h.AllowedActions) then []
        else p.Worn |> List.collect (fun h -> h.AllowedActions) |> List.distinct
