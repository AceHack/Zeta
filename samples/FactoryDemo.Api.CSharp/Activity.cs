namespace Zeta.Samples.FactoryDemo.Api;

public record Activity(
    long Id,
    long CustomerId,
    long? OpportunityId,
    string Kind,
    string Notes,
    DateTimeOffset OccurredAt);
