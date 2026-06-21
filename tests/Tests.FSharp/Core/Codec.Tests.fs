module Zeta.Tests.Core.CodecTests

open Xunit
open FsCheck.Xunit
open Zeta.Core.Codec

// ═══════════════════════════════════════════════════════════════════
// C12 (081KT2T2J0008QG0R000YZ3NMY P1) — the CODEC ALGEBRA (081KT2T2J0008QG0R0008TFHJT §122-126): a codec is an
// INVARIANT FUNCTOR with the round-trip law `Deserialize ∘ Serialize = id`,
// closed under IDENTITY, PRODUCT, and SUM. We build composite codecs from
// the `identity` base via `imap` / `product` / `sum` and prove (FsCheck):
//   * round-trip CLOSURE   — each combinator preserves `decode∘encode=id`
//   * invariant-FUNCTOR laws — imap id id = id ; imap composes
//   * partiality is HONEST — a declining component surfaces `Error` through
//     `product` (closure is honest about partial codecs; no silent
//     corruption that would let a bad value masquerade as a good one)
// Codecs are over a `string` decline channel. This makes 081KT2T2J0008QG0R0008TFHJT's
// "the codec axis is an algebra" claim TRUE. Prior art: scodec / Haskell
// `codec` / profunctor-optics. "The compilers don't lie."
// ═══════════════════════════════════════════════════════════════════

/// true iff `Deserialize (Serialize x) = Ok x` (the round-trip law).
let private roundTrips (c: ICodec<'T, 'W, string>) (x: 'T) : bool =
    match c.Serialize x with
    | Ok w -> (match c.Deserialize w with
               | Ok y -> y = x
               | Error _ -> false)
    | Error _ -> false

// total base codecs (identity element of the algebra) ...
let private idInt : ICodec<int, int, string> = identity ()
let private idStr : ICodec<string, string, string> = identity ()
// ... and a non-trivial imap'd codec (real wire transform: ±1000 offset)
let private shiftedInt : ICodec<int, int, string> =
    imap (fun n -> n + 1000) (fun n -> n - 1000) idInt
// a PARTIAL codec — declines (Error) outside [-100, 100]
let private boundedInt : ICodec<int, int, string> =
    { new ICodec<int, int, string> with
        member _.Serialize n =
            if abs n <= 100 then Ok n else Error(sprintf "value out of range: %d" n)
        member _.Deserialize w =
            if abs w <= 100 then Ok w else Error(sprintf "wire out of range: %d" w)
        member _.Name = "boundedInt" }

// ── round-trip closure: each combinator preserves decode∘encode = id ──

[<Property>]
let ``C12 identity codec round-trips (decode∘encode = id)`` (x: int) = roundTrips idInt x

[<Property>]
let ``C12 imap with an inverse bijection preserves round-trip`` (x: int) = roundTrips shiftedInt x

[<Property>]
let ``C12 product codec round-trips (closed under product)`` (a: int) (b: string) =
    roundTrips (product idInt idStr) (a, b)

[<Property>]
let ``C12 sum codec round-trips and preserves the tag (closed under sum)`` (useLeft: bool) (a: int) (b: string) =
    let c = sum idInt idStr
    roundTrips c (if useLeft then Choice1Of2 a else Choice2Of2 b)

[<Property>]
let ``C12 nested product∘sum∘imap composite round-trips (closure composes)`` (a: int) (b: string) (useLeft: bool) =
    // ((shiftedInt + idStr) × idInt) — exercise all three combinators stacked
    let c = product (sum shiftedInt idStr) idInt
    roundTrips c ((if useLeft then Choice1Of2 a else Choice2Of2 b), a)

// ── invariant-functor laws ──

[<Property>]
let ``C12 imap id id is the identity functor (law 1: imap id id c = c)`` (x: int) =
    let c = imap id id idInt
    (c.Serialize x = idInt.Serialize x)
    && (match idInt.Serialize x with
        | Ok w -> c.Deserialize w = idInt.Deserialize w
        | Error _ -> true)

[<Property>]
let ``C12 imap composition law (imap g g' ∘ imap f f' = imap (g∘f) (f'∘g'))`` (x: int) (w: int) =
    // holds structurally for ANY maps (functor composition; not a round-trip
    // claim) — so f/g need not be bijections here.
    let f n = n + 7
    let f' n = n - 7
    let g n = n * 2
    let g' n = n / 2
    let lhs = imap g g' (imap f f' idInt)
    let rhs = imap (g << f) (f' << g') idInt
    lhs.Serialize x = rhs.Serialize x && lhs.Deserialize w = rhs.Deserialize w

// ── partiality is honest: a declining component surfaces Error ──

[<Fact>]
let ``C12 product propagates a component decline as Error (no silent corruption)`` () =
    let c = product boundedInt idStr
    // out-of-range left component → the whole product must DECLINE, not
    // silently encode a corrupt pair.
    match c.Serialize(5000, "x") with
    | Error _ -> ()
    | Ok _ -> Assert.True(false, "product silently accepted an out-of-range component")
    // in-range still round-trips (closure holds on the accepted domain)
    Assert.True(roundTrips c (50, "y"))
