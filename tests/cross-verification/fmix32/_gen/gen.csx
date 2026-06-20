// Independent C# oracle: compute MurmurHash3 fmix32 over the canonical inputs and
// emit cs-output.json. Recomputes the finaliser from scratch with unchecked
// wrapping uint arithmetic (does not reference the Core port assembly).
using System;
using System.IO;
using System.Text;

static uint Fmix32(uint x)
{
    unchecked
    {
        uint h = x;
        h ^= h >> 16;
        h *= 0x85ebca6b;
        h ^= h >> 13;
        h *= 0xc2b2ae35;
        h ^= h >> 16;
        return h;
    }
}

var inputs = new (string Id, uint X)[]
{
    ("x-0", 0u),
    ("x-1", 1u),
    ("x-2", 2u),
    ("x-10", 10u),
    ("x-255", 255u),
    ("x-u32max", 4294967295u),
    ("x-0x9e3779b9", 2654435769u),
    ("x-2pow31", 2147483648u),
    ("x-3735928559", 3735928559u),
    ("x-1e9", 1000000000u),
};
var sb = new StringBuilder();
sb.AppendLine("{");
for (int i = 0; i < inputs.Length; i++)
{
    var (id, x) = inputs[i];
    var comma = i < inputs.Length - 1 ? "," : "";
    sb.AppendLine($"  \"{id}\": \"{Fmix32(x)}\"{comma}");
}
sb.AppendLine("}");
var here = Path.GetDirectoryName(Path.GetFullPath("gen.csx"))!;
var target = Path.Combine(Directory.GetParent(here)!.FullName, "cs-output.json");
File.WriteAllText(target, sb.ToString());
Console.WriteLine("wrote cs-output.json");
