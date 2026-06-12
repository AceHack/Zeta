module Zeta.Tests.BallTests

// Ball — the metric register's laws, each with its falsifier (workitem 081KTWFYC9...):
// exactness ⇔ radius 0; CONTAINMENT (the true value never escapes); lossy ops WIDEN never round;
// comparisons return Tri (N on overlap — predicates refuse to lie).

open System.Numerics
open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core
open Zeta.Core.FSharp.TriBoolean

let private big (i: int) = BigInteger(i)
let private ball c r = match Ball.create (big c) (big r) with Ok b -> b | Error e -> failwith e

[<Fact>]
let ``LAW 1 — exact iff radius zero, and a negative radius is REFUSED never absorbed`` () =
    Assert.True(Ball.universal.IsExact (Ball.exact (big 42)))
    Assert.False(Ball.universal.IsExact (ball 42 1))
    match Ball.create (big 1) (big -1) with
    | Ok _ -> failwith "negative radius must refuse"
    | Error e -> Assert.Contains("uncertainty has no sign", e)

[<Fact>]
let ``LAW 2 — add and mul follow Moore exactly: radii add; product bound |a|·rb + |b|·ra + ra·rb`` () =
    let s = Ball.add (ball 10 2) (ball -4 3)
    Assert.Equal(big 6, s.Center)
    Assert.Equal(big 5, s.Radius)
    let p = Ball.mul (ball 10 2) (ball -4 3)
    Assert.Equal(big -40, p.Center)
    Assert.Equal(big (10 * 3 + 4 * 2 + 2 * 3), p.Radius) // 44
    // exact × exact stays exact (no phantom widening)
    Assert.True(Ball.universal.IsExact (Ball.mul (Ball.exact (big 7)) (Ball.exact (big -9))))

[<Property(MaxTest = 200)>]
let ``LAW 2 PROPERTY — containment: any points inside the inputs land inside the output, for add and mul`` (ac: int) (ar: byte) (da: byte) (bc: int) (br: byte) (db: byte) =
    let a = ball ac (int ar)
    let b = ball bc (int br)
    // pick concrete points inside each ball (offset clamped into the radius)
    let pa = a.Center + BigInteger(int da % (int ar + 1)) * BigInteger(if int da % 2 = 0 then 1 else -1)
    let pb = b.Center + BigInteger(int db % (int br + 1)) * BigInteger(if int db % 2 = 0 then 1 else -1)
    Ball.contains (pa + pb) (Ball.add a b) && Ball.contains (pa * pb) (Ball.mul a b)

[<Property(MaxTest = 200)>]
let ``LAW 3 PROPERTY — shed WIDENS never rounds: the original ball stays inside the shed ball, and the loss is accounted in the radius`` (c: int) (r: byte) (bitsRaw: byte) =
    let bits = (int bitsRaw % 12) + 1
    let a = ball c (int r)
    let s = Ball.shed bits a
    let grid = BigInteger.Pow(BigInteger(2), bits)
    // center landed on the grid, radius grew by exactly the distance moved, value contained
    s.Center % grid = BigInteger.Zero
    && s.Radius - a.Radius = a.Center - s.Center
    && Ball.contains a.Center s

[<Fact>]
let ``LAW 4 — comparisons return Tri: disjoint decides, overlap HOLDS (N), touching holds too`` () =
    Assert.Equal(Tri.T, Ball.lt (ball 0 2) (ball 10 2)) // [-2,2] < [8,12] — certain
    Assert.Equal(Tri.F, Ball.lt (ball 10 2) (ball 0 2)) // certain the other way
    Assert.Equal(Tri.N, Ball.lt (ball 0 5) (ball 4 5)) // overlap — refuse to lie
    Assert.Equal(Tri.N, Ball.lt (ball 0 2) (ball 4 2)) // touching at 2 — still held
    Assert.Equal(Tri.T, Ball.eq (Ball.exact (big 7)) (Ball.exact (big 7)))
    Assert.Equal(Tri.F, Ball.eq (Ball.exact (big 7)) (Ball.exact (big 8)))
    Assert.Equal(Tri.F, Ball.eq (ball 0 1) (ball 10 1)) // disjoint — certainly unequal
    Assert.Equal(Tri.N, Ball.eq (ball 0 3) (ball 2 3)) // overlap — held

[<Fact>]
let ``THE PORT — BitsUsed is the signal above the noise; Zero and One are exact`` () =
    let u = Ball.universal
    Assert.True(u.IsExact u.Zero && u.IsExact u.One)
    Assert.Equal(11, u.BitsUsed (Ball.exact (big 1024))) // exact: every bit is signal
    Assert.Equal(9, u.BitsUsed (ball 1024 3)) // bitlen 11 − bitlen 2 = 9 meaningful bits
    Assert.Equal(0, u.BitsUsed (ball 7 100)) // noise taller than signal: nothing meaningful
