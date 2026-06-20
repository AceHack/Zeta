namespace Zeta.Core

open System
open System.Globalization

/// **`MintPanel` — demo slice 3: the NFT mint panel + Zeta-NTP clock + grounding indicator (Aaron 2026-06-19, shadow\*).**
///
/// Renders the carved thesis as a viewable, **pure HTML/CSS page (no JS)**: each `CostarFederations.MintedLink`
/// is a **minted relational NFT** — *an objectively-rateable remembered link between two travelers*, rated by
/// shared titles — stamped with the **Zeta-NTP mint time** (the soft-phase tick + the correlated UTC observation
/// ± uncertainty) and a **grounding indicator** (backed by a real source = grounded; unbacked = the
/// children's-game / not-real warning). Deterministic + byte-lockable: the clock is **injected** (not
/// `DateTime.Now` — noninterference), so the same inputs render the same page.
[<RequireQualifiedAccess>]
module MintPanel =

    /// The captured Zeta-NTP mint time: the soft-phase tick + the correlated UTC observation ± uncertainty
    /// (Earth sources → UTC is the best Earth-time, a correlated observation of the common-seed phase).
    type MintClock =
        { Phase: int64
          Utc: string
          UncertaintyMs: int64 }

    let private si (i: int64) : string = i.ToString(CultureInfo.InvariantCulture)

    let private esc (s: string) : string =
        s
            .Replace("&", "&amp;", StringComparison.Ordinal)
            .Replace("<", "&lt;", StringComparison.Ordinal)
            .Replace(">", "&gt;", StringComparison.Ordinal)

    let private css =
        "body{font-family:system-ui,sans-serif;background:#1b1f24;color:#e6e6e6;margin:0;padding:24px}" +
        "h1{font-size:20px;font-weight:600}" +
        ".clock{font-family:monospace;color:#9fb6c9;margin:4px 0}" +
        ".ground{margin:8px 0 16px}.ok{color:#54b894}.warn{color:#e0563f}" +
        ".grid{display:flex;flex-wrap:wrap;gap:12px}" +
        ".nft{background:#222831;border:1px solid #3a424c;border-radius:8px;padding:12px 14px;min-width:180px}" +
        ".pair{font-weight:600}.link{color:#3399cc}.rating{color:#9fb6c9;font-size:13px;margin-top:6px}" +
        "footer{margin-top:20px;color:#6b7682;font-size:12px}"

    /// One minted-NFT card: the `A ⇄ B` remembered link, rated by shared-title count.
    let renderCard (link: CostarFederations.MintedLink) : string =
        String.Concat(
            "<div class=\"nft\"><div class=\"pair\">", esc link.A, " <span class=\"link\">&#8644;</span> ",
            esc link.B, "</div><div class=\"rating\">shared titles: <b>", si (int64 link.SharedTitles),
            "</b></div></div>"
        )

    /// The complete static HTML page (no JS): minted links + Zeta-NTP clock + grounding indicator.
    let renderPage
        (source: string)
        (grounded: bool)
        (clock: MintClock)
        (links: CostarFederations.MintedLink list)
        : string =
        let cards = links |> List.map renderCard |> String.concat ""

        let groundBadge =
            if grounded then
                String.Concat("<span class=\"ok\">&#10003; grounded — backed by ", esc source, "</span>")
            else
                "<span class=\"warn\">&#9888; ungrounded — unbacked link (a children's-game; not real)</span>"

        let clockLine =
            String.Concat("phase ", si clock.Phase, " &middot; UTC ", esc clock.Utc, " &plusmn; ", si clock.UncertaintyMs, "ms")

        String.Concat(
            "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\"><title>Zeta — minted relational links</title><style>",
            css,
            "</style></head><body><h1>Minted relational links</h1><div class=\"clock\">",
            clockLine,
            "</div><div class=\"ground\">",
            groundBadge,
            "</div><div class=\"grid\">",
            cards,
            "</div><footer>An NFT here = an objectively-rateable remembered link between travelers. Mint-time = captured soft-phase + UTC. No JS; deterministic.</footer></body></html>"
        )
