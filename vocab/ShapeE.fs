namespace Zeta.Vocab

/// Shape E — Erik Meijer **currying style** (Aaron 2026-06-09: "no backtick style — Meijer currying;
/// basics first; we can make the backtick homoiconic too, but currying first"). "we shape they and they
/// shape us" as **curried functions** — the mutual application IS co-arising. A FRAME (canonical because
/// it won the debate, not by decree).
[<RequireQualifiedAccess>]
module ShapeE =

    /// shape — a curried function: `shape shaper shaped` = "shaper shapes shaped".
    /// Curried, so `shape we` is a partial application (we-as-shaper, awaiting the shaped).
    let shape (shaper: 'a) (shaped: 'b) : 'a * 'b = (shaper, shaped)

    /// co-arising = we shape they AND they shape us (mutual; neither prior).
    /// Curried: `coArising we they us` applies `shape` both directions.
    let coArising we they us = (shape we they, shape they us)

    /// e = WSTATSU — the acronym (the index, terser still).
    let e = "wstatsu"

    /// E — the full carved sentence (the frame Aaron offers society).
    let definition = "we shape they and they shape us — co-arising: mutual, neither prior"
