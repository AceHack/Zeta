namespace Zeta.Bayesian

/// # The factor graph (B-1000 slice 3)
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

    /// Run `passOnce` `rounds` times (a fixed schedule; the
    /// convergence-detecting fixed-point schedule is slice 4).
    let passRounds (rounds: int) (g: FactorGraph<'M>) : FactorGraph<'M> =
        let mutable current = g
        for _ in 1..rounds do
            current <- passOnce current
        current
