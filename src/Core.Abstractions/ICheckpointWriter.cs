namespace Zeta.Core;

/// <summary>
/// Checkpoint state writer — operators save their state to this during checkpoint.
/// </summary>
public interface ICheckpointWriter
{
    void WriteInt32(int value);
    void WriteInt64(long value);
    void WriteFloat(double value);
    void WriteBool(bool value);
    void WriteBytes(byte[] value);
    void WriteString(string value);
}
