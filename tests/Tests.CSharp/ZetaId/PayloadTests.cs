using Xunit;
using Zeta.Core.CSharp.ZetaId;

namespace Zeta.Tests.CSharp.ZetaId;

public class PayloadTests
{
    private static readonly ZetaObservation FixedObservation = new(
        Version: IdVersion.V1,
        Timestamp: 1747780809123L,
        Chromosome: Chromosome.FinancialIntegrity,
        Category: Category.Observation,
        Firefly: Firefly.NoDirective,
        Authority: new Authority.HumanVerified(),
        Persona: (Persona)1,
        Momentum: new Momentum.High(),
        Location: Location.EastUsVa
    );

    [Fact]
    public void PackPayloadUnpackPayloadRoundtripsObservation()
    {
        var payload = new ZetaIdPayload.Observation(FixedObservation);
        var id = ZetaIdCodec.PackPayload(payload, DeterministicEnv.Instance);
        var unpacked = ZetaIdCodec.UnpackPayload(id);
        Assert.Equal(payload, unpacked);
    }

    [Fact]
    public void PackPayloadUnpackPayloadRoundtripsContentAddress()
    {
        UInt128 content = (UInt128.One << 119) - 5;
        var payload = new ZetaIdPayload.ContentAddress(IdVersion.V1, content);
        var id = ZetaIdCodec.PackPayload(payload, DeterministicEnv.Instance);
        var unpacked = ZetaIdCodec.UnpackPayload(id);
        Assert.Equal(payload, unpacked);
    }

    [Fact]
    public void PackPayloadUnpackPayloadRoundtripsGeneric()
    {
        UInt128 content = 1234567890123456789UL;
        var payload = new ZetaIdPayload.Generic(IdVersion.V1, Category.Extended, content);
        var id = ZetaIdCodec.PackPayload(payload, DeterministicEnv.Instance);
        var unpacked = ZetaIdCodec.UnpackPayload(id);
        Assert.Equal(payload, unpacked);
    }

    [Fact]
    public void PackPayloadThrowsOnOutOfBoundsPayload()
    {
        UInt128 invalidPayload = UInt128.One << 119;
        
        var contentPayload = new ZetaIdPayload.ContentAddress(IdVersion.V1, invalidPayload);
        Assert.Throws<ArgumentOutOfRangeException>(() => ZetaIdCodec.PackPayload(contentPayload, DeterministicEnv.Instance));

        var genericPayload = new ZetaIdPayload.Generic(IdVersion.V1, Category.Extended, invalidPayload);
        Assert.Throws<ArgumentOutOfRangeException>(() => ZetaIdCodec.PackPayload(genericPayload, DeterministicEnv.Instance));
    }

    [Fact]
    public void PackPayloadThrowsOnInvalidCategoryForGeneric()
    {
        var genericPayload = new ZetaIdPayload.Generic(IdVersion.V1, Category.Heartbeat, 100);
        Assert.Throws<ArgumentException>(() => ZetaIdCodec.PackPayload(genericPayload, DeterministicEnv.Instance));
    }
}
