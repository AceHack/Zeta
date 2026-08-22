module Zeta.Bayesian.Tests.SocietyBootstrapTests

open Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Bayesian

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Make a proper Gaussian from mean and variance (both > 0).
let private gaussian (mean: float) (variance: float) : Gaussian =
    { PrecisionMean = mean / variance; Precision = 1.0 / variance }

/// Three reference-frame agents with distinct, proper priors, each naming its OWN
/// evidence source. Distinct sources, so nothing is deduplicated away.
let private threeAgents () : ReferenceFrameAgent list =
    [ ReferenceFrameAgent.attested "Agent-A" "src-A" (gaussian 0.0 1.0)
      ReferenceFrameAgent.attested "Agent-B" "src-B" (gaussian 2.0 1.0)
      ReferenceFrameAgent.attested "Agent-C" "src-C" (gaussian 1.0 4.0) ]

let private unwrapScore = function
    | Ok v -> v
    | Error e -> failwithf "society refused: %A" e

// ---------------------------------------------------------------------------
// SB-1: The joint posterior is proper (soft-mode invariant holds at runtime)
// ---------------------------------------------------------------------------
[<Fact>]
let ``SB-1 joint marginal is always proper`` () =
    let result = SocietyNetwork.run 100 1e-6 (threeAgents ())
    Assert.True(result.IsProper,
        sprintf "Joint marginal is improper: tau=%.4f" result.JointMarginal.Precision)

// ---------------------------------------------------------------------------
// SB-2: The joint posterior is strictly more precise than any single agent
// ---------------------------------------------------------------------------
[<Fact>]
let ``SB-2 joint precision strictly dominates every solo posterior`` () =
    let agents = threeAgents ()
    let result = SocietyNetwork.run 100 1e-6 agents
    let jointPrecision = result.JointMarginal.Precision
    for KeyValue(id, solo) in result.SoloPosteriors do
        Assert.True(jointPrecision > solo.Precision,
            sprintf "Joint tau=%.4f did not dominate %s solo tau=%.4f"
                jointPrecision id solo.Precision)

// ---------------------------------------------------------------------------
// SB-3: Every agent has a positive precision gain (every frame is load-bearing)
// ---------------------------------------------------------------------------
[<Fact>]
let ``SB-3 every agent has positive precision gain from joining the society`` () =
    let result = SocietyNetwork.run 100 1e-6 (threeAgents ())
    for KeyValue(id, gain) in result.PrecisionGains do
        Assert.True(gain > 0.0,
            sprintf "%s has non-positive precision gain: %.4f" id gain)

// ---------------------------------------------------------------------------
// SB-4: Removing any agent degrades the joint (mutual empowerment observable)
// ---------------------------------------------------------------------------
[<Fact>]
let ``SB-4 removing any agent degrades the joint posterior`` () =
    let agents = threeAgents ()
    let full = SocietyNetwork.run 100 1e-6 agents
    let fullPrecision = full.JointMarginal.Precision
    for agent in agents do
        let reduced = SocietyNetwork.runWithout 100 1e-6 agent.Id agents
        Assert.True(reduced.Precision < fullPrecision,
            sprintf "Removing %s did not degrade joint: full tau=%.4f, reduced tau=%.4f"
                agent.Id fullPrecision reduced.Precision)

// ---------------------------------------------------------------------------
// SB-5: The mutual empowerment score is positive
// ---------------------------------------------------------------------------
[<Fact>]
let ``SB-5 mutual empowerment score is positive`` () =
    let score = SocietyNetwork.mutualEmpowermentScore 100 1e-6 (threeAgents ()) |> unwrapScore
    Assert.True(score > 0.0, sprintf "Mutual empowerment score is non-positive: %.4f" score)

// ---------------------------------------------------------------------------
// SB-6: The network converges (runToFixpoint terminates before maxRounds)
// ---------------------------------------------------------------------------
[<Fact>]
let ``SB-6 network converges within 100 rounds`` () =
    let result = SocietyNetwork.run 100 1e-6 (threeAgents ())
    Assert.True(result.Rounds < 100, sprintf "Network did not converge: %d rounds" result.Rounds)

// ---------------------------------------------------------------------------
// SB-7: The joint mean is a precision-weighted average of the agent priors
// ---------------------------------------------------------------------------
[<Fact>]
let ``SB-7 joint mean is the precision-weighted average of agent priors`` () =
    let agents = threeAgents ()
    let result = SocietyNetwork.run 100 1e-6 agents
    let totalPM = agents |> List.sumBy (fun a -> a.Prior.PrecisionMean)
    let totalP = agents |> List.sumBy (fun a -> a.Prior.Precision)
    let expectedMean = totalPM / totalP
    let actualMean = result.JointMarginal.PrecisionMean / result.JointMarginal.Precision
    Assert.True(abs (actualMean - expectedMean) < 1e-4,
        sprintf "Joint mean mismatch: expected %.4f, got %.4f" expectedMean actualMean)

// ---------------------------------------------------------------------------
// SB-8 (FsCheck): For any 2 proper agents on DISTINCT sources, the joint is
//                 more precise than every solo
// ---------------------------------------------------------------------------
[<Property(MaxTest = 200)>]
let ``SB-8 Condorcet holds for any 2 proper agents on distinct sources``
    (PositiveInt p1raw) (NormalFloat pm1raw)
    (PositiveInt p2raw) (NormalFloat pm2raw) =
    let p1 = float (max 1 p1raw)
    let p2 = float (max 1 p2raw)
    let agents =
        [ ReferenceFrameAgent.attested "A0" "s0" { PrecisionMean = pm1raw * p1; Precision = p1 }
          ReferenceFrameAgent.attested "A1" "s1" { PrecisionMean = pm2raw * p2; Precision = p2 } ]
    let result = SocietyNetwork.run 200 1e-6 agents
    let jointP = result.JointMarginal.Precision
    result.IsProper && (result.SoloPosteriors |> Map.forall (fun _ solo -> jointP > solo.Precision))

// ---------------------------------------------------------------------------
// SB-9 (FsCheck): Mutual empowerment score is always positive for 2 agents
//                 on distinct sources
// ---------------------------------------------------------------------------
[<Property(MaxTest = 200)>]
let ``SB-9 mutual empowerment score is always positive for 2 agents``
    (PositiveInt p1raw) (NormalFloat pm1raw)
    (PositiveInt p2raw) (NormalFloat pm2raw) =
    let p1 = float (max 1 p1raw)
    let p2 = float (max 1 p2raw)
    let agents =
        [ ReferenceFrameAgent.attested "A0" "s0" { PrecisionMean = pm1raw * p1; Precision = p1 }
          ReferenceFrameAgent.attested "A1" "s1" { PrecisionMean = pm2raw * p2; Precision = p2 } ]
    match SocietyNetwork.mutualEmpowermentScore 200 1e-6 agents with
    | Ok score -> score > 0.0
    | Error _ -> false

// ---------------------------------------------------------------------------
// SB-10: Demo output
// ---------------------------------------------------------------------------
[<Fact>]
let ``SB-10 demo: 3-agent society bootstrap output`` () =
    let result = SocietyNetwork.run 100 1e-6 (threeAgents ())
    printfn "%s" (SocietyNetwork.describe result)
    Assert.True(true)

// ---------------------------------------------------------------------------
// B3 regression: shared evidence is counted ONCE
//
// Before admission deduplicated on provenance, six agents fed one data stream
// folded to precision 66.0 - the stream counted once per agent - and nothing in
// the fold could notice, because for proper messages the product is monotone in
// precision so no admissible input can say "this was already counted".
// ---------------------------------------------------------------------------

/// The shared observation stream every agent read: 10 observations of 10.0 with
/// unit variance.
let private sharedStream : Gaussian = { PrecisionMean = 100.0; Precision = 10.0 }

/// `n` agents, each with its OWN prior N(0,1) and all resting on the SAME stream.
let private agentsOnOneStream (n: int) : ReferenceFrameAgent list =
    [ for i in 1 .. n ->
        ReferenceFrameAgent.ofSources
            (sprintf "agent-%d" i)
            [ sprintf "prior-%d" i, gaussian 0.0 1.0
              "stream-S", sharedStream ] ]

[<Fact>]
let ``SB-11 evidence shared by many members is counted once`` () =
    let agents = agentsOnOneStream 3
    let result = SocietyNetwork.run 100 1e-9 agents
    // Three independent priors (tau 1 each) plus ONE stream (tau 10).
    Assert.Equal(4, result.DistinctAtoms)
    // What the pre-change fold published: the exact SUM of member precisions, i.e.
    // the stream counted once per member. Pinned here so a regression is loud.
    let naive = agents |> List.sumBy (fun a -> a.Prior.Precision)
    Assert.True(abs (naive - 33.0) < 1e-9, sprintf "naive sum was %.10f, expected 33.0" naive)
    Assert.True(result.JointMarginal.Precision < naive,
        sprintf "joint tau %.10f did not improve on the naive sum %.10f"
            result.JointMarginal.Precision naive)
    Assert.True(abs (result.JointMarginal.Precision - 13.0) < 1e-9,
        sprintf "joint tau was %.10f, expected 13.0 (naive double counting gives 33.0)"
            result.JointMarginal.Precision)
    Assert.True(abs (Gaussian.mean result.JointMarginal - (100.0 / 13.0)) < 1e-9,
        sprintf "joint mean was %.10f, expected %.10f"
            (Gaussian.mean result.JointMarginal) (100.0 / 13.0))

[<Fact>]
let ``SB-12 a member bringing only shared evidence is not load-bearing`` () =
    // A brings a unique prior AND the stream; B brings ONLY the stream. Removing B
    // must change nothing - which is the honest reading the old fold could not give,
    // because it scored B as if it had contributed a whole second copy.
    let a = ReferenceFrameAgent.ofSources "A" [ "prior-A", gaussian 0.0 1.0; "stream-S", sharedStream ]
    let b = ReferenceFrameAgent.ofSources "B" [ "stream-S", sharedStream ]
    let agents = [ a; b ]
    let full = SocietyNetwork.run 100 1e-9 agents
    let without = SocietyNetwork.runWithout 100 1e-9 "B" agents
    Assert.True(abs (full.JointMarginal.Precision - without.Precision) < 1e-9,
        sprintf "removing a fully-redundant member changed the joint: %.10f -> %.10f"
            full.JointMarginal.Precision without.Precision)
    let score = SocietyNetwork.mutualEmpowermentScore 100 1e-9 agents |> unwrapScore
    Assert.True(abs score < 1e-9, sprintf "expected zero empowerment, got %.10f" score)

[<Fact>]
let ``SB-13 unattested evidence refuses to publish an empowerment number`` () =
    let agents =
        [ ReferenceFrameAgent.unattested "A" (gaussian 0.0 1.0)
          ReferenceFrameAgent.unattested "B" (gaussian 2.0 1.0) ]
    let result = SocietyNetwork.run 100 1e-9 agents
    match result.Reading with
    | UnattestedAtoms 2 -> ()
    | other -> failwithf "expected UnattestedAtoms 2, got %A" other
    match SocietyNetwork.mutualEmpowermentScore 100 1e-9 agents with
    | Error(EvidenceNotAttested 2) -> ()
    | other -> failwithf "expected a refusal naming 2 unattested atoms, got %A" other

[<Fact>]
let ``SB-14 attested evidence reports Deduplicated with the distinct source count`` () =
    let result = SocietyNetwork.run 100 1e-9 (agentsOnOneStream 3)
    match result.Reading with
    | Deduplicated 4 -> ()
    | other -> failwithf "expected Deduplicated 4, got %A" other

// ---------------------------------------------------------------------------
// SB-15: SELF-SIMILARITY (manifesto §9 recursive, §10 self-similar)
//
// Folding members into societies and societies into a world must give the same
// answer as folding every member flat. This is the falsifier for the claim that
// individual, society and world share one interface: if the fold were not a
// join-semilattice - if the result did not carry the union of its inputs
// provenance - grouping would change the answer and the interface would need a
// special case at one scale.
// ---------------------------------------------------------------------------
[<Fact>]
let ``SB-15 folding societies of societies equals folding members flat`` () =
    let members = agentsOnOneStream 6
    let flat = SocietyNetwork.run 100 1e-9 members

    /// A sub-society, presented to the next scale up AS A MEMBER. Same type, no
    /// special case - that is the whole claim.
    let asMember (id: string) (group: ReferenceFrameAgent list) : ReferenceFrameAgent =
        let evidence, _ = group |> List.map (fun a -> a.Evidence) |> Attested.admit
        { Id = id; Evidence = evidence }

    let world =
        SocietyNetwork.run 100 1e-9
            [ asMember "society-1" (members |> List.take 3)
              asMember "society-2" (members |> List.skip 3) ]

    Assert.Equal(flat.DistinctAtoms, world.DistinctAtoms)
    Assert.True(abs (flat.JointMarginal.Precision - world.JointMarginal.Precision) < 1e-9,
        sprintf "grouping changed the joint precision: flat %.10f vs world %.10f"
            flat.JointMarginal.Precision world.JointMarginal.Precision)
    Assert.True(abs (flat.JointMarginal.PrecisionMean - world.JointMarginal.PrecisionMean) < 1e-9,
        sprintf "grouping changed the joint precision-mean: flat %.10f vs world %.10f"
            flat.JointMarginal.PrecisionMean world.JointMarginal.PrecisionMean)
