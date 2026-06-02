using System.Text;
using Xunit;
using Sha256Lib = Zeta.Core.CSharp.Sha256.Sha256;

namespace Zeta.Tests.CSharp.Sha256;

/// <summary>
/// Standard-anchored SHA-256 tests (FIPS 180-4 / NIST test vectors).
/// These pass through System.Security.Cryptography.SHA256 via our BCL-clean wrapper.
/// </summary>
public class Sha256Tests
{
    // FIPS 180-4 / NIST SHA-256 vector: empty string.
    [Fact]
    public void EmptyStringMatchesNist()
    {
        var hex = Sha256Lib.HashHex(Encoding.UTF8.GetBytes(""));
        Assert.Equal("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", hex);
    }

    // FIPS 180-4 / NIST SHA-256 vector: "abc".
    [Fact]
    public void AbcMatchesNist()
    {
        var hex = Sha256Lib.HashHex(Encoding.UTF8.GetBytes("abc"));
        Assert.Equal("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", hex);
    }

    // FIPS 180-4 / NIST SHA-256 vector: two-block message (448-bit boundary).
    [Fact]
    public void NistTwoBlockMatchesNist()
    {
        var hex = Sha256Lib.HashHex(Encoding.UTF8.GetBytes("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"));
        Assert.Equal("248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1", hex);
    }

    // Hash must produce exactly 32 bytes.
    [Fact]
    public void HashReturns32Bytes()
    {
        var bytes = Sha256Lib.Hash(Encoding.UTF8.GetBytes("abc"));
        Assert.Equal(32, bytes.Length);
    }
}
