module Zeta.Tests.ReticulumQuantumTests

open System
open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.ZetaId

let private st a ai b bi : QubitIso.JoinState = { A = { Real = a; Imag = ai }; B = { Real = b; Imag = bi } }

let private frame () =
    Chip8Cow.create 7UL |> Chip8Cow.loadRom [| 0x60uy; 0x01uy |]

let private phasor theta : Complex = { Real = cos theta; Imag = sin theta }

let private link () =
    let s = Scheduler.fromSeed 700L
    let a = ReticulumLink.mint s.Now 0xA1L Location.EastUsVa
    let b = ReticulumLink.mint s.Now 0xB2L Location.WestEurope
    let medium = ReticulumLink.empty |> ReticulumLink.announce a |> ReticulumLink.announce b
    match ReticulumLink.connect a b medium with
    | Ok link -> s, medium, a, b, link
    | Error e -> failwithf "test setup failed: %A" e

[<Fact>]
let ``qubit Born observable crosses Reticulum as a deterministic finite-room packet`` () =
    let s, medium, _, b, l = link ()
    let q = st 0.6 0.0 0.8 0.0
    let observable = ReticulumQuantum.ofQubit "bell-bench" 42L q

    let medium', s' = ReticulumQuantum.send l observable s medium
    let delivered, drained = ReticulumQuantum.receive b medium'

    Assert.Equal(701L, s'.Now.Version)
    Assert.Empty(drained.InFlight)
    match delivered with
    | Error e -> Assert.Fail(sprintf "observable decode failed: %A" e)
    | Ok [ packet ] ->
        Assert.Equal(Salon.name, packet.Room)
        Assert.Equal("bell-bench", packet.Source)
        Assert.Equal("born:P(|1>)", packet.Name)
        Assert.Equal(0.64, packet.Value, 12)
        Assert.Equal(1.0, packet.Norm, 12)
        Assert.Equal(2, packet.Support)
        Assert.Equal(42L, packet.Sequence)
    | Ok xs -> Assert.Fail(sprintf "expected one packet, got %d" xs.Length)

[<Fact>]
let ``CHIP-8 amplitude interference observable crosses Reticulum with merged support`` () =
    let s, medium, _, b, l = link ()
    let f = frame ()
    let amp: AmplitudeEmu.Amp = [ f, phasor 0.0; f, phasor 0.0 ]
    let observable = ReticulumQuantum.ofAmplitudeEmu "soft-chip8-room" 7L amp

    let medium', _ = ReticulumQuantum.send l observable s medium
    let delivered, _ = ReticulumQuantum.receive b medium'

    match delivered with
    | Error e -> Assert.Fail(sprintf "observable decode failed: %A" e)
    | Ok [ packet ] ->
        Assert.Equal(Arcade.name, packet.Room)
        Assert.Equal("soft-chip8-room", packet.Source)
        Assert.Equal("born:max-frame", packet.Name)
        Assert.Equal(1.0, packet.Value, 12)
        Assert.Equal(4.0, packet.Norm, 12)
        Assert.Equal(1, packet.Support)
        Assert.Equal(7L, packet.Sequence)
    | Ok xs -> Assert.Fail(sprintf "expected one packet, got %d" xs.Length)

[<Fact>]
let ``malformed Reticulum observable payload returns Result error instead of throwing`` () =
    match ReticulumQuantum.decode "not-a-reticulum-observable" with
    | Error (ReticulumQuantum.PacketError.Malformed "schema") -> ()
    | other -> Assert.Fail(sprintf "expected schema error, got %A" other)

[<Fact>]
let ``WSet Mach-Zehnder observable Z-set crosses Reticulum as source-owned DBSP rows`` () =
    let s, medium, _, b, l = link ()
    let rows = QuantumObservableDbsp.machZehnderZSet ()

    let medium', s' =
        ReticulumQuantum.sendQuantumObservableZSet l "wset-mach-zehnder" 100L rows s medium

    let delivered, drained = ReticulumQuantum.receiveQuantumObservableZSet b medium'

    Assert.Equal(6, ZSet.count rows)
    Assert.Equal(706L, s'.Now.Version)
    Assert.Empty(drained.InFlight)
    match delivered with
    | Error e -> Assert.Fail(sprintf "observable Z-set decode failed: %A" e)
    | Ok actual ->
        Assert.Equal(ZSet.count rows, ZSet.count actual)
        Assert.Equal<ZSet<QuantumObservableRow>>(rows, actual)

[<Fact>]
let ``Reticulum quantum observable deltas preserve DBSP retractions`` () =
    let s, medium, _, b, l = link ()
    let openRow = QuantumObservableDbsp.machZehnderOpenRow ()
    let piOver6Row =
        QuantumObservableDbsp.machZehnderClosedRow
            "mach-zehnder-closed-pi-over-6-phase"
            "Zeta.ReferenceOracle.ApplyMachZehnderClosedPiOver6Phase"
            (Math.PI / 6.0)

    let deltas: ReticulumQuantum.ObservableDelta list =
        [ { Source = "reticulum-retraction"
            Sequence = 200L
            Row = openRow
            Weight = 1L }
          { Source = "reticulum-retraction"
            Sequence = 201L
            Row = openRow
            Weight = -1L }
          { Source = "reticulum-retraction"
            Sequence = 202L
            Row = piOver6Row
            Weight = 1L } ]

    let medium', s' = ReticulumQuantum.sendDeltas l deltas s medium
    let delivered, drained = ReticulumQuantum.receiveQuantumObservableZSet b medium'

    Assert.Equal(703L, s'.Now.Version)
    Assert.Empty(drained.InFlight)
    match delivered with
    | Error e -> Assert.Fail(sprintf "observable deltas decode failed: %A" e)
    | Ok actual ->
        Assert.Equal(1, ZSet.count actual)
        Assert.Equal(0L, ZSet.lookup openRow actual)
        Assert.Equal(1L, ZSet.lookup piOver6Row actual)

[<Fact>]
let ``malformed Reticulum quantum observable delta payload returns Result error`` () =
    match ReticulumQuantum.decodeDelta """{"schema":"wrong","delta":{}}""" with
    | Error (ReticulumQuantum.PacketError.Malformed "schema") -> ()
    | other -> Assert.Fail(sprintf "expected schema error, got %A" other)
