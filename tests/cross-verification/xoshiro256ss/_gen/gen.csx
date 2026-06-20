// Independent C# hand-port oracle for the xoshiro256** OUTPUT SCRAMBLER.
// Re-implements result = rotl(x*5, 7) * 9 (width 64) FROM SCRATCH — a genuine
// N-way peer. ulong arithmetic wraps mod 2^64 natively.
// Public-domain reference: https://prng.di.unimi.it/xoshiro256starstar.c
using System;
using System.IO;
using System.Text;

static ulong Rotl(ulong x, int k) => (x << k) | (x >> (64 - k));
static ulong Scramble(ulong x) => Rotl(x * 5UL, 7) * 9UL;

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
    sb.Append($"  \"{inputs[i].id}\": \"{Scramble(inputs[i].x)}\"{comma}\n");
}
sb.Append("}\n");

var target = Path.Combine(Directory.GetCurrentDirectory(), "cs-output.json");
File.WriteAllText(target, sb.ToString());
Console.WriteLine("wrote cs-output.json (hand-port)");
