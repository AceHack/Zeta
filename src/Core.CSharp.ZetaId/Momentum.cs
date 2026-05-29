namespace Zeta.Core.CSharp.ZetaId;

public abstract record Momentum
{
    public sealed record Background() : Momentum;
    public sealed record Normal() : Momentum;
    public sealed record Elevated() : Momentum;
    public sealed record High() : Momentum;
    public sealed record Critical() : Momentum;

    /// <summary>
    /// Raw escape for values not in the named set. Momentum is packed into an
    /// 8-bit field so any byte value fits. Constructor throws if Value collides
    /// with a named case (e.g. Raw(96) would unpack as Normal — round-trip
    /// instability). Use the named case directly for those values.
    /// </summary>
    public sealed record Raw : Momentum
    {
        public byte Value { get; }

        public Raw(byte Value)
        {
            if (Value is (byte)MomentumValue.Background
                or (byte)MomentumValue.Normal
                or (byte)MomentumValue.Elevated
                or (byte)MomentumValue.High
                or (byte)MomentumValue.Critical)
                throw new ArgumentOutOfRangeException(
                    nameof(Value), Value,
                    $"Momentum.Raw({Value}) aliases a named case. Round-trip is not stable: Pack writes {Value}, Unpack canonicalizes to the named record. Use the named case directly (Background/Normal/Elevated/High/Critical) instead of Raw.");
            this.Value = Value;
        }
    }

    internal static byte ToByte(Momentum momentum) => momentum switch
    {
        Raw r => r.Value,
        Background => (byte)MomentumValue.Background,
        Normal => (byte)MomentumValue.Normal,
        Elevated => (byte)MomentumValue.Elevated,
        High => (byte)MomentumValue.High,
        Critical => (byte)MomentumValue.Critical,
        _ => throw new InvalidOperationException(
            $"Unknown Momentum subtype '{momentum.GetType().FullName}'. " +
            "External subtyping of the public abstract Momentum record is not " +
            "supported by ZetaIdCodec; use Momentum.Raw(byte) for any value " +
            "outside the named set.")
    };

    internal static Momentum FromByte(byte value)
    {
        return value switch
        {
            (byte)MomentumValue.Background => new Background(),
            (byte)MomentumValue.Normal => new Normal(),
            (byte)MomentumValue.Elevated => new Elevated(),
            (byte)MomentumValue.High => new High(),
            (byte)MomentumValue.Critical => new Critical(),
            _ => new Raw(value)
        };
    }
}
