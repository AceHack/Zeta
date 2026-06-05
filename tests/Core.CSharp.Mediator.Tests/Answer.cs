using Zeta.Mediator;

namespace Zeta.Tests.CSharp.Mediator;

/// <summary>A CQRS query (read) returning an int — via the Zeta port.</summary>
public sealed record Answer : IQuery<int>;
