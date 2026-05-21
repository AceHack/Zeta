namespace Zeta.Core.CSharp.ZetaId;

public readonly record struct ZetaObservation(
    IdVersion Version,
    long Timestamp,
    Chromosome Chromosome,
    Category Category,
    Firefly Firefly,
    Authority Authority,
    Persona Persona,
    Momentum Momentum,
    Location Location);
