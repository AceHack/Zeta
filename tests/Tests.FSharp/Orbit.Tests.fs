module Zeta.Tests.OrbitTests

open System
open global.Xunit
open Zeta.Core

let private dist a b = Cl3.norm (Cl3.sub a b)
let private e1 = Cl3.vector 1.0 0.0 0.0

[<Fact>]
let ``identity step is a Fixed orbit (period 1, the stationary mode)`` () =
    Assert.Equal(Orbit.Fixed, Orbit.classify dist id 1e-9 32 e1)

[<Fact>]
let ``90-degree rotation is a period-4 time-crystal candidate`` () =
    let step v = Cl3.rotate (Cl3.rotor (Math.PI / 2.0) Cl3.e12) v
    Assert.Equal(Orbit.Crystal 4, Orbit.classify dist step 1e-6 32 e1)
    Assert.True(Orbit.isCrystal dist step 1e-6 32 e1)

[<Fact>]
let ``120-degree rotation is a period-3 standing wave`` () =
    let step v = Cl3.rotate (Cl3.rotor (2.0 * Math.PI / 3.0) Cl3.e12) v
    Assert.Equal(Orbit.Crystal 3, Orbit.classify dist step 1e-6 32 e1)

[<Fact>]
let ``irrational rotation is Quasiperiodic (a time quasicrystal, not random)`` () =
    let step v = Cl3.rotate (Cl3.rotor (2.0 * Math.PI * (sqrt 2.0 - 1.0)) Cl3.e12) v
    Assert.Equal(Orbit.Quasiperiodic, Orbit.classify dist step 1e-6 200 e1)
    Assert.False(Orbit.isCrystal dist step 1e-6 200 e1)

[<Fact>]
let ``period finds the smallest closing period`` () =
    let step v = Cl3.rotate (Cl3.rotor (Math.PI / 2.0) Cl3.e12) v
    Assert.Equal(Some 4, Orbit.period dist step 1e-6 32 e1)

// --- Lyapunov / the Chaotic fourth class (past the quasiperiodic edge) ---

// The logistic map at r=4 is the textbook chaotic map — analytic largest Lyapunov exponent = ln 2 ≈ 0.693.
let private logistic (x: float) = 4.0 * x * (1.0 - x)
let private absDist (a: float) (b: float) = abs (a - b)
let private nudgeF (x: float) = x + 1e-9

[<Fact>]
let ``logistic r=4 has a positive Lyapunov exponent (chaos, analytic ln 2)`` () =
    let lam = Orbit.largestLyapunov absDist logistic nudgeF 400 3 0.1234
    Assert.True(lam > 0.3, sprintf "λ = %f, expected > 0.3 (analytic ln 2 ≈ 0.693)" lam)

[<Fact>]
let ``a plane rotation has ~zero Lyapunov exponent (ordered, not chaotic)`` () =
    let th = 0.7
    let step (x, y) = (x * cos th - y * sin th, x * sin th + y * cos th)
    let d (ax, ay) (bx, by) = sqrt ((ax - bx) ** 2.0 + (ay - by) ** 2.0)
    let nudge (x, y) = (x + 1e-9, y)
    let lam = Orbit.largestLyapunov d step nudge 400 3 (1.0, 0.0)
    Assert.True(abs lam < 0.05, sprintf "λ = %f, expected ≈ 0" lam)

[<Fact>]
let ``classifyDynamics reaches the Chaotic class period-only classify cannot see`` () =
    // period-only classify would call this aperiodic orbit `Quasiperiodic` — the mislabel; the Lyapunov
    // layer catches `Chaotic` first.
    match Orbit.classifyDynamics absDist logistic nudgeF 1e-9 64 0.3 400 3 0.1234 with
    | Orbit.Chaotic lam -> Assert.True(lam > 0.3, sprintf "λ = %f" lam)
    | other -> Assert.True(false, sprintf "expected Chaotic, got %A" other)

[<Fact>]
let ``classifyDynamics does not cry chaos on an ordered fixed point`` () =
    // identity: λ = 0 (never > lyapTol) → falls through to the period classify → Fixed
    Assert.Equal(Orbit.Fixed, Orbit.classifyDynamics absDist id nudgeF 1e-9 32 0.3 100 3 0.5)

// --- PhasePortrait: faithful rasterization of the actual map ---

[<Fact>]
let ``phase portrait of a fixed point is a single mark`` () =
    let img = PhasePortrait.render (fun (x: float) -> (x, x)) (fun _ -> 0.5) 0 20 11 11 0.5
    Assert.Equal(1, img |> Seq.filter ((=) '#') |> Seq.length)

[<Fact>]
let ``phase portrait grid has exactly the requested dimensions`` () =
    let img = PhasePortrait.render (fun x -> (x, logistic x)) logistic 10 200 20 8 0.1234
    let rows = img.Split('\n')
    Assert.Equal(8, rows.Length)
    Assert.True(rows |> Array.forall (fun r -> r.Length = 20), "every row must be w wide")

[<Fact>]
let ``renderPair draws both nearby orbits on one co-scaled grid`` () =
    let th = 0.7
    let step (x, y) = (x * cos th - y * sin th, x * sin th + y * cos th)
    let img = PhasePortrait.renderPair id step 0 40 21 11 (1.0, 0.0) (2.0, 0.0)
    Assert.Contains("#", img)
    Assert.Contains("o", img)
