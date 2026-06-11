module Zeta.Tests.ControlSchemeTests

// Devices are SECOND to the grammar: schemes are ZetaId'd total maps INTO the canonical action set;
// portability is the theorem (dpad-up ≡ 'w' ≡ pad-5 — different fingers, one meaning, one wire form).

open global.Xunit
open Zeta.Core

[<Fact>]
let ``every scheme is ZetaId-addressed and resolvable by id (the cartridge's direction)`` () =
    for s in ControlScheme.known do
        Assert.Equal(32, s.ZetaId.Length)
        Assert.Equal(Some s.Name, ControlScheme.byId s.ZetaId |> Option.map (fun x -> x.Name))
    // distinct schemes, distinct ids
    let ids = ControlScheme.known |> List.map (fun s -> s.ZetaId)
    Assert.Equal(List.length ids, List.distinct ids |> List.length)

[<Fact>]
let ``PORTABILITY: dpad-up, 'w', and pad-5 all mean the SAME grammar action and the SAME wire crossing`` () =
    let viaPad = ControlScheme.crossing ControlScheme.chip9Pad "5"
    let viaKbd = ControlScheme.crossing ControlScheme.keyboardWasd "w"
    let viaPadlt = ControlScheme.crossing ControlScheme.gamepadStandard "dpad-up"
    Assert.Equal(Some "go:n", viaPad)
    Assert.Equal(viaPad, viaKbd)
    Assert.Equal(viaKbd, viaPadlt) // one meaning, three fingers

[<Fact>]
let ``the grammar owns the wire: actions encode to the crossing payloads the rooms already speak`` () =
    Assert.Equal("go:hottest", ControlScheme.payload (ControlScheme.Go "hottest"))
    Assert.Equal("ui:conference", ControlScheme.payload ControlScheme.Conference)
    Assert.Equal("key:10:1", ControlScheme.payload (ControlScheme.Pad 0xA)) // the chip9 pad pass-through

[<Fact>]
let ``unmapped inputs are honest Nones — a scheme never invents meaning`` () =
    Assert.True(ControlScheme.translate ControlScheme.keyboardWasd "f13" |> Option.isNone)
    Assert.True(ControlScheme.crossing ControlScheme.gamepadStandard "select-plus-start" |> Option.isNone)
