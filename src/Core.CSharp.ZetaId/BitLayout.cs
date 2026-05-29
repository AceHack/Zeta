namespace Zeta.Core.CSharp.ZetaId;

public sealed class BitLayout
{
    public (int Offset, int Width) Version { get; }
    public (int Offset, int Width) Timestamp { get; }
    public (int Offset, int Width) Chromosome { get; }
    public (int Offset, int Width) Category { get; }
    public (int Offset, int Width) Firefly { get; }
    public (int Offset, int Width) Authority { get; }
    public (int Offset, int Width) Persona { get; }
    public (int Offset, int Width) Momentum { get; }
    public (int Offset, int Width) Location { get; }
    public (int Offset, int Width) Randomness { get; }
    public int TotalBits { get; }

    private BitLayout(
        (int, int) version,
        (int, int) timestamp,
        (int, int) chromosome,
        (int, int) category,
        (int, int) firefly,
        (int, int) authority,
        (int, int) persona,
        (int, int) momentum,
        (int, int) location,
        (int, int) randomness)
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

        (int, int) Next(int width)
        {
            offset -= width;
            return (offset, width);
        }

        void Skip(int bits) => offset -= bits;

        // Spec: docs/zeta-id-v1-layout.yaml reserved_bits — 1 bit at offset 69
        // (between Chromosome and Category), 3 bits at offsets 32-34 (between
        // Location and Randomness). Total: 5+48+5+1+4+1+5+8+8+8+3+32 = 128.
        var version = Next(5);     // bits 123-127
        var timestamp = Next(48);    // bits 75-122
        var chromosome = Next(5);     // bits 70-74
        Skip(1);                      // reserved bit 69
        var category = Next(4);     // bits 65-68
        var firefly = Next(1);     // bit 64
        var authority = Next(5);     // bits 59-63
        var persona = Next(8);     // bits 51-58
        var momentum = Next(8);     // bits 43-50
        var location = Next(8);     // bits 35-42
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
            (0, 32)
        );
    }

    private static BitLayout CreateBottomUp()
    {
        // Same spec as TopDown — reserved bits at offset 69 and 32-34. We
        // compute bottom-up but assign to canonical field-name locals so
        // the ctor call uses (version, timestamp, chromosome, ...) order
        // and field-to-value mapping is explicit (Codex P2 catch on V8).
        int offset = 0;

        (int, int) Next(int width)
        {
            var start = offset;
            offset += width;
            return (start, width);
        }

        void Skip(int bits) => offset += bits;

        var randomness = Next(32);    // bits 0-31
        Skip(3);                      // reserved bits 32-34
        var location = Next(8);     // bits 35-42
        var momentum = Next(8);     // bits 43-50
        var persona = Next(8);     // bits 51-58
        var authority = Next(5);     // bits 59-63
        var firefly = Next(1);     // bit 64
        var category = Next(4);     // bits 65-68
        Skip(1);                      // reserved bit 69
        var chromosome = Next(5);     // bits 70-74
        var timestamp = Next(48);    // bits 75-122
        var version = Next(5);     // bits 123-127

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
