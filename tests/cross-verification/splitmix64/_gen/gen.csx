// Independent C# oracle: compute SplitMix64 over the canonical inputs and emit
// cs-output.json. Recomputes the mixer from scratch with unchecked wrapping
// ulong arithmetic (does not reference the Core port assembly).
using System;
using System.IO;
using System.Text;

static ulong Mix(ulong x)
{
    unchecked
    {
        ulong z = x * 0x9E3779B97F4A7C15UL;
        z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL;
        z = (z ^ (z >> 27)) * 0x94D049BB133111EBUL;
        return z ^ (z >> 31);
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
    sb.AppendLine($"  \"{id}\": \"{Mix(x)}\"{comma}");
}
sb.AppendLine("}");

var here = Path.GetDirectoryName(Path.GetFullPath("gen.csx"))!;
var target = Path.Combine(Directory.GetParent(here)!.FullName, "cs-output.json");
File.WriteAllText(target, sb.ToString());
Console.WriteLine("wrote cs-output.json");
