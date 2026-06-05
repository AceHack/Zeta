using Zeta.Mediator;

namespace Zeta.Tests.CSharp.Mediator;

/// <summary>A void request — its response is the Zeta <see cref="Unit"/>.</summary>
public sealed record Ack : IRequest;
