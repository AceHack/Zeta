namespace Zeta.Bayesian

/// # The factor graph (081KT2T2J0008QG0R000S7GHQ8 slice 3)
///
/// A **factor graph** is the bipartite structure inference runs on:
/// *variable* nodes hold marginals, *factor* nodes connect variables and
/// compute the messages they send to each neighbor. This slice is the
/// **data structure + topology + the single sum-product round**
/// (`passOnce`); the iterate-to-fixed-point *schedule* (on the DBSP
/// `NestedCircuit.Fixedpoint`) is slice 4.
///
/// It is generic over the message family `'M` (slice 2: Gaussian / Beta /
/// Bernoulli / …) via the `IMessage<'M>` algebra — `product` is the
/// combine, `uniform` the identity. The two sum-product rules:
///
///   - **variable → factor** message = product of the factor→var messages
///     from every *other* incident factor (a variable passes on the
///     consensus of its other evidence).
///   - **factor → variable** message = the factor's local rule applied to
///     the incoming variable→factor messages (`Factor.ComputeMessages`).
///
/// Marginal at a variable = product of *all* incoming factor→var
/// messages. Spec: Kschischang–Frey–Loeliger 2001 (sum-product).
///
/// Variable and factor identifiers are plain `int` indices (kept simple
/// for this slice; a typed-DU / typed-factor form arrives with the model
/// compiler later).

/// A factor: the variables it connects, and how it computes the message
/// it sends to each neighbor from the messages arriving from the others.
/// `ComputeMessages incoming` maps (variable id → incoming var→factor
/// message) to (variable id → outgoing factor→var message).
type Factor<'M> =
    { /// the variable ids this factor is incident to
      Neighbors: int list
      /// incoming var→factor messages (keyed by variable id) →
      /// outgoing factor→var messages (keyed by variable id)
      ComputeMessages: Map<int, 'M> -> Map<int, 'M> }

[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module Factor =

    /// A prior / observation factor on a single variable: it ignores any
    /// incoming message and always sends the fixed `message` (a leaf of
    /// the graph — the evidence).
    let prior (variable: int) (message: 'M) : Factor<'M> =
        { Neighbors = [ variable ]
          ComputeMessages = fun _ -> Map.ofList [ variable, message ] }

    /// An equality factor (all neighbors are the same variable): each
    /// neighbor receives the **product of the messages from the other
    /// neighbors** — the sum-product rule for the `=` factor. This is how
    /// evidence about one copy propagates to the others.
    let equality (algebra: IMessage<'M>) (neighbors: int list) : Factor<'M> =
        { Neighbors = neighbors
          ComputeMessages =
            fun incoming ->
                neighbors
                |> List.map (fun target ->
                    let toTarget =
                        neighbors
                        |> List.filter (fun n -> n <> target)
                        |> List.choose (fun n -> Map.tryFind n incoming)
                        |> List.fold (fun acc m -> algebra.Product(acc, m)) algebra.Uniform
                    target, toTarget)
                |> Map.ofList }

/// A factor graph: the factors (by id) and the current factor→var
/// messages. Variable→factor messages and marginals are *derived* from
/// the factor→var messages by the sum-product variable rule, so the only
/// state is `FactorToVar`. The message algebra travels with the graph.
type FactorGraph<'M> =
    { Algebra: IMessage<'M>
      /// factor id → factor
      Factors: Map<int, Factor<'M>>
      /// factor id → (variable id → the factor→var message on that edge)
      FactorToVar: Map<int, Map<int, 'M>> }

[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module FactorGraph =

    /// An empty graph over the given message algebra.
    let empty (algebra: IMessage<'M>) : FactorGraph<'M> =
        { Algebra = algebra; Factors = Map.empty; FactorToVar = Map.empty }

    /// Add a factor under `id`; its outgoing edges start at `uniform`.
    let addFactor (id: int) (factor: Factor<'M>) (g: FactorGraph<'M>) : FactorGraph<'M> =
        let init =
            factor.Neighbors
            |> List.map (fun v -> v, g.Algebra.Uniform)
            |> Map.ofList
        { g with
            Factors = Map.add id factor g.Factors
            FactorToVar = Map.add id init g.FactorToVar }

    /// The factor ids incident to a variable.
    let private factorsOf (variable: int) (g: FactorGraph<'M>) : int list =
        g.Factors
        |> Map.toList
        |> List.filter (fun (_, f) -> List.contains variable f.Neighbors)
        |> List.map fst

    /// Product of the factor→var messages from a chosen set of factors.
    let private productFrom (variable: int) (factorIds: int list) (g: FactorGraph<'M>) : 'M =
        factorIds
        |> List.choose (fun fid -> g.FactorToVar |> Map.tryFind fid |> Option.bind (Map.tryFind variable))
        |> List.fold (fun acc m -> g.Algebra.Product(acc, m)) g.Algebra.Uniform

    /// The marginal at a variable = product of **all** incoming factor→var
    /// messages.
    let marginal (variable: int) (g: FactorGraph<'M>) : 'M =
        productFrom variable (factorsOf variable g) g

    /// The variable→factor message = product of factor→var messages from
    /// **every other** incident factor (the sum-product variable rule).
    let private varToFactor (variable: int) (excludeFactor: int) (g: FactorGraph<'M>) : 'M =
        let others = factorsOf variable g |> List.filter (fun fid -> fid <> excludeFactor)
        productFrom variable others g

    /// One synchronous sum-product round: recompute every factor→var
    /// message from the current variable→factor messages. Repeated to a
    /// fixed point this is loopy BP; on a tree it converges exactly in a
    /// bounded number of rounds (the schedule is slice 4).
    let passOnce (g: FactorGraph<'M>) : FactorGraph<'M> =
        let updated =
            g.Factors
            |> Map.map (fun fid factor ->
                let incoming =
                    factor.Neighbors
                    |> List.map (fun v -> v, varToFactor v fid g)
                    |> Map.ofList
                factor.ComputeMessages incoming)
        { g with FactorToVar = updated }

    /// Run `passOnce` `rounds` times (a fixed schedule). For the
    /// convergence-detecting schedule prefer `runToFixpoint`.
    let passRounds (rounds: int) (g: FactorGraph<'M>) : FactorGraph<'M> =
        let mutable current = g
        for _ in 1..rounds do
            current <- passOnce current
        current

    /// True if any factor→var message differs between `a` and `b` by more
    /// than `tol` under the per-family `distance` (the residual test).
    /// Compared **symmetrically** over the union of keys: a factor id or
    /// edge present on only one side counts as moved (a structural change
    /// is never silently treated as convergence).
    let private moved (distance: 'M -> 'M -> float) (tol: float) (a: FactorGraph<'M>) (b: FactorGraph<'M>) : bool =
        let keys (m: Map<int, _>) = m |> Map.toList |> List.map fst |> Set.ofList
        Set.union (keys a.FactorToVar) (keys b.FactorToVar)
        |> Set.exists (fun fid ->
            match Map.tryFind fid a.FactorToVar, Map.tryFind fid b.FactorToVar with
            | Some ma, Some mb ->
                Set.union (keys ma) (keys mb)
                |> Set.exists (fun v ->
                    match Map.tryFind v ma, Map.tryFind v mb with
                    // `not (d <= tol)` (not `d > tol`) so a NaN residual
                    // counts as MOVED: `NaN > tol` is false in F#, which
                    // would otherwise let a divergent/overflowed run
                    // falsely report convergence.
                    | Some x, Some y -> not (distance x y <= tol)
                    | _ -> true) // edge on only one side = moved
            | _ -> true) // factor on only one side = moved

    /// **Sum-product belief propagation to a fixed point.** Iterate
    /// `passOnce` until no factor→var message moves more than `tol` (by
    /// the per-family `distance`), or `maxRounds` is reached. Returns
    /// `(converged graph, rounds run, converged-before-the-cap?)`.
    ///
    /// On a tree this reaches the exact marginals; with loops it is loopy
    /// BP (may not converge — hence the cap, like `NestedCircuit`'s
    /// 64-iteration LFP cap). Structurally this *is* the DBSP
    /// `NestedCircuit.Fixedpoint` (drive the inner clock to the least
    /// fixed point, capped) at the factor-graph level; wiring the factor
    /// graph as literal DBSP operators — for **incremental re-inference
    /// on a data delta** — is the next integration (slice 4b).
    let runToFixpoint
        (distance: 'M -> 'M -> float)
        (tol: float)
        (maxRounds: int)
        (g: FactorGraph<'M>)
        : FactorGraph<'M> * int * bool =
        let mutable current = g
        let mutable rounds = 0
        let mutable converged = false
        while rounds < maxRounds && not converged do
            let next = passOnce current
            rounds <- rounds + 1
            converged <- not (moved distance tol current next)
            current <- next
        current, rounds, converged

    /// One DAMPED message pass: each new factor→var message is blended with its previous value,
    /// `blend alpha newMsg oldMsg` (alpha = 1 ⇒ undamped). THE LOOPY UPGRADE (081KTZ4EF0008QG0R000WJGSWX's named
    /// follow-up, landed 2026-06-13): on cyclic graphs raw BP can oscillate/overcount precision
    /// forever (Weiss & Freeman 2001); damping is the standard fix (Minka's EP papers use it
    /// routinely; Heskes 2002 analyzes it). Deterministic: same schedule, same blend, same run.
    let passOnceDamped (blend: float -> 'M -> 'M -> 'M) (alpha: float) (g: FactorGraph<'M>) : FactorGraph<'M> =
        let undamped = passOnce g
        let damped =
            undamped.FactorToVar
            |> Map.map (fun fid msgs ->
                msgs
                |> Map.map (fun v newMsg ->
                    match Map.tryFind fid g.FactorToVar |> Option.bind (Map.tryFind v) with
                    | Some oldMsg -> blend alpha newMsg oldMsg
                    | None -> newMsg))
        { undamped with FactorToVar = damped }

    /// `runToFixpoint`, damped (see passOnceDamped) — same convergence test, damped steps.
    let runToFixpointDamped
        (blend: float -> 'M -> 'M -> 'M)
        (alpha: float)
        (distance: 'M -> 'M -> float)
        (tol: float)
        (maxRounds: int)
        (g: FactorGraph<'M>)
        : FactorGraph<'M> * int * bool =
        let mutable current = g
        let mutable rounds = 0
        let mutable converged = false
        while rounds < maxRounds && not converged do
            let next = passOnceDamped blend alpha current
            rounds <- rounds + 1
            converged <- not (moved distance tol current next)
            current <- next
        current, rounds, converged
