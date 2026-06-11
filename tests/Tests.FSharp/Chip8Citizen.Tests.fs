module Zeta.Tests.Chip8CitizenTests

// The C in the citizenship quartet: identity as an injected §13 effect. The VM holds a HANDLE (governed
// ZetaId address) and converses over crossings; the signer interface is the only holder of key material.

open System.Threading.Tasks
open global.Xunit
open Zeta.Core
open Zeta.Core.FSharp.ZetaId

let private citizen seed =
    let s = Scheduler.fromSeed 700L
    Chip8Citizen.mint "pong-east" s.Now seed Location.EastUsVa

[<Fact>]
let ``DST: the same seed mints the same citizen; distinct seeds mint distinct citizens`` () =
    Assert.Equal(Chip8Citizen.addressHex (citizen 0xA1L), Chip8Citizen.addressHex (citizen 0xA1L))
    Assert.NotEqual<string>(Chip8Citizen.addressHex (citizen 0xA1L), Chip8Citizen.addressHex (citizen 0xB2L))

[<Fact>]
let ``the address is a 32-hex handle — identity as pointer, never key material`` () =
    let hex = Chip8Citizen.addressHex (citizen 0xA1L)
    Assert.Equal(32, hex.Length)
    Assert.True(hex |> Seq.forall (fun ch -> System.Char.IsAsciiHexDigitLower ch || System.Char.IsAsciiDigit ch))

[<Fact>]
let ``ident crossing round-trips (self-knowledge crosses IN)`` () =
    let c = citizen 0xA1L
    match Chip8Citizen.parseIdent (Chip8Citizen.encodeIdent c) with
    | Some addr -> Assert.Equal(Chip8Citizen.addressHex c, addr)
    | None -> failwith "ident did not round-trip"

[<Fact>]
let ``sign request -> signed crossing -> verify: the full membrane conversation`` () =
    let signer = Chip8Citizen.simSigner 0xFEEDUL
    match Chip8Citizen.answerSignRequest signer "sign:hello:world" with // payload may contain ':'
    | Some crossing ->
        match Chip8Citizen.parseSigned crossing with
        | Some (payload, signature) ->
            Assert.Equal("hello:world", payload)
            Assert.True(signer.Verify payload signature)
            Assert.False(signer.Verify "hello:tampered" signature) // tamper-evident
        | None -> failwith "signed crossing did not parse"
    | None -> failwith "sign request refused"

[<Fact>]
let ``a different key's signature does not verify (the signer is the identity)`` () =
    let s1 = Chip8Citizen.simSigner 1UL
    let s2 = Chip8Citizen.simSigner 2UL
    Assert.False(s2.Verify "payload" (s1.Sign "payload"))

[<Fact>]
let ``non-sign traffic is refused honestly by the host effect`` () =
    Assert.True(Chip8Citizen.answerSignRequest (Chip8Citizen.simSigner 1UL) "load:pong" |> Option.isNone)

[<Fact>]
let ``the mailbox room learns its identity and receives signatures ONLY via crossings`` () =
    task {
        let c = citizen 0xA1L
        let signer = Chip8Citizen.simSigner 0xFEEDUL
        let signed = (Chip8Citizen.answerSignRequest signer "sign:treaty-1").Value

        let source: SoftScheduler.Source =
            fun tick ->
                [ if tick = 0 then yield OperatorMessageArrived(Chip8Citizen.encodeIdent c)
                  if tick = 1 then yield OperatorMessageArrived signed
                  if tick = 2 then yield OperatorMessageArrived "noise:ignored" ]

        let ctx: IntrCtx =
            { Memetic = "citizen"; Prompt = ""; Trust = ""; Log = ""; Otel = System.Diagnostics.ActivityContext() }

        let! r =
            (SoftScheduler.driveK [ Chip8Citizen.mailboxHandler ] source)
                .Run ctx 1L Chip8Citizen.emptyMailbox 4

        match r with
        | Ok m ->
            Assert.Equal(Some(Chip8Citizen.addressHex c), m.KnownAddress)
            match m.Signatures with
            | [ (payload, signature) ] ->
                Assert.Equal("treaty-1", payload)
                Assert.True(signer.Verify payload signature)
            | _ -> failwith "expected exactly one signature"
        | Error e -> failwithf "drive failed: %A" e
    }
    :> Task
