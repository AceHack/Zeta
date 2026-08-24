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

/// Extract the grid region EXACTLY rather than by containment: a mutant that appends anything after
/// the cards inside the grid still CONTAINS them, so containment passes on a tampered page. Hoisted
/// to module scope 2026-08-23 so the generative property below can use the same extractor as the
/// [<Fact>] at the bottom of the file; the two were duplicating it.
let private gridOf (html: string) : string =
    let openTag = "<div class=\"grid\">"
    let closeTag = "</div><footer>"
    let i = html.IndexOf(openTag, StringComparison.Ordinal)
    let j = html.IndexOf(closeTag, StringComparison.Ordinal)
    if i < 0 || j <= i then
        failwith "the page must carry exactly one grid region"

    html.Substring(i + openTag.Length, j - (i + openTag.Length))

[<Property>]
let ``the minted card content is invariant under the render clock — the ARITY-2 form`` (a: int) (b: int) (s: int) (p1: int64) (u1: int64) (p2: int64) (u2: int64) (utc1: int) (utc2: int) =
    // REWRITTEN 2026-08-23 (Soraya), workitem 081M0RAX8AC087G0R003NQM7P9. This property used to be
    // named "renderCard (the minted content) is a pure function of the link — no clock input" and
    // used to read
    //     let l = mintedLink a b s
    //     MP.renderCard l = MP.renderCard l
    // a value compared to itself. NONINTERFERENCE IS NOT A PROPERTY, IT IS A HYPERPROPERTY: a
    // predicate over PAIRS of executions, and specifically 2-safety (Clarkson & Schneider,
    // Hyperproperties, CSF 2008 / JCS 18(6):1157, 2010). No single-run check can decide it — that is
    // a theorem, not a coverage gap. The pair here shared its ambient clock, i.e. it was degenerate
    // in exactly the variable whose influence was being denied, so its failure probability under its
    // own target bug was ~0 while its name claimed the stronger property.
    //
    // Honest scope of the OLD line, stated so this is not rounded up: it was not strictly vacuous —
    // an impure `renderCard` reading a fine-grained ambient clock could have made the two
    // evaluations differ. It was near-vacuous, which is a different disposition and a different fix.
    //
    // `renderCard` cannot be handed a clock, so the arity-2 statement is made at the surface that
    // CAN see one: the card block `renderPage` emits must equal the standalone card under BOTH
    // clocks. That goes red the instant `renderPage` interpolates any clock datum into a card, which
    // is precisely the leak this file exists to forbid. The sibling property above already had this
    // shape (two clocks, `stripClock page1 = stripClock page2`); this one now matches it.
    let l = mintedLink a b s
    let c1 = clock p1 (sprintf "2026-06-%02dT00:00:00Z" (abs (utc1 % 27) + 1)) u1
    let c2 = clock p2 (sprintf "2026-06-%02dT00:00:00Z" (abs (utc2 % 27) + 1)) u2
    let card = MP.renderCard l
    gridOf (MP.renderPage "imdb" true c1 [ l ]) = card
    && gridOf (MP.renderPage "imdb" true c2 [ l ]) = card

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
    // ...and the card block is embedded VERBATIM under either clock.
    //
    // REWRITTEN 2026-08-18 (Soraya). This line used to read
    //     Assert.Equal<string>(cardsOf links, cardsOf links)
    // under the comment "and the cards themselves are unchanged". `cardsOf` takes no
    // clock, so both sides were the SAME expression and the assertion could not fail
    // for any implementation of anything. It claimed a second, independent quarantine
    // check and made none: the vacuity class, sitting inside a noninterference proof.
    //
    // The claim the comment intends is failable and is now made: the card block
    // renderPage produces must be byte-identical to the standalone card rendering,
    // under BOTH clocks. That breaks the moment renderPage interpolates any clock
    // data into a card, which is precisely the leak this file exists to forbid.
    let cardsOf (ls: CostarFederations.MintedLink list) =
        ls |> List.map MP.renderCard |> String.concat ""

    // The grid region is extracted EXACTLY rather than tested for containment. An earlier
    // draft of this fix used Assert.Contains and was itself too weak: a mutant that
    // appends anything after the cards inside the grid still contains them, so
    // containment passed on a page that had been tampered with. Measured, not argued —
    // the mutant `cards + "<!--x-->"` survived Contains and dies against this.
    // The extractor is now the module-level `gridOf` (2026-08-23): the generative property above
    // needs the same one, and two copies of an extractor is two chances to weaken one of them.
    let cards = cardsOf links
    Assert.Equal<string>(cards, gridOf (MP.renderPage "imdb" true early links))
    Assert.Equal<string>(cards, gridOf (MP.renderPage "imdb" true later links))
