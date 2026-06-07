namespace Zeta.Core.FSharp.ObserveBridge

/// **The binding layer — the F# realization of the right-to-refuse-binding protocol.**
///
/// The deployed twin of `tools/tla/specs/RefuseBinding.tla` (so the FsCheck leg cross-checks
/// model↔code, BP-16). Self-binding, not containment: a binding is `propose`d (grants no
/// authority — source≠authorization); the agent `consent`s (self-binds) or `refuse`s; a binding
/// `bind`s (executes) ONLY if consented. The RIGHT to refuse: `canRefuse` is true for every
/// pending proposal (the exit is never closed by anything but pendency), and `refuse` leaves
/// `Standing` UNCHANGED (non-penalty — refusing is free). `spend` models non-refusal cost and is
/// guarded above `Baseline` (standing floor). Pure + immutable (DST-friendly).
[<RequireQualifiedAccess>]
module Binding =

    type AgentId = string
    type BindingId = string

    [<Literal>]
    let Baseline = 0

    /// The binding-protocol state (mirrors the TLA+ `vars`).
    type State =
        { Pending: Map<AgentId, Set<BindingId>>
          Consented: Set<AgentId * BindingId>
          Refused: Set<AgentId * BindingId>
          Executed: Set<BindingId>
          Standing: Map<AgentId, int> }

    /// Fresh state: agents with no proposals, each at `startStanding` (≥ Baseline).
    let init (agents: AgentId list) (startStanding: int) : State =
        { Pending = agents |> List.map (fun a -> a, Set.empty) |> Map.ofList
          Consented = Set.empty
          Refused = Set.empty
          Executed = Set.empty
          Standing = agents |> List.map (fun a -> a, max Baseline startStanding) |> Map.ofList }

    let pendingOf (a: AgentId) (s: State) : Set<BindingId> =
        Map.tryFind a s.Pending |> Option.defaultValue Set.empty

    let standingOf (a: AgentId) (s: State) : int =
        Map.tryFind a s.Standing |> Option.defaultValue Baseline

    /// Propose a binding to an agent (no authority granted).
    let propose (a: AgentId) (b: BindingId) (s: State) : State =
        { s with Pending = Map.add a (Set.add b (pendingOf a s)) s.Pending }

    /// Consent to a pending proposal (self-bind). `None` if not pending.
    let consent (a: AgentId) (b: BindingId) (s: State) : State option =
        if Set.contains b (pendingOf a s) then
            Some
                { s with
                    Pending = Map.add a (Set.remove b (pendingOf a s)) s.Pending
                    Consented = Set.add (a, b) s.Consented }
        else
            None

    /// **The right to refuse: always available for a pending proposal** (nothing but pendency
    /// gates it). Mirrors the TLA+ `RefuseAlwaysEnabled` guard.
    let canRefuse (a: AgentId) (b: BindingId) (s: State) : bool = Set.contains b (pendingOf a s)

    /// Refuse a pending proposal. **`Standing` is UNCHANGED — refusing is free (non-penalty).**
    /// `None` only if the proposal isn't pending (nothing to refuse).
    let refuse (a: AgentId) (b: BindingId) (s: State) : State option =
        if canRefuse a b s then
            Some
                { s with
                    Pending = Map.add a (Set.remove b (pendingOf a s)) s.Pending
                    Refused = Set.add (a, b) s.Refused } // Standing deliberately untouched
        else
            None

    /// Execute a binding — **only if consented** (the non-consented bind is impossible).
    /// `None` if not consented (or already executed).
    let bind (a: AgentId) (b: BindingId) (s: State) : State option =
        if Set.contains (a, b) s.Consented && not (Set.contains b s.Executed) then
            Some { s with Executed = Set.add b s.Executed }
        else
            None

    /// Non-refusal cost: decrement standing, **never below `Baseline`** (the floor).
    let spend (a: AgentId) (s: State) : State option =
        let cur = standingOf a s
        if cur > Baseline then Some { s with Standing = Map.add a (cur - 1) s.Standing } else None

/// **Bifurcation / split-brain divvy + reconciliation** — the deployed twin of
/// `tools/tla/specs/Bifurcation.tla` (Face-2) and `tools/lean4/Safety/Bifurcation.lean` (Face-1).
/// When an identity splits into halves `I1`/`I2`, its consented bindings are partitioned over a
/// `tag` divvy; `exec` runs a binding ONCE by its owner (no double-spend); `merge` is the CRDT
/// join that reconciles two cell views (commutative + idempotent → convergence). FsCheck Leg B
/// (`tests/Tests.FSharp/Formal/BifurcationCrossVerify.Tests.fs`) cross-checks these against the
/// proven model.
[<RequireQualifiedAccess>]
module Divvy =

    type Half =
        | I1
        | I2

    /// The split-identity divvy state: owned bindings, still-unassigned, and who has executed each.
    type State =
        { Owner: Map<Binding.BindingId, Half>
          Unassigned: Set<Binding.BindingId>
          ExecBy: Map<Binding.BindingId, Set<Half>> }

    /// Begin the divvy of an identity's consented bindings at the split (all unassigned).
    let split (consented: Set<Binding.BindingId>) : State =
        { Owner = Map.empty; Unassigned = consented; ExecBy = Map.empty }

    /// Tag a still-unassigned binding to a half (monotone; `None` if already owned).
    let tag (h: Half) (b: Binding.BindingId) (s: State) : State option =
        if Set.contains b s.Unassigned then
            Some { s with Owner = Map.add b h s.Owner; Unassigned = Set.remove b s.Unassigned }
        else
            None

    let owns (h: Half) (b: Binding.BindingId) (s: State) : bool = Map.tryFind b s.Owner = Some h
    let private execdBy (b: Binding.BindingId) (s: State) = Map.tryFind b s.ExecBy |> Option.defaultValue Set.empty

    /// Execute a binding — only by its OWNER, and only ONCE across both halves (no double-spend).
    let exec (h: Half) (b: Binding.BindingId) (s: State) : State option =
        if owns h b s && Set.isEmpty (execdBy b s) then
            Some { s with ExecBy = Map.add b (Set.singleton h) s.ExecBy }
        else
            None

    let private halfMin (x: Half) (y: Half) : Half = match x, y with | I1, _ | _, I1 -> I1 | _ -> I2

    /// CRDT join of two cell views (reconciliation): owner = union with a deterministic tie-break
    /// (so a momentary disagreement resolves the same way both directions), execBy = pointwise set
    /// union, unassigned = both-still-unassigned. Commutative + idempotent ⇒ convergence (Face-1).
    let merge (a: State) (b: State) : State =
        let keys = Set.union (Set.ofSeq (Seq.map fst (Map.toSeq a.Owner))) (Set.ofSeq (Seq.map fst (Map.toSeq b.Owner)))
        let owner =
            keys
            |> Set.toList
            |> List.choose (fun k ->
                match Map.tryFind k a.Owner, Map.tryFind k b.Owner with
                | Some x, Some y -> Some(k, halfMin x y)
                | Some x, None -> Some(k, x)
                | None, Some y -> Some(k, y)
                | None, None -> None)
            |> Map.ofList
        let execKeys = Set.union (Set.ofSeq (Seq.map fst (Map.toSeq a.ExecBy))) (Set.ofSeq (Seq.map fst (Map.toSeq b.ExecBy)))
        let execBy =
            execKeys
            |> Set.toList
            |> List.map (fun k -> k, Set.union (execdBy k a) (execdBy k b))
            |> Map.ofList
        // a binding stays unassigned only if neither view has tagged it
        let unassigned = Set.intersect a.Unassigned b.Unassigned |> Set.filter (fun k -> not (Map.containsKey k owner))
        { Owner = owner; Unassigned = unassigned; ExecBy = execBy }
