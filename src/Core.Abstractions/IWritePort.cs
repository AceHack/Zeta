namespace Zeta.Core;

/// <summary>
/// Write-only port (contravariant — can narrow input type).
/// </summary>
public interface IWritePort<in T>
{
    /// <summary>Write a value.</summary>
    public void Write(T value);
}
