namespace Zeta.Core.CSharp.ZetaId;

public abstract record ZetaIdPayload
{
    public sealed record Observation(ZetaObservation Obs) : ZetaIdPayload;
    public sealed record ContentAddress(IdVersion Version, UInt128 Payload) : ZetaIdPayload;
    public sealed record Generic(IdVersion Version, Category Category, UInt128 Payload) : ZetaIdPayload;
}
