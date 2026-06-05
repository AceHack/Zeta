namespace Zeta.Core

/// **Diplomacy — the polymorphic-diplomacy handshake over yin-yang cells (Aaron's 2026-06-05 ask).**
/// (`docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B-converge; the Eve / multi-traveler protocol,
/// B-1003, NCI-governed.)
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
