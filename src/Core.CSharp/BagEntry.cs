// BagEntry — one entry of a Bag (multiset): a key + its strictly-positive multiplicity.
// Companion to Bag.cs; the C# parity oracle for the TS `{ e, n }` / Rust `BagEntry { e, n: i64 }`.

namespace Zeta.Core.CSharp;

/// <summary>
/// One bag entry: a key <see cref="Key"/> with a strictly-positive multiplicity
/// <see cref="Count"/> (>= 1 in a canonical bag). Mirrors the TS twin's <c>{ e, n }</c> and the
/// Rust twin's <c>BagEntry { e, n: i64 }</c>; <see cref="Count"/> is <see cref="long"/> to match
/// the Rust <c>i64</c> oracle and keep the cross-language golden vector exact.
/// </summary>
/// <typeparam name="T">The key type.</typeparam>
/// <param name="Key">The key.</param>
/// <param name="Count">The multiplicity (>= 1 in a canonical bag).</param>
public readonly record struct BagEntry<T>(T Key, long Count);
