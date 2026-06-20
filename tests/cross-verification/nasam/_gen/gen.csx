// Independent C# hand-port oracle for Pelle Evensen's `nasam` mixer.
// Re-implements the public-domain reference FROM SCRATCH — a genuine N-way peer.
// ulong arithmetic wraps mod 2^64 natively.
// Reference: https://mostlymangling.blogspot.com/2020/01/nasam-not-another-strange-acronym-mixer.html
using System;
using System.IO;
using System.Numerics;
using System.Text;

static ulong Ror(ulong x, int r) => BitOperations.RotateRight(x, r);
static ulong Nasam(ulong x)
{
    x ^= Ror(x, 25) ^ Ror(x, 47);
    x *= 0x9E6C63D0676A9A99UL;
    x ^= (x >> 23) ^ (x >> 51);
    x *= 0x9E6D62D06F6A9A9BUL;
    x ^= (x >> 23) ^ (x >> 51);
    return x;
}

var inputs = new (string id, ulong x)[]
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
sb.Append("{\n");
sb.Append("  \"_source\": \"hand-port-csharp\",\n");
for (int i = 0; i < inputs.Length; i++)
{
    var comma = i == inputs.Length - 1 ? "" : ",";
    sb.Append($"  \"{inputs[i].id}\": \"{Nasam(inputs[i].x)}\"{comma}\n");
}
sb.Append("}\n");

var target = Path.Combine(Directory.GetCurrentDirectory(), "cs-output.json");
File.WriteAllText(target, sb.ToString());
Console.WriteLine("wrote cs-output.json (hand-port)");
