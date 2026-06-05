using Zeta.Mediator;

namespace Zeta.Tests.CSharp.Mediator;

/// <summary>A stream request yielding <c>From, From-1, …, 1</c> — via the Zeta port.</summary>
public sealed record Countdown(int From) : IStreamRequest<int>;
