namespace Zeta.Core

/// FourCorner — the bidirectional-feedback I/O object, **graduated `tools → src`** (Aaron 2026-06-10:
/// "yes let's put 4 corners in src"). The F# port of `FourCornerOwnership<TIn, TOut, TOutFeedback,
/// TInFeedback>` from `src/Core.TypeScript/workflow-engine/types.ts` (used by `tools/observe/observe.ts` — the
/// observe/emit primitive, "we've had this since the beginning"). Per the tools→src rule (`tools/` is the
/// dependency *shield*, not where our-own primitives live), this is our-own and belongs in `src/`.
///
/// **The four corners** = a 2×2 of (data × feedback) × (in × out), with implicit directionality (each axis
/// directed) ⇒ a compass **N S E W = {1, i, −1, −i} = C₄ = `i`-rotation** (the harmonic four-corner phase;
/// why Cayley-Dickson is everywhere). That C₄ is a **labeling** of this record, not an identification
/// with Cl(p,q) — generator squares ±1 are signature, and C₄ sits in Cl(3,0)'s even subalgebra as
/// `e₁₂² = −1`, not as a vector. Checked in `FourCornerC4`. `TInFeedback` is **co-owned — both sides contribute** — which is
/// "each is backpressure from the other's perspective" (frame-relative, no absolute backpressure). The
/// fusion target (081KTQD8A0008QG0R0005EFYPV): the `ISR` arrow's feedback channel becomes this object. Pure record, no classes.
[<RequireQualifiedAccess>]
module FourCorner =

    /// The four-corner ownership object: data flows forward (`TIn` → `TOut`), feedback flows back
    /// (`TOutFeedback` / `TInFeedback`). `TIn` is required; the other three corners are optional (a tick
    /// may not have emitted output / authored feedback / received an ack yet) — mirrors the TS `?` fields.
    type FourCornerOwnership<'TIn, 'TOut, 'TOutFeedback, 'TInFeedback> =
        { /// what comes in (e.g. an OperatorMessage)
          TIn: 'TIn
          /// what the agent emits back (e.g. an OperatorResponse)
          TOut: 'TOut option
          /// control-flow the agent authors on the channel (e.g. ConvFeedback)
          TOutFeedback: 'TOutFeedback option
          /// the co-owned channel — BOTH sides contribute (e.g. a keepalive/ack); each side's contribution
          /// is the other side's backpressure
          TInFeedback: 'TInFeedback option }

    /// Just the input — no output, no feedback yet (the resting corner: only `TIn` set).
    let ofIn (tIn: 'TIn) : FourCornerOwnership<'TIn, 'TOut, 'TOutFeedback, 'TInFeedback> =
        { TIn = tIn; TOut = None; TOutFeedback = None; TInFeedback = None }

    /// Set the emitted output (`TOut`).
    let withOut (tOut: 'TOut) (o: FourCornerOwnership<'TIn, 'TOut, 'TOutFeedback, 'TInFeedback>) =
        { o with TOut = Some tOut }

    /// Set the agent-authored feedback (`TOutFeedback`).
    let withOutFeedback (fb: 'TOutFeedback) (o: FourCornerOwnership<'TIn, 'TOut, 'TOutFeedback, 'TInFeedback>) =
        { o with TOutFeedback = Some fb }

    /// Set the co-owned feedback (`TInFeedback`) — the other side's contribution = your backpressure.
    let withInFeedback (fb: 'TInFeedback) (o: FourCornerOwnership<'TIn, 'TOut, 'TOutFeedback, 'TInFeedback>) =
        { o with TInFeedback = Some fb }

    /// Has the tick produced output yet? (the forward corner is filled)
    let hasOutput (o: FourCornerOwnership<'TIn, 'TOut, 'TOutFeedback, 'TInFeedback>) : bool = o.TOut.IsSome

    /// Has feedback crossed in either direction? (the backpressure corners)
    let hasFeedback (o: FourCornerOwnership<'TIn, 'TOut, 'TOutFeedback, 'TInFeedback>) : bool =
        o.TOutFeedback.IsSome || o.TInFeedback.IsSome

    // ── The TREATY codec (081KTQD8A0008QG0R0005EFYPV trigger FIRED: "we are the consumer for our treaties") ──
    // Canonical text-line wire form for the string-quad instantiation (the operator-channel shape).
    // The F# oracle locks these bytes first; C#/TS/Rust conform to the same golden lines. Format:
    //   fourcorner1<TAB>esc(tIn)<TAB>opt<TAB>opt<TAB>opt   where opt = "-" (None) | "+" + esc(value)
    // Escaping: \\ \t \n \r (the RecordedSource house style). Deterministic: same value ⇒ same bytes.

    let private esc (s: string) =
        s.Replace("\\", "\\\\").Replace("\t", "\\t").Replace("\n", "\\n").Replace("\r", "\\r")

    let private unesc (s: string) =
        let sb = System.Text.StringBuilder()
        let mutable i = 0
        while i < s.Length do
            if s.[i] = '\\' && i + 1 < s.Length then
                (match s.[i + 1] with
                 | 't' -> sb.Append '\t'
                 | 'n' -> sb.Append '\n'
                 | 'r' -> sb.Append '\r'
                 | c -> sb.Append c)
                |> ignore
                i <- i + 2
            else
                sb.Append s.[i] |> ignore
                i <- i + 1
        sb.ToString()

    let private optToText =
        function
        | None -> "-"
        | Some (v: string) -> "+" + esc v

    let private optOfText (s: string) : string option voption =
        if s = "-" then ValueSome None
        elif s.StartsWith "+" then ValueSome(Some(unesc (s.Substring 1)))
        else ValueNone // malformed

    /// Serialize the string-quad four-corner to its canonical treaty line (byte-deterministic).
    let toLine (o: FourCornerOwnership<string, string, string, string>) : string =
        sprintf "fourcorner1\t%s\t%s\t%s\t%s" (esc o.TIn) (optToText o.TOut) (optToText o.TOutFeedback) (optToText o.TInFeedback)

    /// Parse a canonical treaty line (inverse of `toLine`); `None` on malformed input (honest refusal).
    let ofLine (line: string) : FourCornerOwnership<string, string, string, string> option =
        match line.Split('\t') with
        | [| "fourcorner1"; tIn; o1; o2; o3 |] ->
            match optOfText o1, optOfText o2, optOfText o3 with
            | ValueSome tOut, ValueSome tOutFb, ValueSome tInFb ->
                Some
                    { TIn = unesc tIn
                      TOut = tOut
                      TOutFeedback = tOutFb
                      TInFeedback = tInFb }
            | _ -> None
        | _ -> None
