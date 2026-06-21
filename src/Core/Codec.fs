namespace Zeta.Core

/// A **value codec** port — own-our-interface (hexagonal) for serializing a single value `'T`
/// to/from a wire representation `'Wire`, Result over throw (`'Feedback` is the typed decline
/// channel). Per the BCL-interface-boundary rule: callers depend on this port, the concrete
/// format is a swappable adapter behind it.
///
/// Distinct from the Z-set `ISerializer<'T>` in `Serializer.fs` (which is `ZSet<'T> -> bytes`,
/// the incremental-view wire codec) — that one is shape-locked to a Z-set over a byte buffer.
/// This is the **arbitrary-value** seam: the serializer roster plugs in here. The Bonsai
/// canonical-JSON serializer (`Expr -> string`) is the first adapter; a binary Bonsai or other
/// value formats can follow without changing callers. (If a bridge between this port and the
/// Z-set `ISerializer` is ever needed, that's a separate adapter written on demand.)
module Codec =

    /// A value codec: encode `'T` to its `'Wire` form and decode it back, both Result-typed
    /// over the codec's `'Feedback` channel (no exception crosses the boundary).
    type ICodec<'T, 'Wire, 'Feedback> =
        /// Encode a value to its wire form.
        abstract member Serialize: value: 'T -> Result<'Wire, 'Feedback>
        /// Decode a value from its wire form.
        abstract member Deserialize: wire: 'Wire -> Result<'T, 'Feedback>
        /// A stable identifier for this codec (e.g. "bonsai/canonical-json-v1").
        abstract member Name: string

    // ── the codec algebra (081KT2T2J0008QG0R0008TFHJT): a codec is an **invariant functor**
    // with the round-trip law `Deserialize ∘ Serialize = id`, closed under
    // identity, product, and sum. These combinators build composite codecs
    // from component codecs and preserve round-trip by construction (proven
    // in tests/Tests.FSharp/Core/Codec.Tests.fs — 081KT2T2J0008QG0R000YZ3NMY C12). Prior art:
    // scodec `xmap`/`~`/`|+|`, Haskell `codec`, profunctor-optics.
    //
    // NOTE on notation: 081KT2T2J0008QG0R0008TFHJT writes the abstract codec as `Codec<a>`; the
    // concrete F# type here is `ICodec<a, 'Wire, 'Feedback>`. Below, 081KT2T2J0008QG0R0008TFHJT's
    // `Codec<a>` ≙ `ICodec<a, _, _>` (the wire/feedback params elided).

    /// The **identity** codec — wire = value, total (never declines): the
    /// algebra's identity element (081KT2T2J0008QG0R0008TFHJT's `Codec<unit>` ≙ `identity<unit>()`).
    /// `Deserialize ∘ Serialize = id` holds trivially (`Ok` round-trips `Ok`).
    let identity<'T, 'Feedback> () : ICodec<'T, 'T, 'Feedback> =
        { new ICodec<'T, 'T, 'Feedback> with
            member _.Serialize value = Ok value
            member _.Deserialize wire = Ok wire
            member _.Name = "codec/identity-v1" }

    /// **Invariant-functor map** — re-target a codec from `'A` to `'B` given
    /// a bijection (`fwd`, `bwd`). Round-trip is preserved when `fwd`/`bwd`
    /// are inverse: `Deserialize(Serialize y) = map fwd (Deserialize(Serialize (bwd y))) = Ok (fwd (bwd y)) = Ok y`.
    /// (scodec `xmap` / Haskell invariant `invmap`.)
    let imap (fwd: 'A -> 'B) (bwd: 'B -> 'A) (c: ICodec<'A, 'Wire, 'Feedback>) : ICodec<'B, 'Wire, 'Feedback> =
        { new ICodec<'B, 'Wire, 'Feedback> with
            member _.Serialize value = c.Serialize(bwd value)
            member _.Deserialize wire = c.Deserialize wire |> Result.map fwd
            member _.Name = c.Name + "/imap" }

    /// **Product** — combine codecs for `'A` and `'B` into a codec for the
    /// pair, wire = pair of wires. Closed: round-trips iff both components do.
    /// A decline on either side surfaces as `Error` (no silent corruption).
    let product
        (ca: ICodec<'A, 'WA, 'Feedback>)
        (cb: ICodec<'B, 'WB, 'Feedback>)
        : ICodec<'A * 'B, 'WA * 'WB, 'Feedback> =
        { new ICodec<'A * 'B, 'WA * 'WB, 'Feedback> with
            // short-circuit: if the left declines, the right codec is never
            // invoked (no wasted work / no side effects on a doomed encode).
            member _.Serialize((a, b)) =
                match ca.Serialize a with
                | Error e -> Error e
                | Ok wa ->
                    match cb.Serialize b with
                    | Error e -> Error e
                    | Ok wb -> Ok(wa, wb)
            member _.Deserialize((wa, wb)) =
                match ca.Deserialize wa with
                | Error e -> Error e
                | Ok a ->
                    match cb.Deserialize wb with
                    | Error e -> Error e
                    | Ok b -> Ok(a, b)
            member _.Name = "(" + ca.Name + " * " + cb.Name + ")" }

    /// **Sum** (tagged) — a codec for the tagged choice of `'A` or `'B`,
    /// wire = tagged choice of wires. Closed: round-trips iff both components
    /// do; the tag is preserved, so a `Choice1Of2` never decodes as a
    /// `Choice2Of2`.
    let sum
        (ca: ICodec<'A, 'WA, 'Feedback>)
        (cb: ICodec<'B, 'WB, 'Feedback>)
        : ICodec<Choice<'A, 'B>, Choice<'WA, 'WB>, 'Feedback> =
        { new ICodec<Choice<'A, 'B>, Choice<'WA, 'WB>, 'Feedback> with
            member _.Serialize value =
                match value with
                | Choice1Of2 a -> ca.Serialize a |> Result.map Choice1Of2
                | Choice2Of2 b -> cb.Serialize b |> Result.map Choice2Of2
            member _.Deserialize wire =
                match wire with
                | Choice1Of2 wa -> ca.Deserialize wa |> Result.map Choice1Of2
                | Choice2Of2 wb -> cb.Deserialize wb |> Result.map Choice2Of2
            member _.Name = "(" + ca.Name + " + " + cb.Name + ")" }
