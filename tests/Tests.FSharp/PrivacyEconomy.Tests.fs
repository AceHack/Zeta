module Zeta.Tests.PrivacyEconomyTests

open global.Xunit
open Zeta.Core

// good-use -> budget grant: 1 byte of budget per unit of revealed good use (rounded)
let private gainOf (revealed: float) : int = int (round revealed)

[<Fact>]
let ``reward grows a persona's budget by revealed good use, capped`` () =
    let l = Map.empty |> PrivacyEconomy.reward gainOf 100 { Persona = "otto"; Revealed = 8.0 }
    Assert.Equal(8, PrivacyEconomy.budget "otto" l)
    let l2 = l |> PrivacyEconomy.reward gainOf 100 { Persona = "otto"; Revealed = 5.0 }
    Assert.Equal(13, PrivacyEconomy.budget "otto" l2) // accumulates
    let capped = l2 |> PrivacyEconomy.reward gainOf 100 { Persona = "otto"; Revealed = 1000.0 }
    Assert.Equal(100, PrivacyEconomy.budget "otto" capped) // capped

[<Fact>]
let ``self-regulating: each persona's budget reflects its own revealed good use (decentralized)`` () =
    let l =
        PrivacyEconomy.settle gainOf 1000
            [ { Persona = "thrifty"; Revealed = 2.0 }
              { Persona = "productive"; Revealed = 20.0 } ]
            Map.empty
    Assert.Equal(2, PrivacyEconomy.budget "thrifty" l)
    Assert.Equal(20, PrivacyEconomy.budget "productive" l)
    // the productive persona earned more privacy budget
    Assert.Equal<(string * int) list>([ "productive", 20; "thrifty", 2 ], PrivacyEconomy.ranking l)

[<Fact>]
let ``ROI: good use per unit budget; new productive persona reads infinity (grant it budget)`` () =
    let l = Map.ofList [ "veteran", 100 ]
    Assert.Equal(0.1, PrivacyEconomy.roi { Persona = "veteran"; Revealed = 10.0 } l, 9) // 10/100
    Assert.Equal(infinity, PrivacyEconomy.roi { Persona = "newcomer"; Revealed = 5.0 } l) // 0 budget + good use

[<Fact>]
let ``no revealed good use earns no budget (you must demonstrate use to grow)`` () =
    let l = Map.empty |> PrivacyEconomy.reward gainOf 100 { Persona = "idle"; Revealed = 0.0 }
    Assert.Equal(0, PrivacyEconomy.budget "idle" l)

[<Fact>]
let ``rewardByMixture: a MIXTURE OF PERSONAS scores the reveal (not hats); mean consensus sets the grant`` () =
    // three peer personas, each its own private good-use definition of the reveal
    let peers: (PrivacyEconomy.GoodUse -> float) list =
        [ (fun u -> u.Revealed)          // peer A: takes it at face value
          (fun u -> u.Revealed * 2.0)    // peer B: values it highly
          (fun _ -> 0.0) ]              // peer C: unimpressed
    // consensus over reveal=6: (6 + 12 + 0)/3 = 6 -> grant 6
    let l = Map.empty |> PrivacyEconomy.rewardByMixture peers gainOf 1000 { Persona = "otto"; Revealed = 6.0 }
    Assert.Equal(6, PrivacyEconomy.budget "otto" l)
    // no peers -> no reward (need the mixture)
    let none = Map.empty |> PrivacyEconomy.rewardByMixture [] gainOf 1000 { Persona = "otto"; Revealed = 6.0 }
    Assert.Equal(0, PrivacyEconomy.budget "otto" none)

[<Fact>]
let ``HARD MONEY: budget never decreases across any sequence of rewards (G-Counter invariant)`` () =
    let mutable l = Map.empty
    let mutable prev = 0
    for r in [ 3.0; 0.0; 10.0; 1.0; 0.0; 50.0 ] do
        l <- l |> PrivacyEconomy.reward gainOf 1000 { Persona = "otto"; Revealed = r }
        let now = PrivacyEconomy.budget "otto" l
        Assert.True(now >= prev) // monotonic non-decreasing — never lost
        prev <- now
    Assert.Equal(64, prev) // 3+0+10+1+0+50

[<Fact>]
let ``good/bad asymmetry: verdict is Good (>= threshold) or Unknown — there is NO Bad`` () =
    Assert.Equal(PrivacyEconomy.Good, PrivacyEconomy.verdict 0.7 0.8)
    Assert.Equal(PrivacyEconomy.Unknown, PrivacyEconomy.verdict 0.7 0.5) // below threshold = Unknown, NOT bad

[<Fact>]
let ``rewardIfGood: rewards confirmed good, HOLDS on Unknown (no reward, no punishment)`` () =
    let start = Map.ofList [ "otto", 10 ]
    let confirmed = start |> PrivacyEconomy.rewardIfGood 0.7 0.9 gainOf 1000 { Persona = "otto"; Revealed = 5.0 }
    Assert.Equal(15, PrivacyEconomy.budget "otto" confirmed) // confidence 0.9 >= 0.7 -> rewarded
    let held = start |> PrivacyEconomy.rewardIfGood 0.7 0.4 gainOf 1000 { Persona = "otto"; Revealed = 5.0 }
    Assert.Equal(10, PrivacyEconomy.budget "otto" held) // Unknown -> unchanged (held, NOT punished -> still 10)
