using System.Diagnostics;

namespace Zeta.Core.CSharp.TriBoolean;

/// <summary>
/// Tri-boolean float -- operations (B-0944 slice 5 pt2, C# parity oracle #3). Static; the
/// biased-exponent decoder ported from the TS distribution (decoders.ts 'biased-exponent') and the
/// F# Float module. Named FloatOps (not TriFloat) because TriFloat is already the data type and the
/// ops class must not collide with it.
///
/// Middle-out, self-describing: <c>decoded value = V * 2^(mode - bias)</c>, bias = 2^(decoderWidth - 1),
/// where V = MSB-first read of (high ++ low) and mode = MSB-first read of the middle decoder
/// (Tri.T=1, Tri.F=0). C# null is NOT the held Tri.N state; every operation rejects null loudly.
/// Roslyn is the non-Byzantine oracle: the switches carry an explicit UnreachableException arm
/// because the closed Tri hierarchy is not compiler-inferred exhaustive.
///
/// Width: field reads accumulate into <see cref="long"/> (matching the Rust u64 + F# int64 oracles;
/// TS uses f64). This keeps all four oracles in agreement up to f64's 2^53 exact-integer range --
/// the shared limit, since the decoded value is f64 in every oracle. A naive 32-bit int would wrap
/// at 2^31, diverging from the other oracles before the f64 limit; long defers that to widths no
/// realistic shape reaches.
/// </summary>
public static class FloatOps
{
    private const string ClosedHierarchy =
        "Tri is a closed hierarchy: TrueCell | FalseCell | NCell";

    /// <summary>
    /// MSB-first base-2 read of a trit field (Tri.T=1, Tri.F=0). Returns null iff ANY trit is held
    /// (Tri.N) -- the held signal. Rejects a null trit loudly (null is not Tri.N). Accumulates into
    /// long (no wrap until 63 bits; see class doc for the f64-2^53 shared limit across oracles).
    /// </summary>
    private static long? IntOf(IEnumerable<Tri> trits)
    {
        ArgumentNullException.ThrowIfNull(trits);
        var v = 0L;
        foreach (var t in trits)
        {
            switch (t)
            {
                case null:
                    throw new ArgumentException("A trit was null; null is not Tri.N.", nameof(trits));
                case Tri.NCell:
                    return null;
                case Tri.TrueCell:
                    v = (v * 2) + 1;
                    break;
                case Tri.FalseCell:
                    v *= 2;
                    break;
                default:
                    throw new UnreachableException(ClosedHierarchy);
            }
        }

        return v;
    }

    /// <summary>MSB-first encode of a non-negative integer into <paramref name="width"/> certain trits.</summary>
    private static Tri[] IntToTrits(long v, int width)
    {
        var trits = new Tri[width];
        for (var i = 0; i < width; i++)
        {
            var bit = (v >> (width - 1 - i)) & 1L;
            trits[i] = bit == 1L ? Tri.T : Tri.F;
        }

        return trits;
    }

    /// <summary>
    /// decode (middle-out, biased-exponent): read the MIDDLE decoder first, then decode OUTWARD.
    /// Tri.N in the decoder => InterpretationSuperposed; Tri.N in a value trit => ValueSuperposed
    /// (decoder read first, so InterpretationSuperposed dominates when both are held); else
    /// Decoded(V * 2^(mode - bias)).
    /// </summary>
    public static DecodeResult Decode(TriFloat f)
    {
        ArgumentNullException.ThrowIfNull(f);
        var mode = IntOf(f.Decoder);
        if (mode is null)
        {
            return new DecodeResult.Held(FloatFeedback.InterpretationSuperposed);
        }

        var v = IntOf(f.High.Concat(f.Low));
        if (v is null)
        {
            return new DecodeResult.Held(FloatFeedback.ValueSuperposed);
        }

        var bias = 1L << (f.Decoder.Count - 1);
        return new DecodeResult.Decoded(v.Value * Math.Pow(2, mode.Value - bias));
    }

    /// <summary>measure: the only collapsing op (identical to Decode; named for parity with the cell).</summary>
    public static DecodeResult Measure(TriFloat f) => Decode(f);

    /// <summary>cooperate: engage WITHOUT collapsing -- identity, preserving every held (Tri.N) trit.</summary>
    public static TriFloat Cooperate(TriFloat f)
    {
        ArgumentNullException.ThrowIfNull(f);
        return f;
    }

    /// <summary>True iff the float cannot collapse to a single number (any value or decoder trit is held).</summary>
    public static bool IsHeld(TriFloat f) => Decode(f) is DecodeResult.Held;

    /// <summary>Construct a float directly from trit fields (tests / advanced use); shape is inferred.</summary>
    public static TriFloat FromTrits(IReadOnlyList<Tri> high, IReadOnlyList<Tri> decoder, IReadOnlyList<Tri> low)
    {
        ArgumentNullException.ThrowIfNull(high);
        ArgumentNullException.ThrowIfNull(decoder);
        ArgumentNullException.ThrowIfNull(low);
        return new TriFloat(new FloatShape(high.Count, decoder.Count, low.Count), high, decoder, low);
    }

    /// <summary>
    /// fromValue (biased-exponent canonical encode): find a (mode, V) with V * 2^(mode-bias) = value,
    /// V a non-negative integer fitting the value field and mode in the decoder field. Picks the
    /// SMALLEST mode that works (a canonical representation; the biased-exponent decoder has redundant
    /// representations). v0 is unsigned + finite. Round-trips with Decode. Bounds math uses long so
    /// wide shapes return feedback rather than overflowing to negative/incorrect bounds.
    /// </summary>
    public static EncodeResult FromValue(double value, FloatShape shape)
    {
        ArgumentNullException.ThrowIfNull(shape);
        if (double.IsNaN(value) || double.IsInfinity(value) || value < 0.0)
        {
            return new EncodeResult.NotRepresentable("v0 is unsigned + finite");
        }

        var valueBits = shape.HighWidth + shape.LowWidth;
        var maxMode = (1L << shape.DecoderWidth) - 1;
        var maxV = 1L << valueBits;
        var bias = 1L << (shape.DecoderWidth - 1);

        for (long mode = 0; mode <= maxMode; mode++)
        {
            var scaled = value / Math.Pow(2, mode - bias); // = V
            if (double.IsInteger(scaled) && scaled >= 0.0 && scaled < maxV)
            {
                var v = (long)scaled;
                var bits = IntToTrits(v, valueBits);
                return new EncodeResult.Encoded(new TriFloat(
                    shape,
                    bits.Take(shape.HighWidth).ToList(),
                    IntToTrits(mode, shape.DecoderWidth),
                    bits.Skip(shape.HighWidth).ToList()));
            }
        }

        return new EncodeResult.NotRepresentable(
            $"no (mode,V) with mode<={maxMode} and V<{maxV} represents {value}");
    }
}
