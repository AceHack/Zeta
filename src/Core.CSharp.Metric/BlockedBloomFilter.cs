using System.Buffers.Binary;
using System.IO.Hashing;

namespace Zeta.Core.CSharp;

/// <summary>
/// Insert-only blocked Bloom filter — C# oracle, byte-identical to the F# canonical shape
/// (<c>src/Core/BloomFilter.fs</c>): keys hash via XXH3-128 (<c>System.IO.Hashing</c>),
/// (h1,h2) = (high64, low64), bucket = high 32 bits of h1, then <c>probesPerLookup</c> bits
/// set within one 512-bit (8×UInt64) bucket by double-hashing. The table is byte-identical
/// across F#/C#/Rust/TS over the same keys (verified by golden vectors).
/// </summary>
public sealed class BlockedBloomFilter
{
    private const int WordsPerBucket = 8;
    private readonly ulong[] table;
    private readonly int bucketCount;
    private readonly int probesPerLookup;
    private readonly uint bucketMask;
    private readonly bool isPow2;

    public BlockedBloomFilter(int bucketCount, int probesPerLookup)
    {
        if (bucketCount <= 0) throw new ArgumentOutOfRangeException(nameof(bucketCount), "must be positive");
        if (probesPerLookup <= 0 || probesPerLookup > 32) throw new ArgumentOutOfRangeException(nameof(probesPerLookup), "must be in 1..32");
        this.bucketCount = bucketCount;
        this.probesPerLookup = probesPerLookup;
        this.table = new ulong[bucketCount * WordsPerBucket];
        this.bucketMask = (bucketCount & (bucketCount - 1)) == 0 ? (uint)(bucketCount - 1) : 0u;
        this.isPow2 = bucketMask != 0u || bucketCount == 1;
    }

    public ulong[] Table => table;
    public int BucketCount => bucketCount;
    public int ProbesPerLookup => probesPerLookup;

    private int BucketIndex(ulong h1) =>
        isPow2
            ? (int)((uint)(h1 >> 32) & bucketMask)
            : (int)((uint)(h1 >> 32) % (uint)bucketCount);

    private void SetBucketBits(int bucketBase, ulong h1, ulong h2)
    {
        var h = h1;
        for (var i = 0; i < probesPerLookup; i++)
        {
            var bit = (int)(h & 0x1FFUL);
            var w = bit >> 6;
            var b = bit & 0x3F;
            table[bucketBase + w] |= 1UL << b;
            h += h2 + (ulong)i;
        }
    }

    private bool TestBucketBits(int bucketBase, ulong h1, ulong h2)
    {
        var h = h1;
        for (var i = 0; i < probesPerLookup; i++)
        {
            var bit = (int)(h & 0x1FFUL);
            var w = bit >> 6;
            var b = bit & 0x3F;
            if ((table[bucketBase + w] & (1UL << b)) == 0UL) return false;
            h += h2 + (ulong)i;
        }
        return true;
    }

    private static (ulong h1, ulong h2) PairOf(ReadOnlySpan<byte> bytes)
    {
        // XXH3-128: HashToUInt128 returns (high64 << 64) | low64; F# split = (high64, low64).
        var h = XxHash128.HashToUInt128(bytes);
        return ((ulong)(h >> 64), (ulong)h);
    }

    private static (ulong h1, ulong h2) PairOfInt64(long key)
    {
        Span<byte> buf = stackalloc byte[8];
        BinaryPrimitives.WriteInt64LittleEndian(buf, key);
        return PairOf(buf);
    }

    public void Add(long key)
    {
        var (h1, h2) = PairOfInt64(key);
        SetBucketBits(BucketIndex(h1) * WordsPerBucket, h1, h2);
    }

    public void AddBytes(ReadOnlySpan<byte> bytes)
    {
        var (h1, h2) = PairOf(bytes);
        SetBucketBits(BucketIndex(h1) * WordsPerBucket, h1, h2);
    }

    public bool MayContain(long key)
    {
        var (h1, h2) = PairOfInt64(key);
        return TestBucketBits(BucketIndex(h1) * WordsPerBucket, h1, h2);
    }

    public void MergeFrom(BlockedBloomFilter other)
    {
        if (other.table.Length != table.Length) throw new ArgumentException("table length (m) differs", nameof(other));
        if (other.probesPerLookup != probesPerLookup) throw new ArgumentException("probe count (k) differs", nameof(other));
        for (var i = 0; i < table.Length; i++) table[i] |= other.table[i];
    }

    /// <summary>Reconstruct from a serialized bit-table + shape (matches F# OfState).</summary>
    public static BlockedBloomFilter OfState(int bucketCount, int probesPerLookup, ulong[] state)
    {
        var f = new BlockedBloomFilter(bucketCount, probesPerLookup);
        if (state is null || state.Length != f.table.Length) throw new ArgumentException("state length must equal the filter table length", nameof(state));
        Array.Copy(state, f.table, state.Length);
        return f;
    }
}
