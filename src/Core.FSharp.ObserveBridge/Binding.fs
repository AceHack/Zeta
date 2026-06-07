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
