module Zeta.Tests.CartTests

// The cart IS the proof (Aaron 2026-06-15: "the carts need to be the proof — let's build one").
// "Dot Runner" demonstrates, as PASSING TESTS, the four properties the Playable-Quotes arc claimed:
//   TRUTH       — byte-exact deterministic replay (the frame-exact guarantee Tenmile could not make)
//   DURABLE     — text round-trip byte-exact + identical replay (no binary in the proof lineage)
//   MINIMAL     — the mask theorem + a small kept fraction (the dead tail provably doesn't matter)
//   NON-STATIC  — take the controls and the arc DIVERGES from the recording (a playable existence,
//                 not a video) — and the core is the universal commutative truth, the arc the
//                 per-persona non-commutative experience.

open global.Xunit
open Zeta.Core

let private c = Cart.firstCart

[<Fact>]
let ``TRUTH: the cart replays byte-exact and deterministically (DST / DoP=1)`` () =
    Assert.Equal<Chip8Cow.Frame>(Cart.playback c, Cart.playback c)
    Assert.True(Cart.replaysIdentically c)

[<Fact>]
let ``DURABLE: the cart round-trips through text byte-exact and replays to the identical frame`` () =
    match Cart.ofLines (Cart.toLines c) with
    | Some c2 ->
        Assert.Equal<Cart.Cart>(c, c2)
        Assert.Equal<Chip8Cow.Frame>(Cart.playback c, Cart.playback c2)
    | None -> Assert.True(false, "cart failed to parse from its own lines")
    Assert.True(Cart.roundTrips c)

[<Fact>]
let ``DURABLE: the serialized cart is pure text (no binary in the proof lineage)`` () =
    let text = String.concat "\n" (Cart.toLines c)
    // tab + newline are the legitimate field/line delimiters; nothing else may be a control char.
    Assert.True(text |> Seq.forall (fun ch -> ch = '\n' || ch = '\t' || not (System.Char.IsControl ch)))

[<Fact>]
let ``MINIMAL: the mask theorem holds and the dead tail is dropped (Tenmile's measured number)`` () =
    Assert.True(Cart.minimalAndMaskHolds c)
    let q = Cart.toQuote c
    Assert.True(Chip8Quote.keptFraction q < 0.6) // the 32-byte dead tail is gone
    let m = Chip8Quote.mask q
    Assert.True(Map.containsKey 0x21A m.Mem) // the sprite (read via I): kept
    Assert.False(Map.containsKey 0x230 m.Mem) // deep in the dead tail: zeroed (absent)

[<Fact>]
let ``NON-STATIC: take the controls and the arc DIVERGES from the recording (playable, not a video)`` () =
    let pressFive: SoftScheduler.Source =
        fun t -> if t = 0 then [ OperatorMessageArrived(SoftChip8Flux.encodeKey 0x5 true) ] else []
    let steered = Cart.continueAfter pressFive 4 c
    let letRide = Cart.continueAfter (fun _ -> []) 4 c
    Assert.NotEqual<Chip8Cow.Frame>(letRide, steered) // the player moved the arc somewhere the recording never went
    Assert.True(Cart.arcDiverges pressFive 4 c)

[<Fact>]
let ``the cart has a deterministic, content-derived name`` () =
    Assert.Equal(Cart.id c, Cart.id c)
    Assert.Equal(16, (Cart.id c).Length)
