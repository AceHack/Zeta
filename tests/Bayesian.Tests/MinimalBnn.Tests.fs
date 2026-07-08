namespace Zeta.Bayesian.Tests

open Xunit
open Zeta.Bayesian

module MinimalBnnTests =

    let private fixtureObservations =
        [| 0.95; 1.10; 0.88; 1.04; 0.99; 1.07; 0.92; 1.01 |]

    let private requireOk (result: Result<'T, string>) : 'T =
        match result with
        | Ok value -> value
        | Error message -> failwith message

    let private initialState () =
        MinimalBnn.tryCreate (Gaussian.ofMeanVariance 0.0 4.0) 0.25
        |> requireOk

    let private runFixture () =
        initialState ()
        |> MinimalBnn.infer fixtureObservations
        |> requireOk

    [<Fact>]
    let ``MBNN-1: informative fixture accumulates positive IV`` () =
        let finalState = runFixture ()
        Assert.Equal(fixtureObservations.Length, finalState.Objective.ObservationCount)
        Assert.True(
            finalState.Objective.CumulativeIv > 0.0<InformationValue.iv>,
            sprintf "cumulative IV should be positive, got %g nats" (float finalState.Objective.CumulativeIv))

    [<Fact>]
    let ``MBNN-2: posterior precision increases versus prior`` () =
        let startState = initialState ()
        let finalState = runFixture ()
        Assert.True(
            finalState.Posterior.Precision > startState.Posterior.Precision,
            sprintf "posterior precision %g <= prior precision %g" finalState.Posterior.Precision startState.Posterior.Precision)

    [<Fact>]
    let ``MBNN-3: deterministic fixture replays exactly`` () =
        let first = runFixture ()
        let second = runFixture ()
        Assert.Equal(first.Objective.CumulativeIv, second.Objective.CumulativeIv)
        Assert.Equal(first.Posterior.Precision, second.Posterior.Precision)
        Assert.Equal(Gaussian.mean first.Posterior, Gaussian.mean second.Posterior)

    [<Fact>]
    let ``MBNN-4: linear regression converges with arbitrary features x`` () =
        let trueW = 2.5
        let observationVariance = 0.5
        let startState = 
            MinimalBnn.tryCreate (Gaussian.ofMeanVariance 0.0 10.0) observationVariance
            |> requireOk
            
        let observations = [|
            (1.0, 2.7)
            (2.0, 4.9)
            (-1.0, -2.4)
            (3.0, 7.6)
            (-2.0, -5.1)
            (1.5, 3.8)
            (-0.5, -1.2)
            (2.5, 6.2)
        |]
        
        let finalState =
            observations
            |> Array.fold (fun stateOpt (x, y) ->
                match stateOpt with
                | Ok state -> MinimalBnn.updateWithFeature x y state
                | Error msg -> Error msg
            ) (Ok startState)
            |> requireOk
            
        let postMean = finalState.Posterior.PrecisionMean / finalState.Posterior.Precision
        
        Assert.True(abs (postMean - trueW) < 0.2, sprintf "posterior mean %g should converge to trueW %g" postMean trueW)
        Assert.True(finalState.Posterior.Precision > startState.Posterior.Precision)
        Assert.True(finalState.Objective.CumulativeIv > 0.0<InformationValue.iv>)
