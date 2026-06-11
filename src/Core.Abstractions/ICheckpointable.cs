namespace Zeta.Core;

/// <summary>
/// An operator that can save and restore its internal state for durable execution.
/// </summary>
public interface ICheckpointable
{
    public void SaveState(ICheckpointWriter writer);
    public void LoadState(ICheckpointReader reader);
    public int StateVersion { get; }
}
