namespace Zeta.Core;

/// <summary>
/// An operator that can save and restore its internal state for durable execution.
/// </summary>
public interface ICheckpointable
{
    void SaveState(ICheckpointWriter writer);
    void LoadState(ICheckpointReader reader);
    int StateVersion { get; }
}
