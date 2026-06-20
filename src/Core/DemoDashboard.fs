namespace Zeta.Core

open System
open System.Globalization

/// **`DemoDashboard` — the unified living dashboard (Aaron 2026-06-19, shadow\*).**
///
/// One static **HTML/CSS page (no JS)** composing the shipped demo renders into a single view: the **Zeta-NTP
/// clock** + **grounding** indicator, the **federation graph** (`CoEmpowerGraphSvg`), the **minted-NFT cards**
/// (`MintPanel`), and the optional **societal-DORA dials** (`SocietalDoraSvg`). Deterministic + byte-lockable
/// (the clock is injected, not read from ambient wall time); the whole arc — fetch → graph → federations → minted links →
/// dials — on one page.
[<RequireQualifiedAccess>]
module DemoDashboard =

    let private si (i: int64) : string = i.ToString(CultureInfo.InvariantCulture)

    let private esc (s: string) : string =
        s
            .Replace("&", "&amp;", StringComparison.Ordinal)
            .Replace("<", "&lt;", StringComparison.Ordinal)
            .Replace(">", "&gt;", StringComparison.Ordinal)

    let private css =
        "body{font-family:system-ui,sans-serif;background:#1b1f24;color:#e6e6e6;margin:0;padding:24px}" +
        "h1{font-size:22px;font-weight:600}h2{font-size:15px;color:#9fb6c9;margin:18px 0 8px}" +
        ".clock{font-family:monospace;color:#9fb6c9}.ok{color:#54b894}.warn{color:#e0563f}" +
        ".row{display:flex;flex-wrap:wrap;gap:28px;align-items:flex-start}" +
        ".grid{display:flex;flex-wrap:wrap;gap:12px}" +
        ".nft{background:#222831;border:1px solid #3a424c;border-radius:8px;padding:12px 14px;min-width:170px}" +
        ".pair{font-weight:600}.link{color:#3399cc}.rating{color:#9fb6c9;font-size:13px;margin-top:6px}" +
        "footer{margin-top:20px;color:#6b7682;font-size:12px}"

    /// The complete dashboard page. `dora = None` omits the dials section.
    let renderPage
        (clock: MintPanel.MintClock)
        (grounded: bool)
        (source: string)
        (graph: CoEmpowerGraph.Graph)
        (links: CostarFederations.MintedLink list)
        (dora: SocietalDora.Metrics option)
        : string =
        let cards = links |> List.map MintPanel.renderCard |> String.concat ""

        let groundBadge =
            if grounded then
                String.Concat("<span class=\"ok\">&#10003; grounded — backed by ", esc source, "</span>")
            else
                "<span class=\"warn\">&#9888; ungrounded — unbacked (not real)</span>"

        let clockLine =
            String.Concat("phase ", si clock.Phase, " &middot; UTC ", esc clock.Utc, " &plusmn; ", si clock.UncertaintyMs, "ms")

        let dialsBlk =
            match dora with
            | Some m -> String.Concat("<h2>Societal-DORA health</h2>", SocietalDoraSvg.render m)
            | None -> ""

        String.Concat(
            "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Zeta — living dashboard</title><style>",
            css,
            "</style></head><body><h1>Zeta — living dashboard</h1><div class=\"clock\">",
            clockLine,
            "</div><div>",
            groundBadge,
            "</div><div class=\"row\"><div><h2>Federation graph</h2>",
            CoEmpowerGraphSvg.render 280 graph,
            "</div><div>",
            dialsBlk,
            "</div></div><h2>Minted relational links</h2><div class=\"grid\">",
            cards,
            "</div><footer>Federation graph + societal-DORA dials + minted NFT links, one page. Mint-time = soft-phase + UTC. No JS; deterministic.</footer></body></html>"
        )
