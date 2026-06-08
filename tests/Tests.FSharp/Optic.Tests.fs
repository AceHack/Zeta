module Zeta.Tests.OpticTests

open global.Xunit
open Zeta.Core
open Zeta.Core.Optic

// a small nested record to focus into
type private Addr = { City: string }
type private Person = { Name: string; Addr: Addr }

let private cityL: Lens<Addr, string> =
    { Get = (fun a -> a.City); Set = fun c a -> { a with City = c } }

let private addrL: Lens<Person, Addr> =
    { Get = (fun p -> p.Addr); Set = fun a p -> { p with Addr = a } }

let private p0 = { Name = "Aaron"; Addr = { City = "Rolesville" } }

// ── Lens laws ──
[<Fact>]
let ``lens law: get-set (setting what you got changes nothing)`` () =
    Assert.Equal<Person>(p0, addrL.Set (addrL.Get p0) p0)

[<Fact>]
let ``lens law: set-get (you get back what you set)`` () =
    let a = { City = "Henderson" }
    Assert.Equal<Addr>(a, addrL.Get(addrL.Set a p0))

[<Fact>]
let ``lens law: set-set (last set wins)`` () =
    let a1 = { City = "A" }
    let a2 = { City = "B" }
    Assert.Equal<Person>(addrL.Set a2 p0, addrL.Set a2 (addrL.Set a1 p0))

[<Fact>]
let ``compose focuses deep: person -> addr -> city`` () =
    let cityOfPerson = compose addrL cityL
    Assert.Equal("Rolesville", cityOfPerson.Get p0)
    Assert.Equal("Henderson", (cityOfPerson.Set "Henderson" p0).Addr.City)

[<Fact>]
let ``over modifies through the lens`` () =
    let cityOfPerson = compose addrL cityL
    Assert.Equal("ROLESVILLE", (over cityOfPerson (fun (s: string) -> s.ToUpperInvariant()) p0).Addr.City)

[<Fact>]
let ``mapKey lens reads with fallback and writes`` () =
    let l = mapKey "k" "default"
    Assert.Equal("default", l.Get Map.empty)
    Assert.Equal("v", l.Get(l.Set "v" Map.empty))

// ── Store comonad ──
let private grid = [| 10; 20; 30; 40 |]
let private w0: Store<int, int> = store (fun i -> grid.[i]) 1

[<Fact>]
let ``store extract reads at the current position`` () =
    Assert.Equal(20, extract w0)

[<Fact>]
let ``seek re-aims the pointer; extract reads there`` () =
    Assert.Equal(30, extract (seek 2 w0))

[<Fact>]
let ``comonad law: extend extract = identity (extract everywhere reproduces the store)`` () =
    let w' = extend extract w0
    Assert.Equal(extract w0, extract w')
    Assert.Equal(extract (seek 3 w0), extract (seek 3 w'))

[<Fact>]
let ``extend gives context-dependent reads (neighbour sum via seek)`` () =
    // at each position, read self + left neighbour (clamped) — the universal-pointer-with-context
    let withLeft (s: Store<int, int>) =
        let here = extract s
        let left = if s.Pos > 0 then extract (seek (s.Pos - 1) s) else 0
        here + left
    let w' = extend withLeft w0
    Assert.Equal(20 + 10, extract w') // pos 1: 20 + 10
    Assert.Equal(40 + 30, extract (seek 3 w')) // pos 3: 40 + 30
