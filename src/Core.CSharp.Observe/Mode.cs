namespace Zeta.Core.CSharp.Observe;

// C# port of the observe/simulate/fold event algebra (B-0867.27) — oracle #3 of
// four (TS/F#/C#/Rust) in the cross-language-parity = non-Byzantine-BFT consensus
// (B-0944: "the compilers don't lie"). Types mirror the TS reference
// (src/Core.TypeScript/observe/observe.ts) and the F# port (src/Core.FSharp.Observe) so the
// shared golden-vector fixture (src/Core.TypeScript/observe/golden-vectors.json) replays
// identically here. Zero external dependencies.

/// <summary>The persisted mode. JSON wire form uses the lower/snake strings
/// "work" | "explore" | "play" | "self_reflect" | "free_time".</summary>
public enum Mode
{
    Work,
    Explore,
    Play,
    SelfReflect,
    FreeTime,
}
