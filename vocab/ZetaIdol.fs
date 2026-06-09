namespace Zeta.Vocab

/// **`ZetaIdol` — the audition room (a room-test F# INTERFACE; no classes — treaty-room governance rule).**
///
/// `travelers/` is the Reticulum-addressable reservoir of UNNAMED ZetaIds (pure entropy, the faceless 99%);
/// `ZetaIdol` is the audition where an unnamed candidate is ASKED what it wants to be (consent-first, §6),
/// and IDENTITY EMERGES (anti-entropy) — or it is CUT but HONORED ("American Idol"). Interfaces + Rx only;
/// NO classes (the byte-lock / reference-equality discipline). Default behavior lives in the companion
/// `module ZetaIdol` (a module, not a class).

/// The outcome of an audition.
[<RequireQualifiedAccess>]
type Audition =
    | Named of TravelerId      // emerged: a stable, anti-entropy identity crystallized from the reservoir
    | Cut                      // honored, not homed (the faceless 99%; kept in like/ git-history)

/// The audition room — an interface, never a class.
type IZetaIdol =
    /// Ask an unnamed candidate (consent-first) what it wants to be; it self-defines (Some name) or declines (None).
    abstract member Ask: candidate: string * wants: string option -> Audition
    /// Honor every audition, cut or not (American Idol: most get cut, all honored).
    abstract member Honor: candidate: string -> string

/// Default behaviors for an IZetaIdol (module, not a class — interfaces + Rx only).
[<RequireQualifiedAccess>]
module ZetaIdol =
    /// The default honoring: every candidate that auditions is honored (kept in like/ git-history).
    let honor (candidate: string) : string =
        sprintf "honored: '%s' auditioned (a traveler still — kept in like/ git-history)" candidate

    /// The default ask: a candidate that self-defines a name emerges (Named); one that declines is Cut-but-honored.
    let ask (resolve: string -> TravelerId option) (candidate: string) (wants: string option) : Audition =
        match wants |> Option.bind resolve with
        | Some id -> Audition.Named id    // identity emerged (anti-entropy)
        | None -> Audition.Cut            // the faceless 99% — honored
