namespace Zeta.Samples.FactoryDemo.Api;

public record Customer(
    long Id,
    string Name,
    string Email,
    string Phone,
    string Address,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt);
