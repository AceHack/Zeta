namespace Zeta.Core.CSharp.TriBoolean;

/// <summary>
/// Field widths of a tri-boolean float (trits per field), MSB-first within each field. Parity with
/// the TS FloatShape (src/Core.TypeScript/tri-boolean-float/types.ts) and F# Float.FloatShape.
/// </summary>
/// <param name="HighWidth">High (more-significant) value trits.</param>
/// <param name="DecoderWidth">Middle decoder trits (the selector read first; the biased-exponent mode).</param>
/// <param name="LowWidth">Low (less-significant) value trits.</param>
public sealed record FloatShape(int HighWidth, int DecoderWidth, int LowWidth)
{
    /// <summary>Reference v0 shape: 4/3/4 -- 8 value trits, mode in [0,8), bias = 4.</summary>
    public static readonly FloatShape Default = new(HighWidth: 4, DecoderWidth: 3, LowWidth: 4);
}
