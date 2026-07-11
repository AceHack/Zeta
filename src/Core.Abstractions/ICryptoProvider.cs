namespace Zeta.Core.Abstractions;

public interface ICryptoProvider
{
    public byte[] Encrypt(byte[] plaintext);
    public byte[] Decrypt(byte[] ciphertext);
}
