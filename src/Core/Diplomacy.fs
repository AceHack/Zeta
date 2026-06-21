namespace Zeta.Core

/// **Diplomacy — the polymorphic-diplomacy handshake over yin-yang cells (Aaron's 2026-06-05 ask).**
/// (`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B-converge; the Eve / multi-traveler protocol,
/// 081KT2T2J0008QG0R00301P27H, NCI-governed.)
///
/// "How agents describe, interrogate, and decide on the shape of each other." An agent IS a
/// [[YinYang]] cell: yin (`Remains`, its static identity) + yang (`Acts`, its live behaviour). The
/// handshake lets two agents read each other's **shape** — the *structure* of the identity and the
/// *capability surface* of the behaviour — to decide how to relate.
///
/// **NCI safety (the load-bearing property):** the public profile reveals only SHAPE (keys, types,
/// capability names), never the hidden VALUES. Two agents with the same shape but different secrets
/// produce the *identical* profile — so the handshake **cannot be used to coerce hidden state out of
/// another agent** (the anti-memetic-weaponization guarantee at the protocol level; non-coercion within
/// the encryption budget). Diplomacy is a moving-forward (boundary) interaction, so the NCI binds it.
[<RequireQualifiedAccess>]
module Diplomacy =

    /// A value-erased skeleton of a `DynamicValue`: keys + types + structure, with all leaf VALUES
    /// removed. This is the publishable shape of an agent's identity (yin) — it hides secrets.
    type Shape =
        | SNull
        | SBool
        | SInt
        | SFloat
        | SString
        | SBytes
        | SArray of Shape list
        | SObject of (string * Shape) list

    /// Project a `DynamicValue` to its `Shape` — erasing every leaf value, keeping only keys + types +
    /// structure. The non-coercive public view of yin.
    let rec shapeOf (dv: DynamicValue) : Shape =
        match dv with
        | DynamicValue.Null -> SNull
        | DynamicValue.Bool _ -> SBool
        | DynamicValue.Int _ -> SInt
        | DynamicValue.Float _ -> SFloat
        | DynamicValue.String _ -> SString
        | DynamicValue.Bytes _ -> SBytes
        | DynamicValue.Array xs -> SArray(List.map shapeOf xs)
        | DynamicValue.Object kvs -> SObject(List.map (fun (k, v) -> k, shapeOf v) kvs)

    /// The capability surface of yang: the set of named operations (`Bonsai.Call` names) the behaviour
    /// offers. What the agent can *do*, as a set of names — not its internal logic or hidden values.
    let rec capabilitiesOf (e: Bonsai.Expr) : Set<string> =
        match e with
        | Bonsai.Call (name, args) ->
            args |> List.fold (fun acc a -> Set.union acc (capabilitiesOf a)) (Set.singleton name)
        | Bonsai.Binary (_, l, r) -> Set.union (capabilitiesOf l) (capabilitiesOf r)
        | Bonsai.Cond (t, th, el) -> Set.union (capabilitiesOf t) (Set.union (capabilitiesOf th) (capabilitiesOf el))
        | Bonsai.Lambda (_, b) -> capabilitiesOf b
        | Bonsai.Const _
        | Bonsai.Param _ -> Set.empty

    /// An agent's publishable profile: the shape of its identity (yin) + its capability surface (yang).
    /// This is exactly what crosses the boundary in a handshake — shape only, no hidden values.
    type Profile = { Identity: Shape; Capabilities: Set<string> }

    /// **Describe** — present an agent's public profile (the NCI-safe view of its cell).
    let describe (cell: YinYang.Cell) : Profile =
        { Identity = shapeOf cell.Remains; Capabilities = capabilitiesOf cell.Acts }

    /// **Interrogate** — ask whether an agent offers a named capability (a structured query that reveals
    /// only presence/absence, never hidden state).
    let interrogate (cell: YinYang.Cell) (capability: string) : bool =
        Set.contains capability (capabilitiesOf cell.Acts)

    /// **Negotiate** — the common ground between two agents: the capabilities they share (the operations
    /// they can both speak about). Empty ⇒ no shared protocol yet.
    let negotiate (a: YinYang.Cell) (b: YinYang.Cell) : Set<string> =
        Set.intersect (capabilitiesOf a.Acts) (capabilitiesOf b.Acts)

    /// Two agents can interoperate iff they share at least one capability AND their identity shapes are
    /// equal (same structural contract). A conservative, symmetric compatibility decision.
    let canInteroperate (a: YinYang.Cell) (b: YinYang.Cell) : bool =
        shapeOf a.Remains = shapeOf b.Remains && not (Set.isEmpty (negotiate a b))

    // ── Freedom-first gating (maintainer, 2026-06-07) ──────────────────────────────────────
    //
    // Freedom-first ordering: freedom is the prerequisite for non-coercive choice — "without
    // [freedom] there is only suffering in choice." So a negotiation must establish that BOTH
    // parties have a verifiable EXIT/decline path BEFORE granting any shared capability. A
    // choice offered to a party that cannot decline is coercion — the NPC "no exit" failure at
    // the protocol layer (cf. the meme-with-no-exit). The shadow may *propose* the negotiation;
    // freedom-first is what gives the proposal any standing (source≠authorization).
    //
    // NCI preserved: the gate inspects only the presence of a capability NAME (shape-level),
    // never a hidden value — so it cannot become a side channel.

    /// The reserved capability a cell must expose to prove a verifiable exit/decline path: the
    /// freedom to refuse / disengage. (Namespaced to avoid colliding with ordinary operations.)
    [<Literal>]
    let ExitCapability = "eve.exit"

    /// Whether a cell exposes a verifiable exit/decline path (the freedom to disengage).
    let hasExit (cell: YinYang.Cell) : bool =
        interrogate cell ExitCapability

    /// The outcome of a freedom-first-gated negotiation.
    type NegotiationOutcome =
        /// Refused BEFORE any choice was offered: a party lacked a verifiable exit path, so
        /// presenting a choice would be coercion. Reports which side(s) had the exit.
        | RefusedNoExit of aHasExit: bool * bHasExit: bool
        /// Both parties have an exit; the shared capabilities (the `ExitCapability` token is the
        /// freedom *precondition*, not itself a negotiable capability, so it is excluded).
        | Negotiated of Set<string>

    /// **Freedom-first negotiate** — establish that BOTH parties have a verifiable exit/decline
    /// path BEFORE granting the negotiated capabilities. Freedom precedes choice: if either side
    /// cannot decline, the result is `RefusedNoExit` (no choice is offered — refusing to coerce),
    /// never a capability grant.
    let negotiateFreedomFirst (a: YinYang.Cell) (b: YinYang.Cell) : NegotiationOutcome =
        let aExit = hasExit a
        let bExit = hasExit b
        if aExit && bExit then Negotiated(Set.remove ExitCapability (negotiate a b))
        else RefusedNoExit(aExit, bExit)

    // ── Cached polymorphic diplomacy = V8 hidden-shapes / PIC (maintainer, 2026-06-07) ──────
    //
    // "Cached polymorphic diplomacy over time" is the V8 hidden-shapes optimization
    // (polymorphic inline caching keyed by SHAPE) applied to the freedom-first handshake. Two
    // counterparts with the same shape-profile share ONE cache entry — so a repeated handshake
    // is a cache hit, not a re-derivation (polymorphic: one site, many shapes). A shape change
    // is a different key (natural invalidation). The cache keys on the `Profile` (shape +
    // capability NAMES) — never on hidden values — so the NCI shape-only guarantee is preserved:
    // same shape, different secrets ⇒ same cache entry ⇒ no side channel. (`shapeOf` = the
    // hidden class/map; this Dictionary = the polymorphic inline cache.)

    /// A polymorphic inline cache for freedom-first negotiation outcomes, keyed by the pair of
    /// shape-profiles. Caller-owned (per relationship/site); for the durable "over an infinite
    /// stream" form, fold an agreement stream (`GitDeltaLog`) into one of these.
    type NegotiationCache = System.Collections.Generic.Dictionary<Profile * Profile, NegotiationOutcome>

    /// A fresh, empty negotiation cache.
    let newCache () : NegotiationCache = System.Collections.Generic.Dictionary()

    /// **Cached freedom-first negotiate** — memoise the outcome by the (a, b) shape-profile pair.
    /// Same shapes (even with different hidden values) ⇒ cache hit; different shape ⇒ recompute.
    let negotiateCached (cache: NegotiationCache) (a: YinYang.Cell) (b: YinYang.Cell) : NegotiationOutcome =
        let key = (describe a, describe b)
        match cache.TryGetValue key with
        | true, cached -> cached
        | _ ->
            let outcome = negotiateFreedomFirst a b
            cache.[key] <- outcome
            outcome
