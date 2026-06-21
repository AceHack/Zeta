namespace Zeta.Core

/// SwarmBoardAnsi — **the ANSI/BBS render binding of the swarm board** (081KTSZN10008QG0R0003SDRWD stage; the feel
/// charter's dress code: "text-first, terminal-native; ANSI/CP437 is the dress code" — the
/// pre-internet BBS door-game look, "like claude code", for Max and Addison).
///
/// This is a BINDING of `universal/color.md` at capability **ANSI-16**: a pure function
/// `Board → string list` (lines, ready for a terminal). Honest capability: 16 colors via SGR codes;
/// the box is CP437-style drawn with Unicode box-drawing (the modern terminal's CP437); heat maps to
/// the classic threat ladder green→yellow→red (the door-game convention). `plain` strips SGR for the
/// Mono1/test binding — SAME layout, zero color: the zero case is structural (extension discipline).
[<RequireQualifiedAccess>]
module SwarmBoardAnsi =

    let private esc (code: string) = "[" + code + "m"
    let private reset = esc "0"

    /// The door-game heat ladder: cool=green, warm=yellow, hot=red (bright), cold/zero=dim.
    let private heatSgr (h: float) : string =
        if h <= 0.0 then esc "2" // dim
        elif h < 0.3 then esc "32" // green
        elif h < 0.7 then esc "33" // yellow
        else esc "1;31" // bright red

    /// A heat bar, door-game style: ten cells of █/░ (the Lite-Brite pegboard in one dimension).
    let private bar (h: float) : string =
        let filled = min 10 (max 0 (int (h * 10.0 + 0.5)))
        String.replicate filled "█" + String.replicate (10 - filled) "░"

    /// Render the board as a BBS screen for one sitter: box-drawn frame, room rows (heat bar + who's
    /// there), and the narrator line at the bottom (the DM speaks). Deterministic (ordinal order).
    let render (who: string) (b: SwarmBoard.Board) : string list =
        let width = 56

        let top = "╔" + String.replicate width "═" + "╗"
        let mid = "╟" + String.replicate width "─" + "╢"
        let bot = "╚" + String.replicate width "═" + "╝"

        let pad (s: string) (visibleLen: int) =
            "║ " + s + String.replicate (max 0 (width - 1 - visibleLen)) " " + "║"

        let title =
            let t = "THE SWARM BOARD ── where does the society run hot?"
            pad t t.Length

        let roomRows =
            b.Rooms
            |> Map.toList // Map iterates ordinal on string keys — deterministic
            |> List.map (fun (name, r) ->
                let occupants =
                    b.Presence
                    |> Map.toList
                    |> List.filter (fun (_, room) -> room = name)
                    |> List.map fst
                    |> List.sortWith (fun a c -> System.String.CompareOrdinal(a, c))

                let occ = if List.isEmpty occupants then "" else " · " + String.concat ", " occupants
                let visible = sprintf "%-12s %s %5.3f%s" name (bar r.Heat) r.Heat occ
                let colored = sprintf "%-12s %s%s%s %5.3f%s" name (heatSgr r.Heat) (bar r.Heat) reset r.Heat occ
                pad colored visible.Length)

        let narration = SwarmBoard.narrate who b
        let dmRow = pad (esc "36" + narration + reset) narration.Length

        [ top; title; mid ] @ roomRows @ [ mid; dmRow; bot ]

    /// The Mono1/zero-case binding: the SAME screen with every SGR escape stripped (structural zero
    /// case — the extension discipline: color absent ⇒ identical layout, not a different screen).
    let plain (who: string) (b: SwarmBoard.Board) : string list =
        let strip (s: string) =
            System.Text.RegularExpressions.Regex.Replace(s, "\\[[0-9;]*m", "")

        render who b |> List.map strip
