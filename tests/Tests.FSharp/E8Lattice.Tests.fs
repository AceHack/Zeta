module Zeta.Tests.E8LatticeTests

// Construction A over the in-tree [8,4] code IS the E8 root lattice — ferry 26 link 3, tested.
// The falsifier Aaron's claim invited: 240 roots or bust.

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

[<Fact>]
let ``THE 240: the adinkra code's Construction-A lattice has exactly the E8 kissing number`` () =
    Assert.Equal(240, E8Lattice.kissingNumber)

[<Fact>]
let ``every root has norm² exactly 4 and is a lattice member`` () =
    for r in E8Lattice.roots do
        Assert.Equal(4, E8Lattice.normSq r)
        Assert.True(E8Lattice.isMember r)

[<Fact>]
let ``the roots are distinct and closed under negation`` () =
    let set = E8Lattice.roots |> List.map (Array.toList) |> Set.ofList
    Assert.Equal(240, Set.count set)
    for r in E8Lattice.roots do
        Assert.True(set.Contains(r |> Array.map (~-) |> Array.toList), "negation must be a root")

let private randomMember (m: int) (lift: int[]) : int[] =
    // a lattice member: codeword (from message bits m) + 2·(arbitrary integer lift)
    let c = AdinkraCode.encode [| for i in 0 .. 3 -> (m >>> i) &&& 1 |]
    Array.init AdinkraCode.length (fun j -> c.[j] + 2 * lift.[j])

[<Property>]
let ``EVEN LATTICE from doubly-evenness: every member's norm² ≡ 0 (mod 4)`` (m: int) (l0: int) (l1: int) (l2: int) (l3: int) (l4: int) (l5: int) (l6: int) (l7: int) =
    let lift = [| l0; l1; l2; l3; l4; l5; l6; l7 |] |> Array.map (fun v -> v % 5)
    let x = randomMember (abs m % 16) lift
    E8Lattice.normSq x % 4 = 0

[<Property>]
let ``the lattice is closed under addition (linearity of the code lifts)`` (m1: int) (m2: int) (l1: int) (l2: int) =
    let a = randomMember (abs m1 % 16) (Array.create 8 (l1 % 3))
    let b = randomMember (abs m2 % 16) (Array.create 8 (l2 % 3))
    E8Lattice.isMember (Array.map2 (+) a b)

[<Property>]
let ``membership is exactly the Construction-A spec: x ∈ L ⟺ x mod 2 ∈ C`` (m: int) (noise: int) =
    // a member stays a member; flipping ONE coordinate by 1 leaves the coset of a non-codeword
    // (min distance 4 ⇒ one bit off a codeword is never a codeword)
    let x = randomMember (abs m % 16) (Array.create 8 (noise % 3))
    let y = Array.copy x
    y.[abs noise % 8] <- y.[abs noise % 8] + 1
    E8Lattice.isMember x && not (E8Lattice.isMember y)
