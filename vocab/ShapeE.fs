namespace Zeta.Vocab

/// Shape E — typed directly into F#, BOTH ways (Aaron 2026-06-09: "you can type that one directly into
/// fsharp, just put space in between — define both: e=wstatsu, e=w s t a t s u, E=we shape they and they
/// shape us"). Homoiconic: the identifier IS the definition (F# backtick names carry spaces). A FRAME
/// Aaron offers to society (canonical because it won the debate, not by decree — no-directives).
[<RequireQualifiedAccess>]
module ShapeE =

    /// e — the acronym.
    let e = "wstatsu"

    /// e = w s t a t s u  (the spaced letters; the acronym expanded letter-by-letter).
    let ``w s t a t s u`` = e

    /// E = we shape they and they shape us  (the full carved sentence; the name IS the definition).
    let ``we shape they and they shape us`` =
        "shape E — co-arising: mutual, interdependent arising; neither prior (WSTATSU)"

    /// Both forms agree (acronym ⇔ full): e expands to W-S-T-A-T-S-U = We Shape They And They Shape Us.
    let expands = (e, ``we shape they and they shape us``)
