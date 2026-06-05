using Zeta.Mediator;

namespace Zeta.Mediator.Handlers;

/// <summary>
/// Measure the context-cost (UTF-8 byte length) of a context-startup surface — the B-1016 meter, as a
/// CQRS query through the mediator. A real operational concern (cold-start token minimization), not a toy.
/// </summary>
/// <param name="Surface">The surface text to measure.</param>
public sealed record MeasureContextCostQuery(string Surface) : IQuery<long>;
