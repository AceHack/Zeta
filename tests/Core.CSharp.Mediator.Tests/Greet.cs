using Zeta.Mediator;

namespace Zeta.Tests.CSharp.Mediator;

/// <summary>A CQRS command (write) returning a string — via the Zeta port.</summary>
public sealed record Greet(string Name) : ICommand<string>;
