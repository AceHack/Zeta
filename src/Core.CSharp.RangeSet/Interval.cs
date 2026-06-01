namespace Zeta.Core.CSharp.RangeSet;

/// <summary>
/// An inclusive integer range <c>[Lo, Hi]</c> with <c>Lo &lt;= Hi</c> — the element of a range
/// set. (Named <c>Interval</c> rather than <c>Range</c> to avoid clashing with
/// <see cref="System.Range"/>; the F#/TS twins call it <c>Range</c>.)
/// </summary>
/// <param name="Lo">The inclusive lower bound.</param>
/// <param name="Hi">The inclusive upper bound.</param>
public sealed record Interval(long Lo, long Hi);
