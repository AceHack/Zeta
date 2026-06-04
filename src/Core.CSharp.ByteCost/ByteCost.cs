using System.Text;

namespace Zeta.Core.CSharp;

/// <summary>
/// Byte-cost of a context-startup surface: the UTF-8 byte length of its canonical
/// bytes. C# oracle (#3 of TS/F#/C#/Rust) for the context-window minimization meter
/// (B-1016 slice 1). Conforms to the F# canonical shape (<c>src/Core/ByteCost.fs</c>)
/// by AGREEING on the shared seed (<c>src/Core.TypeScript/byte-cost/golden-vectors.json</c>).
///
/// Bytes, not model tokens: bytes are deterministic and byte-lockable across oracles;
/// tokenizers vary by version and cannot enter the proof lineage. <c>(ByteCost, Add, Zero)</c>
/// is a commutative monoid, so a fileset's total cost is the order-independent sum of
/// per-file costs. The meter only measures; it removes no capability (NCI-safe).
/// </summary>
public readonly record struct ByteCost(long Bytes)
{
    /// <summary>Additive identity — the empty surface costs nothing.</summary>
    public static readonly ByteCost Zero = new(0L);

    /// <summary>Monoid combine — checked addition of byte counts.</summary>
    public static ByteCost Add(ByteCost a, ByteCost b) => new(checked(a.Bytes + b.Bytes));

    /// <summary>Measure a surface from its text: UTF-8 byte length.</summary>
    public static ByteCost MeasureText(string text) => new(Encoding.UTF8.GetByteCount(text));

    /// <summary>Measure already-encoded surface bytes directly.</summary>
    public static ByteCost MeasureBytes(byte[] bytes) => new(bytes.LongLength);

    /// <summary>Order-independent total of a fileset's costs (monoid fold over <see cref="Add"/>).</summary>
    public static ByteCost Sum(IEnumerable<ByteCost> costs)
    {
        var total = Zero;
        foreach (var c in costs)
        {
            total = Add(total, c);
        }

        return total;
    }
}
