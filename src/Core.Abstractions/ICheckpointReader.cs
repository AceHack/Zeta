namespace Zeta.Core;

/// <summary>
/// Checkpoint state reader — operators load their state from this during recovery.
/// </summary>
public interface ICheckpointReader
{
    public int ReadInt32();
    public long ReadInt64();
    public double ReadFloat();
    public bool ReadBool();
    public byte[] ReadBytes();
    public string ReadString();
}
