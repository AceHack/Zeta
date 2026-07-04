namespace Zeta.Core.Abstractions;

public interface ICryptoProvider
{
    byte[] Encrypt(byte[] plaintext);
    byte[] Decrypt(byte[] ciphertext);
}
