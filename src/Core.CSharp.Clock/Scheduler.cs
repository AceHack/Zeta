namespace Zeta.Core.CSharp;

/// <summary>
/// An injectable deterministic scheduler (Rx IScheduler shape). Seeded → replays
/// identically (DST). C# oracle of the clock primitive (B-1016 floor #1).
/// </summary>
public readonly record struct Scheduler(Versionstamp Now)
{
    public static Scheduler FromSeed(long seed) => new(new Versionstamp(seed));

    public Scheduler Step() => new(Now.Tick());

    /// <summary>The deterministic timeline: the stamps from <paramref name="n"/> steps.</summary>
    public static IReadOnlyList<long> Run(long seed, int n)
    {
        var stamps = new List<long>(n);
        var s = FromSeed(seed);
        for (var i = 0; i < n; i++)
        {
            s = s.Step();
            stamps.Add(s.Now.Version);
        }

        return stamps;
    }
}
