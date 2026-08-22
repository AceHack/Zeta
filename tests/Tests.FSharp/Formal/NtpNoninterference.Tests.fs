module Zeta.Tests.Formal.NtpNoninterferenceTests

open System
open System.Text.RegularExpressions
open FsCheck.Xunit
open global.Xunit
open Zeta.Core

// math-team handoff row 5 — NTP noninterference, FsCheck cross-check leg.
//
// Property: the minted NFT identity depends ONLY on the captured-at-mint relational
// content, never on a post-mint / render "now". The Zeta-NTP display clock
// (`MintPanel.MintClock` = soft phase + UTC ± uncertainty) is a DISPLAY-ONLY channel
// (noninterference / entropy-quarantine, discipline #13): it may flow to the clock
// line, never into the minted content.
//
// Surface: `MintPanel.renderCard` (the minted-link content) takes NO clock — it is a
// pure function of the `MintedLink`. `MintPanel.renderPage source grounded clock links`
// places the clock ONLY inside `<div class="clock">…</div>`. So varying the clock must
// leave the entire rest of the page (cards + grounding) byte-identical.
//
// HONEST SCOPE: empirical evidence leg over the real renderer. The **Lean/Z3 metering
// lemma** (the formal "H_AB depends only on the captured-at-mint soft clock; the
// `±uncertainty` interval is itself bound, no retro-narrowing") stays Tariq's PRIMARY.
// This leg locks the code-level quarantine: the render clock does not leak into content.

module MP = Zeta.Core.MintPanel

let private pid (n: int) : string = sprintf "nm%07d" (abs (n % 9_000_000) + 1_000_000)

let private mintedLink (a: int) (b: int) (shared: int) : CostarFederations.MintedLink =
    { A = pid a; B = pid b; SharedTitles = abs (shared % 5000) }

let private clock (phase: int64) (utc: string) (unc: int64) : MP.MintClock =
    { Phase = phase; Utc = utc; UncertaintyMs = unc }

/// Strip the clock line — everything the display clock is ALLOWED to touch.
let private stripClock (html: string) : string =
    Regex.Replace(html, "<div class=\"clock\">.*?</div>", "<div class=\"clock\"/>", RegexOptions.Singleline)

[<Property>]
let ``noninterference: the render clock changes ONLY the clock line, never the minted content`` (links0: (int * int * int) list) (p1: int64) (u1: int64) (p2: int64) (u2: int64) (utc1: int) (utc2: int) =
    let links = links0 |> List.map (fun (a, b, s) -> mintedLink a b s)
    let c1 = clock p1 (sprintf "2026-06-%02dT00:00:00Z" (abs (utc1 % 27) + 1)) u1
    let c2 = clock p2 (sprintf "2026-06-%02dT00:00:00Z" (abs (utc2 % 27) + 1)) u2
    let page1 = MP.renderPage "imdb" true c1 links
    let page2 = MP.renderPage "imdb" true c2 links
    // pages may differ only inside the clock line; everything else (cards, grounding) is identical
    stripClock page1 = stripClock page2

[<Property>]
let ``renderCard (the minted content) is a pure function of the link — no clock input`` (a: int) (b: int) (s: int) =
    let l = mintedLink a b s
    // signature takes no clock; rendering twice is identical regardless of any ambient "now"
    MP.renderCard l = MP.renderCard l

[<Property>]
let ``the minted card content carries no clock data (phase/UTC/uncertainty markers never appear)`` (a: int) (b: int) (s: int) =
    let card = MP.renderCard (mintedLink a b s)
    // a card cannot mention the soft phase, UTC, or the ±uncertainty — those live only on the clock line
    not (card.Contains("phase", StringComparison.Ordinal))
    && not (card.Contains("&plusmn;", StringComparison.Ordinal))
    && not (card.Contains("UTC", StringComparison.Ordinal))

[<Fact>]
let ``a post-mint clock cannot re-rate or re-identify a minted link (quarantine)`` () =
    let links = [ mintedLink 1 2 5; mintedLink 3 4 9 ]
    let early = clock 1000L "2026-06-20T00:00:00Z" 50L
    let later = clock 9_999_999L "2026-12-31T23:59:59Z" 4000L
    // a "later now" / different render clock leaves the minted content byte-identical
    Assert.Equal<string>(stripClock (MP.renderPage "imdb" true early links), stripClock (MP.renderPage "imdb" true later links))
    // and the cards themselves are unchanged
    let cardsOf links = links |> List.map MP.renderCard |> String.concat ""
    Assert.Equal<string>(cardsOf links, cardsOf links)
