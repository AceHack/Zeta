module Zeta.Tests.Formal.SocietalDoraSvgTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// Slice 1 of the Zeta demo UX/UI: SocietalDora.Metrics → pure SVG
// (no script, integer coords, deterministic = byte-lockable). Verified
// F# substrate; no Q#. docs/research/2026-06-19-zeta-demo-ux-ui-…
// ═══════════════════════════════════════════════════════════════════

let private c s o : SocietalDora.Coupled = { Self = s; Other = o }

let private indep =
    [ for a in 0..2 do
          for u in 0..2 -> (a, u, 0) ] // ρ_owe = 1

[<Fact>]
let ``render is well-formed, scriptless, and deterministic`` () =
    let edges = [ SocietalDora.edgeHealth "a->b" indep [ c 1.0 1.0; c 2.0 1.0 ] ]
    let m = SocietalDora.compute 0.5 edges
    let svg = SocietalDoraSvg.render m
    svg.Contains "<svg" |> should equal true
    svg.Contains "</svg>" |> should equal true
    svg.Contains "<script" |> should equal false // declarative only — no live state
    // deterministic ⇒ byte-lockable (same metrics, same bytes)
    SocietalDoraSvg.render m |> should equal svg

[<Fact>]
let ``a fully-empowering, non-mirror graph renders full empowerment and zero capture bars`` () =
    let edges =
        [ SocietalDora.edgeHealth "aaron->girl" indep [ c 1.0 1.0; c 1.0 2.0 ]
          SocietalDora.edgeHealth "girl->audience" indep [ c 1.0 1.0; c 2.0 1.0 ] ]
    let m = SocietalDora.compute 0.5 edges // EmpowermentFrequency 1.0, CaptureRate 0.0, MirrorRate 0.0
    let svg = SocietalDoraSvg.render m
    // EmpowermentFrequency = 1.0 ⇒ the percent label 100 is shown (unambiguous; the track is always 300px)
    svg.Contains ">100<" |> should equal true
    // all four gauge labels present
    svg.Contains "EmpowermentFrequency" |> should equal true
    svg.Contains "CaptureRate" |> should equal true
    svg.Contains "MirrorRate" |> should equal true
    svg.Contains "QpgWeightedEmpowerment" |> should equal true

[<Fact>]
let ``empty graph renders all-zero bars (no false health on the dashboard)`` () =
    let svg = SocietalDoraSvg.render (SocietalDora.compute 0.5 [])
    svg.Contains "<svg" |> should equal true
    // every gauge reads 0% (unambiguous percent label); none reads 100%
    svg.Contains ">0<" |> should equal true
    svg.Contains ">100<" |> should equal false

// ═══════════════════════════════════════════════════════════════════
// Encoder faithfulness — 081M00TYT8N087G0R003MPMRX9.
//
// The old `pct` CLAMPED: `1.5` and `infinity` rendered as a confident 100% bar,
// `-0.5` and `nan` as a confident 0% bar. The clamp was latent (SocietalDora.compute
// cannot currently emit out-of-range values) but a hand-built or regressed `Metrics`
// hit it, and it rendered a measurement that was never made.
//
// Every test below FAILS against the pre-fix renderer.
// ═══════════════════════════════════════════════════════════════════

/// A `Metrics` with one rendered field set out of range — the shape a regression would take.
let private metricsWith (v: float) : SocietalDora.Metrics =
    { EmpowermentFrequency = v
      CaptureRate = 0.0
      MeanRecoveryLength = 0.0
      MirrorRate = 0.0
      MeanCoupledGain = 0.0
      MeanQpg = 0.0
      QpgWeightedEmpowerment = 0.0 }

[<Fact>]
let ``UnitInterval refuses everything outside [0,1] — nan and the infinities are NOT clamped`` () =
    UnitInterval.tryOf 0.0 |> Option.isSome |> should equal true
    UnitInterval.tryOf 1.0 |> Option.isSome |> should equal true
    UnitInterval.tryOf 0.5 |> Option.isSome |> should equal true
    // the four the clamp used to absorb silently
    UnitInterval.tryOf 1.5 |> Option.isNone |> should equal true
    UnitInterval.tryOf -0.5 |> Option.isNone |> should equal true
    UnitInterval.tryOf nan |> Option.isNone |> should equal true
    UnitInterval.tryOf infinity |> Option.isNone |> should equal true

[<Fact>]
let ``percent is exact through the origin, so a bar length is proportional to its value`` () =
    let pctOf v =
        UnitInterval.tryOf v |> Option.map UnitInterval.percent

    pctOf 0.0 |> should equal (Some 0)
    pctOf 0.5 |> should equal (Some 50)
    pctOf 1.0 |> should equal (Some 100)

[<Fact>]
let ``an above-range metric renders as visibly broken, never as a confident full bar`` () =
    // pre-fix: pct 1.5 = 100 ⇒ a full 300px bar labelled "100" — indistinguishable
    // from a genuine, perfectly healthy 100%.
    let svg = SocietalDoraSvg.render (metricsWith 1.5)
    svg.Contains "out-of-range" |> should equal true
    let healthy = SocietalDoraSvg.render (metricsWith 1.0)
    svg |> should not' (equal healthy)

[<Fact>]
let ``a nan metric renders as visibly broken, never as a confident empty bar`` () =
    // pre-fix: pct nan = 0 ⇒ a 0% bar, which on CaptureRate reads as "no capture at all".
    // A missing measurement acquired the appearance of an excellent one.
    let svg = SocietalDoraSvg.render (metricsWith nan)
    svg.Contains "out-of-range" |> should equal true
    let idle = SocietalDoraSvg.render (metricsWith 0.0)
    svg |> should not' (equal idle)

[<Fact>]
let ``a below-range metric is distinguishable from a genuine zero`` () =
    let broken = SocietalDoraSvg.render (metricsWith -0.5)
    let idle = SocietalDoraSvg.render (metricsWith 0.0)
    broken.Contains "out-of-range" |> should equal true
    idle.Contains "out-of-range" |> should equal false
    broken |> should not' (equal idle)

[<Fact>]
let ``in-range metrics are unchanged by the refinement — the gauge still renders proportionally`` () =
    // the fix must not disturb the faithful path: still deterministic, still byte-lockable
    let svg = SocietalDoraSvg.render (metricsWith 0.5)
    svg.Contains "out-of-range" |> should equal false
    svg.Contains ">50<" |> should equal true
    svg.Contains "width=\"150\"" |> should equal true // 50% of the 300px track
    SocietalDoraSvg.render (metricsWith 0.5) |> should equal svg

[<Fact>]
let ``renderPage is a complete, scriptless, deterministic HTML document embedding the SVG`` () =
    let m = SocietalDora.compute 0.5 [ SocietalDora.edgeHealth "a->b" indep [ c 1.0 1.0 ] ]
    let page = SocietalDoraSvg.renderPage m
    page.Contains "<!DOCTYPE html>" |> should equal true
    page.Contains "</html>" |> should equal true
    page.Contains "<svg" |> should equal true // the dashboard is embedded
    page.Contains "<script" |> should equal false // pure HTML/CSS, no JS
    SocietalDoraSvg.renderPage m |> should equal page // deterministic ⇒ byte-lockable
