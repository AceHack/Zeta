using Zeta.Mediator;

namespace Zeta.Tests.CSharp.Mediator;

/// <summary>A request returning a string — declared via the Zeta port (never global::Mediator.*).</summary>
public sealed record Ping(string Name) : IRequest<string>;
