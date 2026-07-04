module Zeta.Tests.PixelLensTests

// Sub-pixel cells: data + uncertainty travel WITH the pixel; lawful lenses focus the fields; the
// display sees only the projection (zero case); uncertainty colorizes honestly.

open global.Xunit
open Zeta.Core

[<Fact>]
let ``pack/unpack: the three fields coexist without bleeding (13-bit payload, 16-bit uncertainty)`` () =
    let c = PixelLens.pack 6uy 0x1ABC 4242
    Assert.Equal(6uy, PixelLens.color.Get c)
    Assert.Equal(0x1ABC, PixelLens.payload.Get c)
    Assert.Equal(4242, PixelLens.uncertainty.Get c)

[<Fact>]
let ``tryPack: valid inputs succeed, invalid inputs return descriptive errors`` () =
    // valid packing
    match PixelLens.tryPack 6uy 0x1ABC 4242 with
    | Ok c ->
        Assert.Equal(6uy, PixelLens.color.Get c)
        Assert.Equal(0x1ABC, PixelLens.payload.Get c)
        Assert.Equal(4242, PixelLens.uncertainty.Get c)
    | Error e -> failwith e

    // invalid color
    match PixelLens.tryPack 8uy 100 100 with
    | Error msg -> Assert.Contains("color", msg)
    | Ok _ -> failwith "should have failed color bounds check"

    // invalid payload
    match PixelLens.tryPack 3uy -1 100 with
    | Error msg -> Assert.Contains("payload", msg)
    | Ok _ -> failwith "should have failed payload bounds check"

    match PixelLens.tryPack 3uy 8192 100 with
    | Error msg -> Assert.Contains("payload", msg)
    | Ok _ -> failwith "should have failed payload bounds check"

    // invalid uncertainty
    match PixelLens.tryPack 3uy 100 -1 with
    | Error msg -> Assert.Contains("uncertainty", msg)
    | Ok _ -> failwith "should have failed uncertainty bounds check"

    match PixelLens.tryPack 3uy 100 65536 with
    | Error msg -> Assert.Contains("uncertainty", msg)
    | Ok _ -> failwith "should have failed uncertainty bounds check"

[<Fact>]
let ``the lenses are LAWFUL: get-put and put-get hold on every field`` () =
    let c = PixelLens.pack 3uy 999 100
    // get-put: Set (Get w) w = w
    Assert.Equal(c, PixelLens.color.Set (PixelLens.color.Get c) c)
    Assert.Equal(c, PixelLens.payload.Set (PixelLens.payload.Get c) c)
    Assert.Equal(c, PixelLens.uncertainty.Set (PixelLens.uncertainty.Get c) c)
    // put-get: Get (Set p w) = p
    Assert.Equal(7uy, PixelLens.color.Get(PixelLens.color.Set 7uy c))
    Assert.Equal(0, PixelLens.payload.Get(PixelLens.payload.Set 0 c))

[<Fact>]
let ``data travels WITH the pixel: setting the color never disturbs the payload or uncertainty`` () =
    let c = PixelLens.pack 1uy 1234 555
    let recolored = PixelLens.color.Set 4uy c
    Assert.Equal(1234, PixelLens.payload.Get recolored)
    Assert.Equal(555, PixelLens.uncertainty.Get recolored)

[<Fact>]
let ``the soft read is SoftValue-shaped: payload + confidence; certain=1.0, unknown~=0.0`` () =
    let sure = PixelLens.pack 2uy 42 0
    Assert.Equal((42, 1.0), PixelLens.softRead sure)
    let (v, conf) = PixelLens.softRead (PixelLens.pack 2uy 42 65535)
    Assert.Equal(42, v)
    Assert.Equal(0.0, conf, 9)

[<Fact>]
let ``COLORIZE is honest: certain pixels keep their color; uncertain pixels visibly collapse to mono`` () =
    Assert.Equal(6uy, PixelLens.colorize 1000 (PixelLens.pack 6uy 0 500)) // certain: full cyan
    Assert.Equal(0uy, PixelLens.colorize 1000 (PixelLens.pack 6uy 0 5000)) // uncertain cyan: mono bit only (dark)
    Assert.Equal(1uy, PixelLens.colorize 1000 (PixelLens.pack 7uy 0 5000)) // uncertain white: humbled to mono

[<Fact>]
let ``the overlay shift wraps horizontally (the lens slides over the same world)`` () =
    Assert.Equal((0, 5), PixelLens.shift 1 0 64 (63, 5))
    Assert.Equal((63, 4), PixelLens.shift -1 -1 64 (0, 5))
