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
