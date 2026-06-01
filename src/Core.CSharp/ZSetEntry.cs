// ZSetEntry — one entry of a Z-set (signed multiset): a key + its strictly-nonzero signed weight.
// Companion to ZSet.cs; the C# parity oracle for the TS `{ e, w }`, the F# engine's
// `ZEntry { Key; Weight }`, and the Rust `BagEntry`-shaped `{ e, w: i64 }`.

namespace Zeta.Core.CSharp;

/// <summary>
/// One Z-set entry: a key <see cref="Key"/> with a strictly-nonzero signed weight
/// <see cref="Weight"/> (!= 0 in a canonical Z-set; may be negative). Mirrors the TS twin's
/// <c>{ e, w }</c>, the F# engine's <c>ZEntry { Key; Weight }</c> (<c>src/Core/ZSet.fs</c>), and the
/// Rust twin's <c>{ e, w: i64 }</c>; <see cref="Weight"/> is <see cref="long"/> to match the int64
/// oracles and keep the cross-language golden vector exact.
/// </summary>
/// <typeparam name="T">The key type.</typeparam>
/// <param name="Key">The key.</param>
/// <param name="Weight">The signed weight (!= 0 in a canonical Z-set; may be negative).</param>
public readonly record struct ZSetEntry<T>(T Key, long Weight);
