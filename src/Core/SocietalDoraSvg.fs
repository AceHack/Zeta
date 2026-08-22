namespace Zeta.Core

open System.Globalization

/// **A value known to lie in `[0,1]` — the refined input type for proportional gauges.**
///
/// The encoder-faithfulness audit (081M00TYT8N087G0R003MPMRX9) found `SocietalDoraSvg.pct`
/// clamping its input: `1.5` and `infinity` both rendered as a confident **100%**, `-0.5` and
/// `nan` both as a confident **0%**. The clamp was *latent* — `SocietalDora.compute` cannot
/// currently emit out-of-range values — but a latent clamp is a defect held one regression away
/// from firing, and when it fires it renders a plausible bar instead of a visible failure.
///
/// The fix is not to delete the branch (that would make the lie unconditional) but to MOVE it:
/// out-of-range is decided **once**, at construction, where it can be observed. `percent` is then
/// total and branch-free on a domain where no clamp is reachable.
///
/// **Stated domain:** finite `float` in `[0.0, 1.0]`.
/// **Stated injectivity property:** `percent` is a *declared, bounded* quantisation onto the 101
/// integers `0..100` — deliberately non-injective (a percent label), monotone non-decreasing, and
/// exact through the origin (`0.0 -> 0`, `1.0 -> 100`), so a bar's length is proportional to its
/// value and Tufte's lie factor is `1.0` on the rendered grid.
[<Struct>]
type UnitInterval = private UnitInterval of float

[<RequireQualifiedAccess>]
module UnitInterval =

    /// The only constructor. `nan` and the infinities are rejected — they are NOT clamped, because
    /// clamping them is precisely how a missing measurement acquires the appearance of one.
    let tryOf (v: float) : UnitInterval option =
        if System.Double.IsFinite v && v >= 0.0 && v <= 1.0 then Some(UnitInterval v) else None

    let value (UnitInterval v) : float = v

    /// The `[0,1]` value as an integer percent. Total and branch-free: the domain guarantees
    /// `0 <= round(v * 100) <= 100`, so there is nothing left to clamp.
    let percent (UnitInterval v) : int = int (System.Math.Round(v * 100.0))

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

    /// One horizontal gauge: label, a 300px track, a fill proportional to the value, and the percent.
    ///
    /// `v` is a `UnitInterval`, so the encoder needs no clamp: the out-of-range case cannot be
    /// constructed here, it is decided once at the boundary in `render`. The branch did not
    /// disappear — it RELOCATED UPSTREAM INTO A TYPE (081M00TYT8N087G0R003MPMRX9).
    let private bar (y: int) (label: string) (v: UnitInterval) : string =
        let p = UnitInterval.percent v
        let w = p * 3 // 0..300
        System.String.Concat(
            "<text x=\"10\" y=\"", s (y + 14), "\">", label, "</text>",
            "<rect x=\"230\" y=\"", s y, "\" width=\"300\" height=\"18\" fill=\"#eeeeee\"/>",
            "<rect x=\"230\" y=\"", s y, "\" width=\"", s w, "\" height=\"18\" fill=\"#3399cc\"/>",
            "<text x=\"540\" y=\"", s (y + 14), "\">", s p, "</text>")

    /// A gauge for a value that is NOT in `[0,1]` — rendered as a visibly broken dial, never as a
    /// plausible bar. The old `pct` clamp turned `1.5` into a confident 100% and `nan` into a
    /// confident 0%; both read as measurements that were never made.
    let private brokenBar (y: int) (label: string) : string =
        System.String.Concat(
            "<text x=\"10\" y=\"", s (y + 14), "\">", label, "</text>",
            "<rect x=\"230\" y=\"", s y, "\" width=\"300\" height=\"18\" fill=\"#eeeeee\"/>",
            "<rect x=\"230\" y=\"", s y, "\" width=\"300\" height=\"18\" fill=\"#cc3333\"/>",
            "<text x=\"540\" y=\"", s (y + 14), "\">", "out-of-range", "</text>")

    /// Encode one metric: in-domain values get a proportional gauge, out-of-domain values get a
    /// visible failure. This single site is where the domain is decided for the whole renderer.
    let private gauge (y: int) (label: string) (v: float) : string =
        match UnitInterval.tryOf v with
        | Some u -> bar y label u
        | None -> brokenBar y label

    /// Render the societal-DORA metrics as a pure, scriptless, deterministic SVG dashboard string.
    let render (m: SocietalDora.Metrics) : string =
        let gauges =
            [ "EmpowermentFrequency", m.EmpowermentFrequency
              "CaptureRate", m.CaptureRate
              "MirrorRate", m.MirrorRate
              "QpgWeightedEmpowerment", m.QpgWeightedEmpowerment ]
            |> List.mapi (fun i (lbl, v) -> gauge (40 + i * 36) lbl v)
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
