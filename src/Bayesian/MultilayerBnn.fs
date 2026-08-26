namespace Zeta.Bayesian

/// **MultilayerBnn — an N-layer Bayesian network over a chain of Gaussian latents.**
///
/// ## The model, stated explicitly
///
/// One latent variable `x_i` per layer. Three kinds of factor:
///
///   * `prior_i`   — the layer prior `N(x_i ; priors.[i])`;
///   * `data`      — the observation stream, absorbed at layer 0 with variance
///                   `ObservationVariances.[0]`;
///   * `channel_i` — for `i >= 1`, the link `N(s_i ; x_i, ObservationVariances.[i])`,
///                   where `s_i = x_(i-1)` under `Sequential` and
///                   `s_i = x_(i-1) + (sum of the skip sources)` under `SkipConnections`.
///
/// Under `Sequential` that is a chain, hence a tree, so sum-product is EXACT:
/// one forward sweep plus one backward sweep yields the exact marginals. That
/// two-pass schedule is the Rauch-Tung-Striebel smoother in factor-graph
/// clothing (Rauch, Tung and Striebel 1965; Kalman 1960).
///
/// ## What this revision fixed
///
/// The inter-layer hand-off used to be a POINT ESTIMATE: layer `i` received
/// `Gaussian.mean posterior_(i-1)` as a scalar observation and every layer
/// accumulated it into its own likelihood product. Three defects followed from
/// that single choice.
///
///   1. **The variance of the layer below was discarded.** Output precision was
///      depth-INVARIANT (11.0 at every depth in the reproduction) while the mean
///      attenuated geometrically, so a deep agent published a confidently wrong
///      answer — and confidence is the only channel the society reads.
///   2. **The advertised EP cavity was an algebraic identity.** A layer holds
///      only `prior x likelihood`, so `posterior / likelihood` is identically the
///      prior and `(P - L) + L = P`; the backward pass provably did nothing.
///   3. **Messages were accumulated rather than replaced,** so one observation
///      was counted once per layer.
///
/// The fix is to carry a MESSAGE instead of a number. A belief crossing a noisy
/// link keeps its mean and gains the link variance (`throughChannel`); a skip
/// junction sums by convolution (`convolve`); and each sweep RECOMPUTES the
/// up/down messages instead of multiplying fresh copies in. Only layer 0
/// accumulates evidence, because only layer 0 sees data.
///
/// The cavity is now real: the message from `x_(i-1)` to `x_i` is the belief at
/// layer `i-1` with the message layer `i` sent DOWN divided out — the
/// sum-product variable rule, which is exactly the EP cavity (Minka 2001).
/// Dividing it out is also what makes both sweeps idempotent (discipline #6).
///
/// ## What this revision did NOT fix, deliberately
///
/// Depth still attenuates the posterior mean. That is now a property of the
/// STATED MODEL rather than of the arithmetic: every layer carries its own
/// proper prior, so every hop shrinks the mean toward that prior while the
/// channel adds variance. With near-flat deeper priors the same code preserves
/// the mean and grows the variance instead. Choosing the per-layer prior is a
/// modelling decision for the caller, and an agent whose interval fails to
/// cover the truth must be refused by a calibration gate rather than silently
/// summed into a society.
///
/// ## Honest scope boundary
///
/// Under `SkipConnections` the graph is loopy: the forward sweep carries skip
/// evidence but the backward sweep sends downward messages only along the
/// sequential links, so the result is a first-order approximation rather than
/// the exact marginal. `FactorGraph.runToFixpointDamped` is the upgrade path.
///
/// Anchors: Kalman 1960; Rauch, Tung and Striebel 1965 (the two-pass smoother);
/// Kschischang, Frey and Loeliger 2001 (sum-product); Loeliger 2004 (the
/// Gaussian message tables for the sum and channel factors); Minka 2001 (EP,
/// and the reason a fully conjugate site has nothing left to refine).
/// All cited from standing knowledge, not page-checked in this pass.
[<RequireQualifiedAccess>]
module MultilayerBnn =

    // -- Types ------------------------------------------------------------------

    /// A single layer in the network — a MinimalBnn inference cell. Only layer 0
    /// ever absorbs data; deeper layers contribute their prior and their
    /// bookkeeping, and their belief is formed from messages.
    type Layer = MinimalBnn.State

    /// Wiring topology: how layers are connected.
    /// `Sequential` = each layer feeds the next (default).
    /// `SkipConnection from to` = layer `from` also feeds layer `to` directly
    ///   (residual connection — the source beliefs are SUMMED at `to`).
    /// `Dag parents` = `parents.[i]` is the full set of layers feeding layer `i`;
    /// the general case, of which the other two are special forms.
    ///
    /// ALL THREE ARE READ THROUGH `parentsOf` AND NOWHERE ELSE. A topology case
    /// that one sweep interprets and another ignores is how `SkipConnections`
    /// became a first-order approximation: the forward sweep honoured the skips
    /// and the backward sweep did not. One interpreter means a new case cannot
    /// silently miss a code path — and the compiler proved that immediately, by
    /// refusing to build until `toJsonString` handled `Dag` too.
    type Topology =
        | Sequential
        | SkipConnections of (int * int) list
        | Dag of int list array

    /// The layers feeding layer `i`, for any topology. The single place a
    /// topology is interpreted.
    ///
    /// ORDER IS LOAD-BEARING: the sequential predecessor comes first, then the
    /// skips in declaration order, because the sweeps fold over this list and
    /// Gaussian convolution — associative in exact arithmetic — is NOT
    /// bit-associative in floating point. Reordering moves the last ulp of the
    /// numbers this module's bit-identity tests pin.
    let parentsOf (topology: Topology) (i: int) : int list =
        match topology with
        | Sequential -> if i <= 0 then [] else [ i - 1 ]
        | SkipConnections pairs ->
            let skips =
                pairs |> List.choose (fun (from, ``to``) -> if ``to`` = i then Some from else None)
            (if i <= 0 then [] else [ i - 1 ]) @ skips
        | Dag parents -> if i >= 0 && i < parents.Length then parents.[i] else []

    /// An N-layer Bayesian network.
    type Network =
        { /// The layers, in forward-pass order.
          Layers: Layer array
          /// The wiring topology.
          Topology: Topology
          /// Layer 0: the data observation variance. Layer i >= 1: the noise
          /// variance of the link feeding layer i.
          ObservationVariances: float array
          /// The message arriving at layer i FROM BELOW. Recomputed by every
          /// forward sweep — never accumulated, which is what stops one
          /// observation being counted once per layer.
          UpwardMessages: Gaussian array
          /// The message arriving at layer i FROM ABOVE. Recomputed by every
          /// backward sweep. Uniform at the top layer by construction.
          DownwardMessages: Gaussian array }

    // -- Construction -------------------------------------------------------------

    /// Create an N-layer network from an array of Gaussian priors and
    /// observation variances. Returns `Error` if any layer fails to
    /// initialise (invalid prior or non-positive variance).
    let tryCreate
        (priors: Gaussian array)
        (observationVariances: float array)
        (topology: Topology)
        : Result<Network, string> =
        if priors.Length <> observationVariances.Length then
            Error
                $"priors.Length ({priors.Length}) must equal observationVariances.Length ({observationVariances.Length})"
        elif priors.Length = 0 then
            Error "network must have at least one layer"
        else
            let results =
                Array.zip priors observationVariances
                |> Array.mapi (fun i (prior, variance) ->
                    MinimalBnn.tryCreate prior variance
                    |> Result.mapError (fun e -> $"layer {i}: {e}"))
            let errors = results |> Array.choose (function Error e -> Some e | _ -> None)
            if errors.Length > 0 then
                Error(errors |> String.concat "; ")
            else
                let layers = results |> Array.choose (function Ok s -> Some s | _ -> None)
                Ok
                    { Layers = layers
                      Topology = topology
                      ObservationVariances = observationVariances
                      UpwardMessages = Array.create layers.Length Gaussian.One
                      DownwardMessages = Array.create layers.Length Gaussian.One }

    /// Create a sequential network with identical priors and variances at
    /// every layer — the simplest useful default.
    let tryCreateUniform
        (depth: int)
        (prior: Gaussian)
        (observationVariance: float)
        : Result<Network, string> =
        tryCreate
            (Array.create depth prior)
            (Array.create depth observationVariance)
            Sequential

    // -- Skip-connection helpers ---------------------------------------------------

    /// Remove the FIRST occurrence of `x`, not all of them. A topology may
    /// legitimately name the same parent twice (a skip from `i-1` to `i`
    /// alongside the sequential feed), and that duplicate means the source is
    /// summed in twice. Dropping both would silently change the model rather
    /// than preserve it.
    let private removeFirst (x: int) (xs: int list) : int list =
        let rec go acc =
            function
            | [] -> List.rev acc
            | y :: rest when y = x -> List.rev acc @ rest
            | y :: rest -> go (y :: acc) rest
        go [] xs

    // -- Gaussian message primitives -----------------------------------------------

    /// The sum of two INDEPENDENT Gaussian beliefs: means add, variances add
    /// (the sum-factor rule, Loeliger 2004). A uniform addend absorbs — the sum
    /// of a known and an unknown quantity is unknown.
    let private convolve (a: Gaussian) (b: Gaussian) : Gaussian =
        if a.Precision <= 0.0 || b.Precision <= 0.0 then
            Gaussian.One
        else
            let v = (1.0 / a.Precision) + (1.0 / b.Precision)
            { PrecisionMean = (Gaussian.mean a + Gaussian.mean b) / v
              Precision = 1.0 / v }

    /// The inverse of `convolve` in one addend: the message about `x` given a
    /// belief about `x + y` and a belief about `y`. Means SUBTRACT; variances
    /// still ADD. That asymmetry is the point — uncertainty never cancels,
    /// which is why this is not `Gaussian.divide`.
    let private deconvolve (total: Gaussian) (other: Gaussian) : Gaussian =
        if total.Precision <= 0.0 || other.Precision <= 0.0 then
            Gaussian.One
        else
            let v = (1.0 / total.Precision) + (1.0 / other.Precision)
            { PrecisionMean = (Gaussian.mean total - Gaussian.mean other) / v
              Precision = 1.0 / v }

    /// A belief pushed through a link with additive noise of known variance: the
    /// mean survives, the variance grows by exactly the link noise. This is the
    /// quantity the previous point-estimate hand-off silently discarded, and
    /// discarding it is what made the output precision depth-invariant.
    let private throughChannel (noiseVariance: float) (m: Gaussian) : Gaussian =
        if m.Precision <= 0.0 then
            Gaussian.One
        else
            let v = (1.0 / m.Precision) + noiseVariance
            { PrecisionMean = (Gaussian.mean m) / v
              Precision = 1.0 / v }

    // -- Beliefs -------------------------------------------------------------------

    /// The marginal belief at layer `i`: the layer posterior (prior times the
    /// accumulated data likelihood, which is uniform above layer 0) times the
    /// message from below times the message from above.
    let beliefAt (net: Network) (i: int) : Gaussian =
        net.Layers.[i].Posterior * net.UpwardMessages.[i] * net.DownwardMessages.[i]

    // -- Forward pass ---------------------------------------------------------------

    /// Run the forward (filtering) sweep. Layer 0 absorbs the scalar
    /// observation; every deeper layer recomputes the message arriving from
    /// below. Returns the updated network and the per-layer beliefs.
    let forward (observation: float) (net: Network) : Result<Network * Gaussian array, string> =
        let n = net.Layers.Length
        let layers = Array.copy net.Layers
        let up = Array.copy net.UpwardMessages
        let down = Array.copy net.DownwardMessages
        let posteriors = Array.zeroCreate<Gaussian> n
        let localBelief i = layers.[i].Posterior * up.[i] * down.[i]

        let mutable error : string option = None

        // Layer 0 is the only layer that sees data: the conjugate accumulation
        // there is genuine evidence, not a relayed copy of it.
        match MinimalBnn.update observation layers.[0] with
        | Error e -> error <- Some(sprintf "forward pass layer 0: %s" e)
        | Ok updatedLayer0 ->
            layers.[0] <- updatedLayer0
            posteriors.[0] <- localBelief 0

        let mutable i = 1
        while i < n && error.IsNone do
            let previous = localBelief i
            // The message x_(i-1) -> x_i is the belief at layer i-1 with the
            // message that layer i sent DOWN divided out: the sum-product
            // variable rule, i.e. the EP cavity (Minka 2001). Without this
            // division the chain re-absorbs its own evidence every sweep.
            // ONE PARENT IS THE CAVITY PARENT; THE REST ARE CONVOLVED RAW, and the
            // asymmetry is a limitation of the representation rather than a choice.
            // `down` is indexed BY LAYER, so it holds one downward message per
            // NODE — exactly right for a chain, where a layer has at most one
            // child, and unable to express the per-EDGE message a DAG needs. The
            // sequential predecessor's entry genuinely is the message this layer
            // sent down, so dividing it out is the correct sum-product cavity
            // (Minka 2001). A skip source's entry is the message IT received from
            // ITS own sequential child — a different edge — so dividing that out
            // would remove the wrong evidence, hence raw. `FactorGraph`'s
            // `FactorToVar : Map<factor, Map<var, 'M>>` is per-edge, and is where
            // this stops being approximate.
            let parents = parentsOf net.Topology i |> List.filter (fun src -> src < i)
            let hasSequentialParent = List.contains (i - 1) parents
            let cavityBelow =
                if hasSequentialParent then Gaussian.divide (localBelief (i - 1)) down.[i - 1]
                else Gaussian.One
            let sumBelief =
                (if hasSequentialParent then removeFirst (i - 1) parents else parents)
                |> List.fold (fun acc src -> convolve acc (localBelief src)) cavityBelow
            up.[i] <- throughChannel net.ObservationVariances.[i] sumBelief
            let updated = localBelief i
            if not (System.Double.IsFinite updated.Precision && System.Double.IsFinite updated.PrecisionMean) then
                error <- Some(sprintf "forward pass layer %d: non-finite belief" i)
            else
                let stepIv = InformationValue.compute previous updated
                layers.[i] <-
                    { layers.[i] with
                        Objective =
                            { layers.[i].Objective with
                                ObservationCount = layers.[i].Objective.ObservationCount + 1
                                LastIncrementalIv = stepIv
                                CumulativeIv = layers.[i].Objective.CumulativeIv + stepIv } }
                posteriors.[i] <- updated
                i <- i + 1

        match error with
        | Some e -> Error e
        | None ->
            Ok(
                { net with
                    Layers = layers
                    UpwardMessages = up
                    DownwardMessages = down },
                posteriors)

    // -- Backward pass (the EP cavity sweep) ----------------------------------------

    /// Run the backward (smoothing) sweep: for each layer from the top down,
    /// form the EP cavity at the layer above — its belief WITHOUT the message
    /// that came up from this layer — push it back through the link, and store
    /// it as the message arriving from above.
    ///
    /// On a `Sequential` chain, forward-then-backward gives the EXACT marginals,
    /// and the sweep is idempotent: `down.[i]` is computed from quantities that
    /// do not contain `down.[i]`.
    ///
    /// THAT IDEMPOTENCY CLAIM IS FALSE FOR ANY MULTI-PARENT TOPOLOGY, and it was
    /// stated here without the qualifier until 2026-08-26. The sum-removal fold
    /// below deconvolves `localBelief src` for each other addend, and
    /// `localBelief` reads `down.[src]` — which THIS sweep has already
    /// overwritten, because `i` descends. So the second run sees different inputs
    /// and lands somewhere else.
    ///
    /// MEASURED, worst per-layer drift between two consecutive backward runs on a
    /// 5-layer net (`MLBNN-34`):
    ///
    ///     Sequential  0        Dag-chain  0
    ///     Dag-skip    0.66     SkipConnections  0.66
    ///
    /// It is PRE-EXISTING, not a consequence of the `Dag` generalisation: the
    /// `SkipConnections` row drifts identically and always did. `MLBNN-16` could
    /// not see it because it exercises only `Sequential` and compares through
    /// `toJsonString`, whose `%.12g` hides anything below the twelfth digit.
    ///
    /// NOT FIXED HERE, deliberately. The sweeps' multi-parent answer is already
    /// known to be the wrong one — `MLBNN-33` measures its mean error at 2.07
    /// against an exact solve, where `tryMarginalsViaFactorGraph` scores 4e-14 —
    /// so replacing one approximation with a differently-wrong idempotent
    /// approximation is not obviously progress, and the correct path already
    /// exists and IS idempotent (`MLBNN-35`). Use the factor graph for anything
    /// that is not a chain.
    let backward (net: Network) : Result<Network, string> =
        let n = net.Layers.Length
        let up = net.UpwardMessages
        let down = Array.copy net.DownwardMessages
        let localBelief i = net.Layers.[i].Posterior * up.[i] * down.[i]

        // The top layer receives nothing from above; hold that invariant.
        down.[n - 1] <- Gaussian.One

        let mutable error : string option = None
        let mutable i = n - 2
        while i >= 0 && error.IsNone do
            let cavityAbove = Gaussian.divide (localBelief (i + 1)) up.[i + 1]
            if not (Gaussian.isProper cavityAbove) then
                // Nothing to say downward yet; a uniform message is the honest
                // answer, not a fabricated one.
                down.[i] <- Gaussian.One
            else
                let toSum = throughChannel net.ObservationVariances.[i + 1] cavityAbove
                // If layer i+1 was fed by a SUM, remove the other addends. The
                // target itself is never removed from its own message.
                //
                // Swapping `skipSourcesFor` for `parentsOf` changes nothing here:
                // the only element `parentsOf` adds is the sequential parent of
                // `i+1`, which IS `i`, and the filter already excluded it.
                //
                // STILL A CHAIN WALK, which is this sweep's honest limit. `i`
                // descends `n-2 .. 0` taking its downward message from `i+1`
                // alone, so a layer whose real consumer is a higher non-adjacent
                // node never receives that node's evidence. Under `Dag` that is an
                // approximation of exactly the kind `SkipConnections` already was.
                // Fixing it needs per-edge messages, not a better traversal order.
                down.[i] <-
                    parentsOf net.Topology (i + 1)
                    |> List.filter (fun src -> src < i + 1 && src <> i)
                    |> List.fold (fun acc src -> deconvolve acc (localBelief src)) toSum
            let updated = localBelief i
            if not (System.Double.IsFinite updated.Precision && System.Double.IsFinite updated.PrecisionMean) then
                error <- Some(sprintf "backward pass layer %d: non-finite belief" i)
            else
                i <- i - 1

        match error with
        | Some e -> Error e
        | None -> Ok { net with DownwardMessages = down }

    // -- Factor-graph inference: the per-edge upgrade --------------------------------
    //
    // WHY THIS EXISTS ALONGSIDE THE SWEEPS RATHER THAN REPLACING THEM. The two
    // sweeps store one upward and one downward message PER LAYER, which is exact
    // for a chain — where a layer has at most one parent and one child — and
    // cannot represent the per-EDGE messages a DAG needs. `FactorGraph` keys its
    // messages `factor -> variable`, so every edge carries its own, and loopy
    // topologies get sum-product to a fixed point instead of one forward and one
    // backward pass.
    //
    // BIT-IDENTITY IS THE WRONG BAR HERE, and the row that asked for it was
    // asking for the right thing about the wrong stage. Re-spelling `Sequential`
    // as a `Dag` runs the SAME arithmetic in the same order, so bits must match
    // and MLBNN-23/24 pin that. A fixpoint iteration is a DIFFERENT algorithm
    // computing the same mathematical quantity; it agrees to machine precision,
    // not to the last ulp, and demanding bits would only pin an accident of the
    // schedule. The honest falsifier is the INDEPENDENT one the test file already
    // carries: `exactChainMarginals` inverts the joint precision matrix by
    // Gauss-Jordan, and sum-product on a tree must agree with it.

    /// A factor asserting `child = sum(parents) + noise`, as a sum-product factor
    /// over `parents @ [child]`.
    ///
    /// DUPLICATE PARENTS ARE NOT EXPRESSIBLE HERE and are rejected by
    /// `tryToFactorGraph` rather than silently collapsed. `Factor` keys its
    /// outgoing messages by VARIABLE id, so naming a parent twice would write one
    /// map entry and quietly halve the contribution the sweeps do deliver
    /// (MLBNN-27 pins that they deliver it twice). A refusal is honest; a silent
    /// disagreement between two inference paths on the same network is not.
    let private sumLinkFactor
        (noiseVariance: float)
        (parents: int list)
        (child: int)
        : Factor<Gaussian> =
        { Neighbors = parents @ [ child ]
          ComputeMessages =
            fun incoming ->
                let msg v = incoming |> Map.tryFind v |> Option.defaultValue Gaussian.One
                let combine vs =
                    match vs with
                    | [] -> Gaussian.One
                    | v0 :: rest -> rest |> List.fold (fun acc v -> convolve acc (msg v)) (msg v0)
                let toChild = throughChannel noiseVariance (combine parents)
                let toParent p =
                    // The child's belief pushed back through the link, with the
                    // OTHER addends removed. Means subtract, variances still add —
                    // `deconvolve`, never `divide`: uncertainty does not cancel.
                    removeFirst p parents
                    |> List.fold (fun acc o -> deconvolve acc (msg o)) (throughChannel noiseVariance (msg child))
                (parents |> List.map (fun p -> p, toParent p)) @ [ child, toChild ]
                |> Map.ofList }

    /// Build the factor graph for a network: one prior factor per layer, and one
    /// sum-link factor per layer that has parents.
    ///
    /// Layer 0's prior factor carries the ABSORBED DATA, not the original prior —
    /// `Layers.[0].Posterior` is the conjugate accumulation, so the evidence
    /// enters once, as a leaf, exactly as it does in the sweeps.
    let tryToFactorGraph (net: Network) : Result<FactorGraph<Gaussian>, string> =
        let n = net.Layers.Length
        let parentsFor i = parentsOf net.Topology i |> List.filter (fun p -> p >= 0 && p < n)
        let offenders =
            [ 0 .. n - 1 ]
            |> List.filter (fun i ->
                let ps = parentsFor i
                List.length ps <> List.length (List.distinct ps))
        if not (List.isEmpty offenders) then
            let names = offenders |> List.map string |> String.concat ", "
            Error(
                $"layers {names} name a parent more than once; the factor-graph path "
                + "keys messages by variable and cannot express a repeated addend")
        else
            let withPriors =
                [ 0 .. n - 1 ]
                |> List.fold
                    (fun g i -> FactorGraph.addFactor i (Factor.prior i net.Layers.[i].Posterior) g)
                    (FactorGraph.empty Gaussian.algebra)
            [ 0 .. n - 1 ]
            |> List.fold
                (fun g i ->
                    match parentsFor i with
                    | [] -> g
                    | ps -> FactorGraph.addFactor (n + i) (sumLinkFactor net.ObservationVariances.[i] ps i) g)
                withPriors
            |> Ok

    /// Per-layer marginals by sum-product to a fixed point, plus the rounds run
    /// and whether it converged before the cap.
    ///
    /// The caller is told `converged` rather than having a non-convergence
    /// swallowed: on a loopy graph BP may oscillate forever (Weiss & Freeman
    /// 2001), and a silent cap would report an arbitrary iterate as an answer.
    let tryMarginalsViaFactorGraph
        (tol: float)
        (maxRounds: int)
        (net: Network)
        : Result<Gaussian array * int * bool, string> =
        tryToFactorGraph net
        |> Result.map (fun g ->
            let settled, rounds, converged =
                FactorGraph.runToFixpoint Gaussian.distance tol maxRounds g
            Array.init net.Layers.Length (fun i -> FactorGraph.marginal i settled), rounds, converged)

    // -- Combined forward+backward ---------------------------------------------------

    /// Run one full forward+backward cycle. On a `Sequential` chain this is the
    /// exact two-pass smoother, not an approximation.
    let update (observation: float) (net: Network) : Result<Network, string> =
        net
        |> forward observation
        |> Result.bind (fun (updatedNet, _) -> backward updatedNet)

    /// Absorb a stream of observations into the network.
    let infer (observations: seq<float>) (net: Network) : Result<Network, string> =
        observations
        |> Seq.fold
            (fun result obs ->
                match result with
                | Ok current -> update obs current
                | Error e -> Error e)
            (Ok net)

    // -- Objective --------------------------------------------------------------------

    /// The cumulative information value across all layers.
    let cumulativeIv (net: Network) : float<InformationValue.iv> =
        net.Layers |> Array.sumBy (fun l -> l.Objective.CumulativeIv)

    /// The belief of the final layer (the network output).
    let outputPosterior (net: Network) : Gaussian =
        beliefAt net (net.Layers.Length - 1)

    /// The posterior mean of the final layer.
    let outputMean (net: Network) : float =
        Gaussian.mean (outputPosterior net)

    /// The posterior variance of the final layer.
    let outputVariance (net: Network) : float =
        Gaussian.variance (outputPosterior net)

    // -- Serialisation (gen(gen)==gen) ------------------------------------------------

    /// Serialise the network to a JSON string. The network is a residual —
    /// it can be collected by Shiva-GC and regenerated from the priors +
    /// observation variances (the generator).
    let toJsonString (net: Network) : string =
        let layerJsons =
            net.Layers
            |> Array.mapi (fun i l ->
                let p = beliefAt net i
                sprintf "{\"mu\":%.12g,\"sigma2\":%.12g,\"obsCount\":%d}"
                    (Gaussian.mean p) (Gaussian.variance p) l.Objective.ObservationCount)
            |> String.concat ","
        let topologyJson =
            match net.Topology with
            | Sequential -> "\"sequential\""
            | SkipConnections pairs ->
                let pairJsons =
                    pairs |> List.map (fun (f, t) -> sprintf "[%d,%d]" f t) |> String.concat ","
                sprintf "{\"skipConnections\":[%s]}" pairJsons
            // Serialised from the CASE, not normalised through `parentsOf`: this
            // JSON is the round-trip generator, so it has to record which topology
            // was DECLARED. Normalising here would round-trip `Sequential` back as
            // a `Dag` and lose that.
            | Dag parents ->
                let parentJsons =
                    parents
                    |> Array.map (fun ps ->
                        ps |> List.map (sprintf "%d") |> String.concat "," |> sprintf "[%s]")
                    |> String.concat ","
                sprintf "{\"dag\":[%s]}" parentJsons
        sprintf "{\"layers\":[%s],\"topology\":%s}" layerJsons topologyJson
