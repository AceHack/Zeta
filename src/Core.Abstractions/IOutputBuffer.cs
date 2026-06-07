namespace Zeta.Core;

/// <summary>
/// Write-only output channel handed to a plugin operator's StepAsync.
/// </summary>
public interface IOutputBuffer<in TValue>
{
    void Publish(TValue value);
}
