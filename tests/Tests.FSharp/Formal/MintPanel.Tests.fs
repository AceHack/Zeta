module Zeta.Tests.Formal.MintPanelTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core

module M = Zeta.Core.MintPanel
module F = Zeta.Core.CostarFederations
module I = Zeta.Core.ImdbDataset

let private links =
    F.reverseMint (
        I.parsePrincipals
            [ "tconst\tordering\tnconst\tcategory\tjob\tcharacters"
              "tt001\t1\tnm0001\tactor\t\\N\t\\N"
              "tt001\t2\tnm0002\tactress\t\\N\t\\N" ]
    )

let private clock = { M.Phase = 42L; M.Utc = "2026-06-19T12:00:00Z"; M.UncertaintyMs = 5L }

[<Fact>]
let ``a card shows the pair and its shared-title rating`` () =
    let card = M.renderCard { F.A = "nm0001"; F.B = "nm0002"; F.SharedTitles = 3 }
    card.Contains "nm0001" |> should equal true
    card.Contains "nm0002" |> should equal true
    card.Contains "shared titles: <b>3</b>" |> should equal true

[<Fact>]
let ``renderPage is a complete, scriptless HTML page with the clock and grounding`` () =
    let html = M.renderPage "IMDb non-commercial dataset" true clock links
    html.StartsWith("<!DOCTYPE html>", System.StringComparison.Ordinal) |> should equal true
    html.Contains "</html>" |> should equal true
    html.Contains "<script" |> should equal false
    html.Contains "phase 42" |> should equal true // Zeta-NTP clock
    html.Contains "UTC 2026-06-19T12:00:00Z" |> should equal true
    html.Contains "grounded — backed by IMDb non-commercial dataset" |> should equal true
    html.Contains "nm0001" |> should equal true // the minted link

[<Fact>]
let ``ungrounded renders the not-real warning`` () =
    let html = M.renderPage "?" false clock links
    html.Contains "ungrounded" |> should equal true
    html.Contains "grounded — backed by" |> should equal false

[<Fact>]
let ``rendering escapes markup and is deterministic`` () =
    let dangerous = M.renderCard { F.A = "<x>"; F.B = "a&b"; F.SharedTitles = 1 }
    dangerous.Contains "&lt;x&gt;" |> should equal true
    dangerous.Contains "a&amp;b" |> should equal true
    M.renderPage "src" true clock links |> should equal (M.renderPage "src" true clock links)
