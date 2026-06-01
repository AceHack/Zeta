// KeyGroup — one per-key group of an IndexedZSet: a key + its canonical per-key Z-set. Companion
// to IndexedZSet.cs; the C# parity oracle for the TS twin's `{ key, values }` and the F# engine's
// `KeyGroup<'K,'V> { Key; Values }` (src/Core/IndexedZSet.fs).

namespace Zeta.Core.CSharp;

/// <summary>
/// One per-key group of an <see cref="IndexedZSet{TKey, TValue}"/>: a key and its canonical
/// <see cref="ZSet{TValue}"/> (non-empty in a canonical indexed Z-set).
/// </summary>
/// <typeparam name="TKey">The key type.</typeparam>
/// <typeparam name="TValue">The value type.</typeparam>
/// <param name="Key">The group key.</param>
/// <param name="Values">The per-key Z-set.</param>
public readonly record struct KeyGroup<TKey, TValue>(TKey Key, ZSet<TValue> Values);
