using Zeta.Mediator;

namespace Zeta.Tests.CSharp.Mediator;

/// <summary>A notification broadcast via the Zeta port.</summary>
public sealed record Tick : INotification;
