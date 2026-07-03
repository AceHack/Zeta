namespace Zeta.Bayesian.Tests

open System
open Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Bayesian

module ThousandBrainsTests =

    [<Fact>]
    let ``TB-1: New column has zero IV and uninformative prior`` () =
        let col = ThousandBrains.createColumn "C1"
        Assert.Equal(0.0, float col.AccumulatedIV)
        Assert.Equal(0.0, col.Belief.Precision)
        Assert.Equal(0.0, col.Belief.PrecisionMean)

    [<Fact>]
    let ``TB-2: Observation increases accumulated IV`` () =
        let col = ThousandBrains.createColumn "C1"
        let obs = { Gaussian.PrecisionMean = 1.0; Precision = 1.0 }
        
        let updatedCol = ThousandBrains.observe col obs
        
        Assert.True(float updatedCol.AccumulatedIV > 0.0, "IV should increase after informative observation")
        Assert.Equal(1.0, updatedCol.Belief.Precision)

    [<Fact>]
    let ``TB-3: Voting weight scales logarithmically with IV`` () =
        let colLow = { ThousandBrains.createColumn "C1" with AccumulatedIV = 10.0<InformationValue.iv> }
        let colHigh = { ThousandBrains.createColumn "C2" with AccumulatedIV = 100.0<InformationValue.iv> }
        
        let voteLow = ThousandBrains.castVote colLow
        let voteHigh = ThousandBrains.castVote colHigh
        
        Assert.True(voteHigh.Weight > voteLow.Weight, "Higher IV should yield higher voting weight")
        // 100 is 10x larger than 10, but log weight should be less than 10x larger
        Assert.True(voteHigh.Weight < voteLow.Weight * 10.0, "Weight scaling should be sub-linear (logarithmic)")

    [<Fact>]
    let ``TB-4: Consensus weights beliefs by IV`` () =
        // Column 1 is highly experienced (high IV) and votes YES (mean = 1.0)
        let col1 = 
            { ThousandBrains.createColumn "C1" with 
                AccumulatedIV = 1000.0<InformationValue.iv>
                Belief = { Gaussian.PrecisionMean = 1.0; Precision = 1.0 } }
                
        // Column 2 is inexperienced (low IV) and votes NO (mean = -1.0)
        let col2 = 
            { ThousandBrains.createColumn "C2" with 
                AccumulatedIV = 1.0<InformationValue.iv>
                Belief = { Gaussian.PrecisionMean = -1.0; Precision = 1.0 } }
                
        let votes = [ ThousandBrains.castVote col1; ThousandBrains.castVote col2 ]
        let consensus = ThousandBrains.computeConsensus votes
        
        // The consensus mean should be pulled toward the highly experienced column
        let consensusMean = consensus.PrecisionMean / consensus.Precision
        Assert.True(consensusMean > 0.0, "Consensus should lean toward the higher-IV column")

    [<Fact>]
    let ``TB-5: Lattice reaches consensus when joint precision crosses threshold`` () =
        let col1 = 
            { ThousandBrains.createColumn "C1" with 
                AccumulatedIV = 10.0<InformationValue.iv>
                Belief = { Gaussian.PrecisionMean = 2.0; Precision = 2.0 } } // mean = 1.0
                
        let col2 = 
            { ThousandBrains.createColumn "C2" with 
                AccumulatedIV = 10.0<InformationValue.iv>
                Belief = { Gaussian.PrecisionMean = 2.0; Precision = 2.0 } } // mean = 1.0
                
        let votes = [ ThousandBrains.castVote col1; ThousandBrains.castVote col2 ]
        
        // Weight = ln(11) ≈ 2.4
        // Joint Precision = 2.0 * 2.4 + 2.0 * 2.4 = 9.6
        
        let undecidedResult = ThousandBrains.evaluateLattice votes 10.0
        let decidedResult = ThousandBrains.evaluateLattice votes 9.0
        
        match undecidedResult with
        | LocalConsensus.Undecided _ -> ()
        | _ -> Assert.Fail("Should be Undecided")
        
        match decidedResult with
        | LocalConsensus.ResolvedYes _ -> ()
        | _ -> Assert.Fail("Should be ResolvedYes")

    [<Property>]
    let ``TB-6: Consensus precision is strictly non-negative`` (pairs: (NormalFloat * NormalFloat) list) =
        // Generate a list of valid votes from paired floats
        let validPairs = 
            pairs
            |> List.map (fun (w, p) -> abs (float w) + 0.01, abs (float p))
            
        let votes = 
            validPairs |> List.mapi (fun i (w, p) ->
                { ThousandBrains.Vote.ColumnId = sprintf "C%d" i
                  ThousandBrains.Vote.Belief = { Gaussian.PrecisionMean = 0.0; Precision = p }
                  ThousandBrains.Vote.Weight = w })
                  
        let consensus = ThousandBrains.computeConsensus votes
        consensus.Precision >= 0.0
