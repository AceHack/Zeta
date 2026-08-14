using Xunit;
using Zeta.Core.CSharp.ZetaId;

namespace Zeta.Tests.CSharp.ZetaId;

/// <summary>
/// PackGeneric is PUBLIC and used to mask an oversized payload instead of
/// rejecting it. Masking aliases ids rather than failing, and the aliasing has
/// a date: at 2039-09-07T15:47:35.552Z a caller building (ms &lt;&lt; 78) | random78
/// reaches ms = 2^41, the top ms bit falls off, and the id is byte-identical to
/// the same call with ms = 0.
///
/// No in-repo caller reaches PackGeneric directly today -- every path goes
/// through the validating PackPayload wrapper -- so the bound is INERT for every
/// id mintable today (proved below against the real on-disk inventory ids). The
/// exposure it closes is a FUTURE caller reaching past the wrapper, which is
/// exactly the mistake inventory/new-item.ts made on the TypeScript side.
/// </summary>
public class PackGenericBoundTests
{
    private const int PayloadBits = 119;
    private const int MsShift = 78;

    // The ms value at which a (ms << 78) payload first needs a 120th bit.
    private static readonly UInt128 CliffMs = UInt128.One << 41;

    private static int BitLength(UInt128 v)
    {
        int n = 0;
        while (v > 0) { v >>= 1; n++; }
        return n;
    }

    // ── The dated collision ────────────────────────────────────────────────

    [Fact]
    public void PackGenericRejectsThe2039CliffInsteadOfAliasingItOntoMsZero()
    {
        UInt128 cliffPayload = CliffMs << MsShift;
        Assert.Equal(120, BitLength(cliffPayload));

        Assert.Throws<ArgumentOutOfRangeException>(
            () => ZetaIdCodec.PackGeneric(IdVersion.V1, Category.InventoryAsset, cliffPayload));
    }

    [Fact]
    public void TheLastMsBeforeTheCliffStillMints()
    {
        // The bound must fire AT the boundary, not before it: ms = 2^41 - 1 with
        // every random bit set is still exactly 119 bits and must round-trip.
        UInt128 lastMs = CliffMs - UInt128.One;
        UInt128 payload = (lastMs << MsShift) | ((UInt128.One << MsShift) - UInt128.One);
        Assert.Equal(PayloadBits, BitLength(payload));

        UInt128 id = ZetaIdCodec.PackGeneric(IdVersion.V1, Category.InventoryAsset, payload);
        var (version, category, recovered) = ZetaIdCodec.UnpackGeneric(id);

        Assert.Equal(IdVersion.V1, version);
        Assert.Equal(Category.InventoryAsset, category);
        Assert.Equal(payload, recovered);
    }

    [Fact]
    public void TheExactCapMintsAndOneBitOverDoesNot()
    {
        UInt128 atCap = (UInt128.One << PayloadBits) - UInt128.One;
        Assert.Equal(PayloadBits, BitLength(atCap));
        Assert.Equal(atCap, ZetaIdCodec.UnpackGeneric(
            ZetaIdCodec.PackGeneric(IdVersion.V1, Category.InventoryAsset, atCap)).Payload);

        UInt128 overCap = UInt128.One << PayloadBits;
        Assert.Throws<ArgumentOutOfRangeException>(
            () => ZetaIdCodec.PackGeneric(IdVersion.V1, Category.InventoryAsset, overCap));
    }

    // ── The negative-payload aliasing class ────────────────────────────────

    [Fact]
    public void TheAllOnesValueIsRejectedTheCSharpAnalogueOfTheBigIntMinusOneHole()
    {
        // On the TypeScript side `payload` is a signed `bigint`, so masking made
        // -1n indistinguishable from all-ones. C# cannot admit a negative here at
        // all: the parameter is UInt128, which is unsigned, so the hole does not
        // exist as a distinct case. What a caller CAN still do is reinterpret -1,
        // and unchecked((UInt128)(-1)) is exactly UInt128.MaxValue -- the same
        // all-ones bit pattern. That value is now rejected rather than masked
        // down to the 119-bit all-ones payload it used to alias onto.
        UInt128 allOnes = unchecked((UInt128)(-1));
        Assert.Equal(UInt128.MaxValue, allOnes);

        Assert.Throws<ArgumentOutOfRangeException>(
            () => ZetaIdCodec.PackGeneric(IdVersion.V1, Category.InventoryAsset, allOnes));
    }

    // ── Inertness, against real committed data ─────────────────────────────

    // Every id currently committed under inventory/items/. Recovered, re-minted
    // through the bounded path, and required to come back byte-identical.
    public static TheoryData<string> OnDiskInventoryIds() => new()
    {
        "0EFJ9RW179ZFT9WBMXZZNYM92A",
        "0EFJ9RW1DD28A33YN3F9NCAP9E",
    };

    [Theory]
    [MemberData(nameof(OnDiskInventoryIds))]
    public void RealOnDiskInventoryIdsRoundTripByteIdenticalAndSitExactlyAtTheCap(string canonical)
    {
        UInt128 id = ZetaIdCodec.Parse(canonical);
        var (version, category, payload) = ZetaIdCodec.UnpackGeneric(id);

        // The measurement that makes the bound reviewable: ZERO headroom. These
        // ids are not comfortably under the cap, they are AT it.
        Assert.Equal(PayloadBits, BitLength(payload));

        UInt128 reminted = ZetaIdCodec.PackGeneric(version, category, payload);
        Assert.Equal(id, reminted);
        Assert.Equal(canonical, ZetaIdCodec.Format(reminted), StringComparer.Ordinal);
    }

    [Fact]
    public void TodaysClockIsStillInsideTheBoundButWithNoHeadroom()
    {
        // The shape inventory/new-item.ts mints with, at a fixed ms so the test is
        // deterministic (2026-08-14T00:00:00Z). Already 119 bits: the design
        // consumed the entire payload, so ONE more bit of clock overflows it.
        const long ms = 1786752000000L;
        UInt128 payload = ((UInt128)ms << MsShift) | ((UInt128.One << MsShift) - UInt128.One);

        Assert.Equal(PayloadBits, BitLength(payload));

        UInt128 id = ZetaIdCodec.PackGeneric(IdVersion.V1, Category.InventoryAsset, payload);
        Assert.Equal(payload, ZetaIdCodec.UnpackGeneric(id).Payload);
    }
}
