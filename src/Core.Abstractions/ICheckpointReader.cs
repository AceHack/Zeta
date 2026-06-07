namespace Zeta.Core;

/// <summary>
/// Checkpoint state reader — operators load their state from this during recovery.
/// </summary>
public interface ICheckpointReader
{
    int ReadInt32();
    long ReadInt64();
    double ReadFloat();
    bool ReadBool();
    byte[] ReadBytes();
    string ReadString();
}
