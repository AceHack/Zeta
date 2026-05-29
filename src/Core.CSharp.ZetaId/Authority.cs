namespace Zeta.Core.CSharp.ZetaId;

public abstract record Authority
{
    public sealed record HumanVerified() : Authority;
    public sealed record TrustedAgent() : Authority;
    public sealed record Standard() : Authority;
    public sealed record BestEffort() : Authority;
    public sealed record Simulated() : Authority;

    /// <summary>
    /// Raw escape for values not in the named set. Authority is packed
    /// into a 5-bit field so Value MUST be 0..31. Constructor throws
    /// ArgumentOutOfRangeException for Value > 31 to prevent silent
    /// truncation + collision (e.g. Raw(255) would otherwise mask to 31
    /// and round-trip as HumanVerified).
    /// </summary>
    public sealed record Raw : Authority
    {
        public byte Value { get; }

        public Raw(byte Value)
        {
            if (Value > 31)
                throw new ArgumentOutOfRangeException(
                    nameof(Value), Value,
                    "Authority.Raw value must be 0..31 (5-bit field). Values 32..255 would silently truncate and collide.");
            if (Value is (byte)AuthorityValue.HumanVerified
                or (byte)AuthorityValue.TrustedAgent
                or (byte)AuthorityValue.Standard
                or (byte)AuthorityValue.BestEffort
                or (byte)AuthorityValue.Simulated)
                throw new ArgumentOutOfRangeException(
                    nameof(Value), Value,
                    $"Authority.Raw({Value}) aliases a named case. Round-trip is not stable: Pack writes {Value}, Unpack canonicalizes to the named record. Use the named case directly (HumanVerified/TrustedAgent/Standard/BestEffort/Simulated) instead of Raw.");
            this.Value = Value;
        }
    }

    internal static byte ToByte(Authority authority) => authority switch
    {
        Raw r => r.Value,
        HumanVerified => (byte)AuthorityValue.HumanVerified,
        TrustedAgent => (byte)AuthorityValue.TrustedAgent,
        Standard => (byte)AuthorityValue.Standard,
        BestEffort => (byte)AuthorityValue.BestEffort,
        Simulated => (byte)AuthorityValue.Simulated,
        _ => throw new InvalidOperationException(
            $"Unknown Authority subtype '{authority.GetType().FullName}'. " +
            "External subtyping of the public abstract Authority record is not " +
            "supported by ZetaIdCodec; use Authority.Raw(byte) for any value " +
            "outside the named set.")
    };

    internal static Authority FromByte(byte value)
    {
        return value switch
        {
            (byte)AuthorityValue.HumanVerified => new HumanVerified(),
            (byte)AuthorityValue.TrustedAgent => new TrustedAgent(),
            (byte)AuthorityValue.Standard => new Standard(),
            (byte)AuthorityValue.BestEffort => new BestEffort(),
            (byte)AuthorityValue.Simulated => new Simulated(),
            _ => new Raw(value)
        };
    }
}
