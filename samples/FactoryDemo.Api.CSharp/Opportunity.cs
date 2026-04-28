namespace Zeta.Samples.FactoryDemo.Api;

public record Opportunity(
    long Id,
    long CustomerId,
    string Stage,
    long AmountCents,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
