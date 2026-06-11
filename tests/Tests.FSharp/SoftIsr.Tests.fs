module Zeta.Tests.SoftIsrTests

open global.Xunit
open Zeta.Core
open Zeta.Core.ISR

let private ctx () : IntrCtx =
    { Memetic = "soft"; Prompt = ""; Trust = ""; Log = ""; Otel = System.Diagnostics.ActivityContext() }

// a likelihood favoring Int candidates near a target
let private near (target: int64) (dv: DynamicValue) : float =
    match dv with
    | DynamicValue.Int n -> 1.0 / (1.0 + abs (float (n - target)))
    | _ -> 0.0

[<Fact>]
let ``the soft pipeline: lift -> observe -> mustResolve collapses to the evidenced candidate`` () =
    task {
        let arrow =
            SoftIsr.ofWeighted (fun () -> [ DynamicValue.Int 1L, 0.4; DynamicValue.Int 10L, 0.3; DynamicValue.Int 100L, 0.3 ])
            >=> SoftIsr.observeWith (near 10L)
            >=> SoftIsr.observeWith (near 10L) // independent evidence compounds
            >=> SoftIsr.mustResolveAt 0.6
        let! r = arrow (ctx ()) ()
        Assert.Equal<Result<DynamicValue, InterruptFeedback>>(Ok(DynamicValue.Int 10L), r)
    }

[<Fact>]
let ``uncertainty travels WITH the promise: under-threshold resolveAt returns the HELD distribution (a value, not an error)`` () =
    task {
        let arrow =
            SoftIsr.ofWeighted (fun () -> [ DynamicValue.Int 1L, 0.5; DynamicValue.Int 2L, 0.5 ])
            >=> SoftIsr.resolveAt 0.9
        let! r = arrow (ctx ()) ()
        match r with
        | Ok (Choice2Of2 held) -> Assert.True(SoftValue.confidence held < 0.9) // still soft, still flowing
        | Ok (Choice1Of2 _) -> Assert.Fail "should not have collapsed at 50/50"
        | Error e -> Assert.Fail(sprintf "holding is not an error: %A" e)
    }

[<Fact>]
let ``annihilating evidence surfaces in the ERROR channel (sum = failure; product = held value)`` () =
    task {
        let arrow =
            SoftIsr.certain (fun () -> DynamicValue.String "x")
            >=> SoftIsr.observeWith (fun _ -> 0.0) // kills every candidate
        let! r = arrow (ctx ()) ()
        match r with
        | Error (Failed msg) -> Assert.Contains("annihilated", msg)
        | _ -> Assert.Fail "zero likelihood must surface as Failed"
    }

[<Fact>]
let ``mustResolveAt refuses honestly when unresolved (states the confidence, never guesses)`` () =
    task {
        let arrow =
            SoftIsr.ofWeighted (fun () -> [ DynamicValue.Int 1L, 0.5; DynamicValue.Int 2L, 0.5 ])
            >=> SoftIsr.mustResolveAt 0.9
        let! r = arrow (ctx ()) ()
        match r with
        | Error (Failed msg) -> Assert.Contains("unresolved", msg)
        | _ -> Assert.Fail "under-threshold mustResolve must refuse"
    }

[<Fact>]
let ``independent-evidence observes COMMUTE through the arrow (the SoftValue law lifts)`` () =
    task {
        let e1 = near 10L
        let e2 (dv: DynamicValue) =
            match dv with
            | DynamicValue.Int n -> (if n > 5L then 0.8 else 0.2)
            | _ -> 0.0
        let lift = SoftIsr.ofWeighted (fun () -> [ DynamicValue.Int 1L, 0.4; DynamicValue.Int 10L, 0.6 ])
        let ab = lift >=> SoftIsr.observeWith e1 >=> SoftIsr.observeWith e2
        let ba = lift >=> SoftIsr.observeWith e2 >=> SoftIsr.observeWith e1
        let! ra = ab (ctx ()) ()
        let! rb = ba (ctx ()) ()
        match ra, rb with
        | Ok a, Ok b ->
            let pairs = List.zip a.Candidates b.Candidates
            for (dva, pa), (dvb, pb) in pairs do
                Assert.Equal(dva, dvb)
                Assert.Equal(pa, pb, 10)
        | _ -> Assert.Fail "both orders must succeed"
    }
