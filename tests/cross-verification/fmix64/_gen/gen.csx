// Independent C# oracle: compute MurmurHash3 fmix64 over the canonical inputs and
// emit cs-output.json. Recomputes the finaliser from scratch with unchecked
// wrapping ulong arithmetic (does not reference the Core port assembly).
using System;
using System.IO;
using System.Text;
static ulong Fmix64(ulong x)
{
    unchecked
    {
        ulong h = x;
        h ^= h >> 33;
        h *= 0xff51afd7ed558ccdUL;
        h ^= h >> 33;
        h *= 0xc4ceb9fe1a85ec53UL;
        h ^= h >> 33;
        return h;
    }
}
var inputs = new (string Id, ulong X)[]
{
    ("x-0", 0UL),
    ("x-1", 1UL),
    ("x-2", 2UL),
    ("x-10", 10UL),
    ("x-255", 255UL),
    ("x-u64max", 18446744073709551615UL),
    ("x-golden", 11400714819323198485UL),
    ("x-2pow63", 9223372036854775808UL),
    ("x-12345678901234567890", 12345678901234567890UL),
    ("x-1e18", 1000000000000000000UL),
};
var sb = new StringBuilder();
sb.AppendLine("{");
for (int i = 0; i < inputs.Length; i++)
{
    var (id, x) = inputs[i];
    var comma = i < inputs.Length - 1 ? "," : "";
    sb.AppendLine($"  \"{id}\": \"{Fmix64(x)}\"{comma}");
}
sb.AppendLine("}");
var here = Path.GetDirectoryName(Path.GetFullPath("gen.csx"))!;
var target = Path.Combine(Directory.GetParent(here)!.FullName, "cs-output.json");
File.WriteAllText(target, sb.ToString());
Console.WriteLine("wrote cs-output.json");
