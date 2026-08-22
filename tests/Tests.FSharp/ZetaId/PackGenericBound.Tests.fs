module Zeta.Tests.FSharp.ZetaId.PackGenericBoundTests

open Xunit
open Zeta.Core.FSharp.ZetaId

// ═══════════════════════════════════════════════════════════════════
// packGeneric is PUBLIC and used to mask an oversized payload instead of
// rejecting it. Masking aliases ids rather than failing, and the aliasing has
// a date: at 2039-09-07T15:47:35.552Z a caller building (ms <<< 78) ||| random78
// reaches ms = 2^41, the top ms bit falls off, and the id is byte-identical to
// the same call with ms = 0.
//
// No in-repo caller reaches packGeneric directly today -- every path goes
// through the validating packPayload wrapper -- so the bound is INERT for every
// id mintable today (proved below against the real on-disk inventory ids). The
// exposure it closes is a FUTURE caller reaching past the wrapper, which is
// exactly the mistake inventory/new-item.ts made on the TypeScript side.
//
// Peer oracle: tests/Tests.CSharp/ZetaId/PackGenericBoundTests.cs (same cases).
// ═══════════════════════════════════════════════════════════════════

let private payloadBits = 119
let private msShift = 78

/// The ms value at which a (ms <<< 78) payload first needs a 120th bit.
let private cliffMs = System.UInt128.One <<< 41

let private bitLength (v: System.UInt128) =
    let mutable x = v
    let mutable n = 0
    while x > System.UInt128.Zero do
        x <- x >>> 1
        n <- n + 1
    n

// ── The dated collision ────────────────────────────────────────────

[<Fact>]
let ``packGeneric rejects the 2039 cliff instead of aliasing it onto ms = 0`` () =
    let cliffPayload = cliffMs <<< msShift
    Assert.Equal(120, bitLength cliffPayload)

    Assert.Throws<System.ArgumentOutOfRangeException>(fun () ->
        ZetaIdCodec.packGeneric IdVersion.V1 Category.InventoryAsset cliffPayload |> ignore)
    |> ignore

[<Fact>]
let ``the last ms before the cliff still mints`` () =
    // The bound must fire AT the boundary, not before it: ms = 2^41 - 1 with
    // every random bit set is still exactly 119 bits and must round-trip.
    let lastMs = cliffMs - System.UInt128.One
    let payload = (lastMs <<< msShift) ||| ((System.UInt128.One <<< msShift) - System.UInt128.One)
    Assert.Equal(payloadBits, bitLength payload)

    let id = ZetaIdCodec.packGeneric IdVersion.V1 Category.InventoryAsset payload
    let version, category, recovered = ZetaIdCodec.unpackGeneric id

    Assert.Equal(IdVersion.V1, version)
    Assert.Equal(Category.InventoryAsset, category)
    Assert.Equal(payload, recovered)

[<Fact>]
let ``the exact cap mints and one bit over does not`` () =
    let atCap = (System.UInt128.One <<< payloadBits) - System.UInt128.One
    Assert.Equal(payloadBits, bitLength atCap)
    let _, _, recovered = ZetaIdCodec.unpackGeneric (ZetaIdCodec.packGeneric IdVersion.V1 Category.InventoryAsset atCap)
    Assert.Equal(atCap, recovered)

    let overCap = System.UInt128.One <<< payloadBits
    Assert.Throws<System.ArgumentOutOfRangeException>(fun () ->
        ZetaIdCodec.packGeneric IdVersion.V1 Category.InventoryAsset overCap |> ignore)
    |> ignore

// ── The negative-payload aliasing class ────────────────────────────

[<Fact>]
let ``the all-ones value is rejected -- the F# analogue of the bigint -1 hole`` () =
    // On the TypeScript side `payload` is a signed `bigint`, so masking made
    // -1n indistinguishable from all-ones. F# cannot admit a negative here at
    // all: the parameter is System.UInt128, which is unsigned, so the hole does
    // not exist as a distinct case. What a caller CAN still do is reinterpret
    // -1, and that is exactly System.UInt128.MaxValue -- the same all-ones bit
    // pattern. It is now rejected rather than masked down to the 119-bit
    // all-ones payload it used to alias onto.
    Assert.Throws<System.ArgumentOutOfRangeException>(fun () ->
        ZetaIdCodec.packGeneric IdVersion.V1 Category.InventoryAsset System.UInt128.MaxValue |> ignore)
    |> ignore

// ── Inertness, against real committed data ─────────────────────────

/// Every id currently committed under inventory/items/. Recovered, re-minted
/// through the bounded path, and required to come back byte-identical.
[<Theory>]
[<InlineData("0EFJ9RW179ZFT9WBMXZZNYM92A")>]
[<InlineData("0EFJ9RW1DD28A33YN3F9NCAP9E")>]
let ``real on-disk inventory ids round-trip byte-identical and sit exactly at the cap`` (canonical: string) =
    let id = ZetaIdCodec.parse canonical
    let version, category, payload = ZetaIdCodec.unpackGeneric id

    // The measurement that makes the bound reviewable: ZERO headroom. These ids
    // are not comfortably under the cap, they are AT it.
    Assert.Equal(payloadBits, bitLength payload)

    let reminted = ZetaIdCodec.packGeneric version category payload
    Assert.Equal(id, reminted)
    Assert.Equal(canonical, ZetaIdCodec.format reminted, System.StringComparer.Ordinal)

[<Fact>]
let ``today's clock is still inside the bound but with no headroom`` () =
    // The shape inventory/new-item.ts mints with, at a fixed ms so the test is
    // deterministic (2026-08-14T00:00:00Z). Already 119 bits: the design
    // consumed the entire payload, so ONE more bit of clock overflows it.
    let ms = 1786752000000L
    let payload =
        (System.UInt128.op_Implicit (uint64 ms) <<< msShift)
        ||| ((System.UInt128.One <<< msShift) - System.UInt128.One)

    Assert.Equal(payloadBits, bitLength payload)

    let id = ZetaIdCodec.packGeneric IdVersion.V1 Category.InventoryAsset payload
    let _, _, recovered = ZetaIdCodec.unpackGeneric id
    Assert.Equal(payload, recovered)
