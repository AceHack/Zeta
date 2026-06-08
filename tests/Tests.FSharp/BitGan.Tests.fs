module Zeta.Tests.BitGanTests

open global.Xunit
open Zeta.Core
open Zeta.Core.BitGan

let private ln2 = log 2.0

[<Fact>]
let ``entropy is maximal (ln2) at p=0.5 and zero at a determined bit`` () =
    Assert.True(abs (entropy (init 0.5 0.5) - ln2) < 1e-12)
    Assert.Equal(0.0, entropy (init 1.0 0.5))
    Assert.Equal(0.0, entropy (init 0.0 0.5))

[<Fact>]
let ``step moves the generator toward 0.5 (max entropy / unpredictability)`` () =
    let g = init 0.9 0.1
    let g' = step 0.5 g
    Assert.True(abs (g'.GenP - 0.5) < abs (g.GenP - 0.5))

[<Fact>]
let ``run converges to the matching-pennies Nash (0.5, 0.5) = identity preserved (#7090/#7101)`` () =
    let g = run 0.3 200 (init 0.95 0.05)
    Assert.True(converged 1e-6 g)
    Assert.True(abs (entropy g - ln2) < 1e-6) // max entropy = identity bit maximally preserved

[<Fact>]
let ``deterministic / replayable (DST): same input, same trajectory`` () =
    let a = run 0.3 50 (init 0.8 0.2)
    let b = run 0.3 50 (init 0.8 0.2)
    Assert.Equal<BitGan>(a, b)

[<Fact>]
let ``transparent step PEEKS (no privacy): discriminator tracks the generator -> trivial (#7084)`` () =
    // step lets DiscQ chase GenP directly; after convergence DiscQ ≈ GenP (the no-privacy collapse)
    let g = run 0.3 200 (init 0.7 0.0)
    Assert.True(abs (g.DiscQ - g.GenP) < 1e-6)

[<Fact>]
let ``confined stepObserved (privacy barrier #7104-#7106): from a fair bit-stream the discriminator cannot beat chance`` () =
    // generator already at p=0.5 (max entropy); a fair, hidden bit-stream (alternating 0/1 — unbiased) is the
    // only thing the discriminator can reach. Its guess DiscQ converges to 0.5, never beating chance.
    let mutable g = init 0.5 0.0
    for i in 0..399 do
        g <- stepObserved 0.1 (i % 2) g
    Assert.True(abs (g.DiscQ - 0.5) < 0.05) // can't stably beat chance => identity stays private (#7090)

[<Fact>]
let ``stepObserved updates only from the observed bit, never GenP (capability-confined)`` () =
    // GenP at 0.5 stays ~0.5; a constant observed bit pulls DiscQ toward that bit (it sees outputs only)
    let g = init 0.5 0.5
    let g1 = stepObserved 0.5 1 g
    Assert.True(g1.DiscQ > g.DiscQ) // moved toward the observed 1
    Assert.True(abs (g1.GenP - 0.5) < 1e-9) // generator unmoved at the fixed point

[<Fact>]
let ``probe ends UNDECIDED at the turn budget: an adaptive generator flees to the 0.5 fixed point and evades (#7090/#7107/#7108)`` () =
    // Under symmetric dynamics the generator always flees to the matching-pennies fixed point (0.5) — it
    // EVADES; the discriminator never crosses the discovery threshold. Budget exhausts -> Undecided.
    match probe 0.3 0.3 200 (init 0.95 0.5) |> fst with
    | Undecided turns -> Assert.Equal(200, turns)
    | Discovered _ -> failwith "an adaptive generator should evade to the fixed point, not be discovered"

[<Fact>]
let ``a STUCK (deterministic, non-adaptive) generator IS discovered: biased observed stream crosses the threshold (#7107)`` () =
    // A generator that does not flee — a deterministic bit-stream (all 1s) — is caught: stepObserved drives
    // DiscQ toward 1, edge past the threshold. (Discovery happens against a non-adaptive/compressible source.)
    let mutable g = init 0.95 0.5
    let mutable discoveredAt = -1
    let mutable turn = 0
    while turn < 1000 && discoveredAt < 0 do
        g <- stepObserved 0.3 1 g // deterministic generator emits 1
        turn <- turn + 1
        if discriminatorEdge g >= 0.3 then discoveredAt <- turn
    Assert.True(discoveredAt > 0 && discoveredAt < 1000)
