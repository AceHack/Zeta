using System;
using System.IO;
using System.Text.Json;
using Xunit;
using Zeta.Core.CSharp;

namespace Zeta.Tests.CSharp;

/// <summary>
/// Keyring 4x4 treaty cross-verification — the C# oracle agrees on the shared golden vectors
/// (<c>tools/setup/persona-keys/golden-vectors-keyring-4x4.json</c>).
/// </summary>
public class Keyring4x4CrossVerifyTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(Path.GetDirectoryName(typeof(Keyring4x4CrossVerifyTests).Assembly.Location)!);
        while (dir is not null && !File.Exists(Path.Join(dir.FullName, "Zeta.sln")))
        {
            dir = dir.Parent;
        }

        return dir?.FullName
            ?? throw new InvalidOperationException("Could not locate repo root (Zeta.sln) from test assembly location.");
    }

    private static string Hex(byte[] bytes) => Convert.ToHexString(bytes).ToLowerInvariant();

    [Fact]
    public void Keyring4x4CSharpOracleAgreesWithGoldenVector()
    {
        string goldenPath = Path.Join(RepoRoot(), "tools", "setup", "persona-keys", "golden-vectors-keyring-4x4.json");
        using var doc = JsonDocument.Parse(File.ReadAllText(goldenPath));
        var expected = doc.RootElement.GetProperty("expected");
        string jsonExpected = expected.GetProperty("canonical_json").GetString()!;
        string cborHexExpected = expected.GetProperty("canonical_cbor_hex").GetString()!;
        string xmlExpected = expected.GetProperty("canonical_xml").GetString()!;

        // 1. Decode canonical_json into a DynamicValue
        if (DynamicValues.FromCanonicalJson(jsonExpected) is not Result<DynamicValue, DecodeError>.Ok dvOk)
        {
            Assert.Fail("Failed to decode canonical_json");
            return;
        }
        DynamicValue dv = dvOk.Value;

        // 2. Verify JSON re-encoding matches canonical_json
        if (DynamicValues.ToCanonicalJson(dv) is not Result<string, EncodeError>.Ok jsonOk)
        {
            Assert.Fail("Failed to encode canonical_json");
            return;
        }
        Assert.Equal(jsonExpected, jsonOk.Value);

        // 3. Verify CBOR re-encoding matches canonical_cbor_hex
        byte[] cborBytes = DynamicValues.ToCanonicalCborOk(dv);
        Assert.Equal(cborHexExpected, Hex(cborBytes));

        // 4. Verify XML re-encoding matches canonical_xml
        if (DynamicValuesXml.ToCanonicalXml(dv) is not Result<string, EncodeError>.Ok xmlOk)
        {
            Assert.Fail("Failed to encode canonical_xml");
            return;
        }
        Assert.Equal(xmlExpected, xmlOk.Value);
    }
}
