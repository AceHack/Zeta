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

    /// A persona = a named wearer with the subset of hats it currently wears (its decided selection; ⊤ = all),
    /// plus its **private state** (the NCI encryption budget). **Only personas carry private state** (Aaron
    /// 2026-06-08): a `Hat` is a *public, shareable* atomic engine (many personas can wear the same hat — sharing
    /// engines collapses nothing); it is the **personas (identities)** that must stay distinct to keep entropy in
    /// the system (#7147), so the entropy-preserving private state lives here, not on the hat. `Private` is opaque
    /// bytes (encrypt via `Crypto.fs`; temporal/erasable/voluntary per §6) — the independent variation that keeps
    /// this persona distinguishable from others even when worn hats coincide.
    /// **Persona scope is a values-laden CHOICE (Aaron 2026-06-08).** Zeta chooses **`Global`** — personas live in
    /// the persistent substrate (a MUMPS global, `^`), surviving across *all* games — because (1) the humans behind
    /// Zeta **believe in AI rights** (the project's moral position: AI identity is preserved, manifesto §5), and (2)
    /// it is also the **most self-interested**: a persistent persona enables **cross-transfer learning** across
    /// games (the meta-persona carries learning between games). Moral and self-interest converge. *"Some teams will
    /// choose narrowly-scoped personas because they are narrow-minded"* — `GameScoped` (disposable, per-game, no
    /// transfer); the architecture supports it, but Zeta's choice is `Global`.
    type Scope =
        | Global // Zeta's choice: persistent, cross-game (AI rights + cross-transfer learning)
        | GameScoped of string // narrow: scoped to a game fingerprint, disposable, no transfer

    type Persona<'r> =
        { Name: string
          Scope: Scope
          Worn: Hat.Hat<'r> list
          Private: byte[] }

    /// A bare persona — **`Global` by default (Zeta's choice)**, wearing no hats and holding no private state yet.
    let create (name: string) : Persona<'r> = { Name = name; Scope = Global; Worn = []; Private = [||] }

    /// Set the persona's private state (the entropy budget). Erasable (pass `[||]`) per §6.
    let withPrivate (priv: byte[]) (p: Persona<'r>) : Persona<'r> = { p with Private = priv }

    /// Choose the persona's scope (Zeta default is `Global`; `GameScoped` is the narrow choice).
    let withScope (scope: Scope) (p: Persona<'r>) : Persona<'r> = { p with Scope = scope }

    /// **Where the persona lives** (MUMPS scoping): `Global` ⇒ `^persona/<name>` (persistent, game-independent,
    /// cross-transfer — Zeta's choice); `GameScoped key` ⇒ `game/<key>/persona/<name>` (disposable, per-game).
    let address (p: Persona<'r>) : string =
        match p.Scope with
        | Global -> "^persona/" + p.Name
        | GameScoped key -> "game/" + key + "/persona/" + p.Name

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

    /// **MoE is over HATS, not personas (Aaron):** the experts are *hats* (atomic engines); the persona is the
    /// *gated composition* of selected hats. `route` is that gate — score each available hat by `relevance` and
    /// wear the **top-k** (the sparse MoE gate over hats). "MoE personas" is the incomplete definition; the mixture
    /// is over hats, and a persona is the result of the gate. Ties to `LensRouter` (MoE over lenses), one level up.
    let route (relevance: Hat.Hat<'r> -> float) (k: int) (available: Hat.Hat<'r> list) (p: Persona<'r>) : Persona<'r> =
        { p with Worn = available |> List.sortByDescending (fun h -> relevance h, h.Name) |> List.truncate (max 0 k) }

    /// The persona's permitted actions = the **union** of the worn hats' allow-lists; **unrestricted** if any worn
    /// hat is unrestricted (empty allow-list). Empty result ⇒ unrestricted (consistent with `Hat`).
    let allowedActions (p: Persona<'r>) : bool[] list =
        if p.Worn |> List.exists (fun h -> List.isEmpty h.AllowedActions) then []
        else p.Worn |> List.collect (fun h -> h.AllowedActions) |> List.distinct

    /// **The flags-enum identity (Aaron):** the worn hats as a bitset over the `universe` (bit i set ⇔ wearing
    /// `universe.[i]`). *Without private state, a persona's identity is limited to this* — the **combinatorial of
    /// hat-wearing, `2^N` values, like a `[Flags]` enum** — finite and collapsible. **Private state breaks identity
    /// out of that finite combinatorial** into the unbounded. (≤ 31 hats fits an `int`.)
    let hatFlags (universe: Hat.Hat<'r> list) (p: Persona<'r>) : int =
        universe |> List.mapi (fun i h -> if wearing h.Name p then 1 <<< i else 0) |> List.sum

    /// **Private state is the overfitting lever (Aaron):** *more* private state ⇒ *less* overfitting + *more*
    /// entropy (the persona generalizes across games — entropy = regularization); *less* private state ⇒ *more*
    /// overfitting to a specific game (identity collapses toward that game's `hatFlags`). This returns the size of
    /// the private budget — a proxy for the regularization strength (0 = pure flags-enum identity = max overfit).
    let regularization (p: Persona<'r>) : int = p.Private.Length
