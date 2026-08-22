namespace Zeta.Core

open System.Globalization

/// **`SocietalDoraSvg` — the societal-DORA health dials as a PURE SVG dashboard (Aaron 2026-06-19, shadow\*).**
///
/// Slice 1 of the Zeta demo UX/UI
/// (`docs/research/2026-06-19-zeta-demo-ux-ui-pure-css-svg-qsharp-pulls-it-all-together-scoping.md`): render
/// `SocietalDora.Metrics` as a **declarative SVG** — a *pure function of state* (the animate-not-update
/// discipline). No `<script>`, **integer coordinates only**, deterministic attribute order — the
/// `ShapeRender` strict-dialect ethos, so the output is **byte-lockable** (same metrics ⇒ same bytes).
/// Runs on the **verified F# substrate** (`SocietalDora` over `Decorrelation.ρ_owe`); no Q# needed for this
/// slice (Q# is the frontier lane, slice 4).
[<RequireQualifiedAccess>]
module SocietalDoraSvg =

    /// Invariant int→string (CA1305: never culture-sensitive in the bytes).
    let private s (i: int) : string = i.ToString(CultureInfo.InvariantCulture)

    /// A `[0,1]` value as an integer percent (clamped).
    let private pct (v: float) : int =
        let c = if v < 0.0 then 0.0 elif v > 1.0 then 1.0 else v
        int (System.Math.Round(c * 100.0))

    /// One horizontal gauge: label, a 300px track, a fill proportional to the value, and the percent.
    let private bar (y: int) (label: string) (v: float) : string =
        let p = pct v
        let w = p * 3 // 0..300
        System.String.Concat(
            "<text x=\"10\" y=\"", s (y + 14), "\">", label, "</text>",
            "<rect x=\"230\" y=\"", s y, "\" width=\"300\" height=\"18\" fill=\"#eeeeee\"/>",
            "<rect x=\"230\" y=\"", s y, "\" width=\"", s w, "\" height=\"18\" fill=\"#3399cc\"/>",
            "<text x=\"540\" y=\"", s (y + 14), "\">", s p, "</text>")

    /// Render the societal-DORA metrics as a pure, scriptless, deterministic SVG dashboard string.
    let render (m: SocietalDora.Metrics) : string =
        let gauges =
            [ "EmpowermentFrequency", m.EmpowermentFrequency
              "CaptureRate", m.CaptureRate
              "MirrorRate", m.MirrorRate
              "QpgWeightedEmpowerment", m.QpgWeightedEmpowerment ]
            |> List.mapi (fun i (lbl, v) -> bar (40 + i * 36) lbl v)
            |> String.concat ""

        System.String.Concat(
            "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 580 210\" width=\"580\" height=\"210\">",
            "<text x=\"10\" y=\"22\">Societal DORA — mutual-empowerment health</text>",
            gauges,
            "</svg>")

    /// Wrap the dashboard SVG in a complete **static HTML page** — pure HTML + CSS, **no JavaScript** (the
    /// `HtmlCssBinding` ethos). A viewable artifact: open the string as `.html` in any browser, no runtime.
    /// Deterministic ⇒ byte-lockable. Slice 1.5 of the demo UX/UI.
    let renderPage (m: SocietalDora.Metrics) : string =
        System.String.Concat(
            "<!DOCTYPE html>",
            "<html lang=\"en\"><head><meta charset=\"utf-8\"/>",
            "<title>Zeta — Societal DORA</title>",
            "<style>",
            "body{font-family:system-ui,sans-serif;background:#0f1115;color:#e6e6e6;margin:0;padding:32px}",
            "main{max-width:640px;margin:0 auto}",
            "h1{font-size:18px;font-weight:600;margin:0 0 4px}",
            "p{color:#9aa0a6;margin:0 0 24px;font-size:13px}",
            "svg text{fill:#e6e6e6;font-family:system-ui,sans-serif;font-size:13px}",
            "</style></head><body><main>",
            "<h1>Zeta — Societal DORA</h1>",
            "<p>mutual-empowerment health, rendered declaratively (no JS). The feels are the alarm; the numbers are the backing.</p>",
            render m,
            "</main></body></html>")
