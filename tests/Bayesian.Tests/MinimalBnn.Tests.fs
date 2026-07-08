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
