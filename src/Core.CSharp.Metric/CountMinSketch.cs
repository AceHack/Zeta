namespace Zeta.Core.CSharp;

/// <summary>
/// Count-Min Sketch — C# oracle, byte-identical to the F# canonical shape
/// (<c>src/Core/CountMin.fs</c>) on the deterministic surface: <c>Add(baseHash, weight)</c> /
/// <c>Estimate(baseHash)</c> use SplitMix row seeds + a SplitMix mix + fastrange column
/// selection, all portable integer math. The <c>.NET HashCode.Combine</c> convenience hash is
/// intentionally omitted (not portable). The counter table is byte-identical across
/// F#/C#/Rust/TS over the same baseHash inputs.
/// </summary>
public sealed class CountMinSketch
{
    private readonly int depth;
    private readonly int width;
    private readonly long seed;
    private readonly long[] table;
    private readonly ulong[] rowSeeds;

    public CountMinSketch(int depth, int width, long seed)
    {
        if (depth < 1 || depth > 32) throw new ArgumentOutOfRangeException(nameof(depth), "must be 1..32");
        if (width < 8) throw new ArgumentOutOfRangeException(nameof(width), "must be >= 8");
        this.depth = depth;
        this.width = width;
        this.seed = seed;
        this.table = new long[depth * width];
        this.rowSeeds = new ulong[depth];
        for (var i = 0; i < depth; i++)
        {
            var z = (ulong)seed * 0x9E3779B97F4A7C15UL ^ ((ulong)i * 0xBF58476D1CE4E5B9UL);
            z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL;
            z = (z ^ (z >> 27)) * 0x94D049BB133111EBUL;
            rowSeeds[i] = z ^ (z >> 31);
        }
    }

    public int Depth => depth;
    public int Width => width;
    public long Seed => seed;

    private static int ColumnFor(ulong hash, int w)
    {
        var hash32 = (uint)hash;
        return (int)(((ulong)hash32 * (ulong)(uint)w) >> 32);
    }

    private int ColAt(ulong baseHash, int row)
    {
        var z = baseHash ^ rowSeeds[row];
        z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL;
        z = (z ^ (z >> 27)) * 0x94D049BB133111EBUL;
        return ColumnFor(z ^ (z >> 31), width);
    }

    public void Add(ulong baseHash, long weight)
    {
        for (var row = 0; row < depth; row++)
        {
            var col = ColAt(baseHash, row);
            table[row * width + col] = checked(table[row * width + col] + weight);
        }
    }

    public long Estimate(ulong baseHash)
    {
        var result = long.MaxValue;
        for (var row = 0; row < depth; row++)
        {
            var v = table[row * width + ColAt(baseHash, row)];
            if (v < result) result = v;
        }
        return result == long.MaxValue ? 0L : result;
    }

    public void Union(CountMinSketch other)
    {
        if (other.depth != depth || other.width != width || other.seed != seed)
            throw new ArgumentException("CountMinSketch dimensions or seed mismatch", nameof(other));
        for (var i = 0; i < table.Length; i++) table[i] = checked(table[i] + other.table[i]);
    }

    /// <summary>A copy of the raw counter table (row-major), for serialization.</summary>
    public long[] Snapshot() => (long[])table.Clone();

    /// <summary>Reconstruct from serialized state (matches F# OfState).</summary>
    public static CountMinSketch OfState(int depth, int width, long seed, long[] state)
    {
        if (state is null || state.Length != depth * width) throw new ArgumentException("state length must equal depth*width", nameof(state));
        var c = new CountMinSketch(depth, width, seed);
        Array.Copy(state, c.table, state.Length);
        return c;
    }
}
