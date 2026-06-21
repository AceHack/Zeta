namespace Zeta.Core;

/// <summary>
/// Hexagonal port: the boundary between domain and infrastructure.
/// Invariant on T (read + write). The WorkspacePort, EventSink, OperatorPort pattern.
/// </summary>
/// <typeparam name="T">The value type flowing through the port.</typeparam>
public interface IPort<T> : IReadPort<T>, IWritePort<T>
{
}
