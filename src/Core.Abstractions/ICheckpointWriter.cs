namespace Zeta.Core;

/// <summary>
/// Checkpoint state writer — operators save their state to this during checkpoint.
/// </summary>
public interface ICheckpointWriter
{
    public void WriteInt32(int value);
    public void WriteInt64(long value);
    public void WriteFloat(double value);
    public void WriteBool(bool value);
    public void WriteBytes(byte[] value);
    public void WriteString(string value);
}
