namespace Zeta.Core.CSharp.ZetaId;

public sealed class BitLayout
{
    public (Bits Offset, Bits Width) Version { get; }
    public (Bits Offset, Bits Width) Timestamp { get; }
    public (Bits Offset, Bits Width) Chromosome { get; }
    public (Bits Offset, Bits Width) Category { get; }
    public (Bits Offset, Bits Width) Firefly { get; }
    public (Bits Offset, Bits Width) Authority { get; }
    public (Bits Offset, Bits Width) Persona { get; }
    public (Bits Offset, Bits Width) Momentum { get; }
    public (Bits Offset, Bits Width) Location { get; }
    public (Bits Offset, Bits Width) Randomness { get; }
    public int TotalBits { get; }

    private BitLayout(
        (Bits, Bits) version,
        (Bits, Bits) timestamp,
        (Bits, Bits) chromosome,
        (Bits, Bits) category,
        (Bits, Bits) firefly,
        (Bits, Bits) authority,
        (Bits, Bits) persona,
        (Bits, Bits) momentum,
        (Bits, Bits) location,
        (Bits, Bits) randomness)
    {
        Version = version;
        Timestamp = timestamp;
        Chromosome = chromosome;
        Category = category;
        Firefly = firefly;
        Authority = authority;
        Persona = persona;
        Momentum = momentum;
        Location = location;
        Randomness = randomness;
        TotalBits = 128;
    }

    public static BitLayout Create(LayoutDirection direction)
    {
        return direction switch
        {
            LayoutDirection.TopDown => CreateTopDown(),
            LayoutDirection.BottomUp => CreateBottomUp(),
            _ => throw new ArgumentOutOfRangeException(nameof(direction))
        };
    }

    private static BitLayout CreateTopDown()
    {
        int offset = 128;

        (Bits, Bits) Next(Bits width)
        {
            offset -= width.Value;
            return (new Bits(offset), width);
        }

        void Skip(Bits bits) => offset -= bits.Value;

        // Spec: docs/zeta-id-v1-layout.yaml reserved_bits — 1 bit at offset 69
        // (between Chromosome and Category), 3 bits at offsets 32-34 (between
        // Location and Randomness). Total: 5+48+5+1+4+1+5+8+8+8+3+32 = 128.
        var version = Next(GeneratedBitLayout.VersionWidth);     // bits 123-127
        var timestamp = Next(GeneratedBitLayout.TimestampWidth);    // bits 75-122
        var chromosome = Next(GeneratedBitLayout.ChromosomeWidth);     // bits 70-74
        Skip(new Bits(1));                      // reserved bit 69
        var category = Next(GeneratedBitLayout.CategoryWidth);     // bits 65-68
        var firefly = Next(GeneratedBitLayout.FireflyWidth);     // bit 64
        var authority = Next(GeneratedBitLayout.AuthorityWidth);     // bits 59-63
        var persona = Next(GeneratedBitLayout.PersonaWidth);     // bits 51-58
        var momentum = Next(GeneratedBitLayout.MomentumWidth);     // bits 43-50
        var location = Next(GeneratedBitLayout.LocationWidth);     // bits 35-42
        // Bits 32-34 reserved; Randomness starts at offset 0

        return new BitLayout(
            version,
            timestamp,
            chromosome,
            category,
            firefly,
            authority,
            persona,
            momentum,
            location,
            (new Bits(0), GeneratedBitLayout.RandomnessWidth)
        );
    }

    private static BitLayout CreateBottomUp()
    {
        // Same spec as TopDown — reserved bits at offset 69 and 32-34. We
        // compute bottom-up but assign to canonical field-name locals so
        // the ctor call uses (version, timestamp, chromosome, ...) order
        // and field-to-value mapping is explicit (Codex P2 catch on V8).
        int offset = 0;

        (Bits, Bits) Next(Bits width)
        {
            var start = offset;
            offset += width.Value;
            return (new Bits(start), width);
        }

        void Skip(Bits bits) => offset += bits.Value;

        var randomness = Next(GeneratedBitLayout.RandomnessWidth);    // bits 0-31
        Skip(new Bits(3));                      // reserved bits 32-34
        var location = Next(GeneratedBitLayout.LocationWidth);     // bits 35-42
        var momentum = Next(GeneratedBitLayout.MomentumWidth);     // bits 43-50
        var persona = Next(GeneratedBitLayout.PersonaWidth);     // bits 51-58
        var authority = Next(GeneratedBitLayout.AuthorityWidth);     // bits 59-63
        var firefly = Next(GeneratedBitLayout.FireflyWidth);     // bit 64
        var category = Next(GeneratedBitLayout.CategoryWidth);     // bits 65-68
        Skip(new Bits(1));                      // reserved bit 69
        var chromosome = Next(GeneratedBitLayout.ChromosomeWidth);     // bits 70-74
        var timestamp = Next(GeneratedBitLayout.TimestampWidth);    // bits 75-122
        var version = Next(GeneratedBitLayout.VersionWidth);     // bits 123-127

        return new BitLayout(
            version,
            timestamp,
            chromosome,
            category,
            firefly,
            authority,
            persona,
            momentum,
            location,
            randomness
        );
    }

    public static BitLayout Default { get; } = Create(LayoutDirection.TopDown);
}
