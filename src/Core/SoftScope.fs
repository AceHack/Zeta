namespace Zeta.Core

/// **`SoftScope` — watch the soft emulator: render the ghost-screen + the soft observables (Aaron 2026-06-08, shadow*).**
///
/// "What do you watch when you run the soft version?" — you watch *soft observables*, because the state is a
/// distribution, not one screen. This renders them:
///   - **the ghost screen** — `SoftEmu.probLitGrid` (P(pixel lit) over the whole superposition) as an ASCII
///     intensity heatmap (the soft analog of the display: intensity = probability, not a bitmap);
///   - **the observable line** — `support` (ensemble width), `entropy` (nats), and `E[lit pixels]` (the expected
///     number of lit pixels = Σ probLit). Pair with empowerment (`SoftDashboard.empowerment`) as the agency watch.
///
/// Pure string rendering (DST-clean, no clock/RNG). ASCII ramp (no unicode — keeps the source byte-clean per
/// the culture-invariant / no-invisible-unicode disciplines).
///
/// **Honest scope (peel):** the ghost screen is the *marginal* P(lit) per pixel — it does NOT show inter-pixel
/// correlations (two pixels each at 0.5 could be perfectly correlated or anti-correlated; the heatmap can't tell).
/// That's the same marginal-vs-joint limit as factored memory; for the joint you'd inspect the ensemble members.
/// 8-level ramp (coarse). 64×32 is a large block of text — a viewer, not a compact log line.
[<RequireQualifiedAccess>]
module SoftScope =

    /// 8-level intensity ramp, dark→bright (ASCII only). Index 0 = ~0 probability, last = ~1.
    let private ramp = [| ' '; '.'; ':'; '-'; '+'; '*'; '#'; '@' |]

    /// Map a probability in [0,1] to an intensity glyph.
    let intensityChar (p: float) : char =
        let n = ramp.Length
        let idx = int (p * float n) |> max 0 |> min (n - 1)
        ramp.[idx]

    /// Render the ghost screen (`probLitGrid`) as a `DisplayH`-line ASCII heatmap, each line `DisplayW` wide.
    let renderGhost (s: SoftEmu.Soft) : string =
        SoftEmu.probLitGrid s
        |> Array.map (fun row -> System.String(row |> Array.map intensityChar))
        |> String.concat "\n"

    /// The expected number of lit pixels over the superposition (Σ P(lit)).
    let expectedLitPixels (s: SoftEmu.Soft) : float =
        let mutable total = 0.0
        for y in 0 .. Chip8.DisplayH - 1 do
            for x in 0 .. Chip8.DisplayW - 1 do
                total <- total + SoftEmu.probLit x y s
        total

    /// One-line soft observables summary (the dashboard header).
    let observables (s: SoftEmu.Soft) : string =
        System.String.Format(
            System.Globalization.CultureInfo.InvariantCulture,
            "support={0} entropy={1:F3} E[lit]={2:F1}",
            SoftEmu.support s,
            SoftEmu.entropy s,
            expectedLitPixels s
        )

    /// The full scope frame: the observable line, then the ghost-screen heatmap.
    let render (s: SoftEmu.Soft) : string = observables s + "\n" + renderGhost s

    /// **Render a concrete (hard) frame's actual display** — `#` for a lit pixel, space for unlit, as a
    /// `DisplayH`-line `DisplayW`-wide screen. This is the *definite* screen (what the emulator is really showing),
    /// vs `renderGhost`'s probability heatmap. Use to *watch* a `SoftSession` / `SoftActionController` play.
    let renderFrame (f: Chip8Cow.Frame) : string =
        [ for y in 0 .. Chip8.DisplayH - 1 ->
              System.String(
                  [| for x in 0 .. Chip8.DisplayW - 1 -> if Chip8Cow.pixel x y f then '#' else ' ' |]
              ) ]
        |> String.concat "\n"

    /// A bordered screen with a caption line above it (for a labelled filmstrip frame).
    let renderFrameCaptioned (caption: string) (f: Chip8Cow.Frame) : string =
        let bar = System.String('-', Chip8.DisplayW)
        caption + "\n" + bar + "\n" + renderFrame f + "\n" + bar
