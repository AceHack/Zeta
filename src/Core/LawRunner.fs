namespace Zeta.Core


/// Deterministic-simulation law runner for plugin operators.
/// Design and rationale live in `docs/research/stateful-harness-design.md`.
///
/// Plugin authors call these checks from their test project —
/// LawRunner is a test-time library, not a `Circuit.Build()` gate.
/// That keeps `Zeta.Core` free of FsCheck; generators are plain
/// `System.Random -> 'T` so authors wire FsCheck (or any other
/// generator) at their end.
///
/// All checks are **deterministic** given the same seed. Each
/// sample uses its own `System.Random(seed + sampleIndex)` so a
/// failing `(seed, sampleIndex)` pair reproduces bit-exact on
/// re-run with any `samples >= sampleIndex + 1` — sample N does
/// not depend on whether earlier samples failed fast.
///
/// `checkRetractionCompleteness` uses the **state-restoration
/// via continuation** formulation: feed a forward trace, then
/// its retraction, then a continuation; compare continuation
/// outputs to a fresh-op run of the continuation alone. Any
/// divergence means the op's internal state survived what was
/// supposed to be a full cancel. This catches stateful ops that
/// mistag themselves as retraction-clean (Option B per the
/// design doc; Option A enrichment — `Init`/`Step`/`Retract`
/// triple — is round-29+ work).
///
/// `'TState` on `IStatefulStrictOperator` is unused by the
/// trace-based law — the check runs through `StepAsync` and
/// never inspects state. Tests pass `unit` for this parameter.
[<RequireQualifiedAccess>]
module LawRunner =

    /// Reported when a law fails or a check cannot run.
    /// `Seed` + `SampleIndex` are enough to reproduce via a
    /// fresh `checkX` call on the same seed; `Message` describes
    /// the specific failure mode.
    type LawViolation =
        { Seed: int
          SampleIndex: int
          Message: string }

    /// Bad arguments surface as `Error` rather than exceptions
    /// so every public entry returns a `Result` — CLAUDE.md's
    /// result-over-exception rule.
    let private badArgs (seed: int) (message: string) : LawViolation =
        { Seed = seed; SampleIndex = -1; Message = message }

    let private generateTrace<'TIn>
        (rng: System.Random)
        (length: int)
        (genInput: System.Random -> 'TIn)
        : 'TIn list =
        [ for _ in 1 .. length -> genInput rng ]

    /// Shared sample-loop shape used by every law. Each sample
    /// gets a fresh `System.Random(seed + i)` so reproducibility
    /// is per-sample, not whole-loop. `check` returns `None` on
    /// pass and `Some message` on failure; the framer wraps it
    /// as a `LawViolation`.
    let private runSamples
        (seed: int)
        (samples: int)
        (check: System.Random -> int -> string option)
        : Result<unit, LawViolation> =
        let mutable failure : LawViolation option = None
        let mutable i = 0
        while failure.IsNone && i < samples do
            let rng = System.Random(seed + i)
            match check rng i with
            | Some msg ->
                failure <- Some { Seed = seed; SampleIndex = i; Message = msg }
            | None -> ()
            i <- i + 1
        match failure with
        | Some v -> Error v
        | None -> Ok ()

    /// Linearity: for every trace pair `(A, B)`, the output
    /// trace on `A + B` (elementwise) must equal the elementwise
    /// sum of the output traces on `A` and `B`.
    ///
    /// - `samples` — number of (A, B) pairs to test.
    /// - `scheduleLength` — ticks per trace. DST prefers a
    ///   generous bound (tens to low hundreds) so stateful
    ///   linear ops (e.g. integration) have time to expose
    ///   drift.
    /// - `addIn` / `addOut` / `equalOut` — user-supplied so
    ///   this works for both `ZSet<'T>` (via `ZSet.add`) and
    ///   plain numeric types. Equality is explicit for the same
    ///   reason — `ZSet<'T>` structural equality is not always
    ///   cheap, so the caller chooses.
    let checkLinear<'TIn, 'TOut>
        (seed: int)
        (samples: int)
        (scheduleLength: int)
        (makeOp: Stream<'TIn> -> IOperator<'TOut>)
        (genInput: System.Random -> 'TIn)
        (addIn: 'TIn -> 'TIn -> 'TIn)
        (addOut: 'TOut -> 'TOut -> 'TOut)
        (equalOut: 'TOut -> 'TOut -> bool)
        : Result<unit, LawViolation> =
        if samples < 1 then
            Error (badArgs seed "samples must be >= 1")
        elif scheduleLength < 1 then
            Error (badArgs seed "scheduleLength must be >= 1")
        else
            runSamples seed samples (fun rng i ->
                let traceA = generateTrace rng scheduleLength genInput
                let traceB = generateTrace rng scheduleLength genInput
                let traceSum = List.map2 addIn traceA traceB
                // Convert outputs to arrays once — tick indexing
                // is O(n) on `List.item`, so a List scan would
                // be O(scheduleLength²) per sample.
                let outA = PluginHarness.runSingleInput makeOp traceA |> List.toArray
                let outB = PluginHarness.runSingleInput makeOp traceB |> List.toArray
                let outSum = PluginHarness.runSingleInput makeOp traceSum |> List.toArray
                let mutable result = None
                let mutable tick = 0
                while result.IsNone && tick < scheduleLength do
                    let lhs = outSum.[tick]
                    let rhs = addOut outA.[tick] outB.[tick]
                    if not (equalOut lhs rhs) then
                        result <-
                            Some (sprintf
                                     "Linearity broke at sample %d, tick %d: \
                                      op(a+b) != op(a) + op(b)."
                                     i tick)
                    // nosemgrep: plain-tick-increment -- method-local loop counter, not shared across threads
                    tick <- tick + 1
                result)

    /// Bilinearity — three sub-properties, each per-tick:
    ///
    ///   L1 (left-linearity):  op(a₁ + a₂, b) ≡ op(a₁, b) + op(a₂, b)
    ///   L2 (right-linearity): op(a, b₁ + b₂) ≡ op(a, b₁) + op(a, b₂)
    ///   L3 (sign-distribution): op(-a, b) ≡ -op(a, b)
    ///
    /// **Math note on L3.** Over an abelian group with standard
    /// addition (as `(+)` is for `int`, and as `ZSet.add` is for
    /// `ZSet<'K>`), L1 + L2 *imply* L3: setting `a₁ = a, a₂ = -a`
    /// in L1 gives `op(0, b) = op(a, b) + op(-a, b)`, so the
    /// classical bilinear condition `op(0, b) = 0` collapses to L3.
    /// In that regime L3 is the "first failure to fire" line of
    /// defense — an affine offset like `op(a, b) = a*b + c` breaks
    /// L1 (the constant lands once on LHS, twice on RHS) AND L3
    /// (the constant survives negation), so L1 usually trips first
    /// by check-order; L3 is the cleanup law.
    ///
    /// L3 becomes load-bearing — not redundant — when the caller-
    /// supplied `(addOut, negOut)` pair doesn't actually form an
    /// abelian group: `negOut` might not be a true inverse of
    /// `addOut`, the operations might not be associative or
    /// commutative on `'TOut`, or there might be hidden state in
    /// the supplied functions. In such cases L1 + L2 can pass while
    /// L3 catches the broken algebra — and a failure here may
    /// reflect the *supplied algebra operations* rather than the
    /// operator under test. Checking all three sub-properties keeps
    /// `checkBilinear` correct across the full range of `'TOut`
    /// algebras a plugin author might supply, not just `int` /
    /// `ZSet<_>` where the abelian-group assumption holds by
    /// construction.
    ///
    /// - `samples` — number of (A₁, A₂, B₁, B₂) quadruples.
    /// - `scheduleLength` — ticks per trace. Each per-argument trace
    ///   uses one fresh draw per tick, so longer schedules exercise
    ///   stateful bilinear ops (e.g. windowed joins).
    /// - `negIn1` — required for the L3 sign-distribution check on
    ///   the first argument. We test L3 only on the first argument
    ///   because L2 + L3-on-first + abelian-group structure imply
    ///   L3-on-second; the asymmetry is intentional, mirroring what
    ///   `IncrementalJoin` actually requires.
    /// - `negOut` — needed to form `-op(a, b)` for the L3 equality.
    let checkBilinear<'TIn1, 'TIn2, 'TOut>
        (seed: int)
        (samples: int)
        (scheduleLength: int)
        (makeOp: Stream<'TIn1> -> Stream<'TIn2> -> IOperator<'TOut>)
        (genInput1: System.Random -> 'TIn1)
        (genInput2: System.Random -> 'TIn2)
        (addIn1: 'TIn1 -> 'TIn1 -> 'TIn1)
        (negIn1: 'TIn1 -> 'TIn1)
        (addIn2: 'TIn2 -> 'TIn2 -> 'TIn2)
        (addOut: 'TOut -> 'TOut -> 'TOut)
        (negOut: 'TOut -> 'TOut)
        (equalOut: 'TOut -> 'TOut -> bool)
        : Result<unit, LawViolation> =
        if samples < 1 then
            Error (badArgs seed "samples must be >= 1")
        elif scheduleLength < 1 then
            Error (badArgs seed "scheduleLength must be >= 1")
        else
            runSamples seed samples (fun rng i ->
                // Four independent traces for the per-arg laws.
                let traceA1 = generateTrace rng scheduleLength genInput1
                let traceA2 = generateTrace rng scheduleLength genInput1
                let traceB1 = generateTrace rng scheduleLength genInput2
                let traceB2 = generateTrace rng scheduleLength genInput2

                let traceASum = List.map2 addIn1 traceA1 traceA2
                let traceBSum = List.map2 addIn2 traceB1 traceB2
                let traceANeg = traceA1 |> List.map negIn1

                // Run all the per-arg cases through the same operator
                // factory. Each run gets a fresh op instance — the
                // bilinear law applies to STATELESS bilinearity per
                // tick; stateful bilinear ops need a stronger
                // formulation (a separate law, not in scope here).
                let outA1B1     = PluginHarness.runTwoInputs makeOp traceA1 traceB1   |> List.toArray
                let outA2B1     = PluginHarness.runTwoInputs makeOp traceA2 traceB1   |> List.toArray
                let outASumB1   = PluginHarness.runTwoInputs makeOp traceASum traceB1 |> List.toArray
                let outA1B2     = PluginHarness.runTwoInputs makeOp traceA1 traceB2   |> List.toArray
                let outA1BSum   = PluginHarness.runTwoInputs makeOp traceA1 traceBSum |> List.toArray
                let outANegB1   = PluginHarness.runTwoInputs makeOp traceANeg traceB1 |> List.toArray

                let mutable result = None
                let mutable tick = 0
                while result.IsNone && tick < scheduleLength do
                    // L1: op(a₁+a₂, b) ≡ op(a₁, b) + op(a₂, b)
                    let l1Lhs = outASumB1.[tick]
                    let l1Rhs = addOut outA1B1.[tick] outA2B1.[tick]
                    if not (equalOut l1Lhs l1Rhs) then
                        result <-
                            Some (sprintf
                                     "Left-linearity broke at sample %d, tick %d: \
                                      op(a₁+a₂, b) != op(a₁, b) + op(a₂, b)."
                                     i tick)
                    else
                        // L2: op(a, b₁+b₂) ≡ op(a, b₁) + op(a, b₂)
                        let l2Lhs = outA1BSum.[tick]
                        let l2Rhs = addOut outA1B1.[tick] outA1B2.[tick]
                        if not (equalOut l2Lhs l2Rhs) then
                            result <-
                                Some (sprintf
                                         "Right-linearity broke at sample %d, tick %d: \
                                          op(a, b₁+b₂) != op(a, b₁) + op(a, b₂)."
                                         i tick)
                        else
                            // L3: op(-a, b) ≡ -op(a, b)
                            let l3Lhs = outANegB1.[tick]
                            let l3Rhs = negOut outA1B1.[tick]
                            if not (equalOut l3Lhs l3Rhs) then
                                result <-
                                    Some (sprintf
                                             "Sign-distribution broke at sample %d, tick %d: \
                                              op(-a, b) != -op(a, b). This is the failure \
                                              mode where a plugin claims IBilinearOperator \
                                              but smuggles an additive offset; the three-term \
                                              incremental-join rewrite will produce \
                                              wrong-but-quiet results under retraction."
                                             i tick)
                    // nosemgrep: plain-tick-increment -- method-local loop counter, not shared across threads
                    tick <- tick + 1
                result)

    /// Retraction completeness via state restoration.
    /// A forward trace of random Z-sets is cancelled by its
    /// elementwise negation; a continuation trace is then fed
    /// to the same op instance, and the continuation outputs
    /// are compared to a fresh-op run of the continuation
    /// alone. Any divergence means state survived the cancel.
    ///
    /// The earlier "cumulative output = 0" formulation was
    /// rejected in review: it passes trivially for empty-emitting
    /// ops, it is not the correct law for stateful-strict ops
    /// whose outputs are not themselves cancelling (e.g.
    /// integration-shaped aggregates), and a pathological op
    /// can trivially satisfy it while leaking state. State
    /// restoration is the law the tag actually promises.
    let checkRetractionCompleteness<'TIn, 'TOut when 'TIn : comparison and 'TOut : comparison>
        (seed: int)
        (samples: int)
        (scheduleLength: int)
        (continuationLength: int)
        (makeOp: Stream<ZSet<'TIn>> -> IOperator<ZSet<'TOut>>)
        (genInput: System.Random -> ZSet<'TIn>)
        : Result<unit, LawViolation> =
        if samples < 1 then
            Error (badArgs seed "samples must be >= 1")
        elif scheduleLength < 1 then
            Error (badArgs seed "scheduleLength must be >= 1")
        elif continuationLength < 1 then
            Error (badArgs seed "continuationLength must be >= 1")
        else
            runSamples seed samples (fun rng i ->
                let forward = generateTrace rng scheduleLength genInput
                let retract = forward |> List.map ZSet.neg
                let continuation = generateTrace rng continuationLength genInput
                let fullTrace = forward @ retract @ continuation
                let outFull =
                    PluginHarness.runSingleInput makeOp fullTrace
                    |> List.toArray
                let outFresh =
                    PluginHarness.runSingleInput makeOp continuation
                    |> List.toArray
                let prefix = scheduleLength + scheduleLength
                let mutable result = None
                let mutable tick = 0
                while result.IsNone && tick < continuationLength do
                    let afterCancel = outFull.[prefix + tick]
                    let fresh = outFresh.[tick]
                    let diff = ZSet.add afterCancel (ZSet.neg fresh)
                    if not diff.IsEmpty then
                        result <-
                            Some (sprintf
                                     "Retraction incomplete at sample %d, \
                                      continuation tick %d: state survived the \
                                      forward+retract cancel (diff has %d \
                                      residual entries)."
                                     i tick diff.Count)
                    // nosemgrep: plain-tick-increment -- method-local loop counter, not shared across threads
                    tick <- tick + 1
                result)
